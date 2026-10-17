# ctz/bujo

bujo（Bullet Journal）风格的公开日记与思考分享站。本地写 Markdown → 构建成静态站，内容就在本仓库里，完全公开。

技术路线：Eleventy（只当模板层）+ `lib/` 自定义纯函数 + `zod` 校验。无后端、无账号。

## 目录结构

```
content/            你的内容（纯数据，不进模板管线）
  taxonomy.yml      集子与 tag 的唯一登记表
  entries/          条目：YYYY-MM-DD-<slug>.md
  daily/            日总结：YYYY-MM-DD.md（文件名即日期，一天一条）
lib/                纯函数（校验 / 月历 / 统计），不依赖 Eleventy，node --test 可单测
src/                Eleventy 输入目录（模板 + 静态资源）
  _data/site.js     构建时一次性校验全部内容并预计算统计
scripts/            验证脚本
docs/               设计文档（docs/specs/ 是唯一真相源）
```

## 写一条条目

新建 `content/entries/2026-10-14-example.md`：

```markdown
---
type: thought            # event（发生的事）或 thought（想法/反思）
title: 把时间轴画成了图
date: 2026-10-14         # 允许未来日期，不设上限
highlight: true          # 选填，标为重点（手动标记，系统不自动判定）
collection: 博士学位论文  # 选填；不填归主集子「日常」
tags: ["PhD V2.0 P1.1"]  # 选填；tag 名可含空格
---

正文 Markdown。画到一半发现，真正难的不是排列顺序，是给每一段找边界。
```

- 文件名 `YYYY-MM-DD-<slug>.md` 决定 URL `/entry/<YYYY-MM-DD>-<slug>/`；front matter 写 `slug:` 可覆盖。
- `date` 写 `YYYY-MM-DD` 且必须是真实存在的日期（`2026-02-30` 会构建报错）。

## 写一条日总结

新建 `content/daily/2026-10-14.md`（文件名即日期，**不要**在 front matter 里写 date）：

```markdown
---
title: 把想法画成图，一下清楚了
---

正文。
```

## 常用命令

```bash
npm install        # 首次
npm run build      # 构建到 _site/
npm run serve      # 本地预览（http://localhost:8081）
npm test           # 全部测试（lib 单测 + 端到端构建断言）
npm run check      # 真实站点硬约束验证（需 headless Chrome:9333 + 本地服务）
```

## 把今日记录保存为分享卡片

打开「今日」，在主栏记录末尾点击「分享今日 ↗」。默认勾选全部条目和已有的今日小结；取消不想分享的内容，再点「预览卡片」，按页点击「保存第 N 张 PNG」。图片固定为 1080 × 1440（3:4），使用完整正文并自动续页，勾选不会改变当天排序。

没有选择内容时不能导出。改选内容会清空旧预览，需要重新预览；图片或生成步骤失败时会保留选择，可重试。正文中的远程图片需要允许浏览器读取，否则会提示生成失败。

分享回归：先启动本地服务与 CDP 9333 的无头 Chrome，再执行 `SITE_URL=http://127.0.0.1:8081 node scripts/check-share-constraints.mjs`（端口按服务实际输出填写）。脚本使用隔离样例，不写入公开日记，检查分页、裁切、遮挡、图片失败重试与 PNG 实际下载。手机模拟不等同于 iOS/Android 真机保存验收。

## 新增 tag / 集子：必须先登记

`content/taxonomy.yml` 是集子与 tag 的唯一真相源。**先登记、后引用**——条目里写了未登记的名字，构建直接报错并给出可复制的登记片段。新增集子/ tag 前先与维护者确认（集子门槛更高：它是「长期大量记录的方向」）。

- `slug` 强制小写字母/数字/连字符（`^[a-z0-9]+(-[a-z0-9]+)*$`）；显示名可中文。
- 改名只动 `name` 不动 `slug`；条目只按显示名引用。
