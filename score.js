/**
 * 贪吃蛇 —— 最高分小文件读写
 *
 * 大白话：记游戏成绩用的"小盒子"。成绩单独存在一个小文件里，
 * 跟账本数据库完全分开，玩游戏永远碰不到记账数据。
 * 这个小模块不带 Electron，可以单独用 node 测试。
 */

const fs = require('fs');
const path = require('path');

// 读最高分：文件不存在、内容损坏、不是数字时一律按 0 处理，绝不报错
function readHighScore(filePath) {
  try {
    if (!fs.existsSync(filePath)) return 0;
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const n = Number(data && data.highScore);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch (e) {
    return 0;
  }
}

// 写最高分：负数按 0、小数向下取整；写失败静默忽略，游戏不受影响
function writeHighScore(filePath, score) {
  const n = Math.max(0, Math.floor(Number(score) || 0));
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify({ highScore: n }), 'utf8');
  } catch (e) {
    /* 写不上就算了 */
  }
  return n;
}

module.exports = { readHighScore, writeHighScore };
