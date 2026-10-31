"use client";

import { useEffect, useState } from "react";
import type { LiveMatch, LiveMatchTeam } from "@/lib/faceit";
import styles from "./overlay.module.css";

function OverlayTeam({ team }: Readonly<{ team: LiveMatchTeam }>) {
  return (
    <section className={styles.teamCard}>
      <header className={styles.teamHeader}>
        <div><span>{team.faction.toUpperCase()}</span><strong>{team.name}</strong></div>
        <div><span>TEAM ELO</span><strong>{team.rating ?? "—"}</strong></div>
      </header>
      <div className={styles.roster}>
        {team.players.map((player) => (
          <div className={styles.player} key={player.playerId}>
            {player.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={player.avatar} alt="" />
            ) : <span className={styles.avatarFallback}>{player.nickname.slice(0, 1).toUpperCase()}</span>}
            <div className={styles.identity}>
              <div>
                <strong>{player.nickname}</strong>
                {player.weaponSpecialty === "SNIPER" && player.sniperKillRate !== null && (
                  <em className={styles.sniperExpertTag}>
                    ★ SNIPER EXPERT · {player.sniperKillRate.toFixed(0)}%
                  </em>
                )}
              </div>
              <small>{player.country?.toUpperCase() ?? "—"}</small>
            </div>
            <div className={styles.stat}><span>LVL</span><strong>{player.skillLevel ?? "—"}</strong></div>
            <div className={styles.stat}><span>ELO</span><strong>{player.elo ?? "—"}</strong></div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function MatchOverlayPage() {
  const [match, setMatch] = useState<LiveMatch | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const matchId = new URLSearchParams(window.location.search).get("match");
    if (!matchId) {
      setError("No FACEIT match selected");
      return;
    }

    const controller = new AbortController();
    let refreshTimer: number | undefined;
    let stopped = false;

    const loadMatch = async () => {
      let playerCount = 0;

      try {
        const response = await fetch(
          `/api/faceit/match?match=${encodeURIComponent(matchId)}`,
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );
        const data = (await response.json()) as LiveMatch & { error?: string };
        if (!response.ok) {
          throw new Error(data.error ?? "Unable to load this match");
        }

        playerCount = data.teams.reduce(
          (total, team) => total + team.players.length,
          0,
        );
        setMatch(data);
        setError("");
      } catch (cause: unknown) {
        if (cause instanceof Error && cause.name === "AbortError") {
          return;
        }

        setError(
          cause instanceof Error ? cause.message : "Unable to load this match",
        );
      }

      if (!stopped) {
        // FACEIT rooms are often populated gradually. Refresh quickly until all
        // ten players arrive, then keep a slower refresh for roster changes.
        refreshTimer = window.setTimeout(loadMatch, playerCount < 10 ? 4_000 : 15_000);
      }
    };

    void loadMatch();

    return () => {
      stopped = true;
      controller.abort();
      if (refreshTimer !== undefined) {
        window.clearTimeout(refreshTimer);
      }
    };
  }, []);

  const playerCount =
    match?.teams.reduce((total, team) => total + team.players.length, 0) ?? 0;

  const beginOverlayDrag = () => {
    const desktopWindow = window as Window & {
      chrome?: {
        webview?: {
          postMessage(message: string): void;
        };
      };
    };
    desktopWindow.chrome?.webview?.postMessage("overlay-drag-start");
  };

  return (
    <main className={`match-overlay-root ${styles.overlayShell}`}>
      <section className={styles.overlayPanel}>
        <header
          className={styles.topbar}
          onMouseDown={(event) => {
            if (event.button === 0) beginOverlayDrag();
          }}
          title="Drag to move overlay"
        >
          <div className={styles.brand}><span>FS</span><div><strong>FACEIT SCOUT</strong><small>LIVE MATCH OVERLAY · DRAG TO MOVE</small></div></div>
          <div className={styles.matchMeta}>
            {match && <><strong>{match.competitionName}</strong><span>{playerCount} / 10 PLAYERS</span><span>{match.status}</span></>}
          </div>
        </header>

        {!match && !error && <div className={styles.state}>Loading player intelligence…</div>}
        {error && !match && <div className={styles.error}>{error}</div>}
        {match && <div className={styles.teams}>{match.teams.map((team) => <OverlayTeam key={team.faction} team={team} />)}</div>}
      </section>
    </main>
  );
}
