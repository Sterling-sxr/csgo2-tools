interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

interface WorkerEnvironment {
  FACEIT_API_KEY: string;
  RATE_LIMITER: RateLimitBinding;
}

interface WorkerExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

const FACEIT_ORIGIN = "https://open.faceit.com";
const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "x-content-type-options": "nosniff",
} as const;

type AllowedRequest = {
  cacheSeconds: number;
  upstreamUrl: URL;
};

function jsonResponse(body: unknown, status: number, extraHeaders?: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...JSON_HEADERS,
      "cache-control": "no-store",
      ...extraHeaders,
    },
  });
}

function isSafeId(value: string) {
  return /^[a-zA-Z0-9-]{8,80}$/.test(value);
}

function readInteger(
  searchParams: URLSearchParams,
  name: string,
  minimum: number,
  maximum: number,
) {
  const rawValue = searchParams.get(name);
  if (rawValue === null) {
    return null;
  }

  if (!/^\d+$/.test(rawValue)) {
    throw new Error(`${name} must be an integer`);
  }

  const value = Number(rawValue);
  if (value < minimum || value > maximum) {
    throw new Error(`${name} is outside the allowed range`);
  }

  return value;
}

function rejectUnknownParameters(
  searchParams: URLSearchParams,
  allowedNames: string[],
) {
  for (const name of searchParams.keys()) {
    if (!allowedNames.includes(name)) {
      throw new Error(`Unsupported query parameter: ${name}`);
    }
  }
}

function validatePlayerSearch(url: URL) {
  rejectUnknownParameters(url.searchParams, ["nickname", "game"]);
  const nickname = url.searchParams.get("nickname")?.trim() ?? "";
  const game = url.searchParams.get("game");

  if (!nickname || nickname.length > 32 || /[\u0000-\u001f\u007f]/.test(nickname)) {
    throw new Error("nickname is invalid");
  }

  if (game !== "cs2") {
    throw new Error("Only CS2 player searches are allowed");
  }
}

function validateHistoryQuery(url: URL) {
  rejectUnknownParameters(url.searchParams, [
    "game",
    "offset",
    "limit",
    "from",
    "to",
  ]);

  if (url.searchParams.get("game") !== "cs2") {
    throw new Error("Only CS2 history is allowed");
  }

  readInteger(url.searchParams, "offset", 0, 10_000);
  readInteger(url.searchParams, "limit", 1, 100);
  readInteger(url.searchParams, "from", 0, 9_999_999_999);
  readInteger(url.searchParams, "to", 0, 9_999_999_999);
}

function validateStatsQuery(url: URL) {
  rejectUnknownParameters(url.searchParams, ["offset", "limit"]);
  readInteger(url.searchParams, "offset", 0, 10_000);
  readInteger(url.searchParams, "limit", 1, 100);
}

function getAllowedRequest(requestUrl: URL): AllowedRequest | null {
  const upstreamUrl = new URL(requestUrl.pathname + requestUrl.search, FACEIT_ORIGIN);
  const segments = requestUrl.pathname.split("/").filter(Boolean);

  if (
    segments.length === 3 &&
    segments[0] === "data" &&
    segments[1] === "v4" &&
    segments[2] === "players"
  ) {
    validatePlayerSearch(upstreamUrl);
    return { cacheSeconds: 300, upstreamUrl };
  }

  if (
    segments.length === 4 &&
    segments[0] === "data" &&
    segments[1] === "v4" &&
    segments[2] === "matches" &&
    isSafeId(segments[3])
  ) {
    rejectUnknownParameters(upstreamUrl.searchParams, []);
    return { cacheSeconds: 5, upstreamUrl };
  }

  if (
    segments.length >= 4 &&
    segments[0] === "data" &&
    segments[1] === "v4" &&
    segments[2] === "players" &&
    isSafeId(segments[3])
  ) {
    if (segments.length === 4) {
      rejectUnknownParameters(upstreamUrl.searchParams, []);
      return { cacheSeconds: 300, upstreamUrl };
    }

    if (segments.length === 5 && segments[4] === "history") {
      validateHistoryQuery(upstreamUrl);
      return { cacheSeconds: 45, upstreamUrl };
    }

    if (
      segments.length === 6 &&
      segments[4] === "stats" &&
      segments[5] === "cs2"
    ) {
      rejectUnknownParameters(upstreamUrl.searchParams, []);
      return { cacheSeconds: 300, upstreamUrl };
    }

    if (
      segments.length === 7 &&
      segments[4] === "games" &&
      segments[5] === "cs2" &&
      segments[6] === "stats"
    ) {
      validateStatsQuery(upstreamUrl);
      return { cacheSeconds: 60, upstreamUrl };
    }
  }

  return null;
}

function publicResponse(response: Response, cacheSeconds: number, cacheStatus: string) {
  const headers = new Headers();
  headers.set("content-type", response.headers.get("content-type") ?? JSON_HEADERS["content-type"]);
  headers.set("cache-control", `public, max-age=${cacheSeconds}`);
  headers.set("x-content-type-options", "nosniff");
  headers.set("x-faceit-scout-cache", cacheStatus);

  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    headers.set("retry-after", retryAfter);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function handleRequest(
  request: Request,
  env: WorkerEnvironment,
  context: WorkerExecutionContext,
) {
  const url = new URL(request.url);

  if (request.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, 405, { allow: "GET" });
  }

  if (url.pathname === "/health") {
    return jsonResponse({ service: "faceit-scout-api", status: "ok" }, 200);
  }

  let allowedRequest: AllowedRequest | null;
  try {
    allowedRequest = getAllowedRequest(url);
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Invalid request" },
      400,
    );
  }

  if (!allowedRequest) {
    return jsonResponse({ error: "FACEIT endpoint is not allowed" }, 404);
  }

  const clientAddress = request.headers.get("cf-connecting-ip") ?? "unknown";
  const rateLimit = await env.RATE_LIMITER.limit({ key: clientAddress });
  if (!rateLimit.success) {
    return jsonResponse(
      { error: "Too many requests. Try again in a minute." },
      429,
      { "retry-after": "60" },
    );
  }

  const cacheStorage = caches as CacheStorage & { default: Cache };
  const edgeCache = cacheStorage.default;
  const cacheKey = new Request(url.toString(), { method: "GET" });
  const cached = await edgeCache.match(cacheKey);
  if (cached) {
    const hit = new Response(cached.body, cached);
    hit.headers.set("x-faceit-scout-cache", "HIT");
    return hit;
  }

  if (!env.FACEIT_API_KEY) {
    return jsonResponse({ error: "FACEIT_API_KEY is not configured" }, 503);
  }

  let upstream: Response;
  try {
    upstream = await fetch(allowedRequest.upstreamUrl, {
      headers: {
        accept: "application/json",
        authorization: `Bearer ${env.FACEIT_API_KEY}`,
      },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return jsonResponse({ error: "FACEIT upstream request failed" }, 502);
  }

  const response = publicResponse(upstream, allowedRequest.cacheSeconds, "MISS");
  if (upstream.ok) {
    context.waitUntil(edgeCache.put(cacheKey, response.clone()));
  }

  return response;
}

export default {
  fetch(
    request: Request,
    env: WorkerEnvironment,
    context: WorkerExecutionContext,
  ) {
    return handleRequest(request, env, context);
  },
};
