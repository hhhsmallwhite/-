/**
 * 备份与恢复（main/backup.js）考卷 —— 单元测试
 *
 * 运行：node test/backup.test.js
 *
 * 大白话：备份这功能的可怕之处在于「平时看不出来，出事那天才知道行不行」。
 * 所以这本考卷不测「文件生成了没有」，而是逐条测真正的承诺：
 *   · 同一天只备一次（不然开十次软件就刷掉十份历史）
 *   · 只留 7 份（不然一年后硬盘塞满）
 *   · 备份能原样恢复回来（不是坏文件）
 *   · 恢复前会自动存一份现场（选错了有得退）
 *   · 不是账本的文件、更新版本的账本，一律拦住
 *
 * 安全红线：全部在系统临时目录里造账本，考完删掉，绝不碰真实的 tiantian.db。
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');

const backup = require('../main/backup');

let passed = 0;

/** 跑一道题 */
function check(name, fn) {
  fn();
  passed += 1;
  console.log('✓', name);
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tiantian-backup-'));
process.on('exit', () => {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (err) {
    // 删不掉不影响结论
  }
});

const dbPath = path.join(tmpDir, 'tiantian.db');
const backupDir = path.join(tmpDir, 'backups');

/**
 * 造一本账本，里面放 count 笔账
 * @param {string} file
 * @param {number} count
 * @param {number} [version] 结构版本
 */
function makeLedger(file, count, version = 2) {
  const raw = new Database(file);
  raw.exec(`
    CREATE TABLE IF NOT EXISTS records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      category_main TEXT NOT NULL,
      category_sub TEXT NOT NULL,
      note TEXT DEFAULT '',
      date TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);
  raw.prepare('DELETE FROM records').run();
  const insert = raw.prepare('INSERT INTO records (type, amount_cents, category_main, category_sub, note, date, created_at) VALUES (?,?,?,?,?,?,?)');
  for (let i = 0; i < count; i++) {
    insert.run('expense', 100 + i, '餐饮美食', '午餐', '', '2026-10-01', 1759000000000 + i);
  }
  raw.pragma(`user_version = ${version}`);
  raw.close();
}

/**
 * 假的账本模块（restore 需要它），真实读取文件里有多少条
 * @returns {object}
 */
function fakeDb() {
  return {
    closed: 0,
    opened: 0,
    close() { this.closed += 1; },
    open() { this.opened += 1; },
    getAllRecords() {
      const raw = new Database(dbPath, { readonly: true });
      const n = raw.prepare('SELECT COUNT(*) AS n FROM records').get().n;
      raw.close();
      return new Array(n).fill({});
    }
  };
}

/* ---------- 一、自动备份 ---------- */

check('还没有账本时：不备份，也不报错', () => {
  const r = backup.backupIfNeeded({ dbPath, dir: backupDir, now: new Date(2026, 9, 28, 9, 0, 0) });
  assert.strictEqual(r.ok, false);
  assert.ok(/还没有账本/.test(r.skipped));
});

check('第一次打开：生成一份备份，大小和原账本一致', () => {
  makeLedger(dbPath, 3);
  const r = backup.backupIfNeeded({ dbPath, dir: backupDir, now: new Date(2026, 9, 28, 9, 0, 0) });
  assert.strictEqual(r.ok, true);
  assert.ok(fs.existsSync(r.path));
  assert.strictEqual(fs.statSync(r.path).size, fs.statSync(dbPath).size);
});

check('备份文件是真能打开的账本，3 条账都在（不是坏文件）', () => {
  const list = backup.listBackups(backupDir);
  const info = backup.inspect(list[0].path);
  assert.strictEqual(info.ok, true);
  assert.strictEqual(info.count, 3);
  assert.strictEqual(info.version, 2);
});

check('同一天再打开：跳过，不会又生成一份', () => {
  const before = backup.listBackups(backupDir).length;
  const r = backup.backupIfNeeded({ dbPath, dir: backupDir, now: new Date(2026, 9, 28, 21, 30, 0) });
  assert.strictEqual(r.ok, false);
  assert.ok(/今天已经备份过/.test(r.skipped));
  assert.strictEqual(backup.listBackups(backupDir).length, before);
});

check('第二天打开：新增一份', () => {
  const before = backup.listBackups(backupDir).length;
  const r = backup.backupIfNeeded({ dbPath, dir: backupDir, now: new Date(2026, 9, 29, 8, 0, 0) });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(backup.listBackups(backupDir).length, before + 1);
});

check('账本旁边有 -journal（上次异常退出）：本次不备份，避免备到坏文件', () => {
  const journal = `${dbPath}-journal`;
  fs.writeFileSync(journal, 'x');
  const r = backup.backupIfNeeded({ dbPath, dir: backupDir, now: new Date(2026, 9, 30, 8, 0, 0) });
  fs.unlinkSync(journal);
  assert.strictEqual(r.ok, false);
  assert.ok(/未完成状态/.test(r.skipped));
});

check('连续 10 天：只保留最近 7 份，旧的自个删掉', () => {
  for (let day = 1; day <= 9; day++) {
    backup.backupIfNeeded({ dbPath, dir: backupDir, now: new Date(2026, 10, day, 8, 0, 0) });
  }
  const list = backup.listBackups(backupDir);
  assert.strictEqual(list.length, backup.KEEP);
  // 留的应该是最近的 7 个日期（19 年到 09 号里最后 7 个）
  assert.ok(list[0].name > list[list.length - 1].name);
});

/* ---------- 二、手动备份 ---------- */

check('手动备份：今天备过也照样再存一份', () => {
  const before = backup.listBackups(backupDir).map((item) => item.name);
  const r = backup.createNow({ dbPath, dir: backupDir, now: new Date(2026, 10, 10, 10, 30, 0) });
  const after = backup.listBackups(backupDir).map((item) => item.name);

  assert.strictEqual(r.ok, true);
  assert.ok(fs.existsSync(r.path));
  // 已经满 7 份时，清理会把最旧的挤掉，所以不能简单断言「多了一份」，
  // 而是断言「这份新备份真的在列表里」
  assert.ok(after.includes(path.basename(r.path)));
  assert.ok(after.length <= backup.KEEP);
  assert.notDeepStrictEqual(after, before);
});

check('手动备份：清理后仍然不超过 7 份', () => {
  assert.ok(backup.listBackups(backupDir).length <= backup.KEEP);
});

/* ---------- 三、恢复 ---------- */

check('恢复：把账本换成备份里的内容（3 笔 → 1 笔）', () => {
  // 造一份只有 1 笔的账本，当"备份"用
  const source = path.join(tmpDir, 'one-record.db');
  makeLedger(source, 1);

  const db = fakeDb();
  const r = backup.restore({ dbPath, dir: backupDir, sourcePath: source, schemaVersion: 2 }, db);

  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.count, 1);
  assert.strictEqual(db.closed, 1, '覆盖前必须先关库');
  assert.strictEqual(db.opened, 1, '覆盖后必须重新打开');
});

check('恢复前会自动存一份现场（名字带 before-restore）', () => {
  const list = backup.listBackups(backupDir, 'before');
  assert.ok(list.length >= 1);
  assert.ok(/^tiantian-before-restore-/.test(list[0].name));
  // 这份现场应该是「恢复前」的 3 笔
  assert.strictEqual(backup.inspect(list[0].path).count, 3);
});

check('拒绝恢复：不是数据库的文件（改个扩展名冒充）', () => {
  const fake = path.join(tmpDir, 'fake.db');
  fs.writeFileSync(fake, '这不是数据库');
  const r = backup.restore({ dbPath, dir: backupDir, sourcePath: fake, schemaVersion: 2 }, fakeDb());
  assert.strictEqual(r.ok, false);
  assert.ok(/不是数据库文件/.test(r.error));
});

check('拒绝恢复：是数据库但没有账目表', () => {
  const other = path.join(tmpDir, 'other.db');
  const raw = new Database(other);
  raw.exec('CREATE TABLE notes (id INTEGER PRIMARY KEY, text TEXT)');
  raw.close();

  const r = backup.restore({ dbPath, dir: backupDir, sourcePath: other, schemaVersion: 2 }, fakeDb());
  assert.strictEqual(r.ok, false);
  assert.ok(/没有账目表/.test(r.error));
});

check('拒绝恢复：来自更新版本软件的账本（结构 v9 > 当前 v2）', () => {
  const newer = path.join(tmpDir, 'newer.db');
  makeLedger(newer, 1, 9);
  const r = backup.restore({ dbPath, dir: backupDir, sourcePath: newer, schemaVersion: 2 }, fakeDb());
  assert.strictEqual(r.ok, false);
  assert.ok(/更新版本/.test(r.error));
});

check('拒绝恢复：文件根本不存在', () => {
  const r = backup.restore({ dbPath, dir: backupDir, sourcePath: path.join(tmpDir, 'nope.db'), schemaVersion: 2 }, fakeDb());
  assert.strictEqual(r.ok, false);
  assert.ok(/不存在/.test(r.error));
});

check('拒绝恢复：把当前正在用的账本选成了备份源', () => {
  const r = backup.restore({ dbPath, dir: backupDir, sourcePath: dbPath, schemaVersion: 2 }, fakeDb());
  assert.strictEqual(r.ok, false);
  assert.ok(/正在用的账本/.test(r.error));
});

/* ---------- 四、给界面看的现状 ---------- */

check('备份现状：份数、最近一份、目录都对得上', () => {
  const info = backup.info(backupDir);
  assert.ok(info.count >= 1 && info.count <= backup.KEEP);
  assert.ok(/^tiantian-\d{8}-\d{6}\.db$/.test(info.latest));
  assert.strictEqual(info.dir, backupDir);
});

console.log(`\n${passed} 项测试全部通过`);
