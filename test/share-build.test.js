import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

let root, html, dayHtml;
const now = new Date();
const date = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
const out = resolve('.e2e-site/share-fixture');
const scripts = source => [...source.split('id="share-source"')[1].matchAll(/<script type="application\/json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]));
function build() {
  execFileSync(process.execPath, ['node_modules/@11ty/eleventy/cmd.cjs','--output',out], {env:{...process.env, CTZ_CONTENT_ROOT:root},stdio:'pipe'});
  return readFileSync(join(out,'today/index.html'),'utf8');
}
before(()=>{
  root=mkdtempSync(join(tmpdir(),'ctz-share-build-'));
  mkdirSync(join(root,'content/entries'),{recursive:true});mkdirSync(join(root,'content/daily'));
  cpSync('content/taxonomy.yml',join(root,'content/taxonomy.yml'));
  for(const [name,order] of [['a',undefined],['c',1],['b',1]]) {
    writeFileSync(join(root,`content/entries/${date}-${name}.md`),`---\ntype: thought\ntitle: ${JSON.stringify('🏃 </script> & 标题 '+name)}\ndate: ${date}\n${order===undefined?'slug: daily\n':`order: ${order}\n`}tags: [跑步]\n---\n\n第一段。\n\n第二段。\n\n第三段。\n\n第四段完整结尾 ${name}。`);
  }
  writeFileSync(join(root,`content/daily/${date}.md`),'---\ntitle: 小结\n---\n\n日总结完整正文。');
  html=build();dayHtml=readFileSync(join(out,`day/${date}/index.html`),'utf8');
});
after(()=>{rmSync(root,{recursive:true,force:true});rmSync(out,{recursive:true,force:true});});

test('今日分享源含独立小结与完整正文，条目按 order 与文件名排序',()=>{
  const data=scripts(html);
  assert.deepEqual(data.map(d=>d.id),['daily',`entry:${date}-b`,`entry:${date}-c`,'entry:daily']);
  assert.equal(data[0].html.trim(),'<p>日总结完整正文。</p>');
  assert.equal(data[1].title,'🏃 </script> & 标题 b');
  assert.match(data[1].html,/第四段完整结尾 b/);
  assert.deepEqual(data[1].tags,['跑步']);
});
test('分享资源有子路径前缀，普通日页没有分享入口，阅读摘要保留',()=>{
  assert.match(html,/href="\/ctz-bujo-share\/assets\/share.css"/);
  assert.match(html,/src="\/ctz-bujo-share\/assets\/share.js"/);
  assert.match(html,/class="excerpt" data-href=/);
  assert.doesNotMatch(dayHtml,/share-dialog|share-source|assets\/share/);
});
test('没有日总结时只提供条目；空日不伪造记录',()=>{
  rmSync(join(root,`content/daily/${date}.md`));
  assert.equal(scripts(build()).length,3);
  rmSync(join(root,'content/entries'),{recursive:true});
  assert.deepEqual(scripts(build()),[]);
});

test('今日默认最近有条目或小结的日期，分享同步；未来日期合法，完全无内容回退今天',()=>{
  mkdirSync(join(root,'content/entries'),{recursive:true});
  const entry=join(root,'content/entries/1999-12-31-record.md');
  const daily=join(root,'content/daily/2000-01-01.md');
  writeFileSync(entry,'---\ntype: event\ntitle: 最近事件\ndate: 1999-12-31\n---\n\n事件正文。');
  writeFileSync(daily,'---\ntitle: 最近小结\n---\n\n小结正文。');
  const latest=build();assert.match(latest,/data-date="2000-01-01"/);assert.match(latest,/2000 年 1 月 1 日/);
  assert.deepEqual(scripts(latest).map(x=>x.id),['daily']);
  rmSync(daily);const onlyEntry=build();assert.match(onlyEntry,/data-date="1999-12-31"/);assert.equal(scripts(onlyEntry)[0].title,'最近事件');
  const future=join(root,'content/daily/2099-01-01.md');writeFileSync(future,'---\ntitle: 未来记录\n---\n\n合法未来正文。');
  assert.match(build(),/data-date="2099-01-01"/);
  rmSync(future);rmSync(entry);const empty=build();assert.ok(empty.includes(`data-date="${date}"`));assert.deepEqual(scripts(empty),[]);
});


test('集子·标签页空态使用隔离空数据，保持单行提示（不依赖真实绘画集子无条目）',()=>{
  for(const dir of ['entries','daily']){
    rmSync(join(root,'content',dir),{recursive:true,force:true});
    mkdirSync(join(root,'content',dir),{recursive:true});
  }
  build();
  const html=readFileSync(join(out,'collection/drawing/index.html'),'utf8');
  assert.match(html,/<div class="list-empty">绘画还没有条目。登记了的集子\/tag 都会生成页面，只是列表为空。<\/div>/);
  assert.ok(!html.includes('这里还没有条目'),'demo 两段式首句不得回归');
});
