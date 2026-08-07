/**
 * 黑马记账 —— 主程序文件
 *
 * 用大白话解释：这个文件是软件的「总开关」。
 * 负责：启动软件、创建窗口、把界面（src/index.html）装进窗口里，
 * 以及替界面提供「数据库服务」（记账、查账都通过这里完成）。
 */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const db = require('./db'); // 数据库管家（见 db.js）

function createWindow() {
  // 创建一个窗口（1000×700，最小 800×600）
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    title: '黑马记账',
    autoHideMenuBar: true, // 自动隐藏顶部默认菜单，让界面更简洁
    backgroundColor: '#f5f7f9',
    webPreferences: {
      // preload：窗口打开前先运行的一小段"接线"代码，见 preload.js
      preload: path.join(__dirname, 'preload.js'),
      // 安全设置：界面代码不能直接碰电脑系统，必须通过 preload 转接
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // 把界面文件（index.html）装进窗口
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
}

// 打开账本：文件放在系统「用户数据文件夹」里，随软件走
function setupDatabase() {
  const dbPath = path.join(app.getPath('userData'), 'blackhorse.db');
  db.init(dbPath);
  console.log('📒 账本位置：', dbPath);
}

// 登记「界面能调用的数据库服务」（界面通过 preload 安全地来调用）
function registerIpcHandlers() {
  ipcMain.handle('db:addRecord', (_event, record) => db.addRecord(record));
  ipcMain.handle('db:getRecentRecords', (_event, limit) => db.getRecentRecords(limit || 10));
  ipcMain.handle('db:getMonthlySummary', (_event, { year, month }) => db.getMonthlySummary(year, month));
  // —— 阶段3 新增 ——
  ipcMain.handle('db:getRecordsByMonth', (_event, { year, month }) => db.getRecordsByMonth(year, month));
  ipcMain.handle('db:getCategoryTotals', (_event, { year, month, type }) => db.getCategoryTotals(year, month, type));
  ipcMain.handle('db:getMonthlyTrend', (_event, { startYear, startMonth, endYear, endMonth }) => db.getMonthlyTrendRange(startYear, startMonth, endYear, endMonth));
  ipcMain.handle('db:getDateRange', () => db.getDateRange());
  ipcMain.handle('db:updateRecord', (_event, { id, record }) => db.updateRecord(id, record));
  ipcMain.handle('db:deleteRecord', (_event, id) => db.deleteRecord(id));
}

// 软件启动就绪后：先打开账本、登记服务，再创建窗口
app.whenReady().then(() => {
  setupDatabase();
  registerIpcHandlers();
  createWindow();

  // Mac 特有：点了 Dock 图标但没窗口时，重新开一个窗口
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// 关闭所有窗口时退出软件（Mac 例外：先留在菜单栏）
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// 软件退出前，把账本文件干净地关上，确保数据完整保存
app.on('before-quit', () => db.close());
