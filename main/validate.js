/**
 * 天天记账 —— 界面传进来的数据「检查站」
 *
 * 大白话：界面是「外面」，主进程是「里面」。外面递进来的东西不管看着多正常，
 * 里面都得先验一遍再动数据库——万一是手滑、是旧版本界面、是别人塞进来的脏数据，
 * 坏数据一旦进了账本，后面算出来的钱全是错的，还很难查。
 *
 * 这套检查站的三条原则：
 *   1. 只留认识的字段（白名单）：多余的字段直接丢掉，不会顺着传进 SQL；
 *   2. 不合格就明确报错：用中文说清哪里不对，界面能直接弹给人看；
 *   3. 不「猜」意思：传字符串 "12" 不会自动当 12 用，宁可报错也不静默改数据。
 *
 * 注意：这里只管「数据长什么样」，不管业务（比如某个分类下能不能记负数）。
 */

// 各字段的上限，全放一处，改的时候只改这里
const LIMITS = {
  AMOUNT_MAX_CENTS: 100000000, // 单笔最多 100 万元，超了多半是手滑多打几个 0
  NOTE_MAX: 200, // 备注最多 200 字
  NAME_MAX: 20, // 分类名最长 20 字
  LIMIT_MAX: 500, // 一次最多取 500 条
  YEAR_MIN: 1970,
  YEAR_MAX: 2100
};

/**
 * 抛出一个人能看懂的错误
 * @param {string} message
 */
function fail(message) {
  throw new Error(message);
}

/**
 * 判断是不是「整数」（排除 12.5、NaN、"12" 这些）
 * @param {*} value
 * @returns {boolean}
 */
function isInt(value) {
  return typeof value === 'number' && Number.isInteger(value);
}

/**
 * 校验并整理「一笔账」。新增和修改都走它。
 * @param {*} input 界面传来的原始对象
 * @returns {object} 只含认识的字段、类型正确的干净对象
 */
function record(input) {
  if (!input || typeof input !== 'object') fail('账目数据格式不对');

  const { type, amountCents, categoryMain, categorySub, note, date, createdAt } = input;

  if (type !== 'expense' && type !== 'income') fail('收支类型只能是支出或收入');

  if (!isInt(amountCents)) fail('金额必须是整数「分」');
  if (amountCents <= 0) fail('金额必须大于 0');
  if (amountCents > LIMITS.AMOUNT_MAX_CENTS) fail('单笔金额太大了，请检查是不是多打了几个 0');

  if (typeof categoryMain !== 'string' || !categoryMain.trim()) fail('一级分类不能为空');
  if (categoryMain.length > LIMITS.NAME_MAX) fail('一级分类名称太长');
  if (typeof categorySub !== 'string' || !categorySub.trim()) fail('二级分类不能为空');
  if (categorySub.length > LIMITS.NAME_MAX) fail('二级分类名称太长');

  // 备注可以不填，但不能是 undefined / null / 超长
  const cleanNote = note == null ? '' : String(note).trim();
  if (cleanNote.length > LIMITS.NOTE_MAX) fail(`备注最多 ${LIMITS.NOTE_MAX} 个字`);

  if (typeof date !== 'string' || !isDate(date)) fail('日期格式不正确（应该是 2026-10-28 这样）');

  // 记账时刻：不传就交给数据库那边补「现在」；传了就必须是正整数
  if (createdAt != null && !isInt(createdAt)) fail('记账时刻格式不对');

  return {
    type,
    amountCents,
    categoryMain: categoryMain.trim(),
    categorySub: categorySub.trim(),
    note: cleanNote,
    date,
    createdAt: createdAt == null ? undefined : createdAt
  };
}

/**
 * 校验日期字符串：既要格式对（YYYY-MM-DD），也要真实存在（不能是 2 月 30 号）
 * @param {string} value
 * @returns {boolean}
 */
function isDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split('-').map(Number);
  if (year < LIMITS.YEAR_MIN || year > LIMITS.YEAR_MAX) return false;

  const d = new Date(year, month - 1, day);
  // 用回读法验真：构造一个 2 月 30 号，Date 会自动滚到 3 月 2 号，那就说明日期不存在
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
}

/**
 * 校验账目编号（正整数）
 * @param {*} id
 * @returns {number}
 */
function id(id) {
  if (!isInt(id) || id <= 0) fail('账目编号不正确');
  return id;
}

/**
 * 校验「某年某月」
 * @param {*} year
 * @param {*} month
 * @returns {{ year: number, month: number }}
 */
function yearMonth(year, month) {
  if (!isInt(year) || year < LIMITS.YEAR_MIN || year > LIMITS.YEAR_MAX) fail('年份不正确');
  if (!isInt(month) || month < 1 || month > 12) fail('月份不正确');
  return { year, month };
}

/**
 * 校验收支类型（单独用在算分类汇总那种只需要类型的接口）
 * @param {*} type
 * @returns {'expense'|'income'}
 */
function type(type) {
  if (type !== 'expense' && type !== 'income') fail('收支类型只能是支出或收入');
  return type;
}

/**
 * 校验「取几条」（1 ~ 500，不传默认 10）
 * @param {*} limit
 * @returns {number}
 */
function limit(limit) {
  if (limit == null) return 10;
  if (!isInt(limit) || limit < 1 || limit > LIMITS.LIMIT_MAX) fail(`一次最多取 ${LIMITS.LIMIT_MAX} 条`);
  return limit;
}

/**
 * 校验最高分（0 和正整数都合法，负数按 0）
 * @param {*} score
 * @returns {number}
 */
function score(score) {
  if (typeof score !== 'number' || !Number.isFinite(score)) fail('分数格式不正确');
  return Math.max(0, Math.floor(score));
}

/**
 * 校验趋势图的「从某月到某月」，并且保证起点不晚于终点
 * @param {*} startYear
 * @param {*} startMonth
 * @param {*} endYear
 * @param {*} endMonth
 * @returns {{ startYear: number, startMonth: number, endYear: number, endMonth: number }}
 */
function trendRange(startYear, startMonth, endYear, endMonth) {
  const start = yearMonth(startYear, startMonth);
  const end = yearMonth(endYear, endMonth);

  const startKey = start.year * 12 + start.month;
  const endKey = end.year * 12 + end.month;

  // 区间反了就换过来，不让界面因为「先点后面的月份」就直接报错
  if (startKey > endKey) {
    return { startYear: end.year, startMonth: end.month, endYear: start.year, endMonth: start.month };
  }
  return { startYear: start.year, startMonth: start.month, endYear: end.year, endMonth: end.month };
}

module.exports = { record, id, yearMonth, type, limit, score, trendRange, isDate, LIMITS };
