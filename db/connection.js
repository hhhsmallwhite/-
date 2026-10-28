/**
 * 天天记账 —— 账本「连接与升级」
 *
 * 大白话：这个文件只干两件事——把账本文件打开，以及把账本「升级到最新版本」。
 * 具体怎么记账、怎么查账，都在同目录的 records.js（记账）和 stats.js（算账）里，
 * 这里不管那些，免得一个文件又长又杂。
 *
 * 为什么要有「升级」这一步：
 * 用户电脑里的账本已经存着真实数据，不能删了重建。所以每次改表结构，
 * 都要在 migrations.js 里记一笔，打开账本时自动补做没做过的部分（见 migrations.js 的说明）。
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { MIGRATIONS } = require('./migrations');

// 整个软件同时只开一个账本，所以这里用「单例」：打开一次，之后都复用这一个
let connection = null;

/**
 * 打开账本文件（第一次打开会自动建文件、建表），并升级到最新结构。
 * @param {string} dbPath 账本文件的完整路径
 * @returns {import('better-sqlite3').Database} 数据库对象
 */
function open(dbPath) {
  if (connection) return connection; // 已经打开过就直接复用，不要开第二个

  // 首次运行时账本所在的文件夹可能还不存在，先补上
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  connection = new Database(dbPath);

  // 有意不用 WAL 模式：WAL 会在账本旁边多出 -wal / -shm 两个文件，
  // 而本软件对用户的承诺是「备份 = 把这一个文件拷走」。多出文件会让人以为数据不全。
  connection.pragma('foreign_keys = ON');

  runMigrations(connection);
  return connection;
}

/**
 * 把账本升级到最新结构：只做「还没做过」的那几步。
 * 做法：读 SQLite 自带的 user_version（一个整数，记着当前改到第几号），
 * 然后从它的下一个号开始，一条条往后执行。
 * @param {import('better-sqlite3').Database} db
 */
function runMigrations(db) {
  const current = db.pragma('user_version', { simple: true }) || 0;
  const pending = MIGRATIONS.filter((m) => m.version > current);

  for (const migration of pending) {
    // 每一步都包在事务里：中途出错就整体回滚，账本不会停在「改了一半」的状态
    const step = db.transaction(() => {
      migration.up(db);
      db.pragma(`user_version = ${migration.version}`);
    });

    try {
      step();
    } catch (err) {
      // 把出错的是哪一步说清楚，方便排查（例如磁盘满、文件被占用）
      throw new Error(`账本升级失败（第 ${migration.version} 步：${migration.name}）：${err.message}`);
    }
  }
}

/**
 * 拿到已经打开的账本。没打开就报错，而不是悄悄返回 null。
 * 这样一旦哪里漏了初始化，会立刻暴露出来，不会等到用户点保存才莫名其妙失败。
 * @returns {import('better-sqlite3').Database}
 */
function get() {
  if (!connection) throw new Error('账本还没打开，请先调用 db.open() 打开它');
  return connection;
}

/** 干净地关上账本（软件退出时调用，确保数据完整落到硬盘上） */
function close() {
  if (!connection) return;
  connection.close();
  connection = null;
}

/** 当前账本的结构版本号（升级到第几号了），排查问题时用 */
function schemaVersion() {
  return get().pragma('user_version', { simple: true }) || 0;
}

module.exports = { open, get, close, schemaVersion };
