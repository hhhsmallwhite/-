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
