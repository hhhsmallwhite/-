/**
 * 账本升级（db/migrations.js + db/connection.js）考卷 —— 单元测试
 *
 * 运行：node test/migration.test.js
 *
 * 大白话：这次重构给账本加了个「升级机制」（以后改表结构不会再没地方落脚），
 * 顺手还加了两个查询索引。风险在于：用户电脑里那本账已经存着真实数据了，
 * 升级过程只要有一点点问题，用户看到的就是「我的账全没了」。
 *
 * 所以这本考卷专门模拟「老账本」：手工造一本用旧结构建的、存着几笔账的账本，
 * 然后让新代码去打开它，检查三件事——
 *   ① 账一笔都没少；② 结构升到了最新；③ 索引真的建上了（查询能用上它）。
 *
 * 安全红线：全程在系统临时目录里造账本、考完删掉，绝不碰真实的 tiantian.db。
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');

const db = require('../db');

let passed = 0;

/** 跑一道题 */
function check(name, fn) {
  fn();
  passed += 1;
  console.log('✓', name);
}

// 造一个一次性的临时文件夹，退出时删干净
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tiantian-migrate-'));
process.on('exit', () => {
  try {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (err) {
    // 删不掉也不影响结论
  }
});

/**
 * 手工造一本「旧版账本」：只有表、没有索引、user_version 还是 0，
 * 里面放两笔账——这就是老用户电脑上的样子。
 * @param {string} file 账本文件路径
 */
function makeLegacyLedger(file) {
  const raw = new Database(file);

  raw.exec(`
    CREATE TABLE records (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      type          TEXT    NOT NULL,
      amount_cents  INTEGER NOT NULL,
      category_main TEXT    NOT NULL,
      category_sub  TEXT    NOT NULL,
      note          TEXT    DEFAULT '',
      date          TEXT    NOT NULL,
      created_at    INTEGER NOT NULL
    )
  `);

  const insert = raw.prepare(`
    INSERT INTO records (type, amount_cents, category_main, category_sub, note, date, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insert.run('expense', 1250, '餐饮美食', '午餐', '老账一', '2026-08-05', 1754000000000);
  insert.run('income', 550000, '工资奖金', '工资', '', '2026-08-10', 1754400000000);

  // 旧版本没有迁移机制，user_version 就是默认的 0
  raw.pragma('user_version = 0');
  raw.close();
}

/**
 * 读一本账本里有哪些索引
 * @param {string} file
 * @returns {string[]} 索引名列表
 */
function indexNames(file) {
  const raw = new Database(file, { readonly: true });
  const rows = raw.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'records'").all();
  const version = raw.pragma('user_version', { simple: true });
  raw.close();
  return { names: rows.map((r) => r.name), version };
}

const ledger = path.join(tmpDir, 'legacy.db');

check('先造一本「旧版账本」：2 笔账、无索引、结构版本 0', () => {
  makeLegacyLedger(ledger);
  const info = indexNames(ledger);
  assert.strictEqual(info.version, 0);
  assert.deepStrictEqual(info.names, []);
});

check('用新代码打开老账本：升级到第 2 版', () => {
  db.open(ledger);
  assert.strictEqual(db.schemaVersion(), 2);
});

check('老账本里的 2 笔账一笔都没少（这是最要紧的一条）', () => {
  const all = db.getAllRecords();
  assert.strictEqual(all.length, 2);
  assert.strictEqual(all[0].note, '老账一');
  assert.strictEqual(all[0].amountCents, 1250);
  assert.strictEqual(all[1].amountCents, 550000);
});

check('索引真的建上了（两个查询索引）', () => {
  db.close(); // 先关掉，再用只读方式看文件
  const info = indexNames(ledger);
  assert.ok(info.names.includes('idx_records_date'), info.names.join('、'));
  assert.ok(info.names.includes('idx_records_type_date'), info.names.join('、'));
  assert.strictEqual(info.version, 2);
});

check('再次打开已升级的账本：不会重复升级、再报错', () => {
  db.open(ledger);
  assert.strictEqual(db.schemaVersion(), 2);
  assert.strictEqual(db.getAllRecords().length, 2);
  db.close();
});

check('全新账本（第一次装软件）：表建好、索引建好、版本是 2', () => {
  const fresh = path.join(tmpDir, 'fresh.db');
  db.open(fresh);
  assert.strictEqual(db.schemaVersion(), 2);
  assert.strictEqual(db.getAllRecords().length, 0);

  // 新账本立刻就能正常记账
  const added = db.addRecord({
    type: 'expense', amountCents: 999, categoryMain: '餐饮美食', categorySub: '早餐', note: '', date: '2026-10-28'
  });
  assert.strictEqual(added.amountCents, 999);
  db.close();

  const info = indexNames(fresh);
  assert.strictEqual(info.names.length, 2);
});

check('查询走索引（EXPLAIN 里能看到索引名，不是全表扫）', () => {
  const raw = new Database(ledger, { readonly: true });
  const plan = raw
    .prepare('EXPLAIN QUERY PLAN SELECT * FROM records WHERE date >= ? AND date < ? ORDER BY date DESC')
    .all('2026-08-01', '2026-09-01')
    .map((row) => row.detail)
    .join(' | ');
  raw.close();
  assert.ok(plan.includes('idx_records_date'), plan);
});

console.log(`\n${passed} 项测试全部通过`);
