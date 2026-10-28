/**
 * 路径与旧账本搬家（main/paths.js）考卷 —— 单元测试
 *
 * 运行：node test/paths.test.js
 *
 * 大白话：这个文件里有个特别要命的函数——migrateLegacy。
 * 它只在「老用户第一次打开新版软件」时跑一次：软件原名「黑马记账」，
 * 改名叫「天天记账」后，账本要能从旧文件夹搬到新文件夹。
 * 这段代码写错了，用户看到的现象是「我的账全没了」，而且是不可逆的。
 * 所以它必须有测试——哪怕逻辑只有十行。
 *
 * 安全红线：全部在系统临时目录里造文件夹，考完删掉，不碰真实的 AppData。
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const paths = require('../main/paths');

let passed = 0;

/** 跑一道题 */
function check(name, fn) {
  fn();
  passed += 1;
  console.log('✓', name);
}

// 一个一次性的「假的 AppData」，里面再分 userData
const appData = fs.mkdtempSync(path.join(os.tmpdir(), 'tiantian-paths-'));
const userData = path.join(appData, '天天记账');

process.on('exit', () => {
  try {
    fs.rmSync(appData, { recursive: true, force: true });
  } catch (err) {
    // 删不掉不影响结论
  }
});

/** 假的 app 对象：只需要 getPath 能回答两个名字 */
const fakeApp = {
  getPath(name) {
    if (name === 'appData') return appData;
    if (name === 'userData') return userData;
    throw new Error(`测试没准备这个路径：${name}`);
  }
};

/* ---------- 一、四类文件都在哪儿 ---------- */

check('账本在 userData 目录下，叫 tiantian.db', () => {
  assert.strictEqual(paths.dbPath(fakeApp), path.join(userData, 'tiantian.db'));
});

check('最高分小文件也在 userData 下，跟账本分开', () => {
  assert.strictEqual(paths.highScorePath(fakeApp), path.join(userData, 'snake_highscore.json'));
});

check('备份在 userData/backups 下', () => {
  assert.strictEqual(paths.backupDir(fakeApp), path.join(userData, 'backups'));
});

check('日志在 userData/logs 下', () => {
  assert.strictEqual(paths.logsDir(fakeApp), path.join(userData, 'logs'));
});

/* ---------- 二、旧账本搬家 ---------- */

const legacyDir = path.join(appData, '黑马记账');
const legacyFile = path.join(legacyDir, 'blackhorse.db');
const target = paths.dbPath(fakeApp);

check('新用户（既没有新账本也没有旧账本）：什么都不做', () => {
  assert.strictEqual(paths.migrateLegacy(fakeApp, target), false);
  assert.strictEqual(fs.existsSync(target), false);
});

check('老用户（旧账本在、新位置还没有）：复制过来，返回 true', () => {
  fs.mkdirSync(legacyDir, { recursive: true });
  fs.writeFileSync(legacyFile, 'SQLite format 3\u0000假的账本内容');

  assert.strictEqual(paths.migrateLegacy(fakeApp, target), true);
  assert.strictEqual(fs.existsSync(target), true);
});

check('搬过来的内容和旧账本一模一样（没被截断、没被改写）', () => {
  assert.strictEqual(fs.readFileSync(target, 'utf8'), fs.readFileSync(legacyFile, 'utf8'));
});

check('是「复制」不是「搬走」：旧文件还在（万一新位置出事还有退路）', () => {
  assert.strictEqual(fs.existsSync(legacyFile), true);
});

check('新位置已经有账本了：绝不再覆盖（否则用户新记的账会被老账本盖掉）', () => {
  fs.writeFileSync(target, '新账本的内容');
  assert.strictEqual(paths.migrateLegacy(fakeApp, target), false);
  assert.strictEqual(fs.readFileSync(target, 'utf8'), '新账本的内容');
});

check('旧账本存在但新位置是另一本：依旧不覆盖', () => {
  // 上一条已经造好「新账本」，这条确认搬家逻辑的第二道防线也有效
  fs.writeFileSync(legacyFile, '另一个更老的账本');
  assert.strictEqual(paths.migrateLegacy(fakeApp, target), false);
  assert.strictEqual(fs.readFileSync(target, 'utf8'), '新账本的内容');
});

console.log(`\n${passed} 项测试全部通过`);
