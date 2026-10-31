import { NextResponse } from "next/server";
import {
  detectCurrentFaceitMatch,
  FaceitApiError,
  getFaceitMatch,
} from "@/lib/faceit";

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const matchReference = searchParams.get("match")?.trim();
  const playerId = searchParams.get("playerId")?.trim();

  if (!matchReference && !playerId) {
    return NextResponse.json(
      { error: "A FACEIT player ID or match room link is required" },
      { status: 400 },
    );
  }

  try {
    const match = matchReference
      ? await getFaceitMatch(matchReference)
      : await detectCurrentFaceitMatch(playerId!);

    if (!match) {
      return NextResponse.json(
        {
          error:
            "FACEIT did not return an active match. Paste the match room link instead.",
        },
        { status: 404 },
      );
    }

    return NextResponse.json(match);
  } catch (error) {
    if (error instanceof FaceitApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status >= 500 ? 502 : error.status },
      );
    }

    const isTimeout = error instanceof Error && error.name === "TimeoutError";
    return NextResponse.json(
      {
        error: isTimeout
          ? "FACEIT timed out. Try again shortly."
          : "Unable to load the FACEIT match",
      },
      { status: 502 },
    );
  }
}
