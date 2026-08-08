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
