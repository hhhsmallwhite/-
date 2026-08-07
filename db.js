/**
 * 黑马记账 —— 数据库管家
 *
 * 用大白话解释：这个文件是软件的「账本」。
 * 它负责把每一笔账安全地存进电脑，以及按需把账取出来给界面用。
 * 数据存在一个独立的数据库文件里，想备份就把这个文件拷走，换电脑也能接着用。
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

let db = null;

/**
 * 打开数据库文件并建好表（第一次运行时会自动创建）
 * @param {string} dbPath 数据库文件的完整路径
 */
function init(dbPath) {
  if (db) return db; // 已经打开过就直接复用

  // 先确保数据库文件所在的文件夹存在（首次运行时文件夹可能还没有）
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  db = new Database(dbPath);

  // 建表：账目记录表。
  // 金额统一用「分」来存整数（存 12.5 元 = 存 1250 分），避免小数点加减出来的误差
  db.exec(`
    CREATE TABLE IF NOT EXISTS records (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      type          TEXT    NOT NULL,   -- 'expense' 支出 | 'income' 收入
      amount_cents  INTEGER NOT NULL,   -- 金额，单位：分
      category_main TEXT    NOT NULL,   -- 一级大类
      category_sub  TEXT    NOT NULL,   -- 二级小类
      note          TEXT    DEFAULT '', -- 备注
      date          TEXT    NOT NULL,   -- 账目日期，格式 YYYY-MM-DD
      created_at    INTEGER NOT NULL    -- 记这笔账的时刻（毫秒时间戳）
    )
  `);

  return db;
}

/** 新增一笔账，返回存好后的完整记录 */
function addRecord(record) {
  const info = db.prepare(`
    INSERT INTO records (type, amount_cents, category_main, category_sub, note, date, created_at)
    VALUES (@type, @amountCents, @categoryMain, @categorySub, @note, @date, @createdAt)
  `).run({
    type: record.type,
    amountCents: record.amountCents,
    categoryMain: record.categoryMain,
    categorySub: record.categorySub,
    note: record.note || '',
    date: record.date,
    createdAt: record.createdAt || Date.now()
  });
  return getRecordById(info.lastInsertRowid);
}

/** 按编号查一笔账 */
function getRecordById(id) {
  const row = db.prepare('SELECT * FROM records WHERE id = ?').get(id);
  return row ? toRecord(row) : null;
}

/** 关闭账本（软件退出时调用，确保数据完整落盘） */
function close() {
  if (db) {
    db.close();
    db = null;
  }
}

/** 取最近几笔（首页「最近记录」用），按日期从新到旧排 */
function getRecentRecords(limit = 10) {
  const rows = db.prepare(
    'SELECT * FROM records ORDER BY date DESC, created_at DESC, id DESC LIMIT ?'
  ).all(limit);
  return rows.map(toRecord);
}

/**
 * 汇总某年某月的收支情况
 * @returns {{ expense: number, income: number, balance: number }} 单位都是「分」
 */
function getMonthlySummary(year, month) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;   // 这个月 1 号
  const end = nextMonthStart(year, month);                        // 下个月 1 号
  const rows = db.prepare(`
    SELECT type, SUM(amount_cents) AS total
    FROM records
    WHERE date >= ? AND date < ?
    GROUP BY type
  `).all(start, end);

  let expense = 0, income = 0;
  for (const r of rows) {
    if (r.type === 'expense') expense = r.total;
    if (r.type === 'income') income = r.total;
  }
  return { expense, income, balance: income - expense };
}

/** 计算下个月第一天的日期字符串（用于日期范围查询） */
function nextMonthStart(year, month) {
  if (month === 12) return `${year + 1}-01-01`;
  return `${year}-${String(month + 1).padStart(2, '0')}-01`;
}

/** 取某年某月的全部记录（账单页用），按日期从新到旧、同日按记账时刻从新到旧 */
function getRecordsByMonth(year, month) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const end = nextMonthStart(year, month);
  const rows = db.prepare(
    'SELECT * FROM records WHERE date >= ? AND date < ? ORDER BY date DESC, created_at DESC, id DESC'
  ).all(start, end);
  return rows.map(toRecord);
}

/** 某月内按「一级大类」汇总某类收支（统计占比用），金额从高到低排 */
function getCategoryTotals(year, month, type) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const end = nextMonthStart(year, month);
  const rows = db.prepare(`
    SELECT category_main AS name, SUM(amount_cents) AS total
    FROM records
    WHERE date >= ? AND date < ? AND type = ?
    GROUP BY category_main
    ORDER BY total DESC
  `).all(start, end, type);
  return rows.map(r => ({ name: r.name, total: r.total }));
}

/** 取「从某月开始，到某月结束」（含首尾）每个月的收支汇总（趋势图用），从旧到新 */
function getMonthlyTrendRange(startYear, startMonth, endYear, endMonth) {
  const list = [];
  let y = startYear, m = startMonth;
  const endKey = endYear * 12 + (endMonth - 1);
  let guard = 0;
  while (y * 12 + (m - 1) <= endKey && guard < 1200) {   // 上限 100 年，防意外死循环
    const s = getMonthlySummary(y, m);
    list.push({ year: y, month: m, expense: s.expense, income: s.income });
    m += 1;
    if (m > 12) { m = 1; y += 1; }
    guard += 1;
  }
  return list;
}

/** 全部记录里最早和最晚的日期（趋势图「全部」按钮用）；没有任何记录时返回 null */
function getDateRange() {
  const row = db.prepare('SELECT MIN(date) AS minDate, MAX(date) AS maxDate FROM records').get();
  if (!row || !row.minDate) return null;
  return { minDate: row.minDate, maxDate: row.maxDate };
}

/** 修改一笔账（按编号 id，改成 record 里的新内容），返回改好的完整记录 */
function updateRecord(id, record) {
  db.prepare(`
    UPDATE records SET
      type = @type,
      amount_cents = @amountCents,
      category_main = @categoryMain,
      category_sub = @categorySub,
      note = @note,
      date = @date
    WHERE id = @id
  `).run({
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

/** 删除一笔账 */
function deleteRecord(id) {
  db.prepare('DELETE FROM records WHERE id = ?').run(id);
}

/** 把数据库里的一行，转成界面方便使用的对象（金额从「分」换成「元」） */
function toRecord(row) {
  return {
    id: row.id,
    type: row.type,
    amountCents: row.amount_cents,
    amount: row.amount_cents / 100,
    categoryMain: row.category_main,
    categorySub: row.category_sub,
    note: row.note,
    date: row.date,
    createdAt: row.created_at
  };
}

module.exports = {
  init, close,
  addRecord, getRecordById, getRecentRecords, getMonthlySummary,
  getRecordsByMonth, getCategoryTotals, getMonthlyTrendRange, getDateRange,
  updateRecord, deleteRecord
};
