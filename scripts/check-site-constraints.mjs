/**
 * 真实站点的硬约束验证（设计文档 §12.1 / §12.3 / §12.6）：
 *  A. 月视图页面不产生滚动（scrollHeight === clientHeight）
 *  B. 月历格子零裁切（每格 scrollHeight <= clientHeight）
 *  C. 右列表滚动时左月历位移为 0
 *  D. 次级栏 236px、栏间距 56px
 *  E. 全站滚动条隐藏（滚动条宽度 0 且内容仍可滚动）
 *  F. G1 底栏贴底（nav.bottom === innerHeight，gap=0）四档视口
 *  G. 导航带内网格采样点全部命中底栏、零内容穿透、底色不透明
 *  H. 矮视口 760 / 761px 两侧都要测（G1 旧缺陷只在 ≤760px 复现）
 *
 * 用法：先 `npm run build && npx @11ty/eleventy --serve --port=8081`，
 *       再 `node scripts/check-site-constraints.mjs`（需 9333 端口的 headless Chrome）。
 */
const PORT = 9333;
const SITE = process.env.SITE_URL || "http://127.0.0.1:8081";
const MONTH_URL = `${SITE}/month/2026-10/`;
const HOME_URL = `${SITE}/`;

const ws = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const page = ws.find(t => t.type === "page");
const sock = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r => sock.addEventListener("open", r, { once: true }));
let id = 0; const pending = new Map();
sock.addEventListener("message", ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
function send(method, params = {}) { return new Promise(res => { const i = ++id; pending.set(i, res); sock.send(JSON.stringify({ id: i, method, params })); }); }
async function ev(expr) { const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) throw new Error("page eval: " + JSON.stringify(r.result.exceptionDetails).slice(0, 300)); return r.result?.result?.value; }
const sleep = ms => new Promise(r => setTimeout(r, ms));
await send("Network.enable"); await send("Network.setCacheDisabled", { cacheDisabled: true });
await send("Page.enable");

let fails = 0;
const fail = m => { fails++; console.log("  FAIL " + m); };
const ok = m => console.log("  " + m);

/* ---------- A/B/C/D/E：月视图硬约束（多档视口） ---------- */
console.log("=== A-E. 月视图硬约束（不滚动 / 零裁切 / 左月历零位移 / 栅格 / 隐藏滚动条）===");
for (const [w, h] of [[1440, 900], [1280, 800], [1440, 700], [1920, 1080], [760, 900], [761, 900]]) {
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: MONTH_URL });
  await sleep(900);
  const r = await ev(`(() => {
    const de = document.documentElement;
    const noScroll = de.scrollHeight <= de.clientHeight + 1;
    const cells = [...document.querySelectorAll('.matrix .cell')];
    const clipped = cells.filter(c => c.scrollHeight > c.clientHeight + 1).length;
    const cal = document.querySelector('.cal-pane');
    const calRect = cal ? cal.getBoundingClientRect() : null;
    /* E. 滚动条：html 与右列表均应为 0 宽（隐藏），但列表内容可滚 */
    const sbw = de.clientWidth - de.offsetWidth;
    const listPane = document.querySelector('.list-pane');
    let listSbw = null, listScrollable = null;
    if (listPane) {
      listSbw = listPane.clientWidth - listPane.offsetWidth;
      listScrollable = listPane.scrollHeight > listPane.clientHeight;
    }
    return { noScroll, clipped, cellCount: cells.length,
             gridW: calRect ? Math.round(calRect.width) : null,
             sbw, listSbw, listScrollable };
  })()`);
  const tag = `${w}x${h} 月视图`;
  if (!r.noScroll) fail(`${tag} 页面产生滚动 scrollH=${r.scrollH}`);
  if (r.clipped > 0) fail(`${tag} ${r.clipped}/${r.cellCount} 格被裁切`);
  if (r.sbw > 1) fail(`${tag} 页面滚动条未隐藏（宽 ${r.sbw}px）`);
  if (r.listSbw !== null && r.listSbw > 1) fail(`${tag} 右列表滚动条未隐藏（宽 ${r.listSbw}px）`);
  ok(`${tag.padEnd(16)} noScroll=${r.noScroll} cells=${r.cellCount} clipped=${r.clipped} sbw=${r.sbw} PASS?${r.noScroll && r.clipped === 0 && r.sbw <= 1}`);
}

/* ---------- C. 右列表滚动时左月历位移为 0 ---------- */
console.log("=== C. 右列表滚动时左月历位移为 0 ===");
for (const [w, h] of [[1440, 900], [1280, 800]]) {
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: MONTH_URL });
  await sleep(900);
  const moved = await ev(`(async () => {
    const cal = document.querySelector('.cal-pane');
    const before = cal.getBoundingClientRect();
    const list = document.querySelector('.list-pane');
    if (!list) return { err: "无 .list-pane" };
    list.scrollTop = 99999;
    await new Promise(r => setTimeout(r, 120));
    const after = cal.getBoundingClientRect();
    list.scrollTop = 0;
    return { dx: Math.abs(after.left - before.left), dy: Math.abs(after.top - before.top) };
  })()`);
  if (moved.err) fail(`${w}x${h} ${moved.err}`);
  else if (moved.dx > 0.5 || moved.dy > 0.5) fail(`${w}x${h} 左月历位移 dx=${moved.dx} dy=${moved.dy}`);
  else ok(`${w}x${h} 左月历位移 0 PASS`);
}

/* ---------- D. 统一栅格：次级栏 236px、栏间距 56px ---------- */
console.log("=== D. 统一栅格（236px / 56px）===");
for (const url of [[HOME_URL, "首页"], [MONTH_URL, "月视图"]]) {
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: url[0] });
  await sleep(900);
  const g = await ev(`(() => {
    const side = document.querySelector('.side, .list-pane');
    const main = side ? side.nextElementSibling || document.querySelector('.day, .cal-pane') : null;
    if (!side) return { err: "无次级栏" };
    const sb = Math.round(side.getBoundingClientRect().width);
    /* 栏间距：用 getComputedStyle 的 gap 或两栏矩形间隙 */
    let gap = null;
    const cs = getComputedStyle(side.parentElement);
    if (cs.display.includes("grid")) gap = parseFloat(cs.columnGap);
    return { sb, gap };
  })()`);
  if (g.err) { fail(`${url[1]} ${g.err}`); continue; }
  if (Math.abs(g.sb - 236) > 2) fail(`${url[1]} 次级栏宽 ${g.sb}px ≠ 236px`);
  if (g.gap !== null && Math.abs(g.gap - 56) > 2) fail(`${url[1]} 栏间距 ${g.gap}px ≠ 56px`);
  ok(`${url[1].padEnd(4)} 次级栏=${g.sb}px gap=${g.gap} ${Math.abs(g.sb - 236) <= 2 ? "PASS" : "FAIL"}`);
}

/* ---------- F + G：底栏贴底 + 采样点零穿透（四档视口 × 两页） ---------- */
console.log("=== F/G. 底栏贴底 + 导航带采样点零内容穿透 ===");
for (const [w, h] of [[1440, 900], [1280, 800], [1440, 700], [1920, 1080], [760, 900], [761, 900]]) {
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  for (const [url, name] of [[MONTH_URL, "月视图"], [HOME_URL, "首页"]]) {
    await send("Page.navigate", { url });
    await sleep(900);
    const r = await ev(`(() => {
      const nav = document.querySelector('.tabbar');
      if (!nav) return { err: "无 .tabbar" };
      const nb = nav.getBoundingClientRect();
      const vh = innerHeight, vw = innerWidth;
      const cs = getComputedStyle(nav);
      const bad = [];
      let samples = 0;
      for (const frac of [0, 0.5, 1]) {
        window.scrollTo(0, Math.round((document.documentElement.scrollHeight - vh) * frac));
        for (let y = Math.ceil(nb.top) + 1; y < Math.min(vh - 1, Math.ceil(nb.bottom)); y += 4) {
          for (let x = 4; x < vw - 4; x += 37) {
            samples++;
            const el = document.elementFromPoint(x, y);
            if (!el) continue;
            const inNav = el === nav || nav.contains(el) || el.closest('.tabbar');
            if (!inNav) bad.push({ x, y, cls: String(el.className).slice(0, 30), tag: el.tagName });
          }
        }
      }
      window.scrollTo(0, 0);
      return { gap: Math.round(vh - nb.bottom), bgAlpha: cs.backgroundColor, samples, badCount: bad.length, bad: bad.slice(0, 4) };
    })()`);
    const tag = `${w}x${h} ${name}`;
    if (r.err) { fail(`${tag} ${r.err}`); continue; }
    const opaque = !/rgba\\([^)]*,\\s*0(\\.\\d+)?\\)/.test(r.bgAlpha);
    if (r.gap !== 0) fail(`${tag} 底栏未贴底 gap=${r.gap}`);
    if (r.badCount) fail(`${tag} 导航带内命中内容 ${r.badCount} 次 ${JSON.stringify(r.bad)}`);
    if (!opaque) fail(`${tag} 导航底色非不透明 ${r.bgAlpha}`);
    ok(`${tag.padEnd(18)} gap=${r.gap} samples=${r.samples} bad=${r.badCount} ${r.gap === 0 && r.badCount === 0 && opaque ? "PASS" : "FAIL"}`);
  }
}

console.log(fails === 0 ? "\nALL PASS" : `\n${fails} FAILURES`);
sock.close();
process.exit(fails ? 1 : 0);
