/**
 * 天天记账 —— 概览页（首页）
 *
 * 大白话：首页只干三件事——把本月花了多少/赚了多少/还剩多少算出来，
 * 再把最近记的几笔列出来。数据全部来自主进程（window.tiantian），页面自己不算钱。
 *
 * 这是「页面模块」的统一写法，五个页面都一样：
 *   TT.pages.xxx = { load }   ← 页面被切到/数据变了，就调一次 load()
 * 好处：谁负责哪块界面一目了然，加新页面也只是多一个文件。
 */

(function (global) {
  'use strict';

  const TT = (global.TT = global.TT || {});
  const { q } = TT.dom;
  const { escapeHtml } = TT.dom;
  const { money, currentYm } = TT.format;
  const { iconOf } = TT.categories;

  /**
   * 渲染「最近记录」列表
   * @param {object[]} records 最近的几笔账
   */
  function renderRecent(records) {
    const emptyEl = q('recentEmpty');
    const listEl = q('recentList');

    // 一笔都没有：显示引导文案，而不是一个空列表
    if (!records || records.length === 0) {
      emptyEl.classList.remove('hidden');
      listEl.classList.add('hidden');
      return;
    }

    emptyEl.classList.add('hidden');
    listEl.classList.remove('hidden');
    listEl.innerHTML = records.map((r) => {
      const isExpense = r.type === 'expense';
      const sign = isExpense ? '-' : '+';
      return `
        <li class="record-item">
          <span class="record-icon">${iconOf(r.categoryMain)}</span>
          <div class="record-main">
            <div class="record-cat">${escapeHtml(r.categoryMain)} · ${escapeHtml(r.categorySub)}</div>
            <div class="record-note">${escapeHtml(r.note)}</div>
          </div>
          <span class="record-date">${r.date.slice(5).replace('-', '/')}</span>
          <span class="record-amount ${isExpense ? 'expense' : 'income'}">${sign}¥${r.amount.toFixed(2)}</span>
        </li>`;
    }).join('');
  }

  /**
   * 刷新首页：顶部三张卡片 + 最近记录
   * 记完一笔、改完一笔、删完一笔都会调它（见 app.js 的 refreshAll）
   */
  async function load() {
    const { year, month } = currentYm();
    q('overviewMonth').textContent = `${year}年${month}月`;

    try {
      const summary = await window.tiantian.getMonthlySummary(year, month);
      q('statExpense').textContent = money(summary.expense);
      q('statIncome').textContent = money(summary.income);
      q('statBalance').textContent = money(summary.balance);

      // 首页只放 5 条，多了就让用户去「账单」页看
      renderRecent(await window.tiantian.getRecentRecords(5));
    } catch (err) {
      console.error('加载概览失败：', err);
    }
  }

  TT.pages = TT.pages || {};
  TT.pages.overview = { load };
})(window);
