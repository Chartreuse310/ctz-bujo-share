import { loadContent } from "../lib/load.js";
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


const {entries,taxonomy}=loadContent();
const thoughts=entries.filter(e=>e.type==='thought');
if(!thoughts.length) throw new Error('需要真实思考数据');
const paths=new Set(['/', '/today/', '/collection/all/']);
for(const e of thoughts){paths.add(e.url);paths.add('/day/'+e.date+'/');}
for(const c of taxonomy.collections)paths.add('/collection/'+c.slug+'/');
for(const t of taxonomy.tags)paths.add('/tag/'+t.slug+'/');
for(const width of [760,761]){
 await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
 for(const path of paths){
  await send('Page.navigate',{url:SITE+path});await sleep(180);
  const r=await ev(`(()=>{const titles=[...document.querySelectorAll('.thought-title')];return {marks:[...document.querySelectorAll(".thought-mark")].map(t=>getComputedStyle(t).backgroundColor),colors:titles.map(t=>getComputedStyle(t).color),links:titles.flatMap(t=>[...t.querySelectorAll('a')].map(a=>getComputedStyle(a).color)),padding:[...document.querySelectorAll(".thought-mark")].map(t=>{const s=getComputedStyle(t);return {x:parseFloat(s.paddingLeft)/parseFloat(s.fontSize),y:parseFloat(s.paddingTop)/parseFloat(s.fontSize)}}),overflow:document.documentElement.scrollWidth>innerWidth};})()`);
  if(r.padding.some(p=>Math.abs(p.x-.22)>.002||Math.abs(p.y-.08)>.002)||r.marks.some(m=>!m.includes("220, 224, 226"))||r.colors.some(c=>c!=='rgb(26, 25, 23)')||r.links.some(c=>c!=='rgb(26, 25, 23)')||r.overflow)fail(width+' '+path+' '+JSON.stringify(r));
 }
 ok(width+'px 所有思考日期/详情与首页标题 computed color PASS');
}
await send('Page.navigate',{url:SITE+'/today/'});await sleep(400);
await ev(`(()=>{const script=document.createElement('script');script.type='application/json';script.textContent=JSON.stringify({id:'color-fixture',kind:'thought',title:'颜色验证',html:'<p>正文验证。</p>',tags:[]});document.querySelector('#share-source').append(script);document.querySelector('.share-open').click();})()`);
await ev(`document.querySelector('.share-preview-button').click()`);await sleep(1200);
const share=await ev(`(()=>{const t=[...document.querySelectorAll('.share-option-title.thought-title,.share-record[data-kind="thought"] h3')];return {marks:[...document.querySelectorAll(".share-record[data-kind=thought] .thought-mark")].map(t=>getComputedStyle(t).backgroundColor),count:t.length,colors:t.map(e=>getComputedStyle(e).color)};})()`);
if(!share.count||!share.marks.length||share.marks.some(m=>!m.includes("220, 224, 226"))||share.colors.some(c=>c!=='rgb(26, 25, 23)'))fail('分享标题 '+JSON.stringify(share));else ok('分享选项与卡片思考标题 PASS');
console.log(fails?fails+' FAILURES':'ALL PASS');sock.close();process.exit(fails?1:0);
