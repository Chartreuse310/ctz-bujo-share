/**
 * 方向 G 关键指标实测（CDP）：四档视口 × 四屏
 *  1. 页面不滚动 / 35 格零裁切 / 右列表滚动时月历位移 0 / 栅格 844|236
 *  2. 底部导航水平居中（cx = 视口中线）、距底距离、与内容零重叠
 *  3. 首页内容起点——省多少纵向空间
 *  4. 字体规范：<17px 仍为衬线的元素数（应 0）
 */
const PORT = 9333;
const FILE = 'g-bottom.html';
const VIEWPORTS = [[1440, 900], [1280, 800], [1440, 700], [1920, 1080]];

const ws = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const page = ws.find(t => t.type === 'page');
if (!page) throw new Error('no page target');
const sock = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r => sock.addEventListener('open', r, {once: true}));

let id = 0;
const pending = new Map();
sock.addEventListener('message', ev => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
});
function send(method, params = {}) {
  return new Promise(res => { const i = ++id; pending.set(i, res); sock.send(JSON.stringify({id: i, method, params})); });
}
async function ev(expr) {
  const r = await send('Runtime.evaluate', {expression: expr, returnByValue: true, awaitPromise: true});
  return r.result?.result?.value;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

await send('Network.enable');
await send('Network.setCacheDisabled', {cacheDisabled: true});
await send('Page.enable');
await send('Page.navigate', {url: `file:///Users/z/Programs/dev/ctz-bujo-share/docs/ui-demos/${FILE}`});
await sleep(1500);

const report = [];
for (const [vw, vh] of VIEWPORTS) {
  await send('Emulation.setDeviceMetricsOverride', {width: vw, height: vh, deviceScaleFactor: 1, mobile: false});
  await sleep(400);
  const row = {viewport: `${vw}x${vh}`};

  await ev(`document.querySelector('[data-s="month"]').click()`);
  await sleep(500);
  row.month = await ev(`(() => {
    const de = document.documentElement;
    const matrix = document.getElementById('matrix');
    const cells = [...matrix.querySelectorAll('.cell')];
    const pane = document.getElementById('listPane');
    const cal = document.querySelector('.cal-pane');
    const bL = cal.getBoundingClientRect().left, bT = cal.getBoundingClientRect().top;
    pane.scrollTop = 400;
    const aL = cal.getBoundingClientRect().left, aT = cal.getBoundingClientRect().top;
    pane.scrollTop = 0;
    const navR = document.querySelector('.tabbar').getBoundingClientRect();
    const calR = cal.getBoundingClientRect();
    return {
      pageScrolls: de.scrollHeight > de.clientHeight + 1,
      clipped: cells.filter(c => c.scrollHeight > c.clientHeight + 1).length,
      cells: cells.length,
      calShift: Math.round(aL - bL) + '/' + Math.round(aT - bT),
      calWidth: Math.round(calR.width), listWidth: Math.round(pane.getBoundingClientRect().width),
      navCx: Math.round(navR.left + navR.width / 2), navBottom: Math.round(window.innerHeight - navR.bottom),
      navOverlapsCal: navR.top < calR.bottom,
    };
  })()`);

  await ev(`document.querySelector('[data-s="home"]').click()`);
  await sleep(500);
  row.home = await ev(`(() => {
    const de = document.documentElement;
    const brand = document.querySelector('.brand');
    const navR = document.querySelector('.tabbar').getBoundingClientRect();
    const dateline = document.querySelector('.dateline');
    return {
      pageScrolls: de.scrollHeight > de.clientHeight + 1,
      brandTop: Math.round(brand.getBoundingClientRect().top),
      datelineTop: dateline ? Math.round(dateline.getBoundingClientRect().top) : null,
      navBottom: Math.round(window.innerHeight - navR.bottom),
    };
  })()`);

  row.fontViolations = await ev(`(() => {
    const out = [];
    for (const el of document.querySelectorAll('#s-home *')) {
      if (!el.getClientRects().length) continue;
      const cs = getComputedStyle(el);
      const size = parseFloat(cs.fontSize);
      const isSerif = cs.fontFamily.includes('Songti') || cs.fontFamily.includes('Noto Serif') || cs.fontFamily.includes('Times');
      if (isSerif && size < 17) out.push((el.className || el.tagName) + '|' + size);
    }
    return out;
  })()`);
  report.push(row);
}
console.log(JSON.stringify(report, null, 2));
sock.close(); process.exit(0);
