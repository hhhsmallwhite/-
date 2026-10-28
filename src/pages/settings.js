/**
 * 天天记账 —— 设置页
 *
 * 大白话：这一页是「保命区」+「关于」。三件事：
 *   1. 把账导成 CSV（给表格、做备份）；
 *   2. 备份与恢复（每天自动备份一份，出事了能换回来，也能把 CSV 导回来）；
 *   3. 看看版本号，出问题时打开日志文件夹。
 *
 * 这里所有「碰硬盘」的活儿都在主进程做（界面碰不了硬盘），
 * 界面只负责弹一句人话告诉用户结果。
 */

(function (global) {
  'use strict';

  const TT = (global.TT = global.TT || {});
  const { q } = TT.dom;

  /**
   * 把一行状态文字显示出来
   * @param {HTMLElement} el 显示位置
   * @param {string} text 内容
   * @param {'ok'|'err'|''} [kind] 成功=绿、失败=红
   */
  function say(el, text, kind) {
    el.className = `export-status${kind ? ' ' + kind : ''}`;
    el.textContent = text;
  }

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
   * 刷新「现有几份备份、最近一份是什么时候」那行字
   */
  async function showBackupInfo() {
    const status = q('backupStatus');
    try {
      const info = await window.tiantian.getBackupInfo();
      if (!info.count) {
        say(status, '还没有备份。明天第一次打开软件时会自动备份一份，也可以点「立即备份」。');
        return;
      }
      // 文件名里带着 20261028-202600，拆出来给人看更直观
      const m = /^tiantian-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})\.db$/.exec(info.latest);
      const when = m ? `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}` : info.latest;
      say(status, `现有 ${info.count} 份备份，最近一份：${when}`);
    } catch (err) {
      say(status, '备份信息读取失败', 'err');
    }
  }

  /**
   * 点「立即备份」
   */
  async function backupNow() {
    const status = q('backupStatus');
    const btn = q('backupNowBtn');
    btn.disabled = true;
    say(status, '正在备份……');

    try {
      const result = await window.tiantian.backupNow();
      if (result.ok) say(status, `✅ 已备份：${result.path}`, 'ok');
      else say(status, `❌ 备份失败：${result.error || '未知原因'}`, 'err');
    } catch (err) {
      say(status, `❌ 备份出错：${err.message}`, 'err');
    } finally {
      btn.disabled = false;
      showBackupInfo();
    }
  }

  /**
   * 点「从备份恢复」：这一步会覆盖当前账本，所以必须先让用户确认
   */
  async function restoreBackup() {
    const status = q('backupStatus');

    const go = confirm(
      '恢复会把当前账本整个换成你选的那份备份。\n\n' +
      '换之前软件会自动把当前账本再存一份（名字带 before-restore），选错了还能换回来。\n\n' +
      '继续吗？'
    );
    if (!go) return;

    const btn = q('restoreBackupBtn');
    btn.disabled = true;
    say(status, '请在弹出的窗口里选择备份文件……');

    try {
      const result = await window.tiantian.restoreBackup();

      if (result.canceled) {
        say(status, '已取消，账本没有动。');
      } else if (result.ok) {
        say(status, `✅ 已恢复，现在账本里有 ${result.count} 笔账`, 'ok');
        TT.refreshAll(); // 各页面重新取数，免得还显示旧数据
      } else {
        say(status, `❌ 恢复失败：${result.error || '未知原因'}`, 'err');
      }
    } catch (err) {
      say(status, `❌ 恢复出错：${err.message}`, 'err');
    } finally {
      btn.disabled = false;
      showBackupInfo();
    }
  }

  /**
   * 点「导入 CSV」：把以前导出的表格导回来。
   * 一样的账会自动跳过，所以同一张表导两遍也不会重复记账。
   */
  async function importCsv() {
    const status = q('backupStatus');
    const btn = q('importCsvBtn');
    btn.disabled = true;
    say(status, '请在弹出的窗口里选择 CSV 文件……');

    try {
      const result = await window.tiantian.importCsv();

      if (result.canceled) {
        say(status, '已取消导入，账本没有动。');
      } else if (!result.ok) {
        say(status, `❌ 导入失败：${result.error || '未知原因'}`, 'err');
      } else {
        // 有跳过的行就把原因带上，用户才知道是表写错了还是重复了
        const problems = (result.problems || []).slice(0, 3).map((p) => p.message).join('；');
        let text = `✅ 导入完成：新增 ${result.imported} 笔`;
        if (result.skipped) text += `，跳过重复 ${result.skipped} 笔`;
        if (problems) text += `。有问题的行：${problems}`;
        say(status, text, result.imported > 0 ? 'ok' : '');
        if (result.imported > 0) TT.refreshAll();
      }
    } catch (err) {
      say(status, `❌ 导入出错：${err.message}`, 'err');
    } finally {
      btn.disabled = false;
    }
  }

  /**
   * 点「打开日志文件夹」：出问题时把里面的文件发给开发者
   */
  async function openLogs() {
    const status = q('logsStatus');
    try {
      const result = await window.tiantian.openLogsFolder();
      if (result.ok) say(status, `已打开：${result.path}`);
      else say(status, `打不开文件夹：${result.error || '未知原因'}`, 'err');
    } catch (err) {
      say(status, `打不开文件夹：${err.message}`, 'err');
    }
  }

  /**
   * 点「导出 CSV 备份」
   */
  async function exportCsv() {
    const status = q('exportStatus');
    say(status, '正在整理账目……');

    try {
      const result = await window.tiantian.exportCsv();

      if (result.ok) {
        say(status, `✅ 已导出 ${result.count} 笔账，文件保存在：${result.path}`, 'ok');
      } else if (result.canceled) {
        say(status, '已取消导出，账目没有动。');
      } else {
        say(status, `❌ 导出失败：${result.error || '未知原因'}`, 'err');
      }
    } catch (err) {
      say(status, `❌ 导出出错：${err.message}`, 'err');
    }
  }

  /**
   * 进页面时刷一遍：版本号 + 备份现状
   */
  function load() {
    showVersion();
    showBackupInfo();
  }

  q('exportCsvBtn').addEventListener('click', exportCsv);
  q('backupNowBtn').addEventListener('click', backupNow);
  q('restoreBackupBtn').addEventListener('click', restoreBackup);
  q('importCsvBtn').addEventListener('click', importCsv);
  q('openLogsBtn').addEventListener('click', openLogs);

  TT.pages = TT.pages || {};
  TT.pages.settings = { load };
})(window);
