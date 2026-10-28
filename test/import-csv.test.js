/**
 * CSV 导入（main/import-csv.js）考卷 —— 单元测试
 *
 * 运行：node test/import-csv.test.js
 *
 * 大白话：CSV 这东西看着简单，坑全在细节上——
 * 备注里有个逗号，一不小心就把后面的列挤歪；备注里有换行，一不小心就多出半行；
 * Excel 存的文件开头带个看不见的标记，不摘掉第一列就变成垃圾。
 * 这本考卷就把这些坑逐个踩一遍，顺便验证「同样的账不会重复导入」。
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { parseCsv, rowsToRecords, runImport, parseType, parseAmountCents, normalizeDate } = require('../main/import-csv');

let passed = 0;

/** 跑一道题 */
function check(name, fn) {
  fn();
  passed += 1;
  console.log('✓', name);
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tiantian-import-'));
process.on('exit', () => {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (err) {
    // 删不掉不影响结论
  }
});

/* ---------- 一、切分：CSV 的各种花招 ---------- */

check('普通两行：按逗号切，按 \\n 断行', () => {
  const rows = parseCsv('a,b,c\nd,e,f\n');
  assert.deepStrictEqual(rows, [['a', 'b', 'c'], ['d', 'e', 'f']]);
});

check('Windows 换行（\\r\\n）：不会多出一个空列', () => {
  assert.deepStrictEqual(parseCsv('a,b\r\nc,d\r\n'), [['a', 'b'], ['c', 'd']]);
});

check('开头有 BOM（Excel 存的）：自动摘掉，第一列不脏', () => {
  const rows = parseCsv('\ufeff日期,类型\n2026-10-01,支出\n');
  assert.strictEqual(rows[0][0], '日期');
});

check('字段里有逗号（被引号包住）：不拆列', () => {
  assert.deepStrictEqual(parseCsv('a,"朋友吃饭,AA",c\n'), [['a', '朋友吃饭,AA', 'c']]);
});

check('字段里有双引号（写成两个）：还原成一个', () => {
  assert.deepStrictEqual(parseCsv('a,"他说""好吃""",c\n'), [['a', '他说"好吃"', 'c']]);
});

check('字段里有换行（被引号包住）：算一个字段，不多出一行', () => {
  const rows = parseCsv('a,"第一行\n第二行",c\n');
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0][1], '第一行\n第二行');
});

check('最后一行没有换行符结尾：照样收尾', () => {
  assert.deepStrictEqual(parseCsv('a,b\nc,d'), [['a', 'b'], ['c', 'd']]);
});

/* ---------- 二、翻译：各种人类写法 ---------- */

check('类型：支出/收入/expense/income 都认', () => {
  assert.strictEqual(parseType('支出'), 'expense');
  assert.strictEqual(parseType('收入'), 'income');
  assert.strictEqual(parseType('expense'), 'expense');
  assert.strictEqual(parseType('收入 '), 'income');
  assert.strictEqual(parseType('转账'), null);
});

check('金额：带 ¥、带千位逗号、带空格都能认', () => {
  assert.strictEqual(parseAmountCents('12.50'), 1250);
  assert.strictEqual(parseAmountCents('¥12.50'), 1250);
  assert.strictEqual(parseAmountCents('1,800'), 180000);
  assert.ok(Number.isNaN(parseAmountCents('十二块')));
});

check('金额：0.1 + 0.2 这类小数不会飘（按分四舍五入）', () => {
  assert.strictEqual(parseAmountCents('18.88'), 1888);
  assert.strictEqual(parseAmountCents('0.07'), 7);
});

check('日期：2026/10/28 和 2026.10.28 都归一成 2026-10-28', () => {
  assert.strictEqual(normalizeDate('2026/10/28'), '2026-10-28');
  assert.strictEqual(normalizeDate('2026.10.28'), '2026-10-28');
});

/* ---------- 三、整表：合法的进、非法的报 ---------- */

const HEADER = '日期,类型,一级分类,二级分类,金额（元）,备注';

check('表头自动跳过，正常两行都能收下', () => {
  const { records, problems } = rowsToRecords(parseCsv(
    `${HEADER}\n2026-10-01,支出,餐饮美食,午餐,12.50,食堂\n2026-10-02,收入,工资奖金,工资,5500,`
  ));
  assert.strictEqual(records.length, 2);
  assert.strictEqual(problems.length, 0);
  assert.strictEqual(records[0].amountCents, 1250);
  assert.strictEqual(records[1].type, 'income');
});

check('空行：直接忽略，不算错误', () => {
  const { records, problems } = rowsToRecords(parseCsv(`${HEADER}\n\n2026-10-01,支出,餐饮美食,午餐,1.00,\n`));
  assert.strictEqual(records.length, 1);
  assert.strictEqual(problems.length, 0);
});

check('类型写错：报出行号，不吞掉', () => {
  const { records, problems } = rowsToRecords(parseCsv(`${HEADER}\n2026-10-01,转账,餐饮美食,午餐,1.00,\n`));
  assert.strictEqual(records.length, 0);
  assert.strictEqual(problems.length, 1);
  assert.ok(/第 2 行/.test(problems[0].message));
  assert.ok(/看不懂/.test(problems[0].message));
});

check('金额不是数字：报出行号', () => {
  const { records, problems } = rowsToRecords(parseCsv(`${HEADER}\n2026-10-01,支出,餐饮美食,午餐,十二块,\n`));
  assert.strictEqual(records.length, 0);
  assert.ok(/不是数字/.test(problems[0].message));
});

check('日期不存在（2 月 30）：被检查站拦下', () => {
  const { records, problems } = rowsToRecords(parseCsv(`${HEADER}\n2026-02-30,支出,餐饮美食,午餐,1.00,\n`));
  assert.strictEqual(records.length, 0);
  assert.ok(/日期/.test(problems[0].message));
});

check('列数不够（只有 4 列）：报错说清楚', () => {
  const { records, problems } = rowsToRecords(parseCsv('2026-10-01,支出,餐饮美食,午餐\n'));
  assert.strictEqual(records.length, 0);
  assert.ok(/至少要有/.test(problems[0].message));
});

check('问题太多时只报前 20 条（不把界面撑爆）', () => {
  const lines = [HEADER];
  for (let i = 0; i < 30; i++) lines.push('2026-10-01,乱写,餐饮美食,午餐,1.00,');
  const { problems } = rowsToRecords(parseCsv(`${lines.join('\n')}\n`));
  assert.strictEqual(problems.length, 20);
});

/* ---------- 四、导入：去重 + 写库 ---------- */

/**
 * 假账本：只记在内存里，够测导入逻辑
 * @param {object[]} initial 一开始就有的账
 */
function fakeDb(initial = []) {
  const store = initial.map((r) => ({ ...r }));
  return {
    store,
    getAllRecords() { return store; },
    addRecordsBatch(list) { store.push(...list); return list.length; }
  };
}

/** 把内容写成临时 CSV，返回路径 */
function writeCsv(name, text) {
  const file = path.join(tmpDir, name);
  fs.writeFileSync(file, text, 'utf8');
  return file;
}

check('全新账本导入 2 笔：写进去 2 笔', () => {
  const db = fakeDb();
  const file = writeCsv('a.csv', `${HEADER}\n2026-10-01,支出,餐饮美食,午餐,12.50,\n2026-10-02,收入,工资奖金,工资,5500,\n`);
  const r = runImport({ db, filePath: file });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.imported, 2);
  assert.strictEqual(db.store.length, 2);
});

check('同一张表再导一遍：全部跳过，一条不重复', () => {
  const db = fakeDb();
  const file = writeCsv('b.csv', `${HEADER}\n2026-10-01,支出,餐饮美食,午餐,12.50,食堂\n`);
  runImport({ db, filePath: file });
  const again = runImport({ db, filePath: file });
  assert.strictEqual(again.imported, 0);
  assert.strictEqual(again.skipped, 1);
  assert.strictEqual(db.store.length, 1);
});

check('账本里已有一模一样的一笔：跳过它，新的照收', () => {
  const db = fakeDb([{ date: '2026-10-01', type: 'expense', amountCents: 1250, categoryMain: '餐饮美食', categorySub: '午餐', note: '食堂' }]);
  const file = writeCsv('c.csv', `${HEADER}\n2026-10-01,支出,餐饮美食,午餐,12.50,食堂\n2026-10-03,支出,交通出行,公交地铁,2.00,\n`);
  const r = runImport({ db, filePath: file });
  assert.strictEqual(r.imported, 1);
  assert.strictEqual(r.skipped, 1);
  assert.strictEqual(db.store.length, 2);
});

check('同一个文件里出现两行一样的账：只记一笔', () => {
  const db = fakeDb();
  const file = writeCsv('d.csv', `${HEADER}\n2026-10-01,支出,餐饮美食,午餐,12.50,食堂\n2026-10-01,支出,餐饮美食,午餐,12.50,食堂\n`);
  const r = runImport({ db, filePath: file });
  assert.strictEqual(r.imported, 1);
  assert.strictEqual(r.skipped, 1);
});

check('文件读不了：如实返回错误，不崩', () => {
  const r = runImport({ db: fakeDb(), filePath: path.join(tmpDir, '不存在.csv') });
  assert.strictEqual(r.ok, false);
  assert.ok(/读不了/.test(r.error));
});

check('空文件：提示是空的', () => {
  const file = writeCsv('empty.csv', '');
  const r = runImport({ db: fakeDb(), filePath: file });
  assert.strictEqual(r.ok, false);
  assert.ok(/空的/.test(r.error));
});

check('全是坏行：返回 0 笔，并说明没一行合法', () => {
  const file = writeCsv('bad.csv', `${HEADER}\n乱写,乱写,乱写,乱写,乱写,乱写\n`);
  const r = runImport({ db: fakeDb(), filePath: file });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.imported, 0);
  assert.ok(/没有一行是合法的/.test(r.error));
});

console.log(`\n${passed} 项测试全部通过`);
