/**
 * 黑马记账 —— 主程序文件
 *
 * 用大白话解释：这个文件是软件的「总开关」。
 * 负责：启动软件、创建一个窗口、把界面（src/index.html）装进窗口里。
 *
 * 目前只有"开窗口"这一件事，后续阶段会在这里加数据库等后台能力。
 */

const { app, BrowserWindow } = require('electron');
const path = require('path');

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

// 软件启动就绪后，创建窗口
app.whenReady().then(() => {
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
