/**
 * 黑马记账 —— 界面逻辑
 *
 * 用大白话解释：这个文件负责界面上所有"点一下会发生什么"的事情。
 * 比如：点左侧菜单切换页面、打开/关闭记账弹窗、选择分类等。
 *
 * 当前阶段（阶段1）：只做界面展示和交互，数据保存将在「阶段2」接入。
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
}

document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => switchPage(btn.dataset.page));
});

/* ==================== 记一笔弹窗 ==================== */

const modal = document.getElementById('addModal');
const catTabsEl = document.getElementById('catTabs');
const catGridEl = document.getElementById('catGrid');

function openModal() {
  resetForm();
  modal.classList.remove('hidden');
  document.getElementById('amountInput').focus();
}

function closeModal() {
  modal.classList.add('hidden');
}

document.getElementById('openAddBtn').addEventListener('click', openModal);
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
    await window.blackhorse.addRecord(record);
    showToast(`✓ 已保存 ${typeText} ¥${amount.toFixed(2)}（${currentMain}·${currentSub}）`);
    closeModal();
    refreshOverview();
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
    const s = await window.blackhorse.getMonthlySummary(year, month);
    document.getElementById('statExpense').textContent = fmtMoney(s.expense);
    document.getElementById('statIncome').textContent = fmtMoney(s.income);
    document.getElementById('statBalance').textContent = fmtMoney(s.balance);

    // 最近记的几笔
    const records = await window.blackhorse.getRecentRecords(5);
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

/* ==================== 启动 ==================== */

refreshOverview();
setType('expense');
