// Validate runnable README examples against the real content schemas, not copies.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFrontMatter } from '../lib/frontmatter.js';
import { validateEntry, validateDaily } from '../lib/schema.js';
import { loadContent } from '../lib/load.js';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const md=readFileSync(resolve(root,'README.md'),'utf8');
const pkg=JSON.parse(readFileSync(resolve(root,'package.json'),'utf8'));
const {taxonomy}=loadContent(root);
let examples=0,links=0,commands=0;
for (const match of md.matchAll(/```markdown\n([\s\S]*?)\n```/g)) {
  const preceding=md.slice(0,match.index);
  const paths=[...preceding.matchAll(/`(content\/(?:entries|daily)\/[^`\s]+\.md)`/g)];
  const path=paths.at(-1)?.[1];assert.ok(path,'Markdown 示例之前应说明目标文件名');
  const {data,body}=parseFrontMatter(match[1],path);
  if(path.startsWith('content/entries/')) validateEntry({...data,body},path,taxonomy,basename(path),m=>{throw new Error(m);});
  else validateDaily({...data,body},path,basename(path));
  examples++;
}
assert.ok(examples>=2,'需要条目与日总结两个可校验示例');
for(const [,target]of md.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
  if(/^(?:https?:|#)/.test(target))continue;
  assert.ok(existsSync(resolve(root,target.split('#')[0])),`仓库内链接不存在：${target}`);links++;
}
for(const match of md.matchAll(/npm run ([a-z][\w:-]*)|npm (test|ci)\b/g)) {
  const name=match[1]||match[2];
  if(name!=='ci')assert.ok(pkg.scripts[name],`npm 命令不存在：${name}`);
  commands++;
}
for(const [,path]of md.matchAll(/\bnode (scripts\/[\w.-]+\.mjs)/g))assert.ok(existsSync(resolve(root,path)),`检查脚本不存在：${path}`);
console.log(`README PASS：${examples} 个 Markdown 示例通过真实 schema；${links} 个仓库内链接可达；${commands} 处 npm 命令有效；所列检查脚本均存在。`);
