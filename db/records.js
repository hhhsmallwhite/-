/**
 * 天天记账 —— 账目表的增删改查（唯一写 SQL 的地方之一）
 *
 * 大白话：这个文件管「每一笔账」本身——记一笔、查一笔、改一笔、删一笔。
 * 所有语句都用 better-sqlite3 的「预编译 + 占位符」写法（@名字 或 ?），
 * 值单独传进去，绝不把变量拼进 SQL 字符串里，所以不会被注入攻击。
 *
 * 分工：算汇总（本月收支、分类占比、趋势）不在这里，在同目录的 stats.js。
 */

const { get } = require('./connection');
const { monthRange } = require('./month');
const { toRecord } = require('./row');

// 排序口径统一：先按账目日期、再按记账时刻、最后按编号，全部从新到旧。
// 抽出来是为了保证「最近记录」「账单页」「导出」看到的是同一个顺序。
const ORDER_NEWEST_FIRST = 'ORDER BY date DESC, created_at DESC, id DESC';
const ORDER_OLDEST_FIRST = 'ORDER BY date ASC, created_at ASC, id ASC';

/**
 * 新增一笔账，返回存好之后（带编号）的完整记录
 * @param {object} record 至少要有 type / amountCents / categoryMain / categorySub / date
 * @returns {object} 存好的记录
 */
function addRecord(record) {
  const info = get()
    .prepare(`
      INSERT INTO records (type, amount_cents, category_main, category_sub, note, date, created_at)
      VALUES (@type, @amountCents, @categoryMain, @categorySub, @note, @date, @createdAt)
    `)
    .run({
      type: record.type,
      amountCents: record.amountCents,
      categoryMain: record.categoryMain,
      categorySub: record.categorySub,
      note: record.note || '',
      date: record.date,
      // 没传记账时刻就用「现在」（毫秒时间戳）
      createdAt: record.createdAt || Date.now()
    });

  return getRecordById(info.lastInsertRowid);
}

/**
 * 按编号查一笔账
 * @param {number} id 账目编号
 * @returns {object|null} 找到了就返回记录，没有就返回 null
 */
function getRecordById(id) {
  const row = get().prepare('SELECT * FROM records WHERE id = ?').get(id);
  return row ? toRecord(row) : null;
}

/**
 * 取最近几笔（首页「最近记录」用）
 * @param {number} limit 最多几条
 * @returns {object[]} 记录列表，新的在前
 */
function getRecentRecords(limit = 10) {
  const rows = get().prepare(`SELECT * FROM records ${ORDER_NEWEST_FIRST} LIMIT ?`).all(limit);
  return rows.map(toRecord);
}

/**
 * 取某年某月的全部记录（账单页用）
 * @param {number} year
 * @param {number} month
 * @returns {object[]} 记录列表，新的在前
 */
function getRecordsByMonth(year, month) {
  const { start, end } = monthRange(year, month);
  const rows = get()
    .prepare(`SELECT * FROM records WHERE date >= ? AND date < ? ${ORDER_NEWEST_FIRST}`)
    .all(start, end);
  return rows.map(toRecord);
}

/**
 * 取出全部账目（导出备份用），按时间从旧到新
 * @returns {object[]}
 */
function getAllRecords() {
  const rows = get().prepare(`SELECT * FROM records ${ORDER_OLDEST_FIRST}`).all();
  return rows.map(toRecord);
}

/**
 * 修改一笔账：按编号把内容整个换成新的，返回改好之后的记录
 * 注意：created_at（记账时刻）不动，只改用户看得见的那几项。
 * @param {number} id 要改哪一笔
 * @param {object} record 新的内容
 * @returns {object|null} 改好的记录；编号不存在时返回 null
 */
function updateRecord(id, record) {
  get()
    .prepare(`
      UPDATE records SET
        type = @type,
        amount_cents = @amountCents,
        category_main = @categoryMain,
        category_sub = @categorySub,
        note = @note,
        date = @date
      WHERE id = @id
    `)
    .run({
      id,
      type: record.type,
      amountCents: record.amountCents,
      categoryMain: record.categoryMain,
      categorySub: record.categorySub,
      note: record.note || '',
      date: record.date
    });

  return getRecordById(id);
}

/**
 * 删除一笔账
 * @param {number} id 要删哪一笔
 * @returns {number} 实际删掉的条数（0 表示这个编号本来就不存在）
 */
function deleteRecord(id) {
  return get().prepare('DELETE FROM records WHERE id = ?').run(id).changes;
}

/**
 * 一次插入多笔（CSV 导入用）。
 * 整批包在一个事务里：要么全部写进去，要么一笔都不写。
 * 这样万一第 300 行出错，不会留下「前 299 行进去了、剩下的没进去」的半截账本。
 * @param {object[]} list 已经过检查站的账目列表
 * @returns {number} 实际写入的条数
 */
function addRecordsBatch(list) {
  if (!Array.isArray(list) || list.length === 0) return 0;

  const insert = get().prepare(`
    INSERT INTO records (type, amount_cents, category_main, category_sub, note, date, created_at)
    VALUES (@type, @amountCents, @categoryMain, @categorySub, @note, @date, @createdAt)
  `);

  const runAll = get().transaction((rows) => {
    for (const record of rows) {
      insert.run({
        type: record.type,
        amountCents: record.amountCents,
        categoryMain: record.categoryMain,
        categorySub: record.categorySub,
        note: record.note || '',
        date: record.date,
        createdAt: record.createdAt || Date.now()
      });
    }
    return rows.length;
  });

  return runAll(list);
}

module.exports = {
  addRecord,
  addRecordsBatch,
  getRecordById,
  getRecentRecords,
  getRecordsByMonth,
  getAllRecords,
  updateRecord,
  deleteRecord
};
