/**
 * G 家族最终回归：
 *  A. G1 四屏 × 多档视口：底栏下方是否漏内容（像素级：有文本的元素矩形）
 *  B. 横向溢出、底栏贴底位置
 *  C. 交互：四屏点击 / 键盘 / 深链 / 侧栏小月历换月 / 月历格定位
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
const URL = f => `file:///Users/z/Programs/dev/ctz-bujo-share/docs/ui-demos/${f}`;

let fails = 0;
const fail = m => { fails++; console.log('  FAIL ' + m); };

/* ---------- A + B：G1 四屏多档 ---------- */
console.log('=== A/B. G1 四屏 × 视口（泄漏 / 横向溢出 / 贴底）===');
for (const [w, h] of [[1440,900],[1280,800],[1440,700],[1440,640],[1920,1080]]) {
  await send('Emulation.setDeviceMetricsOverride', {width: w, height: h, deviceScaleFactor: 1, mobile: false});
  await send('Page.navigate', {url: URL('g1-line.html')});
  await sleep(1100);
  for (const s of ['home','month','index','stats']) {
    await ev(`document.querySelector('[data-s="${s}"]').click()`);
    await sleep(900);  /* 等切屏动画（.28s）完全结束再测，避免测到 translateX 瞬时值 */
    const r = await ev(`(() => {
      const de = document.documentElement;
      const nav = document.querySelector('.tabbar').getBoundingClientRect();
      const vh = innerHeight, stripTop = nav.bottom;
      /* 只有「底栏下边缘与视口底边之间确有空间」时才可能存在泄漏 */
      const strip = Math.round(vh - stripTop);
      let leaks = 0;
      if (strip > 0) {
        for (const frac of [0, 0.35, 0.7, 1]) {
          window.scrollTo(0, Math.round((de.scrollHeight - vh) * frac));
          document.querySelectorAll('.screen.on *').forEach(el => {
            const hasText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
            if (!hasText) return;
            const b = el.getBoundingClientRect();
            if (b.height && b.bottom > stripTop + 0.5 && b.top < vh) leaks++;
          });
          window.scrollTo(0, 0);
        }
      }
      return {gap: strip, leaks, hOver: de.scrollWidth > de.clientWidth + 1};
    })()`);
    const tag = `${w}x${h} ${s}`;
    if (r.gap !== 0) fail(`${tag} 底栏未贴底 gap=${r.gap}`);
    if (r.leaks !== 0) fail(`${tag} 底栏下方漏内容 ${r.leaks} 处`);
    if (r.hOver) fail(`${tag} 横向溢出`);
    console.log(`  ${tag.padEnd(18)} gap=${r.gap} leaks=${r.leaks} hOver=${r.hOver} ${r.gap===0&&r.leaks===0&&!r.hOver?'PASS':'FAIL'}`);
  }
}

/* ---------- C：交互 ---------- */
console.log('=== C. G1 交互 ===');
await send('Emulation.setDeviceMetricsOverride', {width: 1440, height: 900, deviceScaleFactor: 1, mobile: false});
await send('Page.navigate', {url: URL('g1-line.html')});
await sleep(1100);
const inter = await ev(`(async () => {
  const cur = () => document.querySelector('.screen.on').id;
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const click = async s => { document.querySelector('[data-s="'+s+'"]').click(); await wait(260); return cur(); };
  const out = {};
  out.deepLink = null;
  out.c_month = await click('month');
  out.c_index = await click('index');
  out.c_stats = await click('stats');
  out.c_home  = await click('home');
  document.dispatchEvent(new KeyboardEvent('keydown', {key:'ArrowRight', bubbles:true})); await wait(300);
  out.keyRight = cur();
  document.dispatchEvent(new KeyboardEvent('keydown', {key:'ArrowLeft', bubbles:true})); await wait(300);
  out.keyLeft = cur();
  // 侧栏小月历换月
  await click('home');
  const mini = document.querySelector('#miniHost');
  const before = mini.querySelector('.mini-head .m').textContent;
  const nx = mini.querySelector('[data-mv="1"]') || document.querySelector('#miniHost [data-mv="1"]');
  if (nx) { nx.click(); await wait(300); }
  out.miniPrev = before;
  out.miniAfter = document.querySelector('#miniHost .mini-head .m').textContent;
  // 月历格定位右列表：切回今天所在月（小月历换月已把状态移到 11 月，无数据行）
  await click('month');
  const todayBtn = document.getElementById('mToday');
  if (todayBtn) { todayBtn.click(); await wait(500); }
  const pane = document.getElementById('listPane');
  const rows = [...pane.querySelectorAll('.dlrow')];
  let cellLoc = {err: 'no rows'};
  if (rows.length) {
    const deepest = rows.reduce((a, b) => (b.offsetTop > a.offsetTop ? b : a), rows[0]);
    const date = deepest.dataset.date;
    const cell = document.querySelector('#matrix .cell[data-date="' + date + '"]');
    if (!cell) { cellLoc = {err: 'no cell for ' + date}; }
    else {
      pane.scrollTop = 0; await wait(220);
      const before = pane.scrollTop;
      cell.click(); await wait(900);
      cellLoc = {date, before, after: pane.scrollTop,
                 flash: deepest.classList.contains('flash'), offsetTop: Math.round(deepest.offsetTop)};
    }
  }
  out.cellLocate = cellLoc;
  // 深链
  location.hash = '#stats'; await wait(320);
  out.deepLinkStats = cur();
  return out;
})()`);
console.log(JSON.stringify(inter, null, 1));
const expect = {c_month:'s-month',c_index:'s-index',c_stats:'s-stats',c_home:'s-home',keyRight:'s-index',keyLeft:'s-home',deepLinkStats:'s-stats'};
for (const [k,v] of Object.entries(expect)) if (inter[k] !== v) fail(`交互 ${k} 期望 ${v} 实际 ${inter[k]}`);
if (!inter.cellLocate || inter.cellLocate.err || inter.cellLocate.after <= inter.cellLocate.before) fail('月历格未定位右列表: ' + JSON.stringify(inter.cellLocate));
if (inter.miniPrev === inter.miniAfter) fail('小月历换月无效');

console.log(fails === 0 ? '\nALL PASS' : `\n${fails} FAILURES`);
sock.close(); process.exit(fails === 0 ? 0 : 1);
