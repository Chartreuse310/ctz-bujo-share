// 针对线上站四页底栏（.tabbar）的机械体检：几何 + 命中区 + 导航带采样点遮挡
// 用法：node scripts/check-tabbar-live.mjs   （依赖 9333 端口的 headless Chrome）
const PORT = 9333;
const SITE = "https://chartreuse310.github.io/ctz-bujo-share";
const PAGES = [
  ["home", "/today/"],
  ["month", "/month/2026-10/"],
  ["index", "/collection/all/"],
  ["stats", "/stats/"],
];

const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const page = list.find((t) => t.type === "page");
if (!page) throw new Error("no page target");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0; const pending = new Map();
const send = (m, p = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); } };

await send("Page.enable");
await send("Network.setCacheDisabled", { cacheDisabled: true });

const evalJS = async (expr, tag = "") => {
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
  if (process.env.DEBUG) console.error(`[dbg${tag}]`, JSON.stringify(r).slice(0, 300));
  if (r.exceptionDetails) throw new Error("page eval: " + JSON.stringify(r.exceptionDetails).slice(0, 400));
  return r.result?.value;   // send 已解包 m.result，RemoteObject 就在 r.result
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PROBE = `(() => {
  const tb = document.querySelector('.tabbar');
  if (!tb) return JSON.stringify({ err: "无 .tabbar" });
  const tbR = tb.getBoundingClientRect();
  const cs = getComputedStyle(tb);
  const links = [...tb.querySelectorAll('a')].map(a => {
    const r = a.getBoundingClientRect();
    return { t: a.textContent.trim(), href: a.getAttribute('href'),
      x: Math.round(r.left), w: Math.round(r.width), y: Math.round(r.top), h: Math.round(r.height),
      on: a.classList.contains('on') };
  });
  // 重叠检测：相邻 tab 命中区交叠？
  let overlap = null;
  for (let i = 1; i < links.length; i++) {
    const a = links[i-1], b = links[i];
    const ov = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    if (ov > 0) overlap = { pair: [a.t, b.t], px: ov };
  }
  // 底栏带内采样点：elementFromPoint 是否命中 tabbar 或其后代
  const bad = [];
  const y0 = Math.round(tbR.top), y1 = Math.round(tbR.bottom);
  for (let y = y0 + 2; y < y1 - 2; y += 6) {
    for (let x = Math.round(tbR.left) + 4; x < tbR.right - 4; x += 24) {
      const el = document.elementFromPoint(x, y);
      if (el && !tb.contains(el) && !el.closest('.tabbar')) {
        bad.push({ x, y, cls: el.className && String(el.className).slice(0, 40), txt: (el.textContent||'').trim().slice(0, 12) });
        if (bad.length > 4) break;
      }
    }
    if (bad.length > 4) break;
  }
  return JSON.stringify({
    vw: innerWidth, vh: innerHeight,
    tb: { x: Math.round(tbR.left), y: Math.round(tbR.top), w: Math.round(tbR.width), h: Math.round(tbR.height) },
    pos: cs.position, z: cs.zIndex, bg: cs.backgroundColor, radius: cs.borderRadius,
    links, overlap, occlusion: bad,
    docScrollable: document.documentElement.scrollHeight > document.documentElement.clientHeight + 1
  });
})()`;

let fail = 0;
for (const [name, path] of PAGES) {
  await send("Page.navigate", { url: SITE + path });
  await sleep(2200);
  const raw = await evalJS(PROBE, " probe");
  if (raw == null) { console.log(`[FAIL] ${name}: 页面脚本返回 undefined（可能加载超时）`); fail++; continue; }
  const v = JSON.parse(raw);
  const problems = [];
  if (v.err) problems.push(v.err);
  else {
    if (v.overlap) problems.push(`tab 命中区重叠 ${v.overlap.px}px: ${v.overlap.pair.join(" / ")}`);
    if (v.occlusion.length) problems.push(`导航带被内容压住: ${JSON.stringify(v.occlusion[0])}`);
    if (v.pos !== "fixed") problems.push(`position=${v.pos} ≠ fixed`);
    const on = v.links.filter(l => l.on);
    if (on.length !== 1) problems.push(`on 状态数=${on.length}`);
  }
  const status = problems.length ? "FAIL" : "PASS";
  if (problems.length) fail++;
  console.log(`[${status}] ${name} @${v.vw}x${v.vh}`);
  console.log(`   tabbar: ${JSON.stringify(v.tb)} pos=${v.pos} bg=${v.bg} radius=${v.radius}`);
  console.log(`   links:  ${v.links.map(l => `${l.t}${l.on ? "*" : ""}(${l.x},${l.y} ${l.w}x${l.h})`).join(" ")}`);
  if (problems.length) console.log(`   问题:   ${problems.join(" | ")}`);
}
ws.close();
console.log(fail ? `\n${fail} 页 FAIL` : "\nALL PASS");
process.exit(fail ? 1 : 0);
