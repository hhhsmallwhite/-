/**
 * 天天记账 —— 界面冒烟测试（在真的 Electron 渲染引擎里跑）
 *
 * 大白话：单元测试只能考「纯逻辑」那些零件（账本、贪吃蛇规则）。
 * 但界面（renderer）是 900 多行 DOM 代码，光靠 node 跑不起来，
 * 以前每次改界面只能靠人眼看。这个文件就是补上这个缺口：
 *
 *   开一个「看不见的窗口」（离屏渲染，不弹到屏幕上）→ 装进真正的 index.html
 *   → 用脚本点遍五个页面 → 每一步截一张图 → 顺便检查关键数字/图表有没有出来
 *   → 最后打印成绩单，有问题就报错退出。
 *
 * 运行方式（必须在项目根目录）：
 *   ./node_modules/.bin/electron --disable-gpu test/ui-smoke.js
 * 截图会存到 test/artifacts/ 里，人眼也可以打开看。
 *
 * 安全红线：窗口用的是「假桥」和内存数据（src/dev-mock.js），
 * 全程不碰你电脑上真实的账本文件（tiantian.db）。
 */

const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

const ROOT = path.join(__dirname, '..');
const ARTIFACTS = path.join(__dirname, 'artifacts');
const UI_FILE = path.join(ROOT, 'src', 'index.html');
const MOCK_BRIDGE = path.join(ROOT, 'src', 'dev-mock.js');

// 把 Electron 自己的缓存/数据都丢到临时文件夹，绝不碰真实用户目录
const tmpUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'tiantian-ui-'));
app.setPath('userData', tmpUserData);
app.disableHardwareAcceleration();

/** 等一会儿（毫秒）。界面里的数据是异步取回来的，点完要给它时间刷 */
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 收集渲染进程里的报错（控制台 error 级别 + 页面崩了 + 加载失败） */
const problems = [];
/** 每条断言的结果 */
const checks = [];
/** 截图张数，打印成绩单时用 */
let shotCount = 0;

/** 记一条断言结果 */
function check(name, ok, detail) {
  checks.push({ name, ok, detail });
}

/** 给窗口拍一张照，存进 test/artifacts/ */
async function shoot(win, name) {
  const image = await win.webContents.capturePage();
  const file = path.join(ARTIFACTS, `${name}.png`);
  fs.writeFileSync(file, image.toPNG());
  shotCount += 1;
  return file.size ? file : null;
}

/** 在页面里执行一小段代码，把结果拿回来 */
function run(win, code) {
  return win.webContents.executeJavaScript(code, true);
}

/** 主流程：建窗口 → 加载界面 → 逐页检查 → 交成绩单 */
async function main() {
  fs.mkdirSync(ARTIFACTS, { recursive: true });

  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    show: false,
    webPreferences: {
      // 用「假桥」当 preload：接口名字跟真的一模一样，数据在内存里
      preload: MOCK_BRIDGE,
      contextIsolation: true,
      nodeIntegration: false,
      // 离屏渲染：不弹窗，也能正常画出来、能截图
      offscreen: true
    }
  });

  // 控制台里的 error（level 3）算问题；warning 只记录不判失败
  win.webContents.on('console-message', (_event, level, message) => {
    if (level >= 3) problems.push(`控制台报错：${message}`);
  });
  win.webContents.on('render-process-gone', (_event, details) => {
    problems.push(`渲染进程崩了：${details.reason}`);
  });
  win.webContents.on('did-fail-load', (_event, code, desc) => {
    problems.push(`界面加载失败：${code} ${desc}`);
  });

  await win.loadFile(UI_FILE);
  // 加载完成后再多等一会儿，让首页的异步数据回来、图表画出来
  await wait(600);

  /* ---------- 一、开工前的底子：桥接和首页数字 ---------- */

  const bridgeOk = await run(win, 'typeof window.tiantian === "object" && typeof window.tiantian.addRecord === "function"');
  check('假桥挂载成功，界面能拿到 window.tiantian', bridgeOk === true);

  const overview = await run(win, `({
    expense: document.getElementById('statExpense').textContent,
    income: document.getElementById('statIncome').textContent,
    balance: document.getElementById('statBalance').textContent,
    recent: document.querySelectorAll('#recentList li').length,
    month: document.getElementById('overviewMonth').textContent
  })`);
  check('概览页本月支出有真实数字', overview.expense !== '0.00' && overview.expense !== '', overview.expense);
  check('概览页本月收入有真实数字', overview.income !== '0.00' && overview.income !== '', overview.income);
  check('概览页月份标题已填', /\d{4}年\d{1,2}月/.test(overview.month), overview.month);
  check('概览页「最近记录」至少 1 条', overview.recent >= 1, `${overview.recent} 条`);
  await shoot(win, '1-overview');

  /* ---------- 二、账单页：列表、筛选、搜索 ---------- */

  await run(win, 'document.querySelector(\'.nav-item[data-page="bills"]\').click(); true');
  await wait(400);
  const bills = await run(win, `({
    label: document.getElementById('billMonthLabel').textContent,
    rows: document.querySelectorAll('#billList .bill-row, #billList li').length,
    cats: document.querySelectorAll('#billCatFilter option').length
  })`);
  check('账单页月份标题已填', /\d{4}年\d{1,2}月/.test(bills.label), bills.label);
  check('账单页列出了当月记录', bills.rows >= 1, `${bills.rows} 行`);
  check('账单页分类下拉框已填充', bills.cats >= 10, `${bills.cats} 个选项`);
  await shoot(win, '2-bills');

  // 搜索备注：搜「食堂」应该只剩 7 月那条；当前月没有就应该是空态
  await run(win, `(() => {
    const el = document.getElementById('billSearch');
    el.value = '不存在的备注关键字';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await wait(250);
  const searched = await run(win, `({
    emptyShown: !document.getElementById('billEmpty').classList.contains('hidden'),
    rows: document.querySelectorAll('#billList .bill-row, #billList li').length
  })`);
  check('搜索无结果时显示空状态', searched.emptyShown === true && searched.rows === 0);
  await run(win, `(() => {
    const el = document.getElementById('billSearch');
    el.value = '';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await wait(200);

  /* ---------- 三、统计页：三个环形图 + 趋势柱状图 ---------- */

  await run(win, 'document.querySelector(\'.nav-item[data-page="stats"]\').click(); true');
  await wait(500);
  const stats = await run(win, `({
    donuts: document.querySelectorAll('#statsDonut svg, #statsDonutIncome svg, #statsBalanceDonut svg').length,
    arcs: document.querySelectorAll('#statsDonut circle').length,
    bars: document.querySelectorAll('#statsTrend path').length,
    expense: document.getElementById('statsExpense').textContent
  })`);
  check('统计页三个环形图都画出来了', stats.donuts === 3, `${stats.donuts} 个`);
  check('支出环形图有分类弧段', stats.arcs >= 2, `${stats.arcs} 段`);
  check('趋势柱状图有柱子', stats.bars >= 4, `${stats.bars} 个图形`);
  await shoot(win, '3-stats');

  /* ---------- 四、设置页 + 导出按钮 ---------- */

  await run(win, 'document.querySelector(\'.nav-item[data-page="settings"]\').click(); true');
  await wait(250);
  const settings = await run(win, '!!document.getElementById("exportCsvBtn") && !document.getElementById("page-settings").classList.contains("hidden")');
  check('设置页能打开、导出按钮在', settings === true);
  await shoot(win, '4-settings');

  /* ---------- 五、小游戏页：画布 + 最高分 ---------- */

  await run(win, 'document.querySelector(\'.nav-item[data-page="game"]\').click(); true');
  await wait(350);
  const game = await run(win, `({
    canvas: !!document.getElementById('gameCanvas'),
    w: document.getElementById('gameCanvas').width,
    high: document.getElementById('gameHigh').textContent,
    score: document.getElementById('gameScore').textContent
  })`);
  check('小游戏画布存在且尺寸正常', game.canvas === true && game.w === 400, `${game.w}px`);
  check('小游戏分数区已初始化', game.score === '0' && game.high !== '', `当前 ${game.score} / 最高 ${game.high}`);
  await shoot(win, '5-game');

  /* ---------- 六、记一笔：开弹窗 → 填金额 → 保存 → 首页应该多一条 ---------- */

  await run(win, 'document.getElementById("openAddBtn").click(); true');
  await wait(250);
  const modalOpen = await run(win, '!document.getElementById("addModal").classList.contains("hidden")');
  check('点「记一笔」能打开弹窗', modalOpen === true);
  await shoot(win, '6-add-modal');

  const before = await run(win, 'document.querySelectorAll("#recentList li").length');
  await run(win, `(() => {
    const amount = document.getElementById('amountInput');
    amount.value = '18.88';
    document.getElementById('noteInput').value = '冒烟测试';
    document.getElementById('catGrid').querySelector('button').click();
    document.getElementById('saveBtn').click();
    return true;
  })()`);
  await wait(500);
  const after = await run(win, `({
    rows: document.querySelectorAll('#recentList li').length,
    toast: document.getElementById('toast').textContent,
    modalClosed: document.getElementById('addModal').classList.contains('hidden')
  })`);
  check('保存后弹窗自动关闭', after.modalClosed === true);
  check('保存后弹出成功提示', /已保存/.test(after.toast), after.toast);
  check('保存后首页最近记录有刷新', after.rows >= Math.min(before + 1, 5), `${before} → ${after.rows} 条`);
  await shoot(win, '7-after-save');

  /* ---------- 七、账单页删除/修改入口（只检查按钮在，不真删） ---------- */

  await run(win, 'document.querySelector(\'.nav-item[data-page="bills"]\').click(); true');
  await wait(400);
  const billActions = await run(win, `document.querySelectorAll('#billList button').length`);
  check('账单每一行都有操作按钮（改/删）', billActions >= 2, `${billActions} 个按钮`);

  win.destroy();
  return { problems, checks, shotCount };
}

/* ---------- 启动 + 兜底超时 ---------- */

// 60 秒还没跑完就判定失败，避免这个进程挂着不走
const guard = setTimeout(() => {
  problems.push('冒烟测试超时（60 秒），可能是界面卡住或某个页面报错');
  finish();
}, 60000);

let finished = false;

/** 打印成绩单并退出：有失败项就返回 1 */
function finish() {
  if (finished) return;
  finished = true;
  clearTimeout(guard);

  const failed = checks.filter((c) => !c.ok);

  console.log('\n=== 界面冒烟测试 · 成绩单 ===');
  for (const c of checks) {
    console.log(`${c.ok ? '✓' : '✗'} ${c.name}${c.detail ? '（' + c.detail + '）' : ''}`);
  }
  console.log(`\n截图：${shotCount} 张，存在 test/artifacts/`);

  if (problems.length) {
    console.log('\n=== 页面里发现的问题 ===');
    for (const p of problems) console.log('! ' + p);
  }

  const ok = failed.length === 0 && problems.length === 0;
  console.log(`\n${ok ? '全部通过' : '有 ' + (failed.length + problems.length) + ' 项没过'}：${checks.length - failed.length}/${checks.length} 项断言通过\n`);
  app.exit(ok ? 0 : 1);
}

app.whenReady().then(() => {
  main()
    .then((result) => {
      problems.push(...result.problems);
      finish();
    })
    .catch((err) => {
      problems.push('冒烟测试自己出错了：' + (err && err.message ? err.message : String(err)));
      finish();
    });
});

// 窗口全关了也别自动退出，交给 finish() 决定退出码
app.on('window-all-closed', () => {});
