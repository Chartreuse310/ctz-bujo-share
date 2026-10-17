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
  assert.match(html, /<span class="cnt">2 条 · 事件 \d+ \/ 思考 \d+<\/span>/, ".cnt = N 条 · 事件 X / 思考 Y");
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

test("集子·标签页空态：单行提示性文案（夜·十⑤，非 demo 两段式）", () => {
  const html = readFileSync(join(OUT, "collection/drawing/index.html"), "utf8");
  assert.match(html, /<div class="list-empty">绘画还没有条目。登记了的集子\/tag 都会生成页面，只是列表为空。<\/div>/);
  assert.ok(!html.includes("这里还没有条目"), "demo 两段式首句不得回归");
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
  // 空状态落在首页（今日 = 2026-10-16 无条目）与未来日期不生成日页——用首页验证
  const html = readFileSync(join(OUT, "index.html"), "utf8");
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
// ⑦排行行环比徽标（↑x% / = / 新增）；⑧今日页 stat-pair 口径改事件/思考。

test("统计页类名对齐 demo 原名：.l/.d/.nm/.seg，野生类 .k/.delta/.win-nav/.name 不得残留（夜·十一①）", () => {
  const html = readFileSync(join(OUT, "stats/index.html"), "utf8");
  // KPI 标签用 .l（CSS 既有规则 .kpi .l），环比用 .d（.kpi .d.up 朱红）
  assert.match(html, /<span class="l">事件<\/span>/, "KPI 标签应是 .l");
  assert.match(html, /<span class="d up">/, "KPI 环比应是 .d.up（新增）");
  assert.ok(!html.includes('class="k"') && !html.includes('class="delta'), "野生类 .k/.delta 不得残留");
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
  const svg = html.match(/<svg[\s\S]*?<\/svg>/);
  assert.ok(svg, "应有趋势 SVG");
  const texts = svg[0].match(/<text[^>]*>[^<]*<\/text>/g) || [];
  // 旧缺陷：stats.njk include 时从未传 pts，趋势图只画空 path + 4 个 y 轴刻度（线上恒空壳）
  assert.ok(texts.length > 6, `SVG 文本应 >6 个（x 轴标签 + y 轴刻度），实际 ${texts.length}`);
  assert.ok(!texts.some((t) => />10-01</.test(t)), "月窗口不得再标完整月-日");
  assert.ok(texts.some((t) => />1<\/text>/.test(t)), "应出现日号「1」");
  assert.ok(texts.some((t) => />1[05]</.test(t) || />20</.test(t) || />25</.test(t) || />10</.test(t)), "应有 5/10/15… 日号标签");
});

test("排行行环比徽标：↑x% / = / 新增（夜·十一⑦）", () => {
  const html = readFileSync(join(OUT, "stats/index.html"), "utf8");
  // 数据现状：本月有值、上月为空 → 全部「新增」；= / ↑% 逻辑由 withDelta 保证（lib 单测已覆盖）
  assert.match(html, /<span class="v">[^<]*<span class="nw">新增<\/span>/, "排行行 v 内应有 nw 徽标");
  // 顺带核对本轮拍板⑧：今日页 stat-pair 的「本月 N」副行保留
  const dayHtml = readFileSync(join(OUT, "day/2026-10-15/index.html"), "utf8");
  assert.match(dayHtml, /<span class="s">本月 \d+<\/span>/, "今日页 stat-pair 副行应保留");
  const css = readFileSync(join(OUT, "assets/style.css"), "utf8");
  assert.match(css, /\.rank-row \.v \.nw\{/, ".nw 徽标样式应存在");
});

test("页脚 note 不恢复（夜·十一⑤）", () => {
  const html = readFileSync(join(OUT, "stats/index.html"), "utf8");
  assert.ok(!html.includes("footer"), "统计页不得有 footer note");
});

// 「今日小结」正文段间距 > 行间距（2026-10-16 用户拍板，取代 demo 原款 margin:0）：
// 段间 +10px（≈0.7 行），比条目卡片（.entry .excerpt，拍板为段距 0）松，段落分隔感更清楚。
test("今日小结正文段间距大于行间距（.pull p margin-top:10px，§5.3 补拍板）", () => {
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
