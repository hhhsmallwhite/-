/**
 * 天天记账 —— 界面公用小工具（找元素、转义、轻提示）
 *
 * 大白话：每个页面都要「按名字找元素」「把用户填的字安全地放进页面」
 * 「弹一句一闪而过的提示」。这些活儿以前散在 900 行的 renderer.js 里，
 * 现在集中放这一份，谁要用谁调。
 *
 * 全局命名空间：所有模块都挂到 window.TT 上（TT = 天天）。
 * 好处是没有打包工具也能分工，坏处是名字必须自己管好——所以这里只放两类东西：
 * 工具函数（TT.dom / TT.format / TT.categories / TT.charts）和页面（TT.pages）。
 */

(function (global) {
  'use strict';

  const TT = (global.TT = global.TT || {});

  /**
   * 按 id 找一个元素
   * @param {string} id 元素的 id（不带 #）
   * @returns {HTMLElement}
   */
  function q(id) {
    return document.getElementById(id);
  }

  /**
   * 按选择器找一批元素，返回真正的数组（可以直接 forEach / map）
   * @param {string} selector CSS 选择器
   * @returns {HTMLElement[]}
   */
  function qa(selector) {
    return Array.from(document.querySelectorAll(selector));
  }

  /**
   * 把用户填的字转义，防止备注里写个 <script> 就把界面搞乱
   * @param {string} str 原始文字
   * @returns {string} 转义后的文字
   */
  function escapeHtml(str) {
    const s = String(str == null ? '' : str);
    return s.replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[ch]));
  }

  // 轻提示的定时器句柄：连续弹提示时要先把上一个定时器取消，否则新的会被旧的提前收走
  let toastTimer = null;

  /**
   * 弹一句轻提示（2.5 秒后自动消失）
   * @param {string} text 要显示的话
   */
  function toast(text) {
    const el = q('toast');
    el.textContent = text;
    el.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add('hidden'), 2500);
  }

  TT.dom = { q, qa, escapeHtml, toast };
})(window);
