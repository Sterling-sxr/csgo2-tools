import { NextResponse } from "next/server";
import {
  FaceitApiError,
  getPlayerLookupResult,
} from "@/lib/faceit";

export async function GET(request: Request) {
  const nickname = new URL(request.url).searchParams.get("nickname")?.trim();

  if (!nickname) {
    return NextResponse.json({ error: "Enter a FACEIT nickname" }, { status: 400 });
  }

  if (nickname.length > 32) {
    return NextResponse.json({ error: "The FACEIT nickname is too long" }, { status: 400 });
  }

  try {
    const result = await getPlayerLookupResult(nickname);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof FaceitApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status >= 500 ? 502 : error.status },
      );
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    const isTimeout = error instanceof Error && error.name === "TimeoutError";

    return NextResponse.json(
      { error: isTimeout ? "FACEIT timed out. Try again shortly." : message },
      { status: 502 },
    );
  }
}
