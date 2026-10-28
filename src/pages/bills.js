/**
 * 天天记账 —— 账单页
 *
 * 大白话：这一页按月把账目列出来，还能按「收支类型 / 分类 / 备注关键字」筛。
 * 一个月的数据一次性取回来（通常几十条），筛选全在内存里做，不再往数据库跑，
 * 所以点筛选是瞬间出结果。
 *
 * 和别的页面的关系：点某一行的「修改」会去调 features/add-record.js 打开弹窗，
 * 保存后由 app.js 的 refreshAll 回头刷新这里，本页不自己重算。
 */

(function (global) {
  'use strict';

  const TT = (global.TT = global.TT || {});
  const { q } = TT.dom;
  const { escapeHtml, toast } = TT.dom;
  const { money, currentYm } = TT.format;
  const { iconOf, EXPENSE, INCOME } = TT.categories;

  // 本页自己的状态：正在看哪个月、这个月的全部记录（未筛选）
  // 0 表示「还没初始化」，第一次打开时设成当前月
  let year = 0;
  let month = 0;
  let records = [];

  /**
   * 判断某个年月是不是「未来」（未来月份不让看：账还没发生，看了也是空的）
   * @param {number} y
   * @param {number} m
   * @returns {boolean}
   */
  function isFuture(y, m) {
    const now = currentYm();
    return y > now.year || (y === now.year && m > now.month);
  }

  /**
   * 把页面顶部那句「2026年10月」和「下个月」按钮的可用状态更新一下
   */
  function syncHeader() {
    q('billMonthLabel').textContent = `${year}年${month}月`;
    const now = currentYm();
    q('billNextMonth').disabled = year > now.year || (year === now.year && month >= now.month);
  }

  /**
   * 翻月份
   * @param {number} delta -1 上个月，+1 下个月
   */
  function shift(delta) {
    const d = new Date(year, month - 1 + delta, 1);
    const next = { year: d.getFullYear(), month: d.getMonth() + 1 };
    if (delta > 0 && isFuture(next.year, next.month)) return; // 不许翻到未来
    year = next.year;
    month = next.month;
    load();
  }

  /**
   * 把分类下拉框填满（支出 + 收入的大类都要能选到），并尽量保留用户已经选中的那项
   */
  function fillCategoryOptions() {
    const select = q('billCatFilter');
    const names = [...EXPENSE, ...INCOME].map((c) => c.name);
    const previous = select.value;
    select.innerHTML = '<option value="all">全部分类</option>' +
      names.map((n) => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('');
    select.value = names.includes(previous) ? previous : 'all';
  }

  /**
   * 按当前的筛选条件，从本月记录里挑出要显示的
   * @returns {object[]}
   */
  function filtered() {
    const type = q('billTypeFilter').value;
    const category = q('billCatFilter').value;
    const keyword = q('billSearch').value.trim().toLowerCase();

    return records.filter((r) => {
      if (type !== 'all' && r.type !== type) return false;
      if (category !== 'all' && r.categoryMain !== category) return false;
      if (keyword && !(r.note || '').toLowerCase().includes(keyword)) return false;
      return true;
    });
  }

  /**
   * 渲染一行账目（带修改/删除按钮）
   * @param {object} r 一笔账
   * @returns {string} 一行 HTML
   */
  function rowHtml(r) {
    const isExpense = r.type === 'expense';
    const sign = isExpense ? '-' : '+';
    return `
      <li class="bill-row" data-id="${r.id}">
        <span class="record-icon">${iconOf(r.categoryMain)}</span>
        <div class="record-main">
          <div class="record-cat">${escapeHtml(r.categoryMain)} · ${escapeHtml(r.categorySub)}</div>
          <div class="record-note">${escapeHtml(r.note) || '&nbsp;'}</div>
        </div>
        <span class="bill-amount ${isExpense ? 'expense' : 'income'}">${sign}¥${r.amount.toFixed(2)}</span>
        <div class="bill-actions">
          <button class="bill-btn edit" type="button" data-action="edit">修改</button>
          <button class="bill-btn del" type="button" data-action="delete">删除</button>
        </div>
      </li>`;
  }

  /**
   * 把筛选后的记录按天分组，画到页面上
   */
  function render() {
    const list = filtered();
    const emptyEl = q('billEmpty');
    const listEl = q('billList');

    if (list.length === 0) {
      // 空状态分两种：这个月真没记账 / 有账但被筛没了。提示文案要说得不一样，别让人以为数据丢了
      const nowFiltering = q('billTypeFilter').value !== 'all' ||
        q('billCatFilter').value !== 'all' ||
        q('billSearch').value.trim() !== '';

      if (records.length === 0) {
        q('billEmptyTitle').textContent = '本月还没有记录';
        q('billEmptyHint').textContent = '点左侧「＋ 记一笔」记一笔，或用箭头看看其他月份';
      } else if (nowFiltering) {
        q('billEmptyTitle').textContent = '没有符合条件的记录';
        q('billEmptyHint').textContent = '换个筛选条件或清空搜索试试';
      }

      emptyEl.classList.remove('hidden');
      listEl.classList.add('hidden');
      listEl.innerHTML = '';
      return;
    }

    emptyEl.classList.add('hidden');
    listEl.classList.remove('hidden');

    // 按日期分组：同一天的账归到一个「日期块」里，右侧显示当天支/收小计
    const groups = {};
    for (const r of list) (groups[r.date] = groups[r.date] || []).push(r);
    const dates = Object.keys(groups).sort((a, b) => b.localeCompare(a));

    listEl.innerHTML = dates.map((date) => {
      const dayRecords = groups[date];
      const dayExpense = dayRecords.filter((r) => r.type === 'expense').reduce((sum, r) => sum + r.amountCents, 0);
      const dayIncome = dayRecords.filter((r) => r.type === 'income').reduce((sum, r) => sum + r.amountCents, 0);

      const parts = [];
      if (dayExpense) parts.push(`支 ¥${money(dayExpense)}`);
      if (dayIncome) parts.push(`收 ¥${money(dayIncome)}`);

      const d = new Date(`${date}T00:00:00`);
      return `
        <div class="bill-day">
          <div class="bill-day-head">
            <span class="bill-day-date">${d.getMonth() + 1}月${d.getDate()}日</span>
            <span class="bill-day-sum">${parts.join('　')}</span>
          </div>
          <ul class="bill-day-list">
            ${dayRecords.map(rowHtml).join('')}
          </ul>
        </div>`;
    }).join('');
  }

  /**
   * 删除一笔（先弹确认框，删掉后整页刷新）
   * @param {object} record 要删的那笔
   */
  async function remove(record) {
    const text = `确定删除这笔账吗？\n${record.categoryMain}·${record.categorySub} ¥${record.amount.toFixed(2)}\n删除后无法恢复。`;
    if (!confirm(text)) return;

    try {
      await window.tiantian.deleteRecord(record.id);
      toast('已删除这笔账');
      TT.refreshAll();
    } catch (err) {
      console.error('删除失败：', err);
      toast('删除失败，请重试');
    }
  }

  /**
   * 加载某个月的记录并画出来
   */
  async function load() {
    // 第一次进来先定位到当前月
    if (!year) {
      const now = currentYm();
      year = now.year;
      month = now.month;
    }

    syncHeader();

    try {
      records = await window.tiantian.getRecordsByMonth(year, month);
      fillCategoryOptions();
      render();
    } catch (err) {
      console.error('加载账单失败：', err);
      toast('账单加载失败，请重试');
    }
  }

  /* ---------- 事件绑定（只绑一次，跟着页面生命周期走） ---------- */

  q('billPrevMonth').addEventListener('click', () => shift(-1));
  q('billNextMonth').addEventListener('click', () => shift(1));
  q('billTodayBtn').addEventListener('click', () => {
    const now = currentYm();
    year = now.year;
    month = now.month;
    load();
  });
  q('billTypeFilter').addEventListener('change', render);
  q('billCatFilter').addEventListener('change', render);
  q('billSearch').addEventListener('input', render);

  // 修改 / 删除用「事件委托」：只在一个父容器上听，行是动态生成的也不用重复绑
  q('billList').addEventListener('click', (e) => {
    const btn = e.target.closest('.bill-btn');
    if (!btn) return;
    const row = btn.closest('.bill-row');
    if (!row) return;

    const id = Number(row.dataset.id);
    const record = records.find((r) => r.id === id);
    if (!record) return;

    if (btn.dataset.action === 'edit') TT.features.addRecord.openForEdit(record);
    else if (btn.dataset.action === 'delete') remove(record);
  });

  TT.pages = TT.pages || {};
  TT.pages.bills = { load };
})(window);
