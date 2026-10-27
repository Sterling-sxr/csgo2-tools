"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import type { FaceitPlayer } from "@/lib/faceit";

export default function Home() {
  const [nickname, setNickname] = useState("churgerd");
  const [player, setPlayer] = useState<FaceitPlayer | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function searchPlayer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = nickname.trim();

    if (!query) {
      setError("请输入 FACEIT 昵称");
      return;
    }

    setLoading(true);
    setError("");
    setPlayer(null);

    try {
      const response = await fetch(
        `/api/faceit/player?nickname=${encodeURIComponent(query)}`,
      );
      const data = (await response.json()) as FaceitPlayer & { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "查询失败");
      }

      setPlayer(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "查询失败");
    } finally {
      setLoading(false);
    }
  }

  const cs2 = player?.games?.cs2;

  return (
    <main>
      <section className="hero">
        <p className="eyebrow">CS2 · FACEIT LIVE SCOUT</p>
        <h1>在进入对局前，<br />先认识你的队友与对手。</h1>
        <p className="intro">
          当前版本已接入 FACEIT 官方公开数据。输入昵称，验证玩家身份、等级与实时 ELO。
        </p>

        <form onSubmit={searchPlayer} className="search-form">
          <label htmlFor="nickname">FACEIT 昵称</label>
          <div className="search-row">
            <input
              id="nickname"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              placeholder="例如：s1mple"
              autoComplete="off"
            />
            <button type="submit" disabled={loading}>
              {loading ? "查询中…" : "查询玩家"}
            </button>
          </div>
        </form>

        {error && <p className="error" role="alert">{error}</p>}
      </section>

      <section className="result-panel" aria-live="polite">
        {player ? (
          <article className="player-card">
            <div className="identity">
              {player.avatar ? (
                // FACEIT avatar hosts vary, so a regular image avoids a brittle host allowlist.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={player.avatar} alt="" />
              ) : (
                <div className="avatar-fallback">{player.nickname.slice(0, 1)}</div>
              )}
              <div>
                <span className="status">PLAYER FOUND</span>
                <h2>{player.nickname}</h2>
                <p>{player.country?.toUpperCase() ?? "未知地区"} · {cs2?.region ?? "未知区域"}</p>
              </div>
            </div>

            <div className="stats-grid">
              <div><span>FACEIT 等级</span><strong>{cs2?.skill_level ?? "—"}</strong></div>
              <div><span>实时 ELO</span><strong>{cs2?.faceit_elo ?? "—"}</strong></div>
              <div><span>Steam ID</span><strong className="small-value">{cs2?.game_player_id ?? "—"}</strong></div>
              <div><span>Player ID</span><strong className="small-value">{player.player_id}</strong></div>
            </div>

            {player.faceit_url && (
              <a href={player.faceit_url.replace("{lang}", "en")} target="_blank" rel="noreferrer">
                打开 FACEIT 资料 ↗
              </a>
            )}
          </article>
        ) : (
          <div className="empty-state">
            <span>01</span>
            <h2>玩家查询原型</h2>
            <p>下一阶段将加入最近战绩、当前比赛识别与十人阵容分析。</p>
          </div>
        )}
      </section>
    </main>
  );
}
