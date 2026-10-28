/**
 * 导出 CSV（main/export-csv.js）考卷 —— 单元测试
 *
 * 运行：node test/export-csv.test.js
 *
 * 大白话：导出的表格是给 Excel 用的。表格最怕三件事：
 *   ① 中文乱码（少了开头的隐形标记）② 带逗号的备注把列挤歪了 ③ 带引号的备注把行搞乱。
 * 这三件事一旦发生，用户看到的是一张乱七八糟的表，还以为是记账数据坏了。
 * 所以这里逐条考：拼出来的文本到底长什么样。
 */

const assert = require('assert');
const { buildCsv } = require('../main/export-csv');

let passed = 0;

/** 跑一道题 */
function check(name, fn) {
  fn();
  passed += 1;
  console.log('✓', name);
}

/** 造一笔账（只填测试关心的字段） */
function rec(date, type, amountCents, main, sub, note) {
  return { date, type, amountCents, categoryMain: main, categorySub: sub, note };
}

check('开头有隐形标记（BOM），Excel 才不会把中文显示成乱码', () => {
  const csv = buildCsv([]);
  assert.strictEqual(csv.charCodeAt(0), 0xfeff);
});

check('表头是六列，顺序固定', () => {
  const firstLine = buildCsv([]).slice(1).split('\r\n')[0];
  assert.strictEqual(firstLine, '日期,类型,一级分类,二级分类,金额（元）,备注');
});

check('一笔支出：类型写「支出」，金额按元、保留两位', () => {
  const rows = buildCsv([rec('2026-10-01', 'expense', 1250, '餐饮美食', '午餐', '食堂')]).slice(1).split('\r\n');
  assert.strictEqual(rows[1], '2026-10-01,支出,餐饮美食,午餐,12.50,食堂');
});

check('一笔收入：类型写「收入」', () => {
  const rows = buildCsv([rec('2026-10-23', 'income', 550000, '工资奖金', '工资', '')]).slice(1).split('\r\n');
  assert.strictEqual(rows[1], '2026-10-23,收入,工资奖金,工资,5500.00,');
});

check('备注里有逗号：整个字段加双引号，列不会挤歪', () => {
  const rows = buildCsv([rec('2026-10-01', 'expense', 100, '餐饮美食', '午餐', '和朋友吃饭,AA')]).slice(1).split('\r\n');
  assert.ok(rows[1].includes('"和朋友吃饭,AA"'), rows[1]);
});

check('备注里有双引号：引号写两遍（CSV 老规矩）', () => {
  const rows = buildCsv([rec('2026-10-01', 'expense', 100, '餐饮美食', '午餐', '他说"好吃"')]).slice(1).split('\r\n');
  assert.ok(rows[1].includes('"他说""好吃"""'), rows[1]);
});

check('备注里有换行：不把一行拆成两行，而是包成带引号的一个字段', () => {
  const csv = buildCsv([rec('2026-10-01', 'expense', 100, '餐饮美食', '午餐', '第一行\n第二行')]);
  // 换行被包在引号里，所以「引号内的换行」是合法的，但行数由 \r\n 决定，仍然是表头 + 1 行
  assert.ok(csv.includes('"第一行\n第二行"'));
  assert.strictEqual(csv.slice(1).split('\r\n').length, 2);
});

check('备注是 null / 空：不写「null」这两个字', () => {
  const rows = buildCsv([rec('2026-10-01', 'expense', 100, '餐饮美食', '午餐', null)]).slice(1).split('\r\n');
  assert.strictEqual(rows[1].endsWith(','), true);
  assert.ok(!rows[1].includes('null'));
});

check('多笔账：一行一笔，顺序按传进来的顺序', () => {
  const list = [
    rec('2026-09-01', 'expense', 100, '餐饮美食', '早餐', ''),
    rec('2026-10-01', 'income', 200, '红包礼金', '红包', ''),
    rec('2026-10-02', 'expense', 300, '交通出行', '公交地铁', '')
  ];
  const rows = buildCsv(list).slice(1).split('\r\n');
  assert.strictEqual(rows.length, 4);
  assert.ok(rows[1].startsWith('2026-09-01'));
  assert.ok(rows[3].startsWith('2026-10-02'));
});

check('空账本：只有表头，不报错', () => {
  const csv = buildCsv([]);
  assert.strictEqual(csv.slice(1).split('\r\n').length, 1);
});

console.log(`\n${passed} 项测试全部通过`);
