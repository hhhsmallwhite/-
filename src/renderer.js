/**
 * 天天记账 —— 界面逻辑
 *
 * 用大白话解释：这个文件负责界面上所有"点一下会发生什么"的事情。
 * 比如：点左侧菜单切换页面、打开/关闭记账弹窗、选择分类等。
 *
 * 说明：记账功能（记一笔/账单/统计/导出）已全部完成；贪吃蛇小游戏作为
 * 独立功能加入，其界面逻辑在 src/snake-game.js。
 */

/* ==================== 分类图标 ==================== */

// 图标统一用 24×24 线性风格（SVG），保证精致一致
function icon(paths) {
  return `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}

const CATEGORY_ICONS = {
  // 支出
  '餐饮美食': icon('<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>'),
  '交通出行': icon('<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>'),
  '居住生活': icon('<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-6h6v6"/>'),
  '购物打扮': icon('<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>'),
  '娱乐休闲': icon('<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/>'),
  '医疗健康': icon('<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/><path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27"/>'),
  '教育学习': icon('<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>'),
  '人情往来': icon('<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"/>'),
  '通讯网络': icon('<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M12 18h.01"/>'),
  '其他支出': icon('<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M7 9.5V6"/>'),
  // 收入
  '工资奖金': icon('<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>'),
  '理财收益': icon('<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>'),
  '红包礼金': icon('<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>'),
  '兼职副业': icon('<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>'),
  '其他收入': icon('<circle cx="12" cy="12" r="10"/><path d="M12 8v8"/><path d="M8 12h8"/>')
};

/* ==================== 分类数据 ==================== */

// 支出分类（一级大类 -> 二级小类）
const EXPENSE_CATEGORIES = [
  { name: '餐饮美食', subs: ['早餐', '午餐', '晚餐', '水果零食', '饮料奶茶', '外卖外食'] },
  { name: '交通出行', subs: ['公交地铁', '打车网约车', '共享单车', '油费充电', '停车过路费', '火车飞机'] },
  { name: '居住生活', subs: ['房租房贷', '水电燃气', '物业费', '日用百货', '家具家电', '保洁维修'] },
  { name: '购物打扮', subs: ['服饰鞋帽', '护肤美妆', '数码电子', '首饰配饰', '箱包'] },
  { name: '娱乐休闲', subs: ['电影演出', '游戏充值', '会员订阅', '运动健身', '旅行度假'] },
  { name: '医疗健康', subs: ['门诊挂号', '药品', '体检', '医疗保险', '保健按摩'] },
  { name: '教育学习', subs: ['学费培训', '考证报名', '图书文具', '知识付费'] },
  { name: '人情往来', subs: ['红包礼金', '礼品', '请客', '孝敬长辈', '公益捐赠'] },
  { name: '通讯网络', subs: ['话费', '手机流量', '宽带网络'] },
  { name: '其他支出', subs: ['宠物', '快递物流', '金融服务费', '零钱杂项'] }
];

// 收入分类（一级大类 -> 二级小类）
const INCOME_CATEGORIES = [
  { name: '工资奖金', subs: ['工资', '奖金', '津贴补贴'] },
  { name: '理财收益', subs: ['利息', '基金股票收益', '其他理财'] },
  { name: '红包礼金', subs: ['红包', '礼金'] },
  { name: '兼职副业', subs: ['兼职收入', '稿费', '其他副业'] },
  { name: '其他收入', subs: ['其他'] }
];

/* ==================== 当前状态 ==================== */

let currentType = 'expense';          // 'expense' 支出 | 'income' 收入
let currentMain = '餐饮美食';         // 当前选中的一级大类
let currentSub = '早餐';              // 当前选中的二级小类

/* ==================== 页面切换 ==================== */

function getCategories() {
  return currentType === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
}

// 切换左侧菜单页面
function switchPage(pageId) {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === pageId);
  });
  document.querySelectorAll('.page').forEach(page => {
    page.classList.toggle('active', page.id === 'page-' + pageId);
  });
  // 每次切到「账单」或「统计」页，刷新一遍该页的数据
  if (pageId === 'bills') loadBills();
  if (pageId === 'stats') loadStats();
}

document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => switchPage(btn.dataset.page));
});

/* ==================== 记一笔弹窗 ==================== */

const modal = document.getElementById('addModal');
const catTabsEl = document.getElementById('catTabs');
const catGridEl = document.getElementById('catGrid');

let editingId = null;   // 正在「修改」的那笔账的编号；null 表示是新增

function openModal() {
  modal.classList.remove('hidden');
  document.getElementById('amountInput').focus();
}

function closeModal() {
  modal.classList.add('hidden');
  editingId = null;   // 关掉弹窗就退出修改状态
}

// 切换弹窗标题和保存按钮文字（新增 vs 修改）
function setModalTitle(title) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('saveBtn').textContent = title === '修改这笔账' ? '保存修改' : '保存';
}

// 点左侧「记一笔」：新增一笔
function openModalForAdd() {
  editingId = null;
  setModalTitle('记一笔');
  resetForm();
  openModal();
}

// 从账单页点「修改」：把那一笔的旧内容填回弹窗
function openModalForEdit(record) {
  editingId = record.id;
  setModalTitle('修改这笔账');
  // 先按记录的类型切好收支和分类，再把金额/备注/日期填回去
  setType(record.type);
  currentMain = record.categoryMain;
  currentSub = record.categorySub;
  renderCategoryTabs();
  document.getElementById('amountInput').value = record.amount.toFixed(2);
  document.getElementById('noteInput').value = record.note || '';
  document.getElementById('dateInput').value = record.date;
  openModal();
}

document.getElementById('openAddBtn').addEventListener('click', openModalForAdd);
document.getElementById('closeAddModal').addEventListener('click', closeModal);

// 点击弹窗外部的灰色背景，也关闭弹窗
modal.addEventListener('click', (e) => {
  if (e.target === modal) closeModal();
});

// 按 Esc 键关闭弹窗
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeModal();
});

/* ==================== 支出/收入切换 ==================== */

const typeExpenseBtn = document.getElementById('typeExpense');
const typeIncomeBtn = document.getElementById('typeIncome');

function setType(type) {
  currentType = type;
  typeExpenseBtn.classList.toggle('active', type === 'expense');
  typeExpenseBtn.setAttribute('aria-selected', type === 'expense');
  typeIncomeBtn.classList.toggle('active', type === 'income');
  typeIncomeBtn.setAttribute('aria-selected', type === 'income');
  const cats = getCategories();
  currentMain = cats[0].name;   // 默认选第一个大类
  currentSub = cats[0].subs[0]; // 默认选第一个小类
  renderCategoryTabs();
  // 切换收支类型时，清空已填的金额，避免把上一笔的金额误带过来
  document.getElementById('amountInput').value = '';
  // 让金额输入框的下划线颜色跟随收支类型（支出=红，收入=绿）
  modal.classList.toggle('income', type === 'income');
}

typeExpenseBtn.addEventListener('click', () => setType('expense'));
typeIncomeBtn.addEventListener('click', () => setType('income'));

/* ==================== 分类选择 ==================== */

// 渲染一级大类标签（横排图标按钮）
function renderCategoryTabs() {
  const cats = getCategories();
  catTabsEl.innerHTML = '';
  cats.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'cat-tab' + (cat.name === currentMain ? ' active' : '');
    btn.type = 'button';
    btn.innerHTML = `<span class="cat-tab-icon">${CATEGORY_ICONS[cat.name] || ''}</span><span>${cat.name}</span>`;
    btn.addEventListener('click', () => {
      currentMain = cat.name;
      currentSub = cat.subs[0];
      renderCategoryTabs();
      renderCategoryGrid();
    });
    catTabsEl.appendChild(btn);
  });
  renderCategoryGrid();
}

// 渲染当前大类的二级小类（格子按钮）
function renderCategoryGrid() {
  const cats = getCategories();
  const main = cats.find(c => c.name === currentMain) || cats[0];
  catGridEl.innerHTML = '';
  main.subs.forEach(sub => {
    const cell = document.createElement('button');
    cell.className = 'cat-cell' + (sub === currentSub ? ' active' : '');
    cell.textContent = sub;
    cell.type = 'button';
    cell.addEventListener('click', () => {
      currentSub = sub;
      renderCategoryGrid();
    });
    catGridEl.appendChild(cell);
  });
}

/* ==================== 保存按钮 ==================== */

function showToast(text) {
  const toast = document.getElementById('toast');
  toast.textContent = text;
  toast.classList.remove('hidden');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.add('hidden'), 2500);
}

document.getElementById('saveBtn').addEventListener('click', async () => {
  const amount = parseFloat(document.getElementById('amountInput').value);

  // 简单检查：金额必须是大于 0 的数字
  if (!amount || amount <= 0) {
    showToast('请输入金额，例如 12.50');
    return;
  }

  // 金额转成「分」（整数）再存，避免小数点误差：12.5 元 → 1250 分
  const record = {
    type: currentType,
    amountCents: Math.round(amount * 100),
    categoryMain: currentMain,
    categorySub: currentSub,
    note: document.getElementById('noteInput').value.trim(),
    date: document.getElementById('dateInput').value || todayStr(),
    createdAt: Date.now()
  };

  const typeText = currentType === 'expense' ? '支出' : '收入';

  try {
    if (editingId !== null) {
      // 正在修改某笔账：按编号更新
      await window.tiantian.updateRecord(editingId, record);
      showToast(`✓ 已修改 ${typeText} ¥${amount.toFixed(2)}（${currentMain}·${currentSub}）`);
    } else {
      // 新增一笔
      await window.tiantian.addRecord(record);
      showToast(`✓ 已保存 ${typeText} ¥${amount.toFixed(2)}（${currentMain}·${currentSub}）`);
    }
    closeModal();
    refreshAll();
  } catch (e) {
    console.error('保存失败：', e);
    showToast('保存失败，请稍后重试');
  }
});

/* ==================== 重置表单 ==================== */

function resetForm() {
  document.getElementById('amountInput').value = '';
  document.getElementById('noteInput').value = '';
  document.getElementById('dateInput').value = todayStr();
  setType('expense');
}

function todayStr() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/* ==================== 概览页：加载真实数据 ==================== */

async function refreshOverview() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  document.getElementById('overviewMonth').textContent = `${year}年${month}月`;

  try {
    // 本月收支汇总（从数据库取真实数据）
    const s = await window.tiantian.getMonthlySummary(year, month);
    document.getElementById('statExpense').textContent = fmtMoney(s.expense);
    document.getElementById('statIncome').textContent = fmtMoney(s.income);
    document.getElementById('statBalance').textContent = fmtMoney(s.balance);

    // 最近记的几笔
    const records = await window.tiantian.getRecentRecords(5);
    renderRecentList(records);
  } catch (e) {
    console.error('加载概览数据失败：', e);
  }
}

// 把「分」换成带两位小数的「元」
function fmtMoney(cents) {
  return (cents / 100).toFixed(2);
}

// 渲染「最近记录」列表
function renderRecentList(records) {
  const emptyEl = document.getElementById('recentEmpty');
  const listEl = document.getElementById('recentList');

  // 一笔都没有：显示"还没有任何记录"的提示
  if (!records || records.length === 0) {
    emptyEl.classList.remove('hidden');
    listEl.classList.add('hidden');
    return;
  }

  emptyEl.classList.add('hidden');
  listEl.classList.remove('hidden');
  listEl.innerHTML = records.map(r => {
    const isExpense = r.type === 'expense';
    const sign = isExpense ? '-' : '+';
    return `
      <li class="record-item">
        <span class="record-icon">${CATEGORY_ICONS[r.categoryMain] || ''}</span>
        <div class="record-main">
          <div class="record-cat">${escapeHtml(r.categoryMain)} · ${escapeHtml(r.categorySub)}</div>
          <div class="record-note">${escapeHtml(r.note)}</div>
        </div>
        <span class="record-date">${r.date.slice(5).replace('-', '/')}</span>
        <span class="record-amount ${isExpense ? 'expense' : 'income'}">${sign}¥${r.amount.toFixed(2)}</span>
      </li>`;
  }).join('');
}

// 转义用户填的内容，防止奇怪的符号破坏界面
function escapeHtml(str) {
  const s = String(str || '');
  return s.replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[ch]);
}

/* ==================== 数据刷新（公共） ==================== */

// 保存 / 修改 / 删除后，把当前正在显示的页面都刷新一遍
function refreshAll() {
  refreshOverview();
  if (document.getElementById('page-bills').classList.contains('active')) loadBills();
  if (document.getElementById('page-stats').classList.contains('active')) loadStats();
}

/* ==================== 账单页 ==================== */

let billsYear = 0, billsMonth = 0;   // 0 表示还没初始化，首次打开设为当前月
let billsRecords = [];               // 当前月的全部记录（未筛选），前端直接筛选

// 现在的年月
function currentYm() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

// 是不是未来月份（将来的月份不允许查看/翻到）
function isFuture(year, month) {
  const c = currentYm();
  return year > c.year || (year === c.year && month > c.month);
}

// 已经在本月时，「下个月」按钮置灰，避免翻到未来
function updateMonthNavDisabled() {
  const c = currentYm();
  document.getElementById('billNextMonth').disabled = (billsYear > c.year || (billsYear === c.year && billsMonth >= c.month));
  document.getElementById('statsNextMonth').disabled = (statsYear > c.year || (statsYear === c.year && statsMonth >= c.month));
}

function initBillsMonth() {
  if (!billsYear) {
    const now = new Date();
    billsYear = now.getFullYear();
    billsMonth = now.getMonth() + 1;
  }
}

function shiftBillsMonth(delta) {
  const d = new Date(billsYear, billsMonth - 1 + delta, 1);
  const next = { year: d.getFullYear(), month: d.getMonth() + 1 };
  if (delta > 0 && isFuture(next.year, next.month)) return;   // 不往未来翻
  billsYear = next.year;
  billsMonth = next.month;
  loadBills();
}

async function loadBills() {
  initBillsMonth();
  document.getElementById('billMonthLabel').textContent = `${billsYear}年${billsMonth}月`;
  updateMonthNavDisabled();
  try {
    billsRecords = await window.tiantian.getRecordsByMonth(billsYear, billsMonth);
    buildBillCatFilter();
    renderBills();
  } catch (e) {
    console.error('加载账单失败：', e);
  }
}

// 填充分类筛选下拉框（支出 + 收入的全部大类，两个都选得到）
function buildBillCatFilter() {
  const sel = document.getElementById('billCatFilter');
  const names = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES].map(c => c.name);
  const prev = sel.value;
  sel.innerHTML = '<option value="all">全部分类</option>' +
    names.map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('');
  sel.value = names.includes(prev) ? prev : 'all';
}

// 把当月记录按「类型 + 分类 + 搜索词」筛选一遍
function getFilteredBills() {
  const type = document.getElementById('billTypeFilter').value;
  const cat = document.getElementById('billCatFilter').value;
  const kw = document.getElementById('billSearch').value.trim().toLowerCase();
  return billsRecords.filter(r => {
    if (type !== 'all' && r.type !== type) return false;
    if (cat !== 'all' && r.categoryMain !== cat) return false;
    if (kw && !(r.note || '').toLowerCase().includes(kw)) return false;
    return true;
  });
}

function renderBills() {
  const list = getFilteredBills();
  const emptyEl = document.getElementById('billEmpty');
  const listEl = document.getElementById('billList');

  if (list.length === 0) {
    const isFiltered = document.getElementById('billTypeFilter').value !== 'all' ||
                       document.getElementById('billCatFilter').value !== 'all' ||
                       document.getElementById('billSearch').value.trim() !== '';
    if (billsRecords.length === 0) {
      document.getElementById('billEmptyTitle').textContent = '本月还没有记录';
      document.getElementById('billEmptyHint').textContent = '点左侧「＋ 记一笔」记一笔，或用箭头看看其他月份';
    } else if (isFiltered) {
      document.getElementById('billEmptyTitle').textContent = '没有符合条件的记录';
      document.getElementById('billEmptyHint').textContent = '换个筛选条件或清空搜索试试';
    }
    emptyEl.classList.remove('hidden');
    listEl.classList.add('hidden');
    listEl.innerHTML = '';
    return;
  }

  emptyEl.classList.add('hidden');
  listEl.classList.remove('hidden');

  // 按日期分组（同一天归到一组），日期从新到旧排
  const groups = {};
  for (const r of list) (groups[r.date] = groups[r.date] || []).push(r);
  const dates = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  listEl.innerHTML = dates.map(date => {
    const recs = groups[date];
    const dayExpense = recs.filter(r => r.type === 'expense').reduce((s, r) => s + r.amountCents, 0);
    const dayIncome = recs.filter(r => r.type === 'income').reduce((s, r) => s + r.amountCents, 0);
    const parts = [];
    if (dayExpense) parts.push(`支 ¥${fmtMoney(dayExpense)}`);
    if (dayIncome) parts.push(`收 ¥${fmtMoney(dayIncome)}`);
    const d = new Date(date + 'T00:00:00');
    return `
      <div class="bill-day">
        <div class="bill-day-head">
          <span class="bill-day-date">${d.getMonth() + 1}月${d.getDate()}日</span>
          <span class="bill-day-sum">${parts.join('　')}</span>
        </div>
        <ul class="bill-day-list">
          ${recs.map(renderBillRow).join('')}
        </ul>
      </div>`;
  }).join('');
}

function renderBillRow(r) {
  const isExpense = r.type === 'expense';
  const sign = isExpense ? '-' : '+';
  const note = escapeHtml(r.note);
  return `
    <li class="bill-row" data-id="${r.id}">
      <span class="record-icon">${CATEGORY_ICONS[r.categoryMain] || ''}</span>
      <div class="record-main">
        <div class="record-cat">${escapeHtml(r.categoryMain)} · ${escapeHtml(r.categorySub)}</div>
        <div class="record-note">${note || '&nbsp;'}</div>
      </div>
      <span class="bill-amount ${isExpense ? 'expense' : 'income'}">${sign}¥${r.amount.toFixed(2)}</span>
      <div class="bill-actions">
        <button class="bill-btn edit" type="button" data-action="edit">修改</button>
        <button class="bill-btn del" type="button" data-action="delete">删除</button>
      </div>
    </li>`;
}

// 账单列表里的「修改 / 删除」按钮（事件委托，统一处理）
document.getElementById('billList').addEventListener('click', (e) => {
  const btn = e.target.closest('.bill-btn');
  if (!btn) return;
  const row = btn.closest('.bill-row');
  if (!row) return;
  const id = Number(row.dataset.id);
  const record = billsRecords.find(r => r.id === id);
  if (!record) return;
  if (btn.dataset.action === 'edit') {
    openModalForEdit(record);
  } else if (btn.dataset.action === 'delete') {
    deleteBill(record);
  }
});

async function deleteBill(record) {
  const money = `¥${record.amount.toFixed(2)}`;
  const ok = confirm(`确定删除这笔账吗？\n${record.categoryMain}·${record.categorySub} ${money}\n删除后无法恢复。`);
  if (!ok) return;
  try {
    await window.tiantian.deleteRecord(record.id);
    showToast('已删除这笔账');
    refreshAll();
  } catch (e) {
    console.error('删除失败：', e);
    showToast('删除失败，请重试');
  }
}

// 月份切换 / 回到本月 / 筛选搜索
document.getElementById('billPrevMonth').addEventListener('click', () => shiftBillsMonth(-1));
document.getElementById('billNextMonth').addEventListener('click', () => shiftBillsMonth(1));
document.getElementById('billTodayBtn').addEventListener('click', () => {
  const now = new Date();
  billsYear = now.getFullYear();
  billsMonth = now.getMonth() + 1;
  loadBills();
});
document.getElementById('billTypeFilter').addEventListener('change', renderBills);
document.getElementById('billCatFilter').addEventListener('change', renderBills);
document.getElementById('billSearch').addEventListener('input', renderBills);

/* ==================== 统计页 ==================== */

let statsYear = 0, statsMonth = 0;   // 0 表示还没初始化，首次打开设为当前月

function initStatsMonth() {
  if (!statsYear) {
    const now = new Date();
    statsYear = now.getFullYear();
    statsMonth = now.getMonth() + 1;
  }
}

function shiftStatsMonth(delta) {
  const d = new Date(statsYear, statsMonth - 1 + delta, 1);
  const next = { year: d.getFullYear(), month: d.getMonth() + 1 };
  if (delta > 0 && isFuture(next.year, next.month)) return;   // 不往未来翻
  statsYear = next.year;
  statsMonth = next.month;
  loadStats();
}

async function loadStats() {
  initStatsMonth();
  document.getElementById('statsMonthLabel').textContent = `${statsYear}年${statsMonth}月`;
  updateMonthNavDisabled();
  try {
    const s = await window.tiantian.getMonthlySummary(statsYear, statsMonth);
    document.getElementById('statsExpense').textContent = fmtMoney(s.expense);
    document.getElementById('statsIncome').textContent = fmtMoney(s.income);
    document.getElementById('statsBalance').textContent = fmtMoney(s.balance);

    // 支出分类占比
    const cats = await window.tiantian.getCategoryTotals(statsYear, statsMonth, 'expense');
    renderDonut(document.getElementById('statsDonut'), cats, {
      centerLabel: '总支出',
      emptyTitle: '本月还没有支出',
      emptyHint: '记一笔支出后，这里就能看到钱都花在哪些分类'
    });

    // 收入分类占比
    const incCats = await window.tiantian.getCategoryTotals(statsYear, statsMonth, 'income');
    renderDonut(document.getElementById('statsDonutIncome'), incCats, {
      centerLabel: '总收入',
      emptyTitle: '本月还没有收入',
      emptyHint: '记一笔收入后，这里就能看到钱都是从哪来的'
    });

    // 收支结余（支出 vs 收入）
    renderBalanceDonut(document.getElementById('statsBalanceDonut'), s.expense, s.income);

    // 收支趋势（范围在下方控件里自己选）
    renderTrendRange();
  } catch (e) {
    console.error('加载统计失败：', e);
  }
}

document.getElementById('statsPrevMonth').addEventListener('click', () => shiftStatsMonth(-1));
document.getElementById('statsNextMonth').addEventListener('click', () => shiftStatsMonth(1));
document.getElementById('statsTodayBtn').addEventListener('click', () => {
  const now = new Date();
  statsYear = now.getFullYear();
  statsMonth = now.getMonth() + 1;
  loadStats();
});

/* ==================== 图表：环形图（通用） ==================== */

// 分类色板：8 个一眼可分的颜色；环形图最多只画 6 段，不会挤
const DONUT_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'];

// 画一段带小缺口的圆弧（缺口让相邻段分得清）
function donutArc(seg, total, startOffset) {
  const R = 66, C = 2 * Math.PI * R, GAP = 2.5;
  const frac = total > 0 ? seg.total / total : 0;
  const dash = Math.max(0, frac * C - GAP);
  return `<circle cx="100" cy="100" r="${R}" fill="none" stroke="${seg.color}" stroke-width="26"
    stroke-dasharray="${dash.toFixed(2)} ${C.toFixed(2)}"
    stroke-dashoffset="${(-startOffset).toFixed(2)}" transform="rotate(-90 100 100)">
    <title>${escapeHtml(seg.name)}：${fmtMoney(seg.total)} 元（${Math.round(frac * 100)}%）</title>
  </circle>`;
}

// 拼出「环形图 + 中心数字 + 图例」整块 HTML
function buildDonutHtml(segs, total, centerLabel, centerValue, centerClass = '') {
  const R = 66, C = 2 * Math.PI * R;
  let offset = 0;
  const arcs = segs.map(seg => {
    const frac = total > 0 ? seg.total / total : 0;
    const o = offset;
    offset += frac * C;
    return donutArc(seg, total, o);
  }).join('');

  const legend = segs.map(seg => `
    <li class="legend-item">
      <span class="legend-dot" style="background:${seg.color}"></span>
      <span class="legend-name">${escapeHtml(seg.name)}</span>
      <span class="legend-pct">${total > 0 ? Math.round(seg.total / total * 100) : 0}%</span>
      <span class="legend-val">¥${fmtMoney(seg.total)}</span>
    </li>`).join('');

  return `
    <div class="donut-wrap">
      <div class="donut-figure">
        <svg viewBox="0 0 200 200" width="180" height="180" role="img" aria-label="${escapeHtml(centerLabel)}环形图">${arcs}</svg>
        <div class="donut-center">
          <span class="donut-center-label">${escapeHtml(centerLabel)}</span>
          <span class="donut-center-value${centerClass ? ' ' + centerClass : ''}">${centerValue}</span>
        </div>
      </div>
      <ul class="legend">${legend}</ul>
    </div>`;
}

// 分类占比环形图（支出 / 收入通用）：前 5 类 + 「其他」，最多 6 段
function renderDonut(el, cats, opts) {
  const total = cats.reduce((s, c) => s + c.total, 0);

  if (!cats.length || total <= 0) {
    el.innerHTML = `
      <div class="empty-state">
        <p class="empty-title">${opts.emptyTitle}</p>
        <p class="empty-hint">${opts.emptyHint}</p>
      </div>`;
    return;
  }

  const segs = cats.slice(0, 5).map((c, i) => ({ name: c.name, total: c.total, color: DONUT_COLORS[i] }));
  const rest = cats.slice(5);
  if (rest.length) {
    segs.push({ name: '其他', total: rest.reduce((s, c) => s + c.total, 0), color: '#94a3b8' });
  }

  el.innerHTML = buildDonutHtml(segs, total, opts.centerLabel, `¥${fmtMoney(total)}`);
}

// 收支结余环形图：支出 vs 收入 两段，中心显示结余（正=绿，负=红）
function renderBalanceDonut(el, expenseCents, incomeCents) {
  const total = expenseCents + incomeCents;

  if (total <= 0) {
    el.innerHTML = `
      <div class="empty-state">
        <p class="empty-title">本月还没有收支</p>
        <p class="empty-hint">记几笔支出和收入后，这里能看到结余情况</p>
      </div>`;
    return;
  }

  const segs = [
    { name: '支出', total: expenseCents, color: '#ef4444' },
    { name: '收入', total: incomeCents, color: '#10b981' }
  ];
  const balance = incomeCents - expenseCents;
  const balText = (balance < 0 ? '-' : '') + '¥' + fmtMoney(Math.abs(balance));
  const cls = balance >= 0 ? 'pos' : 'neg';
  el.innerHTML = buildDonutHtml(segs, total, '本月结余', balText, cls);
}

/* ==================== 图表：收支趋势（柱状图，范围可选） ==================== */

// 把「分」换成好读的元：52.5 → "52.5"、1800 → "1,800"
function fmtYuan(cents) {
  const v = cents / 100;
  const fixed = Number.isInteger(v) ? v.toFixed(0) : v.toFixed(1);
  const [int, dec] = fixed.split('.');
  return dec ? int.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + dec
             : int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// 纵轴刻度取整（100 / 200 / 500 / 1000……），让柱子贴着整齐的刻度线
function niceCeilYuan(cents) {
  const yuan = Math.max(cents / 100, 1);
  const mag = Math.pow(10, Math.floor(Math.log10(yuan)));
  const norm = yuan / mag;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return step * mag;
}

// 画一根柱子的路径：顶部圆角、底部直角（贴着底线）
function barPath(x, y, w, h, r = 4) {
  const rr = Math.min(r, Math.max(h / 2, 1));
  return `M${x} ${y + h}L${x} ${y + rr}Q${x} ${y} ${x + rr} ${y}H${x + w - rr}Q${x + w} ${y} ${x + w} ${y + rr}V${y + h}Z`;
}

// 年月 → "YYYY-MM"（给月份选择框用）
function ymToStr(y, m) { return `${y}-${String(m).padStart(2, '0')}`; }

// "YYYY-MM" → {year, month}；空值返回 null
function parseYm(value) {
  if (!value) return null;
  const [y, m] = value.split('-').map(Number);
  return (y && m) ? { year: y, month: m } : null;
}

// 以当前月为终点，「近 N 个月」的起始月（比如近3个月 = 前2个月到本月）
function trendStartFor(months) {
  const c = currentYm();
  const d = new Date(c.year, c.month - months, 1);   // 月份做减法自动进位/退位
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

// 初始化趋势范围控件：默认「近6个月」，结束月不能选未来
function initTrendInputs() {
  const c = currentYm();
  const s = trendStartFor(6);
  document.getElementById('trendStart').value = ymToStr(s.year, s.month);
  document.getElementById('trendEnd').value = ymToStr(c.year, c.month);
  document.getElementById('trendStart').max = ymToStr(c.year, c.month);
  document.getElementById('trendEnd').max = ymToStr(c.year, c.month);
}

// 按当前选好的「从…到…」重新画趋势图
async function renderTrendRange() {
  const el = document.getElementById('statsTrend');
  let s = parseYm(document.getElementById('trendStart').value);
  let e = parseYm(document.getElementById('trendEnd').value);
  if (!s || !e) return;
  // 起点晚于终点就交换，保证区间有效
  if (s.year * 12 + s.month > e.year * 12 + e.month) { const t = s; s = e; e = t; }
  try {
    const list = await window.tiantian.getMonthlyTrend(s.year, s.month, e.year, e.month);
    renderTrend(el, list);
  } catch (err) {
    console.error('加载趋势失败：', err);
  }
}

// 快捷按钮：近3 / 近6 / 近12 / 全部
async function setTrendQuick(months) {
  const c = currentYm();
  if (months === 'all') {
    const range = await window.tiantian.getDateRange();
    if (range) {
      const s = { year: Number(range.minDate.slice(0, 4)), month: Number(range.minDate.slice(5, 7)) };
      document.getElementById('trendStart').value = ymToStr(s.year, s.month);
    } else {
      document.getElementById('trendStart').value = ymToStr(c.year, c.month);
    }
    document.getElementById('trendEnd').value = ymToStr(c.year, c.month);
  } else {
    const s = trendStartFor(months);
    document.getElementById('trendStart').value = ymToStr(s.year, s.month);
    document.getElementById('trendEnd').value = ymToStr(c.year, c.month);
  }
  document.querySelectorAll('.range-pill').forEach(p => p.classList.toggle('active', String(p.dataset.months) === String(months)));
  renderTrendRange();
}

function renderTrend(el, list) {
  const maxVal = Math.max(...list.flatMap(m => [m.expense, m.income]), 1);

  if (maxVal <= 0) {
    el.innerHTML = `
      <div class="empty-state">
        <p class="empty-title">这个范围还没有收支记录</p>
        <p class="empty-hint">换个更早的时间范围，或先记几笔账</p>
      </div>`;
    return;
  }

  const W = 640, H = 240, padL = 52, padR = 14, padT = 22, padB = 32;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const yMax = niceCeilYuan(maxVal);        // 纵轴最大值（元）
  const yMaxCents = yMax * 100;
  const y = (cents) => padT + plotH * (1 - cents / yMaxCents);

  // 横线刻度 + 纵轴数字（浅浅的线，不抢眼）
  let grid = '';
  for (let i = 0; i <= 4; i++) {
    const v = yMax * i / 4;
    const yy = y(v * 100);
    grid += `<line x1="${padL}" y1="${yy.toFixed(1)}" x2="${W - padR}" y2="${yy.toFixed(1)}" stroke="#e3eae7" stroke-width="1"/>`;
    grid += `<text x="${padL - 8}" y="${(yy + 4).toFixed(1)}" text-anchor="end" class="axis-label">${fmtAxisYuan(v)}</text>`;
  }

  const n = list.length;
  const groupW = plotW / n;
  const barW = Math.max(3, Math.min(24, groupW * 0.28));
  const gap = n > 20 ? 1 : 3;                      // 月份很多时，柱子间的缝留小一点
  const step = Math.max(1, Math.ceil(n / 12));     // 月份很多时，横轴隔几个月标一次
  let bars = '';

  list.forEach((m, i) => {
    const x0 = padL + groupW * i + (groupW - barW * 2 - gap) / 2;
    const xExp = x0;
    const xInc = x0 + barW + gap;
    const cxExp = xExp + barW / 2;
    const cxInc = xInc + barW / 2;

    if (m.expense > 0) {
      const hExp = m.expense / yMaxCents * plotH;
      const yExp = y(m.expense);
      bars += `<path d="${barPath(xExp, yExp, barW, hExp)}" fill="#ef4444"><title>${m.year}年${m.month}月 支出 ¥${fmtYuan(m.expense)}</title></path>`;
      if (n <= 8 && hExp >= 16) {
        bars += `<text x="${cxExp.toFixed(1)}" y="${(yExp - 6).toFixed(1)}" text-anchor="middle" class="tip-label">${fmtYuan(m.expense)}</text>`;
      }
    }
    if (m.income > 0) {
      const hInc = m.income / yMaxCents * plotH;
      const yInc = y(m.income);
      bars += `<path d="${barPath(xInc, yInc, barW, hInc)}" fill="#10b981"><title>${m.year}年${m.month}月 收入 ¥${fmtYuan(m.income)}</title></path>`;
      if (n <= 8 && hInc >= 16) {
        bars += `<text x="${cxInc.toFixed(1)}" y="${(yInc - 6).toFixed(1)}" text-anchor="middle" class="tip-label">${fmtYuan(m.income)}</text>`;
      }
    }

    // 横轴月份标签：月份很多时隔几步标一次，第一月和最后一月一定标
    const showLabel = (i % step === 0) || i === n - 1;
    if (showLabel) {
      const label = m.month === 1 ? `${m.year}年1月` : `${m.month}月`;
      bars += `<text x="${(x0 + barW + gap / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle" class="axis-label">${label}</text>`;
    }
  });

  el.innerHTML = `
    <div class="trend-legend">
      <span class="trend-legend-item"><span class="legend-dot" style="background:#ef4444"></span>支出</span>
      <span class="trend-legend-item"><span class="legend-dot" style="background:#10b981"></span>收入</span>
    </div>
    <div class="trend-chart">
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="收支趋势柱状图">
        ${grid}${bars}
      </svg>
    </div>`;
}

// 纵轴数字：1,200 这种；上了万就写「1.5万」
function fmtAxisYuan(yuan) {
  if (yuan >= 10000) {
    const w = yuan / 10000;
    return (Number.isInteger(w) ? w : w.toFixed(1)) + '万';
  }
  return yuan.toLocaleString('en-US');
}

// 趋势范围控件的事件
document.querySelectorAll('.range-pill').forEach(pill => {
  pill.addEventListener('click', () => setTrendQuick(pill.dataset.months));
});
document.getElementById('trendStart').addEventListener('change', () => {
  document.querySelectorAll('.range-pill').forEach(p => p.classList.remove('active'));
  renderTrendRange();
});
document.getElementById('trendEnd').addEventListener('change', () => {
  document.querySelectorAll('.range-pill').forEach(p => p.classList.remove('active'));
  renderTrendRange();
});

/* ==================== 数据导出（阶段4） ==================== */

// 点「导出 CSV 备份」：请软件把账生成文件，并弹窗让用户选保存位置
document.getElementById('exportCsvBtn').addEventListener('click', async () => {
  const status = document.getElementById('exportStatus');
  status.className = 'export-status';
  status.textContent = '正在整理账目……';
  try {
    const res = await window.tiantian.exportCsv();
    if (res.ok) {
      status.textContent = `✅ 已导出 ${res.count} 笔账，文件保存在：${res.path}`;
      status.classList.add('ok');
    } else if (res.canceled) {
      status.textContent = '已取消导出，账目没有动。';
    } else {
      status.textContent = `❌ 导出失败：${res.error || '未知原因'}`;
      status.classList.add('err');
    }
  } catch (e) {
    status.textContent = `❌ 导出出错：${e.message}`;
    status.classList.add('err');
  }
});

/* ==================== 启动 ==================== */

refreshOverview();
setType('expense');
initTrendInputs();   // 设置趋势图默认范围（近6个月）
