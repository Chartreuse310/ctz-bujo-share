import { selectedItems } from './share-selection.js';
import { bodyFor, readyBody, paginate, cardPng } from './share-pages.js';

const dialog=document.querySelector('.share-dialog');
const open=document.querySelector('.share-open');
const options=dialog.querySelector('.share-options'),status=dialog.querySelector('.share-status');
const preview=dialog.querySelector('.share-preview-button'),results=dialog.querySelector('.share-results');
const dock=document.createElement('div');dock.className='share-measure';dock.setAttribute('aria-hidden','true');document.body.append(dock);
let items=[],ids=new Set(),revision=0;
const urls=new Set();
const observer=new ResizeObserver(entries=>{for(const {target,contentRect} of entries)target.style.setProperty('--share-scale',contentRect.width/540);});
function invalidate() {
  revision++;results.replaceChildren();dock.replaceChildren();observer.disconnect();
  results.setAttribute('aria-busy','false');preview.disabled=ids.size===0;
  status.textContent=ids.size?'已选 '+ids.size+' 项。':'请选择要分享的记录。';
}
document.querySelector(".day").append(open);
open.hidden=false;
open.addEventListener('click',()=>{
  items=[...document.querySelectorAll('#share-source script')].map(s=>JSON.parse(s.textContent));
  ids=new Set(items.map(item=>item.id));options.replaceChildren();
  for(const item of items){
    const label=document.createElement('label');label.className='share-option';
    const box=document.createElement('input');box.type='checkbox';box.checked=true;box.value=item.id;
    const span=document.createElement('span'),kind=document.createElement('small');kind.textContent=item.kind==='daily'?'当日小结':item.kind==='event'?'事件':'思考';
    span.append(kind,document.createTextNode(item.title));label.append(box,span);options.append(label);
  }
  invalidate();dialog.showModal();
});
options.addEventListener('change',e=>{if(e.target.type!=='checkbox')return;e.target.checked?ids.add(e.target.value):ids.delete(e.target.value);invalidate();});
dialog.querySelector('.share-close').addEventListener('click',()=>dialog.close());
dialog.addEventListener('close',()=>{if(dialog.open)return;invalidate();open.focus();});
preview.addEventListener('click',async()=>{
  const version=++revision;results.replaceChildren();observer.disconnect();preview.disabled=true;
  results.setAttribute('aria-busy','true');status.textContent='正在排版…';
  const work=document.createElement('div');dock.append(work);
  try{
    const chosen=selectedItems(items,ids),bodies=chosen.map(bodyFor);
    work.append(...bodies);await Promise.all(bodies.map(readyBody));
    if(version!==revision)return;
    bodies.forEach(b=>b.remove());const cards=paginate(chosen,bodies,dialog.dataset.date,work);
    for(const [i,card]of cards.entries()){
      const group=document.createElement('div');group.className='share-result';
      const frame=document.createElement('div');frame.className='share-page-frame';frame.append(card);
      const save=document.createElement('button');save.type='button';save.className='share-save';save.textContent=`保存第 ${i+1} 张 PNG ↓`;
      save.addEventListener('click',async()=>{
        save.disabled=true;status.textContent='正在生成第 '+(i+1)+' 张图片…';
        try{
          const blob=await cardPng(card);if(version!==revision)return;
          const url=URL.createObjectURL(blob);urls.add(url);
          const link=document.createElement('a');link.href=url;link.download=`ctz-bujo-${dialog.dataset.date}-${String(i+1).padStart(2,'0')}.png`;document.body.append(link);link.click();link.remove();
          // Keep the URL alive while the browser/OS consumes the download.
          setTimeout(()=>{URL.revokeObjectURL(url);urls.delete(url);},60000);
          status.textContent='第 '+(i+1)+' 张图片已生成。';
        }catch{if(version===revision)status.textContent='保存失败，请点击保存按钮重试。';}
        finally{save.disabled=false;}
      });
      group.append(frame,save);results.append(group);observer.observe(frame);
    }
    status.textContent=`共 ${cards.length} 张卡片，可逐张保存。`;
  }catch{if(version===revision){results.replaceChildren();status.textContent='生成失败，请检查正文及图片，再点预览重试。';}}
  finally{work.remove();if(version===revision){results.setAttribute('aria-busy','false');preview.disabled=!ids.size;}}
});
window.addEventListener('pagehide',()=>{for(const url of urls)URL.revokeObjectURL(url);});
