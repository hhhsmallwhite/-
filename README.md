# 天天记账

> 一个装在电脑里的离线记账本。数据只存在本机的一个文件里——不注册账号、不联网、不上传。

![概览页](docs/images/overview.png)

## 这是什么

记「钱花在哪儿」的桌面小工具。五个页面，覆盖从记一笔到月底复盘的完整链路：

| 页面 | 能干什么 |
|---|---|
| 概览 | 本月支出 / 收入 / 结余三张卡片 + 最近几笔 |
| 账单 | 按月查看，按类型、分类、备注筛选，每一笔可改可删 |
| 统计 | 支出与收入的分类占比环形图、收支对比、可调区间的趋势柱状图 |
| 设置 | 导出 / 导入 CSV、备份与恢复、版本号、打开日志文件夹 |
| 小游戏 | 贪吃蛇，最高分单独存一个小文件（跟账本完全隔离） |

![统计页](docs/images/stats.png)

## 技术栈

| 类别 | 选型 |
|---|---|
| 运行环境 | Electron 38（主进程 / preload / 渲染进程三层隔离） |
| 界面 | 原生 HTML + CSS + JavaScript —— **没有框架，没有打包器，没有构建步骤** |
| 数据库 | SQLite（better-sqlite3，同步 API，单文件） |
| 打包 | electron-builder 26（NSIS 安装包，x64） |
| 运行时依赖 | **只有 1 个**：better-sqlite3 |

图表是用浏览器自带的 SVG 手画的（环形图用 `stroke-dasharray` 拼弧段，柱状图手拼 `<path>`），没有引入 ECharts / Chart.js。

## 快速开始

需要 Node.js 18+（开发时用的是 22）。

```bash
npm install      # 安装依赖（.npmrc 里已配好国内镜像）
npm start        # 开发运行
npm run dist     # 打 Windows 安装包，输出到 dist/
```

首次启动会自动做三件事：写日志、把账本备份一份、把账本结构升级到最新。都不需要你操作。

## 测试

215 条断言，全部零依赖（用 Node 自带的 `assert`）。

```bash
# 纯逻辑（node 直接跑）
node test/db.test.js                # 账本增删改查
node test/migration.test.js         # 老账本升级不丢数据
node test/validate.test.js          # 入参校验
node test/backup.test.js            # 备份与恢复
node test/import-csv.test.js        # CSV 解析与去重
node test/export-csv.test.js        # CSV 拼装
node test/paths.test.js             # 路径与旧账本搬家
node test/format.test.js            # 金额与日期换算
node test/ipc-contract.test.js      # 三处通道是否一致
node test/renderer-manifest.test.js # 界面脚本装配
node test/snake-core.test.js        # 贪吃蛇规则
node test/score.test.js             # 最高分读写

# 界面端到端（需要 Electron，用离屏渲染，不弹窗）
./node_modules/.bin/electron --disable-gpu test/ui-smoke.js    # 走遍 5 个页面 + 记一笔
./node_modules/.bin/electron --disable-gpu test/app-boot.test.js # 真 preload + 真库启动一次
```

两个 Electron 测试都用**临时 userData**，不会碰你真实的账本。

## 目录结构

```
main.js                  入口，只有一行
main/                    主进程
  app.js                 开机流程：单实例 → 日志 → 备份 → 开库 → 注册通道 → 开窗口
  window.js              窗口与三个安全开关（contextIsolation / nodeIntegration / sandbox）
  ipc.js                 19 个通道的实现（一张表）
  channels.js            通道清单，唯一真源
  validate.js            入参校验：白名单 + 金额/日期/长度/范围
  dialogs.js             两段「选文件」流程（挑备份恢复、挑 CSV 导入）
  backup.js              每日备份 / 手动备份 / 恢复
  import-csv.js          CSV 解析与导入（自写解析器 + 去重）
  export-csv.js          CSV 导出
  logger.js              日志落文件 + 全局异常兜底
  paths.js               各类文件路径 + 旧账本搬家
db/                      数据层（唯一写 SQL 的地方，不依赖 Electron）
  index.js               对外大门（16 个方法）
  connection.js          开库 / PRAGMA / 执行迁移
  migrations.js          结构升级清单（v1 建表，v2 加索引）
  records.js             增删改查
  stats.js               汇总 / 分类占比 / 趋势
preload.js               安全桥：19 个方法挂到 window.tiantian
src/                     渲染进程
  index.html             13 个 <script> 按层装配
  app.js                 页面调度 + 全局错误上报
  pages/                 5 个页面，一页一个文件
  features/add-record.js 记一笔弹窗（新增与修改共用）
  lib/                   dom / format / categories / charts
  snake-core.js          贪吃蛇纯规则（可脱离窗口单测）
test/                    14 个测试文件
```

## 架构

Electron 的三层隔离，界面拿不到 `fs`、拿不到 `require`：

```
渲染进程（沙箱） ── window.tiantian.xxx() ──> preload.js
                                                │ ipcRenderer.invoke
                                                ▼
主进程 ── main/ipc.js ── validate.js ──> db/ ──> SQLite 单文件
```

三条边界（都有测试守着）：

1. 渲染层不出现 `require`，所有模块挂在 `window.TT` 上协作；
2. `db/` 不 require electron —— 所以 168 条 node 测试能直接跑；
3. 通道名在 `channels.js` / `preload.js` / `ipc.js` 三处必须一致，不一致测试就红。

## 几个值得说的设计

**金额用整数「分」存。** `0.1 + 0.2 !== 0.3`，记账软件在这里翻车最致命。库里是 `amount_cents INTEGER`，只在存之前乘 100、显示时除 100。

**数据库有迁移机制。** 用户库里存着真实数据，`CREATE TABLE` 改不动已存在的表。所以用 SQLite 的 `user_version` 记「改到第几号」，启动时只补做没做过的，每步包事务。加字段就往清单末尾追加一条。

**备份发生在开库之前。** 这样每天那份备份一定是「今天动过之前」的原样——万一结构升级出岔子，手里这份能原封不动换回去。同一天只备一次，留 7 份。

**校验放在主进程，不只在界面。** 界面那道是为了少走冤枉路，主进程那道才是防线：字段白名单、金额上限、日期是否真实存在（2 月 30 号进不来）、不猜类型（字符串 `"1250"` 不会自动当数字）。

**日志分两级。** 主进程崩了写文件；界面崩了看不见控制台，所以界面的错误也会通过 IPC 报回主进程落到同一个文件里。

## 数据存在哪

| 内容 | 路径（Windows） |
|---|---|
| 账本 | `%APPDATA%\天天记账\tiantian.db` |
| 每日备份 | `%APPDATA%\天天记账\backups\tiantian-YYYYMMDD-HHmmss.db` |
| 恢复前现场 | `%APPDATA%\天天记账\backups\tiantian-before-restore-*.db` |
| 日志 | `%APPDATA%\天天记账\logs\main-YYYY-MM-DD.log` |
| 贪吃蛇最高分 | `%APPDATA%\天天记账\snake_highscore.json` |

备份就是复制那一个 `.db` 文件，换电脑拷过去就能接着用。

## 加功能从哪下手

| 改什么 | 动哪里 |
|---|---|
| 改界面 | `src/pages/那个页面.js` + `src/styles.css` |
| 界面要新数据 | 三处一起改：`main/channels.js` 加名字 → `main/ipc.js` 加实现（先 validate）→ `preload.js` 加方法。改完跑 `node test/ipc-contract.test.js` |
| 改表结构 | 往 `db/migrations.js` 末尾追加一条，跑 `node test/migration.test.js` |
| 加新页面 | 新建 `src/pages/xxx.js`，同时往 `index.html` 加 `<script>`，跑 `node test/renderer-manifest.test.js` |

## 已知限制

- **只打过 Windows 安装包**。代码是跨平台的，Mac 版需要在 Mac 上打包。
- **分类写死在前端**（`src/lib/categories.js`），库里没有分类表。要做「自定义分类」得先加表 + 迁移。
- **单机单用户**，没有账号系统，也没有同步。
- 恢复是文件级覆盖（有备份和校验兜底），不是数据库级事务。

## 许可

MIT
