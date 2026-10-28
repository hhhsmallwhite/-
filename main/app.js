/**
 * 天天记账 —— 软件的生命周期（开、关、出错）
 *
 * 大白话：这个文件管「软件的开关机流程」：
 *   1. 先上锁：只允许开一个窗口（不然两个窗口同时改同一个账本会打架）；
 *   2. 开机自检：打开账本 → 接好电话线（注册通道）→ 开窗口；
 *   3. 自检失败：弹一个人话对话框说清原因，然后退出——绝不能「点了没反应」；
 *   4. 关机：把账本干净地关上，确保数据完整落盘。
 *
 * 顺序很重要：账本没打开就开窗口，用户能点能填，但保存必然失败，
 * 那才是最气人的体验。所以宁可打不开就明说。
 */

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const db = require('../db');
const paths = require('./paths');
const ipc = require('./ipc');
const { exportCsv } = require('./export-csv');
const { createWindow } = require('./window');

// 当前的主窗口（第二实例被拦下时，要把它叫到前面来）
let mainWindow = null;

/**
 * 开窗口并把引用记下来
 * @returns {BrowserWindow}
 */
function openWindow() {
  mainWindow = createWindow();
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  return mainWindow;
}

/**
 * 注册全部通道（把 Electron 的 dialog、窗口这些东西接到 ipc.js 上）
 */
function registerIpc() {
  ipc.register(ipcMain, {
    // 版本号只有一个真源头：package.json。界面从这里问，永远不会自相矛盾。
    // 为什么不直接用 app.getVersion()：它返回什么取决于 Electron 怎么被启动的
    // （用 `electron test/xxx.js` 跑测试时会返回 Electron 自己的版本），
    // 直接读 package.json 则「开发时 / 打包后 / 跑测试时」三种情况完全一致。
    appInfo: {
      version: require('../package.json').version,
      electron: process.versions.electron,
      platform: process.platform === 'darwin' ? 'macOS' : 'Windows'
    },
    highScorePath: paths.highScorePath(app),
    // 导出要弹「保存到哪儿」，这是主进程才能干的事，用闭包把当下这个窗口传进去
    exportTo: (event) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      return exportCsv({
        db,
        dialog,
        win,
        downloadsPath: app.getPath('downloads')
      });
    }
  });
}

/**
 * 开机自检：打开账本 → 接电话线 → 开窗口
 */
function bootstrap() {
  const file = paths.dbPath(app);

  // 老用户（软件以前叫「黑马记账」）的账本要从旧文件夹搬过来
  if (paths.migrateLegacy(app, file)) {
    console.log('已把旧账本（黑马记账）搬到新位置：', file);
  }

  db.open(file);
  console.log('账本位置：', file);
  console.log('账本结构版本：', db.schemaVersion());

  registerIpc();
  openWindow();
}

/**
 * 自检失败时的「最后一道人话提示」。
 * 最常见的两种原因：better-sqlite3 与 Electron 版本对不上（升级后才会遇到）、
 * 账本文件被别的程序占着。
 * @param {Error} err
 */
function failToStart(err) {
  const detail = err && err.message ? err.message : String(err);
  dialog.showErrorBox(
    '天天记账打不开',
    `账本没能打开，软件无法启动。\n\n可能的原因：\n· 账本文件正被另一个程序占用\n· 磁盘空间不足\n· 软件升级后组件不匹配\n\n技术细节：${detail}`
  );
  app.quit();
}

/**
 * 启动整个软件
 */
function start() {
  // ① 只允许开一个实例：双击第二次时，把已经开着的窗口叫到前面来，而不是再开一个
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }

  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  // ② 系统就绪后自检。用 try/catch 包住：出错要弹框说人话，不能静默退出
  app.whenReady().then(() => {
    try {
      bootstrap();
    } catch (err) {
      failToStart(err);
    }
  });

  // ③ Mac 上点了 Dock 图标但没窗口时，重新开一个
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) openWindow();
  });

  // ④ 关掉所有窗口就退出（Mac 的规矩是先留在菜单栏，所以那边不退出）
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  // ⑤ 退出前把账本关上，确保数据完整落盘
  app.on('before-quit', () => db.close());
}

module.exports = { start, bootstrap, registerIpc };
