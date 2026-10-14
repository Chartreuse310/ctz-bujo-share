/** 截图：6 个底栏皮肤的「今日」屏（底部裁剪放大，方便比重量） */
const PORT = 9333;
import {writeFileSync} from 'node:fs';
const files = ['g-bottom.html', 'g1-line.html', 'g2-text.html', 'g3-pale.html', 'g4-quiet.html', 'g5-slim.html'];
const names = ['g0-deep', 'g1-line', 'g2-text', 'g3-pale', 'g4-quiet', 'g5-slim'];
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
await send('Emulation.setTouchEmulationEnabled', {enabled: false});

for (let i = 0; i < files.length; i++) {
  await send('Emulation.setDeviceMetricsOverride', {width: 1440, height: 900, deviceScaleFactor: 2, mobile: false});
  await send('Page.navigate', {url: `file:///Users/z/Programs/dev/ctz-bujo-share/docs/ui-demos/${files[i]}`});
  await sleep(1600);
  await ev(`document.querySelector('[data-s="home"]').click()`);
  await sleep(500);
  const r = await send('Page.captureScreenshot', {format: 'png', clip: {x: 0, y: 640, width: 1440, height: 260, scale: 2}});
  writeFileSync(`/tmp/nav-${names[i]}.png`, Buffer.from(r.result.data, 'base64'));
  /* 月视图也截一张（图例 + 底栏的关系最关键） */
  await ev(`document.querySelector('[data-s="month"]').click()`); await sleep(600);
  const r2 = await send('Page.captureScreenshot', {format: 'png', clip: {x: 0, y: 620, width: 1440, height: 280, scale: 2}});
  writeFileSync(`/tmp/navm-${names[i]}.png`, Buffer.from(r2.result.data, 'base64'));
  console.log('shot', names[i]);
}
sock.close(); process.exit(0);
