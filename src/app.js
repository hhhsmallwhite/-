/**
 * 天天记账 —— 界面启动与页面调度
 *
 * 大白话：这个文件是界面的「总调度」。它干三件事：
 *   1. 启动时把各个页面叫醒（首页取数、游戏读最高分、设置页显示版本）；
 *   2. 点左边导航时切页面，并让新页面去取自己的数据；
 *   3. 记完/改完/删完一笔后，统一通知各页面刷新（refreshAll）。
 *
 * 为什么刷新要集中在这里：以前是「谁改了数据谁负责通知别人」，结果三个页面互相调，
 * 改一处漏两处。现在只有一个方向——数据变了就叫 refreshAll，
 * 各页面自己知道该怎么重画，互不干涉。
 *
 * 页面模块的统一约定（五个页面都一样）：
 *   TT.pages.<名字> = { load() }   切到该页 / 数据变化时会被调用
 */

(function (global) {
  'use strict';

  const TT = (global.TT = global.TT || {});
  const { qa } = TT.dom;

  // 当前显示的是哪一页
  let current = 'overview';

  /**
   * 切换页面
   * @param {string} name 页面名：overview / bills / stats / settings / game
   */
  function switchPage(name) {
    current = name;

    // 左边导航高亮 + 右边内容区显示对应的那一块
    qa('.nav-item').forEach((btn) => btn.classList.toggle('active', btn.dataset.page === name));
    qa('.page').forEach((page) => page.classList.toggle('active', page.id === `page-${name}`));

    // 切过去就让那一页去取最新的数据（首页和游戏页常驻，不必重取）
    const page = TT.pages[name];
    if (page && typeof page.load === 'function') page.load();
  }

  /**
   * 数据变了：刷新所有「正在显示」的页面。
   * 首页每次都刷（它是用户回来的第一眼）；账单页和统计页只有正显示着才刷，
   * 免得在看不见的地方白跑数据库。
   */
  function refreshAll() {
    TT.pages.overview.load();
    if (current === 'bills') TT.pages.bills.load();
    if (current === 'stats') TT.pages.stats.load();
  }

  // 先把 refreshAll 挂出去：features/add-record.js 保存成功后会调它
  TT.refreshAll = refreshAll;

  /**
   * 把界面里没人接住的错误报给主进程，写进日志文件。
   * 为什么要这么绕：正式软件没有控制台，界面崩了用户只会看到「白了一下」，
   * 事后完全查不到原因。写进文件，才有东西可以发出来看。
   * @param {string} text
   */
  function report(text) {
    try {
      window.tiantian.reportError(String(text).slice(0, 1000));
    } catch (err) {
      // 连报错都报不出去，那就真的没办法了，至少别把界面搞崩
    }
  }

  /**
   * 启动：绑导航 → 叫醒各页面 → 首页取数
   */
  function boot() {
    // 先挂上错误上报，后面任何一步出错都能留下痕迹
    window.addEventListener('error', (event) => {
      const file = event.filename ? event.filename.split(/[\\/]/).pop() : '未知文件';
      report(`${event.message} @ ${file}:${event.lineno}`);
    });
    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason;
      report(`未处理的 Promise 拒绝：${reason && reason.message ? reason.message : reason}`);
    });

    qa('.nav-item').forEach((btn) => {
      btn.addEventListener('click', () => switchPage(btn.dataset.page));
    });

    // 记一笔弹窗的分类按钮要先渲染出来，用户点开才是现成的
    TT.features.addRecord.setType('expense');

    // 设置页先把版本号显示上（不用等用户点进去才去问）
    TT.pages.settings.load();

    // 游戏页初始化：读历史最高分、摆好第一局（还没开始跑）
    TT.pages.game.init();

    // 首页取数（后端可能还没准备好，所以放最后）
    TT.pages.overview.load();
  }

  // 脚本放在 body 末尾，DOM 已经齐了，直接启动
  boot();
})(window);
