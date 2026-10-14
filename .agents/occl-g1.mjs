/**
 * G1 遮挡检测（替代 gap=0 时失效的「下方泄漏」口径）：
 * 导航带内的每个采样点必须命中 .tabbar / 其 button / 其伪元素，
 * 绝不能命中任何内容元素。覆盖多档视口 × 多屏 × 多个滚动位置。
 */
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
await send('Network.enable'); await send('Network.setCacheDisabled', {cacheDisabled: true});
await send('Page.enable');

let fails = 0;
for (const [w, h] of [[1440,900],[1280,800],[1440,700],[1440,640],[1920,1080]]) {
  await send('Emulation.setDeviceMetricsOverride', {width: w, height: h, deviceScaleFactor: 1, mobile: false});
  await send('Page.navigate', {url: 'file:///Users/z/Programs/dev/ctz-bujo-share/docs/ui-demos/g1-line.html'});
  await sleep(1100);
  for (const s of ['home','month','index','stats']) {
    await ev(`document.querySelector('[data-s="${s}"]').click()`); await sleep(700);
    const r = await ev(`(() => {
      const nav = document.querySelector('.tabbar');
      const nb = nav.getBoundingClientRect();
      const vh = innerHeight, vw = innerWidth;
      const cs = getComputedStyle(nav);
      const bad = [];
      let samples = 0;
      for (const frac of [0, 0.25, 0.5, 0.75, 1]) {
        window.scrollTo(0, Math.round((document.documentElement.scrollHeight - vh) * frac));
        // 导航带内（含伪元素覆盖区）逐点命中测试
        for (let y = Math.ceil(nb.top) + 1; y < Math.min(vh - 1, Math.ceil(nb.bottom)); y += 4) {
          for (let x = 4; x < vw - 4; x += 37) {
            samples++;
            const el = document.elementFromPoint(x, y);
            if (!el) continue;
            const inNav = el === nav || nav.contains(el) || el.closest('.tabbar');
            if (!inNav) bad.push({x, y, cls: String(el.className).slice(0, 30), tag: el.tagName,
                                 txt: (el.textContent || '').trim().slice(0, 16)});
          }
        }
      }
      window.scrollTo(0, 0);
      return {navBottom: Math.round(nb.bottom), vh, bgAlpha: cs.backgroundColor,
              samples, badCount: bad.length, bad: bad.slice(0, 5)};
    })()`);
    const tag = `${w}x${h} ${s}`;
    const opaque = !/rgba\([^)]*,\s*0(\.\d+)?\)/.test(r.bgAlpha);
    if (r.badCount) fail_msg(`${tag} 导航带内命中内容 ${r.badCount} 次 ${JSON.stringify(r.bad)}`);
    if (!opaque) fail_msg(`${tag} 导航底色非不透明 ${r.bgAlpha}`);
    console.log(`  ${tag.padEnd(18)} samples=${r.samples} bad=${r.badCount} navBottom=${r.navBottom}/${r.vh} bgOpaque=${opaque} ${r.badCount===0&&opaque?'PASS':'FAIL'}`);
  }
}
function fail_msg(m) { fails++; console.log('  FAIL ' + m); }
console.log(fails === 0 ? '\nALL PASS' : `\n${fails} FAILURES`);
sock.close(); process.exit(fails ? 1 : 0);
