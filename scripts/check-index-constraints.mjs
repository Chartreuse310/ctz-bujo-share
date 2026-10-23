import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import yaml from 'js-yaml';
const labels = yaml.load(readFileSync('content/taxonomy.yml', 'utf8'), { schema: yaml.JSON_SCHEMA }).tags.map(t => '# ' + t.name);
const tabs = await (await fetch('http://127.0.0.1:9333/json/list')).json();
const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r, { once: true }));
let id = 0;
const pending = new Map(), bad = [];
ws.addEventListener('message', e => {
  const m = JSON.parse(e.data);
  if (m.id) { pending.get(m.id)?.(m); pending.delete(m.id); }
  if (m.method === 'Network.responseReceived' && m.params.response.status >= 400) bad.push(m.params.response.url);
});
const send = (method, params = {}) => new Promise(r => { pending.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
const ev = async expression => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true });
  assert.ok(!r.result.exceptionDetails, JSON.stringify(r.result.exceptionDetails));
  return r.result.result.value;
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
try {
  await send('Network.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });
  for (const width of [390, 760, 761, 1440]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
    for (const path of ['/collection/phd-thesis/', '/collection/all/', '/tag/phd-v2-0-p1-1/']) {
      await send('Page.navigate', { url: (process.env.SITE_URL || 'http://localhost:8081') + path });
      await sleep(650);
      const meta = await ev(`(() => {
        const rows = [...document.querySelectorAll('.resrow')];
        return rows.map(row => [...row.querySelectorAll('.r .tag:not(.type)')].map(t => t.textContent));
      })()`);
      assert.ok(meta.length > 0, `${path}: 需要真实条目`);
      for (const tags of meta) {
        if (path.startsWith('/tag/')) { assert.equal(tags.length, 1); assert.ok(tags.every(t => !t.startsWith('# '))); }
        else assert.ok(tags.every(t => t.startsWith('# ')));
      }
      // 真实页面验证后，在独立浏览器 DOM 注入登记表的全部标签，覆盖最长标签及多标签，不改公开内容。
      if (path.startsWith('/collection/')) await ev(`(() => {
        const r = document.querySelector('.resrow .r');
        for (const text of ${JSON.stringify(labels)}) {
          const span = document.createElement('span'); span.className = 'tag'; span.textContent = text; r.append(span);
        }
      })()`);
      for (const fraction of [0, .5, 1]) {
        await ev(`scrollTo(0, (document.documentElement.scrollHeight-innerHeight)*${fraction})`);
        await sleep(100);
        const r = await ev(`(() => {
          const nav = document.querySelector('.tabbar'), n = nav.getBoundingClientRect();
          let hits = true;
          for (let x=8;x<innerWidth;x+=24) for (let y=n.top+4;y<n.bottom;y+=8)
            if (!nav.contains(document.elementFromPoint(x,y))) hits=false;
          const clipped = [...document.querySelectorAll('.resrow .r .tag')].filter(t => t.scrollWidth>t.clientWidth+1 || t.scrollHeight>t.clientHeight+1).map(t=>t.textContent);
          const broken = [...document.querySelectorAll('.resrow .r .tag')].filter(t => {
            const range=document.createRange();range.selectNodeContents(t);
            return getComputedStyle(t).whiteSpace!=='nowrap' || range.getClientRects().length!==1;
          }).map(t=>t.textContent);
          const overlaps = [...document.querySelectorAll('.resrow')].flatMap(row => {
            const blocks=[row.querySelector('.d'),row.querySelector('.t'),...row.querySelectorAll('.r .tag')];
            return blocks.flatMap((a,i)=>blocks.slice(i+1).filter(b=>{
              const x=a.getBoundingClientRect(),y=b.getBoundingClientRect();
              return Math.min(x.right,y.right)-Math.max(x.left,y.left)>1 && Math.min(x.bottom,y.bottom)-Math.max(x.top,y.top)>1;
            }).map(b=>[a.textContent,b.textContent]));
          });
          const last = document.querySelector('.resrow:last-child').getBoundingClientRect();
          return { overflow:document.documentElement.scrollWidth>innerWidth, hits, bg:getComputedStyle(nav).backgroundColor, clipped, broken, overlaps, bottom:last.bottom, navTop:n.top };
        })()`);
        assert.equal(r.overflow, false, `${width} ${path}: 横向溢出`);
        assert.deepEqual(r.clipped, [], `${width} ${path}: 胶囊裁切`);
        assert.deepEqual(r.broken, [], `${width} ${path}: 标签内部换行`);
        assert.deepEqual(r.overlaps, [], `${width} ${path}: 标签或内容相互遮挡`);
        assert.ok(r.hits); assert.ok(!['transparent', 'rgba(0, 0, 0, 0)'].includes(r.bg));
        if (fraction === 1) assert.ok(r.bottom <= r.navTop + 1, `${width} ${path}: 页尾遮挡`);
      }
    }
    console.log(`${width}px: 集子/主集子/标签语义、长标签与多标签、无横溢或裁切、三处滚动底栏采样及页尾可达 PASS`);
  }
  assert.deepEqual(bad, []); console.log('资源 4xx/5xx: 0');
} finally { ws.close(); }
