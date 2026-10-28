/**
 * 天天记账 —— 整机启动测试（在真的 Electron 里跑一次「开机」）
 *
 * 运行：./node_modules/.bin/electron --disable-gpu test/app-boot.test.js
 *
 * 大白话：前面的测试分两种——纯逻辑的用 node 考，界面的用假数据考。
 * 但两者中间那段（真 preload → 真通道 → 真数据库）一直没人验过。
 * 这个文件就把整机开一次机：用临时文件夹当用户目录、打开一本临时账本、
 * 真的从界面调接口记一笔，再看数据库里是不是真有这一笔。
 *
 * 它专门盯住几个「重构最容易弄坏、又最不容易发现」的地方：
 *   1. 版本号是不是真的从 package.json 来（而不是又写死了一个）；
 *   2. 界面 → preload → 主进程 → SQLite 这条路通不通；
 *   3. 检查站（validate）拦不拦得住歪数据；
 *   4. 账本结构有没有升级到最新（迁移跑没跑）。
 *
 * 安全红线：userData 和 appData 都指向本次新建的临时文件夹，启动时把
 * 「老账本搬家」那条路彻底堵死（它找不到旧目录，自然什么都不会拷）。
 * 全程不读不写你电脑上真实的 tiantian.db。
 */

const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

// 临时「用户目录」：账本、缓存、配置全落在这里，测完删
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tiantian-boot-'));
app.setPath('appData', tmp); // 先改 appData，userData 默认在它下面
app.setPath('userData', path.join(tmp, 'profile'));
app.disableHardwareAcceleration();

const db = require('../db');
const { bootstrap } = require('../main/app');
const pkg = require('../package.json');

const checks = [];
const problems = [];

/** 记一条断言 */
function check(name, ok, detail) {
  checks.push({ name, ok, detail });
}

/** 等一下 */
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 在主窗口里执行一段代码 */
async function runInWindow(win, code) {
  return win.webContents.executeJavaScript(code, true);
}

/**
 * 等主窗口出来（bootstrap 里是同步创建的，但为了稳妥还是找一下）
 * @returns {BrowserWindow}
 */
async function waitForWindow() {
  for (let i = 0; i < 50; i++) {
    const wins = BrowserWindow.getAllWindows();
    if (wins.length) return wins[0];
    await wait(100);
  }
  throw new Error('等不到主窗口');
}

/** 主流程：开机 → 走真实用户路径记一笔 → 逐项核对数据库与界面 */
async function main() {
  // 真的跑一次开机流程：打开账本 → 注册通道 → 开窗口
  bootstrap();

  const win = await waitForWindow();

  // 页面里的报错都要记下来（有报错就说明接线有问题）
  win.webContents.on('console-message', (_event, level, message) => {
    if (level >= 3) problems.push(`界面报错：${message}`);
  });

  if (win.webContents.isLoading()) {
    await new Promise((resolve) => win.webContents.once('did-finish-load', resolve));
  }
  await wait(800); // 等首页把数据取回来、画完

  /* ---------- 一、账本真的开了，而且结构是最新的 ---------- */

  check('账本文件建在临时目录里（没碰真实账本）', fs.existsSync(path.join(tmp, 'profile', 'tiantian.db')));
  check('账本结构已升级到最新（迁移跑过了）', db.schemaVersion() === 2, `当前版本 ${db.schemaVersion()}`);
  check('临时账本一开始是空的', db.getAllRecords().length === 0);

  /* ---------- 二、真 preload 挂上了，接口齐全 ---------- */

  const bridge = await runInWindow(win, `({
    exists: typeof window.tiantian === 'object',
    methods: Object.keys(window.tiantian).sort()
  })`);

  const required = ['addRecord', 'deleteRecord', 'exportCsv', 'getAppInfo', 'getCategoryTotals',
    'getDateRange', 'getHighScore', 'getMonthlySummary', 'getMonthlyTrend', 'getRecentRecords',
    'getRecordsByMonth', 'setHighScore', 'updateRecord'];
  const missing = required.filter((m) => !bridge.methods.includes(m));
  check('真 preload 挂上了 window.tiantian', bridge.exists === true);
  check('13 个接口一个不少', missing.length === 0, missing.length ? `缺 ${missing.join('、')}` : '全在');

  /* ---------- 三、版本号来自 package.json，不是写死的 ---------- */

  const info = await runInWindow(win, 'window.tiantian.getAppInfo()');
  check('版本号 = package.json 里的版本', info.version === pkg.version, `界面拿到 ${info.version}，包里是 ${pkg.version}`);
  check('软件信息带上了 Electron 版本', typeof info.electron === 'string' && info.electron.length > 0, info.electron);

  /* ---------- 四、走真实用户路径记一笔：点开弹窗 → 填金额 → 保存 ---------- */

  await runInWindow(win, 'document.getElementById("openAddBtn").click(); true');
  await wait(200);
  await runInWindow(win, `(() => {
    document.getElementById('amountInput').value = '18.88';
    document.getElementById('noteInput').value = '整机测试';
    document.querySelector('#catGrid button').click();
    document.getElementById('saveBtn').click();
    return true;
  })()`);
  await wait(600); // 等保存完 + 各页面刷新

  const saved = db.getAllRecords();
  check('从界面点「保存」后，账本里真的多了一条', saved.length === 1 && saved[0].amountCents === 1888, `共 ${saved.length} 条`);
  check('金额按「分」存、取出来「元」也对得上', saved[0].amount === 18.88);
  check('备注原样存进去了', saved[0].note === '整机测试');

  // 保存成功后 refreshAll 应该已经让首页跟着变了（不用手动刷新）
  const shown = await runInWindow(win, `({
    expense: document.getElementById('statExpense').textContent,
    recent: document.querySelectorAll('#recentList li').length,
    empty: !document.getElementById('recentEmpty').classList.contains('hidden'),
    modalClosed: document.getElementById('addModal').classList.contains('hidden')
  })`);
  check('首页支出卡片自动变成 18.88', shown.expense === '18.88', shown.expense);
  check('首页最近记录自动出现这一笔', shown.recent === 1 && shown.empty === false);
  check('保存后弹窗自动关闭', shown.modalClosed === true);

  /* ---------- 五、检查站拦得住歪数据 ---------- */

  let rejected = false;
  try {
    await runInWindow(win, `window.tiantian.addRecord({ type: 'expense', amountCents: -100, categoryMain: '餐饮美食', categorySub: '午餐', date: '2026-10-28' })`);
  } catch (err) {
    rejected = true;
  }
  check('负数金额被主进程拦下（没进账本）', rejected === true && db.getAllRecords().length === 1);

  let badTypeRejected = false;
  try {
    await runInWindow(win, `window.tiantian.addRecord({ type: '转账', amountCents: 100, categoryMain: '餐饮美食', categorySub: '午餐', date: '2026-10-28' })`);
  } catch (err) {
    badTypeRejected = true;
  }
  check('乱填的收支类型被拦下', badTypeRejected === true);

  /* ---------- 六、统计与趋势接口也能用（真 SQL 跑一遍） ---------- */

  const summary = await runInWindow(win, 'window.tiantian.getMonthlySummary(2026, 10)');
  check('月度汇总：支出 1888 分、收入 0', summary.expense === 1888 && summary.income === 0);

  const trend = await runInWindow(win, 'window.tiantian.getMonthlyTrend(2026, 8, 2026, 10)');
  check('趋势接口返回 3 个月', Array.isArray(trend) && trend.length === 3, `${trend.length} 个月`);

  const range = await runInWindow(win, 'window.tiantian.getDateRange()');
  check('日期范围接口拿到 2026-10-28', range && range.minDate === '2026-10-28');

  /* ---------- 七、最高分小文件独立读写 ---------- */

  await runInWindow(win, 'window.tiantian.setHighScore(7)');
  const high = await runInWindow(win, 'window.tiantian.getHighScore()');
  check('最高分能存能读（7 分）', high === 7);
  check('最高分存在单独的小文件里，不是账本', fs.existsSync(path.join(tmp, 'profile', 'snake_highscore.json')));

  win.destroy();
}

/* ---------- 启动 + 兜底 ---------- */

let finished = false;

/** 交成绩单并退出 */
function finish() {
  if (finished) return;
  finished = true;

  const failed = checks.filter((c) => !c.ok);

  console.log('\n=== 整机启动测试 · 成绩单 ===');
  for (const c of checks) {
    console.log(`${c.ok ? '✓' : '✗'} ${c.name}${c.detail ? '（' + c.detail + '）' : ''}`);
  }
  if (problems.length) {
    console.log('\n=== 界面报错 ===');
    for (const p of problems) console.log('! ' + p);
  }

  const ok = failed.length === 0 && problems.length === 0;
  console.log(`\n${ok ? '全部通过' : '有 ' + (failed.length + problems.length) + ' 项没过'}：${checks.length - failed.length}/${checks.length} 项断言通过\n`);

  // 收摊：关账本、删临时目录
  try { db.close(); } catch (err) { /* 已经关了就算了 */ }
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (err) { /* 删不掉也不影响结论 */ }

  app.exit(ok ? 0 : 1);
}

const guard = setTimeout(() => {
  problems.push('整机测试超时（60 秒）');
  finish();
}, 60000);

app.whenReady().then(() => {
  main()
    .then(finish)
    .catch((err) => {
      problems.push('测试自己出错：' + (err && err.stack ? err.stack : String(err)));
      finish();
    });
});

app.on('window-all-closed', () => {});
process.on('exit', () => clearTimeout(guard));
