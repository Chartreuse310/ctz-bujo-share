/* 条目卡片摘要三行截断（设计文档 §5.2，2026-10-15 拍板）：
   渲染整篇正文进 .excerpt（line-clamp:3 由 CSS 负责），
   这里只在「内容真被截断」时显示「全文 →」链接——构建期不知道布局，
   用 scrollHeight > clientHeight 判断，渐进增强，禁用 JS 时不显示链接。 */
(() => {
  for (const box of document.querySelectorAll(".excerpt[data-href]")) {
    if (box.scrollHeight <= box.clientHeight + 1) continue;
    const a = document.createElement("a");
    a.className = "more";
    a.href = box.dataset.href;
    a.textContent = "全文 →";
    box.after(a);
  }
})();
