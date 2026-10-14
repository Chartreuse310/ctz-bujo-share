/** 长页屏（集子/统计）末行可达性：固定底栏会不会永久遮住最后一行 */
const PORT = 9333;
const files = ['g-bottom.html', 'g1-line.html', 'g2-text.html', 'g3-pale.html', 'g4-quiet.html', 'g5-slim.html'];
const ws = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const page = ws.find(t => t.type === 'page');
const sock = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r => sock.addEventListener('open', r, {once: true}));
let id = 0; const pending = new Map();
sock.addEventListener('message', ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
function send(method, params = {}) { return new Promise(res => { const i = ++id; pending.set(i, res); sock.send(JSON.stringify({id: i, method, params})); }); }
async function ev(expr) { const r = await send('Runtime.evaluate', {expression: expr, returnByValue: true, awaitPromise: true}); return r.result?.result?.value; }
const sleep = ms => new Promise(r => setTimeout(r, ms));

await send('Network.enable'); await send('Network.setCacheDisabled', {cacheDisabled: true});
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', {width: 1440, height: 900, deviceScaleFactor: 1, mobile: false});

const out = [];
for (const f of files) {
  await send('Page.navigate', {url: `file:///Users/z/Programs/dev/ctz-bujo-share/docs/ui-demos/${f}`});
  await sleep(1400);
  const row = {file: f};
  for (const s of ['index', 'stats']) {
    await ev(`document.querySelector('[data-s="${s}"]').click()`); await sleep(400);
    row[s] = await ev(`(() => {
      const de = document.documentElement;
      const nav = document.querySelector('.tabbar').getBoundingClientRect();
      window.scrollTo(0, de.scrollHeight);
      return new Promise(res => setTimeout(() => {
        const els = [...document.querySelectorAll('.screen.on .resrow, .screen.on footer.note, .screen.on .card')];
        const last = els[els.length - 1];
        const b = last.getBoundingClientRect();
        const hidden = b.bottom > nav.top && b.right > nav.left && b.left < nav.right;
        res({
          scrolls: de.scrollHeight > de.clientHeight + 1,
          lastBottom: Math.round(b.bottom), navTop: Math.round(nav.top),
          lastRowHidden: hidden,
          clearance: Math.round(nav.top - b.bottom),
        });
      }, 250));
    })()`);
  }
  out.push(row);
}
console.log(JSON.stringify(out, null, 1));
sock.close(); process.exit(0);
