// 独立首页 CDP 回归：资源、几何、换一组和真实链接（需 9333 与本地服务）。
const PORT=9333;
const SITE=process.env.SITE_URL || 'http://127.0.0.1:8081';
const ws = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const page = ws.find(t => t.type === "page");
const sock = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r => sock.addEventListener("open", r, { once: true }));
let id = 0; const pending = new Map();
sock.addEventListener("message", ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
function send(method, params = {}) { return new Promise(res => { const i = ++id; pending.set(i, res); sock.send(JSON.stringify({ id: i, method, params })); }); }
async function ev(expr) { const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) throw new Error("page eval: " + JSON.stringify(r.result.exceptionDetails).slice(0, 300)); return r.result?.result?.value; }
const sleep = ms => new Promise(r => setTimeout(r, ms));
await send("Network.enable"); await send("Network.setCacheDisabled", { cacheDisabled: true });
await send("Page.enable");

let fails = 0;
const fail = m => { fails++; console.log("  FAIL " + m); };
const ok = m => console.log("  " + m);


const resources=[];
sock.addEventListener('message',ev=>{const m=JSON.parse(ev.data);if(m.method==='Network.responseReceived' && m.params.response.status>=400 && !m.params.response.url.endsWith('/favicon.ico')) resources.push(m.params.response.url);});
for(const [w,h] of [[375,812],[760,900],[761,900],[1440,900]]) {
 await send('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:SITE+'/'});await sleep(500);
 const r=await ev(`(()=>{
  const de=document.documentElement;
  const cards=[...document.querySelectorAll('#thought-list article')];
  const titles=cards.map(c=>c.querySelector('h3').textContent);
  const pool=[...document.querySelectorAll('#thought-pool template')];
  const button=document.querySelector('#shuffle-thoughts');
  button.click();
  const next=[...document.querySelectorAll('#thought-list h3')].map(c=>c.textContent);
  const bad=[...document.querySelectorAll('.landing h1,.landing h2,.landing h3,.landing-excerpt,.landing-event-excerpt,.landing-tags a')].filter(e=>e.getBoundingClientRect().width && e.scrollWidth>e.clientWidth+1).map(e=>e.className);
  return {overflow:de.scrollWidth>innerWidth+1,bad,count:cards.length,expected:Math.min(3,pool.length),unique:new Set(titles).size===titles.length,changed:pool.length<=3 || titles.slice().sort().join()!==next.slice().sort().join(),buttonHidden:button.hidden,pool:pool.length};
 })()`);
 if(r.overflow||r.bad.length||r.count!==r.expected||!r.unique||!r.changed||r.buttonHidden!==(r.pool<=3)) fail(w+' '+JSON.stringify(r));else ok(w+' 首页几何与换一组 PASS');
 const links=await ev(`[...document.querySelectorAll('.landing a,.brand')].map(a=>a.href)`);
 for(const url of new Set(links)){const response=await fetch(url);if(!response.ok)fail('链接 '+url+' '+response.status);}
 const full=await ev(`(async()=>{
  await document.fonts.ready;
  const workout=[...document.querySelectorAll('.landing-event')].find(e=>e.textContent.includes('一分化·全身B'));
  const prose=workout?.querySelector('.landing-event-excerpt');
  const complete=!!prose&&prose.querySelectorAll('p').length===3&&prose.textContent.includes('而在不关心的领域更多地放弃。');
  const box=document.querySelector('.landing-excerpt');
  box.insertAdjacentHTML('beforeend','<p><strong>长正文验证</strong> '+ '连续长文本'.repeat(120) + '</p><blockquote><p>引用内容</p></blockquote><pre><code>'+ 'long_code_'.repeat(100) + '</code></pre><p><a href="https://example.com">'+ 'long_link_'.repeat(100) +'</a></p><table><tr><td>'+ 'wide_cell_'.repeat(100) +'</td><td>第二列</td></tr></table>');
  const bodies=[...document.querySelectorAll('.landing-excerpt,.landing-event-excerpt')];
  const bad=bodies.filter(b=>b.scrollHeight>b.clientHeight+1||b.scrollWidth>b.clientWidth+1||getComputedStyle(b).webkitLineClamp!=='none').map(b=>b.className);
  return {complete,bad,overflow:document.documentElement.scrollWidth>innerWidth+1};
 })()`);
 if(!full.complete||full.bad.length||full.overflow)fail(w+' 全文与宽内容 '+JSON.stringify(full));else ok(w+' 全文、分段、长链接/代码/表格 PASS');
 for(const fraction of [0,.5,1]) {
  const nav=await ev(`(()=>{
   scrollTo(0,(document.documentElement.scrollHeight-innerHeight)*${fraction});
   const n=document.querySelector('.tabbar'),r=n.getBoundingClientRect();let hits=true;
   for(let x=8;x<innerWidth;x+=24)for(let y=r.top+4;y<r.bottom;y+=8)if(!n.contains(document.elementFromPoint(x,y)))hits=false;
   const bodies=[...document.querySelectorAll('.landing-excerpt,.landing-event-excerpt')];
   const last=bodies.at(-1).getBoundingClientRect();
   return {hits,opaque:getComputedStyle(n).backgroundColor!=='rgba(0, 0, 0, 0)',endSafe:${fraction}!==1||last.bottom<=r.top+1};
  })()`);
  if(!nav.hits||!nav.opaque||!nav.endSafe)fail(w+' 滚动 '+fraction+' 底栏 '+JSON.stringify(nav));
 }
}

// 隔离补足候选，验证真实数据只有少量思考时走不到的换组分支。
const shuffle=await ev(`(async()=>{
 const pool=document.querySelector('#thought-pool');
 pool.replaceChildren();
 for(let i=0;i<5;i++){const t=document.createElement('template');t.innerHTML='<article class="landing-thought"><h3>测试思考 '+i+'</h3></article>';pool.append(t);}
 await import('/assets/home.js?shuffle-test');
 const titles=()=>[...document.querySelectorAll('#thought-list h3')].map(e=>e.textContent).sort().join();
 const before=titles();document.querySelector('#shuffle-thoughts').click();
 return {changed:before!==titles(),count:document.querySelectorAll('#thought-list article').length,hidden:document.querySelector('#shuffle-thoughts').hidden};
})()`);
if(!shuffle.changed || shuffle.count!==3 || shuffle.hidden)fail('换组隔离状态 '+JSON.stringify(shuffle));else ok('五条候选换一组 PASS');
// 首页没有四屏手势；真实键盘事件不得改变 URL。
await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});await sleep(400);
if(await ev('location.pathname')!=='/') fail('首页错误加入四屏键盘切换');
// 品牌与今日是真实链接。
await ev(`document.querySelector('.landing-links a').click()`);await sleep(400);
if(await ev('location.pathname')!=='/today/')fail('今日入口');
await ev(`document.querySelector('.brand').click()`);await sleep(400);
if(await ev('location.pathname')!=='/')fail('品牌返回首页');
if(resources.length)fail('资源错误 '+JSON.stringify(resources));
console.log(fails ? fails+' FAILURES':'ALL PASS');sock.close();process.exit(fails?1:0);
