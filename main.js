/**
 * 天天记账 —— 主程序文件
 *
 * 用大白话解释：这个文件是软件的「总开关」。
 * 负责：启动软件、创建窗口、把界面（src/index.html）装进窗口里，
 * 以及替界面提供「数据库服务」（记账、查账都通过这里完成）。
 */

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const db = require('./db'); // 数据库管家（见 db.js）

function createWindow() {
  // 创建一个窗口（1000×700，最小 800×600）
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    title: '天天记账',
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
// （软件改过名字时，会自动把旧名字文件夹里的账本搬过来，绝不丢数据）
function setupDatabase() {
  const dbPath = path.join(app.getPath('userData'), 'tiantian.db');
  migrateOldDatabase(dbPath);
  db.init(dbPath);
  console.log('📒 账本位置：', dbPath);
}

// 改名后第一次启动时，把旧「黑马记账」文件夹里的账本复制到新位置
function migrateOldDatabase(dbPath) {
  if (fs.existsSync(dbPath)) return; // 新位置已有账本，不用搬

  const oldDbPath = path.join(app.getPath('appData'), '黑马记账', 'blackhorse.db');
  if (fs.existsSync(oldDbPath)) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    fs.copyFileSync(oldDbPath, dbPath);
    console.log('📦 已把旧账本（黑马记账）复制到新位置：', dbPath);
  }
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
  // —— 阶段4 新增（导出备份）——
  ipcMain.handle('export:exportCsv', exportCsv);
}

/**
 * 把全部账目导出成一个 CSV 表格文件（导出备份）
 * 会先弹出一个「保存位置」窗口，用户选好位置后写入文件。
 * @returns {{ ok: true, path: string, count: number } | { ok: false, canceled?: boolean, error?: string }}
 */
async function exportCsv(event) {
  const records = db.getAllRecords();
  const csv = buildCsv(records);

  const win = BrowserWindow.fromWebContents(event.sender);
  const now = new Date();
  const fileName = `天天记账备份_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}.csv`;

  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: '导出记账备份',
    defaultPath: path.join(app.getPath('downloads'), fileName),
    filters: [{ name: 'CSV 表格', extensions: ['csv'] }]
  });

  if (canceled || !filePath) return { ok: false, canceled: true };

  try {
    fs.writeFileSync(filePath, csv, 'utf8');
  } catch (err) {
    return { ok: false, canceled: false, error: err.message };
  }

  return { ok: true, path: filePath, count: records.length };
}

/**
 * 把账目列表拼成 CSV 文本
 * - 开头加一个隐形标记（UTF-8 BOM），保证 Excel 打开时中文不乱码
 * - 字段里如果带逗号/引号/换行，自动加引号转义，保证表不错位
 */
function buildCsv(records) {
  const esc = (value) => {
    const s = String(value ?? '');
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };

  const rows = [['日期', '类型', '一级分类', '二级分类', '金额（元）', '备注']];
  for (const r of records) {
    rows.push([
      r.date,
      r.type === 'income' ? '收入' : '支出',
      r.categoryMain,
      r.categorySub,
      (r.amountCents / 100).toFixed(2),
      r.note
    ]);
  }

  return '﻿' + rows.map(row => row.map(esc).join(',')).join('\r\n');
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
