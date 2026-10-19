import { loadContent } from "../lib/load.js";
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, cpSync, rmSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const OUT = ".e2e-site/main";

before(() => {
  rmSync(OUT, { recursive: true, force: true });
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

// ===== 集子·标签页 g1 基线对齐（2026-10-16 夜·十拍板）=====
// 拍板：①布局 = demo 款侧栏左 236px / 列表右；②resrow 三列网格（.d | .t(+.sub) | .r 胶囊）；
// ③侧栏复用 .blk/.blk-h/.idx（与今日页同一套侧栏语言，rail-h/rail-row 野生款废除）；
// ④标题区 = .res-head（h2 集子名衬线 + .cnt「N 条 · 事件 X / 思考 Y」+ .hint），不用今日页 .dateline，
//   不加页面级大标题「集子 · 标签」与 taxonomy 说明文（公开站直接进内容）；
// ⑤空态 = 单行提示性文案（不是 demo 两段式，也不是今日页「这里是空的。」）；
// ⑥tag 前缀 = 「# 」带空格（与今日页胶囊一致）。

test("集子·标签页布局：侧栏在左 236px 列、主栏在右（g1 index-layout 方向，夜·十①）", () => {
  const html = readFileSync(join(OUT, "collection/phd-thesis/index.html"), "utf8");
  const railPos = html.indexOf('<aside class="rail">');
  const mainPos = html.indexOf('<main class="res-main">');
  assert.ok(railPos !== -1 && mainPos !== -1, "侧栏与主栏都应存在");
  assert.ok(railPos < mainPos, `侧栏 .rail 必须在 DOM 里先于主栏 .res-main（demo 款左栏），实际 rail=${railPos} main=${mainPos}`);
});

test("集子·标签页列表行：resrow 三列结构 .d | .t(h4+.sub) | .r 胶囊（夜·十②⑥）", () => {
  const html = readFileSync(join(OUT, "collection/phd-thesis/index.html"), "utf8");
  // 行结构：.d 日期列（日期<br>星期）、.t 包 h4+1 行摘要 .sub、.r 放类型胶囊 + 集子胶囊
  assert.match(html, /<a class="resrow"[^>]*>\s*<span class="d">2026-10-15<br>[^<]+<\/span>\s*<div class="t"><h4>/s, "行首应是 .d（日期+星期）后接 .t>h4");
  assert.match(html, /<div class="sub">/, ".t 里应有 1 行摘要 .sub");
  assert.match(html, /<div class="r"><span class="tag type">/, ".r 里应是 tag.type 胶囊（不是裸 .type）");
  // tag 行「# 」带空格
  assert.match(html, /# PhD V2\.0 P1\.1/, ".r 胶囊应写「# 名称」带空格");
  assert.ok(!html.includes(">#PhD"), "不得出现紧贴的 #名称 写法");
});

test("集子·标签页侧栏：复用 .blk/.blk-h/.idx，计数右挂 .n，选中朱红（夜·十③）", () => {
  const html = readFileSync(join(OUT, "collection/phd-thesis/index.html"), "utf8");
  assert.ok(!html.includes("rail-h") && !html.includes("rail-row"), "野生款 rail-h/rail-row 不得残留");
  assert.match(html, /<div class="blk">\s*<div class="blk-h"><h3>集子<\/h3>/s, "侧栏第一块 = .blk>.blk-h>h3 集子");
  assert.match(html, /<div class="blk">\s*<div class="blk-h"><h3>标签<\/h3>/s, "侧栏第二块 = 标签");
  assert.match(html, /<div class="blk-h"><h3>[^<]+<\/h3><span class="lnk">\d+<\/span>/, ".blk-h 应带 .lnk 计数");
  // idx 行内是 <a>（真实站点用链接而非 demo 的 button），计数右挂 .n
  assert.match(html, /<div class="idx">\s*<a[^>]*class="idx-row/s, ".idx 内应是 idx-row <a> 行");
  assert.match(html, /class="idx-row on"/, "当前集子行应有 on 选中态");
  // 侧栏集子块不列主集子「日常」（2026-10-16 用户拍板）：它是兜底归属，不是浏览入口；
  // /collection/all/ 页面本身保留（tag 页与集子页的 .r 胶囊仍显示集子名）
  assert.ok(!/>日常<\/span><span class="n">/.test(html), "侧栏集子块不得列出「日常」");
  // # 带空格
  assert.match(html, /<span># PhD V2\.0 P1\.1<\/span><span class="n">/, "标签 idx 行应写「# 名称」（span 包裹 + 计数右挂）");
});

test("集子·标签页标题区：res-head（h2 衬线集子名 + .cnt 事件思考分计 + .hint），无 dateline/页面级大标题（夜·十④）", () => {
  const html = readFileSync(join(OUT, "collection/phd-thesis/index.html"), "utf8");
  assert.ok(!html.includes('class="dateline"'), "本页不用今日页 .dateline 款");
  assert.match(html, /<div class="res-head">\s*<h2>博士学位论文<\/h2>/s, "res-head h2 = 集子显示名");
  const counts = html.match(/<span class="cnt">(\d+) 条 · 事件 (\d+) \/ 思考 (\d+)<\/span>/);
  assert.ok(counts, ".cnt = N 条 · 事件 X / 思考 Y");
  assert.equal(Number(counts[1]), Number(counts[2]) + Number(counts[3]), "事件与思考合计应等于总数");
  assert.equal(Number(counts[1]), (html.match(/class="resrow"/g) || []).length, "总数应等于实际条目行数");
  assert.match(html, /<span class="hint">集子 · 一对一 · 按日期倒序<\/span>/, ".hint 提示归属与排序");
  assert.ok(!html.includes("Index</em>"), "不加页面级大标题与 em Index");
  assert.ok(!html.includes("taxonomy.yml"), "不保留 taxonomy 登记说明文");
  // tag 页同构
  const tagHtml = readFileSync(join(OUT, "tag/phd-v2-0-p1-1/index.html"), "utf8");
  assert.match(tagHtml, /<div class="res-head">\s*<h2># PhD V2\.0 P1\.1<\/h2>/s, "tag 页 res-head h2 = # 显示名");
  assert.match(tagHtml, /<span class="hint">tag · 多对多 · 按日期倒序<\/span>/, "tag 页 hint");
  // CSS：h2 走衬线（g1 字体分工），idx 选中态有样式（防浏览器默认蓝回归）
  const css = readFileSync(join(OUT, "assets/style.css"), "utf8");
  assert.match(css, /\.res-head h2\{[^}]*font-family:var\(--serif\)/);
  assert.match(css, /\.idx-row\.on\{[^}]*color:var\(--accent\)/, "idx 选中态必须落 CSS（曾因无样式落到浏览器默认蓝）");
});



test("条目页 URL 含日期前缀（设计文档 §5.1）", () => {
  assert.ok(existsSync(join(OUT, "entry/2026-10-16-codex-pro/index.html")));
});

test("条目页渲染出了 Markdown（<p> 等）", () => {
  const html = readFileSync(join(OUT, "entry/2026-10-16-codex-pro/index.html"), "utf8");
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
    "month/2026-10/", "today/",
    "collection/all/",
    "stats/",
  ].map((p) => `/ctz-bujo-share/${p}`);
  const CASES = [
    ["today/index.html", "/ctz-bujo-share/today/"],
    ["month/2026-10/index.html", "/ctz-bujo-share/month/2026-10/"],
    ["collection/all/index.html", "/ctz-bujo-share/collection/all/"],
    ["tag/running/index.html", "/ctz-bujo-share/collection/all/"],
    ["stats/index.html", "/ctz-bujo-share/stats/"],
    ["day/2026-10-15/index.html", "/ctz-bujo-share/today/"],
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
  const entryHtml = readFileSync(join(OUT, "entry/2026-10-16-codex-pro/index.html"), "utf8");
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
// mini-cell 格子、统计块「本月 N」副行、当日小结 .lbl/.h2、.top-row 条目头、空状态文案。
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

test("今日页「当日小结」用 .lbl 朱红标签 + 衬线 h2（§5.3）", () => {
  const html = readFileSync(join(OUT, "day/2026-10-15/index.html"), "utf8");
  // 模板带缩进换行，断言行内顺序而非跨行拼接
  assert.match(html, /<aside class="pull">\s*<b class="lbl">当日小结<\/b>\s*<h2>/);
  assert.match(html, /<h2>读综述论文/);
  const css = readFileSync(join(OUT, "assets/style.css"), "utf8");
  assert.match(css, /\.pull \.lbl\{[^}]*color:var\(--accent\)/);
});

test("今日页侧栏是 .blk 块结构 + 小月历不标记今天（§5.3）", () => {
  const html = readFileSync(join(OUT, "day/2026-10-15/index.html"), "utf8");
  assert.match(html, /<div class="blk">/);
  assert.match(html, /<h3>小月历<\/h3>/);
  assert.match(html, /<h3>统计<\/h3>/);
  assert.match(html, /月视图 →/);
  assert.match(html, /查看统计 →/);
  // 图例只保留「今天」一枚灰方块样本
  assert.ok(!html.includes('class="mini-foot"'));
  assert.ok(!/class="mini-cell [^"]*\btoday\b/.test(html));
  assert.ok(!html.includes("有记录</span>"), "demo 的「有记录」图例不恢复");
  assert.ok(!html.includes("含重点</span>"), "demo 的「含重点」图例不恢复");
});

test("小月历格子样式选择器是 .mini-grid a（button/a 失配防复发，§5.3）", () => {
  const css = readFileSync(join(OUT, "assets/style.css"), "utf8");
  // 旧缺陷：模板用 <a class="mini-cell">，CSS 全写 .mini-grid button → 0 条规则生效
  assert.match(css, /\.mini-grid a\{[^}]*height:26px/);
  assert.match(css, /\.mini-grid a\.hl \.ul\{[^}]*var\(--accent\)/);
  assert.match(css, /\.mini-grid a\.sel\{[^}]*border-color:var\(--ink\)/);
  assert.ok(!css.includes(".mini-grid a.today"));
  assert.ok(!css.match(/\.mini-grid button\{/), "button 选择器不得残留（模板无 button）");
});

test("统计块参照 demo .stat-pair：口径=事件/思考 + 分色（事件墨 / 思考蓝灰）+「本月 N」副行（§5.3 + 夜·十一②）", () => {
  const html = readFileSync(join(OUT, "day/2026-10-15/index.html"), "utf8");
  // 夜·十一②：口径从「条目/日总结」改为「事件/思考」，大数字分色（取代夜·八「一律墨色」旧约）
  assert.match(html, /<span class="n ev">\d+<\/span><span class="l">事件<\/span><span class="s">本月 \d+<\/span>/);
  assert.match(html, /<span class="n th">\d+<\/span><span class="l">思考<\/span><span class="s">本月 \d+<\/span>/);
  const css = readFileSync(join(OUT, "assets/style.css"), "utf8");
  // 分色落 CSS：ev=墨、th=蓝灰；朱红不得用于 stat-pair 数字
  assert.match(css, /\.stat-pair \.p \.n\.ev\{[^}]*var\(--ink\)/);
  assert.match(css, /\.stat-pair \.p \.n\.th\{[^}]*var\(--blue\)/);
  assert.ok(!css.match(/\.stat-pair \.p \.n[^.{]*accent/), "stat-pair 大数字不得用朱红");
});

test("空状态是单行「这里是空的。」（§5.3 拍板文案）", () => {
  // 今日默认最近有内容日；空态直接验证无记录的日页。
  const html = readFileSync(join(OUT, "day/2026-10-01/index.html"), "utf8");
  assert.match(html, /<div class="empty">这里是空的。<\/div>/);
  // demo 两段引导不恢复
  assert.ok(!html.includes("这天没有条目"));
  assert.ok(!html.includes("还没有记录"));
});

// ===== 统计页 g1 基线对齐 + 新配色（2026-10-16 夜·十一拍板）=====
// 拍板：①类名失配全修（模板回 demo 原名 .l/.d/.nm/.seg 结构，h3 与 .sub 拆开）；
// ②新配色：事件=墨黑（--ink）、思考=蓝灰（--blue），取代「事件/思考不分色」旧约——
//   只用于统计页横条图 + 今日页统计块大数字；朱红仍只给重点/选中态；
// ③KPI 副行恢复（日总结卡=窗口标签、有记录天数卡=共 N 条条目）；
// ④页头大标题与窗口标签间距拉大；⑤页脚 note 不恢复；⑥趋势月窗口轴标签改日号；
// ⑦排行行比较（2026-10-17 改为有符号条数差值）；⑧今日页 stat-pair 口径改事件/思考。

test("统计页类名对齐 demo 原名：.l/.d/.nm/.seg，野生类 .k/.delta/.win-nav/.name 不得残留（夜·十一①）", () => {
  const html = readFileSync(join(OUT, "stats/index.html"), "utf8");
  // KPI 标签用 .l（CSS 既有规则 .kpi .l），环比用 .d（.kpi .d.up 朱红）
  assert.match(html, /<span class="l">事件<\/span>/, "KPI 标签应是 .l");
  assert.match(html, /<span class="d up">/, "KPI 差值应是 .d.up（增加）");
  assert.ok(!html.includes('class="k"') && !html.includes('class="delta"'), "野生类 .k/.delta 不得残留");
  // 排行行名字用 .nm
  assert.match(html, /<span class="nm">/, "排行行名字应是 .nm");
  assert.ok(!html.includes('class="name"'), "野生类 .name 不得残留");
  // 窗口切换器 = demo .seg 分段控件（链接语义 + .on 黑底）
  assert.match(html, /<div class="seg"[\s>]/, "窗口切换器应是 .seg 容器");
  assert.match(html, /<a[^>]*class="on"[^>]*>本月<\/a>/, "本月按钮应有 .on 选中态");
  assert.ok(!html.includes("win-nav"), "野生类 .win-nav 不得残留");
  // 卡片标题 h3 与说明 .sub 拆开（此前 h3 class="sub" 把标题塞进说明类）
  assert.match(html, /<h3>按集子<\/h3>/, "卡片标题应是裸 h3（衬线 17px）");
  assert.match(html, /<div class="sub">[^<]{6,}<\/div>/, "每卡应有 .sub 说明行");
  // CSS 端核对：.seg a.on 黑底反白规则存在
  const css = readFileSync(join(OUT, "assets/style.css"), "utf8");
  assert.match(css, /\.seg a\.on\{[^}]*background:var\(--ink\)/, ".seg 选中态应黑底反白");
});

test("统计页与今日页新配色：事件=墨黑、思考=蓝灰（夜·十一②）", () => {
  const css = readFileSync(join(OUT, "assets/style.css"), "utf8");
  // 蓝灰变量落 CSS（具体色值 = demo 趋势事件线 #1b3a5c 一族，克制、非高饱和）
  assert.match(css, /--blue:\s*#[0-9a-fA-F]{6}/, "应新增 --blue 变量");
  // 排行堆叠条：ev=墨黑、th=蓝灰（demo 的 i.th 朱红被取代——朱红只给重点/选中）
  const ev = css.match(/\.rank-row \.stack i\.ev\{[^}]*\}/);
  const th = css.match(/\.rank-row \.stack i\.th\{[^}]*\}/);
  assert.ok(ev && /var\(--ink\)/.test(ev[0]), `i.ev 应墨黑：${ev && ev[0]}`);
  assert.ok(th && /var\(--blue\)/.test(th[0]), `i.th 应蓝灰：${th && th[0]}`);
  // 朱红不得再出现在事件/思考分色上
  const thAccent = css.match(/\.rank-row \.stack i\.th\{[^}]*accent/);
  assert.ok(!thAccent, "i.th 不得用朱红（朱红只给重点/选中态）");
  // 今日页统计块：口径改事件/思考，大数字分色（事件墨 / 思考蓝灰）
  const html = readFileSync(join(OUT, "day/2026-10-15/index.html"), "utf8");
  assert.match(html, /<span class="n ev">\d+<\/span><span class="l">事件<\/span>/, "今日页第一格 = 事件（.n.ev）");
  assert.match(html, /<span class="n th">\d+<\/span><span class="l">思考<\/span>/, "今日页第二格 = 思考（.n.th）");
  assert.ok(!html.includes("<span class=\"l\">条目</span>"), "「条目」口径退场");
  const nEv = css.match(/\.stat-pair \.p \.n\.ev\{[^}]*\}/);
  const nTh = css.match(/\.stat-pair \.p \.n\.th\{[^}]*\}/);
  assert.ok(nEv && /var\(--ink\)/.test(nEv[0]), `.stat-pair .n.ev 应墨黑：${nEv && nEv[0]}`);
  assert.ok(nTh && /var\(--blue\)/.test(nTh[0]), `.stat-pair .n.th 应蓝灰：${nTh && nTh[0]}`);
});

test("KPI 副行恢复：日总结卡=窗口标签、有记录天数卡=共 N 条条目（夜·十一③）", () => {
  const html = readFileSync(join(OUT, "stats/index.html"), "utf8");
  // 月窗口标签 = 「2026 年 10 月」
  assert.match(html, /<span class="l">日总结<\/span><span class="d">[^<]+月<\/span>/, "日总结卡应有窗口标签副行");
  assert.match(html, /<span class="l">有记录天数<\/span><span class="d">共 \d+ 条条目<\/span>/, "有记录天数卡应有共 N 条副行");
});

test("页头大标题与窗口标签间距拉大（夜·十一④）", () => {
  const css = readFileSync(join(OUT, "assets/style.css"), "utf8");
  const m = css.match(/\.head h1 em\{[^}]*\}/);
  assert.ok(m, ".head h1 em 规则应存在");
  assert.match(m[0], /margin-bottom:\s*(1[2-9]|2\d)px/, `em 下边距应 ≥12px（现状 6px 太贴）：${m[0]}`);
});

test("趋势图真实渲染：数据点 + 月窗口轴标签改日号（10-01 → 1，夜·十一⑥）", () => {
  const html = readFileSync(join(OUT, "stats/index.html"), "utf8");
  const svg = html.match(/<svg[^>]*aria-label="趋势折线图"[\s\S]*?<\/svg>/);
  assert.ok(svg, "应有趋势 SVG");
  const texts = svg[0].match(/<text[^>]*>[^<]*<\/text>/g) || [];
  // 旧缺陷：stats.njk include 时从未传 pts，趋势图只画空 path + 4 个 y 轴刻度（线上恒空壳）
  assert.ok(texts.length > 6, `SVG 文本应 >6 个（x 轴标签 + y 轴刻度），实际 ${texts.length}`);
  assert.ok(!texts.some((t) => />10-01</.test(t)), "月窗口不得再标完整月-日");
  assert.ok(texts.some((t) => />1<\/text>/.test(t)), "应出现日号「1」");
  assert.ok(texts.some((t) => />1[05]</.test(t) || />20</.test(t) || />25</.test(t) || />10</.test(t)), "应有 5/10/15… 日号标签");
});

test("排行行环比徽标使用有符号条数差值", () => {
  const html = readFileSync(join(OUT, "stats/index.html"), "utf8");
  // 本月有值、上月为空，也显示具体增加条数。
  assert.match(html, /<span class="v"><span class="rank-total">\d+<\/span><span class="up"><span class="delta-value" aria-label="▲ \+\d+ 条">/, "排行行 v 内应有条数差值");
  // 顺带核对本轮拍板⑧：今日页 stat-pair 的「本月 N」副行保留
  const dayHtml = readFileSync(join(OUT, "day/2026-10-15/index.html"), "utf8");
  assert.match(dayHtml, /<span class="s">本月 \d+<\/span>/, "今日页 stat-pair 副行应保留");
  const css = readFileSync(join(OUT, "assets/style.css"), "utf8");
  assert.match(css, /\.rank-row \.v \.up\{/, ".up 差值样式应存在");
});

test("页脚 note 不恢复（夜·十一⑤）", () => {
  const html = readFileSync(join(OUT, "stats/index.html"), "utf8");
  assert.ok(!html.includes("footer"), "统计页不得有 footer note");
});

// 「当日小结」正文段间距 > 行间距（2026-10-16 用户拍板，取代 demo 原款 margin:0）：
// 段间 +10px（≈0.7 行），比条目卡片（.entry .excerpt，拍板为段距 0）松，段落分隔感更清楚。
test("当日小结正文段间距大于行间距（.pull p margin-top:10px，§5.3 补拍板）", () => {
  const css = readFileSync(join(OUT, "assets/style.css"), "utf8");
  const m = css.match(/\.pull p\{[^}]*\}/);
  assert.ok(m, "style.css 应有 .pull p 规则");
  assert.match(m[0], /margin:10px 0 0/, `.pull p 应有 10px 顶边距（段距>行距拍板）：${m[0]}`);
  // 条目卡片摘要保持段距 0（2026-10-15 拍板），两者口径不同是有意的
  const ex = css.match(/\.entry \.excerpt p\{[^}]*\}/);
  assert.ok(ex && /margin:0/.test(ex[0]), `.entry .excerpt p 应保持 margin:0：${ex && ex[0]}`);
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

test('统计页恢复 demo 结构：KPI 后切窗口，趋势在同一网格内', () => {
  const html = readFileSync(join(OUT, 'stats/index.html'), 'utf8');
  assert.ok(html.indexOf('class="kpis"') < html.indexOf('class="seg"'));
  assert.match(html, /<\/section>\s*<section class="card full">/);
  assert.match(html, /<a[^>]*href="[^"]*\/stats\/year\/"[^>]*>本年<\/a>/);
});
test('KPI 三层文字独立成行，蓝灰与墨黑明度差异足够', () => {
  const css = readFileSync(join(OUT, 'assets/style.css'), 'utf8');
  assert.match(css, /\.kpi > span\{display:block\}/);
  const color = key => css.match(new RegExp('--'+key+':\\s*#([0-9a-f]{6})'))[1];
  const lum = hex => hex.match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((a,x,i)=>a+x*[.2126,.7152,.0722][i],0);
  assert.ok((lum(color('blue'))+.05)/(lum(color('ink'))+.05) >= 3, '两系列明度对比至少 3:1');
});

test('统计页窗口标签在标题下方留出 16px', () => {
 const css=readFileSync(join(OUT,'assets/style.css'),'utf8');
 assert.match(css, /\.stats-page \.head h1 em\{margin:16px 0 0\}/);
 });

test('统计三角与文字分别排版并按行中心对齐', () => {
  const html=readFileSync(join(OUT,'stats/index.html'),'utf8');
  assert.match(html, /class="delta-value" aria-label="▲ \+\d+ 条"><svg[^>]*aria-hidden="true"/);
  const css=readFileSync(join(OUT,'assets/style.css'),'utf8');
  assert.match(css, /\.delta-value\{[^}]*display:inline-flex;[^}]*align-items:center/);
});

test('排行总数与差值作为同一居中行排列', () => {
  const html=readFileSync(join(OUT,'stats/index.html'),'utf8');
  assert.match(html, /class="v"><span class="rank-total">\d+<\/span>/);
  const css=readFileSync(join(OUT,'assets/style.css'),'utf8');
  assert.match(css, /\.rank-row \.v\{display:flex;align-items:center;justify-content:flex-end;gap:/);
});

test("条目详情使用明信片，日期在标题上方且分类置于正文后", () => {
  const html = readFileSync(join(OUT, "entry/2026-10-16-codex-pro/index.html"), "utf8");
  assert.match(html, /class="entry-page postcard"/);
  assert.ok(html.indexOf('class="postcard-date"') < html.indexOf('<h1>'));
  assert.ok(html.indexOf('class="entry-body"') < html.indexOf('class="postcard-foot"'));
  assert.match(html, /破防了，ctz-bujo-share/);
  assert.match(html, /暂时不考虑放在Z8.0里。/);
});


test('独立首页与今日分离，品牌返回首页，首页不选中四屏',()=>{
  const html=readFileSync(join(OUT,'index.html'),'utf8');
  const today=readFileSync(join(OUT,'today/index.html'),'utf8');
  for(const heading of ['随手翻翻','最近在做','关注的内容']) assert.ok(html.includes(heading));
  assert.match(html, /href="\/ctz-bujo-share\/today\/"/);
  assert.match(today, /<a class="brand" href="\/ctz-bujo-share\/"/);
  assert.match(today, /class="dateline"/);
  const nav=html.match(/<nav class="nav tabbar"[\s\S]*?<\/nav>/)[0];
  assert.equal((nav.match(/<a /g)||[]).length,4);
  assert.doesNotMatch(nav,/class="on"/);
  assert.match(html,/type="module" src="\/ctz-bujo-share\/assets\/home.js"/);
  assert.doesNotMatch(html,/(href|src)="\/(?!\/|ctz-bujo-share)/);
});

test('首页摘要不会破坏 template 与事件结构',()=>{
 const html=readFileSync(join(OUT,'index.html'),'utf8');
 if (html.includes('<template>')) assert.match(html,/<template>\s*<article class="landing-thought">[\s\S]*?<\/article>\s*<\/template>/);
 else assert.match(html, /id="thought-list"[^>]*>\s*<p class="empty">这里是空的。<\/p>/);
 assert.doesNotMatch(html,/<p class="landing-event-excerpt">\s*<article/);
});

test('首页主标题使用用户指定文案',()=>{
 const html=readFileSync(join(OUT,'index.html'),'utf8');
 assert.match(html,/<h1>沙楚子的存在证明<\/h1>/);
 assert.match(html,/<p class="landing-description">——记一个研究型设计师的成长之路！<\/p>/);
 assert.ok(!html.includes("一些发生的事，一些慢慢想明白的事。"));
});

test('月历与小月历的所有日期链接都有日页，空日不返回 404', () => {
  for (const page of ['month/2026-10/index.html', 'today/index.html']) {
    const html = readFileSync(join(OUT, page), 'utf8');
    const dates = [...html.matchAll(/href="\/ctz-bujo-share\/day\/(\d{4}-\d{2}-\d{2})\//g)].map(m => m[1]);
    assert.ok(dates.length >= 28);
    for (const date of dates) assert.ok(existsSync(join(OUT, `day/${date}/index.html`)), `${page} 的 ${date} 链接没有生成日页`);
  }
  const empty = readFileSync(join(OUT, 'day/2026-10-01/index.html'), 'utf8');
  assert.match(empty, /这里是空的。/);
  assert.match(empty, /2026 年 10 月 1 日/);
});


test('健身与 codex pro 为手动重点：首页只显示重点，普通记录仍在日页',()=>{
  const home=readFileSync(join(OUT,'index.html'),'utf8');
  const events=[...home.matchAll(/<article class="landing-event">([\s\S]*?)<\/article>/g)];
  const { entries } = loadContent(process.cwd());
  const expected = entries.filter(e => e.type === 'event' && e.highlight)
    .sort((a,b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug)).slice(0,5);
  assert.equal(events.length, expected.length);
  events.forEach((event, index) => assert.ok(event[1].includes(`/entry/${expected[index].slug}/`)));
  assert.match(home,/一分化·全身B/);assert.match(home,/充了个codex pro/);
  const workout=readFileSync(join(OUT,'entry/2026-10-17-workout-fullbody-b/index.html'),'utf8');
  assert.match(workout,/class="tag hl">重点/);
  assert.doesNotMatch(home,/晚餐：辣椒炒肉|早餐：星巴克/);
  const entry=readFileSync(join(OUT,'entry/2026-10-16-codex-pro/index.html'),'utf8');
  assert.match(entry,/class="tag hl">重点/);
  const day=readFileSync(join(OUT,'day/2026-10-16/index.html'),'utf8');assert.match(day,/晚餐：辣椒炒肉/);
});


test('14 日示例条目已删除，首页起始随真实记录日更新（2026-10-17 补录 10-14 真实内容后始于 10-14）',()=>{
  assert.equal(existsSync('content/entries/2026-10-14-example.md'),false);
  // 2026-10-17 用户补写真实 10-14 日总结（「想读论文 → 分享日记」）：无日总结的旧断言作废，
  // 守卫改为「示例日总结标题不得回归」
  const daily14 = existsSync('content/daily/2026-10-14.md') ? readFileSync('content/daily/2026-10-14.md','utf8') : '';
  assert.doesNotMatch(daily14,/示例|占位/);
  assert.equal(existsSync(join(OUT,'entry/2026-10-14-example/index.html')),false);
  const home=readFileSync(join(OUT,'index.html'),'utf8');
  // 「始于」随真实最早记录日移动（补录历史后 → 2026-10-13）；守卫的本意是示例数据不得回归，
  // 所以断言 = 起始日期 ≤ 真实最早日 且不等于示例日 2026-10-14-example 的旧演示日期。
  const m = home.match(/始于 <time>(\d{4}-\d{2}-\d{2})<\/time>/);
  assert.ok(m, '首页应有「始于 <time>」记录起止');
  assert.ok(m[1] <= '2026-10-13', `起始日期应为真实最早记录日 2026-10-13（或更早），实际 ${m[1]}`);
  const day=readFileSync(join(OUT,'day/2026-10-14/index.html'),'utf8');
  // 当日不再是空态，且渲染的是真实条目（示例条目文案不得回归）
  assert.doesNotMatch(day,/这里是空的。/);
  assert.doesNotMatch(day,/把时间轴画成了图|把想法画成图，一下清楚了/);
  assert.match(day,/早餐：麦当劳/);
  assert.match(day,/抛砖引玉/);
  // 标题卫生（2026-10-17 拍板）：「思考：」「（重点）」是录入时的类型/重点信号，不是标题文字；
  // 用户「A → B」式输入表示标题应更新为 B（箭头是替换指令，不是标题原文）。
  // 日页条目标题结构 = .entry .top-row h4>a（h1 是日期，不是条目标题）
  const titles = [...day.matchAll(/<h4><a[^>]*>([^<]*)<\/a><\/h4>/g)].map((m) => m[1]);
  assert.ok(titles.some((t) => t.includes('论文问题是否真实存在')), `规则分歧条目标题应为「论文问题是否真实存在」，实际 titles=${JSON.stringify(titles)}`);
  assert.ok(titles.every((t) => !t.startsWith('思考：') && !t.includes('（重点）')), `任何条目标题不得带「思考：」前缀或「（重点）」后缀，实际 titles=${JSON.stringify(titles)}`);
});

test('早餐条目仅保留通用店名，去除可定位的分店信息且链接不变',()=>{
  const html=readFileSync(join(OUT,'entry/2026-10-15-breakfast-mcdonalds/index.html'),'utf8');
  assert.match(html,/<h1>🥪 早餐：麦当劳<\/h1>/);
  assert.match(html,/带了自己做的拿铁/);
  const day=readFileSync(join(OUT,'day/2026-10-15/index.html'),'utf8');
  assert.match(day,/>🥪 早餐：麦当劳<\/a>/);
});

 test('近日入口文案与分享同步，保留 today URL', () => {
  const html = readFileSync(join(OUT, 'today/index.html'), 'utf8');
  assert.match(html, /<title>近日/);
  assert.match(html, /href="[^" ]*\/today\/"[^>]*>近日<\/a>/);
  assert.match(html, /分享近日/);
  assert.match(html, /返回近日/);
  assert.ok(!html.includes('今天</div>'));
});


test('10 月 17 日历史小结完整保留三段正文且与条目独立',()=>{
  const day=readFileSync(join(OUT,'day/2026-10-17/index.html'),'utf8');
  assert.match(day,/导师横向PPT &amp; 素描塑造理论05|导师横向PPT & 素描塑造理论05/);
  const pull=day.match(/<aside class="pull">([\s\S]*?)<\/aside>/)?.[1];assert.ok(pull);
  assert.equal((pull.match(/<p>/g)||[]).length,3);
  assert.match(pull,/mac上只放正在跑的项目。/);
  assert.match(pull,/遂提了个issue结束。/);
  assert.match(pull,/需要慢慢平静下来。/);
  const { dailies } = loadContent(process.cwd());
  const daily = dailies.find(d => d.date === '2026-10-17');
  assert.equal(daily.title, '导师横向PPT & 素描塑造理论05');
  assert.match(daily.body, /需要慢慢平静下来。/);
});


test('10 月 17 日历史事件按输入顺序录入，正文和分类完整保留',()=>{
  const html=readFileSync(join(OUT,'day/2026-10-17/index.html'),'utf8');
  const titles=[...html.matchAll(/<h4><a[^>]*>([^<]*)<\/a><\/h4>/g)].map(m=>m[1]);
  assert.deepEqual(titles,['🥪 早餐：麦当劳（外卖）','🧰 导师横向PPT','💪 一分化·全身B','🍚 晚餐：秋葵炒肉+螺狮粉','🎨 模特徐素描塑造：理论课05（衣褶）']);
  const { entriesByDate } = loadContent(process.cwd());
  const data = [{kind:'daily'}, ...entriesByDate['2026-10-17'].map(e => ({
    ...e, kind:e.type, collection:e.collectionName,
    html:readFileSync(join(OUT, 'entry', e.slug, 'index.html'), 'utf8')
  }))];
  assert.equal(data.length,6);assert.ok(data.slice(1).every(x=>x.kind==='event'));
  assert.match(data[1].html,/吃了猪柳炒双蛋堡和奶铁/);
  assert.match(data[2].html,/和更新同门发来的PPT/);
  assert.match(data[3].html,/这让我很触动，好像忽然找到了做好设计的意义。/);
  assert.match(data[3].html,/而在不关心的领域更多地放弃。/);
  assert.match(data[4].html,/世界依旧是一个巨大的草台班子。/);
  assert.match(data[5].html,/晚上抓紧补上了这节课。/);
  assert.deepEqual(data[3].tags,['一分化','播客']);
  assert.deepEqual(data[4].tags,['视频']);
  assert.equal(data[5].collection,'绘画');
  assert.deepEqual(data[5].tags,['模特徐素描塑造']);
  const tag=readFileSync(join(OUT,'tag/motexu-sketch/index.html'),'utf8');
  assert.match(tag,/模特徐素描塑造/);assert.match(tag,/理论课05（衣褶）/);
});

test('导师横向标签使用用户确认的商业项目 slug，并关联 10 月 17 日 PPT 条目',()=>{
  const tag=readFileSync(join(OUT,'tag/supervisor-commercial-project/index.html'),'utf8');
  assert.match(tag,/# 导师横向/);
  assert.match(tag,/entry\/2026-10-17-advisor-ppt\//);
  const entry=readFileSync(join(OUT,'entry/2026-10-17-advisor-ppt/index.html'),'utf8');
  assert.match(entry,/href="\/ctz-bujo-share\/tag\/supervisor-commercial-project\/"[^>]*># 导师横向<\/a>/);
  const { entries } = loadContent(process.cwd());
  assert.deepEqual(entries.find(e=>e.slug==='2026-10-17-advisor-ppt').tags,['导师横向']);
});

test('首页重点事件和思考显示与详情一致的完整 Markdown 正文，不再按字数截断',()=>{
  const home=readFileSync(join(OUT,'index.html'),'utf8');
  const events=[...home.matchAll(/<article class="landing-event">([\s\S]*?)<\/article>/g)];
  const thoughts=[...home.matchAll(/<article class="landing-thought">([\s\S]*?)<\/article>/g)];
  assert.ok(events.length>0);assert.ok(thoughts.length>0);
  for(const [,article] of [...events,...thoughts]) {
    const slug=article.match(/href="[^" ]*\/entry\/([^/]+)\//)?.[1];assert.ok(slug);
    const detail=readFileSync(join(OUT,`entry/${slug}/index.html`),'utf8');
    const full=detail.match(/<div class="entry-body">([\s\S]*?)<\/div>/)?.[1].trim();
    const body=article.match(/<div class="landing-(?:event-)?excerpt">([\s\S]*?)<\/div>/)?.[1].trim();
    assert.equal(body,full,slug+' 首页正文必须与详情全文一致');
  }
  const pool=home.match(/<div id="thought-pool" hidden>([\s\S]*?)<\/div>\s*<\/section>/)?.[1];assert.ok(pool);
  const templates=[...pool.matchAll(/<template>([\s\S]*?)<\/template>/g)];assert.ok(templates.length);
  for(const [,template]of templates)assert.equal((template.match(/<article class="landing-thought">/g)||[]).length,1,'每个随机候选只含一条思考');
  const fallback=home.match(/id="thought-list"[^>]*>([\s\S]*?)<\/div>\s*<div id="thought-pool"/)?.[1];assert.ok(fallback);
  assert.equal((fallback.match(/<article class="landing-thought">/g)||[]).length,Math.min(3,templates.length),'无 JS 首屏也须保留完整候选');
  assert.match(home,/<p>听了两个播客：<\/p>/);
  assert.match(home,/而在不关心的领域更多地放弃。/);
});

 test("用户修正的中文引号在首页与详情页原样保留", () => {
  for (const path of ["index.html", "entry/2026-10-14-external-drive-brick/index.html"]) {
    const html = readFileSync(join(OUT, path), "utf8");
    assert.ok(html.includes("抛砖引玉的“砖”对我而言竟如此重要！"), path);
    assert.ok(!html.includes('抛砖引玉的&quot;砖&quot;对我而言竟如此重要！'), path);
  }
});

test("10月18日日总结与五条事件按输入顺序呈现，保留正文标点与清单", () => {
  const html = readFileSync(join(OUT, "day/2026-10-18/index.html"), "utf8");
  assert.ok(html.includes("文件整理DAY1"));
  assert.ok(html.includes("完成了同步空间00-02整体的思路和初步的清理，下一步是一一核对。"));
  const titles = ["🥪 早餐：麦当劳", "🧩 日记分享", "💾 文件整理", "🏃‍♀️ 室内跑步·3km", "🍚 蔡澜"];
  const positions = titles.map(title => html.indexOf(title));
  assert.ok(positions.every(position => position >= 0));
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
  assert.ok(html.includes("（跑步伴奏：嗨咻 003.在婚姻中追求爱情的我，傻么？）"));
  assert.ok(html.includes("<li>笔记本（新）</li>"));
  assert.ok(html.includes("<li>笔记本（旧）</li>"));
});

test("10月18日跑步记录关联用户确认的跑步与播客标签", () => {
  const { entries } = loadContent(process.cwd());
  const entry = entries.find(e => e.slug === "2026-10-18-indoor-running-3km");
  assert.deepEqual(entry.tags, ["跑步", "播客"]);
  for (const slug of ["running", "podcast"]) {
    const html = readFileSync(join(OUT, "tag", slug, "index.html"), "utf8");
    assert.ok(html.includes("/entry/2026-10-18-indoor-running-3km/"), slug);
  }
});

test("10月18日文件整理与室内跑步为重点并在首页显示全文", () => {
  const { entries } = loadContent(process.cwd());
  const home = readFileSync(join(OUT, "index.html"), "utf8");
  for (const slug of ["2026-10-18-file-organization", "2026-10-18-indoor-running-3km"]) {
    const entry = entries.find(e => e.slug === slug);
    assert.equal(entry.highlight, true, slug);
    assert.ok(home.includes(`/entry/${slug}/`), slug);
  }
  assert.ok(home.includes("<li>笔记本（旧）</li>"));
  assert.ok(home.includes("（跑步伴奏：嗨咻 003.在婚姻中追求爱情的我，傻么？）"));
});

test("10月14日两条灯泡记录按用户的emoji默认规则归为事件", () => {
  const { entries } = loadContent(process.cwd());
  for (const slug of ["2026-10-14-ctz-bujo-share-idea", "2026-10-14-thesis-daily-card"]) {
    const entry = entries.find(e => e.slug === slug);
    assert.equal(entry.type, "event", slug);
    assert.ok(entry.title.startsWith("💡 "), slug);
    const html = readFileSync(join(OUT, "entry", slug, "index.html"), "utf8");
    assert.match(html, /class="tag type">事件/);
  }
});
