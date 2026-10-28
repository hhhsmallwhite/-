/**
 * 天天记账 —— 图表（环形图 + 柱状趋势图）
 *
 * 大白话：这个软件一开始就定了「不下载任何多余的库」，所以图表没走 ECharts 那条路，
 * 而是拿浏览器自带的 SVG 手画：环形图是一圈带缺口的圆环，柱状图是一根根圆角柱子。
 * 好处是体积为零、配色完全可控；坏处是加减法要自己算，所以单独放一个文件并写清注释。
 *
 * 用法：页面里调 TT.charts.donut(el, 分类数组, 选项)，传进去一个容器元素就行。
 */

(function (global) {
  'use strict';

  const TT = (global.TT = global.TT || {});
  const { escapeHtml } = TT.dom;
  const { money, yuan, niceCeilYuan, axisYuan } = TT.format;

  // 分类配色：8 个一眼能分开的颜色。环形图最多画 6 段（前 5 类 + 其他），所以够用
  const DONUT_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'];

  // 圆环的半径和留白：半径 66，环宽 26，段与段之间留 2.5 的小缝，分得清又不散
  const R = 66;
  const CIRCUMFERENCE = 2 * Math.PI * R;
  const GAP = 2.5;

  /**
   * 画一段圆环。
   * 原理（大白话）：圆环其实是用「虚线」画出来的——先算出整圈的长度，
   * 再让这段线「画 frac 比例那么长，剩下的都是空白」，就成了一段圆弧。
   * @param {{ name: string, total: number, color: string }} seg 这一段的数据
   * @param {number} total 所有段加起来的总数（算占比用）
   * @param {number} startOffset 这段从圆环的哪个位置开始（单位：长度）
   * @returns {string} 一个 <circle> 的 HTML
   */
  function arc(seg, total, startOffset) {
    const frac = total > 0 ? seg.total / total : 0;
    const dash = Math.max(0, frac * CIRCUMFERENCE - GAP);
    return `<circle cx="100" cy="100" r="${R}" fill="none" stroke="${seg.color}" stroke-width="26"
      stroke-dasharray="${dash.toFixed(2)} ${CIRCUMFERENCE.toFixed(2)}"
      stroke-dashoffset="${(-startOffset).toFixed(2)}" transform="rotate(-90 100 100)">
      <title>${escapeHtml(seg.name)}：${money(seg.total)} 元（${Math.round(frac * 100)}%）</title>
    </circle>`;
  }

  /**
   * 拼出「圆环 + 中间大数字 + 右边图例」这一整块
   * @param {{ name: string, total: number, color: string }[]} segs 各段
   * @param {number} total 总额（分）
   * @param {string} centerLabel 中间那行小字（如「总支出」）
   * @param {string} centerValue 中间的大数字（已格式化好的文字，如「¥279.00」）
   * @param {string} [centerClass] 大数字的颜色类（pos 绿 / neg 红）
   * @returns {string} 整块 HTML
   */
  function donutHtml(segs, total, centerLabel, centerValue, centerClass) {
    let offset = 0;
    const arcs = segs.map((seg) => {
      const frac = total > 0 ? seg.total / total : 0;
      const start = offset;
      offset += frac * CIRCUMFERENCE;
      return arc(seg, total, start);
    }).join('');

    const legend = segs.map((seg) => `
      <li class="legend-item">
        <span class="legend-dot" style="background:${seg.color}"></span>
        <span class="legend-name">${escapeHtml(seg.name)}</span>
        <span class="legend-pct">${total > 0 ? Math.round((seg.total / total) * 100) : 0}%</span>
        <span class="legend-val">¥${money(seg.total)}</span>
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

  /**
   * 画「分类占比」环形图：前 5 类单独成段，剩下的合成「其他」，最多 6 段，不会挤成一团
   * @param {HTMLElement} el 容器
   * @param {{ name: string, total: number }[]} cats 分类汇总（金额从高到低）
   * @param {{ centerLabel: string, emptyTitle: string, emptyHint: string }} opts 文案
   */
  function donut(el, cats, opts) {
    const total = cats.reduce((sum, c) => sum + c.total, 0);

    // 这个月一笔都没有：显示一句人话，而不是画个空环
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
      segs.push({ name: '其他', total: rest.reduce((sum, c) => sum + c.total, 0), color: '#94a3b8' });
    }

    el.innerHTML = donutHtml(segs, total, opts.centerLabel, `¥${money(total)}`);
  }

  /**
   * 画「收支结余」环形图：支出和收入两段，中间显示结余（收入多显示绿色，亏空显示红色）
   * @param {HTMLElement} el 容器
   * @param {number} expenseCents 本月支出（分）
   * @param {number} incomeCents 本月收入（分）
   */
  function balanceDonut(el, expenseCents, incomeCents) {
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
    const text = `${balance < 0 ? '-' : ''}¥${money(Math.abs(balance))}`;
    el.innerHTML = donutHtml(segs, total, '本月结余', text, balance >= 0 ? 'pos' : 'neg');
  }

  /**
   * 画一根柱子：顶部两个圆角、底部是直角（因为贴着横轴，圆角会像浮起来）
   * @param {number} x 左边位置
   * @param {number} y 顶部位置
   * @param {number} w 宽
   * @param {number} h 高
   * @param {number} [r] 圆角半径
   * @returns {string} SVG path 的 d 属性
   */
  function barPath(x, y, w, h, r = 4) {
    const rr = Math.min(r, Math.max(h / 2, 1));
    return `M${x} ${y + h}L${x} ${y + rr}Q${x} ${y} ${x + rr} ${y}H${x + w - rr}Q${x + w} ${y} ${x + w} ${y + rr}V${y + h}Z`;
  }

  // 画布的宽高和四周留白（左边留给纵轴数字，下边留给月份）
  const W = 640;
  const H = 240;
  const PAD_L = 52;
  const PAD_R = 14;
  const PAD_T = 22;
  const PAD_B = 32;

  /**
   * 画「收支趋势」柱状图：每个月两根柱，红的是支出、绿的是收入
   * @param {HTMLElement} el 容器
   * @param {{ year: number, month: number, expense: number, income: number }[]} list 逐月数据
   */
  function trend(el, list) {
    const maxValue = Math.max(...list.flatMap((m) => [m.expense, m.income]), 1);

    if (maxValue <= 0) {
      el.innerHTML = `
        <div class="empty-state">
          <p class="empty-title">这个范围还没有收支记录</p>
          <p class="empty-hint">换个更早的时间范围，或先记几笔账</p>
        </div>`;
      return;
    }

    const plotW = W - PAD_L - PAD_R;
    const plotH = H - PAD_T - PAD_B;
    const yMaxYuan = niceCeilYuan(maxValue);
    const yMaxCents = yMaxYuan * 100;

    // 分 → 像素高度（越有钱柱子越高，注意 SVG 的 y 轴是往下长的，所以要用 1 - 比例）
    const toY = (cents) => PAD_T + plotH * (1 - cents / yMaxCents);

    // 横格线 + 纵轴数字（4 等分，线画得很浅，不抢柱子）
    let grid = '';
    for (let i = 0; i <= 4; i++) {
      const value = (yMaxYuan * i) / 4;
      const y = toY(value * 100);
      grid += `<line x1="${PAD_L}" y1="${y.toFixed(1)}" x2="${W - PAD_R}" y2="${y.toFixed(1)}" stroke="#e3eae7" stroke-width="1"/>`;
      grid += `<text x="${PAD_L - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end" class="axis-label">${axisYuan(value)}</text>`;
    }

    const count = list.length;
    const groupW = plotW / count;
    const barW = Math.max(3, Math.min(24, groupW * 0.28));
    const gap = count > 20 ? 1 : 3; // 月份很多时把缝收窄，不然柱子细得看不见
    const step = Math.max(1, Math.ceil(count / 12)); // 橫轴标签隔几个月标一次，免得糊成一片
    let bars = '';

    list.forEach((m, i) => {
      const x0 = PAD_L + groupW * i + (groupW - barW * 2 - gap) / 2;
      const xExpense = x0;
      const xIncome = x0 + barW + gap;

      // 支出柱
      if (m.expense > 0) {
        const h = (m.expense / yMaxCents) * plotH;
        const y = toY(m.expense);
        bars += `<path d="${barPath(xExpense, y, barW, h)}" fill="#ef4444"><title>${m.year}年${m.month}月 支出 ¥${yuan(m.expense)}</title></path>`;
        // 柱子够高、月份不太多时，在柱顶标个数字
        if (count <= 8 && h >= 16) {
          bars += `<text x="${(xExpense + barW / 2).toFixed(1)}" y="${(y - 6).toFixed(1)}" text-anchor="middle" class="tip-label">${yuan(m.expense)}</text>`;
        }
      }

      // 收入柱
      if (m.income > 0) {
        const h = (m.income / yMaxCents) * plotH;
        const y = toY(m.income);
        bars += `<path d="${barPath(xIncome, y, barW, h)}" fill="#10b981"><title>${m.year}年${m.month}月 收入 ¥${yuan(m.income)}</title></path>`;
        if (count <= 8 && h >= 16) {
          bars += `<text x="${(xIncome + barW / 2).toFixed(1)}" y="${(y - 6).toFixed(1)}" text-anchor="middle" class="tip-label">${yuan(m.income)}</text>`;
        }
      }

      // 横轴月份：第一个月和最后一个月一定要标，中间隔几步标一个
      const showLabel = i % step === 0 || i === count - 1;
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

  TT.charts = { donut, balanceDonut, trend };
})(window);
