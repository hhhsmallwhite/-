/**
 * 检查站（main/validate.js）考卷 —— 单元测试
 *
 * 运行：node test/validate.test.js
 *
 * 大白话：这个文件是「界面递给主进程的数据」的守门员。
 * 守门员失手的后果很严重——脏数据一旦进账本，算出来的钱全是错的。
 * 所以这里专门考它：正经数据要放行、歪数据要拦住、拦的时候说的话要能看懂。
 *
 * 这套考题不碰数据库、不碰文件，纯逻辑，随便跑。
 */

const assert = require('assert');
const v = require('../main/validate');

let passed = 0;

/** 跑一道题，过了就打勾 */
function check(name, fn) {
  fn();
  passed += 1;
  console.log('✓', name);
}

/* ---------- 一、一笔账：正经数据必须放行，而且要「只留认识的字段」 ---------- */

check('正常的支出：放行，字段原样保留', () => {
  const clean = v.record({
    type: 'expense',
    amountCents: 1250,
    categoryMain: '餐饮美食',
    categorySub: '午餐',
    note: '食堂',
    date: '2026-10-28'
  });
  assert.strictEqual(clean.amountCents, 1250);
  assert.strictEqual(clean.categoryMain, '餐饮美食');
  assert.strictEqual(clean.note, '食堂');
});

check('备注不填：变成空字符串，而不是 undefined', () => {
  const clean = v.record({
    type: 'income', amountCents: 100, categoryMain: '红包礼金', categorySub: '红包', date: '2026-10-01'
  });
  assert.strictEqual(clean.note, '');
});

check('多塞的字段会被丢掉（白名单）', () => {
  const clean = v.record({
    type: 'expense', amountCents: 100, categoryMain: '餐饮美食', categorySub: '早餐',
    date: '2026-10-01', 偷偷夹带: '恶意内容', id: 999
  });
  assert.strictEqual(clean.偷偷夹带, undefined);
  assert.strictEqual(clean.id, undefined);
});

check('分类名前后有空格：自动去掉', () => {
  const clean = v.record({
    type: 'expense', amountCents: 100, categoryMain: '  餐饮美食 ', categorySub: ' 早餐  ', date: '2026-10-01'
  });
  assert.strictEqual(clean.categoryMain, '餐饮美食');
  assert.strictEqual(clean.categorySub, '早餐');
});

/* ---------- 二、一笔账：歪数据必须拦住，而且要说人话 ---------- */

check('类型不是支出/收入：拦下', () => {
  assert.throws(() => v.record({ type: '转账', amountCents: 100, categoryMain: 'a', categorySub: 'b', date: '2026-10-01' }), /收支类型/);
});

check('金额是小数（12.5 分）：拦下，必须是整数分', () => {
  assert.throws(() => v.record({ type: 'expense', amountCents: 12.5, categoryMain: 'a', categorySub: 'b', date: '2026-10-01' }), /整数/);
});

check('金额是字符串 "1250"：拦下，不替它猜', () => {
  assert.throws(() => v.record({ type: 'expense', amountCents: '1250', categoryMain: 'a', categorySub: 'b', date: '2026-10-01' }), /整数/);
});

check('金额 0 或负数：拦下', () => {
  assert.throws(() => v.record({ type: 'expense', amountCents: 0, categoryMain: 'a', categorySub: 'b', date: '2026-10-01' }), /大于 0/);
  assert.throws(() => v.record({ type: 'expense', amountCents: -100, categoryMain: 'a', categorySub: 'b', date: '2026-10-01' }), /大于 0/);
});

check('金额大到离谱（110 万元）：拦下，提示可能多打了 0', () => {
  assert.throws(
    () => v.record({ type: 'expense', amountCents: 110000000, categoryMain: 'a', categorySub: 'b', date: '2026-10-01' }),
    /多打了几个 0/
  );
});

check('分类为空或全是空格：拦下', () => {
  assert.throws(() => v.record({ type: 'expense', amountCents: 100, categoryMain: '   ', categorySub: 'b', date: '2026-10-01' }), /不能为空/);
});

check('备注超过 200 字：拦下', () => {
  assert.throws(
    () => v.record({ type: 'expense', amountCents: 100, categoryMain: 'a', categorySub: 'b', note: '字'.repeat(201), date: '2026-10-01' }),
    /备注最多/
  );
});

check('日期格式不对（2026/10/01）：拦下', () => {
  assert.throws(() => v.record({ type: 'expense', amountCents: 100, categoryMain: 'a', categorySub: 'b', date: '2026/10/01' }), /日期格式/);
});

check('2 月 30 号这种不存在的日期：拦下', () => {
  assert.throws(() => v.record({ type: 'expense', amountCents: 100, categoryMain: 'a', categorySub: 'b', date: '2026-02-30' }), /日期格式/);
});

check('闰年 2 月 29 号：放行（2028 是闰年）', () => {
  assert.ok(v.isDate('2028-02-29'));
});

check('平年 2 月 29 号：拦下（2027 不是闰年）', () => {
  assert.strictEqual(v.isDate('2027-02-29'), false);
});

check('传 null 或数字：拦下而不是崩掉', () => {
  assert.throws(() => v.record(null), /格式不对/);
  assert.throws(() => v.record(42), /格式不对/);
});

/* ---------- 三、其它几个小检查 ---------- */

check('编号：只收正整数', () => {
  assert.strictEqual(v.id(7), 7);
  assert.throws(() => v.id(0), /编号/);
  assert.throws(() => v.id('7'), /编号/);
});

check('年月：月份 13 拦下，年份 1800 拦下', () => {
  assert.deepStrictEqual(v.yearMonth(2026, 10), { year: 2026, month: 10 });
  assert.throws(() => v.yearMonth(2026, 13), /月份/);
  assert.throws(() => v.yearMonth(1800, 1), /年份/);
});

check('取几条：不传默认 10，超过 500 拦下', () => {
  assert.strictEqual(v.limit(undefined), 10);
  assert.strictEqual(v.limit(5), 5);
  assert.throws(() => v.limit(501), /最多取/);
  assert.throws(() => v.limit(0), /最多取/);
});

check('最高分：负数按 0，小数向下取整', () => {
  assert.strictEqual(v.score(-5), 0);
  assert.strictEqual(v.score(12.9), 12);
  assert.throws(() => v.score('12'), /分数/);
});

check('趋势区间：起点晚于终点会自动换过来，不报错', () => {
  const r = v.trendRange(2026, 10, 2026, 3);
  assert.deepStrictEqual(r, { startYear: 2026, startMonth: 3, endYear: 2026, endMonth: 10 });
});

check('趋势区间：正常顺序原样返回', () => {
  const r = v.trendRange(2026, 1, 2027, 6);
  assert.deepStrictEqual(r, { startYear: 2026, startMonth: 1, endYear: 2027, endMonth: 6 });
});

console.log(`\n${passed} 项测试全部通过`);
