/** 5 个底栏皮肤的导航几何实测：位置 / 触控尺寸 / 与内容零遮挡 / 各屏不滚动 */
const PORT = 9333;
const files = ['g-bottom.html', 'g1-line.html', 'g2-text.html', 'g3-pale.html', 'g4-quiet.html', 'g5-slim.html'];
const VIEWPORTS = [[1440, 900], [1280, 800], [1440, 700], [1920, 1080]];

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

const report = [];
for (const f of files) {
  await send('Page.navigate', {url: `file:///Users/z/Programs/dev/ctz-bujo-share/docs/ui-demos/${f}`});
  await sleep(1400);
  const out = {file: f, vps: []};

  for (const [vw, vh] of VIEWPORTS) {
    await send('Emulation.setDeviceMetricsOverride', {width: vw, height: vh, deviceScaleFactor: 1, mobile: false});
    await sleep(400);

    /* 首页 */
    await ev(`document.querySelector('[data-s="home"]').click()`); await sleep(400);
    const home = await ev(`(() => {
      const de = document.documentElement;
      const nav = document.querySelector('.tabbar').getBoundingClientRect();
      return {
        pageScrolls: de.scrollHeight > de.clientHeight + 1,
        navTop: Math.round(nav.top), navBottomGap: Math.round(window.innerHeight - nav.bottom),
        navH: Math.round(nav.height), navW: Math.round(nav.width),
        navCx: Math.round(nav.left + nav.width / 2),
      };
    })()`);

    /* 月视图：遮挡 + 硬约束 */
    await ev(`document.querySelector('[data-s="month"]').click()`); await sleep(450);
    const month = await ev(`(() => {
      const de = document.documentElement;
      const nav = document.querySelector('.tabbar').getBoundingClientRect();
      const bad = [];
      for (const el of document.querySelectorAll('.cal-pane .cal-foot span, .cal-pane .cal-foot .k, .month-top .pager, .month-top .facts')) {
        const b = el.getBoundingClientRect();
        const ix = Math.min(b.right, nav.right) - Math.max(b.left, nav.left);
        const iy = Math.min(b.bottom, nav.bottom) - Math.max(b.top, nav.top);
        if (ix > 0 && iy > 0) bad.push(el.textContent.trim().slice(0, 10) + ':' + Math.round(iy) + 'px');
      }
      const cells = [...document.querySelectorAll('#matrix .cell')];
      return {
        pageScrolls: de.scrollHeight > de.clientHeight + 1,
        clipped: cells.filter(c => c.scrollHeight > c.clientHeight + 1).length,
        occlusion: bad,
      };
    })()`);
    out.vps.push({vp: `${vw}x${vh}`, ...home, ...month});
  }
  report.push(out);
}
console.log(JSON.stringify(report, null, 1));
sock.close(); process.exit(0);
