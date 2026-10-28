/**
 * 天天记账 —— 「记一笔」弹窗（新增 / 修改共用）
 *
 * 大白话：这是全软件用得最多的一个界面。点左边的「＋ 记一笔」是新增，
 * 在账单页点某行的「修改」是改旧账——两件事共用同一个弹窗，
 * 区别只在「保存」的时候是插一条还是改一条（看 editingId 有没有值）。
 *
 * 这个文件只负责弹窗自己的事：选类型、选分类、填金额、保存。
 * 保存成功后由 app.js 的 refreshAll 去通知各个页面刷新，弹窗不越权。
 */

(function (global) {
  'use strict';

  const TT = (global.TT = global.TT || {});
  const { q, toast } = TT.dom;
  const { today } = TT.format;
  const { list, iconOf } = TT.categories;

  const modal = q('addModal');

  // 弹窗里的状态：当前收支类型、选中的一级/二级分类、正在改的那笔账的编号
  // editingId 为 null 表示「新增」，有值表示「改这一笔」
  let type = 'expense';
  let main = '餐饮美食';
  let sub = '早餐';
  let editingId = null;

  /** 打开弹窗（把光标放进金额框，用户可以立刻打字） */
  function open() {
    modal.classList.remove('hidden');
    q('amountInput').focus();
  }

  /** 关掉弹窗，并退出「修改」状态 */
  function close() {
    modal.classList.add('hidden');
    editingId = null;
  }

  /**
   * 换弹窗标题和按钮文字（新增 vs 修改，文案不一样用户才分得清在干什么）
   * @param {string} title
   */
  function setTitle(title) {
    q('modalTitle').textContent = title;
    q('saveBtn').textContent = title === '修改这笔账' ? '保存修改' : '保存';
  }

  /** 把表单清成「刚打开」的样子：金额和备注清空、日期回到今天、类型回到支出 */
  function resetForm() {
    q('amountInput').value = '';
    q('noteInput').value = '';
    q('dateInput').value = today();
  }

  /**
   * 切换支出/收入。
   * 会顺手把分类重置成该类型的第一项、清空金额——避免把上一笔的金额误带到新一笔。
   * @param {'expense'|'income'} nextType
   */
  function setType(nextType) {
    type = nextType;
    q('typeExpense').classList.toggle('active', nextType === 'expense');
    q('typeExpense').setAttribute('aria-selected', String(nextType === 'expense'));
    q('typeIncome').classList.toggle('active', nextType === 'income');
    q('typeIncome').setAttribute('aria-selected', String(nextType === 'income'));

    const cats = list(nextType);
    main = cats[0].name; // 默认选第一个大类
    sub = cats[0].subs[0]; // 默认选第一个小类

    renderTabs();
    q('amountInput').value = '';
    // 金额输入框的下划线颜色跟着类型走（支出红、收入绿）
    modal.classList.toggle('income', nextType === 'income');
  }

  /** 渲染一级分类那一排图标按钮 */
  function renderTabs() {
    const tabs = q('catTabs');
    tabs.innerHTML = '';

    list(type).forEach((cat) => {
      const btn = document.createElement('button');
      btn.className = 'cat-tab' + (cat.name === main ? ' active' : '');
      btn.type = 'button';
      btn.innerHTML = `<span class="cat-tab-icon">${iconOf(cat.name)}</span><span>${cat.name}</span>`;
      btn.addEventListener('click', () => {
        main = cat.name;
        sub = cat.subs[0];
        renderTabs();
      });
      tabs.appendChild(btn);
    });

    renderGrid();
  }

  /** 渲染当前大类下面的二级分类格子 */
  function renderGrid() {
    const grid = q('catGrid');
    const current = list(type).find((c) => c.name === main) || list(type)[0];

    grid.innerHTML = '';
    current.subs.forEach((item) => {
      const cell = document.createElement('button');
      cell.className = 'cat-cell' + (item === sub ? ' active' : '');
      cell.type = 'button';
      cell.textContent = item;
      cell.addEventListener('click', () => {
        sub = item;
        renderGrid();
      });
      grid.appendChild(cell);
    });
  }

  /** 点「记一笔」：清空表单、标题改成新增、打开 */
  function openForAdd() {
    editingId = null;
    setTitle('记一笔');
    setType('expense');
    resetForm();
    open();
  }

  /**
   * 从账单页点「修改」：把那一笔的旧内容填回弹窗
   * @param {object} record 要改的那笔账
   */
  function openForEdit(record) {
    editingId = record.id;
    setTitle('修改这笔账');
    setType(record.type);

    // setType 会把分类重置成第一项，这里要改回这笔账原来的分类
    main = record.categoryMain;
    sub = record.categorySub;
    renderTabs();

    q('amountInput').value = record.amount.toFixed(2);
    q('noteInput').value = record.note || '';
    q('dateInput').value = record.date;
    open();
  }

  /**
   * 保存：金额转成「分」再交给主进程，成功就关弹窗并刷新各页面。
   * 金额检查只做最基本的一条（必须是大于 0 的数字），更严的校验在主进程那边，
   * 界面拦一道是让人少走冤枉路，不是安全防线。
   */
  async function save() {
    const amount = parseFloat(q('amountInput').value);

    if (!amount || amount <= 0) {
      toast('请输入金额，例如 12.50');
      return;
    }

    const record = {
      type,
      amountCents: Math.round(amount * 100),
      categoryMain: main,
      categorySub: sub,
      note: q('noteInput').value.trim(),
      date: q('dateInput').value || today(),
      createdAt: Date.now()
    };

    const typeText = type === 'expense' ? '支出' : '收入';

    try {
      if (editingId !== null) {
        await window.tiantian.updateRecord(editingId, record);
        toast(`✓ 已修改 ${typeText} ¥${amount.toFixed(2)}（${main}·${sub}）`);
      } else {
        await window.tiantian.addRecord(record);
        toast(`✓ 已保存 ${typeText} ¥${amount.toFixed(2)}（${main}·${sub}）`);
      }
      close();
      TT.refreshAll();
    } catch (err) {
      console.error('保存失败：', err);
      // 主进程会说明具体哪里不合法（比如金额太大），能拿到就直接显示
      toast(err && err.message ? `保存失败：${err.message}` : '保存失败，请稍后重试');
    }
  }

  /* ---------- 事件绑定 ---------- */

  q('openAddBtn').addEventListener('click', openForAdd);
  q('closeAddModal').addEventListener('click', close);
  q('saveBtn').addEventListener('click', save);
  q('typeExpense').addEventListener('click', () => setType('expense'));
  q('typeIncome').addEventListener('click', () => setType('income'));

  // 点弹窗外面的灰色遮罩也关掉
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });

  // 按 Esc 关掉
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) close();
  });

  TT.features = TT.features || {};
  TT.features.addRecord = { openForAdd, openForEdit, close, setType };
})(window);
