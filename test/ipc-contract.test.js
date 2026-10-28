/**
 * 「接线对不对」考卷 —— 单元测试
 *
 * 运行：node test/ipc-contract.test.js
 *
 * 大白话：界面要办事，得先喊暗号（通道名），主进程照着暗号接。
 * 暗号写在三个地方：清单（main/channels.js）、界面那头（preload.js）、
 * 主进程那头（main/ipc.js）。只要有一处对不上，就会出现
 * 「点了没反应、控制台也不报错」这种最难查的故障。
 *
 * 这个考卷不用开 Electron 窗口，纯读文件 + 一个假的 ipcMain，
 * 就能把「三处暗号是否一致」验得明明白白。
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { CHANNELS } = require('../main/channels');
const ipc = require('../main/ipc');
const db = require('../db');

let passed = 0;

/** 跑一道题 */
function check(name, fn) {
  fn();
  passed += 1;
  console.log('✓', name);
}

/* ---------- 一、清单本身要干净 ---------- */

check('清单里的通道名没有重复', () => {
  assert.strictEqual(new Set(CHANNELS).size, CHANNELS.length);
});

check('通道名都带「谁:干什么」的前缀', () => {
  for (const channel of CHANNELS) {
    assert.ok(/^[a-z]+:[a-zA-Z]+$/.test(channel), `格式不对：${channel}`);
  }
});

/* ---------- 二、界面那头（preload）喊的暗号，必须在清单里 ---------- */

// 从 preload.js 的源码里把 invoke('xxx') 的暗号全抓出来（用读文件的方式，
// 是为了不需要真的启动 Electron 也能检查）
const preloadSource = fs.readFileSync(path.join(__dirname, '..', 'preload.js'), 'utf8');
const invoked = [...preloadSource.matchAll(/ipcRenderer\.invoke\(\s*'([^']+)'/g)].map((m) => m[1]);

check('preload 里至少喊了 10 个暗号（防止正则抓不到东西还“通过”）', () => {
  assert.ok(invoked.length >= 10, `只抓到 ${invoked.length} 个`);
});

check('preload 喊的每个暗号都在清单里（没写错字）', () => {
  const missing = invoked.filter((c) => !CHANNELS.includes(c));
  assert.deepStrictEqual(missing, [], `清单里没有：${missing.join('、')}`);
});

check('清单里每个暗号 preload 都喊了（没有僵尸通道）', () => {
  const unused = CHANNELS.filter((c) => !invoked.includes(c));
  assert.deepStrictEqual(unused, [], `界面没用上：${unused.join('、')}`);
});

check('preload 没有重复喊同一个暗号', () => {
  assert.strictEqual(new Set(invoked).size, invoked.length);
});

check('preload 里没有写死的版本号（版本只能来自 package.json）', () => {
  // 以前这里写着 appVersion: '0.1.0'，跟 package.json 的 0.2.0 对不上，
  // 界面上看到的是个假版本。现在版本统一由主进程 app:getInfo 提供。
  const hardcoded = preloadSource.match(/['"]\d+\.\d+\.\d+['"]/g) || [];
  assert.deepStrictEqual(hardcoded, [], `发现写死的版本号：${hardcoded.join('、')}`);
});

/* ---------- 三、主进程那头：清单里的每个暗号都得有人接 ---------- */

// 假的 ipcMain：只记录「谁被注册了」，不需要真的 Electron
const registered = [];
const fakeIpcMain = {
  handle(channel, handler) {
    assert.strictEqual(typeof handler, 'function', `${channel} 的处理器不是函数`);
    registered.push(channel);
  }
};

const ctx = {
  appInfo: { version: '0.0.0-test', electron: 'test', platform: 'Windows' },
  highScorePath: path.join(__dirname, 'no-such-file.json'),
  exportTo: async () => ({ ok: false, canceled: true })
};

check('注册时不缺任何一条（缺了会直接抛错）', () => {
  const count = ipc.register(fakeIpcMain, ctx);
  assert.strictEqual(count, CHANNELS.length);
});

check('注册的顺序和清单完全一致', () => {
  assert.deepStrictEqual(registered, CHANNELS.slice());
});

/* ---------- 四、账本大门（db/index.js）的接口不能少 ---------- */

check('账本模块对外暴露的方法齐全（重构时没弄丢）', () => {
  const expected = [
    'open', 'init', 'close', 'schemaVersion',
    'addRecord', 'getRecordById', 'getRecentRecords', 'getRecordsByMonth',
    'getAllRecords', 'updateRecord', 'deleteRecord',
    'getMonthlySummary', 'getCategoryTotals', 'getMonthlyTrendRange', 'getDateRange'
  ];
  for (const name of expected) {
    assert.strictEqual(typeof db[name], 'function', `少了 ${name}`);
  }
});

console.log(`\n${passed} 项测试全部通过`);
