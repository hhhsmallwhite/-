/**
 * 天天记账 —— 账本模块的统一大门
 *
 * 大白话：这个文件夹里分工是——
 *   connection.js  打开账本、升级结构
 *   records.js     记一笔 / 改一笔 / 删一笔 / 查账
 *   stats.js       算汇总、算分类占比、算趋势
 *   month.js       年月换日期范围
 *   row.js         数据库一行 ↔ 界面对象
 *   migrations.js  结构升级清单
 * 外面（主进程）只认这个 index，不直接去找里面的小文件。
 * 好处：以后想换数据库、加缓存，只要这个大门保持不变，外面一行都不用改。
 */

const connection = require('./connection');
const records = require('./records');
const stats = require('./stats');

module.exports = {
  // —— 打开 / 关闭 ——
  /** 打开账本（参数：账本文件完整路径）。重复调用只会打开一次 */
  open: connection.open,
  /** 兼容老写法：以前叫 init，现在等于 open */
  init: connection.open,
  /** 关掉账本（退出软件时调） */
  close: connection.close,
  /** 当前账本的结构版本（排查问题用） */
  schemaVersion: connection.schemaVersion,

  // —— 记一笔、改一笔、删一笔、查账 ——
  addRecord: records.addRecord,
  addRecordsBatch: records.addRecordsBatch,
  getRecordById: records.getRecordById,
  getRecentRecords: records.getRecentRecords,
  getRecordsByMonth: records.getRecordsByMonth,
  getAllRecords: records.getAllRecords,
  updateRecord: records.updateRecord,
  deleteRecord: records.deleteRecord,

  // —— 算账 ——
  getMonthlySummary: stats.getMonthlySummary,
  getCategoryTotals: stats.getCategoryTotals,
  getMonthlyTrendRange: stats.getMonthlyTrendRange,
  getDateRange: stats.getDateRange
};
