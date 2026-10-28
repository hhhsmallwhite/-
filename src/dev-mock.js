/**
 * 天天记账 —— 界面「假桥」（只在预览和自动测试时用，正式软件不用它）
 *
 * 大白话：正式软件里，界面是通过 preload 那道安全门去拿数据的（window.tiantian）。
 * 但有时候我们只想看看界面长什么样、或者跑自动测试看看界面有没有坏，
 * 这时候没有真正的大门也没关系——这个文件就是一座「假桥」：
 * 数据全存在内存里（关掉就没了），接口名字和真桥一模一样。
 *
 * 两种用法，同一个文件：
 *   1. 浏览器里直接打开 src/index.html：作为普通脚本加载，往 window 上挂假桥。
 *   2. 自动测试（test/ui-smoke.js）：作为 Electron 的 preload 加载，用 contextBridge 挂。
 * 正式软件里因为真桥已经先挂好了，这个文件检测到之后会立刻收手，什么都不做。
 */

(function () {
  'use strict';

  /* ---------- 一批演示数据（跨 4 个月，够图表画出样子） ---------- */
  // 每行：日期、类型、金额（分）、一级分类、二级分类、备注
  const SEED = [
    ['2026-07-06', 'expense', 1250, '餐饮美食', '午餐', '食堂'],
    ['2026-07-11', 'expense', 3200, '交通出行', '打车网约车', '赶时间'],
    ['2026-07-20', 'expense', 8900, '购物打扮', '服饰鞋帽', 'T恤'],
    ['2026-07-25', 'income', 550000, '工资奖金', '工资', ''],
    ['2026-08-03', 'expense', 1222, '餐饮美食', '午餐', ''],
    ['2026-08-07', 'expense', 2300, '交通出行', '火车飞机', ''],
    ['2026-08-07', 'expense', 6500, '餐饮美食', '水果零食', ''],
    ['2026-08-07', 'income', 540000, '红包礼金', '红包', ''],
    ['2026-08-15', 'expense', 4500, '娱乐休闲', '电影演出', '和朋友'],
    ['2026-08-28', 'expense', 15000, '居住生活', '日用百货', ''],
    ['2026-09-02', 'expense', 3600, '医疗健康', '药品', ''],
    ['2026-09-10', 'income', 550000, '工资奖金', '工资', ''],
    ['2026-09-18', 'expense', 8800, '教育学习', '图书文具', '教材'],
    ['2026-10-01', 'expense', 26000, '居住生活', '水电燃气', ''],
    ['2026-10-09', 'expense', 1900, '通讯网络', '话费', ''],
    ['2026-10-23', 'income', 550000, '工资奖金', '工资', '']
  ];

  let nextId = 1;
  let records = [];
  let highScore = 0;

  /** 把种子数据装进内存，顺便按 id 递增编号 */
  function seed() {
    records = SEED.map(([date, type, amountCents, main, sub, note]) => ({
      id: nextId++,
      type,
      amountCents,
      amount: amountCents / 100,
      categoryMain: main,
      categorySub: sub,
      note,
      date,
      createdAt: new Date(date + 'T12:00:00').getTime()
    }));
  }

  /* ---------- 几个小工具，跟 db.js 里的口径保持一致 ---------- */

  /** 某年某月的起止日（前半闭后半开），用于范围筛选 */
  function monthRange(year, month) {
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const next = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;
    return { start, end: next };
  }

  /** 按日期区间取记录，新日期在前 */
  function inRange(start, end) {
    return records
      .filter((r) => r.date >= start && r.date < end)
      .sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1));
  }

  /* ---------- 假桥的 12 个方法（名字、参数、返回值都跟真桥对齐） ---------- */
  const api = {
    appVersion: '0.2.0',
    platform: 'win32',

    /** 软件信息：预览模式下没有主进程，编一个说得过去的答案 */
    getAppInfo() {
      return Promise.resolve({ version: '预览模式', electron: '—', platform: '浏览器' });
    },

    /** 日志：预览模式没有文件夹可开，也没有文件可写 */
    openLogsFolder() {
      return Promise.resolve({ ok: true, path: '（预览模式，没有日志文件夹）' });
    },
    reportError() {
      return Promise.resolve(true);
    },

    /** 新增一笔：补上 id 后放进内存，返回整条记录 */
    addRecord(record) {
      const row = { ...record, id: nextId++, amount: record.amountCents / 100, createdAt: record.createdAt || Date.now() };
      records.push(row);
      return Promise.resolve(row);
    },

    /** 最近几笔（首页用） */
    getRecentRecords(limit = 10) {
      const sorted = [...records].sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1));
      return Promise.resolve(sorted.slice(0, limit));
    },

    /** 某月收支汇总，单位分 */
    getMonthlySummary(year, month) {
      const { start, end } = monthRange(year, month);
      let expense = 0;
      let income = 0;
      for (const r of inRange(start, end)) {
        if (r.type === 'expense') expense += r.amountCents;
        if (r.type === 'income') income += r.amountCents;
      }
      return Promise.resolve({ expense, income, balance: income - expense });
    },

    /** 某月全部记录（账单页） */
    getRecordsByMonth(year, month) {
      const { start, end } = monthRange(year, month);
      return Promise.resolve(inRange(start, end));
    },

    /** 某月某类型按一级分类汇总，金额高的在前 */
    getCategoryTotals(year, month, type) {
      const { start, end } = monthRange(year, month);
      const map = new Map();
      for (const r of inRange(start, end)) {
        if (r.type !== type) continue;
        map.set(r.categoryMain, (map.get(r.categoryMain) || 0) + r.amountCents);
      }
      const list = [...map.entries()].map(([name, total]) => ({ name, total }));
      list.sort((a, b) => b.total - a.total);
      return Promise.resolve(list);
    },

    /** 从某月到某月，逐月收支（趋势图） */
    getMonthlyTrend(startYear, startMonth, endYear, endMonth) {
      const list = [];
      let y = startYear;
      let m = startMonth;
      const endKey = endYear * 12 + (endMonth - 1);
      while (y * 12 + (m - 1) <= endKey) {
        const { start, end } = monthRange(y, m);
        let expense = 0;
        let income = 0;
        for (const r of inRange(start, end)) {
          if (r.type === 'expense') expense += r.amountCents;
          if (r.type === 'income') income += r.amountCents;
        }
        list.push({ year: y, month: m, expense, income });
        m += 1;
        if (m > 12) { m = 1; y += 1; }
      }
      return Promise.resolve(list);
    },

    /** 全部记录里最早和最晚的日期 */
    getDateRange() {
      if (!records.length) return Promise.resolve(null);
      const dates = records.map((r) => r.date).sort();
      return Promise.resolve({ minDate: dates[0], maxDate: dates[dates.length - 1] });
    },

    /** 改一笔 */
    updateRecord(id, record) {
      const i = records.findIndex((r) => r.id === id);
      if (i >= 0) records[i] = { ...record, id, amount: record.amountCents / 100, createdAt: records[i].createdAt };
      return Promise.resolve(records[i] || null);
    },

    /** 删一笔 */
    deleteRecord(id) {
      records = records.filter((r) => r.id !== id);
      return Promise.resolve();
    },

    /** 导出：假桥不写文件，直接回一个"假装成功"的结果 */
    exportCsv() {
      return Promise.resolve({ ok: true, path: '（预览模式，不会真的写文件）', count: records.length });
    },

    /** 导入：预览模式没有文件可选 */
    importCsv() {
      return Promise.resolve({ ok: false, canceled: true });
    },

    /** 备份三件套：预览模式只在内存里假装一下 */
    backupNow() {
      return Promise.resolve({ ok: true, path: '（预览模式，不会真的写文件）' });
    },
    restoreBackup() {
      return Promise.resolve({ ok: false, canceled: true });
    },
    getBackupInfo() {
      return Promise.resolve({ count: 0, latest: null, dir: '（预览模式）' });
    },

    /** 最高分：存在内存里 */
    getHighScore() {
      return Promise.resolve(highScore);
    },
    setHighScore(score) {
      highScore = Math.max(0, Math.floor(Number(score) || 0));
      return Promise.resolve({ ok: true, value: highScore });
    }
  };

  seed();

  /* ---------- 按运行环境选择挂载方式 ---------- */
  // Electron 正式软件里：真桥已经在 window.tiantian 上了，这里什么都不用做
  if (typeof window !== 'undefined' && window.tiantian) return;

  // 作为 Electron 的 preload 跑：走 contextBridge（这是测试模式）
  if (typeof require === 'function' && typeof module !== 'undefined' && module.exports !== undefined) {
    try {
      require('electron').contextBridge.exposeInMainWorld('tiantian', api);
      return;
    } catch (e) {
      // 不是 Electron 环境（比如浏览器里手动 require 失败），往下走兜底
    }
  }

  // 浏览器里直接打开 index.html：挂到 window 上，界面照样能用
  if (typeof window !== 'undefined') window.tiantian = api;
})();
