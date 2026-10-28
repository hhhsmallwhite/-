/**
 * 天天记账 —— 算账（汇总、分类占比、趋势）
 *
 * 大白话：这个文件不增不删，只负责「把钱加一加」：
 * 这个月花了多少、赚了多少、钱花在哪几个分类上、最近半年每个月各多少。
 * 全部用 SQL 的 SUM / GROUP BY 让数据库去算，比取到界面里再用循环加要快，也不容易算错。
 *
 * 单位提醒：这里返回的金额统一是「分」（整数），要显示成人看的「元」由界面负责。
 */

const { get } = require('./connection');
const { monthRange } = require('./month');

/**
 * 某年某月的收支汇总（首页/统计页顶部那三张卡片）
 * @param {number} year
 * @param {number} month
 * @returns {{ expense: number, income: number, balance: number }} 单位都是分；balance = 收入 - 支出
 */
function getMonthlySummary(year, month) {
  const { start, end } = monthRange(year, month);
  const rows = get()
    .prepare(`
      SELECT type, SUM(amount_cents) AS total
      FROM records
      WHERE date >= ? AND date < ?
      GROUP BY type
    `)
    .all(start, end);

  // 查询只会返回「有记录的那几种类型」，所以默认值必须先给 0
  let expense = 0;
  let income = 0;
  for (const row of rows) {
    if (row.type === 'expense') expense = row.total;
    if (row.type === 'income') income = row.total;
  }
  return { expense, income, balance: income - expense };
}

/**
 * 某年某月里，按「一级分类」汇总某一类收支（环形图用）
 * @param {number} year
 * @param {number} month
 * @param {'expense'|'income'} type 看支出还是看收入
 * @returns {{ name: string, total: number }[]} 金额从高到低
 */
function getCategoryTotals(year, month, type) {
  const { start, end } = monthRange(year, month);
  const rows = get()
    .prepare(`
      SELECT category_main AS name, SUM(amount_cents) AS total
      FROM records
      WHERE date >= ? AND date < ? AND type = ?
      GROUP BY category_main
      ORDER BY total DESC
    `)
    .all(start, end, type);
  return rows.map((row) => ({ name: row.name, total: row.total }));
}

/**
 * 从某月到某月（含首尾）逐月的收支，趋势柱状图用
 * @param {number} startYear 起始年
 * @param {number} startMonth 起始月（1~12）
 * @param {number} endYear 结束年
 * @param {number} endMonth 结束月（1~12）
 * @returns {{ year: number, month: number, expense: number, income: number }[]} 从旧到新
 */
function getMonthlyTrendRange(startYear, startMonth, endYear, endMonth) {
  const list = [];
  let year = startYear;
  let month = startMonth;

  // 把「年月」换算成一个连续数字（年 * 12 + 月），比大小就不用处理跨年了
  const endKey = endYear * 12 + (endMonth - 1);
  let guard = 0;

  // guard 是保险丝：万一参数算错导致死循环，最多跑 1200 次（100 年）就停
  while (year * 12 + (month - 1) <= endKey && guard < 1200) {
    const summary = getMonthlySummary(year, month);
    list.push({ year, month, expense: summary.expense, income: summary.income });

    month += 1;
    if (month > 12) { month = 1; year += 1; }
    guard += 1;
  }

  return list;
}

/**
 * 全部记录里最早和最晚的日期（趋势图「全部」按钮要知道从哪画到哪）
 * @returns {{ minDate: string, maxDate: string }|null} 一条记录都没有时返回 null
 */
function getDateRange() {
  const row = get().prepare('SELECT MIN(date) AS minDate, MAX(date) AS maxDate FROM records').get();
  if (!row || !row.minDate) return null;
  return { minDate: row.minDate, maxDate: row.maxDate };
}

module.exports = {
  getMonthlySummary,
  getCategoryTotals,
  getMonthlyTrendRange,
  getDateRange
};
