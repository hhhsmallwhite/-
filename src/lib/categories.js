/**
 * 天天记账 —— 分类数据（收入/支出各有哪些大类和小类）
 *
 * 大白话：这是「钱花在哪儿」的那张表。以前它和 900 行的界面代码混在一起，
 * 想加个分类得在海量代码里翻。现在单独一个文件，改分类只动这里。
 *
 * 注意：分类目前是写死在界面里的（数据库里没有分类表）。
 * 这对当前版本够用——账目里记的是分类的「名字」，换个名字不影响旧数据。
 * 将来要做用户自定义分类，需要给数据库加一张 categories 表，届时把这里改成
 * 「从主进程读回来」即可，其它页面不用动（它们都只调 TT.categories.list()）。
 */

(function (global) {
  'use strict';

  const TT = (global.TT = global.TT || {});

  /**
   * 把一串 SVG 路径包成统一风格的图标（24×24 线性图标，粗细一致才好看）
   * @param {string} paths 若干 <path>/<circle> 等 SVG 片段
   * @returns {string} 完整的 <svg> 字符串
   */
  function icon(paths) {
    return `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
  }

  // 每个一级分类配一个图标。名字必须和下面的分类表完全一致，否则会显示空白（不会报错）
  const ICONS = {
    // —— 支出 ——
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
    // —— 收入 ——
    '工资奖金': icon('<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>'),
    '理财收益': icon('<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>'),
    '红包礼金': icon('<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>'),
    '兼职副业': icon('<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>'),
    '其他收入': icon('<circle cx="12" cy="12" r="10"/><path d="M12 8v8"/><path d="M8 12h8"/>')
  };

  // 支出：10 个大类，每个大类下面若干小类（顺序就是界面上的显示顺序）
  const EXPENSE = [
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

  // 收入：5 个大类
  const INCOME = [
    { name: '工资奖金', subs: ['工资', '奖金', '津贴补贴'] },
    { name: '理财收益', subs: ['利息', '基金股票收益', '其他理财'] },
    { name: '红包礼金', subs: ['红包', '礼金'] },
    { name: '兼职副业', subs: ['兼职收入', '稿费', '其他副业'] },
    { name: '其他收入', subs: ['其他'] }
  ];

  /**
   * 按收支类型拿分类表
   * @param {'expense'|'income'} type 支出还是收入
   * @returns {{ name: string, subs: string[] }[]}
   */
  function list(type) {
    return type === 'income' ? INCOME : EXPENSE;
  }

  /**
   * 拿某个分类的图标；没有配图标的返回空串（界面不会因此报错）
   * @param {string} name 一级分类名
   * @returns {string}
   */
  function iconOf(name) {
    return ICONS[name] || '';
  }

  TT.categories = { list, iconOf, EXPENSE, INCOME };
})(window);
