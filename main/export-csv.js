/**
 * 天天记账 —— 导出 CSV 备份
 *
 * 大白话：把账本里所有账目拼成一张表格文件（CSV），用户可以用 Excel 直接打开。
 * 拼表格的规则有三条，都是为了「用 Excel 打开不乱码、不错位」：
 *   1. 文件开头加一个看不见的标记（BOM），Excel 才知道这是 UTF-8 中文；
 *   2. 字段里如果有逗号、引号、换行，整个字段要用双引号包起来；
 *   3. 字段里的双引号本身要写成两个（这是 CSV 的老规矩）。
 *
 * 分工：这个文件只负责「拼文本」和「弹框让用户选位置后写文件」，
 * 弹框要用的 dialog 由调用方传进来——这样拼文本那部分不需要 Electron 也能单独测。
 */

const fs = require('fs');
const path = require('path');

/**
 * 把账目拼成 CSV 文本
 * @param {object[]} records 全部账目（已按时间从旧到新排好）
 * @returns {string} 可以直接写进文件的文本
 */
function buildCsv(records) {
  // 转义一个单元格：带逗号/引号/换行的要加引号，里面的引号写两遍
  const esc = (value) => {
    const s = String(value == null ? '' : value);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const rows = [['日期', '类型', '一级分类', '二级分类', '金额（元）', '备注']];
  for (const r of records) {
    rows.push([
      r.date,
      r.type === 'income' ? '收入' : '支出',
      r.categoryMain,
      r.categorySub,
      (r.amountCents / 100).toFixed(2),
      r.note
    ]);
  }

  // \ufeff 就是那个「隐形标记」；行尾用 \r\n，Windows 的记事本和 Excel 都认
  return `\ufeff${rows.map((row) => row.map(esc).join(',')).join('\r\n')}`;
}

/**
 * 走完一次导出：取全部账目 → 拼表格 → 弹保存框 → 写文件
 * @param {object} ctx 依赖集合
 * @param {object} ctx.db 账本模块
 * @param {object} ctx.dialog Electron 的 dialog（用来弹保存框）
 * @param {object} ctx.win 弹出保存框时挂在哪个窗口上
 * @param {string} ctx.downloadsPath 默认落到「下载」文件夹
 * @returns {Promise<{ok: true, path: string, count: number}|{ok: false, canceled?: boolean, error?: string}>}
 */
async function exportCsv(ctx) {
  const records = ctx.db.getAllRecords();
  const csv = buildCsv(records);

  const now = new Date();
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const fileName = `天天记账备份_${stamp}.csv`;

  const { canceled, filePath } = await ctx.dialog.showSaveDialog(ctx.win, {
    title: '导出记账备份',
    defaultPath: path.join(ctx.downloadsPath, fileName),
    filters: [{ name: 'CSV 表格', extensions: ['csv'] }]
  });

  // 用户点了取消：不算失败，如实告诉界面「没导出」
  if (canceled || !filePath) return { ok: false, canceled: true };

  try {
    fs.writeFileSync(filePath, csv, 'utf8');
  } catch (err) {
    // 写不进去（磁盘满、没权限、文件被 Excel 占着）都走这里，把原因带回去
    return { ok: false, canceled: false, error: err.message };
  }

  return { ok: true, path: filePath, count: records.length };
}

module.exports = { buildCsv, exportCsv };
