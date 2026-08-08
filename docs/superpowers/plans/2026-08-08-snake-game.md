# 贪吃蛇小游戏 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在「天天记账」App 内新增一个可玩、可保存最高分、带音效的贪吃蛇小游戏，作为左侧导航第 5 个页面。

**Architecture:** 纯游戏逻辑与界面分离，便于测试：
- `src/snake-core.js` —— 无 DOM 的贪吃蛇状态机（蛇、食物、方向、碰撞、计分），可单独用 `node` 测试。
- `score.js` —— 最高分小文件读写，可单独用 `node` 测试。
- `src/snake-game.js` —— 界面集成（画布渲染、键盘输入、计时、音效、存取最高分），**完全自包含，renderer.js 一行不改**。
- 主程序 `main.js` 仅加两个 IPC 接口（读/写最高分），`preload.js` 暴露两个安全接口。

**Tech Stack:** Electron 38 · HTML5 Canvas · Web Audio API · 纯手写（不引入任何第三方库、不下载任何资源，延续项目"完全离线"约束）。最高分存 `app.getPath('userData')/snake_highscore.json`，与账本数据库完全隔离。

## Global Constraints

- 不引入任何第三方库、不下载任何资源；音效用 Web Audio API 自生成。
- 不修改任何记账相关代码与数据：`renderer.js`、`db.js` **保持零改动**。
- 界面简体中文，风格沿用现有翠绿主色（CSS 变量 `--green` 系）。
- 测试一律用临时 userData，绝不碰真实账本。
- 每个任务完成即提交一次 git。

## File Structure

| 文件 | 动作 | 职责 |
|---|---|---|
| `src/snake-core.js` | 新建 | 贪吃蛇纯逻辑状态机（无 DOM，可 node 测试） |
| `src/snake-game.js` | 新建 | 画布渲染、键盘、计时、音效、最高分存取（自包含） |
| `score.js` | 新建 | 最高分小文件读写（无 Electron，可 node 测试） |
| `main.js` | 修改 | 加 `game:getHighScore` / `game:setHighScore` 两个 IPC |
| `preload.js` | 修改 | 加 `getHighScore()` / `setHighScore(score)` |
| `src/index.html` | 修改 | 加第 5 个导航项「小游戏」+ 游戏页面 + 两个 script 标签 |
| `src/styles.css` | 修改 | 加游戏页样式（绿色风格） |
| `package.json` | 修改 | `build.files` 加 `"score.js"`（否则打包时不包含） |
| `test/snake-core.test.js` | 新建 | 贪吃蛇核心逻辑测试（`node` 直接跑） |
| `test/score.test.js` | 新建 | 最高分读写测试（`node` 直接跑） |

---

### Task 1: 贪吃蛇核心逻辑（src/snake-core.js）

**Files:**
- Create: `src/snake-core.js`
- Test: `test/snake-core.test.js`

**Interfaces:**
- Produces: `SnakeCore.createGame() → game`、`SnakeCore.step(game) → bool`、`SnakeCore.turn(game, key) → bool`、`SnakeCore.placeFood(game)`、`SnakeCore.keyToDir(key)`、`SnakeCore.SIZE (=20)`。
- game 对象字段：`size`、`snake`（数组，第 0 项是头）、`dir`、`nextDir`、`food`、`score`、`status`（`ready/playing/paused/over/win`）。
- `step()` 只在 `status==='playing'` 时有效，吃食物返回新食物；撞墙/撞自己置 `status='over'`；填满棋盘置 `status='win'`。
- 模块同时兼容浏览器（挂到 `window.SnakeCore`）和 Node（`module.exports`）。

- [ ] **Step 1: 写失败测试 `test/snake-core.test.js`**

```js
/**
 * 贪吃蛇核心逻辑测试（不需要 Electron，直接 node 运行）
 * 运行：node test/snake-core.test.js
 */
const assert = require('assert');
const SnakeCore = require('../src/snake-core.js');

let passed = 0;
function check(name, fn) { fn(); passed++; console.log('✓', name); }

check('初始：蛇长3、方向向右、状态待开始、头在第0项', () => {
  const g = SnakeCore.createGame();
  assert.strictEqual(g.snake.length, 3);
  assert.strictEqual(g.dir, 'right');
  assert.strictEqual(g.status, 'ready');
  assert.strictEqual(g.size, 20);
});

check('走一步：向右移动一格，长度不变、得分不变', () => {
  const g = SnakeCore.createGame();
  g.status = 'playing';
  const head = { ...g.snake[0] };
  SnakeCore.step(g);
  assert.strictEqual(g.snake.length, 3);
  assert.strictEqual(g.snake[0].x, head.x + 1);
  assert.strictEqual(g.snake[0].y, head.y);
  assert.strictEqual(g.score, 0);
});

check('不能直接掉头（向右时按左无效）', () => {
  const g = SnakeCore.createGame();
  g.status = 'playing';
  assert.strictEqual(SnakeCore.turn(g, 'ArrowLeft'), false);
  assert.strictEqual(g.nextDir, 'right');
});

check('可以转向上、下', () => {
  const g = SnakeCore.createGame();
  g.status = 'playing';
  assert.strictEqual(SnakeCore.turn(g, 'ArrowUp'), true);
  assert.strictEqual(g.nextDir, 'up');
  assert.strictEqual(SnakeCore.turn(g, 'ArrowDown'), true);
  assert.strictEqual(g.nextDir, 'down');
});

check('吃到食物：变长1节、得分+1', () => {
  const g = SnakeCore.createGame();
  g.status = 'playing';
  const head = g.snake[0];
  g.food = { x: head.x + 1, y: head.y };   // 食物放在头的前面一格
  const before = g.snake.length;
  SnakeCore.step(g);
  assert.strictEqual(g.snake.length, before + 1);
  assert.strictEqual(g.score, 1);
});

check('没吃到食物：尾巴收掉，长度不变、得分不变', () => {
  const g = SnakeCore.createGame();
  g.status = 'playing';
  g.food = { x: 18, y: 2 };   // 远离蛇，这步不吃
  const before = g.snake.length;
  SnakeCore.step(g);
  assert.strictEqual(g.snake.length, before);
  assert.strictEqual(g.score, 0);
});

check('撞墙：向右走出棋盘 → over', () => {
  const g = SnakeCore.createGame();
  g.status = 'playing';
  g.snake = [{ x: 18, y: 1 }, { x: 17, y: 1 }, { x: 16, y: 1 }];
  g.dir = 'right'; g.nextDir = 'right';
  g.food = { x: 5, y: 15 };
  SnakeCore.step(g);                    // 走到 (19,1)，还能走
  assert.strictEqual(g.status, 'playing');
  SnakeCore.step(g);                    // 走出 (20,1)，撞墙
  assert.strictEqual(g.status, 'over');
});

check('撞自己：头移进身体 → over', () => {
  const g = SnakeCore.createGame();
  g.status = 'playing';
  g.snake = [
    { x: 5, y: 5 }, { x: 6, y: 5 }, { x: 6, y: 4 },
    { x: 5, y: 4 }, { x: 4, y: 4 }, { x: 4, y: 5 }
  ];
  g.dir = 'up'; g.nextDir = 'up';
  g.food = { x: 1, y: 1 };
  SnakeCore.step(g);                    // 头往上走到 (5,4)，撞到自己身体
  assert.strictEqual(g.status, 'over');
});

check('食物不会生成在蛇身上（反复生成 50 次）', () => {
  const g = SnakeCore.createGame();
  for (let i = 0; i < 50; i++) {
    SnakeCore.placeFood(g);
    assert.ok(g.food);
    assert.ok(!g.snake.some(s => s.x === g.food.x && s.y === g.food.y));
  }
});

check('棋盘填满时 placeFood 返回 null（触发胜利的条件）', () => {
  const g = SnakeCore.createGame();
  g.snake = [];
  for (let y = 0; y < g.size; y++)
    for (let x = 0; x < g.size; x++) g.snake.push({ x, y });
  SnakeCore.placeFood(g);
  assert.strictEqual(g.food, null);
});

check('吃掉最后一块食物后棋盘满 → win', () => {
  const g = SnakeCore.createGame();
  g.status = 'playing';
  const size = g.size;
  const snake = [];
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      if (x === 0 && y === 0) continue;   // 留出 (0,0) 放食物
      snake.push({ x, y });
    }
  const headIdx = snake.findIndex(s => s.x === 1 && s.y === 0);
  g.snake = [snake[headIdx], ...snake.filter((_, i) => i !== headIdx)];
  g.dir = 'left'; g.nextDir = 'left';
  g.food = { x: 0, y: 0 };
  SnakeCore.step(g);
  assert.strictEqual(g.score, 1);
  assert.strictEqual(g.status, 'win');
});

console.log(`\n${passed} 项测试全部通过`);
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node test/snake-core.test.js`
Expected: 报错 `Cannot find module '../src/snake-core.js'`（模块还没写，符合 TDD 预期）。

- [ ] **Step 3: 实现 `src/snake-core.js`**

```js
/**
 * 贪吃蛇 —— 纯逻辑核心（不带界面）
 *
 * 大白话：这个文件只负责「规则」，不负责「画面」。
 * 小蛇怎么动、食物怎么出现、怎么算撞墙撞自己、怎么计分，都在这。
 * 界面（src/snake-game.js）只管：画画面、听按键、走时钟、发声。
 * 这样规则可以单独用 node 测试，也方便以后改玩法。
 *
 * 同时兼容两种用法：
 * - 浏览器：<script src="snake-core.js"> 挂到 window.SnakeCore
 * - Node：  const SnakeCore = require('./src/snake-core.js')
 */

(function (global) {
  'use strict';

  const SIZE = 20;          // 棋盘 20×20
  const START_LEN = 3;      // 初始长度 3 节
  const DIRS = {
    up:    { x: 0,  y: -1 },
    down:  { x: 0,  y: 1 },
    left:  { x: -1, y: 0 },
    right: { x: 1,  y: 0 }
  };

  // 方向键 / WASD 的按键名 → 方向
  function keyToDir(key) {
    switch (key) {
      case 'ArrowUp': case 'w': case 'W': return 'up';
      case 'ArrowDown': case 's': case 'S': return 'down';
      case 'ArrowLeft': case 'a': case 'A': return 'left';
      case 'ArrowRight': case 'd': case 'D': return 'right';
      default: return null;
    }
  }

  // 建立一局：蛇在棋盘中央、横着 3 节、朝右，生成一个食物
  function createGame() {
    const mid = Math.floor(SIZE / 2);
    const snake = [];
    for (let i = 0; i < START_LEN; i++) snake.push({ x: mid - 1 - i, y: mid });
    const game = {
      size: SIZE,
      snake,               // 第 0 项是头
      dir: 'right',        // 当前实际方向
      nextDir: 'right',    // 待用方向（每步应用一次）
      food: null,
      score: 0,
      status: 'ready'      // ready 待开始 | playing 进行中 | paused 暂停 | over 结束 | win 胜利
    };
    placeFood(game);
    return game;
  }

  // 转向：不能直接掉头（向右时不能直接按左）
  function turn(game, key) {
    const d = keyToDir(key);
    if (!d) return false;
    const cur = DIRS[game.dir];
    const next = DIRS[d];
    const isReverse = cur.x + next.x === 0 && cur.y + next.y === 0;
    if (isReverse) return false;
    game.nextDir = d;
    return true;
  }

  // 把食物放在一个不在蛇身上的随机格；棋盘满了就置 null（= 胜利条件）
  function placeFood(game) {
    const free = [];
    for (let y = 0; y < game.size; y++) {
      for (let x = 0; x < game.size; x++) {
        if (!game.snake.some(s => s.x === x && s.y === y)) free.push({ x, y });
      }
    }
    game.food = free.length ? free[Math.floor(Math.random() * free.length)] : null;
  }

  // 走一步：应用方向 → 算新头 → 判断撞墙/撞自己/吃食物 → 更新蛇身和分数
  // 返回是否正常走完；游戏结束时返回 false
  function step(game) {
    if (game.status !== 'playing') return false;

    game.dir = game.nextDir;
    const d = DIRS[game.dir];
    const head = game.snake[0];
    const nx = head.x + d.x;
    const ny = head.y + d.y;

    // 撞墙
    if (nx < 0 || ny < 0 || nx >= game.size || ny >= game.size) {
      game.status = 'over';
      return false;
    }

    const willEat = !!game.food && nx === game.food.x && ny === game.food.y;

    // 撞自己：没吃到时尾巴这步会移走，所以不把尾巴算作障碍
    const tail = game.snake[game.snake.length - 1];
    const bodyToCheck = willEat ? game.snake : game.snake.slice(0, -1);
    if (bodyToCheck.some(s => s.x === nx && s.y === ny)) {
      game.status = 'over';
      return false;
    }

    game.snake.unshift({ x: nx, y: ny });   // 新头长出来

    if (willEat) {
      game.score += 1;
      placeFood(game);
      if (!game.food) { game.status = 'win'; return true; }   // 棋盘满了，大获全胜
    } else {
      game.snake.pop();   // 没吃到，尾巴收掉，长度不变
    }
    return true;
  }

  const api = { createGame, step, turn, placeFood, keyToDir, SIZE };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.SnakeCore = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node test/snake-core.test.js`
Expected: `10 项测试全部通过`。

- [ ] **Step 5: 提交**

```bash
git add src/snake-core.js test/snake-core.test.js
git commit -m "贪吃蛇：核心逻辑 + 单元测试（snake-core.js）"
```

---

### Task 2: 最高分存取（score.js + IPC 接线）

**Files:**
- Create: `score.js`
- Modify: `main.js:59-72`（在 `registerIpcHandlers` 里加两个 handler，并在文件顶部 `require('./score')`）
- Modify: `preload.js:35-37`（在 contextBridge 对象里加两个方法）
- Modify: `package.json:32-38`（`build.files` 加 `"score.js"`）
- Test: `test/score.test.js`

**Interfaces:**
- Consumes: 无。
- Produces: `readHighScore(filePath) → number`、`writeHighScore(filePath, score) → number`（来自 `require('./score')`）。
- preload 暴露：`window.tiantian.getHighScore()`、`window.tiantian.setHighScore(score)`。

- [ ] **Step 1: 写失败测试 `test/score.test.js`**

```js
/**
 * 最高分小文件读写测试（不需要 Electron，直接 node 运行）
 * 运行：node test/score.test.js
 */
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { readHighScore, writeHighScore } = require('../score.js');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'snake-hs-'));
const file = path.join(dir, 'snake_highscore.json');

assert.strictEqual(readHighScore(file), 0);          // 文件不存在 → 0
assert.strictEqual(writeHighScore(file, 5), 5);      // 写入 5
assert.strictEqual(readHighScore(file), 5);          // 读回 5
assert.strictEqual(writeHighScore(file, -3), 0);     // 负数 → 0
assert.strictEqual(writeHighScore(file, 12.8), 12);  // 小数 → 取整 12
assert.strictEqual(readHighScore(file), 12);
fs.writeFileSync(file, 'not json');                  // 文件坏了
assert.strictEqual(readHighScore(file), 0);          // 坏文件 → 0

console.log('✓ 最高分读写测试全部通过');
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node test/score.test.js`
Expected: 报错 `Cannot find module '../score.js'`。

- [ ] **Step 3: 实现 `score.js`**

```js
/**
 * 贪吃蛇 —— 最高分小文件读写
 *
 * 大白话：记游戏成绩用的"小盒子"。成绩单独存在一个小文件里，
 * 跟账本数据库完全分开，玩游戏永远碰不到记账数据。
 * 这个小模块不带 Electron，可以单独用 node 测试。
 */

const fs = require('fs');
const path = require('path');

// 读最高分：文件不存在、内容损坏、不是数字时一律按 0 处理，绝不报错
function readHighScore(filePath) {
  try {
    if (!fs.existsSync(filePath)) return 0;
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const n = Number(data && data.highScore);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch (e) {
    return 0;
  }
}

// 写最高分：负数按 0、小数向下取整；写失败静默忽略，游戏不受影响
function writeHighScore(filePath, score) {
  const n = Math.max(0, Math.floor(Number(score) || 0));
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify({ highScore: n }), 'utf8');
  } catch (e) {
    /* 写不上就算了 */
  }
  return n;
}

module.exports = { readHighScore, writeHighScore };
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node test/score.test.js`
Expected: `✓ 最高分读写测试全部通过`。

- [ ] **Step 5: main.js 接线 —— 顶部加 `require`**

在 `main.js` 第 12 行 `const db = require('./db');` 后面加：

```js
const scoreStore = require('./score'); // 贪吃蛇最高分小文件读写（见 score.js）
```

- [ ] **Step 6: main.js 接线 —— `registerIpcHandlers` 里加两个 handler**

在 `main.js` 第 71 行 `ipcMain.handle('export:exportCsv', exportCsv);` 后面加：

```js
// —— 贪吃蛇（阶段6）新增：最高分读/写 ——
const highScoreFile = () => path.join(app.getPath('userData'), 'snake_highscore.json');
ipcMain.handle('game:getHighScore', () => scoreStore.readHighScore(highScoreFile()));
ipcMain.handle('game:setHighScore', (_event, score) => scoreStore.writeHighScore(highScoreFile(), score));
```

- [ ] **Step 7: preload.js 加两个接口**

在 `preload.js` 第 37 行 `exportCsv: () => ipcRenderer.invoke('export:exportCsv')` 后面加逗号并追加：

```js
  // —— 贪吃蛇（阶段6）新增：最高分读/写 ——
  // 读历史最高分（文件不存在时返回 0）
  getHighScore: () => ipcRenderer.invoke('game:getHighScore'),
  // 保存新最高分，返回保存后的值
  setHighScore: (score) => ipcRenderer.invoke('game:setHighScore', score)
```

- [ ] **Step 8: package.json 的 build.files 加 `score.js`**

把 `package.json` 的 `build.files` 数组从：

```json
"files": [
  "main.js",
  "db.js",
  "preload.js",
  "start.js",
  "src/**/*"
]
```

改为：

```json
"files": [
  "main.js",
  "db.js",
  "preload.js",
  "score.js",
  "start.js",
  "src/**/*"
]
```

> 为什么必须改：打包时只装 `files` 里列出的文件，不写 `score.js` 的话，安装包里就没有它，主程序一启动就会 `Cannot find module` 崩溃。

- [ ] **Step 9: 运行测试 + 启动一次确认主程序不报错**

Run: `node test/score.test.js`（应通过）
Run: `node start.js`（应能正常打开窗口，主程序无报错）→ 关掉窗口。

- [ ] **Step 10: 提交**

```bash
git add score.js main.js preload.js package.json test/score.test.js
git commit -m "贪吃蛇：最高分小文件存取 + IPC 接口"
```

---

### Task 3: 游戏页面骨架（index.html + styles.css）

**Files:**
- Modify: `src/index.html:38-50`（导航区加第 5 项）、`src/index.html:230-248`（设置页 section 之后加游戏页 section）
- Modify: `src/styles.css`（文件末尾追加游戏页样式）

**Interfaces:**
- Produces: 导航项 `data-page="game"`、页面 `id="page-game"`、元素 `gameCanvas`/`gameScore`/`gameHigh`/`gameOverlay`/`gameOverlayTitle`/`gameOverlayHint`/`gameStartBtn`。
- 页面切换由 `renderer.js` 的 `switchPage` 通用逻辑自动支持（加导航项 + 加 `page-game` 即生效），无需改 renderer.js。

- [ ] **Step 1: 导航区加第 5 项「小游戏」**

在 `src/index.html` 第 43 行（设置按钮 `</button>`）之后、第 46 行 `<button class="add-btn"` 之前插入：

```html
        <button class="nav-item" data-page="game">
          <span class="nav-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="6" x2="10" y1="11" y2="11"/><line x1="8" x2="8" y1="9" y2="13"/><line x1="15" x2="15.01" y1="12" y2="12"/><line x1="18" x2="18.01" y1="10" y2="10"/><path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z"/></svg>
          </span>
          <span>小游戏</span>
        </button>
```

- [ ] **Step 2: 设置页之后加游戏页 section**

在 `src/index.html` 第 248 行（设置页 `</section>`）之后、第 250 行 `</main>` 之前插入：

```html
      <!-- 小游戏页（贪吃蛇） -->
      <section class="page" id="page-game">
        <header class="page-header">
          <h1>小游戏</h1>
          <p class="page-sub">记账累了？来玩一局贪吃蛇放松一下</p>
        </header>

        <div class="card game-card">
          <div class="game-scores">
            <div class="game-score">
              <span class="game-score-label">当前分数</span>
              <span class="game-score-value" id="gameScore">0</span>
            </div>
            <div class="game-score">
              <span class="game-score-label">历史最高</span>
              <span class="game-score-value" id="gameHigh">0</span>
            </div>
          </div>

          <div class="game-board">
            <canvas id="gameCanvas" width="400" height="400" aria-label="贪吃蛇游戏棋盘"></canvas>
            <div class="game-overlay" id="gameOverlay">
              <p class="game-overlay-title" id="gameOverlayTitle">贪吃蛇</p>
              <p class="game-overlay-hint" id="gameOverlayHint">按回车键或点下方按钮开始</p>
            </div>
          </div>

          <div class="game-controls">
            <button class="game-start-btn" id="gameStartBtn">开始游戏</button>
          </div>
          <p class="game-hint">操作：↑ ↓ ← → 方向键转向 · 空格键暂停/继续 · 回车键开始/再来一局</p>
        </div>
      </section>
```

- [ ] **Step 3: styles.css 末尾追加游戏页样式**

在 `src/styles.css` 末尾（第 1040 行 `@media (prefers-reduced-motion...` 块之后）追加：

```css
/* ============ 小游戏页（贪吃蛇） ============ */
.game-card {
  max-width: 520px;
  text-align: center;
}

.game-scores {
  display: flex;
  justify-content: center;
  gap: 32px;
  margin-bottom: 18px;
}

.game-score { display: flex; flex-direction: column; align-items: center; }

.game-score-label { font-size: 12px; color: var(--text-muted); }

.game-score-value {
  font-size: 26px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--text);
  margin-top: 2px;
}

.game-board {
  position: relative;
  width: 400px;
  max-width: 100%;
  margin: 0 auto;
  border-radius: var(--r-md);
  overflow: hidden;
  box-shadow: var(--shadow-md);
  background: #f8faf9;
}

.game-board canvas { display: block; width: 100%; height: auto; }

.game-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: rgba(255, 255, 255, .82);
  backdrop-filter: blur(2px);
  z-index: 5;
}

.game-overlay-title { font-size: 22px; font-weight: 700; color: var(--green-ink); }
.game-overlay-hint { font-size: 13px; color: var(--text-muted); }

.game-controls { margin-top: 18px; }

.game-start-btn {
  padding: 12px 34px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--green), var(--green-deep));
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  box-shadow: var(--shadow-sm);
  transition: filter .15s, transform .15s, box-shadow .15s;
}

.game-start-btn:hover {
  filter: brightness(1.06);
  box-shadow: var(--shadow-md);
}

.game-start-btn:active { transform: scale(.98); }

.game-hint {
  margin-top: 12px;
  font-size: 12px;
  color: var(--text-muted);
}
```

- [ ] **Step 4: 启动验证页面骨架**

Run: `node start.js`
Expected: 窗口打开后，左侧出现第 5 项「小游戏」；点击后右侧出现游戏页（分数区 + 400×400 棋盘 + 开始按钮 + 提示）。此时棋盘是空白（游戏逻辑还没接上，正常）。

- [ ] **Step 5: 提交**

```bash
git add src/index.html src/styles.css
git commit -m "贪吃蛇：游戏页面骨架（第5导航 + 页面 + 样式）"
```

---

### Task 4: 游戏界面集成（src/snake-game.js）

**Files:**
- Create: `src/snake-game.js`

**Interfaces:**
- Consumes: `SnakeCore`（Task 1）、`window.tiantian.getHighScore/setHighScore`（Task 2）、Task 3 的 DOM 元素。
- Produces: 自包含游戏。进入游戏页 → 按回车/点按钮开始 → 方向键转向 → 空格暂停/继续 → 结束显示分数并自动存最高分。切走页面时若在玩则自动暂停。

- [ ] **Step 1: 实现 `src/snake-game.js`**

```js
/**
 * 贪吃蛇 —— 界面集成
 *
 * 大白话：这个文件负责「画面和操作」：把棋盘画出来、听键盘、走时钟、发声，
 * 以及读写最高分。游戏规则本身在 src/snake-core.js 里。
 * 这个文件完全独立，不影响记账的任何代码。
 */

/* ---------- 元素 ---------- */
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const CELL = canvas.width / SnakeCore.SIZE;

const gameScoreEl = document.getElementById('gameScore');
const gameHighEl = document.getElementById('gameHigh');
const gameOverlay = document.getElementById('gameOverlay');
const gameOverlayTitle = document.getElementById('gameOverlayTitle');
const gameOverlayHint = document.getElementById('gameOverlayHint');
const gameStartBtn = document.getElementById('gameStartBtn');

/* ---------- 状态 ---------- */
let game = null;       // 当前这一局（SnakeCore.createGame() 的返回值）
let tickTimer = null;  // 走步定时器句柄
let highScore = 0;     // 历史最高分
const TICK_MS = 150;   // 固定速度：每 150ms 动一格

/* ---------- 声音：程序自带电子发声（Web Audio），不下载任何文件 ---------- */
let audioCtx = null;
function beep(freq, dur, type) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type || 'square';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, audioCtx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + dur);
  } catch (e) { /* 没声音就安静地玩，不打扰 */ }
}
const soundEat = () => beep(800, 0.12, 'triangle');   // 吃到食物：清脆的叮
const soundOver = () => beep(220, 0.35, 'sawtooth');  // 游戏结束：低沉一声

/* ---------- 画画面 ---------- */
function draw() {
  if (!game) return;
  const s = game.size;

  // 底色
  ctx.fillStyle = '#f8faf9';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 浅格线（每格 20px）
  ctx.strokeStyle = '#e3eae7';
  ctx.lineWidth = 1;
  for (let i = 0; i <= s; i++) {
    ctx.beginPath(); ctx.moveTo(i * CELL, 0); ctx.lineTo(i * CELL, canvas.height); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * CELL); ctx.lineTo(canvas.width, i * CELL); ctx.stroke();
  }

  // 食物（红色小圆角方块）
  if (game.food) {
    ctx.fillStyle = '#ef4444';
    const fx = game.food.x * CELL, fy = game.food.y * CELL;
    ctx.beginPath();
    ctx.roundRect(fx + 3, fy + 3, CELL - 6, CELL - 6, 5);
    ctx.fill();
  }

  // 蛇（头部颜色深一档）
  game.snake.forEach((seg, i) => {
    const isHead = i === 0;
    ctx.fillStyle = isHead ? '#059669' : '#10b981';
    const x = seg.x * CELL, y = seg.y * CELL;
    ctx.beginPath();
    ctx.roundRect(x + 1, y + 1, CELL - 2, CELL - 2, isHead ? 6 : 4);
    ctx.fill();
  });
}

/* ---------- 遮罩（开始/暂停/结束提示） ---------- */
function setOverlay(title, hint) {
  gameOverlayTitle.textContent = title;
  gameOverlayHint.textContent = hint;
  gameOverlay.classList.remove('hidden');
}

function hideOverlay() {
  gameOverlay.classList.add('hidden');
}

/* ---------- 分数显示 ---------- */
function updateScore() {
  if (game) gameScoreEl.textContent = String(game.score);
}

/* ---------- 一局的开始与结束 ---------- */
function newGame() {
  stopTick();
  game = SnakeCore.createGame();
  draw();
  setOverlay('贪吃蛇', '按回车键或点下方按钮开始');
  updateScore();
}

function startGame() {
  if (!game) game = SnakeCore.createGame();
  if (game.status === 'over' || game.status === 'win') game = SnakeCore.createGame();
  game.status = 'playing';
  hideOverlay();
  startTick();
  updateScore();
}

function startTick() {
  stopTick();
  tickTimer = setInterval(() => {
    if (!game || game.status !== 'playing') return;
    const before = game.score;
    SnakeCore.step(game);
    draw();
    if (game.score > before) { updateScore(); soundEat(); }   // 吃到食物：叮 + 加分
    if (game.status === 'over' || game.status === 'win') {
      stopTick();
      soundOver();
      finishGame();
    }
  }, TICK_MS);
}

function stopTick() {
  if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
}

function pauseGame() {
  if (game && game.status === 'playing') {
    game.status = 'paused';
    stopTick();
    setOverlay('已暂停', '按空格键继续');
  }
}

function resumeGame() {
  if (game && game.status === 'paused') {
    game.status = 'playing';
    hideOverlay();
    startTick();
  }
}

async function finishGame() {
  const won = game.status === 'win';
  setOverlay(
    won ? '🎉 大获全胜！' : '游戏结束',
    `本次得分 ${game.score}，按回车键再来一局`
  );
  // 破了纪录就更新并保存
  if (game.score > highScore) {
    highScore = game.score;
    gameHighEl.textContent = String(highScore);
    try { await window.tiantian.setHighScore(highScore); } catch (e) { /* 存不上就算了 */ }
  }
}

/* ---------- 键盘操作 ---------- */
document.addEventListener('keydown', (e) => {
  // 只在「小游戏」页、没在打字、没开着记账弹窗时响应
  if (!document.getElementById('page-game').classList.contains('active')) return;
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
  if (!document.getElementById('addModal').classList.contains('hidden')) return;

  const k = e.key;

  if (k === 'ArrowUp' || k === 'ArrowDown' || k === 'ArrowLeft' || k === 'ArrowRight') {
    e.preventDefault();                 // 防止方向键滚动页面
    if (!game) return;
    if (game.status === 'ready') startGame();
    if (game.status === 'playing') SnakeCore.turn(game, k);
    return;
  }
  if (k === ' ') {                      // 空格：暂停 / 继续
    e.preventDefault();
    if (!game) return;
    if (game.status === 'playing') pauseGame();
    else if (game.status === 'paused') resumeGame();
    return;
  }
  if (k === 'Enter') {                  // 回车：开始 / 继续 / 再来一局
    e.preventDefault();
    if (!game) return;
    if (game.status === 'ready' || game.status === 'over' || game.status === 'win' || game.status === 'paused') startGame();
    return;
  }
});

/* ---------- 开始按钮 ---------- */
gameStartBtn.addEventListener('click', () => {
  if (!game) return;
  if (game.status === 'playing') return;              // 正在玩，按钮不打扰
  if (game.status === 'paused') { resumeGame(); return; }
  startGame();
});

/* ---------- 切到别的页面：蛇还在走就自动暂停 ---------- */
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.dataset.page !== 'game' && game && game.status === 'playing') pauseGame();
  });
});

/* ---------- 启动 ---------- */
async function initGamePage() {
  try {
    highScore = await window.tiantian.getHighScore();
  } catch (e) {
    highScore = 0;
  }
  gameHighEl.textContent = String(highScore);
  newGame();
}

initGamePage();
```

- [ ] **Step 2: 在 index.html 加两个 script 标签（顺序很重要）**

把 `src/index.html` 里的一行：

```html
  <script src="renderer.js"></script>
```

改为：

```html
  <script src="renderer.js"></script>
  <script src="snake-core.js"></script>
  <script src="snake-game.js"></script>
```

> snake-game.js 用到 `window.SnakeCore`，所以必须先加载 snake-core.js。renderer.js 保持首位（页面切换逻辑先就位）。

- [ ] **Step 3: 启动并手动玩测**

Run: `node start.js`
Expected 手测清单：
1. 点左侧「小游戏」→ 出现棋盘和「开始游戏」按钮。
2. 按回车或点按钮 → 蛇开始向右走，遮罩消失。
3. 按 ↑ 蛇向上、按 ← 蛇向左（能拐弯、不能掉头）。
4. 吃到红色食物：变长、分数 +1、发出"叮"声。
5. 按空格 → 暂停（遮罩显示「已暂停」）；再按空格 → 继续。
6. 撞墙或撞到自己 → 「游戏结束」，显示本次得分。
7. 其他页面按方向键：页面不滚动、游戏不响应。
8. 游戏进行中切到别的页面 → 回来时是「已暂停」状态。

- [ ] **Step 4: 提交**

```bash
git add src/snake-game.js src/index.html
git commit -m "贪吃蛇：游戏界面集成（画布/键盘/音效/最高分）"
```

---

### Task 5: 端到端验证与收尾

**Files:**
- 无新增；跑全部测试 + 全功能手测。

- [ ] **Step 1: 跑全部自动化测试**

Run: `node test/snake-core.test.js` → 应 `10 项测试全部通过`
Run: `node test/score.test.js` → 应 `✓ 最高分读写测试全部通过`

- [ ] **Step 2: 回归测记账功能**

Run: `node start.js`，确认：
1. 记一笔（支出/收入）正常保存并提示。
2. 账单页按月查看、修改、删除正常。
3. 统计页三张环形图 + 趋势图正常。
4. 设置页导出 CSV 正常。
5. 游戏页完全不影响以上任何操作。

- [ ] **Step 3: 验证最高分持久化**

Run: `node start.js`，玩出分数后关掉 App 再打开 → 点「小游戏」→ 历史最高分还在。
（高分文件在系统用户数据文件夹的 `snake_highscore.json`，可用资源管理器查看。）

- [ ] **Step 4: 检查文件改动清单是否符合预期**

Run: `git status --short`
Expected：只有下列文件被改动/新增，**renderer.js、db.js 不应出现**：
`main.js`、`preload.js`、`package.json`、`src/index.html`、`src/styles.css`、`src/snake-core.js`、`src/snake-game.js`、`score.js`、`test/snake-core.test.js`、`test/score.test.js`。

- [ ] **Step 5: 最终提交（如还有未提交改动）**

```bash
git add -A
git commit -m "贪吃蛇：端到端验证通过"
```

- [ ] **Step 6: 向用户汇报**

用大白话汇报：做了什么、怎么玩、最高分存在哪、记账没受影响、如何验收。
