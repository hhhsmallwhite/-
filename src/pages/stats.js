/**
 * 天天记账 —— 统计页
 *
 * 大白话：这一页回答三个问题——「这个月花在哪些分类上」「收入都从哪来」
 * 「最近半年起伏怎么样」。三张环形图 + 一张柱状趋势图，数据都由主进程算好，
 * 页面只负责把数字变成画面（画的部分在 lib/charts.js）。
 *
 * 月份和趋势范围是两件不同的事，别搞混：
 *   - 顶部切月份 → 影响三张环形图和上方三个数字；
 *   - 底部「从…到…」→ 只影响趋势柱状图。
 */

(function (global) {
  'use strict';

  const TT = (global.TT = global.TT || {});
  const { q, qa } = TT.dom;
  const { money, ymToStr, parseYm, currentYm } = TT.format;
  const { donut, balanceDonut, trend } = TT.charts;

  // 本页状态：正在看哪个月（0 = 还没初始化）
  let year = 0;
  let month = 0;

  /**
   * 以当前月为终点，算出「近 N 个月」的起始年月
   * @param {number} months 几个月
   * @returns {{ year: number, month: number }}
   */
  function startFor(months) {
    const now = currentYm();
    const d = new Date(now.year, now.month - months, 1); // 月份做减法会自动进位/退位
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  }

  /**
   * 初始化底部趋势范围的默认值（近 6 个月），并把「不能选未来」限制上
   */
  function initTrendInputs() {
    const now = currentYm();
    const start = startFor(6);
    q('trendStart').value = ymToStr(start.year, start.month);
    q('trendEnd').value = ymToStr(now.year, now.month);
    // max 属性会挡住日历里未来的月份，省得用户选了却查不到东西
    q('trendStart').max = ymToStr(now.year, now.month);
    q('trendEnd').max = ymToStr(now.year, now.month);
  }

  /**
   * 按当前「从…到…」重画趋势图
   */
  async function renderTrendRange() {
    let start = parseYm(q('trendStart').value);
    let end = parseYm(q('trendEnd').value);
    if (!start || !end) return;

    // 起点晚于终点就互换，用户乱填也能画出图，不至于报错
    if (start.year * 12 + start.month > end.year * 12 + end.month) {
      const tmp = start;
      start = end;
      end = tmp;
    }

    try {
      const list = await window.tiantian.getMonthlyTrend(start.year, start.month, end.year, end.month);
      trend(q('statsTrend'), list);
    } catch (err) {
      console.error('加载趋势失败：', err);
    }
  }

  /**
   * 快捷按钮：近 3 / 近 6 / 近 12 / 全部
   * @param {string} months 月数，或 'all'
   */
  async function setQuickRange(months) {
    const now = currentYm();

    if (months === 'all') {
      const range = await window.tiantian.getDateRange();
      if (range) {
        const s = { year: Number(range.minDate.slice(0, 4)), month: Number(range.minDate.slice(5, 7)) };
        q('trendStart').value = ymToStr(s.year, s.month);
      } else {
        // 一条记录都没有时，「全部」就等于「只有这个月」
        q('trendStart').value = ymToStr(now.year, now.month);
      }
      q('trendEnd').value = ymToStr(now.year, now.month);
    } else {
      const s = startFor(months);
      q('trendStart').value = ymToStr(s.year, s.month);
      q('trendEnd').value = ymToStr(now.year, now.month);
    }

    // 高亮当前选中的那个快捷按钮（手改了日期就全部取消高亮）
    qa('.range-pill').forEach((p) => p.classList.toggle('active', String(p.dataset.months) === String(months)));
    renderTrendRange();
  }

  /**
   * 刷新本页：三个数字 + 三张环形图 + 趋势图
   */
  async function load() {
    if (!year) {
      const now = currentYm();
      year = now.year;
      month = now.month;
    }

    // 顶部月份标签 + 「下个月」按钮可用状态（本页只管自己的按钮，不再去碰账单页的）
    q('statsMonthLabel').textContent = `${year}年${month}月`;
    const now = currentYm();
    q('statsNextMonth').disabled = year > now.year || (year === now.year && month >= now.month);

    try {
      const summary = await window.tiantian.getMonthlySummary(year, month);
      q('statsExpense').textContent = money(summary.expense);
      q('statsIncome').textContent = money(summary.income);
      q('statsBalance').textContent = money(summary.balance);

      // 支出占比
      donut(q('statsDonut'), await window.tiantian.getCategoryTotals(year, month, 'expense'), {
        centerLabel: '总支出',
        emptyTitle: '本月还没有支出',
        emptyHint: '记一笔支出后，这里就能看到钱都花在哪些分类'
      });

      // 收入占比
      donut(q('statsDonutIncome'), await window.tiantian.getCategoryTotals(year, month, 'income'), {
        centerLabel: '总收入',
        emptyTitle: '本月还没有收入',
        emptyHint: '记一笔收入后，这里就能看到钱都是从哪来的'
      });

      // 收支对比（中间显示结余）
      balanceDonut(q('statsBalanceDonut'), summary.expense, summary.income);

      // 趋势图：第一次进来先铺好默认范围
      if (!q('trendStart').value) initTrendInputs();
      renderTrendRange();
    } catch (err) {
      console.error('加载统计失败：', err);
    }
  }

  /**
   * 翻月份
   * @param {number} delta -1 上个月，+1 下个月
   */
  function shift(delta) {
    const d = new Date(year, month - 1 + delta, 1);
    const next = { year: d.getFullYear(), month: d.getMonth() + 1 };
    const now = currentYm();
    if (delta > 0 && (next.year > now.year || (next.year === now.year && next.month > now.month))) return;
    year = next.year;
    month = next.month;
    load();
  }

  /* ---------- 事件绑定 ---------- */

  q('statsPrevMonth').addEventListener('click', () => shift(-1));
  q('statsNextMonth').addEventListener('click', () => shift(1));
  q('statsTodayBtn').addEventListener('click', () => {
    const now = currentYm();
    year = now.year;
    month = now.month;
    load();
  });

  qa('.range-pill').forEach((pill) => {
    pill.addEventListener('click', () => setQuickRange(pill.dataset.months));
  });

  // 手动改日期就取消快捷按钮的高亮，避免「亮着近6个月、实际画的是别的区间」
  q('trendStart').addEventListener('change', () => {
    qa('.range-pill').forEach((p) => p.classList.remove('active'));
    renderTrendRange();
  });
  q('trendEnd').addEventListener('change', () => {
    qa('.range-pill').forEach((p) => p.classList.remove('active'));
    renderTrendRange();
  });

  TT.pages = TT.pages || {};
  TT.pages.stats = { load };
})(window);
