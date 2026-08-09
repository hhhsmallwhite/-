# 质检员助手（quality-engineer）— 设计文档

- **日期**：2026-08-09
- **状态**：方案已确认，待实现（用户已逐条拍板）
- **存放位置**：
  - 助手：`.claude/agents/quality-engineer.md`
  - 新技能：`.claude/skills/security-audit/`、`.claude/skills/code-quality/`
  - 复用技能：`.claude/skills/comments-check/`（已存在，不动）

---

## 一、目标

开发一个「质检员」助手 `quality-engineer`，让用户一句话就能给全项目代码做一次**多维体检**：
**安全审计 + 注释检查 + 代码质量**，最后交一份体检报告（聊天里讲 + 存 Markdown 到 `docs/`）。
质检员只「检查 + 报告」，**绝不修改任何代码**。

## 二、需求（用户已确认）

| 项目 | 决定 | 大白话说明 |
|---|---|---|
| 助手名字 | `quality-engineer` | 「质检员」，兜里装 3 本手册 |
| 技能 1 | `security-audit`（**新建**） | 安全审计，查 4 方面（用户全选）：数据库防注入、页面防注入 XSS、外壳安全开关、文件与敏感信息 |
| 技能 2 | `comments-check`（**已存在**） | 注释检查，直接复用 |
| 技能 3 | `code-quality`（**新建**，用户选定「做成第 3 本手册」） | 代码质量，查 3 方面（用户全选）：命名规范、错误处理、死代码与重复代码 |
| 报告形式 | **聊天显示 + 存 Markdown 到 docs/** | 沿用注释检查技能用户已选定的方式 |

## 三、文件结构

```
.claude/
├── agents/
│   └── quality-engineer.md            # 质检员助手（装 3 本手册）
└── skills/
    ├── comments-check/                # 已存在，不动
    ├── security-audit/                # 新建：安全审计
    │   ├── SKILL.md
    │   └── scripts/
    │       └── security-scan.js       # 客观扫描脚本（零依赖，纯 Node 自带）
    └── code-quality/                  # 新建：代码质量
        └── SKILL.md
docs/superpowers/specs/
└── 2026-08-09-quality-engineer-design.md   # 本文档
```

- 三个技能都用 `context: fork`：独立小助手里运行，与主对话隔离。
- 质检员助手在 frontmatter 里声明 3 个技能，运行时就有一整套手册；扫描脚本也随手册提供。
- 安全审计脚本零依赖：只用 `fs` / `path` / `os`，不装任何东西。

## 四、安全审计技能（security-audit）

### 4.1 扫描脚本 security-scan.js（客观找位置）

像注释检查的 comment-stats.js 一样，脚本先「数数/找位置」，AI 再主观点评。
脚本扫描 `.js` / `.html` 文件（跳过 node_modules/dist/.git/.claude/docs 等），按 5 组正则逐行找可疑位置：

| 组别 | 扫描什么 | 大白话 |
|---|---|---|
| `sql` 数据库查询 | 所有 `db.prepare(` / `db.exec(` 查询位置；以及「SQL 关键字 + `${}` 或字符串拼接」的疑似拼接风险 | 查出每一处查询，AI 复核是不是安全的预编译写法；特别盯防拼字符串的写法 |
| `xss` 页面写入 | `.innerHTML=`、`.outerHTML=`、`insertAdjacentHTML`、`document.write`、`eval(`、`new Function(` | 找出所有「往页面写内容」的地方，AI 判断写进去的用户输入有没有被「消毒」 |
| `shell` 外壳开关 | `nodeIntegration`、`contextIsolation`、`webSecurity`、`sandbox`、`shell:`、`allowRunningInsecureContent` | 找出外壳安全开关，AI 核对是否关严（nodeIntegration 应为 false、contextIsolation 应为 true） |
| `file` 文件路径 | 所有 `fs.` 读写操作；`path.join`/`resolve` 带 `${}`；`../` 越级路径 | 找出读写文件的地方，AI 判断路径会不会被用户输入「越狱」 |
| `secret` 敏感信息 | 硬编码 `password`/`token`/`secret`/`apiKey` 等疑似密钥；`process.env` 环境变量 | 找出疑似明文密钥，AI 判断是否真风险 |

输出：屏幕打印总览 + `=== JSON ===` 完整数据（供 AI 写报告）。

### 4.2 AI 复核标准（对脚本点名的每个位置逐项判断）

1. **SQL 防注入**：每条查询是否都用预编译占位符（`?` 或 `@名字`）？值是否不直接拼进语句？——本项目已知写法良好（db.js 全用占位符），AI 复核确认即可。
2. **页面 XSS**：写入 `innerHTML` 等处的数据，来源是不是用户输入（备注、分类名）？若是，有没有先做转义？空字符串赋值（如 `el.innerHTML = ''`）不算风险。
3. **外壳安全**：`contextIsolation` 应为 `true`、`nodeIntegration` 应为 `false`；不应出现 `webSecurity: false`、`shell: true`、`allowRunningInsecureContent: true`。
4. **文件路径**：`fs` 操作的路径是否由用户可控？导出用 `dialog.showSaveDialog` 让用户自己选位置是安全的。
5. **敏感信息**：代码里不该有明文密码/密钥；`console.log` 不该打印隐私数据（账目明细、路径等少量日志可接受，AI 判断）。

### 4.3 报告

聊天汇报：一句话总结 + 按维度列问题（位置/原因/建议）。
存文件：`docs/安全审计报告-<日期>.md`。

## 五、代码质量技能（code-quality）

以 AI 通读代码判断为主，3 个维度：

| 维度 | 判断标准 | 大白话 |
|---|---|---|
| 命名规范 | 变量/函数名是否「一看就懂」；单字母、缩写、中英混杂、同一东西两种写法，都算扣分项 | 名字像「门牌」，起得明白才知道这家是谁 |
| 错误处理 | 文件读写、数据库操作等有没有 try/catch 兜底；失败时是「安静坏掉」还是「告诉用户出了什么事」；有没有该判空没判空（对 null/undefined 直接操作） | 出错了要有「退路」，不能一碰就崩 |
| 死代码与重复代码 | 声明了但没用的变量/函数/导出；同样逻辑写了两遍；只能靠 AI 综合判断 | 没用的东西尽早丢，重复的东西合二为一 |

报告：`docs/代码质量报告-<日期>.md`。

## 六、质检员助手（quality-engineer）

### 6.1 工作流程

1. **确认检查范围**：先问用户要查哪几维（安全 / 注释 / 代码质量，或全查）。
2. **按维度检查**：每个维度按对应手册办事——
   - 安全审计：跑 `security-scan.js` → AI 复核每个可疑位置；
   - 注释检查：跑 `comment-stats.js` → AI 复核（照 comments-check 手册）；
   - 代码质量：Glob 列文件 → 通读 → AI 按 3 个维度判断。
3. **汇总报告**：一份 `docs/质检报告-<日期>.md` + 聊天里一句总结和问题清单。

### 6.2 红线（与既有技能一致）

- **绝不修改任何代码文件**：只检查、只报告。
- **不下载、不安装任何东西**：脚本零依赖。
- **绝不碰真实账本数据**：只读代码文件，不读写 tiantian.db 和最高分文件。
- **不扩大功能范围**：只做用户要求的检查。
- **执行命令一条一条跑**，不搞长 && 命令链。

## 七、测试

1. 写好后在项目根目录跑 `node .claude/skills/security-audit/scripts/security-scan.js`，
   人工核对输出的可疑位置与实际代码是否吻合（应能准确命中 renderer.js 的 innerHTML、main.js 的安全开关等）。
2. 对照已知良好文件：db.js 的 SQL 查询应全部判为「预编译安全」，不应误报。
3. 整包跑一次质检（调 quality-engineer 助手），检查综合报告是否完整、可读。

## 八、不在本次范围（YAGNI）

- **不自动修安全/质量问题**：只出问题清单，改不改由用户决定。
- **不引入任何第三方安全扫描库**（如 npm audit、ESLint 插件）：保持零依赖。
- **不检查非代码文件**（Markdown、JSON、锁文件）。
- **不做自动化定时检查**：只在用户喊「质检」时跑。
