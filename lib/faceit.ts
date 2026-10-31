export type FaceitPlayer = {
  nickname: string;
  player_id: string;
  avatar?: string;
  country?: string;
  faceit_url?: string;
  games?: {
    cs2?: {
      skill_level: number;
      faceit_elo: number;
      game_player_id?: string;
      game_player_name?: string;
      region?: string;
    };
  };
};

type FaceitHistoryTeam = {
  nickname: string;
  players: Array<{
    nickname: string;
    player_id: string;
  }>;
};

type FaceitHistoryMatch = {
  competition_name: string;
  faceit_url?: string;
  finished_at?: number;
  game_mode: string;
  match_id: string;
  results?: {
    score?: Record<string, number>;
    winner?: string;
  };
  status: string;
  teams?: Record<string, FaceitHistoryTeam>;
};

type FaceitHistoryResponse = {
  items: FaceitHistoryMatch[];
};

type FaceitMatchStatsItem = {
  stats: Record<string, string | number | null>;
};

type FaceitMatchStatsResponse = {
  items: FaceitMatchStatsItem[];
};

type FaceitPlayerStatsResponse = {
  lifetime?: Record<string, string | number | null>;
};

type FaceitMatchRosterPlayer = {
  avatar?: string;
  game_skill_level?: number;
  nickname: string;
  player_id: string;
};

type FaceitMatchTeam = {
  name: string;
  roster: FaceitMatchRosterPlayer[];
  stats?: {
    rating?: number;
    skillLevel?: {
      average?: number;
    };
    winProbability?: number;
  };
};

type FaceitMatchDetails = {
  competition_name: string;
  configured_at?: number;
  match_id: string;
  region: string;
  started_at?: number;
  status: string;
  teams: Record<string, FaceitMatchTeam>;
};

export type RecentMatch = {
  adr: string | null;
  assists: number | null;
  competitionName: string;
  deaths: number | null;
  faceitUrl: string | null;
  finishedAt: number;
  gameMode: string;
  headshotsPercent: string | null;
  kdRatio: string | null;
  kills: number | null;
  map: string | null;
  matchId: string;
  opponent: string | null;
  result: "win" | "loss" | "unknown";
  score: string | null;
  status: string;
};

export type RecentFormSummary = {
  averageAdr: number | null;
  averageKd: number | null;
  losses: number;
  matchesAnalyzed: number;
  winRate: number | null;
  wins: number;
};

export type MapPerformance = {
  map: string;
  recentMatches: RecentMatch[];
  summary: RecentFormSummary;
};

export type LiveMatchPlayer = {
  avatar: string | null;
  country: string | null;
  elo: number | null;
  nickname: string;
  playerId: string;
  profileUrl: string | null;
  skillLevel: number | null;
  sniperKillRate: number | null;
  weaponSpecialty: "SNIPER" | null;
};

export type LiveMatchTeam = {
  averageSkillLevel: number | null;
  faction: string;
  name: string;
  players: LiveMatchPlayer[];
  rating: number | null;
  winProbability: number | null;
};

export type LiveMatch = {
  competitionName: string;
  configuredAt: number | null;
  faceitUrl: string;
  matchId: string;
  region: string;
  startedAt: number | null;
  status: string;
  teams: LiveMatchTeam[];
};

export type PlayerLookupResult = {
  mapPerformance: MapPerformance[];
  player: FaceitPlayer;
  recentMatches: RecentMatch[];
  recentSummary: RecentFormSummary;
};

export class FaceitApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "FaceitApiError";
  }
}

function getApiKey() {
  const apiKey = process.env.FACEIT_API_KEY;

  if (!apiKey) {
    throw new FaceitApiError(
      "FACEIT_API_BASE_URL or FACEIT_API_KEY is not configured on the server",
      500,
    );
  }

  return apiKey;
}

function getApiBaseUrl() {
  const configuredUrl = process.env.FACEIT_API_BASE_URL?.trim();
  if (!configuredUrl) {
    return "https://open.faceit.com";
  }

  let url: URL;
  try {
    url = new URL(configuredUrl);
  } catch {
    throw new FaceitApiError("FACEIT_API_BASE_URL is invalid", 500);
  }

  const isLocalDevelopment =
    url.protocol === "http:" &&
    (url.hostname === "localhost" || url.hostname === "127.0.0.1");
  if (url.protocol !== "https:" && !isLocalDevelopment) {
    throw new FaceitApiError(
      "FACEIT_API_BASE_URL must use HTTPS outside local development",
      500,
    );
  }

  return url.origin + url.pathname.replace(/\/$/, "");
}

function createFaceitUrl(path: string) {
  return new URL(path, `${getApiBaseUrl()}/`);
}

async function fetchFaceit<T>(url: URL): Promise<T> {
  const useCloudProxy = Boolean(process.env.FACEIT_API_BASE_URL?.trim());
  const response = await fetch(url, {
    headers: useCloudProxy
      ? { Accept: "application/json" }
      : {
          Accept: "application/json",
          Authorization: `Bearer ${getApiKey()}`,
        },
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) {
    const message =
      response.status === 404
        ? "No matching FACEIT data was found"
        : `FACEIT request failed (${response.status})`;
    throw new FaceitApiError(message, response.status);
  }

  return (await response.json()) as T;
}

export async function getFaceitPlayerByNickname(
  nickname: string,
): Promise<FaceitPlayer> {
  const url = createFaceitUrl("/data/v4/players");
  url.searchParams.set("nickname", nickname);
  url.searchParams.set("game", "cs2");

  try {
    return await fetchFaceit<FaceitPlayer>(url);
  } catch (error) {
    if (error instanceof FaceitApiError && error.status === 404) {
      throw new FaceitApiError("FACEIT player not found", 404);
    }

    throw error;
  }
}

async function getFaceitPlayerById(playerId: string): Promise<FaceitPlayer> {
  const url = createFaceitUrl(`/data/v4/players/${playerId}`);
  return fetchFaceit<FaceitPlayer>(url);
}

function valueAsString(value: string | number | null | undefined) {
  return value === null || value === undefined || value === ""
    ? null
    : String(value);
}

function valueAsNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function getPlayerWeaponProfile(playerId: string) {
  const url = createFaceitUrl(`/data/v4/players/${playerId}/stats/cs2`);
  const stats = await fetchFaceit<FaceitPlayerStatsResponse>(url);
  const lifetime = stats.lifetime ?? {};
  const totalKills = valueAsNumber(lifetime["Total Kills with extended stats"]);
  const rawSniperKillRate = valueAsNumber(lifetime["Sniper Kill Rate"]);

  if (totalKills === null || totalKills < 100 || rawSniperKillRate === null) {
    return {
      sniperKillRate: null,
      weaponSpecialty: null,
    } as const;
  }

  const sniperKillRate = Number(
    (rawSniperKillRate <= 1 ? rawSniperKillRate * 100 : rawSniperKillRate).toFixed(1),
  );

  return {
    sniperKillRate,
    weaponSpecialty: sniperKillRate >= 20 ? "SNIPER" : null,
  } as const;
}

export async function getFaceitRecentMatches(
  playerId: string,
  limit = 100,
): Promise<RecentMatch[]> {
  const historyUrl = createFaceitUrl(
    `/data/v4/players/${playerId}/history`,
  );
  historyUrl.searchParams.set("game", "cs2");
  historyUrl.searchParams.set("offset", "0");
  historyUrl.searchParams.set("limit", String(limit));
  historyUrl.searchParams.set("from", "0");

  const statsUrl = createFaceitUrl(
    `/data/v4/players/${playerId}/games/cs2/stats`,
  );
  statsUrl.searchParams.set("offset", "0");
  statsUrl.searchParams.set("limit", String(limit));

  const [history, stats] = await Promise.all([
    fetchFaceit<FaceitHistoryResponse>(historyUrl),
    fetchFaceit<FaceitMatchStatsResponse>(statsUrl).catch((error: unknown) => {
      if (error instanceof FaceitApiError && error.status === 404) {
        return { items: [] } satisfies FaceitMatchStatsResponse;
      }

      throw error;
    }),
  ]);

  const statsByMatchId = new Map(
    stats.items.map((item) => [String(item.stats["Match Id"]), item.stats]),
  );
  const historyMatchIds = new Set(history.items.map((match) => match.match_id));

  const historyMatches = history.items.map((match) => {
    const playerFaction = Object.entries(match.teams ?? {}).find(([, team]) =>
      team.players.some((player) => player.player_id === playerId),
    )?.[0];
    const opponent = Object.entries(match.teams ?? {}).find(
      ([faction]) => faction !== playerFaction,
    )?.[1];
    const playerScore = playerFaction
      ? match.results?.score?.[playerFaction]
      : undefined;
    const opponentScore = Object.entries(match.results?.score ?? {}).find(
      ([faction]) => faction !== playerFaction,
    )?.[1];
    const matchStats = statsByMatchId.get(match.match_id);
    const statsResult = valueAsString(matchStats?.Result);
    const result =
      statsResult === "1" || match.results?.winner === playerFaction
        ? "win"
        : statsResult === "0" ||
            (match.results?.winner && match.results.winner !== playerFaction)
          ? "loss"
          : "unknown";

    return {
      adr: valueAsString(matchStats?.ADR),
      assists: valueAsNumber(matchStats?.Assists),
      competitionName: match.competition_name,
      deaths: valueAsNumber(matchStats?.Deaths),
      faceitUrl: match.faceit_url ?? null,
      finishedAt: match.finished_at ?? 0,
      gameMode: match.game_mode,
      headshotsPercent: valueAsString(matchStats?.["Headshots %"]),
      kdRatio: valueAsString(matchStats?.["K/D Ratio"]),
      kills: valueAsNumber(matchStats?.Kills),
      map: valueAsString(matchStats?.Map),
      matchId: match.match_id,
      opponent: opponent?.nickname ?? null,
      result,
      score:
        playerScore === undefined || opponentScore === undefined
          ? valueAsString(matchStats?.Score)
          : `${playerScore}–${opponentScore}`,
      status: match.status,
    } satisfies RecentMatch;
  });

  const statsOnlyMatches = stats.items
    .filter((item) => !historyMatchIds.has(String(item.stats["Match Id"])))
    .map((item) => {
      const matchStats = item.stats;
      const matchFinishedAt = valueAsNumber(matchStats["Match Finished At"]);

      return {
        adr: valueAsString(matchStats.ADR),
        assists: valueAsNumber(matchStats.Assists),
        competitionName: "FACEIT match",
        deaths: valueAsNumber(matchStats.Deaths),
        faceitUrl: null,
        finishedAt: matchFinishedAt ? Math.floor(matchFinishedAt / 1_000) : 0,
        gameMode: valueAsString(matchStats["Game Mode"]) ?? "5v5",
        headshotsPercent: valueAsString(matchStats["Headshots %"]),
        kdRatio: valueAsString(matchStats["K/D Ratio"]),
        kills: valueAsNumber(matchStats.Kills),
        map: valueAsString(matchStats.Map),
        matchId: String(matchStats["Match Id"]),
        opponent: null,
        result:
          valueAsString(matchStats.Result) === "1"
            ? "win"
            : valueAsString(matchStats.Result) === "0"
              ? "loss"
              : "unknown",
        score: valueAsString(matchStats.Score),
        status: "FINISHED",
      } satisfies RecentMatch;
    });

  return [...historyMatches, ...statsOnlyMatches].sort(
    (first, second) => second.finishedAt - first.finishedAt,
  );
}

function normalizeMatchReference(reference: string) {
  const trimmed = reference.trim();
  const roomMatch = trimmed.match(/\/room\/([^/?#]+)/i);
  const matchId = roomMatch?.[1] ?? trimmed;

  if (!/^[a-zA-Z0-9-]{8,80}$/.test(matchId)) {
    throw new FaceitApiError("Invalid FACEIT match room link or Match ID", 400);
  }

  return matchId;
}

export async function getFaceitMatch(
  matchReference: string,
): Promise<LiveMatch> {
  const matchId = normalizeMatchReference(matchReference);
  const url = createFaceitUrl(`/data/v4/matches/${matchId}`);
  const match = await fetchFaceit<FaceitMatchDetails>(url);
  const roster = Object.values(match.teams).flatMap((team) => team.roster);
  const playerDetailsById = new Map(
    await Promise.all(
      roster.map(async (rosterPlayer) => {
        const [player, weaponProfile] = await Promise.all([
          getFaceitPlayerById(rosterPlayer.player_id).catch(() => null),
          getPlayerWeaponProfile(rosterPlayer.player_id).catch(() => null),
        ]);

        return [
          rosterPlayer.player_id,
          { player, weaponProfile },
        ] as const;
      }),
    ),
  );

  const teams = Object.entries(match.teams).map(([faction, team]) => ({
    averageSkillLevel: team.stats?.skillLevel?.average ?? null,
    faction,
    name: team.name,
    players: team.roster.map((rosterPlayer) => {
      const details = playerDetailsById.get(rosterPlayer.player_id);
      const player = details?.player;
      const weaponProfile = details?.weaponProfile;
      return {
        avatar: player?.avatar || rosterPlayer.avatar || null,
        country: player?.country ?? null,
        elo: player?.games?.cs2?.faceit_elo ?? null,
        nickname: player?.nickname ?? rosterPlayer.nickname,
        playerId: rosterPlayer.player_id,
        profileUrl: player?.faceit_url ?? null,
        skillLevel:
          player?.games?.cs2?.skill_level ??
          rosterPlayer.game_skill_level ??
          null,
        sniperKillRate: weaponProfile?.sniperKillRate ?? null,
        weaponSpecialty: weaponProfile?.weaponSpecialty ?? null,
      } satisfies LiveMatchPlayer;
    }),
    rating: team.stats?.rating ?? null,
    winProbability: team.stats?.winProbability ?? null,
  }));

  return {
    competitionName: match.competition_name,
    configuredAt: match.configured_at ?? null,
    faceitUrl: `https://www.faceit.com/en/cs2/room/${match.match_id}`,
    matchId: match.match_id,
    region: match.region,
    startedAt: match.started_at ?? null,
    status: match.status,
    teams,
  };
}

export async function detectCurrentFaceitMatch(
  playerId: string,
): Promise<LiveMatch | null> {
  const historyUrl = createFaceitUrl(
    `/data/v4/players/${playerId}/history`,
  );
  historyUrl.searchParams.set("game", "cs2");
  historyUrl.searchParams.set("offset", "0");
  historyUrl.searchParams.set("limit", "20");

  const history = await fetchFaceit<FaceitHistoryResponse>(historyUrl);
  const terminalStatuses = new Set(["FINISHED", "CANCELLED", "ABORTED"]);
  const activeMatch = history.items.find(
    (match) => !terminalStatuses.has(match.status.toUpperCase()),
  );

  return activeMatch ? getFaceitMatch(activeMatch.match_id) : null;
}

function summarizeRecentMatches(matches: RecentMatch[]): RecentFormSummary {
  const matchesWithKd = matches.filter(
    (match) => match.kills !== null && match.deaths !== null,
  );
  const totalKills = matchesWithKd.reduce(
    (total, match) => total + (match.kills ?? 0),
    0,
  );
  const totalDeaths = matchesWithKd.reduce(
    (total, match) => total + (match.deaths ?? 0),
    0,
  );
  const adrValues = matches
    .map((match) => (match.adr === null ? null : Number(match.adr)))
    .filter((adr): adr is number => adr !== null && Number.isFinite(adr));
  const wins = matches.filter((match) => match.result === "win").length;
  const losses = matches.filter((match) => match.result === "loss").length;
  const completedResults = wins + losses;

  return {
    averageAdr:
      adrValues.length > 0
        ? Number(
            (
              adrValues.reduce((total, adr) => total + adr, 0) /
              adrValues.length
            ).toFixed(1),
          )
        : null,
    averageKd:
      matchesWithKd.length > 0 && totalDeaths > 0
        ? Number((totalKills / totalDeaths).toFixed(2))
        : null,
    losses,
    matchesAnalyzed: matches.length,
    winRate:
      completedResults > 0
        ? Number(((wins / completedResults) * 100).toFixed(1))
        : null,
    wins,
  };
}

function buildMapPerformance(matches: RecentMatch[]): MapPerformance[] {
  const maps = Array.from(
    new Set(
      matches
        .map((match) => match.map)
        .filter((map): map is string => map !== null),
    ),
  );

  return maps
    .map((map) => {
      const mapMatches = matches
        .filter((match) => match.map === map)
        .slice(0, 20);

      return {
        map,
        recentMatches: mapMatches,
        summary: summarizeRecentMatches(mapMatches),
      };
    })
    .sort(
      (first, second) =>
        second.summary.matchesAnalyzed - first.summary.matchesAnalyzed ||
        first.map.localeCompare(second.map),
    );
}

export async function getPlayerLookupResult(
  nickname: string,
): Promise<PlayerLookupResult> {
  const player = await getFaceitPlayerByNickname(nickname);
  const matchPool = await getFaceitRecentMatches(player.player_id);
  const recentMatches = matchPool.slice(0, 20);

  return {
    mapPerformance: buildMapPerformance(matchPool),
    player,
    recentMatches,
    recentSummary: summarizeRecentMatches(recentMatches),
  };
}
