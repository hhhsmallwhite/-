/**
 * 天天记账 —— 小游戏页（贪吃蛇的画面与操作）
 *
 * 大白话：这个文件只管「看得见的部分」——把棋盘画出来、听键盘、走时钟、发声、
 * 以及读写最高分。蛇怎么动、怎么算撞死，那些规则全在 snake-core.js 里，
 * 这样规则可以单独用 node 跑测试，不用开窗口。
 *
 * 这一页和记账完全独立：最高分存在单独的小文件里，玩游戏碰不到账本数据。
 * 唯一的小联动是「记账弹窗挡住了屏幕就自动暂停」，否则蛇会在背后悄悄撞死。
 */

(function (global) {
  'use strict';

  const TT = (global.TT = global.TT || {});
  const { q } = TT.dom;

  // 棋盘相关元素
  const canvas = q('gameCanvas');
  const ctx = canvas.getContext('2d');
  const CELL = canvas.width / SnakeCore.SIZE; // 一格多少像素

  // 记分与遮罩
  const scoreEl = q('gameScore');
  const highEl = q('gameHigh');
  const overlay = q('gameOverlay');
  const overlayTitle = q('gameOverlayTitle');
  const overlayHint = q('gameOverlayHint');
  const startBtn = q('gameStartBtn');

  // 这两个状态缓存起来：按键时每一帧都要判断，不用每次都去 DOM 里找
  const pageEl = q('page-game');
  const modalEl = q('addModal');

  // 本页状态：当前这一局、走步定时器、历史最高分
  let game = null;
  let tickTimer = null;
  let highScore = 0;
  let started = false; // init 只跑一次

  const TICK_MS = 150; // 固定速度：每 150 毫秒走一格

  /* ---------- 声音：用浏览器自带的音频振荡器发声，不下载任何音频文件 ---------- */

  let audioCtx = null;

  /**
   * 响一声
   * @param {number} freq 频率（越大越尖）
   * @param {number} dur 持续秒数
   * @param {string} type 波形：square 方波 / triangle 三角波 / sawtooth 锯齿波
   */
  function beep(freq, dur, type) {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type || 'square';
      osc.frequency.value = freq;
      // 音量做一个「快速起来、慢慢落下」的包络，否则会「啪」一声爆音
      gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.18, audioCtx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + dur);
    } catch (err) {
      // 没声音就安静地玩，不打扰用户
    }
  }

  /** 吃到食物：清脆的叮（800Hz 三角波，0.12 秒） */
  const soundEat = () => beep(800, 0.12, 'triangle');

  /** 游戏结束：低沉一声（220Hz 锯齿波，0.35 秒） */
  const soundOver = () => beep(220, 0.35, 'sawtooth');

  /** 大获全胜：欢快的两声（660Hz 之后接 880Hz） */
  const soundWin = () => {
    beep(660, 0.12, 'triangle');
    setTimeout(() => beep(880, 0.15, 'triangle'), 130);
  };

  /* ---------- 画画面 ---------- */

  // 背景（底色 + 格线）只在启动时画一次存成图片，之后每帧整张贴上去，
  // 不用每 150 毫秒重画一遍格线
  const bgCanvas = document.createElement('canvas');
  bgCanvas.width = canvas.width;
  bgCanvas.height = canvas.height;

  /** 把背景（底色 + 格线）预先画到一张离屏画布上，之后每帧直接贴图 */
  (function drawBackground() {
    const bctx = bgCanvas.getContext('2d');
    bctx.fillStyle = '#f8faf9';
    bctx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
    bctx.strokeStyle = '#e3eae7';
    bctx.lineWidth = 1;
    for (let i = 0; i <= SnakeCore.SIZE; i++) {
      bctx.beginPath(); bctx.moveTo(i * CELL, 0); bctx.lineTo(i * CELL, bgCanvas.height); bctx.stroke();
      bctx.beginPath(); bctx.moveTo(0, i * CELL); bctx.lineTo(bgCanvas.width, i * CELL); bctx.stroke();
    }
  })();

  /**
   * 把这一局画到画布上：食物一个红方块，蛇一串绿方块（头深一档）
   */
  function draw() {
    if (!game) return;
    ctx.drawImage(bgCanvas, 0, 0);

    if (game.food) {
      const fx = game.food.x * CELL;
      const fy = game.food.y * CELL;
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.roundRect(fx + 3, fy + 3, CELL - 6, CELL - 6, 5);
      ctx.fill();
    }

    game.snake.forEach((seg, i) => {
      const isHead = i === 0;
      ctx.fillStyle = isHead ? '#059669' : '#10b981';
      const x = seg.x * CELL;
      const y = seg.y * CELL;
      ctx.beginPath();
      ctx.roundRect(x + 1, y + 1, CELL - 2, CELL - 2, isHead ? 6 : 4);
      ctx.fill();
    });
  }

  /* ---------- 遮罩与分数 ---------- */

  /**
   * 显示中间那块提示（开始/暂停/结束）
   * @param {string} title 大标题
   * @param {string} hint 下面那行小字
   */
  function showOverlay(title, hint) {
    overlayTitle.textContent = title;
    overlayHint.textContent = hint;
    overlay.classList.remove('hidden');
  }

  /** 藏起中间那块提示 */
  function hideOverlay() {
    overlay.classList.add('hidden');
  }

  /** 把当前分数显示到右上角 */
  function updateScore() {
    if (game) scoreEl.textContent = String(game.score);
  }

  /* ---------- 一局的开始与结束 ---------- */

  /** 开一局新的（摆好蛇和食物，等用户按开始） */
  function newGame() {
    stopTick();
    game = SnakeCore.createGame();
    draw();
    showOverlay('贪吃蛇', '按回车键或点下方按钮开始');
    updateScore();
  }

  /** 真正开始跑 */
  function startGame() {
    if (!game) game = SnakeCore.createGame();
    // 上一局已经结束：重开一局，而不是接着死蛇跑
    if (game.status === 'over' || game.status === 'win') game = SnakeCore.createGame();
    game.status = 'playing';
    hideOverlay();
    startTick();
    updateScore();
  }

  /** 启动走步时钟 */
  function startTick() {
    stopTick();
    tickTimer = setInterval(() => {
      if (!game || game.status !== 'playing') return;

      const before = game.score;
      SnakeCore.step(game);
      draw();

      if (game.score > before) {
        updateScore();
        soundEat();
      }

      if (game.status === 'over') {
        stopTick();
        soundOver();
        finish();
      } else if (game.status === 'win') {
        stopTick();
        soundWin();
        finish();
      }
    }, TICK_MS);
  }

  /** 停掉走步时钟 */
  function stopTick() {
    if (tickTimer) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
  }

  /** 暂停（只在正在玩的时候有效） */
  function pause() {
    if (game && game.status === 'playing') {
      game.status = 'paused';
      stopTick();
      showOverlay('已暂停', '按空格键继续');
    }
  }

  /** 继续 */
  function resume() {
    if (game && game.status === 'paused') {
      game.status = 'playing';
      hideOverlay();
      startTick();
    }
  }

  /**
   * 一局结束：破了纪录就存起来。
   * 存失败会如实写在提示里，不假装成功——否则用户下次打开发现纪录没了会很困惑。
   */
  async function finish() {
    const won = game.status === 'win';
    let hint = `本次得分 ${game.score}，按回车键再来一局`;

    if (game.score > highScore) {
      let saved = false;
      try {
        const result = await window.tiantian.setHighScore(game.score);
        saved = !!(result && result.ok);
      } catch (err) {
        // 接口异常按「没存上」处理
      }

      if (saved) {
        highScore = game.score;
        highEl.textContent = String(highScore);
      } else {
        hint = `本次得分 ${game.score}（最高分保存失败，下次打开可能回到旧纪录）`;
      }
    }

    showOverlay(won ? '🎉 大获全胜！' : '游戏结束', hint);
  }

  /* ---------- 键盘 ---------- */

  /**
   * 现在能不能响应按键：必须在小游戏页、没在输入框里打字、记账弹窗也没开着
   * @param {KeyboardEvent} e
   * @returns {boolean}
   */
  function canPlay(e) {
    if (!pageEl.classList.contains('active')) return false;
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return false;
    if (!modalEl.classList.contains('hidden')) return false;
    return true;
  }

  document.addEventListener('keydown', (e) => {
    if (!canPlay(e)) return;

    const key = e.key;

    if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight') {
      e.preventDefault(); // 不然方向键会把页面滚来滚去
      if (!game) return;
      // 暂停时也记下方向，恢复后生效；开局不自动开始，避免第一下按键被吞
      if (game.status === 'playing' || game.status === 'paused') SnakeCore.turn(game, key);
      return;
    }

    if (key === ' ') {
      e.preventDefault();
      if (e.repeat) return; // 按住不放只算一次
      if (!game) return;
      if (game.status === 'playing') pause();
      else if (game.status === 'paused') resume();
      return;
    }

    if (key === 'Enter') {
      e.preventDefault();
      if (e.repeat) return;
      if (!game) return;
      if (game.status === 'paused') resume();
      else if (game.status === 'ready' || game.status === 'over' || game.status === 'win') startGame();
    }
  });

  /* ---------- 离开「能玩的状态」就自动暂停，免得回来发现蛇已经死了 ---------- */

  // 1) 切到别的页面
  TT.dom.qa('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.dataset.page !== 'game' && game && game.status === 'playing') pause();
    });
  });

  // 2) 「记一笔」弹窗盖住屏幕（用 MutationObserver 盯弹窗的 class 变化）
  new MutationObserver(() => {
    if (!modalEl.classList.contains('hidden') && game && game.status === 'playing') pause();
  }).observe(modalEl, { attributes: true, attributeFilter: ['class'] });

  // 3) 窗口被切走 / 最小化 / 看不见
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game && game.status === 'playing') pause();
  });
  window.addEventListener('blur', () => {
    if (game && game.status === 'playing') pause();
  });

  /* ---------- 开始按钮 ---------- */

  startBtn.addEventListener('click', () => {
    if (!game) return;
    if (game.status === 'playing') return; // 正在玩，按钮不打扰
    if (game.status === 'paused') {
      resume();
      return;
    }
    startGame();
  });

  /* ---------- 进页面时初始化（由 app.js 调用，整个软件只调一次） ---------- */

  async function init() {
    if (started) return;
    started = true;

    try {
      highScore = await window.tiantian.getHighScore();
    } catch (err) {
      highScore = 0;
    }

    highEl.textContent = String(highScore);
    newGame();
  }

  TT.pages = TT.pages || {};
  TT.pages.game = { init };
})(window);
