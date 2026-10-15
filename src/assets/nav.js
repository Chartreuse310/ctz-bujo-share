/* 四屏切换：键盘左右方向键 + 触屏/触控板横滑 → 跳转到相邻屏幕的真实 URL。
   设计文档 §5：四屏可左右滑/方向键切换。这里是渐进增强，禁用 JS 时链接照常可用。 */
(() => {
  const links = [...document.querySelectorAll(".tabbar a")];
  if (!links.length) return;
  const i = links.findIndex((a) => a.classList.contains("on"));

  const go = (step) => {
    const next = links[(i + step + links.length) % links.length];
    if (next) location.href = next.href;
  };

  document.addEventListener("keydown", (e) => {
    if (e.target.matches("input, textarea, select")) return;
    if (e.key === "ArrowRight") go(1);
    else if (e.key === "ArrowLeft") go(-1);
  });

  let sx = 0, sy = 0, tracking = false;
  document.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1) return;
    sx = e.touches[0].clientX; sy = e.touches[0].clientY; tracking = true;
  }, { passive: true });
  document.addEventListener("touchend", (e) => {
    if (!tracking) return;
    tracking = false;
    const dx = e.changedTouches[0].clientX - sx;
    const dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
    go(dx < 0 ? 1 : -1);
  }, { passive: true });

  let acc = 0, last = 0;
  document.addEventListener("wheel", (e) => {
    if (Math.abs(e.deltaX) < 24 || Math.abs(e.deltaX) < Math.abs(e.deltaY)) return;
    const now = Date.now();
    if (now - last > 700) acc = 0;
    last = now;
    acc += e.deltaX;
    if (Math.abs(acc) > 110) { go(acc < 0 ? 1 : -1); acc = 0; }
  }, { passive: true });
})();
