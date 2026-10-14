#!/usr/bin/env node
/**
 * 从实现计划里抽出 lib/*.js 与 test/*.js 的代码块，装配成可运行项目并跑 node --test。
 *
 * 为什么值得做：计划是 TDD 的，每个 Task 都把「实现」和「测试」原文写在文档里。
 * 如果两者互相矛盾（测试永远变不绿），只读文档很难发现——机械装配后真跑一遍才看得见。
 * 本脚本不改仓库，全部产物写到 os.tmpdir()。
 *
 * 用法：node scripts/verify-plan.mjs [--keep]
 */
import {readFileSync, mkdirSync, writeFileSync, rmSync, existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PLAN = join(root, 'docs/plans/2026-10-14-ctz-bujo-share-implementation.md');
const md = readFileSync(PLAN, 'utf8');
const lines = md.split('\n');

// 只取「阶段 1」的 Task（lib/ 纯函数层，可脱离 Eleventy 单测）。
// 阶段 2+ 的测试依赖真实构建（Eleventy、_site/），不在本脚本范围内。
const files = new Map(); // relPath -> [block, ...]
let task = null;
let declared = [];

for (let i = 0; i < lines.length; i++) {
  const L = lines[i];
  const mTask = /^### Task ([\d.]+)/.exec(L);
  if (mTask) {
    // 只接受 1.x（阶段 1）；其余（0.x / 2.x / 3.x / 4.x）跳过
    task = /^1\./.test(mTask[1]) ? mTask[1] : null;
    declared = [];
    continue;
  }
  if (!task) continue;

  // 记录本 Task 声明的文件（`- 新建：\`lib/x.js\``、`- 修改：…`、`- 测试：\`test/x.test.js\``）
  if (/^\*\*文件\*\*|^- (新建|修改|测试)：/.test(L)) {
    for (const f of L.matchAll(/`((?:lib|test)\/[\w.-]+\.js)`/g)) declared.push(f[1]);
  }

  const mFence = /^```(\w*)\s*$/.exec(L);
  if (!mFence || mFence[1] !== 'js') continue;

  // 收集该 fence 的内容
  const body = [];
  let j = i + 1;
  for (; j < lines.length && !/^```\s*$/.test(lines[j]); j++) body.push(lines[j]);
  i = j;
  const text = body.join('\n');
  if (!text.trim()) continue;

  const isTest = /^\s*import\s*\{[^}]*\btest\b[^}]*\}\s*from\s*"node:test"/m.test(text)
    || /^\s*test\(/m.test(text);
  const candidates = declared.filter((f) => isTest ? f.includes('.test.') : !f.includes('.test.'));
  const target = candidates[0];
  if (!target) continue;
  if (!files.has(target)) files.set(target, []);
  files.get(target).push(text);
}

if (!files.size) {
  console.error('✖ 没有抽到任何代码块（解析可能已失效）');
  process.exit(1);
}

// 装配到临时目录
const dir = join(tmpdir(), `plan-verify-${process.pid}`);
rmSync(dir, {recursive: true, force: true});
mkdirSync(dir, {recursive: true});
for (const [rel, blocks] of files) {
  const abs = join(dir, rel);
  mkdirSync(dirname(abs), {recursive: true});
  writeFileSync(abs, blocks.join('\n\n') + '\n', 'utf8');
}

console.log('抽出并装配：');
for (const rel of [...files.keys()].sort()) console.log(`  ${rel}  (${files.get(rel).length} 段)`);

// ── 接口一致性检查 ───────────────────────────────────────────────
// 计划里模板用 `site.X` 取数，但 site.js 若没返回 X，Nunjucks 不报错、只会静默渲染成空。
// 这类「接口对不上」的缺陷读文档很难发现，机械比对能直接抓出来。
const siteBlock = /export default function \(\) \{[\s\S]*?\n\}/.exec(md);
const referenced = new Set();
for (const m of md.matchAll(/\bsite\.([A-Za-z_$][\w$]*)/g)) {
  if (m[1] !== 'js') referenced.add(m[1]);   // 排除文件名 `site.js` 本身
}
// pagination.data: "site.X" 也要算进来
for (const m of md.matchAll(/"site\.([A-Za-z_$][\w$]*)"/g)) {
  if (m[1] !== 'js') referenced.add(m[1]);
}
// 模板里直接解构/使用但属于 site 的键（site.js 的返回块是权威）
const returned = new Set();
if (siteBlock) {
  const ret = /return \{([\s\S]*?)\n  \};/.exec(siteBlock[0]) || /return \{([\s\S]*?)\};/.exec(siteBlock[0]);
  if (ret) {
    for (const m of ret[1].matchAll(/([A-Za-z_$][\w$]*)\s*(?::|,|\n)/g)) returned.add(m[1]);
  }
}
const missing = [...referenced].filter((k) => !returned.has(k)).sort();
if (!siteBlock) {
  console.warn('⚠ 没能定位 site.js 的实现块，跳过接口检查');
} else if (missing.length) {
  console.log('接口不一致（模板引用了 site.js 未返回的键）：');
  for (const k of missing) console.log(`  site.${k}`);
  console.log();
}

// 让抽出的代码能 import zod / js-yaml。
// 仓库此时可能还没有 package.json（Task 0.1 才建），所以依赖装在稳定的临时目录里并复用。
const depsDir = join(tmpdir(), 'ctz-plan-verify-deps');
const repoModules = join(root, 'node_modules');
if (existsSync(repoModules)) {
  try { execFileSync('ln', ['-s', repoModules, join(dir, 'node_modules')], {stdio: 'pipe'}); } catch {}
} else {
  if (!existsSync(join(depsDir, 'node_modules', 'zod'))) {
    console.log('首次运行：装配依赖（zod + js-yaml）到 ' + depsDir + ' …');
    mkdirSync(depsDir, {recursive: true});
    writeFileSync(join(depsDir, 'package.json'), JSON.stringify({name: 'plan-verify-deps', private: true, type: 'module'}, null, 2));
    execFileSync('npm', ['install', 'zod@^4.6.7', 'js-yaml@^4.1.1', '--cache', join(depsDir, '.npm-cache'), '--silent'], {cwd: depsDir, stdio: 'inherit'});
  }
  try { execFileSync('ln', ['-s', join(depsDir, 'node_modules'), join(dir, 'node_modules')], {stdio: 'pipe'}); } catch {}
}

console.log(`\n临时目录：${dir}\n`);

// 跑
let out = '', code = 0;
try {
  out = execFileSync(process.execPath, ['--test'], {cwd: dir, encoding: 'utf8', stdio: 'pipe'});
} catch (e) {
  out = String(e.stdout || '') + String(e.stderr || '');
  code = e.status ?? 1;
}
// 只挑失败项与汇总行，避免刷屏
const lines2 = out.split('\n');
const summary = lines2.filter((l) => /^ℹ (tests|pass|fail|skipped|todo|suites)/.test(l.trim()));
const failed = lines2.filter((l) => /^✖ /.test(l.trim()));
const reasons = lines2.filter((l) => /AssertionError|Cannot find module|Error \[/.test(l));

if (failed.length) {
  console.log('失败项：');
  for (const l of [...new Set(failed.map((s) => s.trim()))]) console.log('  ' + l);
  console.log('\n原因：');
  for (const l of [...new Set(reasons.map((s) => s.trim()))].slice(0, 10)) console.log('  ' + l);
  console.log();
}
console.log(summary.length ? summary.join('\n') : '(没有解析到汇总行——测试可能根本没跑起来)');
if (!summary.length) console.log(out.split('\n').slice(-15).join('\n'));

if (!process.argv.includes('--keep')) rmSync(dir, {recursive: true, force: true});

// 接口不一致视为失败：模板拿不到数据只会静默渲染成空，不报错，必须在计划阶段拦住
if (missing.length) {
  console.error(`\n✖ 接口检查未通过：${missing.length} 个 site.X 未被 site.js 返回`);
  process.exit(1);
}
console.log(`\n退出码 ${code}`);
process.exit(code);
