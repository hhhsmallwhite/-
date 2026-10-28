/**
 * 天天记账 —— 「选文件」的交互流程
 *
 * 大白话：有两件事需要先让用户在系统窗口里挑一个文件——
 * 「从备份恢复」要挑一份 .db，「导入 CSV」要挑一张表。
 * 这类「弹窗 → 用户选 → 拿着路径去干活」的流程，既不属于开机流程，
 * 也不属于纯粹的备份/导入逻辑（那两个模块不碰弹窗，好在 node 里单测）。
 * 所以单独放这一个文件，谁也别硬塞。
 *
 * 设计上把 dialog 当参数传进来（而不是 require('electron')），
 * 好处是这个文件不需要 Electron 也能跑测试——塞个假的 dialog 就行。
 */

const backup = require('./backup');
const importCsv = require('./import-csv');

/**
 * 弹框让用户挑一份账本备份，然后换回来。
 * 换之前 backup.restore 会先把现在这本存一份（名字带 before-restore），
 * 所以「手滑选错」也有得退。
 * @param {object} ctx 依赖集合
 * @param {BrowserWindow} ctx.win 挂在哪个窗口上弹
 * @param {object} ctx.dialog Electron 的 dialog
 * @param {string} ctx.dbPath 当前账本路径
 * @param {string} ctx.backupDir 备份目录（弹框默认打开这里）
 * @param {object} ctx.db 账本模块
 * @returns {Promise<object>} { ok, count } 或 { ok:false, canceled } 或 { ok:false, error }
 */
async function pickBackupAndRestore(ctx) {
  const picked = await ctx.dialog.showOpenDialog(ctx.win, {
    title: '选择要恢复的账本备份',
    defaultPath: ctx.backupDir,
    filters: [{ name: '账本备份', extensions: ['db'] }],
    properties: ['openFile']
  });

  // 用户点了取消：不算失败，如实告诉界面「没动」
  if (picked.canceled || !picked.filePaths.length) return { ok: false, canceled: true };

  const result = backup.restore({
    dbPath: ctx.dbPath,
    dir: ctx.backupDir,
    sourcePath: picked.filePaths[0],
    schemaVersion: ctx.db.schemaVersion()
  }, ctx.db);

  console.log(`恢复账本：${result.ok ? `成功，现有 ${result.count} 笔账` : result.error}`);
  return result;
}

/**
 * 弹框让用户挑一个 CSV，把里面的账导回账本
 * @param {object} ctx 依赖集合
 * @param {BrowserWindow} ctx.win 挂在哪个窗口上弹
 * @param {object} ctx.dialog Electron 的 dialog
 * @param {object} ctx.db 账本模块
 * @returns {Promise<object>} { ok, imported, skipped, problems } 或 { ok:false, canceled }
 */
async function pickCsvAndImport(ctx) {
  const picked = await ctx.dialog.showOpenDialog(ctx.win, {
    title: '选择要导入的 CSV 表格',
    filters: [{ name: 'CSV 表格', extensions: ['csv'] }],
    properties: ['openFile']
  });

  if (picked.canceled || !picked.filePaths.length) return { ok: false, canceled: true };

  const result = importCsv.runImport({ db: ctx.db, filePath: picked.filePaths[0] });
  console.log(`导入 CSV：新进 ${result.imported || 0} 笔，跳过重复 ${result.skipped || 0} 笔`);
  return result;
}

module.exports = { pickBackupAndRestore, pickCsvAndImport };
