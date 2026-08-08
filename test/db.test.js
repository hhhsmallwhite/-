/**
 * 记账数据库（db.js）考题册 —— 单元测试
 *
 * 运行：node test/db.test.js
 *
 * 大白话：这里是给「账本管家」出的入学考题，考它记账、查账、改账、删账
 * 是不是真的按规矩办事。
 *
 * ⚠️ 安全红线：考题用的账本文件建在「系统临时文件夹」里，考完自动删掉，
 * 绝不碰您电脑上真实记账用的账本文件。
 */
const assert = require('assert');
const os = require('os');
const path = require('path');
const fs = require('fs');
const db = require('../db');

// 建一个「临时账本」：在系统临时文件夹里新建一个专属小文件夹
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tiantian-test-'));
const dbPath = path.join(tmpDir, 'test.db');
db.init(dbPath);

// 无论考试结果如何，退出前都要把临时账本关掉并删除（保证不污染电脑）
process.on('exit', () => {
  try { db.close(); } catch (e) { /* 已关闭就不管 */ }
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) { /* 删不掉也不管 */ }
});

let passed = 0;
function check(name, fn) { fn(); passed++; console.log('✓', name); }

// —— ① 先存几笔「8 月的账」，后面各题都靠它们 ——
// 8-01 支出 12.50 元 = 1250 分，餐饮美食/午餐，备注「和朋友吃饭」
const r1 = db.addRecord({ type: 'expense', amountCents: 1250, categoryMain: '餐饮美食', categorySub: '午餐', note: '和朋友吃饭', date: '2026-08-01', createdAt: 1 });
// 8-02 支出 5 元 = 500 分，交通出行/公交地铁，不填备注
const r2 = db.addRecord({ type: 'expense', amountCents: 500, categoryMain: '交通出行', categorySub: '公交地铁', date: '2026-08-02', createdAt: 2 });
// 8-03 支出 3 元 = 300 分，居住生活/日用百货
const r3 = db.addRecord({ type: 'expense', amountCents: 300, categoryMain: '居住生活', categorySub: '日用百货', date: '2026-08-03', createdAt: 3 });
// 8-10 收入 1000 元 = 100000 分，工资奖金/工资
db.addRecord({ type: 'income', amountCents: 100000, categoryMain: '工资奖金', categorySub: '工资', date: '2026-08-10', createdAt: 10 });

check('新增一笔支出：金额按「分」存、返回完整记录', () => {
  assert.strictEqual(r1.type, 'expense');
  assert.strictEqual(r1.amountCents, 1250);   // 存的是 1250 分
  assert.strictEqual(r1.amount, 12.5);        // 换算成元是 12.5
  assert.strictEqual(r1.date, '2026-08-01');
  assert.strictEqual(r1.note, '和朋友吃饭');
  assert.strictEqual(r1.categoryMain, '餐饮美食');
  assert.strictEqual(r1.categorySub, '午餐');
  assert.ok(r1.id >= 1);
});

check('不填备注：note 默认是空字符串', () => {
  assert.strictEqual(r2.note, '');
});

check('查一个不存在的编号：返回 null', () => {
  assert.strictEqual(db.getRecordById(999999), null);
});

check('按编号能查到刚加的这笔，分毫不差', () => {
  const got = db.getRecordById(r3.id);
  assert.deepStrictEqual(got, r3);
});

check('月汇总：支出、收入、结余都算对', () => {
  // 8 月支出 = 1250 + 500 + 300 = 2050 分；收入 = 100000 分
  const s = db.getMonthlySummary(2026, 8);
  assert.strictEqual(s.expense, 2050);
  assert.strictEqual(s.income, 100000);
  assert.strictEqual(s.balance, 100000 - 2050);
});

check('月汇总不串月：上个月的账不会混进这个月', () => {
  // 7 月 31 日补一笔 88.88 元的支出
  db.addRecord({ type: 'expense', amountCents: 8888, categoryMain: '其他支出', categorySub: '零钱杂项', date: '2026-07-31', createdAt: 1 });
  const s7 = db.getMonthlySummary(2026, 7);
  const s8 = db.getMonthlySummary(2026, 8);
  assert.strictEqual(s7.expense, 8888);   // 7 月只有这一笔
  assert.strictEqual(s8.expense, 2050);   // 8 月不受影响
});

check('最近几笔：按日期从新到旧排，limit 生效', () => {
  const recent = db.getRecentRecords(3);
  assert.strictEqual(recent.length, 3);
  assert.strictEqual(recent[0].date, '2026-08-10');
  assert.strictEqual(recent[1].date, '2026-08-03');
  assert.strictEqual(recent[2].date, '2026-08-02');
});

check('某月记录：只返回这个月的账', () => {
  const aug = db.getRecordsByMonth(2026, 8);
  assert.strictEqual(aug.length, 4);                       // 8-01 / 8-02 / 8-03 / 8-10
  assert.ok(aug.every(r => r.date.startsWith('2026-08')));
  const jul = db.getRecordsByMonth(2026, 7);
  assert.ok(jul.every(r => r.date.startsWith('2026-07')));
});

check('分类占比：按一级大类汇总，金额从高到低', () => {
  const cats = db.getCategoryTotals(2026, 8, 'expense');
  assert.deepStrictEqual(cats, [
    { name: '餐饮美食', total: 1250 },
    { name: '交通出行', total: 500 },
    { name: '居住生活', total: 300 }
  ]);
  // 收入分类也要对
  const incomeCats = db.getCategoryTotals(2026, 8, 'income');
  assert.deepStrictEqual(incomeCats, [{ name: '工资奖金', total: 100000 }]);
});

check('趋势查询：跨年（2025年12月→2026年1月）逐月都有数', () => {
  db.addRecord({ type: 'expense', amountCents: 6000, categoryMain: '购物打扮', categorySub: '服饰鞋帽', date: '2025-12-15', createdAt: 1 });
  const trend = db.getMonthlyTrendRange(2025, 12, 2026, 1);
  assert.strictEqual(trend.length, 2);
  assert.deepStrictEqual({ y: trend[0].year, m: trend[0].month }, { y: 2025, m: 12 });
  assert.strictEqual(trend[0].expense, 6000);
  assert.deepStrictEqual({ y: trend[1].year, m: trend[1].month }, { y: 2026, m: 1 });
  assert.strictEqual(trend[1].expense, 0);   // 2026年1月还没有账
  assert.strictEqual(trend[1].income, 0);
});

check('日期范围：返回全部账里最早和最晚的日期', () => {
  const range = db.getDateRange();
  assert.deepStrictEqual(range, { minDate: '2025-12-15', maxDate: '2026-08-10' });
});

check('全部记录：按日期从旧到新排', () => {
  const all = db.getAllRecords();
  assert.deepStrictEqual(all.map(r => r.date), [
    '2025-12-15', '2026-07-31', '2026-08-01', '2026-08-02', '2026-08-03', '2026-08-10'
  ]);
});

check('修改一笔账：内容更新、编号不变', () => {
  const r = db.addRecord({ type: 'expense', amountCents: 100, categoryMain: '娱乐休闲', categorySub: '电影演出', date: '2026-08-20', createdAt: 20 });
  const updated = db.updateRecord(r.id, {
    type: 'income', amountCents: 2500, categoryMain: '兼职副业', categorySub: '兼职收入', note: '改完', date: '2026-08-21'
  });
  assert.strictEqual(updated.id, r.id);       // 编号不变
  assert.strictEqual(updated.type, 'income');
  assert.strictEqual(updated.amountCents, 2500);
  assert.strictEqual(updated.categoryMain, '兼职副业');
  assert.strictEqual(updated.categorySub, '兼职收入');
  assert.strictEqual(updated.date, '2026-08-21');
  assert.strictEqual(updated.note, '改完');
});

check('删除一笔账：删完查不到，删不存在的也不报错', () => {
  const r = db.addRecord({ type: 'expense', amountCents: 666, categoryMain: '医疗健康', categorySub: '药品', date: '2026-08-22', createdAt: 22 });
  db.deleteRecord(r.id);
  assert.strictEqual(db.getRecordById(r.id), null);
  db.deleteRecord(999999);   // 删一个不存在的编号，应该安静跳过
});

check('边界：金额 0 元（0 分）也能正常记一笔', () => {
  const r = db.addRecord({ type: 'expense', amountCents: 0, categoryMain: '其他支出', categorySub: '零钱杂项', note: '免费', date: '2026-08-23', createdAt: 23 });
  assert.strictEqual(r.amountCents, 0);
  assert.strictEqual(r.amount, 0);
});

check('空账本：一本全新的账本里，日期范围返回 null', () => {
  // 另开一个全新的临时账本（模拟刚装好的软件）
  const tmp2 = fs.mkdtempSync(path.join(os.tmpdir(), 'tiantian-empty-'));
  const db2Path = path.join(tmp2, 'empty.db');
  db.close();
  db.init(db2Path);
  assert.strictEqual(db.getDateRange(), null);
  assert.strictEqual(db.getRecordsByMonth(2026, 8).length, 0);
  assert.strictEqual(db.getMonthlySummary(2026, 8).expense, 0);
  // 考完切回主账本，保证退出时能正常清理
  db.close();
  db.init(dbPath);
  fs.rmSync(tmp2, { recursive: true, force: true });
});

console.log(`\n${passed} 项测试全部通过`);
