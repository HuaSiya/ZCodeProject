# 轻投票

一个轻量的在线投票站：发一个问题，分享链接或二维码，参与者匿名投票，投完立即看到结果。

## 功能

- 匿名投票：参与者无需登录、无需注册
- 单选 / 多选（可设置最多选几项）
- 可选截止时间；也可以长期开放，之后在后台手动截止
- 投票前隐藏结果；投票后立即展示；截止后所有人可见
- 结果按参与人数计算百分比；多选时标注各项之和可能超过 100%
- 首页展示「公开」且进行中的投票；每场投票也可以设为「仅链接可见」
- 一键复制链接、二维码分享
- 管理员口令保护：创建、编辑（无票时）、提前截止、复制、删除
- 管理后台可直接查看实时结果，不必先投票
- 移动端优先的响应式界面

## 技术栈

- Vite + React 19 + TypeScript + Tailwind CSS 4 + React Router
- Hono（API）
- Cloudflare Workers 静态资源 + D1（SQLite）
- `@cloudflare/vite-plugin`：本地开发与生产构建使用同一套运行时和路由配置

## 目录结构

```
worker/                 Hono API、鉴权、校验、数据库访问
worker/routes/          公开投票 API / 管理后台 API
shared/                 前后端共享类型与常量
migrations/             D1 迁移（含并发保护触发器）
src/                    React 前端
scripts/                冒烟测试、UI 检查、本地数据重置
wrangler.jsonc          Cloudflare Worker / D1 配置
```

## 本地开发

要求：Node.js 22+（推荐 Node 24，已在 Node 24 下验证）、pnpm。

```bash
pnpm install
# Windows PowerShell / cmd:
copy .dev.vars.example .dev.vars
# Git Bash / macOS / Linux:
cp .dev.vars.example .dev.vars

pnpm db:migrate:local
pnpm dev
```

打开 <http://localhost:5173>。

- 本地默认管理员口令：`dev-admin-123`（来自 `.dev.vars`）
- `.dev.vars` 已被 gitignore；可以自行修改本地口令和 `SESSION_SECRET`
- 本地 D1 数据位于 `.wrangler/state/v3/d1`（已被 gitignore）
- 清空本地投票数据：`node scripts/reset-data.mjs`

## 测试

```bash
pnpm typecheck
pnpm test:api    # 需要本地 dev server 正在运行
pnpm test:ui     # 需要本机安装 Chrome 或 Edge
```

- `test:api` 覆盖：创建投票、匿名投票、重复投票拦截、投票前后结果可见性、截止、公开/仅链接、有票后禁止改内容、复制、删除、权限校验。
- `test:ui` 用无头 Chrome/Edge 走真实界面流程（同样需要 dev server 正在运行），检查控制台错误和失败请求，并把截图写入 `.screenshots/`。可通过 `BASE_URL`、`ADMIN_PASSCODE`、`CHROME_PATH` 覆盖默认值。
- `pnpm data:reset` 通过管理 API 删除所有本地投票。
- 本地测试如果短时间内反复登录，可能触发管理员登录限流（10 次/5 分钟）。执行 `pnpm db:clear-rate-limits:local` 清空本地限流记录即可。

## 部署到 Cloudflare

免费计划即可。以下命令都在项目根目录运行。

### 1. 登录 Wrangler

```bash
pnpm exec wrangler login
```

### 2. 创建 D1 数据库

```bash
pnpm exec wrangler d1 create qing-vote-db
```

把命令返回的 `database_id` 替换到 `wrangler.jsonc` 中：

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "qing-vote-db",
    "database_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "migrations_dir": "migrations"
  }
]
```

### 3. 执行远程迁移

```bash
pnpm db:migrate:remote
```

### 4. 首次部署

```bash
pnpm deploy
```

这会先做类型检查和生产构建，然后部署 Worker（含静态前端与 API）。

### 5. 设置生产密钥

首次部署完成后，设置两个 Secret：

```bash
pnpm exec wrangler secret put ADMIN_PASSCODE
pnpm exec wrangler secret put SESSION_SECRET
```

- `ADMIN_PASSCODE`：登录 `/admin` 使用的管理员口令。请使用足够长的随机字符串。
- `SESSION_SECRET`：用于给管理员会话签名、以及哈希匿名投票标识和 IP 限流标识。可用 `openssl rand -hex 32` 生成一个长随机串。**保持稳定**；更换后所有管理员会话失效，匿名浏览器也会被视为新访问者。

没有设置 Secret 时，API 会返回配置错误；设置后立即生效，无需重新部署。

### 6. 打开站点

访问：

```
https://qing-vote.<你的-workers-子域名>.workers.dev
```

进入 `/admin`，用 `ADMIN_PASSCODE` 登录，然后创建第一场投票。

### 自定义域名

在 Cloudflare 控制台的 Worker → Settings → Domains & Routes 中绑定域名即可，不需要改代码。

### 日常更新

```bash
pnpm deploy
```

Secret 会保留，不需要重复设置。轮换管理员口令只需再次执行：

```bash
pnpm exec wrangler secret put ADMIN_PASSCODE
```

## 安全与已知取舍

- **匿名强度**：使用 HttpOnly cookie + 服务端 HMAC 投票标识，同一浏览器在同一场投票中只能投一次。清除 cookie、换浏览器或换设备可以再次投票——这是匿名轻量投票的已知取舍。
- **IP 的用途**：仅用于短时间高频限流（例如投票 60 次/分钟、管理员登录 10 次/5 分钟），以加盐哈希形式短期保存，不用于长期追踪。
- **不适合高风险选举**：没有账号体系、实名核验、审计日志或结果公证。若用于正式选举，需要额外增加身份与审计机制。
- **管理员口令**：全站共用一个口令，保存在 Cloudflare Secret 中；登录接口有频率限制。口令泄露后请立即轮换。
- **并发保护**：`migrations/0002_vote_guards.sql` 中的触发器会阻止“有票后删除选项”以及截止边界后的投票写入，避免产生孤儿票。
- **数据保留**：投票只有管理员主动删除才会移除；截止只停止投票，不删除数据。

## 产品行为速查

- 投票前看不到票数；投完立即可见；截止/关闭后所有人可见。
- 投票默认「仅链接可见」；创建时可勾选「公开到首页」。有票之后仍可切换公开状态。
- 有票后标题、描述、选项、截止时间锁定；仍可提前截止、复制、删除、调整是否公开。
- 复制出的投票不包含票数，默认不公开，截止时间清空。
- 单选/多选统一为「最多可选 N 项」，N=1 即单选。
- 必须至少选择一个选项，没有弃权票。
