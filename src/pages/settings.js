/**
 * 天天记账 —— 设置页
 *
 * 大白话：这一页现在只有两件事——导出 CSV 备份，以及看看软件是什么版本。
 * 导出用到的「弹保存框、写文件」都在主进程做（界面碰不了硬盘），
 * 这里只负责把结果用一句人话显示出来。
 */

(function (global) {
  'use strict';

  const TT = (global.TT = global.TT || {});
  const { q } = TT.dom;

  /**
   * 显示软件版本和运行环境。
   * 为什么走主进程要而不是写死在界面里：
   * 版本号只有一个真源头（package.json），界面从这里问，永远不会出现
   * 「关于页面写着 0.1.0、实际装的是 0.2.0」这种自相矛盾。
   */
  async function showVersion() {
    const el = q('appVersion');
    if (!el) return;
    try {
      const info = await window.tiantian.getAppInfo();
      el.textContent = `版本 ${info.version}　·　Electron ${info.electron}　·　${info.platform}`;
    } catch (err) {
      el.textContent = '版本信息读取失败';
      console.error('读取版本失败：', err);
    }
  }

  /**
   * 点「导出 CSV 备份」
   */
  async function exportCsv() {
    const status = q('exportStatus');
    status.className = 'export-status';
    status.textContent = '正在整理账目……';

    try {
      const result = await window.tiantian.exportCsv();

      if (result.ok) {
        status.textContent = `✅ 已导出 ${result.count} 笔账，文件保存在：${result.path}`;
        status.classList.add('ok');
      } else if (result.canceled) {
        status.textContent = '已取消导出，账目没有动。';
      } else {
        status.textContent = `❌ 导出失败：${result.error || '未知原因'}`;
        status.classList.add('err');
      }
    } catch (err) {
      status.textContent = `❌ 导出出错：${err.message}`;
      status.classList.add('err');
    }
  }

  /**
   * 进页面时刷一遍（版本号理论上不会变，但启动流程里先调一次最省心）
   */
  function load() {
    showVersion();
  }

  q('exportCsvBtn').addEventListener('click', exportCsv);

  TT.pages = TT.pages || {};
  TT.pages.settings = { load };
})(window);
