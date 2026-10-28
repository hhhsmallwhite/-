/**
 * 天天记账 —— 接线文件（preload）
 *
 * 大白话：界面和电脑之间隔着一道安全门（见 main/window.js 的三个开关）。
 * 这个文件负责在门上开几个「只能办特定事」的小窗口：
 * 界面能通过它们记账、看统计，但碰不到电脑里的其它东西。
 *
 * 开哪些窗口、叫什么名字，必须和 main/channels.js 里的清单一一对应。
 * test/ipc-contract.test.js 会自动核对这件事——改了一头忘了另一头，测试会红。
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tiantian', {
  // 运行平台：'win32' 是 Windows，'darwin' 是 Mac（界面按平台微调时用）
  platform: process.platform,

  // 软件信息（版本号之类）。版本号存在主进程，这里不写死，
  // 免得出现「关于页面写着 0.1.0、实际装的是 0.2.0」这种自打嘴巴的情况
  getAppInfo: () => ipcRenderer.invoke('app:getInfo'),

  // —— 记账相关 ——

  /** 新增一笔账，返回存好后的完整记录 */
  addRecord: (record) => ipcRenderer.invoke('db:addRecord', record),

  /** 取最近几笔（首页「最近记录」用） */
  getRecentRecords: (limit) => ipcRenderer.invoke('db:getRecentRecords', limit),

  /** 取某年某月的收支汇总（首页三张卡片用） */
  getMonthlySummary: (year, month) => ipcRenderer.invoke('db:getMonthlySummary', { year, month }),

  /** 取某年某月的全部记录（账单页用） */
  getRecordsByMonth: (year, month) => ipcRenderer.invoke('db:getRecordsByMonth', { year, month }),

  /** 取某月某类型的分类金额汇总（环形图用） */
  getCategoryTotals: (year, month, type) => ipcRenderer.invoke('db:getCategoryTotals', { year, month, type }),

  /** 取「从某月到某月」每个月的收支（趋势图用） */
  getMonthlyTrend: (startYear, startMonth, endYear, endMonth) =>
    ipcRenderer.invoke('db:getMonthlyTrend', { startYear, startMonth, endYear, endMonth }),

  /** 取全部记录里最早和最晚的日期（趋势图「全部」用） */
  getDateRange: () => ipcRenderer.invoke('db:getDateRange'),

  /** 修改一笔账 */
  updateRecord: (id, record) => ipcRenderer.invoke('db:updateRecord', { id, record }),

  /** 删除一笔账 */
  deleteRecord: (id) => ipcRenderer.invoke('db:deleteRecord', id),

  // —— 导出备份 ——

  /** 把全部账目导出成 CSV（会弹「保存到哪儿」的框），返回 { ok, path, count } 或 { ok:false, canceled } */
  exportCsv: () => ipcRenderer.invoke('export:exportCsv'),

  // —— 贪吃蛇最高分（跟账本无关，单独存一个小文件） ——

  /** 读历史最高分（文件不存在时是 0） */
  getHighScore: () => ipcRenderer.invoke('game:getHighScore'),

  /** 保存新的最高分，返回 { ok, value }——ok 为 false 表示没写进去，界面要如实告诉用户 */
  setHighScore: (score) => ipcRenderer.invoke('game:setHighScore', score)
});
