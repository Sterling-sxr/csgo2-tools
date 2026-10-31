# CS2 FACEIT Tools / CS2 FACEIT 对局工具

[English](#english) · [中文](#中文)

**Current release: v0.1.0 · Windows x64**

[Download the latest release](https://github.com/Sterling-sxr/csgo2-tools/releases/latest) · [Release notes](CHANGELOG.md)

---

## English

A FACEIT match companion built with Next.js and React. The goal is to surface public profiles, ELO, and recent performance for both teams when a FACEIT match begins.

### Download and use

The public Windows package is self-contained. You do not need Node.js, pnpm,
the .NET SDK, or a FACEIT API key.

1. Open [GitHub Releases](https://github.com/Sterling-sxr/csgo2-tools/releases/latest).
2. Download `CS2FaceitCompanion-v0.1.0-win-x64.zip`.
3. Extract the entire ZIP into a normal folder. Do not run the EXE from inside the ZIP.
4. Open `CS2FaceitCompanion.exe`. If Microsoft Defender SmartScreen appears,
   inspect the publisher information and choose **More info → Run anyway** only
   if the file came from this repository's official Releases page.
5. Keep FACEIT open. The companion automatically detects a visible FACEIT
   matchroom, or you can paste a matchroom link or search for a player manually.
6. Hold <kbd>~</kbd> to display the match overlay and release it to hide the
   overlay. Drag the overlay's top bar while it is visible to reposition it.
7. Use the gear button to change the overlay key or switch between light and dark appearance.

For the overlay, run CS2 in **Fullscreen Windowed** or **Borderless** mode.
Exclusive fullscreen does not allow a standard external Windows overlay to
reliably remain above the game. Microsoft Edge WebView2 Runtime is also required;
it is already included with current Windows 11 and most supported Windows 10 systems.

### Current features

- Look up a player by FACEIT nickname
- Display player ID, Steam ID, region, FACEIT level, and current ELO
- Display the 20 most recent matches with results, map, score, K/D/A, K/D ratio, and ADR
- Summarize the latest 20 matches with average K/D, average ADR, and win rate
- Independently calculate the latest 20 matches for each map from a 100-match sample
- Automatically detect a FACEIT matchroom URL through the included browser extension
- Detect matchrooms inside the FACEIT Windows client with the .NET companion
- Load both teams and enrich all ten players with current FACEIT level and ELO
- Continue refreshing incomplete rooms until all ten players are available
- Highlight high sniper usage as `SNIPER EXPERT` without guessing a `RIFLER` role
- Load a matchroom directly without requiring a player lookup
- Show a hold-to-display, draggable match overlay with a configurable hotkey
- Configure light and dark application appearances
- Access the FACEIT Data API through an allowlisted, rate-limited Cloudflare Worker
- Polished responsive desktop interface

### Automatic match detection extension

The included Chrome/Edge extension watches FACEIT navigation. When a `/room/{matchId}` page opens, it automatically opens the dashboard with that match and loads both rosters. No copy and paste is required.

1. Start the dashboard with `pnpm dev`.
2. Open `chrome://extensions` or `edge://extensions`.
3. Enable **Developer mode** and choose **Load unpacked**.
4. Select the `browser-extension` directory from this repository.
5. Open a FACEIT matchroom. The dashboard opens automatically.

The extension defaults to `http://localhost:3000/`. Its Options page can point to a deployed dashboard later.

### FACEIT Windows client companion

The `companion` project is a Windows desktop application with an embedded WebView2 dashboard and tray support. For users of the FACEIT desktop client, it scans only the FACEIT window's UI Automation tree, extracts a visible matchroom ID, and loads the match directly inside the desktop window. It does not inject code, inspect CS2, read login cookies, or access FACEIT Anti-Cheat.

Requirements: .NET 8 SDK.

```powershell
dotnet build companion/Cs2FaceitCompanion.csproj
dotnet run --project companion/Cs2FaceitCompanion.csproj
```

Run the extractor self-test:

```powershell
dotnet run --project companion/Cs2FaceitCompanion.csproj -- --self-test
```

Open a known match directly during development:

```powershell
dotnet run --project companion/Cs2FaceitCompanion.csproj -- --match 1-your-match-id
```

For a standalone Windows executable:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/publish-windows.ps1
```

The publish script bundles the standalone Next.js server, static assets, and Node.js with the self-contained .NET app. Opening the EXE starts the local dashboard automatically; `pnpm dev` is not required. Public packages never include `.env` or `FACEIT_API_KEY`. Pass the deployed Worker URL when creating a release:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/publish-windows.ps1 `
  -FaceitApiBaseUrl "https://faceit-scout-api.sterling-cs2-tools.workers.dev"
```

The desktop app reads `companion.settings.json`. Set `startMinimized` if desired, or add another FACEIT process-name fragment if the installed client uses a different executable name. Diagnostic logs are written to `%LOCALAPPDATA%\CS2FaceitTools\companion.log`. The Microsoft Edge WebView2 Runtime is required and is already included with current Windows 11 and most supported Windows 10 installations.

### Local development

Requirements: Node.js 20 or newer and pnpm.

1. Copy the environment example:

   ```powershell
   Copy-Item .env.example .env
   ```

2. Configure the deployed cloud API in `.env`:

   ```dotenv
   FACEIT_API_BASE_URL=https://faceit-scout-api.sterling-cs2-tools.workers.dev
   ```

   Direct development against FACEIT remains available by omitting
   `FACEIT_API_BASE_URL` and setting `FACEIT_API_KEY`, but that mode must never be
   used in a distributable package.

3. Install dependencies and start the development server:

   ```powershell
   pnpm install
   pnpm dev
   ```

4. Open [http://localhost:3000](http://localhost:3000).

### Cloud API deployment

The `cloud-api` Worker is a narrow FACEIT proxy. It only accepts the player,
history, CS2 statistics, and match endpoints used by this project. It validates
query parameters, applies an approximate per-IP limit of 600 upstream requests
per minute, and caches successful FACEIT responses at Cloudflare's edge.

1. Authorize Wrangler once:

   ```powershell
   pnpm exec wrangler login
   ```

2. Store the private FACEIT key as a Cloudflare secret:

   ```powershell
   pnpm cloud:secret
   ```

3. Deploy the Worker:

   ```powershell
   pnpm cloud:deploy
   ```

4. Copy the resulting `https://...workers.dev` URL into `.env` for local
   development and pass it to `publish-windows.ps1` for public releases.

The Worker URL is public by design; the FACEIT key is not. Rate limiting and
the endpoint allowlist reduce abuse, while shared edge caching reduces upstream
FACEIT usage.

### Available commands

| Command | Purpose |
|---|---|
| `pnpm dev` | Start the development server |
| `pnpm build` | Create a production build |
| `pnpm start` | Run the production server |
| `pnpm typecheck` | Run the TypeScript type checker |
| `pnpm cloud:typecheck` | Type-check the Cloudflare Worker |
| `pnpm cloud:dev` | Run the Worker locally |
| `pnpm cloud:secret` | Store `FACEIT_API_KEY` in Cloudflare |
| `pnpm cloud:deploy` | Deploy the Worker |

### Security

The FACEIT API key is stored only as a Cloudflare Worker secret and is never shipped to the desktop app or browser. `.env`, `.dev.vars`, `.next`, Wrangler state, and local build caches are ignored by Git. Never place a real key in source code, GitHub Actions output, or a release archive.

### Roadmap

- Previous encounter data
- Signed Windows installer and automatic updates

---

## 中文

一个使用 Next.js 和 React 构建的 FACEIT 对局助手。项目目标是在 FACEIT 对局开始时，快速展示双方玩家的公开资料、ELO 和近期表现。

### 下载与使用

公开 Windows 压缩包为自包含版本，不需要安装 Node.js、pnpm、.NET SDK，也不需要
用户自己提供 FACEIT API Key。

1. 打开 [GitHub Releases](https://github.com/Sterling-sxr/csgo2-tools/releases/latest)。
2. 下载 `CS2FaceitCompanion-v0.1.0-win-x64.zip`。
3. 把 ZIP 完整解压到普通文件夹，不要直接在压缩包内部运行 EXE。
4. 打开 `CS2FaceitCompanion.exe`。如果 Microsoft Defender SmartScreen 弹出提示，
   请先确认文件来自本仓库的官方 Releases 页面，再选择**更多信息 → 仍要运行**。
5. 保持 FACEIT 开启。程序会自动检测当前可见的 FACEIT 比赛房间，也可以手动粘贴
   比赛房间链接或查询玩家昵称。
6. 按住 <kbd>~</kbd> 显示比赛 Overlay，松开按键后隐藏。Overlay 显示时可以拖动顶部区域调整位置。
7. 点击齿轮按钮可以修改 Overlay 按键，以及切换浅色或暗色外观。

游戏内 Overlay 需要 CS2 使用**全屏窗口化**或**无边框**模式。普通外部 Windows
Overlay 无法稳定覆盖独占全屏。程序还需要 Microsoft Edge WebView2 Runtime；当前
Windows 11 和大多数受支持的 Windows 10 通常已经自带。

### 当前功能

- 按 FACEIT 昵称查询玩家
- 展示玩家 ID、Steam ID、地区、FACEIT 等级和实时 ELO
- 展示最近 20 场比赛的胜负、地图、比分、K/D/A、K/D 和 ADR
- 汇总近 20 场的平均 K/D、平均 ADR 和胜率
- 从最近 100 场样本中，为每张地图独立计算最近最多 20 场专项数据
- 通过项目内置浏览器扩展自动检测 FACEIT 比赛房间 URL
- 使用 .NET Companion 检测 FACEIT Windows 客户端中的比赛房间
- 加载双方完整阵容，并补充十名玩家的实时 FACEIT 等级和 ELO
- 房间阵容不完整时持续刷新，直到十名玩家全部出现
- 只对狙击使用率很高的玩家高亮显示 `SNIPER EXPERT`，不再推测 `RIFLER`
- 无需先查询玩家即可直接加载比赛房间
- 支持按住热键显示、可以鼠标拖动的比赛 Overlay，并可修改热键
- 支持浅色和暗色外观设置
- 通过带路径白名单、缓存和限流的 Cloudflare Worker 访问 FACEIT Data API
- 精致的响应式桌面界面

### 自动比赛检测扩展

项目内置的 Chrome/Edge 扩展会监控 FACEIT 页面路由。进入 `/room/{matchId}` 比赛房间后，扩展会自动打开工具页面、传递 Match ID 并加载双方阵容，不需要复制粘贴。

1. 使用 `pnpm dev` 启动工具页面。
2. 打开 `chrome://extensions` 或 `edge://extensions`。
3. 启用**开发者模式**并选择**加载已解压的扩展程序**。
4. 选择仓库中的 `browser-extension` 文件夹。
5. 进入任意 FACEIT 比赛房间，工具页面将自动打开。

扩展默认连接 `http://localhost:3000/`。以后部署网站后，可以在扩展的设置页面修改地址。

### FACEIT Windows 客户端 Companion

`companion` 项目是带有内嵌 WebView2 数据面板和托盘功能的 Windows 桌面程序。对于 FACEIT 桌面软件用户，它只扫描 FACEIT 窗口的 UI Automation 控件树，从可见页面信息中提取 Match ID，并直接在桌面窗口内加载比赛。它不会注入进程、检查 CS2、读取登录 Cookie，也不会访问 FACEIT Anti-Cheat。

要求：.NET 8 SDK。

```powershell
dotnet build companion/Cs2FaceitCompanion.csproj
dotnet run --project companion/Cs2FaceitCompanion.csproj
```

运行 Match ID 提取自检：

```powershell
dotnet run --project companion/Cs2FaceitCompanion.csproj -- --self-test
```

开发时直接打开一个已知比赛：

```powershell
dotnet run --project companion/Cs2FaceitCompanion.csproj -- --match 1-你的比赛ID
```

发布独立 Windows 可执行文件：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/publish-windows.ps1
```

发布脚本会把 Next.js 独立服务、静态资源和 Node.js 一并放入自包含的 .NET 程序包。打开 EXE 后会自动启动本地数据面板，不再需要运行 `pnpm dev`。公开安装包永远不会包含 `.env` 或 `FACEIT_API_KEY`。创建公开版本时传入已经部署的 Worker 地址：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/publish-windows.ps1 `
  -FaceitApiBaseUrl "https://faceit-scout-api.sterling-cs2-tools.workers.dev"
```

桌面程序读取 `companion.settings.json`。可以设置 `startMinimized`；如果本机 FACEIT 客户端使用不同的进程名，还可以增加进程名片段。诊断日志保存在 `%LOCALAPPDATA%\CS2FaceitTools\companion.log`。运行时需要 Microsoft Edge WebView2 Runtime，当前 Windows 11 和大多数受支持的 Windows 10 通常已经自带。

### 本地运行

要求：Node.js 20 或更高版本，以及 pnpm。

1. 复制环境变量示例：

   ```powershell
   Copy-Item .env.example .env
   ```

2. 在 `.env` 中设置已经部署的云端 API 地址：

   ```dotenv
   FACEIT_API_BASE_URL=https://faceit-scout-api.sterling-cs2-tools.workers.dev
   ```

   本地开发仍可不设置 `FACEIT_API_BASE_URL`，改用 `FACEIT_API_KEY` 直接请求
   FACEIT；但这种模式绝不能用于公开安装包。

3. 安装依赖并启动开发服务器：

   ```powershell
   pnpm install
   pnpm dev
   ```

4. 打开 [http://localhost:3000](http://localhost:3000)。

### 部署云端 API

`cloud-api` 是一个受限制的 FACEIT 代理。它只开放本项目使用的玩家、历史战绩、
CS2 统计和比赛接口，并验证查询参数、按 IP 进行每分钟约 600 次上游请求的限流，
同时在 Cloudflare 边缘缓存成功响应。

1. 首次授权 Wrangler：

   ```powershell
   pnpm exec wrangler login
   ```

2. 将私人 FACEIT Key 保存为 Cloudflare Secret：

   ```powershell
   pnpm cloud:secret
   ```

3. 部署 Worker：

   ```powershell
   pnpm cloud:deploy
   ```

4. 把输出的 `https://...workers.dev` 地址写进本地 `.env`，并在公开打包时传给
   `publish-windows.ps1`。

Worker 地址本身是公开的，但 FACEIT Key 不会公开。路径白名单和限流用于降低滥用，
共享边缘缓存用于减少对 FACEIT 的重复请求。

### 可用命令

| 命令 | 用途 |
|---|---|
| `pnpm dev` | 启动开发服务器 |
| `pnpm build` | 创建生产构建 |
| `pnpm start` | 运行生产服务器 |
| `pnpm typecheck` | 执行 TypeScript 类型检查 |
| `pnpm cloud:typecheck` | 检查 Cloudflare Worker 类型 |
| `pnpm cloud:dev` | 本地运行 Worker |
| `pnpm cloud:secret` | 在 Cloudflare 保存 `FACEIT_API_KEY` |
| `pnpm cloud:deploy` | 部署 Worker |

### 安全说明

FACEIT API Key 只保存为 Cloudflare Worker Secret，不会进入桌面 App 或浏览器。`.env`、`.dev.vars`、`.next`、Wrangler 本地状态和构建缓存均已被 Git 忽略。请勿把真实密钥写入代码、GitHub Actions 输出或 Release 压缩包。

### 开发路线

- 历史交手记录
- 带数字签名的 Windows 安装包和自动更新

---

## Documentation policy / 文档规范

English is the primary language for public repository documentation, with a complete Chinese version maintained alongside it. Code identifiers and API field names remain in English.

仓库的公开文档以英文为主，同时维护完整的中文版本。代码标识符和 API 字段名统一使用英文。
