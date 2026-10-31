# Changelog / 更新日志

All notable changes to FACEIT Scout are documented here. Public release notes
are written in English first, followed by Chinese.

FACEIT Scout 的主要版本变更记录在此。公开发布说明以英文为主，并附中文说明。

## [0.1.0] - 2026-10-31

### English

- Added the self-contained Windows x64 desktop companion with embedded Next.js UI.
- Added automatic FACEIT desktop-client matchroom detection and browser-extension detection.
- Added full ten-player match rosters with automatic refresh while late players join.
- Added player lookup, latest-20-match K/D, ADR and win-rate summaries.
- Added independent map-specific recent-match statistics.
- Added the hold-to-show in-game overlay, configurable hotkey and mouse dragging.
- Added light and dark application appearances.
- Added highlighted `SNIPER EXPERT` recognition for players with a high FACEIT sniper kill rate.
- Added the allowlisted, cached and rate-limited Cloudflare FACEIT API proxy.

### 中文

- 新增自包含的 Windows x64 桌面端，内置 Next.js 界面。
- 新增 FACEIT 桌面客户端比赛房间检测和浏览器扩展检测。
- 新增完整十人阵容，并在玩家晚进入房间时自动刷新。
- 新增玩家查询、近 20 场平均 K/D、ADR 和胜率。
- 新增与全部地图统计分开计算的地图专项近期数据。
- 新增按住热键显示的游戏 Overlay、可配置按键和鼠标拖动。
- 新增浅色和暗色外观。
- 新增高狙击击杀率玩家的高亮 `SNIPER EXPERT` 标识。
- 新增带接口白名单、缓存和限流的 Cloudflare FACEIT API 代理。

### Known limitations / 已知限制

- The overlay supports borderless/fullscreen-windowed CS2. Standard external Windows overlays cannot reliably appear above exclusive fullscreen.
- Overlay 仅支持无边框或全屏窗口化 CS2；普通外部 Windows Overlay 无法稳定覆盖独占全屏。
- FACEIT may initially return fewer than ten players when users join the matchroom late; the app continues refreshing until the roster is complete.
- 玩家较晚进入比赛房间时，FACEIT 可能暂时只返回部分阵容；程序会持续刷新直到阵容完整。
