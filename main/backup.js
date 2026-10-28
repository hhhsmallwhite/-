/**
 * 天天记账 —— 账本备份与恢复
 *
 * 大白话：账本就是电脑上的一个文件。文件会丢——误删、硬盘坏、软件升级出岔子。
 * 这个文件给账本上一道保险：
 *
 *   自动备份：每次打开软件时，把账本复制一份到 backups 文件夹（同一天只备一次）
 *   手动备份：设置页点一下，立刻再存一份
 *   恢复：从备份文件里挑一份换回来（换之前会先把现在这本再存一份，防止后悔）
 *   清理：自动备份只留最近 7 份，手动和恢复前的只留 3 份，不会把硬盘塞满
 *
 * 为什么自动备份要放在「打开账本之前」：
 * 这样每天的那份一定是「今天动过之前」的状态。万一升级账本结构出了岔子，
 * 手里这份就是升级前的原样，能原封不动换回去。
 *
 * 这个文件不碰 Electron（不弹窗、不读界面），弹窗由调用方传路径进来，
 * 所以可以用 node 直接跑测试。
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// SQLite 文件开头的 16 个字节永远是这个标记，用它一眼判断「是不是数据库文件」
const SQLITE_MAGIC = 'SQLite format 3\u0000';

// 保留份数：自动/手动 7 份，恢复前的现场 3 份
const KEEP = 7;
const KEEP_BEFORE_RESTORE = 3;

// 备份文件名：tiantian-20261028-202600.db（年月日-时分秒）
const BACKUP_RE = /^tiantian-(\d{8})-(\d{6})\.db$/;
// 恢复前自动存的那份：tiantian-before-restore-20261028-202600.db
const BEFORE_RE = /^tiantian-before-restore-(\d{8})-(\d{6})\.db$/;

/** 补零 */
function pad2(n) {
  return String(n).padStart(2, '0');
}

/**
 * 文件名里用的时间戳
 * @param {Date} date
 * @returns {{day: string, time: string}} day=20261028，time=202600
 */
function stamps(date) {
  const day = `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}`;
  const time = `${pad2(date.getHours())}${pad2(date.getMinutes())}${pad2(date.getSeconds())}`;
  return { day, time };
}

/**
 * 判断一个文件是不是 SQLite 数据库（只看头 16 字节，很快）
 * @param {string} file
 * @returns {boolean}
 */
function isSqliteFile(file) {
  try {
    const fd = fs.openSync(file, 'r');
    const buf = Buffer.alloc(16);
    fs.readSync(fd, buf, 0, 16, 0);
    fs.closeSync(fd);
    return buf.toString('utf8', 0, 16) === SQLITE_MAGIC.slice(0, 16);
  } catch (err) {
    return false;
  }
}

/**
 * 列出备份文件（新的在前）
 * @param {string} dir 备份目录
 * @param {'backup'|'before'} [kind] backup=日常备份，before=恢复前的现场
 * @returns {{name: string, path: string, size: number, mtime: number}[]}
 */
function listBackups(dir, kind = 'backup') {
  const pattern = kind === 'before' ? BEFORE_RE : BACKUP_RE;
  try {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .filter((name) => pattern.test(name))
      .map((name) => {
        const full = path.join(dir, name);
        const stat = fs.statSync(full);
        return { name, path: full, size: stat.size, mtime: stat.mtimeMs };
      })
      .sort((a, b) => b.name.localeCompare(a.name)); // 名字里带时间，倒序就是新的在前
  } catch (err) {
    return [];
  }
}

/**
 * 清理太老的备份，只留最近 keep 份
 * @param {string} dir
 * @param {'backup'|'before'} kind
 * @param {number} keep
 * @returns {number} 删掉了几个
 */
function prune(dir, kind, keep) {
  const list = listBackups(dir, kind);
  let removed = 0;
  for (const item of list.slice(keep)) {
    try {
      fs.unlinkSync(item.path);
      removed += 1;
    } catch (err) {
      // 删不掉（被占用）就算了，下次再删
    }
  }
  return removed;
}

/**
 * 复制一份账本到备份目录
 * @param {string} dbPath 账本文件
 * @param {string} dir 备份目录
 * @param {Date} now 用来生成文件名
 * @param {string} [prefix] 文件名前缀，默认 tiantian
 * @returns {{path: string, size: number}}
 */
function copyTo(dbPath, dir, now, prefix = 'tiantian') {
  fs.mkdirSync(dir, { recursive: true });
  const { day, time } = stamps(now);
  const target = path.join(dir, `${prefix}-${day}-${time}.db`);
  fs.copyFileSync(dbPath, target);
  return { path: target, size: fs.statSync(target).size };
}

/**
 * 启动时的自动备份：同一天只备一次，没账本就不备
 * @param {{dbPath: string, dir: string, now?: Date}} options
 * @returns {{ok: boolean, skipped?: string, path?: string, removed?: number}}
 */
function backupIfNeeded(options) {
  const now = options.now || new Date();
  const { dbPath, dir } = options;

  // 第一次装软件，账本还不存在：没什么可备的
  if (!fs.existsSync(dbPath)) return { ok: false, skipped: '还没有账本' };

  // 账本旁边有 -journal 文件，说明上次是「非正常退出」，文件正处于半改状态。
  // 这时候复制出来的可能是坏账本，宁可不备。
  if (fs.existsSync(`${dbPath}-journal`)) return { ok: false, skipped: '账本处于未完成状态（上次异常退出），本次不备份' };

  // 今天已经备过就跳过，免得一天开十次软件就刷掉十份历史
  const { day } = stamps(now);
  const already = listBackups(dir).some((item) => BACKUP_RE.exec(item.name)[1] === day);
  if (already) return { ok: false, skipped: '今天已经备份过' };

  try {
    const copied = copyTo(dbPath, dir, now);
    const removed = prune(dir, 'backup', KEEP);
    return { ok: true, path: copied.path, removed };
  } catch (err) {
    // 备份失败不能拦着用户用软件，如实返回原因即可
    return { ok: false, skipped: `备份失败：${err.message}` };
  }
}

/**
 * 手动备份（设置页点「立即备份」）：不管今天备过没有，都再存一份
 * @param {{dbPath: string, dir: string, now?: Date}} options
 * @returns {{ok: boolean, path?: string, error?: string, removed?: number}}
 */
function createNow(options) {
  const now = options.now || new Date();
  if (!fs.existsSync(options.dbPath)) return { ok: false, error: '还没有账本文件' };

  try {
    const copied = copyTo(options.dbPath, options.dir, now);
    const removed = prune(options.dir, 'backup', KEEP);
    return { ok: true, path: copied.path, removed };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * 检查一个候选文件「像不像一本能用的账本」
 * @param {string} file
 * @returns {{ok: boolean, error?: string, count?: number, version?: number}}
 */
function inspect(file) {
  if (!fs.existsSync(file)) return { ok: false, error: '文件不存在' };
  if (!isSqliteFile(file)) return { ok: false, error: '这不是数据库文件（可能是别的东西改了扩展名）' };

  let raw = null;
  try {
    raw = new Database(file, { readonly: true, fileMustExist: true });
    const table = raw.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'records'").get();
    if (!table) return { ok: false, error: '这个数据库里没有账目表，不是天天记账的备份' };

    const count = raw.prepare('SELECT COUNT(*) AS n FROM records').get().n;
    const version = raw.pragma('user_version', { simple: true }) || 0;
    return { ok: true, count, version };
  } catch (err) {
    return { ok: false, error: `打不开这个文件：${err.message}` };
  } finally {
    if (raw) {
      try { raw.close(); } catch (err) { /* 已经关了 */ }
    }
  }
}

/**
 * 用一份备份替换当前账本。
 * 步骤：检查备份 → 先把当前账本存一份「恢复前现场」→ 关库 → 覆盖 → 重开。
 * @param {{dbPath: string, dir: string, sourcePath: string, schemaVersion: number}} options
 *        schemaVersion 是当前软件支持的账本结构版本，用来挡住「更新版本生成的备份」
 * @param {object} db 账本模块（用到它的 close / open / getAllRecords）
 * @param {Date} [now]
 * @returns {{ok: boolean, error?: string, count?: number, safety?: string}}
 */
function restore(options, db, now = new Date()) {
  const { dbPath, dir, sourcePath, schemaVersion } = options;

  // ① 用户要是把「正在用的这本」选成了备份源，先拦住：复制给自己是没意义的操作
  if (path.resolve(sourcePath) === path.resolve(dbPath)) {
    return { ok: false, error: '这份就是当前正在用的账本，不需要恢复' };
  }

  // ② 先确认这个文件确实是一本账本
  const check = inspect(sourcePath);
  if (!check.ok) return { ok: false, error: check.error };

  // ③ 比当前软件还新的账本结构，换回来也用不了（缺字段），直接拦住
  if (typeof check.version === 'number' && check.version > schemaVersion) {
    return { ok: false, error: `这份备份来自更新版本的软件（账本结构 v${check.version}），请先升级软件再恢复` };
  }

  // ④ 先把现在这本存一份，万一用户选错了还有得退
  let safety = null;
  try {
    const copied = copyTo(dbPath, dir, now, 'tiantian-before-restore');
    prune(dir, 'before', KEEP_BEFORE_RESTORE);
    safety = copied.path;
  } catch (err) {
    // 存不了就算，不能因为这一步把恢复整个卡死
  }

  // ⑤ 关库、覆盖、重开。覆盖失败要把原账本重新打开，别让软件卡在「没有账本」的状态
  db.close();

  try {
    fs.copyFileSync(sourcePath, dbPath);
  } catch (err) {
    try { db.open(dbPath); } catch (e2) { /* 真的打不开就交给上层报错 */ }
    return { ok: false, error: `替换账本失败：${err.message}` };
  }

  try {
    db.open(dbPath);
  } catch (err) {
    return { ok: false, error: `恢复后账本打不开：${err.message}` };
  }

  return { ok: true, count: db.getAllRecords().length, safety };
}

/**
 * 备份现状（设置页那行小字用）
 * @param {string} dir
 * @returns {{count: number, latest: string|null, dir: string}}
 */
function info(dir) {
  const list = listBackups(dir);
  return {
    count: list.length,
    latest: list.length ? list[0].name : null,
    dir
  };
}

module.exports = {
  backupIfNeeded,
  createNow,
  restore,
  inspect,
  info,
  listBackups,
  isSqliteFile,
  KEEP
};
