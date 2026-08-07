/**
 * 黑马记账 —— 接线文件（preload）
 *
 * 用大白话解释：软件的「界面」和「后台数据」中间隔着一道安全门。
 * 这个文件负责在这道门上开几个安全的小窗口，
 * 让界面代码能安全地使用记账功能，又碰不到电脑系统的核心区域。
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('blackhorse', {
  appVersion: '0.1.0',
  platform: process.platform, // 'win32' 是 Windows，'darwin' 是 Mac

  // —— 记账相关接口 ——
  // 新增一笔账，返回存好后的完整记录
  addRecord: (record) => ipcRenderer.invoke('db:addRecord', record),
  // 取最近几笔（首页「最近记录」用）
  getRecentRecords: (limit) => ipcRenderer.invoke('db:getRecentRecords', limit),
  // 取某年某月的收支汇总（首页三张卡片用）
  getMonthlySummary: (year, month) => ipcRenderer.invoke('db:getMonthlySummary', { year, month }),
  // —— 阶段3 新增（账单 + 统计）——
  // 取某年某月的全部记录（账单页用）
  getRecordsByMonth: (year, month) => ipcRenderer.invoke('db:getRecordsByMonth', { year, month }),
  // 取某月某类型的分类金额汇总（统计占比图用）
  getCategoryTotals: (year, month, type) => ipcRenderer.invoke('db:getCategoryTotals', { year, month, type }),
  // 取「以某月为终点」往前 count 个月的每月收支（趋势图用）
  getMonthlyTrend: (year, month, count) => ipcRenderer.invoke('db:getMonthlyTrend', { year, month, count }),
  // 修改一笔账
  updateRecord: (id, record) => ipcRenderer.invoke('db:updateRecord', { id, record }),
  // 删除一笔账
  deleteRecord: (id) => ipcRenderer.invoke('db:deleteRecord', id)
});
