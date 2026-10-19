import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { shareFixtures } from './fixtures/share.mjs';

const SITE = process.env.SITE_URL || 'http://127.0.0.1:8082';
const pages = await (await fetch('http://127.0.0.1:9333/json/list')).json();
const page = pages.find(p => p.type === 'page');
assert.ok(page, '需要 CDP 9333 的页面');
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r => socket.addEventListener('open', r, {once:true}));
let serial = 0;
const pending = new Map(), errors = [], resources = [];
let imageMode='pass', heldImage;
let imageData;
socket.addEventListener('message', e => {
  const m = JSON.parse(e.data);
  if(m.method==='Fetch.requestPaused') {
    const requestId=m.params.requestId;
    if(imageMode==='hold') heldImage=requestId;
    else if(imageMode==='fail') void send('Fetch.failRequest',{requestId,errorReason:'Failed'});
    else void send('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'image/png'}],body:imageData});
  }
  if (m.id) { const waiter = pending.get(m.id); if (waiter) { pending.delete(m.id); m.error ? waiter.reject(new Error(JSON.stringify(m.error))) : waiter.resolve(m.result); } }
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.text);
  if (m.method === 'Network.responseReceived' && m.params.response.status >= 400 && !m.params.response.url.endsWith('/favicon.ico')) resources.push(m.params.response.url);
});
function send(method, params={}) { return new Promise((resolve,reject) => {const id=++serial;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));}); }
async function ev(expression) {
  const r = await send('Runtime.evaluate', {expression, returnByValue:true, awaitPromise:true});
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
}
const delay = ms => new Promise(r => setTimeout(r, ms));
const downloads = mkdtempSync(join(tmpdir(), 'ctz-share-download-'));
try {
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Network.setCacheDisabled', {cacheDisabled:true});
  await send('Browser.setDownloadBehavior', {behavior:'allow', downloadPath:downloads});
  await send('Fetch.enable',{patterns:[{urlPattern:'*share-fixture.png*'}]});
  for (const [width,height] of [[375,812],[760,900],[761,900],[1440,900]]) {
    await send('Emulation.setDeviceMetricsOverride', {width,height,deviceScaleFactor:width===375?3:1,mobile:width===375});
    await send('Page.navigate', {url:SITE+'/today/'});
    await delay(500);
    const overlap=await ev(`(()=>{const b=document.querySelector('.share-open');b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect();return [...document.querySelectorAll('.side *, .day .entry, .day .pull, .day .dateline')].filter(e=>{const a=e.getBoundingClientRect();return a.width&&a.height&&a.left<r.right&&a.right>r.left&&a.top<r.bottom&&a.bottom>r.top;}).map(e=>e.className);})()`);
    assert.deepEqual(overlap,[],'分享入口遮挡原阅读内容');
    // Inject only the source fixture. Real controller handles all interaction and rendering.
    await ev(`(() => {
      const source=document.querySelector('#share-source'); source.replaceChildren();
      for(const item of ${JSON.stringify(shareFixtures)}) {const s=document.createElement('script');s.type='application/json';s.textContent=JSON.stringify(item);source.append(s);}
      document.querySelector('.share-open').click();
    })()`);
    assert.equal(await ev('document.querySelectorAll(".share-options input:checked").length'), shareFixtures.length);
    await ev('document.querySelector(".share-preview-button").click()');
    for (let t=0;t<200 && await ev('document.querySelector(".share-results").getAttribute("aria-busy")==="true"');t++) await delay(50);
    const state = await ev(`(() => {
      const cards=[...document.querySelectorAll('.share-results .share-card')];
      const source=${JSON.stringify(shareFixtures)};
      const text=html=>{const d=document.createElement('div');d.innerHTML=html;return d.textContent.replace(/\s/g,'');};
      const complete=source.every(item=>cards.flatMap(c=>[...c.querySelectorAll('[data-share-id]')]).filter(e=>e.dataset.shareId===item.id).map(e=>e.querySelector('.share-text').textContent).join('').replace(/\s/g,'')===text(item.html));
      const bad=[];
      for(const [index,card] of cards.entries()) {
        const content=card.querySelector('.share-content'),footer=card.querySelector('.share-card-footer'),head=card.querySelector('.share-card-header');
        const cr=content.getBoundingClientRect(),fr=footer.getBoundingClientRect(),hr=head.getBoundingClientRect();
        if(content.scrollHeight>content.clientHeight+1 || content.scrollWidth>content.clientWidth+1) bad.push([index,'overflow']);
        for(const el of content.querySelectorAll('*')) {const r=el.getBoundingClientRect();if(!r.width||!r.height)continue;
          if(r.left<cr.left-1||r.right>cr.right+1||r.bottom>cr.bottom+1||r.top<hr.bottom-1||r.bottom>fr.top+1)bad.push([index,el.className||el.tagName,el.textContent.slice(0,25)]);
        }
        if(getComputedStyle(card).backgroundColor==='rgba(0, 0, 0, 0)')bad.push([index,'transparent']);
        if(card.querySelector('.nav,button,input'))bad.push([index,'controls']);
      }
      return {count:cards.length,complete,bad,status:document.querySelector('.share-status').textContent,overflow:document.querySelector('.share-dialog').scrollWidth>document.querySelector('.share-dialog').clientWidth+1};
    })()`);
    assert.ok(state.count>3, JSON.stringify(state)); assert.ok(state.complete, '正文丢失/重复 '+JSON.stringify(state));
    assert.deepEqual(state.bad, [], JSON.stringify(state)); assert.equal(state.overflow,false);
    const fixed = await ev(`(() => {
      const toolbar=document.querySelector('.share-toolbar'), choices=document.querySelector('.share-choices'), results=document.querySelector('.share-results');
      const start=[toolbar,choices].map(e=>e.getBoundingClientRect().top);
      const errors=[];
      for(const fraction of [0,.5,1]) {
        results.scrollTop=(results.scrollHeight-results.clientHeight)*fraction;
        [toolbar,choices].forEach((e,i)=>{if(Math.abs(e.getBoundingClientRect().top-start[i])>.5)errors.push('moved '+i);});
      }
      for(const label of document.querySelectorAll('.share-option')) {
        const a=label.querySelector('input').getBoundingClientRect(),b=label.querySelector('.share-option-title').getBoundingClientRect();
        if(Math.abs((a.top+a.bottom-b.top-b.bottom)/2)>.5)errors.push('checkbox alignment');
      }
      results.scrollTop=0;
      return {errors,scrollable:results.scrollHeight>results.clientHeight,outer:document.querySelector('.share-dialog').scrollHeight>document.querySelector('.share-dialog').clientHeight+1};
    })()`);
    assert.deepEqual(fixed.errors,[]);assert.ok(fixed.scrollable);assert.equal(fixed.outer,false);
    console.log(width+'px 顶栏/选项常驻、勾选对齐 PASS');
    // Verify geometry again at another scroll position and no accidental four-screen navigation.
    for(const fraction of [0,.5,1]) {
      const hits=await ev(`(()=>{const d=document.querySelector('.share-dialog');d.scrollTop=(d.scrollHeight-d.clientHeight)*${fraction};return [...d.querySelectorAll('button,.share-options label')].filter(e=>{const r=e.getBoundingClientRect(),dr=d.getBoundingClientRect();const cr=e.closest('.share-choices,.share-results')?.getBoundingClientRect();if(r.top<dr.top||r.bottom>dr.bottom||!r.width||!r.height||(cr&&(r.top<cr.top||r.bottom>cr.bottom)))return false;const hit=document.elementFromPoint((r.left+r.right)/2,(r.top+r.bottom)/2);return !e.contains(hit);}).map(e=>e.className);})()`);
      assert.deepEqual(hits,[],'弹窗内可见操作被遮挡');
    }
    if(width===375){
      await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
      await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:260,y:400}]});
      await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:100,y:400}]});
      await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await delay(320);
      assert.equal(await ev('location.pathname'),new URL(SITE+'/today/').pathname,'弹窗触滑不应切到其他屏');
    }
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});
    assert.equal(await ev('location.pathname'), new URL(SITE+'/today/').pathname);
    console.log(width+'px 默认选择、完整正文、多页、零裁切/遮挡 PASS ('+state.count+' 页)');
    if (width===375) {
      await ev('document.querySelector(".share-results").scrollIntoView({block:"start"})');
      const raster = await ev(`(async()=>{
        const {cardPng}=await import('${new URL(SITE).pathname.replace(/\/$/,'')}/assets/share-pages.js');
        const blob=await cardPng(document.querySelector('.share-card'));
        const bitmap=await createImageBitmap(blob),canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1440;
        const ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0);const pixels=ctx.getImageData(0,0,1080,1440).data;
        const ink=[0,0,0];let transparent=0;
        for(let i=0;i<pixels.length;i+=4){if(pixels[i+3]!==255)transparent++;if(pixels[i]<200&&pixels[i+1]<200&&pixels[i+2]<200){const y=Math.floor(i/4/1080);ink[y<204?0:y<1308?1:2]++;}}
        return {ink,transparent};
      })()`);
      assert.equal(raster.transparent,0);assert.ok(raster.ink.every(n=>n>100),'PNG 不得为空白，页头/正文/页脚均须有文字 '+JSON.stringify(raster));
      console.log('PNG 不透明背景与三个区域的文字像素 PASS');
      await ev(`window.originalShareToBlob=HTMLCanvasElement.prototype.toBlob;HTMLCanvasElement.prototype.toBlob=function(cb){cb(null);};document.querySelector('.share-save').click()`);
      for(let t=0;t<100 && await ev('document.querySelector(".share-save").disabled');t++)await delay(50);
      assert.match(await ev('document.querySelector(".share-status").textContent'),/失败/);
      assert.equal(await ev('document.querySelectorAll(".share-results .share-card").length'),state.count);
      await ev(`HTMLCanvasElement.prototype.toBlob=window.originalShareToBlob;delete window.originalShareToBlob;document.querySelector('.share-save').click()`);
      for(let t=0;t<200 && !readdirSync(downloads).some(f=>f.endsWith('.png'));t++)await delay(50);
      const file=readdirSync(downloads).find(f=>f.endsWith('.png'));assert.ok(file,'PNG 实际下载失败: '+await ev('document.querySelector(".share-status").textContent'));
      const png=readFileSync(join(downloads,file));assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png.readUInt32BE(16),1080);assert.equal(png.readUInt32BE(20),1440);
      assert.match(file,/\d{4}-\d{2}-\d{2}-01\.png$/);
      console.log('PNG 实际下载与 1080 × 1440 尺寸 PASS');
    }
    await ev(`document.querySelectorAll('.share-options input').forEach(c=>{c.checked=false;c.dispatchEvent(new Event('change',{bubbles:true}));})`);
    assert.equal(await ev('document.querySelector(".share-preview-button").disabled'),true);
    assert.equal(await ev('document.querySelectorAll(".share-results .share-card").length'),0);
    await ev(`document.querySelectorAll('.share-options input')[1].click();document.querySelector('.share-preview-button').click()`);
    for(let t=0;t<100 && await ev('document.querySelector(".share-results").getAttribute("aria-busy")==="true"');t++)await delay(50);
    assert.deepEqual(await ev(`[...document.querySelectorAll('.share-results [data-share-id]')].map(e=>e.dataset.shareId)`),['short']);
    // Real pointer clicks: card content stays open; unused layout gap exits.
    await ev('document.querySelector(".share-results").scrollTop=0');
    for(const selector of ['.share-card', '.share-layout']) {
      const point=await ev(`(()=>{const e=document.querySelector('${selector}'),r=e.getBoundingClientRect(),v=document.querySelector('.share-results').getBoundingClientRect();return '${selector}'==='.share-card'?{x:r.left+20,y:Math.max(r.top,v.top)+20}:{x:r.left+r.width/2,y:r.top-12};})()`);
      await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});
      await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});
      assert.equal(await ev('document.querySelector(".share-dialog").open'),selector==='.share-card');
    }
    await ev('document.querySelector(".share-open").click()');
    await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,x:1,y:1});
    await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,x:1,y:1});
    assert.equal(await ev('document.querySelector(".share-dialog").open'),false,'弹窗外侧留白退出');
    console.log(width+'px 卡片点击不退出、内部及外侧留白退出 PASS');
    await ev('document.querySelector(".share-open").click()');
    await ev('document.querySelector(".share-close").click()');assert.equal(await ev('document.querySelector(".share-dialog").open'),false);
    console.log(width+'px 全取消、重新选择、旧预览失效、返回今日 PASS');
  }

  // A real failed image request must preserve choices and allow a successful retry.
  const imageItem={id:'image',kind:'event',title:'图片与正文',tags:[],html:'<p>图片之前。</p><img src="'+SITE+'/share-fixture.png" alt="测试图片"><p>图片之后。</p>'};
  async function source(items) {
    await ev(`(() => {const d=document.querySelector('.share-dialog');if(d.open)d.close();const source=document.querySelector('#share-source');source.replaceChildren();for(const item of ${JSON.stringify(items)}){const s=document.createElement('script');s.type='application/json';s.textContent=JSON.stringify(item);source.append(s);}document.querySelector('.share-open').click();})()`);
  }
  async function waitPreview() {
    for(let t=0;t<200 && await ev('document.querySelector(".share-results").getAttribute("aria-busy")==="true"');t++)await delay(50);
    assert.equal(await ev('document.querySelector(".share-results").getAttribute("aria-busy")'),'false','预览未结束');
  }
  imageData=await ev(`(()=>{const c=document.createElement('canvas');c.width=400;c.height=120;const x=c.getContext('2d');x.fillStyle='#2a58ba';x.fillRect(0,0,400,120);return c.toDataURL().split(',')[1];})()`);
  imageMode='fail';await source([imageItem]);await ev('document.querySelector(".share-preview-button").click()');await waitPreview();
  assert.match(await ev('document.querySelector(".share-status").textContent'),/生成失败/);
  assert.doesNotMatch(await ev('document.querySelector(".share-status").textContent'),/Failed to fetch|EncodingError|SecurityError/,'不把浏览器实现错误直接放进用户文案');
  assert.equal(await ev('document.querySelectorAll(".share-options input:checked").length'),1);
  imageMode='pass';await ev('document.querySelector(".share-preview-button").click()');await waitPreview();
  assert.equal(await ev('document.querySelectorAll(".share-results img").length'),1);
  assert.match(await ev('document.querySelector(".share-status").textContent'),/共 1 张/);
  const imageInk=await ev(`(async()=>{const {cardPng}=await import('${new URL(SITE).pathname.replace(/\/$/,'')}/assets/share-pages.js');const b=await createImageBitmap(await cardPng(document.querySelector('.share-results .share-card')));const c=document.createElement('canvas');c.width=1080;c.height=1440;const x=c.getContext('2d');x.drawImage(b,0,0);const p=x.getImageData(0,0,1080,1440).data;let blue=0;for(let i=0;i<p.length;i+=4)if(p[i]<70&&p[i+1]<120&&p[i+2]>150)blue++;return blue;})()`);
  assert.ok(imageInk>10000,'正文图片未正确绘入 PNG：'+imageInk);
  console.log('图片请求失败保留选择、重试后恢复、图片实际绘入 PNG PASS');

  imageMode='hold';heldImage=undefined;await source([imageItem,shareFixtures[1]]);
  await ev('document.querySelector(".share-preview-button").click()');
  for(let t=0;t<100 && !heldImage;t++)await delay(30);
  assert.ok(heldImage,'未进入慢图片加载状态');
  await ev('document.querySelector(".share-options input").click();document.querySelector(".share-preview-button").click()');await waitPreview();
  await send('Fetch.fulfillRequest',{requestId:heldImage,responseCode:200,responseHeaders:[{name:'Content-Type',value:'image/png'}],body:imageData});
  await delay(100);
  assert.deepEqual(await ev(`[...document.querySelectorAll('.share-results [data-share-id]')].map(e=>e.dataset.shareId)`),['short']);
  console.log('加载中改变选择后，过期分页不会覆盖当前预览 PASS');
  imageMode='pass';
  const wholeItems=[{id:'first',kind:'event',title:'第一条',tags:[],html:'<p>记录一。</p>'.repeat(5)},{id:'second',kind:'event',title:'第二条',tags:[],html:'<p>记录二。</p>'.repeat(8)}];
  await source(wholeItems);await ev('document.querySelector(".share-preview-button").click()');await waitPreview();
  assert.equal(await ev('document.querySelectorAll(".share-results .share-card").length'),2);
  assert.equal(await ev('document.querySelectorAll(".share-results [data-share-id="+JSON.stringify("second")+"]").length'),1);
  console.log('能容纳于新页的整条记录不会被拆开 PASS');
  await source([]);assert.equal(await ev('document.querySelector(".share-preview-button").disabled'),true);
  assert.equal(await ev('document.querySelectorAll(".share-results .share-card").length'),0);
  console.log('空日不生成卡片 PASS');
  assert.deepEqual(errors,[],'浏览器异常');assert.deepEqual(resources,[],'资源请求错误');
  console.log('ALL PASS');
} finally {socket.close();rmSync(downloads,{recursive:true,force:true});}
