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

// —— 底栏选中态（2026-10-16 三轮验收实证缺陷修复）——
// navActive 之前只在 index.njk 定义，month/collection/tag/stats/day 六类页面
// 的底栏四个 tab 全灰（CDP 实测 on 状态数=0），用户无法分辨当前屏。
// 归属按设计文档 §5 页面清单：month→本月、collection/tag→集子·标签、
// stats→统计、day→今日（与首页同版式）；entry 是跨屏详情页，不亮任何 tab。
test("每类页面的底栏都有且只有一个选中 tab（navActive 全覆盖）", () => {
  // 统计页的「本月/本年/全部」窗口切换器也用 aria-current（页内导航，合法），
  // 所以断言范围收紧到底栏四个链接本身。
  const TABS = [
    "month/2026-10/", "",
    "collection/all/",
    "stats/",
  ].map((p) => `/ctz-bujo-share/${p}`);
  const CASES = [
    ["index.html", "/ctz-bujo-share/"],
    ["month/2026-10/index.html", "/ctz-bujo-share/month/2026-10/"],
    ["collection/all/index.html", "/ctz-bujo-share/collection/all/"],
    ["tag/running/index.html", "/ctz-bujo-share/collection/all/"],
    ["stats/index.html", "/ctz-bujo-share/stats/"],
    ["day/2026-10-15/index.html", "/ctz-bujo-share/"],
  ];
  for (const [file, onHref] of CASES) {
    const html = readFileSync(join(OUT, file), "utf8");
    const onInTabbar = TABS.filter((href) =>
      html.includes(`href="${href}" class="on"`)
    );
    assert.deepEqual(
      onInTabbar,
      [onHref],
      `${file} 底栏应只亮 ${onHref}，实际 ${JSON.stringify(onInTabbar)}`
    );
  }
  // 条目详情页是跨屏入口，四个 tab 都不亮
  const entryHtml = readFileSync(join(OUT, "entry/2026-10-14-example/index.html"), "utf8");
  const onInEntry = TABS.filter((href) => entryHtml.includes(`href="${href}" class="on"`));
  assert.deepEqual(onInEntry, [], "entry 页不亮任何 tab");
});

// 月历格子文案 .cap = 当日日总结标题，截断规则按定稿 §5.2「1~2 行，超出 …」。
// 2026-10-16 五轮修正：@media(max-height:760px) 矮视口档曾写 -webkit-line-clamp:1
// （demo shortViewportG() 的内部行为，移植时带进实现），把用户 ≈750px 高的视口
// 罩住、文案只剩一行——与定稿的 1~2 行矛盾。守卫：任何视口档下 cap 都不得单行截断。
test("月历格子文案所有视口档都是两行截断（§5.2，矮视口档不得压回 1 行）", () => {
  const css = readFileSync(join(OUT, "assets/style.css"), "utf8");
  const clamps = [...css.matchAll(/\.cell \.cap\{[^}]*\}/g)].map((m) => m[0]);
  assert.ok(clamps.length >= 2, `style.css 里应有多档 .cap 规则，实际 ${clamps.length} 条`);
  for (const rule of clamps) {
    const m = rule.match(/-webkit-line-clamp:(\d+)/);
    assert.ok(m, `.cap 规则缺 -webkit-line-clamp：${rule}`);
    assert.equal(m[1], "2", `所有视口档的 cap 都应 line-clamp:2，实际：${rule}`);
  }
});

// —— 今日页 g1 基线对齐（设计文档 §5.3，2026-10-16 夜·八拍板）——
// 与 demo g1-line.html 的 #s-home 屏逐组件机械核对后定稿：tag 胶囊、.blk 块结构、
// mini-cell 格子、统计块「本月 N」副行、今日小结 .lbl/.h2、.top-row 条目头、空状态文案。
test("今日页 tag 呈现为胶囊（.tag.type/.coll/.hl），meta 文本行作废（§5.3）", () => {
  const html = readFileSync(join(OUT, "day/2026-10-15/index.html"), "utf8");
  // PhD 条目：类型描边 + 集子黑底反白 + tag 灰描边（tag 胶囊带「# 」前缀文案）
  assert.match(html, /class="tag type"/);
  assert.match(html, /class="tag coll">博士学位论文</);
  assert.match(html, /class="tag"># PhD V2\.0 P1\.1</);
  // 文本行 meta（旧约）不得再出现——meta 行已由胶囊行取代
  assert.ok(!html.includes('class="meta"'), "日页不得再出现文本行 meta");
});

test("今日页条目头用 .top-row 且摘要/tags 挂 46px 缩进（§5.3）", () => {
  const html = readFileSync(join(OUT, "day/2026-10-15/index.html"), "utf8");
  assert.match(html, /class="top-row"/);
  assert.ok(!html.includes('<div class="r1">'), "条目头不得复用右栏 .dlrow .r1 类名");
  const css = readFileSync(join(OUT, "assets/style.css"), "utf8");
  assert.match(css, /\.entry \.tags\{[^}]*margin:13px 0 0 46px/);
  assert.match(css, /\.entry \.excerpt\{[^}]*margin:12px 0 0 46px/);
});

test("今日页「今日小结」用 .lbl 朱红标签 + 衬线 h2（§5.3）", () => {
  const html = readFileSync(join(OUT, "day/2026-10-15/index.html"), "utf8");
  // 模板带缩进换行，断言行内顺序而非跨行拼接
  assert.match(html, /<aside class="pull">\s*<b class="lbl">今日小结<\/b>\s*<h2>/);
  assert.match(html, /<h2>读综述论文/);
  const css = readFileSync(join(OUT, "assets/style.css"), "utf8");
  assert.match(css, /\.pull \.lbl\{[^}]*color:var\(--accent\)/);
});

test("今日页侧栏是 .blk 块结构 + mini-foot 只留「今天」图例（§5.3）", () => {
  const html = readFileSync(join(OUT, "day/2026-10-15/index.html"), "utf8");
  assert.match(html, /<div class="blk">/);
  assert.match(html, /<h3>小月历<\/h3>/);
  assert.match(html, /<h3>统计<\/h3>/);
  assert.match(html, /月视图 →/);
  assert.match(html, /查看统计 →/);
  // 图例只保留「今天」一枚灰方块样本
  assert.match(html, /<div class="mini-foot"><b><\/b>今天<\/div>/);
  assert.ok(!html.includes("有记录</span>"), "demo 的「有记录」图例不恢复");
  assert.ok(!html.includes("含重点</span>"), "demo 的「含重点」图例不恢复");
});

test("小月历格子样式选择器是 .mini-grid a（button/a 失配防复发，§5.3）", () => {
  const css = readFileSync(join(OUT, "assets/style.css"), "utf8");
  // 旧缺陷：模板用 <a class="mini-cell">，CSS 全写 .mini-grid button → 0 条规则生效
  assert.match(css, /\.mini-grid a\{[^}]*height:26px/);
  assert.match(css, /\.mini-grid a\.hl \.ul\{[^}]*var\(--accent\)/);
  assert.match(css, /\.mini-grid a\.sel\{[^}]*border-color:var\(--ink\)/);
  assert.match(css, /\.mini-grid a\.today\{[^}]*background:var\(--rule-2\)/);
  assert.ok(!css.match(/\.mini-grid button\{/), "button 选择器不得残留（模板无 button）");
});

test("统计块参照 demo .stat-pair：衬线大数字墨色 + 「本月 N」副行（§5.3）", () => {
  const html = readFileSync(join(OUT, "day/2026-10-15/index.html"), "utf8");
  // 大数字墨色不分色：不得出现 demo 的 .n.ev/.n.th 分色类
  assert.ok(!html.includes('class="n ev"') && !html.includes('class="n th"'));
  assert.match(html, /<span class="n">\d+<\/span><span class="l">条目<\/span><span class="s">本月 \d+<\/span>/);
  assert.match(html, /<span class="n">\d+<\/span><span class="l">日总结<\/span><span class="s">本月 \d+<\/span>/);
  const css = readFileSync(join(OUT, "assets/style.css"), "utf8");
  // 分色规则不采用（大数字一律墨色）
  assert.ok(!css.match(/\.stat-pair \.p \.n\.(ev|th)/), "stat-pair 大数字分色规则不得存在");
  assert.match(css, /\.stat-pair \.p \.n\{[^}]*color:var\(--ink\)/);
});

test("空状态是单行「这里是空的。」（§5.3 拍板文案）", () => {
  // 空状态落在首页（今日 = 2026-10-16 无条目）与未来日期不生成日页——用首页验证
  const html = readFileSync(join(OUT, "index.html"), "utf8");
  assert.match(html, /<div class="empty">这里是空的。<\/div>/);
  // demo 两段引导不恢复
  assert.ok(!html.includes("这天没有条目"));
  assert.ok(!html.includes("还没有记录"));
});

// 「坏内容必须中断构建」（设计文档 §7 + 成功标准 4）。// 依赖 load.js 支持 CTZ_CONTENT_ROOT 覆盖内容根目录（Task 1.6 已含）。
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
