/**
 * 天天记账 —— 主进程的「总机」：接界面打来的电话
 *
 * 大白话：界面每喊一个暗号（通道名），这个文件就负责接起来，先过检查站
 * （validate.js），再去调用账本（db/）或者小游戏分数（score.js）。
 *
 * 为什么所有暗号都集中在这一个文件：
 *   以前注册散在 main.js 里，跟窗口创建、导出逻辑混在一起，加一个接口要翻半天。
 *   现在这里是唯一入口——想知道「界面到底能干什么」，看这一个文件就够。
 *
 * 依赖注入（register 的第二个参数）：
 *   这样写的好处是测试时可以塞假的 ipcMain 进来，不用真开一个 Electron 窗口，
 *   就能验证「清单里的每个暗号都有人接」。
 */

const { CHANNELS } = require('./channels');
const validate = require('./validate');
const db = require('../db');
const score = require('../score');
const logger = require('./logger');
const { exportCsv } = require('./export-csv');

/**
 * 从界面传来的「对象参数」里安全地取值。
 * 界面可能传 null、传字符串、传数组，直接解构会抛 TypeError，
 * 所以先确认它是个正经对象，不是就给出人话错误。
 * @param {*} payload
 * @param {string} what 用来拼错误提示，例如「月份查询」
 * @returns {object}
 */
function asObject(payload, what) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error(`${what}的参数格式不对`);
  }
  return payload;
}

/**
 * 注册全部通道
 * @param {object} ipcMain Electron 的 ipcMain（测试时可传一个假的）
 * @param {object} ctx 依赖集合
 * @param {{version: string, electron: string, platform: string}} ctx.appInfo 软件信息
 * @param {string} ctx.highScorePath 最高分文件路径
 * @param {(event: object) => Promise<object>} ctx.exportTo 真正执行导出的函数
 * @param {() => object} ctx.backupCreate 立刻备份一份
 * @param {(event: object) => Promise<object>} ctx.backupRestore 弹框选备份并恢复
 * @param {() => object} ctx.backupInfo 备份现状
 * @param {(event: object) => Promise<object>} ctx.importCsv 弹框选 CSV 并导入
 * @param {() => Promise<object>} ctx.openLogsFolder 打开日志文件夹
 * @returns {number} 注册了多少个通道
 */
function register(ipcMain, ctx) {
  // 暗号 → 干活的函数。一张表看完所有能力，不用在代码里到处找
  const handlers = {
    // —— 软件自己的信息 ——
    'app:getInfo': () => ctx.appInfo,

    // —— 日志 ——
    'app:openLogsFolder': () => ctx.openLogsFolder(),
    'log:write': (_event, text) => {
      // 界面报上来的错误：只收文字，最多 2000 字，防止被塞一大坨东西进日志文件
      const message = String(text == null ? '' : text).slice(0, 2000);
      if (message) logger.write(message);
      return true;
    },

    // —— 账本 ——
    'db:addRecord': (_event, input) => db.addRecord(validate.record(input)),

    'db:getRecentRecords': (_event, limit) => db.getRecentRecords(validate.limit(limit)),

    'db:getMonthlySummary': (_event, payload) => {
      const p = asObject(payload, '月度汇总');
      const { year, month } = validate.yearMonth(p.year, p.month);
      return db.getMonthlySummary(year, month);
    },

    'db:getRecordsByMonth': (_event, payload) => {
      const p = asObject(payload, '按月查账');
      const { year, month } = validate.yearMonth(p.year, p.month);
      return db.getRecordsByMonth(year, month);
    },

    'db:getCategoryTotals': (_event, payload) => {
      const p = asObject(payload, '分类汇总');
      const { year, month } = validate.yearMonth(p.year, p.month);
      return db.getCategoryTotals(year, month, validate.type(p.type));
    },

    'db:getMonthlyTrend': (_event, payload) => {
      const p = asObject(payload, '趋势查询');
      const range = validate.trendRange(p.startYear, p.startMonth, p.endYear, p.endMonth);
      return db.getMonthlyTrendRange(range.startYear, range.startMonth, range.endYear, range.endMonth);
    },

    'db:getDateRange': () => db.getDateRange(),

    'db:updateRecord': (_event, payload) => {
      const p = asObject(payload, '修改账目');
      return db.updateRecord(validate.id(p.id), validate.record(p.record));
    },

    'db:deleteRecord': (_event, id) => db.deleteRecord(validate.id(id)),

    // —— 导出备份 / 导回来 / 恢复整本备份 ——
    'export:exportCsv': (event) => ctx.exportTo(event),
    'import:importCsv': (event) => ctx.importCsv(event),
    'backup:create': () => ctx.backupCreate(),
    'backup:restore': (event) => ctx.backupRestore(event),
    'backup:info': () => ctx.backupInfo(),

    // —— 贪吃蛇最高分 ——
    'game:getHighScore': () => score.readHighScore(ctx.highScorePath),
    'game:setHighScore': (_event, value) => score.writeHighScore(ctx.highScorePath, validate.score(value))
  };

  // 照着清单一个个接上；清单里有、表里没有的，属于写漏了，启动时就直接暴露
  for (const channel of CHANNELS) {
    const handler = handlers[channel];
    if (!handler) throw new Error(`通道 ${channel} 在 channels.js 里有，但 ipc.js 里没实现`);
    ipcMain.handle(channel, handler);
  }

  return CHANNELS.length;
}

module.exports = { register, asObject };
