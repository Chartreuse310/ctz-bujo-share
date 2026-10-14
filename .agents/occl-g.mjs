/** 元素级遮挡检测：底部导航是否压在月视图可见内容上 */
const PORT = 9333;
const ws = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const page = ws.find(t => t.type === 'page');
const sock = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r => sock.addEventListener('open', r, {once: true}));
let id = 0; const pending = new Map();
sock.addEventListener('message', ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
function send(method, params = {}) { return new Promise(res => { const i = ++id; pending.set(i, res); sock.send(JSON.stringify({id: i, method, params})); }); }
async function ev(expr) { const r = await send('Runtime.evaluate', {expression: expr, returnByValue: true, awaitPromise: true}); return r.result?.result?.value; }
const sleep = ms => new Promise(r => setTimeout(r, ms));

await send('Network.enable');
await send('Network.setCacheDisabled', {cacheDisabled: true});
await send('Page.enable');
await send('Page.navigate', {url: 'file:///Users/z/Programs/dev/ctz-bujo-share/docs/ui-demos/g-bottom.html'});
await sleep(1500);

const out = [];
for (const [vw, vh] of [[1440, 900], [1280, 800], [1440, 700], [1920, 1080]]) {
  await send('Emulation.setDeviceMetricsOverride', {width: vw, height: vh, deviceScaleFactor: 1, mobile: false});
  await sleep(400);
  await ev(`document.querySelector('[data-s="month"]').click()`);
  await sleep(500);
  out.push({viewport: `${vw}x${vh}`, blocked: await ev(`(() => {
    const nav = document.querySelector('.tabbar').getBoundingClientRect();
    const bad = [];
    for (const el of document.querySelectorAll('.cal-pane .cal-foot span, .cal-pane .cal-foot .k, .cal-pane .matrix .cell, .month-top .pager')) {
      const b = el.getBoundingClientRect();
      const ix = Math.min(b.right, nav.right) - Math.max(b.left, nav.left);
      const iy = Math.min(b.bottom, nav.bottom) - Math.max(b.top, nav.top);
      if (ix > 0 && iy > 0) bad.push({el: el.className || el.tagName, text: el.textContent.trim().slice(0, 14), ov: Math.round(ix) + 'x' + Math.round(iy), rect: [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)]});
    }
    return bad;
  })()`)});
}
console.log(JSON.stringify(out, null, 2));
sock.close(); process.exit(0);
