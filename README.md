# ctz-bujo-share · 沙楚子的存在证明

记一个研究型设计师的成长之路！

[去日记里逛逛](https://chartreuse310.github.io/ctz-bujo-share/) · [看看我的博客](https://chartreuse310.github.io/blog-ctz-v3/)

最近博客更得越来越少了，碎碎念倒是写了不少。原本每天让 🐳 帮我整理可视化，但还要花不少时间改回自己的语气。后来灵机一动：不如直接把日记做成小卡片？于是就有了这个站。

在这里，你可以见证一个“研究型设计师”的成长之路：一个既希望能毕业，又想画画做设计的人。读论文、折腾代码，中间夹着吃饭、跑步和一些临时冒出来的想法。或许这些记录也能给你的日记一些灵感。

仓库名里的 bujo 来自 Bullet Journal——没错，一开始是想做个 bujo 风格的日记。后来慢慢长成了现在的样子（你可以在 [docs/ui-demos](docs/ui-demos/) 里看到风格变化），把每天的事情和思考留在网页上，再选几条存成小卡片。

## 怎么翻我的日记

- **首页**：随机翻几条重点思考，看看最近的重点事件。
- **本月**：左边是月历，右边是日总结。格子里的小点对应当天条目，红点是重点，黑点是普通记录；点击日期可以看那一天。
- **今日**：默认打开最近更新内容的一天，方便接着读。完全没有内容时才显示当天的空页——如果你遇到这种情况，~~那肯定是搞错了~~。
- **集子 · 标签**：按长期关注的方向和零散主题翻记录。我的集子目前是绘画、博士学位论文、书影音。
- **统计**：按本月、本年或全部记录，查看事件、思考、重点与日总结，以及集子和标签的排行、趋势。

「本月 / 今日 / 集子 · 标签 / 统计」是四个浏览入口，可以左右滑动或用方向键切换。首页独立于这四屏；点击站点名称可以回首页。

## 把日记做成小卡片

打开「今日」，在记录末尾点 **分享今日 ↗**：

1. 勾选想分享的条目，也可以选择当天的日总结。默认全部选中。
2. 点「预览卡片」，按当天原有顺序排版，长内容自动续页。
3. 逐张保存 PNG，发到想分享的地方。

卡片固定为 **1080 × 1440（3:4）**，保留完整正文。能放进一页的条目尽量不拆开；超长条目先按段落、必要时按行续页。每张都有日期、站点名和页码。

改选内容后需要重新预览。正文图片必须能被浏览器读取，失败时会保留选择、提示重试。当前已经验证 Chrome 的分页和实际下载，iOS / Android 真机保存仍待验收。

## 想拿来当自己的日记框架

欢迎克隆下来折腾。日记是本地 Markdown，构建后是一套静态网页，**无后端、无账号，内容完全公开**。

仓库里的 `content/` 是我的真实日记。复用前请先换成自己的内容，调整集子、标签、首页介绍和站点名称；文档中的写作例子只是格式示意，不会自动生成记录。`AGENTS.md` 里也有本项目的个人约定，交给 Agent 帮你写日记时，记得改成自己的偏好。

### 先跑起来

推荐使用 Node.js 24 和 npm，与 CI 一致；仓库已包含锁文件。下面的命令可以先在本地试用。

```bash
git clone https://github.com/Chartreuse310/ctz-bujo-share.git
cd ctz-bujo-share
npm ci
npm run serve
```

在终端输出的地址打开预览，端口以实际输出为准。`npm run serve` 使用空路径前缀，方便本地访问。

### 写一条记录

例如新建 `content/entries/2026-10-18-a-small-step.md`：

```markdown
---
type: thought
title: 今天想明白的一小步
date: 2026-10-18
highlight: true
order: 1
---

不一定要等想得很完整才写下来。先记住这一刻，之后再慢慢接着想。
```

- `type`：`event` 是发生的事，`thought` 是想法或反思。
- `date`：记录归属的日期，允许未来日期，必须是真实存在的日期。
- `highlight`：选填，默认 `false`。手动设为 `true` 才会进入首页的重点展示。
- `order`：选填整数，只管同一天的顺序。有值的升序排在前面，没写的按文件名跟在后面，相同时用文件名兜底。
- `collection`：选填，只能归入一个已登记集子；不填归入主集子「日常」。
- `tags`：选填数组，可以引用多个已登记标签；名称里可以有空格。

例如研究记录可以加上已有的分类：

```yaml
collection: 博士学位论文
tags: ["PhD V2.0 P1.1"]
```

文件名决定条目 URL，例如上面的记录会生成 `/entry/2026-10-18-a-small-step/`。改标题不改链接；也支持用 front matter 的 `slug` 显式覆盖，日常直接使用文件名即可。

### 给一天留个小结

例如新建 `content/daily/2026-10-18.md`：

```markdown
---
title: 留下一点，明天接着写
---

今天做了什么、哪些事还没想明白，都可以放在这里。
```

一天一篇，日期直接取文件名，front matter **不要再写 `date`**。日总结会显示在日页和月历里，单独计数，不算作事件或思考条目。

### 集子与标签

在 [content/taxonomy.yml](content/taxonomy.yml) 里先登记，再在条目中引用。集子是一对一，标签是多对多；未登记的名称会让构建报错，并给出可复制的登记片段。

显示名可以用中文，URL 的 `slug` 要自己确定，只能用小写字母、数字和单连字符。改显示名时保留 slug，旧链接就不会失效。让 Agent 帮忙录入时，本仓库约定新增集子或标签先向我确认。

### 公开之前再看一眼

这套框架没有私密条目功能。请留意精确位置、固定行程、联系方式，以及能拼出自己或他人身份的线索。我的约定是：Agent 遇到这类信息，先提醒并给出删去或模糊化的建议。

已经提交到公开仓库的信息，改掉当前页面也不等于清除了 Git 历史。写下去之前多看一眼，会比之后再处理省心。

## 框架是怎么搭的

**Eleventy 负责模板，`lib/` 负责数据处理，zod 负责校验，js-yaml 使用 `JSON_SCHEMA` 解析 YAML。** 月历、统计在构建时计算，图表用内联 SVG，分享卡片在浏览器里排版并导出图片。

```text
content/
  entries/          每条事件或思考，一个 Markdown 文件
  daily/            每天的日总结
  taxonomy.yml      集子和标签登记表
lib/                校验、内容读取、月历、统计、首页聚合等纯函数
src/                Eleventy 模板、CSS 与浏览器脚本
  _data/site.js     构建时加载内容并组织页面数据
scripts/            文档与浏览器约束检查
test/              单元测试和构建回归测试
docs/               想法、设计、实现计划和视觉原型
.github/workflows/  GitHub Pages 构建发布
```

`content/` 作为数据读取，不直接交给模板引擎；`lib/` 不依赖 Eleventy。字段、日期或分类引用有误时，构建会中止。具体约定见 [设计文档](docs/specs/2026-10-14-ctz-bujo-share-design.md)，文档分层见 [docs/README.md](docs/README.md)。

### 构建与发布

准备发布自己的日记时，先 Fork 到自己的 GitHub 账号再克隆该副本，或将本地仓库的 `origin` 改为自己的仓库。

```bash
npm test
npm run build
```

产物在 `_site/`。默认路径前缀是 `/ctz-bujo-share`，对应本站的 GitHub Pages 项目地址。如果自己的仓库改了名，构建时通过 `CTZ_BASE_URL` 设置对应前缀；部署在域名根路径时设为空字符串。

仓库通过 GitHub Actions 发布：推送 `main` 或每日 UTC 21:00（北京时间次日 05:00）的定时任务，依次执行 `npm ci`、`npm test`、`npm run build`，成功后部署到 GitHub Pages。复用时，在自己仓库启用 Actions，并在 Pages 设置中选择 GitHub Actions，并确认构建前缀与发布地址一致。定时构建可能延迟，站点内容在两次构建之间保持不变。

### 验证

```bash
npm test                           # 纯函数测试与端到端构建回归
node scripts/check-readme.mjs       # README 示例、命令和仓库内链接
node scripts/check-agents-md.mjs    # 协作指令中的章节和路径
node scripts/verify-plan.mjs        # 实现计划里的代码与测试
```

需要验证界面时，先启动本地服务和 CDP 9333 的 headless Chrome，再运行：

```bash
SITE_URL=http://127.0.0.1:8081 npm run check
SITE_URL=http://127.0.0.1:8081 node scripts/check-home-constraints.mjs
SITE_URL=http://127.0.0.1:8081 node scripts/check-share-constraints.mjs
```

`SITE_URL` 的端口按本地服务实际输出填写。浏览器检查会机械测量裁切、溢出、遮挡和交互，不靠看截图判断。

## 许可

**代码与文档**用 [MIT](LICENSE)：可以拿去改、拿去用，保留版权声明即可。

**日记本身**不是代码，用 [CC BY-NC-ND 4.0](LICENSE-CONTENT.md) 授权，范围只有 `content/entries/` 与 `content/daily/` 里的文章：可以带署名转发原文，也可以引用；但不能商用，也不能改编、翻译或续写后发布。`content/taxonomy.yml`、README、AGENTS.md 和 `docs/` 都随 MIT 走——复用时本来就得改它们。

拿这些记录当灵感写你自己的日记完全没问题，想法本身不受版权保护。

## 还有我的博客

[blog-ctz-v3](https://chartreuse310.github.io/blog-ctz-v3/) 还是会保持不定期更新的。这里放日常记录，长一点的东西慢慢写进博客。

有兴趣欢迎来玩，也欢迎加友链！最近超喜欢看一些人类的随机表达。
