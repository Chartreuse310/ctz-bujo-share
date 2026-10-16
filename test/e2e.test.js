import { test, before } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, cpSync, rmSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const OUT = ".e2e-site";

before(() => {
  execFileSync("npx", ["@11ty/eleventy", "--output", OUT], { stdio: "pipe" });
});

test("关键页面产物都存在", () => {
  for (const p of [
    "index.html",
    "stats/index.html",
    "collection/all/index.html",
  ]) {
    assert.ok(existsSync(join(OUT, p)), `缺少 ${p}`);
  }
});

test("集子页与 tag 页按登记表生成", () => {
  for (const p of [
    "collection/drawing/index.html",
    "collection/phd-thesis/index.html",
    "collection/books-films-music/index.html",
    "tag/phd-v2-0-p1-1/index.html",
    "tag/running/index.html",
  ]) {
    assert.ok(existsSync(join(OUT, p)), `缺少 ${p}`);
  }
});

test("条目页 URL 含日期前缀（设计文档 §5.1）", () => {
  assert.ok(existsSync(join(OUT, "entry/2026-10-14-example/index.html")));
});

test("条目页渲染出了 Markdown（<p> 等）", () => {
  const html = readFileSync(join(OUT, "entry/2026-10-14-example/index.html"), "utf8");
  assert.match(html, /<p>/);
});

test("首页不含未渲染的 front matter 定界符", () => {
  const html = readFileSync(join(OUT, "index.html"), "utf8");
  assert.doesNotMatch(html, /^---/m);
});

// 条目卡片摘要 = 三行排版截断（设计文档 §5.2，2026-10-15 拍板）：
// 渲染整篇正文进 .excerpt（不做段落挑选），行数上限交给 CSS line-clamp，
// 「全文 →」链接由 excerpt.js 在真被截断时插入（构建期不出现）。
test("日页条目卡片渲染整篇正文（不只第一段）", () => {
  const html = readFileSync(join(OUT, "day/2026-10-15/index.html"), "utf8");
  // 早餐条目两段正文都必须出现在日页卡片里（旧 firstPara 只会给第一段）
  assert.match(html, /带了自己做的拿铁/);
  assert.match(html, /血字的研究/);
});

test("条目卡片是 clamp 容器且不预置「全文」链接", () => {
  const html = readFileSync(join(OUT, "day/2026-10-15/index.html"), "utf8");
  assert.match(html, /class="excerpt" data-href="\/ctz-bujo-share\/entry\/2026-10-15-breakfast-mcdonalds\/"/);
  // 「全文 →」只在浏览器端确认被截断后才插入，构建产物里不得静态存在
  assert.ok(!html.includes("全文 →"), "构建期不得出现「全文 →」链接");
});

test("excerpt.js 已随产物发布并被页面引用", () => {
  assert.ok(existsSync(join(OUT, "assets/excerpt.js")), "缺少 excerpt.js");
  const html = readFileSync(join(OUT, "day/2026-10-15/index.html"), "utf8");
  assert.match(html, /assets\/excerpt\.js/);
});

// —— 子路径部署（2026-10-16 线上实证缺陷修复）——
// GitHub Pages 项目站部署在 /ctz-bujo-share/ 子路径下；资源与内部链接若写绝对路径 /assets/...
// 会 404（用户浏览器实测：style.css/nav.js/excerpt.js 全 404 → 页面裸文字）。
// 构建必须给全部内部 URL 加 CTZ_BASE_URL（默认 /ctz-bujo-share）前缀。
test("资源与内部链接带子路径前缀（GitHub Pages 项目站）", () => {
  const html = readFileSync(join(OUT, "day/2026-10-15/index.html"), "utf8");
  // 资源引用
  assert.match(html, /href="\/ctz-bujo-share\/assets\/style\.css"/);
  assert.match(html, /src="\/ctz-bujo-share\/assets\/nav\.js"/);
  // 内部导航与卡片链接
  assert.match(html, /href="\/ctz-bujo-share\/stats\/"/);
  assert.match(html, /data-href="\/ctz-bujo-share\/entry\/2026-10-15-breakfast-mcdonalds\/"/);
  // 月历格链接
  assert.match(html, /href="\/ctz-bujo-share\/day\/2026-10-15\/"/);
  // 不得残留未加前缀的根绝对引用（排除 // 协议相对与 /ctz-bujo-share 前缀本身）
  assert.doesNotMatch(html, /(href|src)="\/(?!\/|ctz-bujo-share)/, "存在未加前缀的根绝对路径引用");
});

test("无前缀场景（CTZ_BASE_URL=空）构建出根路径引用", () => {
  // 本地 serve 也可以选根路径部署；机制上必须支持空前缀
  const out2 = ".e2e-site-root";
  execFileSync("npx", ["@11ty/eleventy", "--output", out2], {
    stdio: "pipe",
    env: { ...process.env, CTZ_BASE_URL: "" },
  });
  const html = readFileSync(join(out2, "day/2026-10-15/index.html"), "utf8");
  assert.match(html, /href="\/assets\/style\.css"/);
  rmSync(out2, { recursive: true, force: true });
});

// 「坏内容必须中断构建」（设计文档 §7 + 成功标准 4）。
// 依赖 load.js 支持 CTZ_CONTENT_ROOT 覆盖内容根目录（Task 1.6 已含）。
// ⚠️ 不要断言 !existsSync(out)：实测失败时输出目录仍会被创建
// （passthrough copy 在校验之前就跑完了，里面只剩 assets/）。
// 正确口径：退出码非 0 + 没有任何 HTML 页面产出 + stderr 含出错字段名。
test("校验失败时构建中断且不产出（设计文档 §7 + 成功标准 4）", () => {
  const root = mkdtempSync(join(tmpdir(), "ctz-e2e-"));
  cpSync("content", join(root, "content"), { recursive: true });
  writeFileSync(join(root, "content/entries/bad.md"), "---\ntype: thougt\ntitle: t\ndate: 2026-10-14\n---\nx\n");
  const out = join(root, "_site");
  let code = 0;
  let stderr = "";
  try {
    execFileSync("npx", ["@11ty/eleventy", "--output", out], {
      stdio: "pipe",
      cwd: process.cwd(),
      env: { ...process.env, CTZ_CONTENT_ROOT: root },
    });
  } catch (err) {
    code = err.status ?? 1;
    stderr = String(err.stderr || "") + String(err.stdout || "");
  }
  assert.notEqual(code, 0, "坏内容必须让构建失败");
  assert.ok(!existsSync(join(out, "index.html")), "失败时不得产出页面");
  assert.ok(!existsSync(join(out, "stats/index.html")), "失败时不得产出页面");
  assert.match(stderr, /type/, "错误信息要指出出问题的字段");
  rmSync(root, { recursive: true, force: true });
});
