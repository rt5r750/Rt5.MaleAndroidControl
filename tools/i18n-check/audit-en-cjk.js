// i18n 检查 ④（浏览器内）：审计「英文模式下界面是否仍残留中文」。
// 用法：经 CDP / Playwright 在英文模式的控制台页面 evaluate 本文件内容，返回
//       { textNodes, attributes, total }；total 应为 0。
//
// 判定范围：整页可见文本节点 + placeholder/title/aria-label 属性。
// 豁免区（项目规范允许保留原始内容，且本就 .i18n-cn-fit 不施加）：
//   终端 / 日志 / 代码滚动区。
// 另需注意：调用方应先把页面语言切到英文（localStorage robot_ui_lang='en' 后重载），
//   否则页面会按设备语言显示中文——那属于正确行为，不是泄漏。
(() => {
  const EXEMPT_SELECTORS = [
    '#terminal-output', '.terminal', '.code-scroll', '#robot-code',
    '.log-area', '#debug-log', '.i18n-nofit'
  ];
  const isExempt = (el) => {
    for (const sel of EXEMPT_SELECTORS) {
      try { if (el.closest(sel)) return true; } catch (e) { /* ignore */ }
    }
    return false;
  };
  const CJK = /[\u4e00-\u9fa5]/;
  const out = [];

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    const t = (n.nodeValue || '').replace(/\s+/g, ' ').trim();
    if (!t || !CJK.test(t)) continue;
    const el = n.parentElement;
    if (!el || isExempt(el)) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    out.push({ text: t.slice(0, 70), tag: el.tagName, cls: String(el.className).slice(0, 40) });
  }

  const attrs = [];
  document.querySelectorAll('[placeholder],[title],[aria-label]').forEach((el) => {
    if (isExempt(el)) return;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    for (const a of ['placeholder', 'title', 'aria-label']) {
      const v = el.getAttribute(a);
      if (v && CJK.test(v)) attrs.push({ attr: a, value: v.slice(0, 70), tag: el.tagName });
    }
  });

  return { textNodes: out, attributes: attrs, total: out.length + attrs.length };
})()
