/**
 * 天天记账 —— 窗口的「安全设置」
 *
 * 大白话：软件的界面其实是一个网页，装在一个「外壳」里。外壳如果不设防，
 * 网页里的代码就能随便翻你电脑上的文件。所以这里把几道门都锁上：
 *
 *   contextIsolation: true  → 界面代码和外壳代码隔在两个房间，互相看不见对方的东西
 *   nodeIntegration: false  → 界面里拿不到 fs、child_process 这些能碰电脑的工具
 *   sandbox: true           → 界面跑在沙箱里，权限降到最低（只留 preload 那条通道）
 *
 * 界面唯一能办事的路，就是 preload.js 上开的那 13 个窗口（见 main/channels.js）。
 * 这些开关只在这里设一次，别在别处改——安全设置散着写最容易出事。
 */

const { BrowserWindow } = require('electron');
const path = require('path');

/**
 * 创建主窗口并装上界面
 * @returns {BrowserWindow}
 */
function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    title: '天天记账',
    autoHideMenuBar: true, // 藏掉顶部默认菜单，界面更干净
    backgroundColor: '#f5f7f9', // 窗口刚开、界面还没画出来时不至于闪一片白
    webPreferences: {
      // preload 是唯一的安全通道，路径从 main/ 往上退一级到项目根目录
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  // 本软件没有任何「点开新窗口」的需求，一律拒绝，免得将来某个链接把界面带走
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  // 把界面文件装进窗口
  win.loadFile(path.join(__dirname, '..', 'src', 'index.html'));

  return win;
}

module.exports = { createWindow };
