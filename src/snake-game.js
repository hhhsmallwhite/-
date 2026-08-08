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
const pageGameEl = document.getElementById('page-game');   // 小游戏页面（缓存，按键时不用重新找）
const addModalEl = document.getElementById('addModal');    // 「记一笔」弹窗（缓存，判断是否挡着屏）

// 记账弹窗是否开着（弹窗挡着就不能操作蛇）
function isModalOpen() { return !addModalEl.classList.contains('hidden'); }

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
const soundWin = () => { beep(660, 0.12, 'triangle'); setTimeout(() => beep(880, 0.15, 'triangle'), 130); };  // 胜利：欢快的两声

/* ---------- 画画面 ---------- */
// 背景（底色 + 浅格线）只在启动时画一次存起来，之后每帧直接整张贴上去，
// 不用每 150ms 重新一条条画格线（省一点点时间，肉眼看不出差别，图个省心）。
const bgCanvas = document.createElement('canvas');
bgCanvas.width = canvas.width;
bgCanvas.height = canvas.height;
(function () {
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

function draw() {
  if (!game) return;
  ctx.drawImage(bgCanvas, 0, 0);

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
    if (game.status === 'over') {
      stopTick();
      soundOver();
      finishGame();
    } else if (game.status === 'win') {
      stopTick();
      soundWin();
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
  let hint = `本次得分 ${game.score}，按回车键再来一局`;

  // 破了纪录就更新并保存；存失败就如实说，不假装存好了
  if (game.score > highScore) {
    let saved = false;
    try {
      const res = await window.tiantian.setHighScore(game.score);
      saved = !!(res && res.ok);
    } catch (e) { /* 接口异常按没存上处理 */ }
    if (saved) {
      highScore = game.score;
      gameHighEl.textContent = String(highScore);
    } else {
      hint = `本次得分 ${game.score}（最高分保存失败，下次打开可能回到旧纪录）`;
    }
  }

  setOverlay(won ? '🎉 大获全胜！' : '游戏结束', hint);
}

/* ---------- 键盘操作 ---------- */
document.addEventListener('keydown', (e) => {
  // 只在「小游戏」页、没在打字、没开着记账弹窗时响应
  if (!pageGameEl.classList.contains('active')) return;
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
  if (isModalOpen()) return;

  const k = e.key;

  if (k === 'ArrowUp' || k === 'ArrowDown' || k === 'ArrowLeft' || k === 'ArrowRight') {
    e.preventDefault();                 // 防止方向键滚动页面
    if (!game) return;
    // 游戏中或暂停时按方向键：记下方向（暂停时也记住，恢复后生效）。
    // 开局不自动开始（按回车或点按钮才开始），避免"第一下方向键被吞 + 误开局"。
    if (game.status === 'playing' || game.status === 'paused') SnakeCore.turn(game, k);
    return;
  }
  if (k === ' ') {                      // 空格：暂停 / 继续（按住连发只算一次）
    e.preventDefault();
    if (e.repeat) return;
    if (!game) return;
    if (game.status === 'playing') pauseGame();
    else if (game.status === 'paused') resumeGame();
    return;
  }
  if (k === 'Enter') {                  // 回车：开始 / 继续 / 再来一局（连发只算一次）
    e.preventDefault();
    if (e.repeat) return;
    if (!game) return;
    if (game.status === 'paused') resumeGame();
    else if (game.status === 'ready' || game.status === 'over' || game.status === 'win') startGame();
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

/* ---------- 离开"能玩的状态"就自动暂停 ---------- */
// 1) 切到别的页面：蛇还在走就自动暂停
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.dataset.page !== 'game' && game && game.status === 'playing') pauseGame();
  });
});
// 2) 打开「记一笔」弹窗：弹窗挡住屏幕，蛇必须停下，否则会悄悄撞死
new MutationObserver(() => {
  if (isModalOpen() && game && game.status === 'playing') pauseGame();
}).observe(addModalEl, { attributes: true, attributeFilter: ['class'] });
// 3) 窗口被切走 / 最小化 / 看不见：自动暂停，回来不会发现蛇死了
document.addEventListener('visibilitychange', () => {
  if (document.hidden && game && game.status === 'playing') pauseGame();
});
window.addEventListener('blur', () => {
  if (game && game.status === 'playing') pauseGame();
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
