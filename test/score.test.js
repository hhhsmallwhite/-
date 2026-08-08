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

// 考完退出前，把临时文件夹删掉，不给系统留垃圾
process.on('exit', () => {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* 删不掉也不管 */ }
});

let passed = 0;
function check(name, fn) { fn(); passed++; console.log('✓', name); }

check('文件不存在 → 读回 0', () => {
  assert.strictEqual(readHighScore(file), 0);
});

check('写入 5 → 返回 { ok: true, value: 5 }，再读回 5', () => {
  assert.deepStrictEqual(writeHighScore(file, 5), { ok: true, value: 5 });
  assert.strictEqual(readHighScore(file), 5);
});

check('负数 → 按 0 存', () => {
  assert.deepStrictEqual(writeHighScore(file, -3), { ok: true, value: 0 });
});

check('小数 → 向下取整 12', () => {
  assert.deepStrictEqual(writeHighScore(file, 12.8), { ok: true, value: 12 });
  assert.strictEqual(readHighScore(file), 12);
});

check('文件内容损坏 → 读回 0', () => {
  fs.writeFileSync(file, 'not json');   // 先把文件写坏
  assert.strictEqual(readHighScore(file), 0);
});

check('写失败如实报告：建不了目录 → 返回 { ok: false, value: 3 }', () => {
  const blocker = path.join(dir, 'blocker');
  fs.writeFileSync(blocker, 'x');   // 用一个文件占住父目录的位置
  assert.deepStrictEqual(writeHighScore(path.join(blocker, 'sub', 'x.json'), 3), { ok: false, value: 3 });
});

console.log(`\n${passed} 项测试全部通过`);
