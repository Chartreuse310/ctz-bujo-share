import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('思考标题使用墨色与浅蓝高亮，对比至少 4.5:1',()=>{
 const css=readFileSync('src/assets/style.css','utf8');
 assert.match(css,/--thought-highlight:#dce0e2/);
 assert.match(css,/\.thought-title[^{}]*\{[^}]*color:var\(--ink\)/);
 assert.match(css,/background:var\(--thought-highlight\);padding:0\.08em 0\.22em/);
 const lum=hex=>{const c=hex.match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;};
 const bg='dce0e2';
 assert.ok((lum(bg)+.05)/(lum('1a1917')+.05)>=4.5);
});
test('各条目呈现与分享标题按 type/kind 区分，正文不染色',()=>{
 for(const path of ['src/_includes/day-body.njk','src/entry.njk','src/collection.njk','src/tag.njk']){
  const src=readFileSync(path,'utf8');
  assert.match(src,/<h[14][^>]*if (?:e|entry)\.type == "thought"[^>]*thought-title/);
 }
 assert.match(readFileSync('src/_includes/home-thought.njk','utf8'),/<h3 class="thought-title">/);
 assert.match(readFileSync('src/assets/share-pages.js','utf8'),/item.kind === 'thought' \? 'thought-title'/);
 assert.match(readFileSync('src/assets/share.js','utf8'),/item.kind==='thought'/);
});
