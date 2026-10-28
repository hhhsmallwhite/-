/**
 * 天天记账 —— 数据库里的一行 ↔ 界面能用的一个对象
 *
 * 大白话：数据库里的字段名是英文的、金额单位是「分」；
 * 界面里习惯用驼峰名字、金额用「元」。这个文件就是中间的翻译官。
 * 所有「从库里取数据」的地方都走它，保证翻译口径只有一套。
 *
 * 为什么同时保留 amountCents 和 amount：
 * - amountCents（分，整数）用来做加减法，不会有小数误差；
 * - amount（元，带小数）只用来显示，方便直接 toFixed(2)。
 */

/**
 * 把 records 表的一行，翻译成界面好用的记录对象
 * @param {object} row 数据库里的一行（字段名是 amount_cents 这种下划线风格）
 * @returns {object} 界面用的记录（字段名是 amountCents 这种驼峰风格）
 */
function toRecord(row) {
  return {
    id: row.id,
    type: row.type,
    amountCents: row.amount_cents,
    amount: row.amount_cents / 100,
    categoryMain: row.category_main,
    categorySub: row.category_sub,
    note: row.note || '',
    date: row.date,
    createdAt: row.created_at
  };
}

module.exports = { toRecord };
