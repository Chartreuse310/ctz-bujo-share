#!/usr/bin/env node
/**
 * 生成 UI demo 的三个新方向（D / E / F）。
 *
 * 复用 docs/ui-demos/b-swiss.html 的数据层与渲染逻辑（界面逻辑完全一致），
 * 只替换 CSS 与少量装饰性 DOM，从而产出「同界面逻辑、不同视觉」的对照 demo。
 *
 * 运行：node scripts/gen-ui-demos.mjs
 */
import {readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'docs/ui-demos/b-swiss.html'), 'utf8');

const dataBlock = src.slice(src.indexOf('const COLLECTIONS'), src.indexOf('\n', src.indexOf('const TODAY')) + 1);
// 逻辑块必须从「工具」段开始（WD/pad/parse/byDate/isHL/agg 等都在 state 之前），
// 只取到 </script> 之前，外面再由 shell() 包一层 <script>。
const logicBlock = src.slice(src.indexOf('const WD ='), src.indexOf('</script>'));

const OUT = join(root, 'docs/ui-demos');

/** 三个方向共用的 HTML 骨架 */
function shell({title, kicker, navOrder, body, css, dirbarActive, navPos = 'top'}) {
  const nav = navOrder
    .map(([id, label]) => `<button${id === 'home' ? ' class="on"' : ''} data-s="${id}">${label}</button>`)
    .join('\n      ');
  /* chrome = 页面外框：默认顶部栏（B/D/E/F）；navPos:'bottom' 时删除顶部栏，
     四屏导航改为底部居中浮动条，顶部 64px 全部还给内容（方向 G）。
     导航按钮仍挂在 .nav 容器内，go()/goBy() 的查询选择器不用改。 */
  const chrome = navPos === 'bottom'
    ? `<div class="mark brand">ctz<span>/</span>bujo</div>

<nav class="nav tabbar">
      ${nav}
    </nav>`
    : `<div class="top">
  <div class="top-inner">
    <div class="mark">ctz<span>/</span>bujo</div>
    <div class="kicker">${kicker}</div>
    <nav class="nav">
      ${nav}
    </nav>
  </div>
</div>`;
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<style>
${css}
</style>
</head>
<body>

${chrome}

${body}

<div class="dirbar">
  <span>UI 方向</span>
  <a href="a-analog.html">A 纸质</a>
  <a href="b-swiss.html">B 墨线</a>
  <a href="c-console.html">C 控制台</a>
  <a href="d-edit.html"${dirbarActive === 'd' ? ' class="on"' : ''}>D 编辑体</a>
  <a href="e-dotted.html"${dirbarActive === 'e' ? ' class="on"' : ''}>E 点阵</a>
  <a href="f-warm.html"${dirbarActive === 'f' ? ' class="on"' : ''}>F 暖纸</a>
  <a href="g-bottom.html"${dirbarActive === 'g' ? ' class="on"' : ''}>G 底栏</a>
</div>

<script>
${dataBlock}
${logicBlock}
</script>
</body>
</html>
`;
}

/** 四屏共用的 DOM 结构（与 b-swiss 完全一致，保证界面逻辑不变） */
const body = `<!-- ================= 01 首页 = 日页 + 侧栏 ================= -->
<section class="screen on" id="s-home">
  <div class="wrap">
    <div class="home">
      <main class="home-main" id="dayMain"></main>
      <aside class="side" id="sidePane"></aside>
    </div>
  </div>
</section>

<!-- ================= 02 月视图 ================= -->
<section class="screen" id="s-month">
  <div class="shell">
    <div class="month-top">
      <h1><em>Month</em><span id="monthTitle">2026 · 10</span></h1>
      <div class="facts" id="monthFacts"></div>
      <div class="pager">
        <button id="mPrev">← 上一月</button>
        <button id="mToday">回到本月</button>
        <button id="mNext">下一月 →</button>
      </div>
    </div>
    <div class="month-body">
      <div class="cal-pane">
        <div class="dow"><span>周一</span><span>周二</span><span>周三</span><span>周四</span><span>周五</span><span>周六</span><span>周日</span></div>
        <div class="matrix" id="matrix"></div>
        <div class="cal-foot">
          <span class="k"><i></i>重点日（highlight）</span>
          <span class="k"><b></b>事件</span>
          <span class="k"><u></u>思考</span>
          <span>右上数字 = 当日条目数 · 点格子定位右侧列表</span>
        </div>
      </div>
      <aside class="list-pane" id="listPane"></aside>
    </div>
  </div>
</section>

<!-- ================= 03 集子 / 标签 ================= -->
<section class="screen" id="s-index">
  <div class="wrap">
    <div class="head">
      <h1><em>Index</em>集子 · 标签</h1>
      <div class="aside">集子<b>一对一</b>（像文件夹），tag <b>多对多</b>（像关键词）。<br>两者都必须先在 taxonomy.yml 里登记。</div>
    </div>
    <div class="index-layout">
      <div class="rail" id="indexRail"></div>
      <div class="res-list" id="indexList"></div>
    </div>
  </div>
</section>

<!-- ================= 04 统计 ================= -->
<section class="screen" id="s-stats">
  <div class="wrap">
    <div class="head">
      <h1><em>Statistics</em>统计</h1>
      <div class="aside">计数单位是<b>条目</b>（一个文件一条）。<br>日总结单独计数，不计入事件 / 思考。</div>
    </div>
    <div class="kpis" id="kpis"></div>
    <div class="seg" id="winSeg">
      <button data-w="month" class="on">本月</button>
      <button data-w="year">本年</button>
      <button data-w="all">全部</button>
    </div>
    <div class="grid2">
      <div class="card"><h3>按集子</h3><div class="sub" id="collSub"></div><div id="collRank"></div></div>
      <div class="card"><h3>按 tag</h3><div class="sub" id="tagSub">只统计已登记的 tag · 一条可带多个</div><div id="tagRank"></div></div>
      <div class="card full"><h3>趋势</h3><div class="sub" id="trendSub"></div><div id="trendChart"></div></div>
    </div>
    <footer class="note">
      <b>四个屏幕</b>：上方顺序为<b>本月 → 今日 → 集子·标签 → 统计</b>，默认落在<b>今日</b>。四屏通用一套左右滑切换：触屏横滑、触控板横滑、键盘 ← → 都能翻。<br>
      <b>栏宽统一</b>：三处共用同一套栅格 —— 次级栏 236px / 栏间距 56px / 主栏自适应。<b>滚动条</b>：全站不显示（内容仍可滚动）。<br>
      <b>月视图</b>：左月历等比压缩、整体锁定在视口内；右列表独立滚动，滚动时月历不动。
    </footer>
  </div>
</section>`;

const navOrder = [
  ['month', '本月'],
  ['home', '今日'],
  ['index', '集子 · 标签'],
  ['stats', '统计'],
];

/* ------------------------------------------------------------------
 * 共用的「非视觉」CSS：布局硬约束、栅格、滚动条隐藏、响应式
 * 这部分三个方向完全一致，是「界面逻辑」而非「视觉风格」。
 * ------------------------------------------------------------------ */
const structure = `
*,*::before,*::after{box-sizing:border-box}
html,body{margin:0;padding:0}
a{color:inherit;text-decoration:none}
button{font:inherit;color:inherit}
*{scrollbar-width:none;-ms-overflow-style:none}
*::-webkit-scrollbar{width:0;height:0;display:none}
.wrap{max-width:1160px;margin:0 auto;padding:0 40px 120px}
.screen{display:none}
.screen.on{display:block}
@keyframes pushFromRight{from{transform:translateX(36px);opacity:0}to{transform:none;opacity:1}}
@keyframes pushFromLeft{from{transform:translateX(-36px);opacity:0}to{transform:none;opacity:1}}
.screen.anim-fwd.on{animation:pushFromRight .28s cubic-bezier(.22,.72,.28,1) both}
.screen.anim-back.on{animation:pushFromLeft .28s cubic-bezier(.22,.72,.28,1) both}
@media (prefers-reduced-motion: reduce){.screen.anim-fwd.on,.screen.anim-back.on{animation:none}}
.home{display:grid;grid-template-columns:minmax(0,1fr) 236px;gap:56px;align-items:start;padding-top:44px}
.home-main{min-width:0}
.side{position:sticky;top:calc(var(--top) + 24px);max-height:calc(100dvh - var(--top) - 48px);overflow-y:auto;display:flex;flex-direction:column}
.shell{height:calc(100vh - var(--top));height:calc(100dvh - var(--top));display:flex;flex-direction:column;max-width:1160px;margin:0 auto;padding:0 40px 22px}
.month-body{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) 236px}
.cal-pane{display:flex;flex-direction:column;min-height:0;padding-right:28px}
.matrix{flex:1;min-height:0;display:grid;grid-template-columns:repeat(7,1fr);
  grid-template-rows:repeat(var(--rows,5),minmax(0,1fr));
  border-top:1px solid var(--rule);border-left:1px solid var(--rule)}
.cell{position:relative;min-height:0;overflow:hidden;cursor:pointer;transition:background .12s;
  border-right:1px solid var(--rule);border-bottom:1px solid var(--rule)}
.cell.void{cursor:default}
.list-pane{min-height:0;overflow-y:auto;padding-left:28px;padding-bottom:40px;border-left:1px solid var(--rule);
  -webkit-mask-image:linear-gradient(to bottom,#000 calc(100% - 20px),transparent);
  mask-image:linear-gradient(to bottom,#000 calc(100% - 20px),transparent)}
.list-head{position:sticky;top:0;z-index:2;padding:11px 0 8px;border-bottom:1px solid var(--rule);
  display:flex;align-items:baseline;gap:10px}
.dlrow{padding:14px 0 13px;border-bottom:1px solid var(--rule);cursor:pointer;transition:background .12s}
.dlrow .r1{display:flex;align-items:baseline;gap:6px;font-family:var(--mono);font-size:10.5px;margin-bottom:4px}
.dlrow .r1 .mk{margin-left:auto}
.index-layout{display:grid;grid-template-columns:236px minmax(0,1fr);gap:56px;align-items:start;padding-top:30px}
.rail{position:sticky;top:calc(var(--top) + 24px)}
.rail .blk:first-child{border-top:0;padding-top:0}
.resrow{display:grid;grid-template-columns:104px minmax(0,1fr) 96px;gap:16px;padding:16px 0;
  border-bottom:1px solid var(--rule);align-items:baseline}
.resrow .r{text-align:right;display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap}
.grid2{display:grid;grid-template-columns:1fr 1fr;margin-top:26px;
  border-top:1px solid var(--rule);border-left:1px solid var(--rule)}
.card{padding:24px 26px 28px;border-right:1px solid var(--rule);border-bottom:1px solid var(--rule)}
.rank-row{display:grid;grid-template-columns:118px 1fr 104px;align-items:center;gap:14px;padding:9px 0;
  border-bottom:1px solid var(--rule-2)}
.rank-row:last-child{border-bottom:0}
.rank-row .stack{display:flex;height:12px;background:var(--rule-2)}
.rank-row .stack i{display:block;height:100%}
.rank-row .v{text-align:right;font-family:var(--mono);font-size:12px}
.kpis{display:grid;grid-template-columns:repeat(5,1fr);border-top:1px solid var(--ink);border-left:1px solid var(--rule)}
.kpi{padding:24px 20px 20px;border-right:1px solid var(--rule);border-bottom:1px solid var(--rule)}
.full{grid-column:1/-1}
.mini-dow,.mini-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px}
.mini-grid button{position:relative;height:26px;border:1px solid transparent;background:none;cursor:pointer;
  font-family:var(--mono);font-size:11px;display:flex;flex-direction:column;align-items:center;
  justify-content:center;gap:4px;padding:0}
.mini-grid button.void{cursor:default;pointer-events:none}
.mini-grid button .ul{display:block;width:14px;height:2px}
.idx{display:flex;flex-direction:column}
.idx button{display:flex;align-items:baseline;gap:10px;padding:5px 0;border:0;background:none;cursor:pointer;
  text-align:left;font-size:12.5px}
.idx button .n{margin-left:auto;font-family:var(--mono);font-size:11px}
.tagwrap{display:flex;flex-wrap:wrap;gap:6px}
.tagwrap button{cursor:pointer;padding:3px 9px;font-size:11px;display:inline-flex;gap:6px;align-items:baseline}
.tagwrap button .n{font-family:var(--mono);font-size:10px}
.dirbar{position:fixed;right:24px;bottom:24px;z-index:40;display:flex;align-items:center;gap:2px;
  padding:4px;opacity:.42;transition:opacity .18s}
.dirbar:hover{opacity:1}
.dirbar span{font-size:9px;letter-spacing:.18em;text-transform:uppercase;padding:0 10px}
.dirbar a{font-size:11px;letter-spacing:.06em;padding:7px 12px}
@media(max-height:760px){
  .month-top{padding:14px 0 10px}
  .cell{padding:7px 9px 6px}
  .cell .mt{margin-top:5px}
  .cell .cap{margin-top:5px;-webkit-line-clamp:1}
  .dow{padding:8px 0 6px}
}
@media(max-width:1080px){
  .home{grid-template-columns:1fr;gap:36px}
  .side{position:static;max-height:none}
  .shell{height:auto;padding-bottom:80px}
  .month-body{grid-template-columns:1fr}
  .cal-pane{padding-right:0}
  .matrix{grid-template-rows:repeat(var(--rows,5),112px)}
  .list-pane{border-left:0;padding-left:0;margin-top:22px;max-height:70vh}
  .index-layout{grid-template-columns:1fr;gap:28px}
  .rail{position:static}
  .grid2{grid-template-columns:1fr}
  .kpis{grid-template-columns:repeat(2,1fr)}
  .resrow{grid-template-columns:92px minmax(0,1fr)}
  .resrow .r{grid-column:2;justify-content:flex-start;text-align:left;margin-top:6px}
}`;

/* ------------------------------------------------------------------
 * 方向 D：编辑体（瑞士墨线的进阶版）
 * 保持瑞士墨线的克制，但用更强的字号对比 + 衬线标题 + 更细的分级
 * ------------------------------------------------------------------ */
const cssD = `${structure}
:root{
  --bg:#f7f6f3;
  --surface:#fffefb;
  --ink:#1a1917;
  --ink-2:#5d584f;
  --ink-3:#9b948a;
  --rule:#dcd7cd;
  --rule-2:#ebe7dd;
  --accent:#a8321f;
  --accent-soft:#f6e6e1;
  --top:64px;
  --serif:'Songti SC','Noto Serif SC','Times New Roman',serif;
  --sans:'Inter','Helvetica Neue',Arial,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif;
  --mono:ui-monospace,'SF Mono',Menlo,Consolas,monospace;
}
body{background:var(--bg);color:var(--ink);font-family:var(--sans);font-size:14.5px;line-height:1.75;
  font-feature-settings:"tnum" 1;-webkit-font-smoothing:antialiased}
.top{position:sticky;top:0;z-index:30;height:var(--top);background:rgba(247,246,243,.94);
  backdrop-filter:blur(8px);border-bottom:1px solid var(--ink)}
.top-inner{max-width:1160px;margin:0 auto;padding:0 40px;height:100%;display:flex;align-items:center;gap:32px}
.mark{font-family:var(--serif);font-weight:700;font-size:18px;letter-spacing:-.01em;white-space:nowrap}
.mark span{color:var(--accent);font-family:var(--sans);font-weight:400}
.kicker{font-family:var(--serif);font-size:11px;font-style:italic;color:var(--ink-3);border-left:1px solid var(--rule);padding-left:14px;white-space:nowrap}
.nav{margin-left:auto;display:flex}
.nav button{border:0;background:none;cursor:pointer;padding:0;margin-left:24px;
  font-family:var(--serif);font-size:14px;color:var(--ink-3);border-bottom:1.5px solid transparent;line-height:62px}
.nav button:hover{color:var(--ink)}
.nav button.on{color:var(--ink);border-bottom-color:var(--accent);font-weight:600}

.dateline{display:flex;align-items:baseline;gap:18px;padding:0 0 18px;border-bottom:1px solid var(--ink);flex-wrap:wrap}
.dateline b{font-family:var(--serif);font-size:46px;font-weight:700;letter-spacing:-.02em;line-height:1}
.dateline span{font-family:var(--mono);font-size:11px;color:var(--ink-3);letter-spacing:.06em}
.pull{margin:38px 0 42px;padding:26px 30px;background:var(--surface);border:1px solid var(--rule);border-radius:2px}
.pull .lbl{font-family:var(--mono);font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:var(--accent);margin-bottom:12px}
.pull h2{margin:0 0 10px;font-family:var(--serif);font-size:27px;line-height:1.4;font-weight:600;letter-spacing:-.01em}
.pull p{margin:0;color:var(--ink-2);font-size:14.5px;line-height:1.85;max-width:640px}
.sect-h{display:flex;align-items:center;gap:14px;margin:0 0 6px}
.sect-h h3{margin:0;font-family:var(--mono);font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:var(--ink-3);font-weight:400}
.sect-h::after{content:"";flex:1;height:1px;background:var(--rule)}
.entry{padding:28px 0;border-bottom:1px solid var(--rule)}
.entry:last-child{border-bottom:0}
.entry .top-row{display:flex;align-items:baseline;gap:16px}
.entry .idx{font-family:var(--serif);font-size:15px;font-style:italic;color:var(--ink-3);width:30px;flex:none;padding-top:2px}
.entry h4{margin:0;font-family:var(--serif);font-size:21px;font-weight:600;line-height:1.4}
.entry h4 a:hover{color:var(--accent)}
.entry .body{margin:12px 0 0 46px;color:var(--ink-2);font-size:14px;line-height:1.9;max-width:640px}
.tags{display:flex;gap:7px;flex-wrap:wrap;margin:13px 0 0 46px}
.tag{font-family:var(--mono);font-size:10px;letter-spacing:.08em;padding:3px 10px;border:1px solid var(--rule);
  color:var(--ink-2);background:var(--surface);white-space:nowrap}
.tag.type{border-color:var(--ink-3);color:var(--ink)}
.tag.coll{background:var(--ink);color:var(--surface);border-color:var(--ink)}
.tag.hl{border-color:var(--accent);color:var(--accent);background:var(--accent-soft)}
.empty{padding:44px 0 48px;color:var(--ink-3);font-size:14px;border-bottom:1px solid var(--rule)}
.empty b{display:block;color:var(--ink-2);font-family:var(--serif);font-size:19px;font-weight:600;margin-bottom:8px}

.blk{padding:14px 0 15px;border-top:1px solid var(--rule)}
.blk:first-child{border-top:1px solid var(--ink);padding-top:13px}
.blk-h{display:flex;align-items:baseline;gap:10px;margin-bottom:9px}
.blk-h h3{margin:0;font-family:var(--mono);font-size:9.5px;letter-spacing:.22em;text-transform:uppercase;color:var(--ink-3);font-weight:400}
.blk-h .lnk{margin-left:auto;font-family:var(--mono);font-size:10px;color:var(--ink-3);cursor:pointer}
.blk-h .lnk:hover{color:var(--accent)}
.stat-pair{display:grid;grid-template-columns:1fr 1fr;border:1px solid var(--rule);background:var(--surface);cursor:pointer;transition:.14s}
.stat-pair:hover{border-color:var(--ink-3)}
.stat-pair .p{padding:13px 13px 12px;border-right:1px solid var(--rule)}
.stat-pair .p:last-child{border-right:0}
.stat-pair .p .n{font-family:var(--serif);font-size:30px;font-weight:600;line-height:1;letter-spacing:-.01em}
.stat-pair .p .l{font-family:var(--mono);font-size:9px;letter-spacing:.18em;color:var(--ink-3);margin-top:7px;text-transform:uppercase}
.stat-pair .p .s{font-family:var(--mono);font-size:9.5px;color:var(--ink-3);margin-top:2px}
.stat-pair .p .n.ev{color:var(--ink)}
.stat-pair .p .n.th{color:var(--accent)}
.idx button{border-bottom:1px solid var(--rule-2);color:var(--ink-2)}
.idx button:last-child{border-bottom:0}
.idx button:hover{color:var(--accent)}
.idx button .n{color:var(--ink-3)}
.tagwrap button{border:1px solid var(--rule);background:var(--surface);color:var(--ink-2)}
.tagwrap button:hover{border-color:var(--accent);color:var(--accent)}
.tagwrap button .n{color:var(--ink-3)}
.mini-head{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.mini-head .m{font-family:var(--mono);font-size:11px;letter-spacing:.12em}
.mini-head button{margin-left:auto;border:1px solid var(--rule);background:var(--surface);width:21px;height:21px;line-height:1;cursor:pointer;color:var(--ink-2);padding:0}
.mini-head button+button{margin-left:4px}
.mini-head button:hover{border-color:var(--ink-3);color:var(--ink)}
.mini-dow span{font-family:var(--mono);font-size:9px;color:var(--ink-3);text-align:center;padding-bottom:5px;letter-spacing:.1em}
.mini-grid button{color:var(--ink-3)}
.mini-grid button:hover{border-color:var(--rule);color:var(--ink);background:var(--rule-2)}
.mini-grid button.has{color:var(--ink)}
.mini-grid button .ul{background:var(--ink-3)}
.mini-grid button.hl .ul{background:var(--accent)}
.mini-grid button.sel{border-color:var(--ink);color:var(--ink);font-weight:700}
.mini-grid button.today{background:var(--rule-2);border-color:var(--rule);color:var(--ink);font-weight:600}
.mini-grid button.today.sel{box-shadow:inset 0 0 0 1px var(--ink)}
.mini-grid button.sel .ul{background:var(--ink)}
.mini-grid button.sel.hl .ul{background:var(--accent)}
.mini-foot{margin-top:8px;font-family:var(--mono);font-size:9.5px;color:var(--ink-3);display:flex;gap:11px;flex-wrap:wrap}
.mini-foot i{display:inline-block;width:14px;height:2px;background:var(--ink-3);margin-right:5px;vertical-align:middle}
.mini-foot i.red{background:var(--accent)}
.mini-foot b{display:inline-block;width:11px;height:11px;background:var(--rule-2);border:1px solid var(--rule);margin-right:5px;vertical-align:-1px}

.month-top{display:flex;align-items:flex-end;gap:18px;padding:26px 0 16px;border-bottom:1px solid var(--ink);flex-wrap:wrap}
.month-top h1{margin:0;font-family:var(--serif);font-size:36px;font-weight:600;letter-spacing:-.015em;line-height:1;display:flex;align-items:baseline;gap:16px}
.month-top h1 em{font-style:italic;font-family:var(--serif);font-size:14px;font-weight:400;color:var(--ink-3);letter-spacing:.08em}
.month-top .facts{margin-left:auto;display:flex;gap:18px;font-family:var(--mono);font-size:11px;color:var(--ink-2);flex-wrap:wrap}
.month-top .facts b{font-weight:600;color:var(--ink)}
.month-top .pager{display:flex;border:1px solid var(--rule);background:var(--surface)}
.month-top .pager button{padding:7px 13px;font-family:var(--mono);font-size:10.5px;border:0;background:none;cursor:pointer;color:var(--ink-2);border-right:1px solid var(--rule)}
.month-top .pager button:last-child{border-right:0}
.month-top .pager button:hover{background:var(--ink);color:var(--surface)}
.dow{display:grid;grid-template-columns:repeat(7,1fr);padding:12px 0 9px}
.dow span{font-family:var(--mono);font-size:9.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--ink-3);padding-left:11px}
.cell{background:var(--surface);padding:10px 11px 9px}
.cell.void{background:var(--bg)}
.cell:hover{background:var(--rule-2)}
.cell.void:hover{background:var(--bg)}
.cell.hl::before{content:"";position:absolute;left:0;right:0;top:0;height:3px;background:var(--accent)}
.cell.today{box-shadow:inset 0 0 0 1.5px var(--ink)}
.cell .num{font-family:var(--serif);font-size:17px;line-height:1;letter-spacing:-.01em;color:var(--ink-3);font-style:italic}
.cell.today .num{color:var(--ink);font-style:normal;font-weight:700}
.cell.hl .num{color:var(--accent);font-style:normal;font-weight:700}
.cell .mt{display:flex;align-items:center;gap:4px;margin-top:9px}
.cell .mt i{display:block;width:6px;height:6px;border-radius:50%}
.cell .mt i.ev{background:var(--ink)}
.cell .mt i.th{background:var(--accent)}
.cell .mt .n{margin-left:auto;font-family:var(--mono);font-size:10px;color:var(--ink-3)}
.cell .cap{margin-top:8px;font-family:var(--serif);font-size:11.5px;line-height:1.5;color:var(--ink);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.cal-foot{padding:12px 0 0;display:flex;gap:20px;flex-wrap:wrap;font-family:var(--mono);font-size:9.5px;color:var(--ink-3);align-items:center}
.cal-foot .k{display:inline-flex;align-items:center;gap:6px}
.cal-foot .k i{display:inline-block;width:9px;height:3px;background:var(--accent)}
.cal-foot .k b{width:6px;height:6px;background:var(--ink);display:inline-block;border-radius:50%}
.cal-foot .k u{width:6px;height:6px;background:var(--accent);display:inline-block;text-decoration:none;border-radius:50%}
.list-head{background:var(--bg);font-family:var(--mono);font-size:9.5px;letter-spacing:.18em;text-transform:uppercase;color:var(--ink-3)}
.list-head b{margin-left:auto;font-family:var(--mono);font-size:11px;color:var(--ink-2);letter-spacing:0}
.dlrow:hover{background:var(--rule-2)}
.dlrow.flash{background:var(--accent-soft)}
.dlrow .r1{color:var(--ink-3)}
.dlrow .r1 .d{color:var(--ink);font-weight:500}
.dlrow .r1 .mk{color:var(--accent)}
.dlrow h4{margin:0 0 4px;font-family:var(--serif);font-size:14.5px;font-weight:600;line-height:1.5}
.dlrow:hover h4{color:var(--accent)}
.dlrow p{margin:0;font-family:var(--serif);font-size:12px;line-height:1.7;color:var(--ink-2);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.list-empty{padding:28px 0;color:var(--ink-3);font-family:var(--serif);font-size:13px;line-height:1.75}

.head{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;padding:56px 0 20px;border-bottom:1px solid var(--ink);flex-wrap:wrap}
.head h1{margin:0;font-family:var(--serif);font-size:48px;line-height:1.05;letter-spacing:-.02em;font-weight:600}
.head h1 em{font-style:italic;font-family:var(--serif);font-size:14px;font-weight:400;color:var(--ink-3);letter-spacing:.12em;display:block;margin-bottom:12px}
.head .aside{font-family:var(--serif);font-size:13px;color:var(--ink-2);max-width:340px;text-align:right;line-height:1.85}
.head .aside b{color:var(--ink);font-weight:600}
.res-head{display:flex;align-items:baseline;gap:12px;padding-bottom:13px;border-bottom:1px solid var(--rule);flex-wrap:wrap}
.res-head h2{margin:0;font-family:var(--serif);font-size:23px;font-weight:600;letter-spacing:-.01em}
.res-head .cnt{font-family:var(--mono);font-size:11px;color:var(--ink-3)}
.res-head .hint{margin-left:auto;font-family:var(--mono);font-size:10px;color:var(--ink-3)}
.resrow .d{font-family:var(--mono);font-size:11px;color:var(--ink-2);line-height:1.5}
.resrow .t{font-family:var(--serif);font-size:15.5px;font-weight:600;line-height:1.5}
.resrow .t a:hover{color:var(--accent)}
.resrow .t .sub{margin-top:6px;font-family:var(--serif);font-weight:400;font-size:12.5px;color:var(--ink-2);line-height:1.7;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden}
.resrow .r .tag{font-family:var(--mono);font-size:9.5px}

.kpi{background:var(--surface)}
.kpi .n{font-family:var(--serif);font-size:52px;font-weight:600;letter-spacing:-.02em;line-height:1}
.kpi .n.acc{color:var(--accent)}
.kpi .n.ev{color:var(--ink)}
.kpi .l{margin-top:11px;font-family:var(--mono);font-size:9.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--ink-3)}
.kpi .d{margin-top:7px;font-family:var(--mono);font-size:10.5px;color:var(--ink-2)}
.kpi .d.up{color:var(--accent)}
.kpi .d.dn{color:var(--ink-2)}
.seg{display:flex;margin:32px 0 0;border:1px solid var(--rule);width:max-content;background:var(--surface)}
.seg button{border:0;background:none;font-family:var(--mono);font-size:10px;letter-spacing:.18em;text-transform:uppercase;padding:9px 19px;cursor:pointer;color:var(--ink-3);border-right:1px solid var(--rule)}
.seg button:last-child{border-right:0}
.seg button.on{background:var(--ink);color:var(--surface)}
.card{background:var(--surface)}
.card h3{margin:0 0 3px;font-family:var(--serif);font-size:17px;font-weight:600}
.card .sub{font-family:var(--mono);font-size:10px;color:var(--ink-3);margin-bottom:22px}
.rank-row .nm{font-family:var(--serif);font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rank-row .stack i.ev{background:var(--ink)}
.rank-row .stack i.th{background:var(--accent)}
.rank-row .v .up{color:var(--accent)}
.rank-row .v .dn{color:var(--ink-2)}
.rank-row .v .nw{color:var(--accent);border:1px solid var(--accent);padding:0 4px}
.axis{font-family:var(--mono);font-size:10px;fill:var(--ink-3)}
footer.note{margin-top:54px;padding-top:20px;border-top:1px solid var(--ink);font-family:var(--serif);font-size:12.5px;color:var(--ink-2);line-height:1.95;max-width:880px}
footer.note b{color:var(--ink);font-weight:600}
.dirbar{background:var(--ink)}
.dirbar span{color:rgba(255,255,255,.45)}
.dirbar a{color:rgba(255,255,255,.72)}
.dirbar a:hover{color:#fff;background:rgba(255,255,255,.1)}
.dirbar a.on{background:var(--accent);color:#fff}`;

/* ------------------------------------------------------------------
 * 方向 E：点阵（bujo 的克制版）
 * 点阵纸背景 + 手写体标题，但沿用瑞士墨线的发丝线、栅格与低强度标记
 * ------------------------------------------------------------------ */
const cssE = `${structure}
:root{
  --bg:#fcfcfa;
  --surface:#ffffff;
  --ink:#1c1c1a;
  --ink-2:#6a6a65;
  --ink-3:#a2a29c;
  --rule:#dcdcd6;
  --rule-2:#eeeee8;
  --accent:#c2412c;
  --accent-soft:#faece8;
  --top:64px;
  --hand:'Kaiti SC','STKaiti','KaiTi','LXGW WenKai','Noto Serif SC',serif;
  --sans:'Inter','Helvetica Neue',Arial,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif;
  --mono:ui-monospace,'SF Mono',Menlo,Consolas,monospace;
}
body{background:var(--bg);color:var(--ink);font-family:var(--sans);font-size:14px;line-height:1.7;
  font-feature-settings:"tnum" 1;-webkit-font-smoothing:antialiased;
  background-image:radial-gradient(var(--rule) .9px, transparent .9px);
  background-size:18px 18px;background-position:-1px -1px}
.top{position:sticky;top:0;z-index:30;height:var(--top);
  background:rgba(252,252,250,.95);backdrop-filter:blur(8px);border-bottom:1px solid var(--ink)}
.top-inner{max-width:1160px;margin:0 auto;padding:0 40px;height:100%;display:flex;align-items:center;gap:32px}
.mark{font-family:var(--hand);font-size:21px;font-weight:600;white-space:nowrap;letter-spacing:.02em}
.mark span{color:var(--accent);font-family:var(--sans);font-size:15px}
.kicker{font-family:var(--hand);font-size:12px;color:var(--ink-3);border-left:1px solid var(--rule);padding-left:14px;white-space:nowrap}
.nav{margin-left:auto;display:flex}
.nav button{border:0;background:none;cursor:pointer;padding:0 2px 3px;margin-left:24px;
  font-family:var(--hand);font-size:16px;color:var(--ink-3);border-bottom:2px dotted transparent;line-height:62px}
.nav button:hover{color:var(--ink)}
.nav button.on{color:var(--ink);border-bottom-color:var(--accent);border-bottom-style:solid;font-weight:600}

.dateline{display:flex;align-items:baseline;gap:16px;padding:0 0 16px;border-bottom:1px solid var(--ink);flex-wrap:wrap}
.dateline b{font-family:var(--hand);font-size:38px;font-weight:600;line-height:1;letter-spacing:.01em}
.dateline span{font-family:var(--mono);font-size:11px;color:var(--ink-3)}
.pull{margin:32px 0 38px;padding:2px 0 2px 22px;border-left:3px dotted var(--accent);background:var(--surface);padding:20px 22px}
.pull .lbl{font-family:var(--hand);font-size:12px;letter-spacing:.16em;color:var(--accent);margin-bottom:10px}
.pull h2{margin:0 0 9px;font-family:var(--hand);font-size:25px;line-height:1.5;font-weight:600;letter-spacing:.015em}
.pull p{margin:0;color:var(--ink-2);font-size:13.5px;line-height:1.85;max-width:640px}
.sect-h{display:flex;align-items:center;gap:14px;margin:0 0 4px}
.sect-h h3{margin:0;font-family:var(--hand);font-size:13px;letter-spacing:.14em;color:var(--ink-3);font-weight:500}
.sect-h::after{content:"";flex:1;height:1px;background:var(--rule)}
.entry{padding:22px 0;border-bottom:1px solid var(--rule)}
.entry:last-child{border-bottom:0}
.entry .top-row{display:flex;align-items:baseline;gap:13px}
.entry .idx{font-family:var(--mono);font-size:11px;color:var(--ink-3);width:24px;flex:none;padding-top:4px}
.entry h4{margin:0;font-family:var(--hand);font-size:19px;font-weight:600;letter-spacing:.015em;line-height:1.5}
.entry h4 a:hover{color:var(--accent)}
.entry .body{margin:11px 0 0 37px;color:var(--ink-2);font-size:13.5px;line-height:1.85;max-width:640px}
.tags{display:flex;gap:7px;flex-wrap:wrap;margin:11px 0 0 37px}
.tag{font-family:var(--mono);font-size:10px;letter-spacing:.06em;padding:2px 9px;border:1px solid var(--rule);
  color:var(--ink-2);background:var(--surface);white-space:nowrap;border-radius:2px}
.tag.type{border-color:var(--ink-3);color:var(--ink)}
.tag.coll{background:var(--ink);color:var(--surface);border-color:var(--ink)}
.tag.hl{border-color:var(--accent);color:var(--accent);background:var(--accent-soft)}
.empty{padding:38px 0 42px;color:var(--ink-3);font-size:13px;border-bottom:1px solid var(--rule)}
.empty b{display:block;color:var(--ink-2);font-family:var(--hand);font-size:18px;font-weight:600;margin-bottom:6px}

.blk{padding:12px 0 13px;border-top:1px solid var(--rule)}
.blk:first-child{border-top:1px solid var(--ink);padding-top:11px}
.blk-h{display:flex;align-items:baseline;gap:10px;margin-bottom:8px}
.blk-h h3{margin:0;font-family:var(--hand);font-size:13px;letter-spacing:.12em;color:var(--ink-3);font-weight:500}
.blk-h .lnk{margin-left:auto;font-family:var(--mono);font-size:10px;color:var(--ink-3);cursor:pointer}
.blk-h .lnk:hover{color:var(--accent)}
.stat-pair{display:grid;grid-template-columns:1fr 1fr;border:1px solid var(--rule);background:var(--surface);cursor:pointer;transition:.14s;border-radius:3px}
.stat-pair:hover{border-color:var(--ink-3)}
.stat-pair .p{padding:11px 12px 10px;border-right:1px solid var(--rule)}
.stat-pair .p:last-child{border-right:0}
.stat-pair .p .n{font-family:var(--hand);font-size:27px;font-weight:600;line-height:1}
.stat-pair .p .l{font-family:var(--mono);font-size:9px;letter-spacing:.16em;color:var(--ink-3);margin-top:6px;text-transform:uppercase}
.stat-pair .p .s{font-family:var(--mono);font-size:9.5px;color:var(--ink-3);margin-top:1px}
.stat-pair .p .n.ev{color:var(--ink)}
.stat-pair .p .n.th{color:var(--accent)}
.idx button{border-bottom:1px solid var(--rule-2);color:var(--ink-2);font-family:var(--hand);font-size:14px}
.idx button:last-child{border-bottom:0}
.idx button:hover{color:var(--accent)}
.idx button .n{color:var(--ink-3)}
.tagwrap button{border:1px solid var(--rule);background:var(--surface);color:var(--ink-2);border-radius:12px;font-family:var(--hand);font-size:12.5px}
.tagwrap button:hover{border-color:var(--accent);color:var(--accent)}
.tagwrap button .n{color:var(--ink-3)}
.mini-head{display:flex;align-items:center;gap:8px;margin-bottom:7px}
.mini-head .m{font-family:var(--hand);font-size:13px;letter-spacing:.08em}
.mini-head button{margin-left:auto;border:1px solid var(--rule);background:var(--surface);width:21px;height:21px;line-height:1;cursor:pointer;color:var(--ink-2);padding:0;border-radius:3px}
.mini-head button+button{margin-left:4px}
.mini-head button:hover{border-color:var(--ink-3);color:var(--ink)}
.mini-dow span{font-family:var(--hand);font-size:11px;color:var(--ink-3);text-align:center;padding-bottom:4px}
.mini-grid button{color:var(--ink-3);border-radius:3px}
.mini-grid button:hover{border-color:var(--rule);color:var(--ink);background:var(--rule-2)}
.mini-grid button.has{color:var(--ink)}
.mini-grid button .ul{background:var(--ink-3);height:2.5px;border-radius:2px}
.mini-grid button.hl .ul{background:var(--accent)}
.mini-grid button.sel{border-color:var(--ink);color:var(--ink);font-weight:700}
.mini-grid button.today{background:var(--rule-2);border-color:var(--rule);color:var(--ink);font-weight:600}
.mini-grid button.today.sel{box-shadow:inset 0 0 0 1px var(--ink)}
.mini-grid button.sel .ul{background:var(--ink)}
.mini-grid button.sel.hl .ul{background:var(--accent)}
.mini-foot{margin-top:7px;font-family:var(--mono);font-size:9.5px;color:var(--ink-3);display:flex;gap:11px;flex-wrap:wrap}
.mini-foot i{display:inline-block;width:14px;height:2.5px;background:var(--ink-3);margin-right:5px;vertical-align:middle;border-radius:2px}
.mini-foot i.red{background:var(--accent)}
.mini-foot b{display:inline-block;width:11px;height:11px;background:var(--rule-2);border:1px solid var(--rule);margin-right:5px;vertical-align:-1px;border-radius:2px}

.month-top{display:flex;align-items:flex-end;gap:18px;padding:22px 0 15px;border-bottom:1px solid var(--ink);flex-wrap:wrap}
.month-top h1{margin:0;font-family:var(--hand);font-size:32px;font-weight:600;letter-spacing:.01em;line-height:1;display:flex;align-items:baseline;gap:14px}
.month-top h1 em{font-style:normal;font-family:var(--hand);font-size:13px;font-weight:400;color:var(--ink-3);letter-spacing:.14em}
.month-top .facts{margin-left:auto;display:flex;gap:18px;font-family:var(--mono);font-size:11px;color:var(--ink-2);flex-wrap:wrap}
.month-top .facts b{font-weight:600;color:var(--ink)}
.month-top .pager{display:flex;border:1px solid var(--rule);background:var(--surface);border-radius:3px;overflow:hidden}
.month-top .pager button{padding:6px 12px;font-family:var(--hand);font-size:12.5px;border:0;background:none;cursor:pointer;color:var(--ink-2);border-right:1px solid var(--rule)}
.month-top .pager button:last-child{border-right:0}
.month-top .pager button:hover{background:var(--ink);color:var(--surface)}
.dow{display:grid;grid-template-columns:repeat(7,1fr);padding:11px 0 8px}
.dow span{font-family:var(--hand);font-size:12px;letter-spacing:.14em;color:var(--ink-3);padding-left:11px}
.cell{background:var(--surface);padding:9px 10px 8px}
.cell.void{background:var(--bg)}
.cell:hover{background:var(--rule-2)}
.cell.void:hover{background:var(--bg)}
.cell.hl::before{content:"";position:absolute;left:0;right:0;top:0;height:3px;background:var(--accent)}
.cell.today{box-shadow:inset 0 0 0 1.5px var(--ink)}
.cell .num{font-family:var(--mono);font-size:15px;line-height:1;letter-spacing:-.01em;color:var(--ink-2)}
.cell.today .num{color:var(--ink);font-weight:600}
.cell.hl .num{color:var(--accent);font-weight:600}
.cell .mt{display:flex;align-items:center;gap:4px;margin-top:8px}
.cell .mt i{display:block;width:6px;height:6px;border-radius:50%}
.cell .mt i.ev{background:var(--ink-3)}
.cell .mt i.th{background:var(--accent)}
.cell .mt .n{margin-left:auto;font-family:var(--mono);font-size:10px;color:var(--ink-3)}
.cell .cap{margin-top:7px;font-family:var(--hand);font-size:11.5px;line-height:1.55;color:var(--ink);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.cal-foot{padding:11px 0 0;display:flex;gap:20px;flex-wrap:wrap;font-family:var(--mono);font-size:9.5px;color:var(--ink-3);align-items:center}
.cal-foot .k{display:inline-flex;align-items:center;gap:6px}
.cal-foot .k i{display:inline-block;width:9px;height:3px;background:var(--accent);border-radius:2px}
.cal-foot .k b{width:6px;height:6px;background:var(--ink-3);display:inline-block;border-radius:50%}
.cal-foot .k u{width:6px;height:6px;background:var(--accent);display:inline-block;text-decoration:none;border-radius:50%}
.list-head{background:var(--bg);font-family:var(--hand);font-size:12px;letter-spacing:.14em;color:var(--ink-3)}
.list-head b{margin-left:auto;font-family:var(--mono);font-size:11px;color:var(--ink-2);letter-spacing:0}
.dlrow:hover{background:var(--rule-2)}
.dlrow.flash{background:var(--accent-soft)}
.dlrow .r1{color:var(--ink-3)}
.dlrow .r1 .d{color:var(--ink);font-weight:500}
.dlrow .r1 .mk{color:var(--accent)}
.dlrow h4{margin:0 0 3px;font-family:var(--hand);font-size:15px;font-weight:600;line-height:1.55;letter-spacing:.015em}
.dlrow:hover h4{color:var(--accent)}
.dlrow p{margin:0;font-family:var(--hand);font-size:12px;line-height:1.75;color:var(--ink-2);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.list-empty{padding:26px 0;color:var(--ink-3);font-family:var(--hand);font-size:13px;line-height:1.8}

.head{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;padding:52px 0 18px;border-bottom:1px solid var(--ink);flex-wrap:wrap}
.head h1{margin:0;font-family:var(--hand);font-size:44px;line-height:1.1;letter-spacing:.015em;font-weight:600}
.head h1 em{font-style:normal;font-family:var(--hand);font-size:13px;font-weight:400;color:var(--ink-3);letter-spacing:.16em;display:block;margin-bottom:10px}
.head .aside{font-family:var(--hand);font-size:13px;color:var(--ink-2);max-width:340px;text-align:right;line-height:1.9}
.head .aside b{color:var(--ink);font-weight:600}
.res-head{display:flex;align-items:baseline;gap:12px;padding-bottom:12px;border-bottom:1px solid var(--rule);flex-wrap:wrap}
.res-head h2{margin:0;font-family:var(--hand);font-size:23px;font-weight:600;letter-spacing:.015em}
.res-head .cnt{font-family:var(--mono);font-size:11px;color:var(--ink-3)}
.res-head .hint{margin-left:auto;font-family:var(--mono);font-size:10px;color:var(--ink-3)}
.resrow .d{font-family:var(--mono);font-size:11px;color:var(--ink-2);line-height:1.5}
.resrow .t{font-family:var(--hand);font-size:16px;font-weight:600;line-height:1.5}
.resrow .t a:hover{color:var(--accent)}
.resrow .t .sub{margin-top:5px;font-family:var(--hand);font-weight:400;font-size:12.5px;color:var(--ink-2);line-height:1.75;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden}
.resrow .r .tag{font-family:var(--mono);font-size:9.5px}

.kpi{background:var(--surface)}
.kpi .n{font-family:var(--hand);font-size:48px;font-weight:600;line-height:1;letter-spacing:.01em}
.kpi .n.acc{color:var(--accent)}
.kpi .n.ev{color:var(--ink)}
.kpi .l{margin-top:10px;font-family:var(--mono);font-size:9.5px;letter-spacing:.18em;text-transform:uppercase;color:var(--ink-3)}
.kpi .d{margin-top:6px;font-family:var(--mono);font-size:10.5px;color:var(--ink-2)}
.kpi .d.up{color:var(--accent)}
.kpi .d.dn{color:var(--ink-2)}
.seg{display:flex;margin:30px 0 0;border:1px solid var(--rule);width:max-content;background:var(--surface);border-radius:3px;overflow:hidden}
.seg button{border:0;background:none;font-family:var(--hand);font-size:12.5px;letter-spacing:.12em;padding:8px 19px;cursor:pointer;color:var(--ink-3);border-right:1px solid var(--rule)}
.seg button:last-child{border-right:0}
.seg button.on{background:var(--ink);color:var(--surface)}
.card{background:var(--surface)}
.card h3{margin:0 0 3px;font-family:var(--hand);font-size:17px;font-weight:600}
.card .sub{font-family:var(--mono);font-size:10px;color:var(--ink-3);margin-bottom:20px}
.rank-row .nm{font-family:var(--hand);font-size:13.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rank-row .stack i.ev{background:var(--ink-3)}
.rank-row .stack i.th{background:var(--accent)}
.rank-row .v .up{color:var(--accent)}
.rank-row .v .dn{color:var(--ink-2)}
.rank-row .v .nw{color:var(--accent);border:1px solid var(--accent);padding:0 4px}
.axis{font-family:var(--mono);font-size:10px;fill:var(--ink-3)}
footer.note{margin-top:50px;padding-top:18px;border-top:1px solid var(--ink);font-family:var(--hand);font-size:13px;color:var(--ink-2);line-height:1.95;max-width:880px}
footer.note b{color:var(--ink);font-weight:600}
.dirbar{background:var(--ink)}
.dirbar span{color:rgba(255,255,255,.45)}
.dirbar a{color:rgba(255,255,255,.72)}
.dirbar a:hover{color:#fff;background:rgba(255,255,255,.1)}
.dirbar a.on{background:var(--accent);color:#fff}`;

/* ------------------------------------------------------------------
 * 方向 F：暖纸（奶油底 + 赭红 + 书刊排版，无点阵）
 * ------------------------------------------------------------------ */
const cssF = `${structure}
:root{
  --bg:#f4efe6;
  --surface:#faf7f0;
  --ink:#2b241d;
  --ink-2:#6d5f52;
  --ink-3:#a8998a;
  --rule:#ddd2c2;
  --rule-2:#eae2d5;
  --accent:#b8541f;
  --accent-soft:#f7e7da;
  --top:64px;
  --serif:'Songti SC','Noto Serif SC','Georgia','Times New Roman',serif;
  --sans:'Inter','Helvetica Neue',Arial,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif;
  --mono:ui-monospace,'SF Mono',Menlo,Consolas,monospace;
}
body{background:var(--bg);color:var(--ink);font-family:var(--serif);font-size:15px;line-height:1.85;
  font-feature-settings:"tnum" 1;-webkit-font-smoothing:antialiased}
a{color:inherit}
.top{position:sticky;top:0;z-index:30;height:var(--top);background:rgba(244,239,230,.95);
  backdrop-filter:blur(8px);border-bottom:1px solid var(--ink)}
.top-inner{max-width:1160px;margin:0 auto;padding:0 40px;height:100%;display:flex;align-items:center;gap:32px}
.mark{font-family:var(--serif);font-size:19px;font-weight:700;letter-spacing:.02em;white-space:nowrap}
.mark span{color:var(--accent);font-family:var(--sans);font-size:15px;font-weight:300}
.kicker{font-family:var(--serif);font-size:11px;font-style:italic;color:var(--ink-3);border-left:1px solid var(--rule);padding-left:14px;white-space:nowrap}
.nav{margin-left:auto;display:flex}
.nav button{border:0;background:none;cursor:pointer;padding:0;margin-left:26px;
  font-family:var(--sans);font-size:12px;letter-spacing:.16em;text-transform:uppercase;
  color:var(--ink-3);border-bottom:2px solid transparent;line-height:62px}
.nav button:hover{color:var(--ink)}
.nav button.on{color:var(--accent);border-bottom-color:var(--accent)}

.dateline{display:flex;align-items:baseline;gap:18px;padding:0 0 20px;border-bottom:2px solid var(--ink);flex-wrap:wrap}
.dateline b{font-family:var(--serif);font-size:52px;font-weight:700;letter-spacing:-.015em;line-height:1}
.dateline span{font-family:var(--mono);font-size:11px;color:var(--ink-3);letter-spacing:.08em}
.pull{margin:40px 0 44px;padding:30px 34px;background:var(--surface);border-top:3px solid var(--accent);border-bottom:1px solid var(--rule)}
.pull .lbl{font-family:var(--sans);font-size:10px;letter-spacing:.28em;text-transform:uppercase;color:var(--accent);margin-bottom:13px}
.pull h2{margin:0 0 11px;font-family:var(--serif);font-size:30px;line-height:1.4;font-weight:700;letter-spacing:-.01em}
.pull p{margin:0;color:var(--ink-2);font-size:15px;line-height:1.95;max-width:660px}
.sect-h{display:flex;align-items:center;gap:16px;margin:0 0 8px}
.sect-h h3{margin:0;font-family:var(--sans);font-size:10.5px;letter-spacing:.26em;text-transform:uppercase;color:var(--ink-3);font-weight:500}
.sect-h::after{content:"";flex:1;height:1px;background:var(--rule)}
.entry{padding:30px 0;border-bottom:1px solid var(--rule)}
.entry:last-child{border-bottom:0}
.entry .top-row{display:flex;align-items:baseline;gap:18px}
.entry .idx{font-family:var(--serif);font-size:16px;font-style:italic;color:var(--accent);width:32px;flex:none;padding-top:3px}
.entry h4{margin:0;font-family:var(--serif);font-size:22px;font-weight:700;line-height:1.45;letter-spacing:-.005em}
.entry h4 a:hover{color:var(--accent)}
.entry .body{margin:13px 0 0 50px;color:var(--ink-2);font-size:15px;line-height:1.95;max-width:660px}
.tags{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0 0 50px}
.tag{font-family:var(--sans);font-size:10px;letter-spacing:.12em;text-transform:uppercase;padding:4px 11px;
  border:1px solid var(--rule);color:var(--ink-2);background:var(--surface);white-space:nowrap}
.tag.type{border-color:var(--ink);color:var(--ink)}
.tag.coll{background:var(--accent);color:#fff;border-color:var(--accent)}
.tag.hl{border-color:var(--accent);color:var(--accent);background:var(--accent-soft)}
.empty{padding:48px 0 52px;color:var(--ink-3);font-size:15px;border-bottom:1px solid var(--rule)}
.empty b{display:block;color:var(--ink-2);font-family:var(--serif);font-size:22px;font-weight:700;margin-bottom:8px}

.blk{padding:15px 0 16px;border-top:1px solid var(--rule)}
.blk:first-child{border-top:2px solid var(--ink);padding-top:14px}
.blk-h{display:flex;align-items:baseline;gap:10px;margin-bottom:10px}
.blk-h h3{margin:0;font-family:var(--sans);font-size:9.5px;letter-spacing:.26em;text-transform:uppercase;color:var(--ink-3);font-weight:500}
.blk-h .lnk{margin-left:auto;font-family:var(--mono);font-size:10px;color:var(--accent);cursor:pointer;letter-spacing:.06em}
.stat-pair{display:grid;grid-template-columns:1fr 1fr;background:var(--surface);cursor:pointer;transition:.14s;border-top:2px solid var(--ink)}
.stat-pair:hover{background:var(--accent-soft)}
.stat-pair .p{padding:14px 14px 13px;border-right:1px solid var(--rule)}
.stat-pair .p:last-child{border-right:0}
.stat-pair .p .n{font-family:var(--serif);font-size:32px;font-weight:700;line-height:1;letter-spacing:-.015em}
.stat-pair .p .l{font-family:var(--sans);font-size:9px;letter-spacing:.22em;color:var(--ink-3);margin-top:8px;text-transform:uppercase}
.stat-pair .p .s{font-family:var(--mono);font-size:9.5px;color:var(--ink-3);margin-top:2px}
.stat-pair .p .n.ev{color:var(--ink)}
.stat-pair .p .n.th{color:var(--accent)}
.idx button{border-bottom:1px solid var(--rule-2);color:var(--ink-2);font-family:var(--serif);font-size:14px}
.idx button:last-child{border-bottom:0}
.idx button:hover{color:var(--accent)}
.idx button .n{color:var(--ink-3)}
.tagwrap button{border:1px solid var(--rule);background:var(--surface);color:var(--ink-2);font-family:var(--sans);font-size:11px;letter-spacing:.08em}
.tagwrap button:hover{border-color:var(--accent);color:var(--accent)}
.tagwrap button .n{color:var(--ink-3)}
.mini-head{display:flex;align-items:center;gap:8px;margin-bottom:9px}
.mini-head .m{font-family:var(--sans);font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--ink-2)}
.mini-head button{margin-left:auto;border:1px solid var(--rule);background:var(--surface);width:21px;height:21px;line-height:1;cursor:pointer;color:var(--ink-2);padding:0}
.mini-head button+button{margin-left:4px}
.mini-head button:hover{border-color:var(--ink);color:var(--ink);background:var(--rule-2)}
.mini-dow span{font-family:var(--sans);font-size:9px;letter-spacing:.14em;color:var(--ink-3);text-align:center;padding-bottom:5px;text-transform:uppercase}
.mini-grid button{color:var(--ink-3)}
.mini-grid button:hover{border-color:var(--rule);color:var(--ink);background:var(--rule-2)}
.mini-grid button.has{color:var(--ink)}
.mini-grid button .ul{background:var(--ink-3)}
.mini-grid button.hl .ul{background:var(--accent)}
.mini-grid button.sel{border-color:var(--ink);color:var(--ink);font-weight:700}
.mini-grid button.today{background:var(--rule-2);border-color:var(--rule);color:var(--ink);font-weight:600}
.mini-grid button.today.sel{box-shadow:inset 0 0 0 1px var(--ink)}
.mini-grid button.sel .ul{background:var(--ink)}
.mini-grid button.sel.hl .ul{background:var(--accent)}
.mini-foot{margin-top:8px;font-family:var(--mono);font-size:9.5px;color:var(--ink-3);display:flex;gap:11px;flex-wrap:wrap}
.mini-foot i{display:inline-block;width:14px;height:2px;background:var(--ink-3);margin-right:5px;vertical-align:middle}
.mini-foot i.red{background:var(--accent)}
.mini-foot b{display:inline-block;width:11px;height:11px;background:var(--rule-2);border:1px solid var(--rule);margin-right:5px;vertical-align:-1px}

.month-top{display:flex;align-items:flex-end;gap:20px;padding:26px 0 18px;border-bottom:2px solid var(--ink);flex-wrap:wrap}
.month-top h1{margin:0;font-family:var(--serif);font-size:42px;font-weight:700;letter-spacing:-.015em;line-height:1;display:flex;align-items:baseline;gap:16px}
.month-top h1 em{font-style:italic;font-family:var(--serif);font-size:15px;font-weight:400;color:var(--accent);letter-spacing:.12em}
.month-top .facts{margin-left:auto;display:flex;gap:20px;font-family:var(--mono);font-size:11px;color:var(--ink-2);flex-wrap:wrap}
.month-top .facts b{font-weight:600;color:var(--ink)}
.month-top .pager{display:flex;border:1px solid var(--ink);background:var(--surface)}
.month-top .pager button{padding:7px 14px;font-family:var(--sans);font-size:11px;letter-spacing:.1em;border:0;background:none;cursor:pointer;color:var(--ink-2);border-right:1px solid var(--rule)}
.month-top .pager button:last-child{border-right:0}
.month-top .pager button:hover{background:var(--ink);color:var(--surface)}
.dow{display:grid;grid-template-columns:repeat(7,1fr);padding:12px 0 9px}
.dow span{font-family:var(--sans);font-size:9.5px;letter-spacing:.22em;text-transform:uppercase;color:var(--ink-3);padding-left:11px}
.cell{background:var(--surface);padding:10px 11px 9px}
.cell.void{background:var(--bg)}
.cell:hover{background:var(--rule-2)}
.cell.void:hover{background:var(--bg)}
.cell.hl::before{content:"";position:absolute;left:0;right:0;top:0;height:3px;background:var(--accent)}
.cell.today{box-shadow:inset 0 0 0 2px var(--ink)}
.cell .num{font-family:var(--serif);font-size:18px;line-height:1;letter-spacing:-.015em;color:var(--ink-3)}
.cell.today .num{color:var(--ink);font-weight:700}
.cell.hl .num{color:var(--accent);font-weight:700}
.cell .mt{display:flex;align-items:center;gap:4px;margin-top:9px}
.cell .mt i{display:block;width:6px;height:6px;border-radius:50%}
.cell .mt i.ev{background:var(--ink)}
.cell .mt i.th{background:var(--accent)}
.cell .mt .n{margin-left:auto;font-family:var(--mono);font-size:10px;color:var(--ink-3)}
.cell .cap{margin-top:8px;font-family:var(--serif);font-size:12px;line-height:1.5;color:var(--ink);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.cal-foot{padding:12px 0 0;display:flex;gap:20px;flex-wrap:wrap;font-family:var(--mono);font-size:9.5px;color:var(--ink-3);align-items:center}
.cal-foot .k{display:inline-flex;align-items:center;gap:6px}
.cal-foot .k i{display:inline-block;width:9px;height:3px;background:var(--accent)}
.cal-foot .k b{width:6px;height:6px;background:var(--ink);display:inline-block;border-radius:50%}
.cal-foot .k u{width:6px;height:6px;background:var(--accent);display:inline-block;text-decoration:none;border-radius:50%}
.list-head{background:var(--bg);font-family:var(--sans);font-size:9.5px;letter-spacing:.22em;text-transform:uppercase;color:var(--ink-3)}
.list-head b{margin-left:auto;font-family:var(--mono);font-size:11px;color:var(--ink-2);letter-spacing:0}
.dlrow:hover{background:var(--rule-2)}
.dlrow.flash{background:var(--accent-soft)}
.dlrow .r1{color:var(--ink-3)}
.dlrow .r1 .d{color:var(--ink);font-weight:500}
.dlrow .r1 .mk{color:var(--accent)}
.dlrow h4{margin:0 0 4px;font-family:var(--serif);font-size:15.5px;font-weight:700;line-height:1.5}
.dlrow:hover h4{color:var(--accent)}
.dlrow p{margin:0;font-family:var(--serif);font-size:12.5px;line-height:1.8;color:var(--ink-2);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.list-empty{padding:28px 0;color:var(--ink-3);font-family:var(--serif);font-size:13.5px;line-height:1.85}

.head{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;padding:58px 0 22px;border-bottom:2px solid var(--ink);flex-wrap:wrap}
.head h1{margin:0;font-family:var(--serif);font-size:56px;line-height:1.05;letter-spacing:-.02em;font-weight:700}
.head h1 em{font-style:italic;font-family:var(--serif);font-size:15px;font-weight:400;color:var(--accent);letter-spacing:.18em;display:block;margin-bottom:12px}
.head .aside{font-family:var(--serif);font-size:13.5px;color:var(--ink-2);max-width:340px;text-align:right;line-height:1.95}
.head .aside b{color:var(--ink);font-weight:700}
.res-head{display:flex;align-items:baseline;gap:12px;padding-bottom:13px;border-bottom:1px solid var(--rule);flex-wrap:wrap}
.res-head h2{margin:0;font-family:var(--serif);font-size:26px;font-weight:700;letter-spacing:-.01em}
.res-head .cnt{font-family:var(--mono);font-size:11px;color:var(--ink-3)}
.res-head .hint{margin-left:auto;font-family:var(--mono);font-size:10px;color:var(--ink-3)}
.resrow .d{font-family:var(--mono);font-size:11px;color:var(--ink-2);line-height:1.5}
.resrow .t{font-family:var(--serif);font-size:16px;font-weight:700;line-height:1.5}
.resrow .t a:hover{color:var(--accent)}
.resrow .t .sub{margin-top:6px;font-weight:400;font-size:13px;color:var(--ink-2);line-height:1.75;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden}
.resrow .r .tag{font-family:var(--sans);font-size:9px}

.kpi{background:var(--surface)}
.kpi .n{font-family:var(--serif);font-size:56px;font-weight:700;letter-spacing:-.025em;line-height:1}
.kpi .n.acc{color:var(--accent)}
.kpi .n.ev{color:var(--ink)}
.kpi .l{margin-top:12px;font-family:var(--sans);font-size:9.5px;letter-spacing:.24em;text-transform:uppercase;color:var(--ink-3)}
.kpi .d{margin-top:7px;font-family:var(--mono);font-size:10.5px;color:var(--ink-2)}
.kpi .d.up{color:var(--accent)}
.kpi .d.dn{color:var(--ink-2)}
.seg{display:flex;margin:32px 0 0;border:1px solid var(--ink);width:max-content;background:var(--surface)}
.seg button{border:0;background:none;font-family:var(--sans);font-size:10.5px;letter-spacing:.18em;text-transform:uppercase;padding:9px 20px;cursor:pointer;color:var(--ink-3);border-right:1px solid var(--rule)}
.seg button:last-child{border-right:0}
.seg button.on{background:var(--ink);color:var(--surface)}
.card{background:var(--surface)}
.card h3{margin:0 0 3px;font-family:var(--serif);font-size:19px;font-weight:700}
.card .sub{font-family:var(--mono);font-size:10px;color:var(--ink-3);margin-bottom:22px}
.rank-row .nm{font-family:var(--serif);font-size:13.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rank-row .stack i.ev{background:var(--ink)}
.rank-row .stack i.th{background:var(--accent)}
.rank-row .v .up{color:var(--accent)}
.rank-row .v .dn{color:var(--ink-2)}
.rank-row .v .nw{color:var(--accent);border:1px solid var(--accent);padding:0 4px}
.axis{font-family:var(--mono);font-size:10px;fill:var(--ink-3)}
footer.note{margin-top:56px;padding-top:20px;border-top:2px solid var(--ink);font-family:var(--serif);font-size:13px;color:var(--ink-2);line-height:2;max-width:880px}
footer.note b{color:var(--ink);font-weight:700}
.dirbar{background:var(--ink)}
.dirbar span{color:rgba(255,255,255,.45)}
.dirbar a{color:rgba(255,255,255,.72)}
.dirbar a:hover{color:#fff;background:rgba(255,255,255,.1)}
.dirbar a.on{background:var(--accent);color:#fff}`;

/* ------------------------------------------------------------------
 * 方向 G：底栏版编辑体（= D 的视觉 + 底部居中导航，删掉顶部栏）
 * 用户反馈「编辑体效果最好」，进一步要求：四屏导航移到底部居中、删除顶部栏、
 * 尽量少占纵向空间。所以 G 复用 D 的全部视觉变量与组件样式，
 * 只重写「页面骨架 + 导航位置 + 纵向间距」三件事。
 * ------------------------------------------------------------------ */
const cssG = `${structure}
:root{
  --bg:#f7f6f3;
  --surface:#fffefb;
  --ink:#1a1917;
  --ink-2:#5d584f;
  --ink-3:#9b948a;
  --rule:#dcd7cd;
  --rule-2:#ebe7dd;
  --accent:#a8321f;
  --accent-soft:#f6e6e1;
  --top:0px;                       /* 顶部栏已删除：所有 calc(var(--top)+..) 归零 */
  --tab:52px;                      /* 底部导航条高度 */
  --serif:'Songti SC','Noto Serif SC','Times New Roman',serif;
  --sans:'Inter','Helvetica Neue',Arial,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif;
  --mono:ui-monospace,'SF Mono',Menlo,Consolas,monospace;
}
body{background:var(--bg);color:var(--ink);font-family:var(--sans);font-size:14.5px;line-height:1.75;
  font-feature-settings:"tnum" 1;-webkit-font-smoothing:antialiased}

/* ---------- 品牌（原顶栏左侧，改为贴在内容顶部的一行小字，不占独立栏高） ---------- */
.brand{font-family:var(--serif);font-weight:700;font-size:13px;letter-spacing:.02em;color:var(--ink-3);
  max-width:1160px;margin:0 auto;padding:18px 40px 0;display:flex;align-items:baseline;gap:9px}
.brand span{color:var(--accent);font-family:var(--sans);font-weight:400}
.brand::after{content:"";flex:1;height:1px;background:var(--rule)}
.brand em{font-style:normal;font-family:var(--mono);font-size:9.5px;letter-spacing:.18em;
  text-transform:uppercase;color:var(--ink-3);margin-left:auto;padding-left:18px}

/* ---------- 底部居中导航（取代原顶栏 .nav） ---------- */
.tabbar{position:fixed;left:50%;bottom:calc(18px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:40;
  display:flex;align-items:center;gap:2px;padding:4px;
  background:rgba(26,25,23,.92);backdrop-filter:blur(10px);border-radius:999px;
  box-shadow:0 6px 22px rgba(26,25,23,.18)}
.tabbar button{border:0;background:none;cursor:pointer;padding:7px 17px;border-radius:999px;
  font-family:var(--serif);font-size:13px;color:rgba(255,255,255,.62);white-space:nowrap;transition:.14s}
.tabbar button:hover{color:#fff}
.tabbar button.on{background:var(--accent);color:#fff;font-weight:600}

/* ---------- 纵向空间压缩：所有屏幕的上边距统一收到 22px ---------- */
.wrap{padding:0 40px calc(var(--tab) + 28px)}
.home{padding-top:22px}
.index-layout{padding-top:22px}
.head{padding:22px 0 14px}
.head h1{font-size:34px}
.head h1 em{margin-bottom:6px}
.dateline{padding:0 0 14px}
.dateline b{font-size:38px}
.pull{margin:22px 0 26px;padding:20px 24px}
.pull h2{font-size:23px}
.entry{padding:20px 0}
.empty{padding:30px 0 34px}
.kpis{margin-top:0}
.kpi{padding:18px 18px 16px}
.kpi .n{font-size:40px}
.seg{margin:20px 0 0}
.grid2{margin-top:20px}
.card{padding:20px 22px 24px}
.card .sub{margin-bottom:16px}
footer.note{margin-top:34px;padding-top:16px}

/* 月视图：原 .shell 用 height:calc(100vh - var(--top))，顶栏删了但要给底部导航留位 */
.shell{height:calc(100vh - var(--tab) - 24px);height:calc(100dvh - var(--tab) - 24px);padding:0 40px 16px}
.side,.rail{top:24px}
.side{max-height:calc(100dvh - var(--tab) - 48px)}
.month-top{padding:16px 0 12px}
.month-top h1{font-size:28px}
.month-top h1 em{font-size:12px}

/* ---------- 底部导航与方向切换条同处右下，错开避免重叠 ---------- */
.dirbar{bottom:auto;top:14px;right:14px;z-index:50;opacity:.32}
.dirbar:hover{opacity:1}

/* ---------- 组件样式沿用 D ---------- */
.dateline{display:flex;align-items:baseline;gap:18px;border-bottom:1px solid var(--ink);flex-wrap:wrap}
.dateline b{font-family:var(--serif);font-weight:700;letter-spacing:-.02em;line-height:1}
.dateline span{font-family:var(--mono);font-size:11px;color:var(--ink-3);letter-spacing:.06em}
.pull{background:var(--surface);border:1px solid var(--rule);border-radius:2px}
.pull .lbl{font-family:var(--mono);font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:var(--accent);margin-bottom:10px}
.pull h2{margin:0 0 8px;font-family:var(--serif);line-height:1.4;font-weight:600;letter-spacing:-.01em}
.pull p{margin:0;color:var(--ink-2);font-size:14.5px;line-height:1.85;max-width:640px}
.sect-h{display:flex;align-items:center;gap:14px;margin:0 0 6px}
.sect-h h3{margin:0;font-family:var(--mono);font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:var(--ink-3);font-weight:400}
.sect-h::after{content:"";flex:1;height:1px;background:var(--rule)}
.entry{border-bottom:1px solid var(--rule)}
.entry:last-child{border-bottom:0}
.entry .top-row{display:flex;align-items:baseline;gap:16px}
.entry .idx{font-family:var(--serif);font-size:15px;font-style:italic;color:var(--ink-3);width:30px;flex:none;padding-top:2px}
.entry h4{margin:0;font-family:var(--serif);font-size:21px;font-weight:600;line-height:1.4}
.entry h4 a:hover{color:var(--accent)}
.entry .body{margin:12px 0 0 46px;color:var(--ink-2);font-size:14px;line-height:1.9;max-width:640px}
.tags{display:flex;gap:7px;flex-wrap:wrap;margin:13px 0 0 46px}
.tag{font-family:var(--mono);font-size:10px;letter-spacing:.08em;padding:3px 10px;border:1px solid var(--rule);
  color:var(--ink-2);background:var(--surface);white-space:nowrap}
.tag.type{border-color:var(--ink-3);color:var(--ink)}
.tag.coll{background:var(--ink);color:var(--surface);border-color:var(--ink)}
.tag.hl{border-color:var(--accent);color:var(--accent);background:var(--accent-soft)}
.empty{color:var(--ink-3);font-size:14px;border-bottom:1px solid var(--rule)}
.empty b{display:block;color:var(--ink-2);font-family:var(--serif);font-size:19px;font-weight:600;margin-bottom:8px}
.blk{padding:14px 0 15px;border-top:1px solid var(--rule)}
.blk:first-child{border-top:1px solid var(--ink);padding-top:13px}
.blk-h{display:flex;align-items:baseline;gap:10px;margin-bottom:9px}
.blk-h h3{margin:0;font-family:var(--mono);font-size:9.5px;letter-spacing:.22em;text-transform:uppercase;color:var(--ink-3);font-weight:400}
.blk-h .lnk{margin-left:auto;font-family:var(--mono);font-size:10px;color:var(--ink-3);cursor:pointer}
.blk-h .lnk:hover{color:var(--accent)}
.stat-pair{display:grid;grid-template-columns:1fr 1fr;border:1px solid var(--rule);background:var(--surface);cursor:pointer;transition:.14s}
.stat-pair:hover{border-color:var(--ink-3)}
.stat-pair .p{padding:13px 13px 12px;border-right:1px solid var(--rule)}
.stat-pair .p:last-child{border-right:0}
.stat-pair .p .n{font-family:var(--serif);font-size:30px;font-weight:600;line-height:1;letter-spacing:-.01em}
.stat-pair .p .l{font-family:var(--mono);font-size:9px;letter-spacing:.18em;color:var(--ink-3);margin-top:7px;text-transform:uppercase}
.stat-pair .p .s{font-family:var(--mono);font-size:9.5px;color:var(--ink-3);margin-top:2px}
.stat-pair .p .n.ev{color:var(--ink)}
.stat-pair .p .n.th{color:var(--accent)}
.idx button{border-bottom:1px solid var(--rule-2);color:var(--ink-2)}
.idx button:last-child{border-bottom:0}
.idx button:hover{color:var(--accent)}
.idx button .n{color:var(--ink-3)}
.tagwrap button{border:1px solid var(--rule);background:var(--surface);color:var(--ink-2)}
.tagwrap button:hover{border-color:var(--accent);color:var(--accent)}
.tagwrap button .n{color:var(--ink-3)}
.mini-head{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.mini-head .m{font-family:var(--mono);font-size:11px;letter-spacing:.12em}
.mini-head button{margin-left:auto;border:1px solid var(--rule);background:var(--surface);width:21px;height:21px;line-height:1;cursor:pointer;color:var(--ink-2);padding:0}
.mini-head button+button{margin-left:4px}
.mini-head button:hover{border-color:var(--ink-3);color:var(--ink)}
.mini-dow span{font-family:var(--mono);font-size:9px;color:var(--ink-3);text-align:center;padding-bottom:5px;letter-spacing:.1em}
.mini-grid button{color:var(--ink-3)}
.mini-grid button:hover{border-color:var(--rule);color:var(--ink);background:var(--rule-2)}
.mini-grid button.has{color:var(--ink)}
.mini-grid button .ul{background:var(--ink-3)}
.mini-grid button.hl .ul{background:var(--accent)}
.mini-grid button.sel{border-color:var(--ink);color:var(--ink);font-weight:700}
.mini-grid button.today{background:var(--rule-2);border-color:var(--rule);color:var(--ink);font-weight:600}
.mini-grid button.today.sel{box-shadow:inset 0 0 0 1px var(--ink)}
.mini-grid button.sel .ul{background:var(--ink)}
.mini-grid button.sel.hl .ul{background:var(--accent)}
.mini-foot{margin-top:8px;font-family:var(--mono);font-size:9.5px;color:var(--ink-3);display:flex;gap:11px;flex-wrap:wrap}
.mini-foot i{display:inline-block;width:14px;height:2px;background:var(--ink-3);margin-right:5px;vertical-align:middle}
.mini-foot i.red{background:var(--accent)}
.mini-foot b{display:inline-block;width:11px;height:11px;background:var(--rule-2);border:1px solid var(--rule);margin-right:5px;vertical-align:-1px}
.month-top{display:flex;align-items:flex-end;gap:18px;border-bottom:1px solid var(--ink);flex-wrap:wrap}
.month-top h1{margin:0;font-family:var(--serif);font-weight:600;letter-spacing:-.015em;line-height:1;display:flex;align-items:baseline;gap:16px}
.month-top h1 em{font-style:italic;font-family:var(--serif);font-weight:400;color:var(--ink-3);letter-spacing:.08em}
.month-top .facts{margin-left:auto;display:flex;gap:18px;font-family:var(--mono);font-size:11px;color:var(--ink-2);flex-wrap:wrap}
.month-top .facts b{font-weight:600;color:var(--ink)}
.month-top .pager{display:flex;border:1px solid var(--rule);background:var(--surface)}
.month-top .pager button{padding:7px 13px;font-family:var(--mono);font-size:10.5px;border:0;background:none;cursor:pointer;color:var(--ink-2);border-right:1px solid var(--rule)}
.month-top .pager button:last-child{border-right:0}
.month-top .pager button:hover{background:var(--ink);color:var(--surface)}
.dow{display:grid;grid-template-columns:repeat(7,1fr);padding:12px 0 9px}
.dow span{font-family:var(--mono);font-size:9.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--ink-3);padding-left:11px}
.cell{background:var(--surface);padding:10px 11px 9px}
.cell.void{background:var(--bg)}
.cell:hover{background:var(--rule-2)}
.cell.void:hover{background:var(--bg)}
.cell.hl::before{content:"";position:absolute;left:0;right:0;top:0;height:3px;background:var(--accent)}
.cell.today{box-shadow:inset 0 0 0 1.5px var(--ink)}
.cell .num{font-family:var(--serif);font-size:17px;line-height:1;letter-spacing:-.01em;color:var(--ink-3);font-style:italic}
.cell.today .num{color:var(--ink);font-style:normal;font-weight:700}
.cell.hl .num{color:var(--accent);font-style:normal;font-weight:700}
.cell .mt{display:flex;align-items:center;gap:4px;margin-top:9px}
.cell .mt i{display:block;width:6px;height:6px;border-radius:50%}
.cell .mt i.ev{background:var(--ink)}
.cell .mt i.th{background:var(--accent)}
.cell .mt .n{margin-left:auto;font-family:var(--mono);font-size:10px;color:var(--ink-3)}
.cell .cap{margin-top:8px;font-family:var(--serif);font-size:11.5px;line-height:1.5;color:var(--ink);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.cal-foot{padding:12px 0 0;display:flex;gap:20px;flex-wrap:wrap;font-family:var(--mono);font-size:9.5px;color:var(--ink-3);align-items:center}
.cal-foot .k{display:inline-flex;align-items:center;gap:6px}
.cal-foot .k i{display:inline-block;width:9px;height:3px;background:var(--accent)}
.cal-foot .k b{width:6px;height:6px;background:var(--ink);display:inline-block;border-radius:50%}
.cal-foot .k u{width:6px;height:6px;background:var(--accent);display:inline-block;text-decoration:none;border-radius:50%}
.list-head{background:var(--bg);font-family:var(--mono);font-size:9.5px;letter-spacing:.18em;text-transform:uppercase;color:var(--ink-3)}
.list-head b{margin-left:auto;font-family:var(--mono);font-size:11px;color:var(--ink-2);letter-spacing:0}
.dlrow:hover{background:var(--rule-2)}
.dlrow.flash{background:var(--accent-soft)}
.dlrow .r1{color:var(--ink-3)}
.dlrow .r1 .d{color:var(--ink);font-weight:500}
.dlrow .r1 .mk{color:var(--accent)}
.dlrow h4{margin:0 0 4px;font-family:var(--serif);font-size:14.5px;font-weight:600;line-height:1.5}
.dlrow:hover h4{color:var(--accent)}
.dlrow p{margin:0;font-family:var(--serif);font-size:12px;line-height:1.7;color:var(--ink-2);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.list-empty{padding:28px 0;color:var(--ink-3);font-family:var(--serif);font-size:13px;line-height:1.75}
.head{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;border-bottom:1px solid var(--ink);flex-wrap:wrap}
.head h1{margin:0;font-family:var(--serif);line-height:1.05;letter-spacing:-.02em;font-weight:600}
.head h1 em{font-style:italic;font-family:var(--serif);font-size:14px;font-weight:400;color:var(--ink-3);letter-spacing:.12em;display:block}
.head .aside{font-family:var(--serif);font-size:13px;color:var(--ink-2);max-width:340px;text-align:right;line-height:1.85}
.head .aside b{color:var(--ink);font-weight:600}
.res-head{display:flex;align-items:baseline;gap:12px;padding-bottom:13px;border-bottom:1px solid var(--rule);flex-wrap:wrap}
.res-head h2{margin:0;font-family:var(--serif);font-size:23px;font-weight:600;letter-spacing:-.01em}
.res-head .cnt{font-family:var(--mono);font-size:11px;color:var(--ink-3)}
.res-head .hint{margin-left:auto;font-family:var(--mono);font-size:10px;color:var(--ink-3)}
.resrow .d{font-family:var(--mono);font-size:11px;color:var(--ink-2);line-height:1.5}
.resrow .t{font-family:var(--serif);font-size:15.5px;font-weight:600;line-height:1.5}
.resrow .t a:hover{color:var(--accent)}
.resrow .t .sub{margin-top:6px;font-family:var(--serif);font-weight:400;font-size:12.5px;color:var(--ink-2);line-height:1.7;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden}
.resrow .r .tag{font-family:var(--mono);font-size:9.5px}
.kpi{background:var(--surface)}
.kpi .n{font-family:var(--serif);font-weight:600;letter-spacing:-.02em;line-height:1}
.kpi .n.acc{color:var(--accent)}
.kpi .n.ev{color:var(--ink)}
.kpi .l{margin-top:11px;font-family:var(--mono);font-size:9.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--ink-3)}
.kpi .d{margin-top:7px;font-family:var(--mono);font-size:10.5px;color:var(--ink-2)}
.kpi .d.up{color:var(--accent)}
.kpi .d.dn{color:var(--ink-2)}
.seg{display:flex;border:1px solid var(--rule);width:max-content;background:var(--surface)}
.seg button{border:0;background:none;font-family:var(--mono);font-size:10px;letter-spacing:.18em;text-transform:uppercase;padding:9px 19px;cursor:pointer;color:var(--ink-3);border-right:1px solid var(--rule)}
.seg button:last-child{border-right:0}
.seg button.on{background:var(--ink);color:var(--surface)}
.card{background:var(--surface)}
.card h3{margin:0 0 3px;font-family:var(--serif);font-size:17px;font-weight:600}
.card .sub{font-family:var(--mono);font-size:10px;color:var(--ink-3)}
.rank-row .nm{font-family:var(--serif);font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rank-row .stack i.ev{background:var(--ink)}
.rank-row .stack i.th{background:var(--accent)}
.rank-row .v .up{color:var(--accent)}
.rank-row .v .dn{color:var(--ink-2)}
.rank-row .v .nw{color:var(--accent);border:1px solid var(--accent);padding:0 4px}
.axis{font-family:var(--mono);font-size:10px;fill:var(--ink-3)}
footer.note{padding-top:16px;border-top:1px solid var(--ink);font-family:var(--serif);font-size:12.5px;color:var(--ink-2);line-height:1.95;max-width:880px}
footer.note b{color:var(--ink);font-weight:600}
.dirbar{background:var(--ink)}
.dirbar span{color:rgba(255,255,255,.45)}
.dirbar a{color:rgba(255,255,255,.72)}
.dirbar a:hover{color:#fff;background:rgba(255,255,255,.1)}
.dirbar a.on{background:var(--accent);color:#fff}`;

/* ------------------------------------------------------------------
 * 字体规范（设计文档 §12.2）：标题衬线，小字无衬线
 * 衬线只给「标题级」：h1–h4、大数字（日期 / KPI / 统计数）、品牌字；
 * 其余一律无衬线——小字号衬线（尤其中文）可读性差，且衬线一多就失去对比。
 * 以追加覆盖块挂在方向 CSS 末尾：同特异性后者胜出，规则集中可审（设计文档 §12.2），
 * 不必在几十条散落规则里逐个改。字号分界取 17px（见 §12.2 表格）。
 * ------------------------------------------------------------------ */
const sansSmallText = `
/* ---- 字体规范：标题衬线，小字无衬线 ---- */
.kicker,.nav button,.brand,.tabbar button,
.entry .idx,.head h1 em,.month-top h1 em,
.cell .cap,.dlrow p,.list-empty,.head .aside,
.rank-row .nm,footer.note,.resrow .t .sub{font-family:var(--sans)}
/* .resrow .t 是条目标题（15.5px），虽小仍属标题级 → 保持衬线 */
.resrow .t{font-family:var(--serif)}
/* 原为斜体衬线的标签改无衬线时一并取消斜体（中文斜体是伪斜，发虚） */
.kicker,.entry .idx,.head h1 em,.month-top h1 em{font-style:normal}`;

/* G 的矮视口规则：除格子压缩外，底部导航也要更薄 */
const shortViewportG = () => `
@media(max-height:760px){
  .month-top{padding:12px 0 9px}
  .month-top h1{font-size:23px}
  .dow{padding:7px 0 5px}
  .cell{padding:7px 9px 6px}
  .cell .num{font-size:13px}
  .cell .mt{margin-top:4px}
  .cell .cap{margin-top:4px;font-size:10px;line-height:1.35;-webkit-line-clamp:1}
  .tabbar{bottom:12px}
  .tabbar button{padding:6px 14px;font-size:12.5px}
  .brand{padding-top:10px}
  .head{padding:14px 0 11px}
  .head h1{font-size:27px}
  .dateline{padding:0 0 11px}
  .dateline b{font-size:30px}
  .pull{margin:16px 0 18px;padding:15px 18px}
  .pull h2{font-size:19px}
  .entry{padding:15px 0}
  .wrap{padding:0 40px calc(var(--tab) + 20px)}
  .home{padding-top:16px}
  .index-layout{padding-top:16px}
  .kpi{padding:14px 14px 13px}
  .kpi .n{font-size:32px}
  .card{padding:15px 16px 18px}
  .grid2{margin-top:16px}
  .seg{margin:16px 0 0}
  .seg button{padding:7px 15px}
  .mini-grid button{height:23px}
}`;

/* 每个方向各自补一份矮视口规则：
   structure 里的 @media(max-height:760px) 会被方向 CSS 中 .cell/.cap 的更大字号与
   padding 覆盖，导致矮视口下格子被裁切。方向特定的压缩必须排在方向 CSS 之后。 */
const shortViewport = (cellPad, capLines) => `
@media(max-height:760px){
  .month-top{padding:14px 0 10px}
  .month-top h1{font-size:25px}
  .dow{padding:8px 0 6px}
  .cell{padding:${cellPad}}
  .cell .num{font-size:13px}
  .cell .mt{margin-top:4px}
  .cell .cap{margin-top:4px;font-size:10px;line-height:1.35;-webkit-line-clamp:${capLines}}
}`;

const demos = [
  ['d-edit.html', {
    title: '方向 D · 编辑体 — ctz-bujo-share UI Demo',
    kicker: '方向 D · 编辑体（衬线标题 + 米白纸面）',
    css: cssD + sansSmallText + shortViewport('7px 9px 6px', 1),
    dirbarActive: 'd',
  }],
  ['e-dotted.html', {
    title: '方向 E · 点阵（克制版）— ctz-bujo-share UI Demo',
    kicker: '方向 E · 点阵 + 手写体（沿用瑞士墨线栅格）',
    css: cssE + shortViewport('7px 9px 6px', 1),
    dirbarActive: 'e',
  }],
  ['f-warm.html', {
    title: '方向 F · 暖纸 — ctz-bujo-share UI Demo',
    kicker: '方向 F · 暖纸（奶油底 + 赭红 + 书刊排版）',
    css: cssF + shortViewport('7px 9px 6px', 1),
    dirbarActive: 'f',
  }],
  ['g-bottom.html', {
    title: '方向 G · 底栏编辑体 — ctz-bujo-share UI Demo',
    kicker: '方向 G · 底栏版编辑体（删顶部栏 + 底部居中导航）',
    css: cssG + sansSmallText + shortViewportG(),
    dirbarActive: 'g',
    navPos: 'bottom',
  }],
];

for (const [file, opts] of demos) {
  writeFileSync(join(OUT, file), shell({...opts, body, navOrder}), 'utf8');
  console.log('wrote', file);
}
