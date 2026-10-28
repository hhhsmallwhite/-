/**
 * 天天记账 —— 从 CSV 把账目导回来
 *
 * 大白话：导出的 CSV 以前只能出不能回，等于「备份」是假的——真出事的时候
 * 表格救不回来。这个文件补上回程：选一个 CSV，逐行读、逐行检查，合法的记账，
 * 不合法的跳过并说清是第几行哪里不对。
 *
 * 三个贴心的细节：
 *   1. 认我们自己导出的格式（表头「日期,类型,一级分类…」），首行是表头就自动跳过；
 *   2. 完全相同的账不重复记：日期/类型/金额/分类/备注都一样的，视为同一笔（防止同一张表导两遍）；
 *   3. 日期写 2026/10/28、金额写 "¥12.50" 这种从 Excel 里带出来的写法也能认。
 *
 * 这个文件不碰 Electron，弹窗由调用方把文件路径传进来，所以能用 node 直接测。
 */

const fs = require('fs');
const validate = require('./validate');

// 一次最多报多少个问题（报太多界面也看不过来）
const MAX_PROBLEMS = 20;

/**
 * 把 CSV 文本切成「一行一个数组」。
 * 这是 CSV 的老规矩（RFC 4180）：用逗号分列、双引号包住带逗号的内容、
 * 引号里的两个双引号表示一个真引号。所以不能简单用 split(',')，得一个字符一个字符走。
 * @param {string} text
 * @returns {string[][]}
 */
function parseCsv(text) {
  // Excel 存的 UTF-8 CSV 开头常带一个看不见的 BOM，先摘掉，不然第一个字段会带垃圾
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < source.length; i++) {
    const ch = source[i];

    if (inQuotes) {
      if (ch === '"') {
        if (source[i + 1] === '"') {
          field += '"'; // 两个引号 = 一个真引号
          i += 1;
        } else {
          inQuotes = false; // 引号结束
        }
      } else {
        field += ch; // 引号里的逗号、换行都算内容
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\r') {
      // Windows 换行是 \r\n，\r 直接忽略，等 \n 来收尾
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }

  // 最后一行没有换行符结尾时，要手动收个尾
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

/**
 * 判断这一行是不是表头
 * @param {string[]} row
 * @returns {boolean}
 */
function isHeader(row) {
  return row.length > 0 && String(row[0]).trim() === '日期';
}

/**
 * 把「类型」那一列翻译成内部代码
 * @param {string} text
 * @returns {'expense'|'income'|null}
 */
function parseType(text) {
  const t = String(text || '').trim().toLowerCase();
  if (t === '支出' || t === 'expense' || t === 'exp' || t === '支') return 'expense';
  if (t === '收入' || t === 'income' || t === 'inc' || t === '收') return 'income';
  return null;
}

/**
 * 把「金额」那一列变成整数「分」。
 * 容忍 ¥ 符号、千位逗号、前后空格——这些是 Excel 里常见的写法。
 * @param {string} text
 * @returns {number} 分；认不出来返回 NaN
 */
function parseAmountCents(text) {
  const cleaned = String(text || '').replace(/[¥￥,\s]/g, '');
  const yuan = Number(cleaned);
  if (!Number.isFinite(yuan)) return NaN;
  return Math.round(yuan * 100);
}

/**
 * 日期统一成 YYYY-MM-DD（把 2026/10/28、2026.10.28 也认下来）
 * @param {string} text
 * @returns {string}
 */
function normalizeDate(text) {
  return String(text || '').trim().replace(/[/.]/g, '-');
}

/**
 * 把一行单元格变成一笔账（不合格就抛错，错误信息会带上行号）
 * @param {string[]} cells
 * @param {number} lineNo 这是第几行（从 1 开始，跟 Excel 对得上）
 * @returns {object}
 */
function rowToRecord(cells, lineNo) {
  // 空行（全空）直接忽略，交给调用方判断
  if (cells.every((c) => String(c).trim() === '')) return null;

  if (cells.length < 5) {
    throw new Error(`第 ${lineNo} 行只有 ${cells.length} 列，至少要有日期、类型、一级分类、二级分类、金额`);
  }

  const type = parseType(cells[1]);
  if (!type) throw new Error(`第 ${lineNo} 行的类型「${String(cells[1]).trim()}」看不懂，应该写支出或收入`);

  const amountCents = parseAmountCents(cells[4]);
  if (Number.isNaN(amountCents)) throw new Error(`第 ${lineNo} 行的金额「${String(cells[4]).trim()}」不是数字`);

  // 交给主进程那套检查站统一过一遍（日期真伪、金额上限、分类名长度都在这儿管）
  return validate.record({
    type,
    amountCents,
    categoryMain: cells[2],
    categorySub: cells[3],
    note: cells[5] || '',
    date: normalizeDate(cells[0])
  });
}

/**
 * 把整张表变成一批账目，顺手收集有问题的行
 * @param {string[][]} rows
 * @returns {{records: object[], problems: {line: number, message: string}[]}}
 */
function rowsToRecords(rows) {
  const records = [];
  const problems = [];

  rows.forEach((cells, index) => {
    const lineNo = index + 1;

    // 表头跳过
    if (index === 0 && isHeader(cells)) return;

    try {
      const record = rowToRecord(cells, lineNo);
      if (record) records.push(record);
    } catch (err) {
      if (problems.length < MAX_PROBLEMS) problems.push({ line: lineNo, message: err.message });
    }
  });

  return { records, problems };
}

/**
 * 给一笔账算个「指纹」，用来判断两条是不是同一笔
 * @param {object} record
 * @returns {string}
 */
function keyOf(record) {
  return [record.date, record.type, record.amountCents, record.categoryMain, record.categorySub, record.note].join('\u0001');
}

/**
 * 走完一次导入：读文件 → 解析 → 检查 → 去重 → 写库
 * @param {{db: object, filePath: string}} ctx
 * @returns {{ok: boolean, error?: string, imported?: number, skipped?: number, total?: number, problems?: object[]}}
 */
function runImport(ctx) {
  const { db, filePath } = ctx;

  let text;
  try {
    text = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    return { ok: false, error: `读不了这个文件：${err.message}` };
  }

  const rows = parseCsv(text);
  if (rows.length === 0) return { ok: false, error: '这个文件是空的' };

  const { records, problems } = rowsToRecords(rows);

  // 已经记过的账不再记第二遍：把现有账目做成指纹集合，逐条比
  const existing = new Set(db.getAllRecords().map(keyOf));
  const fresh = [];
  let skipped = 0;

  for (const record of records) {
    const key = keyOf(record);
    if (existing.has(key)) {
      skipped += 1;
      continue;
    }
    existing.add(key); // 同一个文件里出现两次同样的账，也只记一笔
    fresh.push(record);
  }

  if (fresh.length === 0) {
    return {
      ok: true,
      imported: 0,
      skipped,
      total: records.length,
      problems,
      error: records.length === 0 ? '没有一行是合法的账目' : undefined
    };
  }

  try {
    db.addRecordsBatch(fresh);
  } catch (err) {
    return { ok: false, error: `写入账本失败：${err.message}` };
  }

  return { ok: true, imported: fresh.length, skipped, total: records.length, problems };
}

module.exports = { parseCsv, rowsToRecords, runImport, keyOf, parseType, parseAmountCents, normalizeDate };
