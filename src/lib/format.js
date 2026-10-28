/**
 * 天天记账 —— 金额与日期的换算（所有页面共用，口径只此一份）
 *
 * 大白话：账本里的钱是「分」（整数），人看的是「元」（带小数）；
 * 日期在库里是一串 "2026-10-28" 的文字，界面上又要拆成年、月、日。
 * 这些换算法以前散在好几个页面里各写一遍，容易一个页面四舍五入、
 * 另一个页面不四舍五入，对不上账。现在统一放这里。
 */

(function (global) {
  'use strict';

  const TT = (global.TT = global.TT || {});

  /**
   * 分 → 带两位小数的元（用于金额显示，例如 1250 → "12.50"）
   * @param {number} cents 金额，单位分
   * @returns {string}
   */
  function money(cents) {
    return ((Number(cents) || 0) / 100).toFixed(2);
  }

  /**
   * 分 → 好读的元（用于图表刻度，例如 5250 → "52.5"、180000 → "1,800"）
   * 整数不显示小数位，非整数保留一位，千位加逗号
   * @param {number} cents 金额，单位分
   * @returns {string}
   */
  function yuan(cents) {
    const value = (Number(cents) || 0) / 100;
    const fixed = Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
    const [int, dec] = fixed.split('.');
    const withComma = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return dec ? `${withComma}.${dec}` : withComma;
  }

  /**
   * 纵轴刻度取整：把最大值凑成 100 / 200 / 500 / 1000 这种整齐的数，
   * 这样柱状图顶上的刻度线不会出现 137.4 这种别扭数字
   * @param {number} cents 当前最大值（分）
   * @returns {number} 取整后的刻度上限（元）
   */
  function niceCeilYuan(cents) {
    const value = Math.max((Number(cents) || 0) / 100, 1);
    const mag = Math.pow(10, Math.floor(Math.log10(value)));
    const norm = value / mag;
    const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
    return step * mag;
  }

  /**
   * 纵轴标签：上万就写成「1.5万」，否则加千位逗号
   * @param {number} value 元
   * @returns {string}
   */
  function axisYuan(value) {
    if (value >= 10000) {
      const w = value / 10000;
      return (Number.isInteger(w) ? w : w.toFixed(1)) + '万';
    }
    return value.toLocaleString('en-US');
  }

  /**
   * 今天（本地时间）的日期字符串，格式 YYYY-MM-DD
   * @returns {string}
   */
  function today() {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  /**
   * 当前的年月
   * @returns {{ year: number, month: number }}
   */
  function currentYm() {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  }

  /**
   * 年月 → "YYYY-MM"（给 <input type="month"> 用）
   * @param {number} year
   * @param {number} month
   * @returns {string}
   */
  function ymToStr(year, month) {
    return `${year}-${pad2(month)}`;
  }

  /**
   * "YYYY-MM" → { year, month }；空值或格式不对返回 null
   * @param {string} value
   * @returns {{ year: number, month: number }|null}
   */
  function parseYm(value) {
    if (!value) return null;
    const [year, month] = value.split('-').map(Number);
    return year && month ? { year, month } : null;
  }

  /**
   * 补零到两位（1 → "01"）
   * @param {number} n
   * @returns {string}
   */
  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  TT.format = { money, yuan, niceCeilYuan, axisYuan, today, currentYm, ymToStr, parseYm, pad2 };
})(window);
