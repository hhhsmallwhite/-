#!/usr/bin/env node
/**
 * 安全审计 —— 客观扫描脚本
 *
 * 大白话：这个脚本负责「找位置」，是安全审计技能（security-audit）的第一步。
 * 它不判断某个位置是不是真有问题（那是 AI 的事），只把代码里 5 类「安全敏感位置」找出来：
 *   1. SQL 数据库查询（所有 db.prepare / db.exec，以及疑似「拼字符串」的风险写法）
 *   2. 页面写入（innerHTML、eval 等，可能被塞入用户输入的地方）
 *   3. Electron 外壳安全开关（nodeIntegration、contextIsolation 等有没有关严）
 *   4. 文件读写与路径（fs 操作、路径拼接，可能被「越狱」的地方）
 *   5. 敏感信息（疑似硬编码密码/密钥、读取环境变量）
 * 结果打印在屏幕上，供安全审计专员（Claude）拿去逐个人工复核、写报告。
 *
 * 零依赖：只用 Node 自带的功能，不需要安装任何东西。
 * 用法：node security-scan.js [项目根目录]   （不填就默认用当前文件夹）
 */

const fs = require('fs');
const path = require('path');

// 需要跳过的文件夹（下载的依赖、打包产物、存档、技能文件等，都不是我们手写的代码）
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', '.claude', 'docs', 'build', 'out']);
// 需要检查的文件类型（HTML 里也可能嵌着脚本，所以也查）
const CODE_EXTS = new Set(['.js', '.html']);

// —— 5 组扫描规则 ——
// 每组有：组名（group）、说明（label）、若干条正则（pattern）。
// 正则里的 label 是给 AI 看的大白话说明；命中后逐行记录位置。
const RULES = [
  {
    group: 'sql',
    label: 'SQL 数据库查询',
    patterns: [
      { re: /db\.prepare\s*\(/, label: '预编译查询（正常写法，AI 复核）' },
      { re: /db\.exec\s*\(/, label: '直接执行语句（AI 复核）' },
      // 模板拼接风险：同一行里既有 SQL 关键字，又出现 ${...}（把变量直接填进语句）
      { re: /\b(SELECT|INSERT|UPDATE|DELETE|WHERE|ORDER\s+BY|GROUP\s+BY)\b[^`\r\n]*\$\{/, label: 'SQL 模板拼接(风险，值直接填进语句)' },
      // 字符串拼接风险：SQL 关键字 后面的字符串里出现 '...' + 变量
      { re: /\b(SELECT|INSERT|UPDATE|DELETE|WHERE)\b[^'\r\n]*'[^']*'\s*\+/, label: 'SQL 字符串拼接(风险，值直接填进语句)' },
    ],
  },
  {
    group: 'xss',
    label: '页面写入（XSS 面）',
    patterns: [
      { re: /\.innerHTML\s*=/, label: 'innerHTML 写入（AI 复核：数据来源是否用户输入）' },
      { re: /\.outerHTML\s*=/, label: 'outerHTML 写入（AI 复核）' },
      { re: /insertAdjacentHTML/, label: 'insertAdjacentHTML 写入（AI 复核）' },
      { re: /document\.write\s*\(/, label: 'document.write 写入（AI 复核）' },
      { re: /\beval\s*\(/, label: 'eval 执行（高风险）' },
      { re: /new\s+Function\s*\(/, label: 'new Function 执行（高风险）' },
    ],
  },
  {
    group: 'shell',
    label: 'Electron 外壳安全开关',
    patterns: [
      { re: /nodeIntegration\s*:/, label: 'nodeIntegration 开关（应关，false）' },
      { re: /contextIsolation\s*:/, label: 'contextIsolation 开关（应开，true）' },
      { re: /webSecurity\s*:/, label: 'webSecurity 开关（不应关）' },
      { re: /\bsandbox\s*:/, label: 'sandbox 开关（建议开，true）' },
      { re: /shell\s*:\s*true/, label: 'shell:true（会执行系统命令，高风险）' },
      { re: /allowRunningInsecureContent/, label: 'allowRunningInsecureContent（不应开）' },
    ],
  },
  {
    group: 'file',
    label: '文件读写与路径',
    patterns: [
      { re: /\bfs\.\w+\s*\(/, label: '文件读写操作（AI 复核路径来源）' },
      { re: /path\.(join|resolve)\s*\([^)]*\$\{/, label: '路径模板拼接(风险，路径含变量)' },
      // 排除 require('../xxx') / import ... from '../xxx' 这类「引用别的模块」的正常写法
      { re: /(?<!require\(['"]|import\(['"]|from\s+['"])\.\.\//, label: '越级路径(../)（AI 复核）' },
    ],
  },
  {
    group: 'secret',
    label: '敏感信息',
    patterns: [
      { re: /(password|passwd|secret|token|api[_-]?key|private[_-]?key|access[_-]?key)\s*[:=]\s*['"][^'"]+['"]/i, label: '疑似硬编码密钥（AI 复核）' },
      { re: /process\.env\.[A-Za-z_]+/, label: '读取环境变量（AI 复核用途）' },
    ],
  },
];

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

// —— 第二步：逐行扫描一个文件，收集所有命中的可疑位置 ——
function scanFile(file, root) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  const rel = path.relative(root, file).replace(/\\/g, '/');
  const findings = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) continue;
    for (const rule of RULES) {
      for (const p of rule.patterns) {
        if (p.re.test(line)) {
          findings.push({
            group: rule.group,
            ruleLabel: rule.label,
            file: rel,
            line: i + 1,
            text: trimmed.slice(0, 80), // 只留一行前 80 字，避免刷屏
          });
        }
      }
    }
  }
  return findings;
}

// —— 主程序：找文件 → 逐行扫描 → 打印总览 + 完整 JSON ——
function main() {
  const root = path.resolve(process.argv[2] || '.');
  const files = collectFiles(root);
  const all = files.flatMap(f => scanFile(f, root));

  // 按组分类，方便总览
  const groups = RULES.map(r => ({
    group: r.group,
    label: r.label,
    count: all.filter(f => f.group === r.group).length,
    findings: all.filter(f => f.group === r.group),
  }));

  const total = all.length;

  // 屏幕上看的总览
  console.log('=== 安全审计 · 客观扫描 ===');
  console.log(`扫描文件：${files.length} 个（${CODE_EXTS.size} 种类型）`);
  console.log(`可疑位置：共 ${total} 处`);
  for (const g of groups) {
    console.log(`  · ${g.label}：${g.count} 处`);
  }
  console.log('---');
  for (const g of groups) {
    if (!g.count) continue;
    console.log(`【${g.label}】${g.count} 处`);
    for (const f of g.findings) {
      console.log(`  ${f.file}:${f.line}  ${f.ruleLabel}  |  ${f.text}`);
    }
  }

  // 机器可读的完整数据（供 AI 拿去写报告）
  console.log('=== JSON ===');
  console.log(JSON.stringify({
    today: new Date().toISOString().slice(0, 10),
    filesScanned: files.length,
    groups,
    findings: all,
  }, null, 2));
}

main();
