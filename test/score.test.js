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

assert.strictEqual(readHighScore(file), 0);            // 文件不存在 → 0
assert.deepStrictEqual(writeHighScore(file, 5), { ok: true, value: 5 });    // 写入 5
assert.strictEqual(readHighScore(file), 5);            // 读回 5
assert.deepStrictEqual(writeHighScore(file, -3), { ok: true, value: 0 });   // 负数 → 0
assert.deepStrictEqual(writeHighScore(file, 12.8), { ok: true, value: 12 }); // 小数 → 取整 12
assert.strictEqual(readHighScore(file), 12);
fs.writeFileSync(file, 'not json');                    // 文件坏了
assert.strictEqual(readHighScore(file), 0);            // 坏文件 → 0

// 写失败要如实报告：父目录的位置被一个文件占着，建不了目录 → 返回 { ok: false }
const blocker = path.join(dir, 'blocker');
fs.writeFileSync(blocker, 'x');
assert.deepStrictEqual(writeHighScore(path.join(blocker, 'sub', 'x.json'), 3), { ok: false, value: 3 });

console.log('✓ 最高分读写测试全部通过');
