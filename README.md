# CS2 FACEIT Tools / CS2 FACEIT 对局工具

[English](#english) · [中文](#中文)

---

## English

A FACEIT match companion built with Next.js and React. The goal is to surface public profiles, ELO, and recent performance for both teams when a FACEIT match begins.

### Current features

- Look up a player by FACEIT nickname
- Display player ID, Steam ID, region, FACEIT level, and current ELO
- Access the FACEIT Data API securely through a Next.js server route
- Responsive dark interface

### Local development

Requirements: Node.js 20 or newer and pnpm.

1. Copy the environment example:

   ```powershell
   Copy-Item .env.example .env
   ```

2. Add your FACEIT API key to `.env`:

   ```dotenv
   FACEIT_API_KEY=your_faceit_api_key
   ```

3. Install dependencies and start the development server:

   ```powershell
   pnpm install
   pnpm dev
   ```

4. Open [http://localhost:3000](http://localhost:3000).

### Available commands

| Command | Purpose |
|---|---|
| `pnpm dev` | Start the development server |
| `pnpm build` | Create a production build |
| `pnpm start` | Run the production server |
| `pnpm typecheck` | Run the TypeScript type checker |

### Security

The FACEIT API key is used only on the Next.js server and is never sent to the browser. `.env`, `.next`, and local build caches are ignored by Git. Never place a real key in source code or commit it to the repository.

### Roadmap

- Recent matches and aggregate player statistics
- Automatic detection of the active FACEIT match
- Full ten-player roster loading
- Map-specific form and previous encounter data
- Windows desktop client and in-game overlay

---

## 中文

一个使用 Next.js 和 React 构建的 FACEIT 对局助手。项目目标是在 FACEIT 对局开始时，快速展示双方玩家的公开资料、ELO 和近期表现。

### 当前功能

- 按 FACEIT 昵称查询玩家
- 展示玩家 ID、Steam ID、地区、FACEIT 等级和实时 ELO
- 通过 Next.js 服务端安全访问 FACEIT Data API
- 响应式深色界面

### 本地运行

要求：Node.js 20 或更高版本，以及 pnpm。

1. 复制环境变量示例：

   ```powershell
   Copy-Item .env.example .env
   ```

2. 在 `.env` 中设置你的 FACEIT API Key：

   ```dotenv
   FACEIT_API_KEY=你的_FACEIT_API_KEY
   ```

3. 安装依赖并启动开发服务器：

   ```powershell
   pnpm install
   pnpm dev
   ```

4. 打开 [http://localhost:3000](http://localhost:3000)。

### 可用命令

| 命令 | 用途 |
|---|---|
| `pnpm dev` | 启动开发服务器 |
| `pnpm build` | 创建生产构建 |
| `pnpm start` | 运行生产服务器 |
| `pnpm typecheck` | 执行 TypeScript 类型检查 |

### 安全说明

FACEIT API Key 仅在 Next.js 服务端使用，不会发送到浏览器。`.env`、`.next` 和本地构建缓存均已被 Git 忽略。请勿把真实密钥写入代码或提交到仓库。

### 开发路线

- 玩家最近比赛和综合统计
- 自动识别当前 FACEIT 比赛
- 加载当前比赛的十人阵容
- 地图专项数据与历史交手记录
- Windows 桌面端和游戏内 Overlay

---

## Documentation policy / 文档规范

English is the primary language for public repository documentation, with a complete Chinese version maintained alongside it. Code identifiers and API field names remain in English.

仓库的公开文档以英文为主，同时维护完整的中文版本。代码标识符和 API 字段名统一使用英文。
