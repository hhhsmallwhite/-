#!/usr/bin/env node
/**
 * 注释检查 —— 客观数据统计脚本
 *
 * 大白话：这个脚本负责「数数」，是注释检查技能（comments-check）的第一步。
 * 它不判断注释写得好不好（那是 AI 的事），只算出客观数字：
 *   - 每个代码文件：总行数、代码行数、注释行数、注释比例、达标状态
 *   - 每个文件里有哪些函数、哪些函数头顶没写注释
 * 结果打印在屏幕上，供注释检查专员（Claude）拿去写报告。
 *
 * 零依赖：只用 Node 自带的功能，不需要安装任何东西。
 * 用法：node comment-stats.js [项目根目录]   （不填就默认用当前文件夹）
 */

const fs = require('fs');
const path = require('path');

// 需要跳过的文件夹（下载的依赖、打包产物、存档、技能文件等，都不是我们手写的代码）
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', '.claude', 'docs', 'build', 'out']);
// 需要检查的文件类型
const CODE_EXTS = new Set(['.js', '.html', '.css']);
// 目标注释比例：约 3 行注释 : 7 行代码正文（30%）
const TARGET_RATIO = 0.3;
// 低于这个比例算「明显不足」，之间算「略低于目标」
const LOW_RATIO = 0.2;

// —— 第一步：把项目里所有该检查的代码文件找出来 ——
function collectFiles(dir) {
  const files = [];
  for (const name of fs.readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) files.push(...collectFiles(full));
    else if (CODE_EXTS.has(path.extname(name))) files.push(full);
  }
  return files;
}

// —— 第二步：按文件类型，把每一行分类成「代码 / 注释 / 空行」 ——
function classifyLines(lines, ext) {
  if (ext === '.html') return classifyHtml(lines);
  if (ext === '.css') return classifyCss(lines);
  return classifyJs(lines);
}

// JS：识别 // 行注释、/* */ 块注释；引号内的 // 不算注释（比如网址）
function classifyJs(lines) {
  const n = lines.length;
  const isCommentLine = new Array(n).fill(false);
  let commentLines = 0, codeLines = 0, blankLines = 0;
  let inBlock = false; // 是否正在多行块注释 /* ... */ 里

  for (let i = 0; i < n; i++) {
    const s = lines[i];
    let inString = null;      // 当前是否在引号/反引号字符串里
    let hasCode = false;
    let hasComment = inBlock;
    let j = 0;
    while (j < s.length) {
      const ch = s[j];
      const next = s[j + 1];
      if (inBlock) {                       // 正在块注释里：找结束符 */
        if (ch === '*' && next === '/') { inBlock = false; j += 2; continue; }
        hasComment = true;
        j++;
        continue;
      }
      if (inString) {                      // 正在字符串里：处理转义和结束引号
        if (ch === '\\') { j += 2; continue; }
        if (ch === inString) inString = null;
        j++;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === '`') { inString = ch; j++; continue; }
      if (ch === '/' && next === '/') { hasComment = true; break; } // 行注释，后面全是注释
      if (ch === '/' && next === '*') { inBlock = true; hasComment = true; j += 2; continue; }
      if (!/\s/.test(ch)) hasCode = true;  // 非空白字符 → 这行有代码
      j++;
    }
    if (hasCode) codeLines++;
    else if (hasComment) commentLines++;
    else blankLines++;
    if (hasComment) isCommentLine[i] = true;
  }
  return { commentLines, codeLines, blankLines, isCommentLine };
}

// CSS：只有 /* */ 块注释，没有引号和行注释，逻辑比 JS 简单
function classifyCss(lines) {
  const n = lines.length;
  const isCommentLine = new Array(n).fill(false);
  let commentLines = 0, codeLines = 0, blankLines = 0;
  let inBlock = false;
  for (let i = 0; i < n; i++) {
    const s = lines[i];
    let hasCode = false;
    let hasComment = inBlock;
    let j = 0;
    while (j < s.length) {
      const ch = s[j];
      const next = s[j + 1];
      if (inBlock) {                       // 正在块注释里：找结束符 */
        if (ch === '*' && next === '/') { inBlock = false; j += 2; continue; }
        hasComment = true;
        j++;
        continue;
      }
      if (ch === '/' && next === '*') { inBlock = true; hasComment = true; j += 2; continue; }
      if (!/\s/.test(ch)) hasCode = true;
      j++;
    }
    if (hasCode) codeLines++;
    else if (hasComment) commentLines++;
    else blankLines++;
    if (hasComment) isCommentLine[i] = true;
  }
  return { commentLines, codeLines, blankLines, isCommentLine };
}

// HTML：只有 <!-- --> 注释，可能跨多行，也可能和标签写在同一行
function classifyHtml(lines) {
  const n = lines.length;
  const isCommentLine = new Array(n).fill(false);
  let commentLines = 0, codeLines = 0, blankLines = 0;
  let inComment = false; // 是否正在多行注释 <!-- ... --> 里
  for (let i = 0; i < n; i++) {
    let s = lines[i];
    let hasComment = inComment;
    if (inComment) {
      const end = s.indexOf('-->');
      if (end !== -1) { s = s.slice(end + 3); inComment = false; }
      else s = '';
    }
    // 去掉行内成对的 <!-- ... -->，剩下的是不是代码一目了然
    while (s.indexOf('<!--') !== -1) {
      const start = s.indexOf('<!--');
      const end = s.indexOf('-->', start + 4);
      if (end === -1) { s = s.slice(0, start).trim(); inComment = true; hasComment = true; break; }
      s = (s.slice(0, start) + ' ' + s.slice(end + 3)).trim();
      hasComment = true;
    }
    const hasCode = s.trim() !== '';
    if (hasCode) codeLines++;
    else if (hasComment) commentLines++;
    else blankLines++;
    if (hasComment) isCommentLine[i] = true;
  }
  return { commentLines, codeLines, blankLines, isCommentLine };
}

// —— 第三步：找出文件里有哪些函数，并看每个函数头顶有没有注释 ——
function findFunctions(lines, isCommentLine) {
  const funcs = [];
  const patterns = [
    // 1) 普通函数：function 名字( 或 async function 名字(
    { re: /\b(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/, type: 'function' },
    // 2) 箭头函数赋值：const 名字 = (...) => 或 const 名字 = 参数 =>
    { re: /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/, type: 'arrow' },
    // 3) 导出方法：module.exports.名字 = ...
    { re: /module\.exports\.([A-Za-z_$][\w$]*)\s*=/, type: 'export' },
  ];
  for (let i = 0; i < lines.length; i++) {
    for (const p of patterns) {
      const m = lines[i].match(p.re);
      if (m) { funcs.push({ name: m[1], line: i + 1, type: p.type }); break; }
    }
  }
  // 每个函数往上找最近 3 行，看有没有注释（空行跳过继续找，遇到代码行就停）
  for (const f of funcs) {
    let has = false;
    for (let k = 1; k <= 3; k++) {
      const idx = f.line - 1 - k;
      if (idx < 0) break;
      const t = lines[idx].trim();
      if (t === '') continue;        // 空行：跳过，再往前找
      if (isCommentLine[idx]) { has = true; break; }
      break;                          // 遇到代码行：说明注释不紧贴，停止
    }
    f.hasComment = has;
  }
  return funcs;
}

// —— 第四步：算一个文件的总账 ——
function analyzeFile(file, root) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  const ext = path.extname(file);
  const cls = classifyLines(lines, ext);
  const codeTotal = cls.codeLines + cls.commentLines;
  const ratio = codeTotal === 0 ? 0 : cls.commentLines / codeTotal;
  const funcs = ext === '.js' ? findFunctions(lines, cls.isCommentLine) : [];
  const status = ratio >= TARGET_RATIO ? '达标'
    : (ratio >= LOW_RATIO ? '略低于目标' : '明显不足');
  return {
    file: path.relative(root, file).replace(/\\/g, '/'),
    ext,
    totalLines: lines.length,
    codeLines: cls.codeLines,
    commentLines: cls.commentLines,
    ratio: Math.round(ratio * 1000) / 1000,
    status,
    funcCount: funcs.length,
    noCommentFuncs: funcs.filter(f => !f.hasComment).map(f => `${f.name}（第${f.line}行）`),
  };
}

// —— 主程序：找文件 → 算数字 → 打印总览 + 完整 JSON ——
function main() {
  const root = path.resolve(process.argv[2] || '.');
  const files = collectFiles(root);
  const results = files.map(f => analyzeFile(f, root)).sort((a, b) => a.file.localeCompare(b.file));

  const done = results.filter(r => r.status === '达标').length;
  const low = results.filter(r => r.status === '略低于目标').length;
  const poor = results.filter(r => r.status === '明显不足').length;
  const noCommentTotal = results.reduce((s, r) => s + r.noCommentFuncs.length, 0);

  // 屏幕上看的总览
  console.log('=== 注释检查 · 客观数据 ===');
  console.log(`检查文件：${results.length} 个（注释比例目标 ${TARGET_RATIO * 100}%）`);
  console.log(`达标：${done} ｜ 略低于目标：${low} ｜ 明显不足：${poor}`);
  console.log(`头顶没写注释的函数：共 ${noCommentTotal} 个`);
  console.log('---');
  for (const r of results) {
    const pct = Math.round(r.ratio * 100);
    const extra = r.noCommentFuncs.length ? '  无注释函数：' + r.noCommentFuncs.join('、') : '';
    console.log(`[${r.status}] ${r.file}  注释比例 ${pct}%（${r.commentLines} 注释行 / ${r.codeLines} 代码行）${extra}`);
  }

  // 机器可读的完整数据（供 AI 拿去写报告）
  console.log('=== JSON ===');
  console.log(JSON.stringify({
    today: new Date().toISOString().slice(0, 10),
    targetRatio: TARGET_RATIO,
    lowRatio: LOW_RATIO,
    files: results
  }, null, 2));
}

main();
