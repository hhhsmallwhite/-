/**
 * 金额与日期换算（src/lib/format.js）考卷 —— 单元测试
 *
 * 运行：node test/format.test.js
 *
 * 大白话：这个文件是所有金额显示的唯一出口——卡片上的「¥12.50」、
 * 图表纵轴的「1,800」「1.5万」、柱子顶上那个数字，全靠它。
 * 它算错的后果不是界面崩，而是「给用户看错的钱」，这种错最难被发现。
 * 所以这里逐个把边界钉死：0 元、半分钱、上千、上万。
 *
 * 注意：format.js 是浏览器脚本（挂在 window 上），
 * 所以在 node 里跑要先给个假的 window，不需要真的浏览器。
 */

const assert = require('assert');

// 造一个最小的 window，只为让浏览器脚本有地方挂东西
global.window = global.window || {};

require('../src/lib/format');

const F = global.window.TT.format;

let passed = 0;

/** 跑一道题 */
function check(name, fn) {
  fn();
  passed += 1;
  console.log('✓', name);
}

/* ---------- 一、分 → 元（金额显示） ---------- */

check('12.5 元：显示成两位小数 12.50', () => {
  assert.strictEqual(F.money(1250), '12.50');
});

check('0 分：显示 0.00，不是空也不是 NaN', () => {
  assert.strictEqual(F.money(0), '0.00');
  assert.strictEqual(F.money(undefined), '0.00');
  assert.strictEqual(F.money(null), '0.00');
});

check('1 分：显示 0.01（半分钱也不能吞掉）', () => {
  assert.strictEqual(F.money(1), '0.01');
});

check('负数（结余为负）：带负号显示', () => {
  assert.strictEqual(F.money(-6300), '-63.00');
});

/* ---------- 二、图表刻度（不带两位小数，好读） ---------- */

check('整数元不显示小数：5 元 → "5"', () => {
  assert.strictEqual(F.yuan(500), '5');
});

check('非整数元保留一位：52.5 元 → "52.5"', () => {
  assert.strictEqual(F.yuan(5250), '52.5');
});

check('上千加千位逗号：1800 元 → "1,800"', () => {
  assert.strictEqual(F.yuan(180000), '1,800');
});

check('上万也照样加逗号：12,345.7', () => {
  assert.strictEqual(F.yuan(1234567), '12,345.7');
});

/* ---------- 三、纵轴取整：让刻度是 1/2/5 这种整齐数 ---------- */

check('123 元 → 刻度上限 200 元', () => {
  assert.strictEqual(F.niceCeilYuan(12345), 200);
});

check('1 元 → 刻度上限 1 元', () => {
  assert.strictEqual(F.niceCeilYuan(100), 1);
});

check('999 元 → 刻度上限 1000 元', () => {
  assert.strictEqual(F.niceCeilYuan(99900), 1000);
});

check('0 元（没有任何记录）：给个 1 元，避免除以 0', () => {
  assert.strictEqual(F.niceCeilYuan(0), 1);
  assert.strictEqual(F.niceCeilYuan(undefined), 1);
});

check('50 元 → 刻度上限 50 元（正好卡在 5 这一档）', () => {
  assert.strictEqual(F.niceCeilYuan(5000), 50);
});

/* ---------- 四、纵轴文字：上万写「万」 ---------- */

check('15000 元 → "1.5万"', () => {
  assert.strictEqual(F.axisYuan(15000), '1.5万');
});

check('20000 元 → "2万"（整数不带小数点）', () => {
  assert.strictEqual(F.axisYuan(20000), '2万');
});

check('1800 元 → "1,800"（没上万就正常加逗号）', () => {
  assert.strictEqual(F.axisYuan(1800), '1,800');
});

/* ---------- 五、日期 ---------- */

check('今天：格式是 YYYY-MM-DD', () => {
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(F.today()));
});

check('当前年月：年份在 2026 之后，月份 1~12', () => {
  const now = F.currentYm();
  assert.ok(now.year >= 2026);
  assert.ok(now.month >= 1 && now.month <= 12);
});

check('补零：1 → "01"，12 → "12"', () => {
  assert.strictEqual(F.pad2(1), '01');
  assert.strictEqual(F.pad2(12), '12');
});

check('年月转字符串：2026 年 10 月 → "2026-10"（月份补零）', () => {
  assert.strictEqual(F.ymToStr(2026, 10), '2026-10');
  assert.strictEqual(F.ymToStr(2026, 1), '2026-01');
});

check('字符串转年月：能来回转回去', () => {
  assert.deepStrictEqual(F.parseYm('2026-10'), { year: 2026, month: 10 });
  assert.deepStrictEqual(F.parseYm(F.ymToStr(2027, 3)), { year: 2027, month: 3 });
});

check('空的或乱写的年月：返回 null，不抛错', () => {
  assert.strictEqual(F.parseYm(''), null);
  assert.strictEqual(F.parseYm(null), null);
  assert.strictEqual(F.parseYm('乱写'), null);
});

console.log(`\n${passed} 项测试全部通过`);
