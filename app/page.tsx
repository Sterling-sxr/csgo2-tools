"use client";

import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import packageJson from "@/package.json";
import type {
  LiveMatch,
  LiveMatchTeam,
  PlayerLookupResult,
  RecentFormSummary,
  RecentMatch,
} from "@/lib/faceit";

type WebViewWindow = Window & {
  chrome?: {
    webview?: {
      addEventListener: (
        event: "message",
        listener: (message: { data: unknown }) => void,
      ) => void;
      postMessage: (message: string) => void;
      removeEventListener: (
        event: "message",
        listener: (message: { data: unknown }) => void,
      ) => void;
    };
  };
};

type AppSettingsMessage = {
  darkMode: boolean;
  error?: string | null;
  overlayHotkey: string;
  type: "app-settings";
};

const hotkeyOptions = [
  { label: "~ / `", value: "Oemtilde" },
  { label: "F8", value: "F8" },
  { label: "F9", value: "F9" },
  { label: "F10", value: "F10" },
  { label: "F11", value: "F11" },
  { label: "Caps Lock", value: "CapsLock" },
];

function postDesktopMessage(message: string) {
  const desktopBridge = (window as WebViewWindow).chrome?.webview;
  if (desktopBridge) {
    desktopBridge.postMessage(message);
  } else if (message === "refresh-window") {
    window.location.reload();
  }
}

function formatMapName(map: string | null) {
  if (!map) return "Unknown map";
  return map.replace(/^de_/, "").replace(/^./, (letter) => letter.toUpperCase());
}

function formatMatchDate(timestamp: number) {
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
  }).format(new Date(timestamp * 1_000));
}

function MatchRow({ match }: Readonly<{ match: RecentMatch }>) {
  const content = (
    <>
      <span className={`result-badge ${match.result}`}>
        {match.result === "win" ? "W" : match.result === "loss" ? "L" : "—"}
      </span>
      <span className="match-main">
        <strong>{formatMapName(match.map)}</strong>
        <small>{formatMatchDate(match.finishedAt)} · {match.opponent ?? match.competitionName}</small>
      </span>
      <span className="match-score">{match.score ?? "—"}</span>
      <span className="match-stat"><small>K/D</small><strong>{match.kdRatio ?? "—"}</strong></span>
      <span className="match-stat"><small>ADR</small><strong>{match.adr ?? "—"}</strong></span>
    </>
  );

  return match.faceitUrl ? (
    <a className="match-row" href={match.faceitUrl.replace("{lang}", "en")} target="_blank" rel="noreferrer">
      {content}
    </a>
  ) : <div className="match-row">{content}</div>;
}

function FormSummary({
  label,
  summary,
}: Readonly<{ label: string; summary: RecentFormSummary }>) {
  return (
    <div className="form-summary" aria-label={label}>
      <div><span>AVG K/D</span><strong>{summary.averageKd?.toFixed(2) ?? "—"}</strong></div>
      <div><span>AVG ADR</span><strong>{summary.averageAdr?.toFixed(1) ?? "—"}</strong></div>
      <div>
        <span>WIN RATE</span>
        <strong>{summary.winRate === null ? "—" : `${summary.winRate.toFixed(1)}%`}</strong>
        <small>{summary.wins}W · {summary.losses}L</small>
      </div>
    </div>
  );
}

function MatchTeam({ team }: Readonly<{ team: LiveMatchTeam }>) {
  return (
    <section className="live-team">
      <div className="live-team-heading">
        <div><span>{team.faction.toUpperCase()}</span><h3>{team.name}</h3></div>
        <div><small>TEAM ELO</small><strong>{team.rating ?? "—"}</strong></div>
      </div>
      <div className="roster-list">
        {team.players.map((player) => {
          const content = (
            <>
              {player.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={player.avatar} alt="" />
              ) : <span className="roster-avatar">{player.nickname.slice(0, 1).toUpperCase()}</span>}
              <span className="roster-name">
                <span className="roster-name-line">
                  <strong>{player.nickname}</strong>
                  {player.weaponSpecialty === "SNIPER" && player.sniperKillRate !== null && (
                    <em className="weapon-tag sniper-expert">
                      ★ SNIPER EXPERT · {player.sniperKillRate.toFixed(0)}%
                    </em>
                  )}
                </span>
                <small>{player.country?.toUpperCase() ?? "—"}</small>
              </span>
              <span className="roster-stat"><small>LVL</small><strong>{player.skillLevel ?? "—"}</strong></span>
              <span className="roster-stat"><small>ELO</small><strong>{player.elo ?? "—"}</strong></span>
            </>
          );

          return player.profileUrl ? (
            <a className="roster-player" href={player.profileUrl.replace("{lang}", "en")} key={player.playerId} rel="noreferrer" target="_blank">
              {content}
            </a>
          ) : <div className="roster-player" key={player.playerId}>{content}</div>;
        })}
      </div>
    </section>
  );
}

function MatchPanel({
  error,
  liveMatch,
  loading,
}: Readonly<{ error: string; liveMatch: LiveMatch | null; loading: boolean }>) {
  return (
    <section className="match-pane" aria-live="polite">
      <header className="pane-header">
        <div><span className="overline">CURRENT MATCH</span><h2>Match room</h2></div>
        {liveMatch && <a className="text-link" href={liveMatch.faceitUrl} rel="noreferrer" target="_blank">Open on FACEIT ↗</a>}
      </header>

      {loading && (
        <div className="match-loading">
          <span className="loader" />
          <strong>Loading both rosters</strong>
          <small>Reading the detected FACEIT match room…</small>
        </div>
      )}

      {!loading && error && <div className="inline-error"><strong>Match unavailable</strong><span>{error}</span></div>}

      {!loading && liveMatch && (
        <>
          <div className="match-meta">
            <span>{liveMatch.status}</span>
            <strong>{liveMatch.competitionName}</strong>
            <small>{liveMatch.region} · {liveMatch.matchId}</small>
          </div>
          <div className="teams-grid">
            {liveMatch.teams.map((team) => <MatchTeam key={team.faction} team={team} />)}
          </div>
        </>
      )}
    </section>
  );
}

function PlayerPanel({
  error,
  loading,
  onSelectedMapChange,
  result,
  selectedMap,
}: Readonly<{
  error: string;
  loading: boolean;
  onSelectedMapChange: (map: string) => void;
  result: PlayerLookupResult | null;
  selectedMap: string;
}>) {
  const player = result?.player;
  const cs2 = player?.games?.cs2;
  const selectedMapPerformance = result?.mapPerformance.find(
    (performance) => performance.map === selectedMap,
  );

  return (
    <section className="match-pane player-pane" aria-live="polite">
      <header className="pane-header">
        <div><span className="overline">PLAYER REPORT</span><h2>Performance overview</h2></div>
        {player?.faceit_url && (
          <a className="text-link" href={player.faceit_url.replace("{lang}", "en")} target="_blank" rel="noreferrer">Open on FACEIT ↗</a>
        )}
      </header>

      {loading && (
        <div className="match-loading">
          <span className="loader" />
          <strong>Loading player history</strong>
          <small>Calculating recent and map-specific performance…</small>
        </div>
      )}

      {!loading && error && <div className="inline-error"><strong>Player unavailable</strong><span>{error}</span></div>}

      {!loading && player && result && (
        <article className="player-card">
          <div className="identity">
            {player.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={player.avatar} alt="" />
            ) : <div className="avatar-fallback">{player.nickname.slice(0, 1)}</div>}
            <div><span className="overline">PLAYER FOUND</span><h1>{player.nickname}</h1><p>{player.country?.toUpperCase() ?? "—"} · {cs2?.region ?? "Unknown region"}</p></div>
            {player.faceit_url && <a className="icon-link" href={player.faceit_url.replace("{lang}", "en")} target="_blank" rel="noreferrer" aria-label="Open FACEIT profile">↗</a>}
          </div>

          <div className="stats-grid">
            <div><span>LEVEL</span><strong>{cs2?.skill_level ?? "—"}</strong></div>
            <div><span>ELO</span><strong>{cs2?.faceit_elo ?? "—"}</strong></div>
            <div><span>STEAM ID</span><strong className="small-value">{cs2?.game_player_id ?? "—"}</strong></div>
            <div><span>PLAYER ID</span><strong className="small-value">{player.player_id}</strong></div>
          </div>

          <section className="history-section">
            <div className="section-heading"><div><span className="overline">RECENT FORM</span><h2>Last 20 matches</h2></div><span>{result.recentMatches.length}</span></div>
            <FormSummary label="Last 20 matches" summary={result.recentSummary} />
            <div className="match-list">
              {result.recentMatches.length > 0
                ? result.recentMatches.map((match) => <MatchRow key={match.matchId} match={match} />)
                : <p className="empty-copy">No public CS2 matches found.</p>}
            </div>
          </section>

          <section className="map-analysis">
            <div className="section-heading">
              <div><span className="overline">MAP FORM</span><h2>Map-specific</h2></div>
              <select value={selectedMap} onChange={(event) => onSelectedMapChange(event.target.value)} aria-label="Select map">
                {result.mapPerformance.map((performance) => <option key={performance.map} value={performance.map}>{formatMapName(performance.map)}</option>)}
              </select>
            </div>
            {selectedMapPerformance ? (
              <>
                <FormSummary label={`${formatMapName(selectedMapPerformance.map)} form`} summary={selectedMapPerformance.summary} />
                <div className="match-list">{selectedMapPerformance.recentMatches.map((match) => <MatchRow key={`map-${match.matchId}`} match={match} />)}</div>
              </>
            ) : <p className="empty-copy">No map-specific data available.</p>}
          </section>
        </article>
      )}
    </section>
  );
}

export default function Home() {
  const [nickname, setNickname] = useState("");
  const [result, setResult] = useState<PlayerLookupResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [liveMatch, setLiveMatch] = useState<LiveMatch | null>(null);
  const [liveMatchError, setLiveMatchError] = useState("");
  const [liveMatchLoading, setLiveMatchLoading] = useState(false);
  const [matchReference, setMatchReference] = useState("");
  const [selectedMap, setSelectedMap] = useState("");
  const [activePanel, setActivePanel] = useState<"match" | "player" | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [overlayHotkey, setOverlayHotkey] = useState("Oemtilde");
  const [draftDarkMode, setDraftDarkMode] = useState(false);
  const [draftHotkey, setDraftHotkey] = useState("Oemtilde");
  const [settingsError, setSettingsError] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const automaticMatchStarted = useRef(false);

  useEffect(() => {
    const bridge = (window as WebViewWindow).chrome?.webview;
    const onDesktopMessage = (message: { data: unknown }) => {
      const payload = typeof message.data === "string"
        ? JSON.parse(message.data) as AppSettingsMessage
        : message.data as AppSettingsMessage;
      if (payload?.type !== "app-settings") return;

      setDarkMode(payload.darkMode);
      setOverlayHotkey(payload.overlayHotkey);
      setDraftDarkMode(payload.darkMode);
      setDraftHotkey(payload.overlayHotkey);
      setSettingsError(payload.error ?? "");
      if (payload.error) setSettingsOpen(true);
    };

    if (bridge) {
      bridge.addEventListener("message", onDesktopMessage);
      bridge.postMessage("get-app-settings");
      return () => bridge.removeEventListener("message", onDesktopMessage);
    }

    const stored = window.localStorage.getItem("faceit-scout-settings");
    if (stored) {
      const preferences = JSON.parse(stored) as Pick<AppSettingsMessage, "darkMode" | "overlayHotkey">;
      setDarkMode(Boolean(preferences.darkMode));
      setOverlayHotkey(preferences.overlayHotkey || "Oemtilde");
      setDraftDarkMode(Boolean(preferences.darkMode));
      setDraftHotkey(preferences.overlayHotkey || "Oemtilde");
    }
  }, []);

  useEffect(() => {
    document.body.classList.toggle("theme-dark", darkMode);
    return () => document.body.classList.remove("theme-dark");
  }, [darkMode]);

  async function loadLiveMatch(match: string) {
    setActivePanel("match");
    setLiveMatchLoading(true);
    setLiveMatchError("");
    setLiveMatch(null);

    try {
      const response = await fetch(`/api/faceit/match?match=${encodeURIComponent(match)}`);
      const data = (await response.json()) as LiveMatch & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to load this match");
      setLiveMatch(data);
      postDesktopMessage(`show-match-overlay:${data.matchId}`);
    } catch (cause) {
      setLiveMatchError(cause instanceof Error ? cause.message : "Unable to load this match");
    } finally {
      setLiveMatchLoading(false);
    }
  }

  useEffect(() => {
    if (automaticMatchStarted.current) return;
    const detectedMatch = new URLSearchParams(window.location.search).get("match");
    if (!detectedMatch) return;

    automaticMatchStarted.current = true;
    setMatchReference(detectedMatch);
    void loadLiveMatch(detectedMatch);
  }, []);

  const matchPanelVisible = activePanel === "match";
  const playerPanelVisible = activePanel === "player";
  const detailPanelVisible = matchPanelVisible || playerPanelVisible;

  useEffect(() => {
    if (!detailPanelVisible) return;
    postDesktopMessage("expand-match-panel");
  }, [detailPanelVisible]);

  async function searchPlayer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = nickname.trim();
    if (!query) {
      setError("Enter a FACEIT nickname");
      return;
    }

    setActivePanel("player");
    setLoading(true);
    setError("");
    setResult(null);
    setSelectedMap("");

    try {
      const response = await fetch(`/api/faceit/player?nickname=${encodeURIComponent(query)}`);
      const data = (await response.json()) as PlayerLookupResult & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Player lookup failed");
      setResult(data);
      setSelectedMap(data.mapPerformance[0]?.map ?? "");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Player lookup failed");
    } finally {
      setLoading(false);
    }
  }

  function findMatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reference = matchReference.trim();
    if (!reference) {
      setLiveMatchError("Enter a FACEIT match room link or Match ID");
      return;
    }
    void loadLiveMatch(reference);
  }

  function openSettings() {
    setDraftDarkMode(darkMode);
    setDraftHotkey(overlayHotkey);
    setSettingsError("");
    setSettingsOpen(true);
  }

  function saveSettings() {
    const nextSettings = {
      darkMode: draftDarkMode,
      overlayHotkey: draftHotkey,
    };
    setDarkMode(draftDarkMode);
    setOverlayHotkey(draftHotkey);
    setSettingsError("");
    setSettingsOpen(false);

    const bridge = (window as WebViewWindow).chrome?.webview;
    if (bridge) {
      bridge.postMessage(`save-app-settings:${JSON.stringify(nextSettings)}`);
    } else {
      window.localStorage.setItem(
        "faceit-scout-settings",
        JSON.stringify(nextSettings),
      );
    }
  }

  return (
    <main className={`app-frame${detailPanelVisible ? " match-open" : ""}`}>
      <div
        className="window-drag-region"
        onMouseDown={() => postDesktopMessage("drag-window")}
      />
      <nav className="window-controls" aria-label="Window controls">
        <button type="button" onClick={openSettings} aria-label="Settings">⚙</button>
        <button type="button" onClick={() => postDesktopMessage("refresh-window")} aria-label="Refresh">↻</button>
        <button type="button" onClick={() => postDesktopMessage("minimize-window")} aria-label="Minimize">−</button>
        <button className="window-close" type="button" onClick={() => postDesktopMessage("close-window")} aria-label="Close">×</button>
      </nav>
      <section className="control-pane">
        <header className="brand-bar">
          <div className="brand-mark">FS</div>
          <div><strong>FACEIT Scout</strong><span>CS2 companion · v{packageJson.version}</span></div>
          <i aria-label="Ready" />
        </header>

        <div className="scanner-scope" aria-hidden="true">
          <div className="scanner-scope-art">
            <span className="cs-crosshair">
              <i className="crosshair-arm crosshair-top" />
              <i className="crosshair-arm crosshair-right" />
              <i className="crosshair-arm crosshair-bottom" />
              <i className="crosshair-arm crosshair-left" />
            </span>
          </div>
        </div>

        <div className="lookup-stack">
          <form className="lookup-card" onSubmit={findMatch}>
            <label htmlFor="room-url"><span>01</span> Match room link</label>
            <div className="input-shell">
              <input id="room-url" value={matchReference} onChange={(event) => setMatchReference(event.target.value)} placeholder="Paste FACEIT room URL" autoComplete="off" />
              <button type="submit" aria-label="Load match" disabled={liveMatchLoading}>{liveMatchLoading ? <span className="button-loader" /> : "↗"}</button>
            </div>
          </form>

          <form className="lookup-card" onSubmit={searchPlayer}>
            <label htmlFor="nickname"><span>02</span> Player lookup</label>
            <div className="input-shell">
              <input id="nickname" value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="FACEIT nickname" autoComplete="off" />
              <button type="submit" aria-label="Find player" disabled={loading}>{loading ? <span className="button-loader" /> : "↗"}</button>
            </div>
            {error && !playerPanelVisible && <p className="field-error" role="alert">{error}</p>}
          </form>
        </div>
      </section>

      {matchPanelVisible && <MatchPanel error={liveMatchError} liveMatch={liveMatch} loading={liveMatchLoading} />}
      {playerPanelVisible && (
        <PlayerPanel
          error={error}
          loading={loading}
          onSelectedMapChange={setSelectedMap}
          result={result}
          selectedMap={selectedMap}
        />
      )}

      {settingsOpen && (
        <div className="settings-backdrop" role="presentation" onMouseDown={() => setSettingsOpen(false)}>
          <section className="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title" onMouseDown={(event) => event.stopPropagation()}>
            <header className="settings-header">
              <div><span className="overline">FACEIT SCOUT · v{packageJson.version}</span><h2 id="settings-title">Settings</h2></div>
              <button type="button" onClick={() => setSettingsOpen(false)} aria-label="Close settings">×</button>
            </header>

            <div className="setting-row">
              <div><strong>Overlay hold key</strong><small>Hold this key to show the live match overlay.</small></div>
              <select value={draftHotkey} onChange={(event) => setDraftHotkey(event.target.value)} aria-label="Overlay hold key">
                {hotkeyOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>

            <div className="setting-row">
              <div><strong>Dark appearance</strong><small>Use the dark interface throughout the companion app.</small></div>
              <button
                className={`theme-toggle${draftDarkMode ? " enabled" : ""}`}
                type="button"
                role="switch"
                aria-checked={draftDarkMode}
                onClick={() => setDraftDarkMode((enabled) => !enabled)}
              ><span /></button>
            </div>

            {settingsError && <p className="settings-error" role="alert">{settingsError}</p>}

            <footer className="settings-actions">
              <button type="button" onClick={() => setSettingsOpen(false)}>Cancel</button>
              <button className="primary" type="button" onClick={saveSettings}>Save changes</button>
            </footer>
          </section>
        </div>
      )}
    </main>
  );
}
