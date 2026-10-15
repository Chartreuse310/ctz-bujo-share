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
