/**
 * 天天记账 —— 日志（出事了能查到原因）
 *
 * 大白话：软件装在用户电脑上，一旦崩了，用户能提供的信息只有一句「打不开了」。
 * 这个文件的作用就是：把主进程里发生的事、以及崩掉的原因，写进一个文本文件，
 * 用户把这个文件发过来，就能看出到底是哪一步出的问题。
 *
 * 日志放在 %APPDATA%\天天记账\logs\ 下面，按天分文件，只留最近 7 天。
 * 为什么要按天分：一个文件越写越大，发过来几百兆谁也不想看；
 * 按天分开，出问题那天的那一份通常几十 KB，够用。
 */

const fs = require('fs');
const path = require('path');

// 日志目录和保留天数（init 时设定）
let logDir = null;
let keepDays = 7;

// 是否已经接管过 console（避免重复接管导致同一句话写两遍）
let installed = false;

// 原始的 console 方法，接管后还要靠它们把内容照常打印到屏幕上
const original = {
  log: console.log.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console)
};

/**
 * 补零到两位
 * @param {number} n
 * @returns {string}
 */
function pad2(n) {
  return String(n).padStart(2, '0');
}

/**
 * 今天的日期戳，形如 2026-10-28
 * @param {Date} [date]
 * @returns {string}
 */
function dayStamp(date = new Date()) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/**
 * 现在是几点几分几秒，形如 20:26:02.123
 * @returns {string}
 */
function timeStamp() {
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, '0')}`;
}

/**
 * 把任意东西变成一行能读的文字（Error 要带堆栈，对象要能看清内容）
 * @param {*} value
 * @returns {string}
 */
function stringify(value) {
  if (value instanceof Error) return value.stack || `${value.name}: ${value.message}`;
  if (typeof value === 'string') return value;
  if (value === undefined) return 'undefined';

  try {
    return JSON.stringify(value);
  } catch (err) {
    // 循环引用之类的怪东西，退回最朴素的办法
    return String(value);
  }
}

/**
 * 往日志文件里追加一行（不抛错：日志写失败绝不能影响软件本身）
 * @param {string} level 级别：INFO / WARN / ERROR
 * @param {string} text 内容
 */
function append(level, text) {
  if (!logDir) return;
  try {
    fs.mkdirSync(logDir, { recursive: true });
    const line = `[${dayStamp()} ${timeStamp()}] [${level}] ${text}\n`;
    fs.appendFileSync(path.join(logDir, `main-${dayStamp()}.log`), line, 'utf8');
  } catch (err) {
    // 磁盘满、没权限：只能放弃写文件，屏幕上那条还在
  }
}

/**
 * 删掉太老的日志，只留最近 keepDays 天
 */
function prune() {
  if (!logDir) return;
  try {
    if (!fs.existsSync(logDir)) return;
    const cutoff = Date.now() - keepDays * 24 * 60 * 60 * 1000;
    for (const name of fs.readdirSync(logDir)) {
      if (!/^main-\d{4}-\d{2}-\d{2}\.log$/.test(name)) continue;
      const full = path.join(logDir, name);
      if (fs.statSync(full).mtimeMs < cutoff) fs.unlinkSync(full);
    }
  } catch (err) {
    // 清理失败不影响使用
  }
}

/**
 * 启动日志系统：建目录、清旧文件、接管 console、兜住未捕获的崩溃
 * @param {{dir: string, keepDays?: number}} options
 */
function init(options) {
  logDir = options.dir;
  keepDays = options.keepDays || 7;

  try {
    fs.mkdirSync(logDir, { recursive: true });
  } catch (err) {
    // 目录都建不了（比如只读磁盘），日志功能自然失效，但不该拖垮软件
    return;
  }

  prune();

  if (installed) return;
  installed = true;

  // 接管 console：照常打印到屏幕，同时落一份到文件
  for (const level of ['log', 'info', 'warn', 'error']) {
    console[level] = (...args) => {
      original[level](...args);
      append(level === 'error' ? 'ERROR' : level === 'warn' ? 'WARN' : 'INFO', args.map(stringify).join(' '));
    };
  }

  // 没人接住的异常：先记下来，再让 Electron 按原流程处理（不吞掉）
  process.on('uncaughtException', (err) => {
    append('ERROR', `未捕获的异常：${stringify(err)}`);
  });

  // 没人处理的 Promise 拒绝（最常见的「悄悄失败」来源）
  process.on('unhandledRejection', (reason) => {
    append('ERROR', `未处理的 Promise 拒绝：${stringify(reason)}`);
  });

  append('INFO', `===== 日志系统启动（保留 ${keepDays} 天）=====`);
}

/**
 * 给日志目录（界面上的「打开日志文件夹」要用）
 * @returns {string|null}
 */
function dir() {
  return logDir;
}

/**
 * 单独记一条（界面报上来的错误也走这里）
 * @param {string} text
 */
function write(text) {
  append('ERROR', `[界面] ${text}`);
}

module.exports = { init, dir, write, dayStamp, stringify };
