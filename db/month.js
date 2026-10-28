/**
 * 天天记账 —— 月份计算小工具
 *
 * 大白话：账本里所有「查某个月」的需求，最后都要变成一句
 * 「日期 >= 某月1号 并且 日期 < 下个月1号」。
 * 这个换算写在好几个地方容易写成两套口径，所以单独拎出来，只此一份。
 */

/**
 * 算出某年某月的日期范围（含 1 号当天，不含下月 1 号）
 * @param {number} year 年，例如 2026
 * @param {number} month 月，1~12
 * @returns {{ start: string, end: string }} 起止日期，格式 YYYY-MM-DD
 */
function monthRange(year, month) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  return { start, end: nextMonthStart(year, month) };
}

/**
 * 下个月 1 号的日期字符串（12 月要跨年）
 * @param {number} year
 * @param {number} month
 * @returns {string} 格式 YYYY-MM-DD
 */
function nextMonthStart(year, month) {
  if (month === 12) return `${year + 1}-01-01`;
  return `${year}-${String(month + 1).padStart(2, '0')}-01`;
}

module.exports = { monthRange, nextMonthStart };
