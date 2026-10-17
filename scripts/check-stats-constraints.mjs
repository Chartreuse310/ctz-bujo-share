/** 统计页渲染回归：先启动 CDP 9333 和本地根路径站点。SITE_URL 可覆盖。 */
import assert from 'node:assert/strict';
const site = process.env.SITE_URL || 'http://127.0.0.1:8082';
const tabs = await (await fetch('http://127.0.0.1:9333/json/list')).json();
const socket = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => socket.addEventListener('open', r, { once:true }));
let id = 0;
const pending = new Map();
socket.addEventListener('message', e => { const m=JSON.parse(e.data); if(m.id) { pending.get(m.id)?.(m); pending.delete(m.id); } });
const send = (method, params={}) => new Promise(r => { pending.set(++id,r); socket.send(JSON.stringify({id,method,params})); });
const evaluate = async expression => {
  const result = await send('Runtime.evaluate', {expression,returnByValue:true});
  assert.ok(!result.result.exceptionDetails, JSON.stringify(result.result.exceptionDetails));
  return result.result.result.value;
};
const pause = () => new Promise(r => setTimeout(r,400));
const badResources = [];
socket.addEventListener('message', e => { const m=JSON.parse(e.data); if(m.method==='Network.responseReceived' && m.params.response.status>=400 && !m.params.response.url.endsWith('/favicon.ico')) badResources.push(m.params.response.url); });
try {
  await send('Network.enable');
  await send('Network.setCacheDisabled', {cacheDisabled:true});
  for (const width of [1440,760,761]) {
    await send('Emulation.setDeviceMetricsOverride', {width,height:900,deviceScaleFactor:1,mobile:false});
    for (const window of ['', 'year/', 'all/']) {
      await send('Page.navigate', {url:site+'/stats/'+window});
      await pause();
      const r = await evaluate(`(() => {
        const $=s=>document.querySelector(s), rect=e=>e.getBoundingClientRect();
        const n=$('.kpi .n'),l=$('.kpi .l'),d=$('.kpi .d');
        const svg=$('.card.full svg');
        const title=$('.head h1'), range=document.createRange(); range.selectNodeContents(title.firstChild);
        const titleGap=rect(title.querySelector('em')).top-range.getBoundingClientRect().bottom;
        const points=[...svg.querySelectorAll('path')].flatMap(p=>[...p.getAttribute('d').matchAll(/[ML]([\\d.-]+) ([\\d.-]+)/g)].map(m=>[+m[1],+m[2]]));
        const ink=getComputedStyle(document.documentElement).getPropertyValue('--ink').trim();
        const blue=getComputedStyle(document.documentElement).getPropertyValue('--blue').trim();
        return { titleGap, layers:rect(n).bottom<=rect(l).top && (!d || rect(l).bottom<=rect(d).top),
          kpiHeight:rect($('.kpi')).height,
          order:rect($('.kpis')).bottom<=rect($('.seg')).top && rect($('.seg')).bottom<=rect($('.grid2')).top,
          grid:$('.card.full').parentElement.className,
          overflow:document.documentElement.scrollWidth>innerWidth,
          points, circles:svg.querySelectorAll('circle').length,ink,blue,
          border:getComputedStyle($('.grid2')).borderLeftWidth };
      })()`);
      assert.ok(r.layers && r.order && !r.overflow, JSON.stringify(r));
      // 字体行框可能比字形盒稍高，Range 实测至少留出 8px 可见间距。
      assert.ok(r.titleGap>=8, JSON.stringify(r));
      assert.equal(r.grid,'grid2'); assert.equal(r.border,'1px');
      // 全部窗口不显示环比，窄屏首排卡片自然少一行；其余窗口与 demo 同为 128px。
      const expectedHeight = window==='all/' && width<1000 ? 102.625 : 128;
      assert.ok(Math.abs(r.kpiHeight-expectedHeight)<1, JSON.stringify(r));
      assert.ok(r.points.every(([x,y])=>x>=56 && x<=976 && y>=30 && y<=214), JSON.stringify(r));
      if(window!=='all/') assert.equal(r.points[0][0],56);
      else assert.equal(r.circles,2);
      assert.equal(r.blue,'#6f8fa6');
      for (const scroll of [0,450,10000]) {
        await evaluate('scrollTo(0,'+scroll+')'); await pause();
        const safe = await evaluate(`(() => { const nav=document.querySelector('.tabbar'), r=nav.getBoundingClientRect(); for(let x=5;x<innerWidth;x+=40) for(let y=r.top+2;y<r.bottom;y+=8) if(!nav.contains(document.elementFromPoint(x,y))) return false; return Math.abs(r.bottom-innerHeight)<1 && getComputedStyle(nav).backgroundColor!=='rgba(0, 0, 0, 0)'; })()`);
        assert.ok(safe,'底栏采样不得穿透');
      }
      console.log('PASS '+width+'px /stats/'+window+' KPI='+r.kpiHeight+'px，坐标/结构/滚动采样');
    }
  }
  await send('Page.navigate',{url:site+'/stats/'}); await pause();
  await evaluate("document.querySelector('.seg a[href$=\"/stats/year/\"]').click()"); await pause();
  assert.equal(await evaluate('location.pathname'),'/stats/year/');
  assert.equal(await evaluate("document.querySelector('.seg a.on').textContent"),'本年');
  assert.deepEqual(badResources,[]);
  console.log('PASS 窗口跳转与选中态，资源 4xx/5xx=0');
} finally { socket.close(); }
