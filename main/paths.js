/**
 * 天天记账 —— 数据存在哪儿（路径与老账本搬家）
 *
 * 大白话：这个文件只管「账本文件放在哪个文件夹」。
 * 正式安装的软件，账本放在系统的「用户数据文件夹」里（Windows 上是
 * C:\Users\你的名字\AppData\Roaming\天天记账\），这样卸了重装、升级版本都不会丢。
 *
 * 另外还管一件历史遗留的事：这个软件以前叫「黑马记账」，改名之后，
 * 老用户的账本还在旧文件夹里。这里负责在第一次启动时把它搬到新位置，
 * 而不是让用户以为「数据没了」。
 */

const path = require('path');
const fs = require('fs');

/**
 * 账本文件的完整路径
 * @param {import('electron').App} app Electron 的 app 对象（用它才能拿到用户数据目录）
 * @returns {string}
 */
function dbPath(app) {
  return path.join(app.getPath('userData'), 'tiantian.db');
}

/**
 * 贪吃蛇最高分小文件的路径（跟账本分开存，玩游戏碰不到账本）
 * @param {import('electron').App} app
 * @returns {string}
 */
function highScorePath(app) {
  return path.join(app.getPath('userData'), 'snake_highscore.json');
}

/**
 * 从旧名字（黑马记账）的文件夹里，把老账本搬过来。
 * 只在「新位置还没有账本、旧位置有」的时候搬一次，之后就不再管了。
 * @param {import('electron').App} app
 * @param {string} targetPath 新账本路径
 * @returns {boolean} 真的搬了返回 true
 */
function migrateLegacy(app, targetPath) {
  if (fs.existsSync(targetPath)) return false; // 新位置已经有账本，不用搬

  const legacyPath = path.join(app.getPath('appData'), '黑马记账', 'blackhorse.db');
  if (!fs.existsSync(legacyPath)) return false; // 没有老账本（新用户）

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  // 用「复制」而不是「移动」：万一新位置出问题，老文件还在，不会两头空
  fs.copyFileSync(legacyPath, targetPath);
  return true;
}

module.exports = { dbPath, highScorePath, migrateLegacy };
