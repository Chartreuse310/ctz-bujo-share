const XHTML = 'http://www.w3.org/1999/xhtml';
const segmenter = new Intl.Segmenter('zh', { granularity: 'grapheme' });
const el = (name, className, text) => {
  const node = document.createElement(name); node.className = className;
  if (text != null) node.textContent = text;
  return node;
};

export function makeCard(date, index = 1, total = 1) {
  const card = el('div', 'share-card');
  const header = el('header', 'share-card-header');
  header.append(el('b', 'share-card-date', date.replaceAll('-', ' · ')), el('small', '', '当日记录'));
  const footer = el('footer', 'share-card-footer');
  footer.append(el('span', '', 'ctz/bujo'), el('span', 'share-page-number', `${index} / ${total}`));
  card.append(header, el('div', 'share-content'), footer);
  return card;
}

function record(item, continued = false) {
  const article = el('article', 'share-record');
  article.dataset.shareId = item.id; article.dataset.kind = item.kind;
  const head = el('div', 'share-record-head');
  head.append(el('span', 'share-kind', (item.kind === 'daily' ? '当日小结' : item.kind === 'event' ? '事件' : '思考') + (continued ? ' · 续' : '')));
  const title = el('h3', item.kind === 'thought' ? 'thought-title' : '', item.kind === 'thought' ? null : item.title);
  if (item.kind === 'thought') title.append(el('span', 'thought-mark', item.title));
  head.append(title);
  const tags = el('div', 'share-tags');
  if (item.collection) tags.append(el('span', 'tag coll', item.collection));
  for (const tag of item.tags || []) tags.append(el('span', 'tag', '# ' + tag));
  if (item.highlight) tags.append(el('span', 'tag hl', '重点'));
  head.append(tags); article.append(head, el('div', 'share-text'));
  return article;
}

export function bodyFor(item) {
  const body = el('div', 'share-text');
  body.innerHTML = item.html;
  // Export only passive prose/media. Content is local author input, but raw HTML
  // must not execute a script again or introduce interactive controls in a card.
  body.querySelectorAll('script,style,link,iframe,object,embed,form,input,button,video,audio').forEach(n => n.remove());
  for (const node of body.querySelectorAll('*')) {
    for (const a of [...node.attributes]) if (!['href','src','alt','title','start','value','colspan','rowspan'].includes(a.name)) node.removeAttribute(a.name);
    if (node.tagName === 'OL') [...node.children].forEach((li,i) => li.setAttribute('value', Number(node.getAttribute('start') || 1) + i));
  }
  return body;
}

// DOM boundaries include graphemes AND atomic elements, so images between text
// nodes survive a split. Ranges keep inline markup and nested block structure.
function boundaries(block) {
  const points = [{ node: block, offset: 0 }];
  function walk(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      for (const part of segmenter.segment(node.data)) points.push({node,offset:part.index + part.segment.length});
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      if (!node.childNodes.length) points.push({node:node.parentNode,offset:[...node.parentNode.childNodes].indexOf(node)+1});
      else [...node.childNodes].forEach(walk);
    }
  }
  [...block.childNodes].forEach(walk);
  return points;
}
function slice(block, points, from, to) {
  const range = document.createRange();
  range.setStart(points[from].node, points[from].offset); range.setEnd(points[to].node, points[to].offset);
  const fragment = block.cloneNode(false); fragment.append(range.cloneContents());
  return fragment;
}
function fits(content) {
  return content.scrollHeight <= content.clientHeight && content.scrollWidth <= content.clientWidth;
}

export function paginate(items, bodies, date, dock) {
  const cards = [];
  let card, content;
  const next = () => { card = makeCard(date); dock.append(card); content=card.querySelector('.share-content'); cards.push(card); };
  if (!items.length) return cards;
  next();
  for (let i=0;i<items.length;i++) {
    const item=items[i], body=bodies[i];
    let article=record(item), text=article.querySelector('.share-text');
    text.append(...[...body.childNodes].map(n=>n.cloneNode(true))); content.append(article);
    if (fits(content)) continue;
    article.remove();
    // A complete entry takes priority over using up the previous page's tail.
    if (content.children.length) next();
    content.append(article);
    if (fits(content)) continue;
    text.replaceChildren();
    const continuation = () => {
      next(); article=record(item,true); text=article.querySelector('.share-text');content.append(article);
    };
    for (const block of body.childNodes) {
      const whole=block.cloneNode(true);text.append(whole);
      if (fits(content)) continue;
      whole.remove();
      if (block.nodeType !== Node.ELEMENT_NODE) {
        // Top-level text is unusual in Markdown; wrap it to use the same splitter.
        const p=el('p','');p.textContent=block.textContent;
        splitBlock(p);
      } else splitBlock(block);
    }
    function splitBlock(block) {
      const points=boundaries(block); let from=0;
      if (points.length===1) {
        if (text.childNodes.length) continuation();
        text.append(block.cloneNode(true));
        if (fits(content)) return;
        throw new Error('这段内容无法分页，请检查正文格式。');
      }
      while(from<points.length-1) {
        // Prefer a whole block on the next page if there is already body text.
        if (from===0 && text.childNodes.length) {
          const trial=makeCard(date), trialRecord=record(item,true);
          trialRecord.querySelector('.share-text').append(block.cloneNode(true));
          trial.querySelector('.share-content').append(trialRecord);dock.append(trial);
          const wholeFits=fits(trial.querySelector('.share-content'));trial.remove();
          if (wholeFits) {continuation();text.append(block.cloneNode(true));return;}
        }
        let low=from+1,high=points.length-1,best=from;
        while(low<=high) {
          const mid=Math.floor((low+high)/2), part=slice(block,points,from,mid);text.append(part);
          const ok=fits(content);part.remove();
          if(ok){best=mid;low=mid+1;}else high=mid-1;
        }
        if(best===from) {
          if(text.childNodes.length){continuation();continue;}
          throw new Error('这条记录的标题或内容过高，暂时无法生成卡片。');
        }
        text.append(slice(block,points,from,best));from=best;
        if(from<points.length-1)continuation();
      }
    }
  }
  cards.forEach((c,i) => { c.querySelector('.share-page-number').textContent=`${i+1} / ${cards.length}`; });
  return cards;
}

export async function readyBody(body) {
  await document.fonts.ready;
  await Promise.all([...body.querySelectorAll('img')].map(async img => {
    const url = new URL(img.getAttribute('src'), location.href);
    if (!['http:','https:','data:'].includes(url.protocol)) throw new Error('图片地址无法读取。');
    const response = await fetch(url);
    if (!response.ok) throw new Error('正文图片加载失败，请重试。');
    const blob=await response.blob();
    img.src=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('图片读取失败。'));reader.readAsDataURL(blob);});
    await img.decode();
  }));
}

// Inline computed styles, then rasterize a self-contained SVG with a foreignObject.
// No service, CDN or screenshot dependency; CSS is frozen to the measured preview.
export async function cardPng(card) {
  await document.fonts.ready;
  const clone=card.cloneNode(true);
  const originals=[card,...card.querySelectorAll('*')],copies=[clone,...clone.querySelectorAll('*')];
  originals.forEach((node,i)=>{
    const styles=getComputedStyle(node);
    for(const name of styles) copies[i].style.setProperty(name,styles.getPropertyValue(name));
    copies[i].style.setProperty('animation','none');copies[i].style.setProperty('transition','none');
  });
  clone.setAttribute('xmlns',XHTML);
  Object.assign(clone.style,{transform:'none',position:'relative',left:'0',top:'0',visibility:'visible'});
  const xml=new XMLSerializer().serializeToString(clone);
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1440" viewBox="0 0 540 720"><foreignObject width="540" height="720">${xml}</foreignObject></svg>`;
  // A data URL keeps the SVG origin-clean in Chrome; a Blob SVG can taint canvas.
  const source='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
  const image=new Image();image.src=source;await image.decode();
  const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1440;
  const ctx=canvas.getContext('2d');ctx.fillStyle=getComputedStyle(card).backgroundColor;ctx.fillRect(0,0,1080,1440);ctx.drawImage(image,0,0,1080,1440);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
  if(!blob)throw new Error('图片生成失败，请重试。');
  return blob;
}
