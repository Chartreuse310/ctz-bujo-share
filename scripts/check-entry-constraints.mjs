import assert from 'node:assert/strict';
const tabs=await (await fetch('http://127.0.0.1:9333/json/list')).json();
const ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
await new Promise(r=>ws.addEventListener('open',r,{once:true}));
let id=0;const pending=new Map();const bad=[];
ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){pending.get(m.id)?.(m);pending.delete(m.id);}if(m.method==='Network.responseReceived'&&m.params.response.status>=400&&!m.params.response.url.endsWith('/favicon.ico'))bad.push(m.params.response.url);});
const send=(method,params={})=>new Promise(r=>{pending.set(++id,r);ws.send(JSON.stringify({id,method,params}));});
const ev=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true});assert.ok(!r.result.exceptionDetails);return r.result.result.value;};
try{
await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});
for(const width of [390,760,761,1440]){
await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
await send('Page.navigate',{url:(process.env.SITE_URL||'http://localhost:8080')+'/entry/2026-10-16-codex-pro/'});
await new Promise(r=>setTimeout(r,600));
for(const fraction of [0,.5,1]){
await ev(`scrollTo(0,(document.documentElement.scrollHeight-innerHeight)*${fraction})`);
await new Promise(r=>setTimeout(r,80));
const r=await ev(`(()=>{const card=document.querySelector('.postcard'),c=card.getBoundingClientRect(),s=getComputedStyle(card),nav=document.querySelector('.tabbar'),n=nav.getBoundingClientRect(),back=document.querySelector('.backlink').getBoundingClientRect();let hits=true;for(let x=8;x<innerWidth;x+=24)for(let y=n.top+4;y<n.bottom;y+=8)if(!nav.contains(document.elementFromPoint(x,y)))hits=false;return {width:c.width,center:(c.left+c.right)/2,padding:parseFloat(s.paddingLeft),overflow:document.documentElement.scrollWidth>innerWidth,nav:hits,bg:getComputedStyle(nav).backgroundColor,bottom:back.bottom,navTop:n.top}})()`);
assert.ok(r.width<=720.1);assert.ok(Math.abs(r.center-width/2)<1);assert.equal(r.padding,width<=760?24:48);assert.equal(r.overflow,false);assert.ok(r.nav);assert.ok(r.bg!=='rgba(0, 0, 0, 0)');if(fraction===1)assert.ok(r.bottom<=r.navTop);
}
console.log(`${width}px: 居中、宽度、内边距、无横溢、三处滚动底栏采样、页尾可达 PASS`);
}
assert.deepEqual(bad,[]);console.log('资源 4xx/5xx: 0');
}finally{ws.close();}
