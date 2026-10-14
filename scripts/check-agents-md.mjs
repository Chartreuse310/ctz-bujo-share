#!/usr/bin/env node
/**
 * AGENTS.md 的机械验证（文档类改动的「相关测试」）：
 *  1. 标题结构：`## N.` 序号从 0 起连续、无重复标题
 *  2. 引用路径：反引号里出现的仓库内文件路径必须真实存在
 *     —— 允许一份显式豁免表，且豁免项必须「在文中出现过」并在本文里标注为尚未创建
 *  3. 交叉引用：文中 `§N` / `§N.M` 的条款号必须在设计文档里真实存在
 *
 * 用法：node scripts/check-agents-md.mjs
 */
import {readFileSync, existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const AGENTS = join(root, 'AGENTS.md');
const DESIGN = join(root, 'docs/superpowers/specs/2026-10-14-ctz-bujo-share-design.md');

/**
 * 文档中明确标注为「尚未创建」的路径：实现计划批准、代码落地前它们本就不存在。
 * 每一项都必须能在文中找到「还不存在 / 还没有 / 尚未」这类标注，否则不要往这里加。
 */
const NOT_YET_CREATED = new Map([
  ['package.json', '§2 与 §7 均标注项目根还没有 package.json'],
  ['content/taxonomy.yml', '§2 标注 content/ 尚不存在；§5.2 描述其规则'],
]);
const EXEMPTION_CAP = 5;

const md = readFileSync(AGENTS, 'utf8');
const design = readFileSync(DESIGN, 'utf8');
const fails = [];
const notes = [];

// —— 1. 标题结构 ——
const h2 = [...md.matchAll(/^## (\d+)\. /gm)].map(m => Number(m[1]));
if (!h2.length) {
  fails.push('没有找到任何 `## N.` 形式的二级标题');
} else {
  h2.forEach((n, i) => {
    if (n !== i) fails.push(`二级标题序号不连续：第 ${i + 1} 个是 ${n}，期望 ${i}`);
  });
  notes.push(`二级标题 ${h2.length} 个：${h2.join(' ')}`);
}
const h3 = [...md.matchAll(/^### (\d+)\.(\d+) /gm)].map(m => [Number(m[1]), Number(m[2])]);
for (const [a, b] of h3) {
  if (!h2.includes(a)) fails.push(`三级标题 ${a}.${b} 的父级 §${a} 不存在`);
}
notes.push(`三级标题 ${h3.length} 个：${h3.map(([a, b]) => `${a}.${b}`).join(' ')}`);

const titles = [...md.matchAll(/^#{1,3} (.+)$/gm)].map(m => m[1].trim());
const dup = titles.filter((t, i) => titles.indexOf(t) !== i);
if (dup.length) fails.push(`标题重复：${[...new Set(dup)].join('、')}`);

// —— 2. 引用路径存在性 ——
const refs = new Set();
for (const m of md.matchAll(/`([^`\n]+)`/g)) {
  const s = m[1].trim();
  if (/^[\w][\w./-]*\.(md|mjs|js|json|yml|html)$/.test(s) && !s.startsWith('@11ty')) refs.add(s);
}
if (refs.size === 0) fails.push('没有解析到任何文件路径引用（正则可能已失效）');

for (const r of [...refs].sort()) {
  const exists = existsSync(join(root, r));
  if (exists) continue;
  if (NOT_YET_CREATED.has(r)) {
    if (!md.includes(r)) fails.push(`豁免项 ${r} 竟未在文档中出现，应移出豁免表`);
    notes.push(`豁免（尚未创建）${r} —— ${NOT_YET_CREATED.get(r)}`);
    continue;
  }
  fails.push(`引用的路径不存在：${r}`);
}
if (NOT_YET_CREATED.size > EXEMPTION_CAP) {
  fails.push(`豁免表 ${NOT_YET_CREATED.size} 项，超过上限 ${EXEMPTION_CAP}——请核实是否在掩盖失效引用`);
}

// —— 3. 设计文档条款号 ——
const designSections = new Set(
  [...design.matchAll(/^#{2,3} (\d+(?:\.\d+)?)[. ]/gm)].map(m => m[1]),
);
const cited = new Set([...md.matchAll(/§(\d+(?:\.\d+)?)/g)].map(m => m[1]));
if (cited.size === 0) fails.push('没有解析到任何 § 条款引用（正则可能已失效）');
for (const c of [...cited].sort((a, b) => a.localeCompare(b, 'en', {numeric: true}))) {
  if (!designSections.has(c)) fails.push(`引用的设计文档条款 §${c} 不存在`);
}
notes.push(`条款引用 ${cited.size} 个：${[...cited].join(' ')}`);

// —— 输出 ——
for (const n of notes) console.log(`· ${n}`);
if (fails.length) {
  console.error(`\n✖ AGENTS.md 验证失败 ${fails.length} 项：`);
  for (const f of fails) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`\n✔ AGENTS.md 验证通过（引用路径 ${refs.size} 个，其中豁免 ${NOT_YET_CREATED.size} 个）`);
