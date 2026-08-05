/**
 * 黑马记账 —— 界面逻辑
 *
 * 用大白话解释：这个文件负责界面上所有"点一下会发生什么"的事情。
 * 比如：点左侧菜单切换页面、打开/关闭记账弹窗、选择分类等。
 *
 * 当前阶段（阶段1）：只做界面展示和交互，数据保存将在「阶段2」接入。
 */

/* ==================== 分类数据 ==================== */

// 支出分类（一级大类 -> 二级小类）
const EXPENSE_CATEGORIES = [
  { name: '餐饮美食', icon: '🍜', subs: ['早餐', '午餐', '晚餐', '水果零食', '饮料奶茶', '外卖外食'] },
  { name: '交通出行', icon: '🚗', subs: ['公交地铁', '打车网约车', '共享单车', '油费充电', '停车过路费', '火车飞机'] },
  { name: '居住生活', icon: '🏠', subs: ['房租房贷', '水电燃气', '物业费', '日用百货', '家具家电', '保洁维修'] },
  { name: '购物打扮', icon: '🛍️', subs: ['服饰鞋帽', '护肤美妆', '数码电子', '首饰配饰', '箱包'] },
  { name: '娱乐休闲', icon: '🎬', subs: ['电影演出', '游戏充值', '会员订阅', '运动健身', '旅行度假'] },
  { name: '医疗健康', icon: '💊', subs: ['门诊挂号', '药品', '体检', '医疗保险', '保健按摩'] },
  { name: '教育学习', icon: '📚', subs: ['学费培训', '考证报名', '图书文具', '知识付费'] },
  { name: '人情往来', icon: '🎁', subs: ['红包礼金', '礼品', '请客', '孝敬长辈', '公益捐赠'] },
  { name: '通讯网络', icon: '📱', subs: ['话费', '手机流量', '宽带网络'] },
  { name: '其他支出', icon: '📦', subs: ['宠物', '快递物流', '金融服务费', '零钱杂项'] }
];

// 收入分类（一级大类 -> 二级小类）
const INCOME_CATEGORIES = [
  { name: '工资奖金', icon: '💰', subs: ['工资', '奖金', '津贴补贴'] },
  { name: '理财收益', icon: '📈', subs: ['利息', '基金股票收益', '其他理财'] },
  { name: '红包礼金', icon: '🧧', subs: ['红包', '礼金'] },
  { name: '兼职副业', icon: '💼', subs: ['兼职收入', '稿费', '其他副业'] },
  { name: '其他收入', icon: '🏷️', subs: ['其他'] }
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
  typeIncomeBtn.classList.toggle('active', type === 'income');
  const cats = getCategories();
  currentMain = cats[0].name;   // 默认选第一个大类
  currentSub = cats[0].subs[0]; // 默认选第一个小类
  renderCategoryTabs();
}

typeExpenseBtn.addEventListener('click', () => setType('expense'));
typeIncomeBtn.addEventListener('click', () => setType('income'));

/* ==================== 分类选择 ==================== */

// 渲染一级大类标签（横排按钮）
function renderCategoryTabs() {
  const cats = getCategories();
  catTabsEl.innerHTML = '';
  cats.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'cat-tab' + (cat.name === currentMain ? ' active' : '');
    btn.textContent = cat.icon + ' ' + cat.name;
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

document.getElementById('saveBtn').addEventListener('click', () => {
  const amount = parseFloat(document.getElementById('amountInput').value);

  // 简单检查：金额必须是大于 0 的数字
  if (!amount || amount <= 0) {
    showToast('请输入金额，例如 12.50');
    return;
  }

  // —— 目前只到界面这一步。保存到数据库将在「阶段2」接入 ——
  const date = document.getElementById('dateInput').value || '今天';
  const note = document.getElementById('noteInput').value.trim() || '（无备注）';
  const typeText = currentType === 'expense' ? '支出' : '收入';
  const record = { type: currentType, amount, main: currentMain, sub: currentSub, date, note };

  // 临时在开发者控制台打印出来，方便确认界面逻辑正确
  console.log('即将保存的记录：', record);

  showToast(`✓ ${typeText} ¥${amount.toFixed(2)}（${currentMain}·${currentSub}）—— 保存功能将在下一阶段接入`);
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

/* ==================== 概览页初始化 ==================== */

function initOverview() {
  const now = new Date();
  const month = `${now.getFullYear()}年${now.getMonth() + 1}月`;
  document.getElementById('overviewMonth').textContent = month;

  // 本月收支数据在「阶段2」接入数据库后才会真实显示，目前显示 0.00
  document.getElementById('statExpense').textContent = '0.00';
  document.getElementById('statIncome').textContent = '0.00';
  document.getElementById('statBalance').textContent = '0.00';
}

/* ==================== 启动 ==================== */

initOverview();
setType('expense');
