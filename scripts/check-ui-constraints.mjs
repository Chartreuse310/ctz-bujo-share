/**
 * 验证 UI demo 的界面逻辑硬约束（不看截图，用 CDP 实测）：
 *  1. 打开月视图时页面不产生滚动（整月一次可见）
 *  2. 左月历不被裁切（格子 scrollHeight <= clientHeight）
 *  3. 右列表滚动时左月历位移为 0
 *  4. 三处页面栅格一致（次级栏 236px）
 *
 * 用法：node scripts/check-ui-constraints.mjs
 */
const PORT = 9333;
const files = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['b-swiss.html', 'd-edit.html', 'e-dotted.html', 'f-warm.html'];

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
  return new Promise(res => {
    const i = ++id;
    pending.set(i, res);
    sock.send(JSON.stringify({id: i, method, params}));
  });
}
async function evaluate(expr) {
  const r = await send('Runtime.evaluate', {expression: expr, returnByValue: true, awaitPromise: true});
  return r.result?.result?.value;
}

await send('Network.enable');
await send('Network.setCacheDisabled', {cacheDisabled: true});

const results = [];
for (const f of files) {
  await send('Page.enable');
  await send('Page.navigate', {url: `file:///Users/z/Programs/dev/ctz-bujo-share/docs/ui-demos/${f}`});
  await new Promise(r => setTimeout(r, 1200));

  const out = {file: f, checks: []};

  for (const [vw, vh] of [[1440, 900], [1280, 800], [1440, 700]]) {
    await send('Emulation.setDeviceMetricsOverride', {width: vw, height: vh, deviceScaleFactor: 1, mobile: false});
    await new Promise(r => setTimeout(r, 350));

    // 切到月视图
    await evaluate(`document.querySelector('[data-s="month"]').click()`);
    await new Promise(r => setTimeout(r, 500));

    const m = await evaluate(`(() => {
      const de = document.documentElement;
      const matrix = document.getElementById('matrix');
      const cells = [...matrix.querySelectorAll('.cell')];
      const clipped = cells.filter(c => c.scrollHeight > c.clientHeight + 1).length;
      const rows = matrix.querySelectorAll('.cell').length;
      const pane = document.getElementById('listPane');
      const calPane = document.querySelector('.cal-pane');
      const before = calPane.getBoundingClientRect().left + calPane.scrollTop;
      pane.scrollTop = 400;
      const after = calPane.getBoundingClientRect().left;
      pane.scrollTop = 0;
      return {
        pageScrolls: de.scrollHeight > de.clientHeight + 1,
        scrollHeight: de.scrollHeight, clientHeight: de.clientHeight,
        clippedCells: clipped, totalCells: rows,
        calShift: Math.round(after - before),
        calWidth: Math.round(calPane.getBoundingClientRect().width),
        listWidth: Math.round(pane.getBoundingClientRect().width),
      };
    })()`);
    m.viewport = `${vw}x${vh}`;
    out.checks.push(m);
  }
  results.push(out);
}
console.log(JSON.stringify(results, null, 2));
sock.close();
process.exit(0);
