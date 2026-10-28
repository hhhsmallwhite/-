/**
 * 界面装配（src/index.html 的 script 标签）考卷 —— 单元测试
 *
 * 运行：node test/renderer-manifest.test.js
 *
 * 大白话：这个项目故意不用打包工具，界面靠 index.html 里十几个 <script> 按顺序拼起来。
 * 好处是「改完刷新就能看」，代价是——顺序就是承重墙：lib 必须排在 pages 前面，
 * snake-core 必须排在 game 页前面，app.js 必须最后。少一个文件、顺序错一格，
 * 症状都是「某个按钮点了没反应」，而不是「少了个文件」，极难查。
 *
 * 这本考卷就是在改坏的那一刻拦住你：不加载界面、不开 Electron，纯读文件就能判断。
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

let passed = 0;

/** 跑一道题 */
function check(name, fn) {
  fn();
  passed += 1;
  console.log('✓', name);
}

const SRC = path.join(__dirname, '..', 'src');
const HTML = path.join(SRC, 'index.html');
const html = fs.readFileSync(HTML, 'utf8');

// 把 <script src="..."> 里的路径按出现顺序抓出来
const scripts = [...html.matchAll(/<script\s+src="([^"]+)"/g)].map((m) => m[1]);

/* ---------- 一、引用的文件都得真实存在 ---------- */

check('index.html 至少引用了 12 个脚本（防止正则抓空还判通过）', () => {
  assert.ok(scripts.length >= 12, `只抓到 ${scripts.length} 个`);
});

check('引用的每个脚本文件都真实存在（写错文件名会在这里红）', () => {
  const missing = scripts.filter((src) => !fs.existsSync(path.join(SRC, src)));
  assert.deepStrictEqual(missing, [], `不存在：${missing.join('、')}`);
});

check('没有引入外网脚本（项目承诺完全离线）', () => {
  const remote = scripts.filter((src) => /^(https?:)?\/\//.test(src));
  assert.deepStrictEqual(remote, [], `外链：${remote.join('、')}`);
});

/* ---------- 二、顺序：先工具、再零件、最后装配 ---------- */

/**
 * 给每个脚本定一个「层号」，层号只能往后走，不能回头。
 * 这就是加载顺序的规则本身，写在这里等于把规矩立成明文。
 * @param {string} src
 * @returns {number}
 */
function layerOf(src) {
  if (src === 'dev-mock.js') return 0; // 假桥最先，正式环境它会自己让位
  if (src.startsWith('lib/')) return 1; // 公用工具：谁都要用
  if (src === 'snake-core.js') return 2; // 纯规则，game 页要用
  if (src.startsWith('pages/')) return 3; // 五个页面
  if (src.startsWith('features/')) return 4; // 跨页面的功能块（记一笔弹窗）
  if (src === 'app.js') return 5; // 总调度，必须最后
  return -1; // 认不出来的文件 → 下面会报
}

check('每个脚本都能归到一个已知的层（放错目录会在这里红）', () => {
  const unknown = scripts.filter((src) => layerOf(src) < 0);
  assert.deepStrictEqual(unknown, [], `不知道该排在哪：${unknown.join('、')}`);
});

check('层号只增不减（lib 在 pages 前、core 在 game 前）', () => {
  let last = -1;
  for (const src of scripts) {
    const layer = layerOf(src);
    assert.ok(layer >= last, `顺序错了：${src} 排在前一层之后却属于更靠前的层`);
    last = layer;
  }
});

check('app.js 是最后一个（它一执行就要叫醒所有页面）', () => {
  assert.strictEqual(scripts[scripts.length - 1], 'app.js');
});

check('dev-mock.js 排在 app.js 之前（否则启动时接口还没挂上）', () => {
  assert.ok(scripts.indexOf('dev-mock.js') < scripts.indexOf('app.js'));
});

/* ---------- 三、没有孤儿文件：src 下的 js 都得被用上 ---------- */

/**
 * 递归列出 src 下所有 js（相对 src 的路径）
 * @param {string} dir
 * @param {string} [prefix]
 * @returns {string[]}
 */
function listJs(dir, prefix = '') {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...listJs(path.join(dir, entry.name), rel));
    else if (entry.name.endsWith('.js')) out.push(rel);
  }
  return out;
}

const onDisk = listJs(SRC).filter((f) => !f.endsWith('index.html'));

check('src 下的每个 js 都被 index.html 引用了（没有写了却忘了加载的文件）', () => {
  const orphans = onDisk.filter((f) => !scripts.includes(f));
  assert.deepStrictEqual(orphans, [], `没被加载：${orphans.join('、')}`);
});

/* ---------- 四、页面模块挂的名字要和文件名对得上 ---------- */

check('每个 pages/xxx.js 挂的是 TT.pages.xxx（复制文件改名后忘改名字会在这里红）', () => {
  for (const src of scripts.filter((s) => s.startsWith('pages/'))) {
    const name = path.basename(src, '.js');
    const code = fs.readFileSync(path.join(SRC, src), 'utf8');
    assert.ok(new RegExp(`TT\\.pages\\.${name}\\s*=`).test(code), `${src} 里没有挂 TT.pages.${name}`);
  }
});

check('features/add-record.js 挂的是 TT.features.addRecord', () => {
  const code = fs.readFileSync(path.join(SRC, 'features/add-record.js'), 'utf8');
  assert.ok(/TT\.features\.addRecord\s*=/.test(code));
});

check('每个页面都导出了 load 或 init（app.js 靠这个叫醒它）', () => {
  for (const src of scripts.filter((s) => s.startsWith('pages/'))) {
    const code = fs.readFileSync(path.join(SRC, src), 'utf8');
    assert.ok(/=\s*\{\s*(load|init)/.test(code), `${src} 没有导出 load/init`);
  }
});

console.log(`\n${passed} 项测试全部通过`);
