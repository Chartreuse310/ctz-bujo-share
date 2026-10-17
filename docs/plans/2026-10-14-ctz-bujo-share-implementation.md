# ctz-bujo-share 实现计划

**目标**：把已定稿的设计文档（`docs/specs/2026-10-14-ctz-bujo-share-design.md`）落成一个可构建、可发布的静态日记站——本地写 Markdown，跑一次构建产出「本月 / 今日 / 集子·标签 / 统计」四屏与条目详情页。

**架构**：Eleventy 只当模板层，`content/` 是纯数据、由 `lib/` 用 zod 校验成普通对象；`src/_data/site.js` 把校验结果喂给模板。`lib/` 不 import Eleventy，因此能脱离构建用 `node --test` 单测。视觉基线是已定稿的 **D 编辑体 + G1 细线底栏**（`docs/ui-demos/g1-line.html`），CSS 从该文件移植，**不重新设计**。

**技术栈**：Node 24.17.0 / @11ty/eleventy 3.1.6 / zod 4.6.7 / js-yaml ^4.1.1（见决策 1）/ node:test（内置）

---

## 已实证的基线（本次 spike 实测，非推测）

在 `/tmp/elspike7` 用真实依赖跑通了本计划的目标架构，以下均为实测结论：

| 事实 | 实测结果 | 对计划的影响 |
| --- | --- | --- |
| `src/` 作输入目录、`content/` 作纯数据 | 构建产出 `/entry/<slug>/`、`/`，正文 Markdown 正确渲染 | 与设计文档 §3 分层一致，可直接落地 |
| 正文渲染 | 用 Eleventy 自带 `RenderPlugin` 的 `renderContent("md")`，**不必引 markdown-it** | 避免幻影依赖 |
| 正文里的 `{{ }}` / `{% %}` | `renderContent` 只跑 Markdown，模板语法**原样保留** | 作者可以放心写模板语法示例 |
| `content/*.md` 作为 Eleventy 模板 | front matter 的 `{% %}` 会让 **构建崩溃**（Markdown 默认走 Liquid 预处理） | 所以 `content/` 不作模板来源，只作数据 |
| `page.fileSlug` / `filePathStem` | **会剥掉日期前缀**（`2026-10-14-read-a-book` → `read-a-book`） | slug 必须从文件名自己派生，见 Task 1.3 |
| YAML `date: 2026-10-14` 默认解析 | 变成 JS `Date`；负时区下本地日期**错一天**（纽约时区 `getDate()` 得 10-13） | 一律用 `yaml.JSON_SCHEMA`，日期保持字符串 |
| YAML `date: 2026-02-30` 默认解析 | **静默滚成 2026-03-02**（非法日期被吞） | 必须 `JSON_SCHEMA`，否则违反设计文档 §7 |
| `z.iso.date()`（zod v4） | 正确拒绝 `2026-02-30`、`2026-13-01`、`2026-2-3`；闰年判断正确（`2024-02-29` 通过、`2026-02-29` 拒绝） | 直接用，不必手写日期校验 |
| zod v4 issue 对象 | 有 `path`/`code`/`message`，**不可靠地携带原始输入** | 「实际值」必须按 `path` 回原对象里取，见 Task 1.1 |
| Eleventy 对 `.yml` / `.yaml` | **不原生解析**（已用 JS 数据文件探针排除假阴性） | taxonomy 必须自己解析，见决策 1 |
| `tags` 是 Eleventy 保留 front matter 键 | 目录数据文件的 `tags` 会覆盖内容 front matter 的 `tags` | 本架构下 content 的 front matter 不进 Eleventy，**不受影响** |
| 构建期校验失败 | 打印 `✖ 文件 / 字段 / 实际 / 期望`，退出码 1，**没有任何 HTML 页面**产出 | 满足设计文档 §7「失败必须中断」 |
| 失败时输出目录 | **仍会被创建**，里面只剩 `assets/`（passthrough copy 先于校验执行） | e2e 断言不能写「目录不存在」，要写「无 HTML 页面」，见 Task 4.1 |
| `node --test test/`（Node 24.17.0） | **直接失败**：`Cannot find module '.../test'`、`pass 0 / fail 1`、退出码 1 | `package.json` 的 `test` 必须写裸 `node --test`，见 Task 0.1 |
| `node --test` 自动发现 | 会把 `test/` 下**所有** `.js` 当测试跑（连只导出常量的 helper 也算一个测试） | `test/` 里不放非测试文件；fixture 写 `os.tmpdir()` |
| `src/assets/` 下的 css/js | 需显式 `addPassthroughCopy("src/assets")` 才会进 `_site/assets/`（也可靠 `templateFormats` 隐式复制） | 见 Task 2.2 |
| `lib/` 位于输入目录之外被 `site.js` import | 实测可用（`import { loadContent } from "../../lib/load.js"`） | `lib/` 能脱离 Eleventy 单测，符合设计文档 §3/§9 |

---

## 已拍板的 1 个决策

### 决策 1：taxonomy 的 YAML 解析依赖 —— ✅ 已定：方案 A（js-yaml），2026-10-14 用户拍板

**问题**：设计文档 §7 写「zod 是除 Eleventy 之外**唯一**引入的依赖」。但实测证明 Eleventy v3 **不原生解析 `.yml`/`.yaml`**，而 `content/taxonomy.yml` 是设计文档指定的分类真相源，必须解析。因此「只加 zod」在物理上做不到。

**三个选项**

| 选项 | 做法 | 代价 |
| --- | --- | --- |
| **A（推荐）** | 显式声明 `js-yaml@^4.1.1` 为直接依赖，用它解析 taxonomy。front matter 自己按 `---` 切分（约 8 行，有单测） | 依赖从 2 个变 3 个；`js-yaml` 零运行时依赖、Eleventy 自己也在用（其 `package.json` 里就是 `js-yaml@^4.1.1`），锁成同 major 可去重 |
| B | 把 `content/taxonomy.yml` 改成 `taxonomy.11tydata.js`（JS 对象），零新依赖 | **改动已定稿的数据格式**，设计文档 §4.3 与 §11 都要改，且用户写 taxonomy 时失去 YAML 的可读性 |
| C | `import yaml from "js-yaml"` 但**不写进 package.json**（吃 Eleventy 的传递依赖） | 幻影依赖：Eleventy 升级或换 pnpm 严格链接就会**直接构建失败**，不可接受 |

**✅ 用户已拍板选 A（2026-10-14）**，本计划按 A 编写，无需改动。若当初选 B，只需把 Task 1.2 / 1.4 里的 `readYaml` 换成 `import`，其余任务不变。硬规矩：`yaml.load` 必须带 `{ schema: yaml.JSON_SCHEMA }`（Task 1.2 已如此实现并有测试）。

---

## 目录与文件总览

**新建**

```
package.json
eleventy.config.js
.gitignore                      （已存在且已含 _site/，本计划不改它）
content/taxonomy.yml
content/entries/2026-10-14-example.md
content/daily/2026-10-14.md
lib/schema.js                   zod schema + 统一错误格式
lib/frontmatter.js              --- 切分 + js-yaml(JSON_SCHEMA)
lib/taxonomy.js                 登记表校验 + name→slug 解析
lib/load.js                     读文件 → 校验 → 归一化记录
lib/calendar.js                 月历网格 + 月列表排序
lib/stats.js                    统计聚合
src/_data/site.js               全局数据：调 lib/
src/_includes/base.njk          页面外壳（含 G1 底栏）
src/_includes/entry.njk         条目页版式
src/index.njk                   今日（首页）
src/month.njk                   /month/<YYYY-MM>/ 列表页
src/day.njk                     /day/<YYYY-MM-DD>/
src/entry.njk                   /entry/<slug>/
src/collection.njk              /collection/<slug>/（含 all）
src/tag.njk                     /tag/<slug>/
src/stats.njk                   /stats/
src/assets/style.css            设计系统（从 g1-line.html 移植）
src/assets/nav.js               四屏切换（键盘/滑动手势）
test/schema.test.js
test/frontmatter.test.js
test/taxonomy.test.js
test/load.test.js
test/calendar.test.js
test/stats.test.js
test/e2e.test.js
scripts/check-site-constraints.mjs   真实站点的硬约束验证（CDP）
```

**不改**：`docs/ui-demos/*`（原型冻结，只作视觉参照与 CSS 来源）、`scripts/gen-ui-demos.mjs`、`docs/specs/*.md`（定稿设计，除回填变更记录）。

**基础约定**

- 包管理用 **npm**（`package-lock.json` 入库）。若你倾向 pnpm，把 `npm` 全部换成 `pnpm` 即可，其余不变。
- ESM（`"type": "module"`），与 Eleventy 3 的 ESM 配置一致。
- 提交粒度：每个 Task 末尾提交一次，message 用 `feat:` / `test:` / `docs:` / `chore:`。

---

# 阶段 0 · 骨架与依赖

### Task 0.1：package.json 与依赖

**目标**：项目可安装、可跑 Eleventy、可跑 `node --test`。

**文件**：新建 `package.json`、`.gitignore`（追加）

**Step 1**：写 `package.json`

```json
{
  "name": "ctz-bujo-share",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "bujo 风格的公开日记与思考分享站",
  "scripts": {
    "build": "eleventy",
    "serve": "eleventy --serve",
    "test": "node --test",
    "check": "node scripts/check-site-constraints.mjs"
  },
  "dependencies": {
    "@11ty/eleventy": "^3.1.6",
    "zod": "^4.6.7",
    "js-yaml": "^4.1.1"
  }
}
```

> `js-yaml` 锁 `^4.1.1` 与 Eleventy 自己的依赖声明同 major，npm 会去重成同一份。

> ⚠️ **`"test"` 必须是裸的 `node --test`，不能写 `node --test test/`**（实测 2026-10-14，Node v24.17.0）：本机 Node 把 `test/` 当**模块路径**加载，直接抛 `Error: Cannot find module '/private/tmp/.../test'`，报 `pass 0 / fail 1`、退出码 1。`node --test ./test/` 与 `node --test test` 同样失败。可用写法：裸 `node --test`（自动发现）或显式 glob `node --test 'test/**/*.test.js'`。本计划用裸 `node --test`。
>
> 注意裸 `node --test` 的发现范围很宽——它会把 `test/` 下**所有** `.js` 都当测试执行（实测连一个只导出常量的 `test/helper.js` 也被算成一个测试）。因此**不要在 `test/` 里放非测试的 helper/fixture 文件**；本计划的 fixture 一律写到 `os.tmpdir()` 临时目录（见 Task 1.6），e2e 产物写到 `.e2e-site/`。

**Step 2**：`.gitignore` 构建产物

> 实测（2026-10-14）：`.gitignore` **已经包含** `node_modules/`、`_site/`、`dist/`、`.DS_Store`、`.workbuddy-ai/`，**但没有 `.e2e-site/`**（Task 4.1 的 e2e 构建输出目录）。本步需要追加的只有这一项：

```bash
printf '\n# 端到端测试产物\n.e2e-site/\n' >> .gitignore
```

> 不要重复追加 `_site/`（上轮草案要求追加，会留下重复行）；改动前先 `cat .gitignore` 核对。

**Step 3**：安装

```bash
npm install
```

预期：`node_modules/` 出现，`npx eleventy --version` 输出 `3.1.6`。

**Step 4**：验证依赖树里 js-yaml 只有一份

```bash
npm ls js-yaml
```

预期：输出 `js-yaml@4.x` 且**不出现 `deduped` 之外的重复版本**。

**Step 5**：提交

```bash
git add package.json package-lock.json .gitignore
git commit -m "chore: 初始化项目与依赖（eleventy + zod + js-yaml）"
```

---

### Task 0.2：目录骨架与空测试跑通

**目标**：`npm test` 在零测试时不报错，为 TDD 铺路。

**文件**：新建 `lib/`、`src/_data/`、`src/_includes/`、`src/assets/`、`test/`、`content/entries/`、`content/daily/`、`scripts/`

**Step 1**：建目录

```bash
mkdir -p lib src/_data src/_includes src/assets test content/entries content/daily scripts
```

**Step 2**：写一个占位测试，确认测试框架可用

`test/smoke.test.js`：

```js
import { test } from "node:test";
import assert from "node:assert/strict";

test("node:test 可用", () => {
  assert.equal(1 + 1, 2);
});
```

**Step 3**：跑测试

```bash
npm test
```

预期：`# pass 1`，退出码 0。

**Step 4**：提交

```bash
git add -A
git commit -m "chore: 建立目录骨架与测试入口"
```

---

# 阶段 1 · lib/ 纯函数（TDD）

> 这一阶段的每个 Task 都走完整 TDD 循环：**先写失败测试 → 确认失败 → 最小实现 → 确认通过 → 提交**。
> 设计文档 §9 明确要求 `lib/` 可脱离 Eleventy 单测，所以这里**不允许** import 任何 Eleventy 模块。

### Task 1.1：统一错误格式 `fail()`

**目标**：实现设计文档 §7 要求的错误输出格式：`文件路径 + 字段 + 实际值 + 期望值`。

**文件**
- 新建：`lib/schema.js`
- 测试：`test/schema.test.js`

**Step 1：写失败测试**

`test/schema.test.js`：

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { fail, ContentError } from "../lib/schema.js";

test("fail 抛 ContentError，消息含文件、字段、实际值、期望值", () => {
  const err = (() => {
    try { fail("content/entries/a.md", "type", "thougt", "event 或 thought"); }
    catch (e) { return e; }
  })();
  assert.ok(err instanceof ContentError);
  assert.match(err.message, /content\/entries\/a\.md/);
  assert.match(err.message, /type/);
  assert.match(err.message, /thougt/);
  assert.match(err.message, /event 或 thought/);
});

test("实际值是对象时用 JSON 打印，不抛二次异常", () => {
  const err = (() => {
    try { fail("a.md", "tags", ["x", "y"], "字符串数组"); }
    catch (e) { return e; }
  })();
  assert.match(err.message, /\["x","y"\]/);
});

test("实际值是 undefined 时也能打印", () => {
  const err = (() => {
    try { fail("a.md", "title", undefined, "非空字符串"); }
    catch (e) { return e; }
  })();
  assert.match(err.message, /undefined/);
});
```

**Step 2：确认失败**

```bash
node --test test/schema.test.js
```

预期：FAIL —— `Cannot find module '.../lib/schema.js'`

**Step 3：最小实现**

`lib/schema.js` 开头：

```js
import { z } from "zod";

/** 内容校验错误：构建时必须中断并打印可定位的信息。 */
export class ContentError extends Error {
  constructor(message) {
    super(message);
    this.name = "ContentError";
  }
}

/**
 * 按设计文档 §7 的格式报错：文件路径 + 字段 + 实际值 + 期望值。
 * @param {string} file    项目相对路径
 * @param {string} field   front matter 字段名（或 "(文件名)"）
 * @param {unknown} actual 实际拿到的值
 * @param {string} expected 期望说明
 */
export function fail(file, field, actual, expected) {
  const shown = actual === undefined ? "undefined" : JSON.stringify(actual);
  throw new ContentError(
    `\n✖ ${file}\n  字段: ${field}\n  实际: ${shown}\n  期望: ${expected}\n`
  );
}
```

**Step 4：确认通过**

```bash
node --test test/schema.test.js
```

预期：`# pass 3`

**Step 5：提交**

```bash
git add lib/schema.js test/schema.test.js
git commit -m "feat: 内容校验统一错误格式"
```

---

### Task 1.2：front matter 切分 `parseFrontMatter()`

**目标**：把 `---\n<yaml>\n---\n<body>` 切成 `{ data, body }`，且 YAML 用 `JSON_SCHEMA` 解析——这是防止日期被静默滚动的关键。

**文件**
- 新建：`lib/frontmatter.js`
- 测试：`test/frontmatter.test.js`

**Step 1：写失败测试**

`test/frontmatter.test.js`：

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFrontMatter } from "../lib/frontmatter.js";

test("切出 front matter 与正文", () => {
  const { data, body } = parseFrontMatter("---\ntitle: 标题\n---\n正文内容\n");
  assert.equal(data.title, "标题");
  assert.equal(body.trim(), "正文内容");
});

test("date 保持字符串，不变成 Date（时区安全）", () => {
  const { data } = parseFrontMatter("---\ndate: 2026-10-14\n---\n");
  assert.equal(typeof data.date, "string");
  assert.equal(data.date, "2026-10-14");
});

test("非法日期保持原样，不被静默滚动成下个月", () => {
  const { data } = parseFrontMatter("---\ndate: 2026-02-30\n---\n");
  assert.equal(data.date, "2026-02-30");
});

test("bool / 数组 / 数字类型正确", () => {
  const { data } = parseFrontMatter("---\nhighlight: true\ntags: [跑步, 播客]\nn: 3\n---\n");
  assert.equal(data.highlight, true);
  assert.deepEqual(data.tags, ["跑步", "播客"]);
  assert.equal(data.n, 3);
});

test("没有 front matter 时 data 为空对象、body 是全文", () => {
  const { data, body } = parseFrontMatter("只有正文\n");
  assert.deepEqual(data, {});
  assert.equal(body, "只有正文\n");
});

test("正文里出现 --- 不被误判为 front matter 结束", () => {
  const { data, body } = parseFrontMatter("---\ntitle: t\n---\n前\n\n---\n\n后\n");
  assert.equal(data.title, "t");
  assert.match(body, /前/);
  assert.match(body, /后/);
});

test("空正文允许", () => {
  const { body } = parseFrontMatter("---\ntitle: 只有标题\n---\n");
  assert.equal(body, "");
});

test("YAML 语法错误时抛 ContentError 且带文件路径", () => {
  assert.throws(
    () => parseFrontMatter("---\n: : bad\n---\n", "content/entries/x.md"),
    (e) => e.name === "ContentError" && /content\/entries\/x\.md/.test(e.message)
  );
});
```

**Step 2：确认失败**

```bash
node --test test/frontmatter.test.js
```

预期：FAIL —— 模块不存在。

**Step 3：最小实现**

`lib/frontmatter.js`：

```js
import yaml from "js-yaml";
import { fail } from "./schema.js";

/**
 * 用 JSON_SCHEMA 解析 YAML：日期保持字符串。
 *
 * 为什么不是默认 schema（实测结论，勿改）：
 *  - `date: 2026-10-14` 默认会被解析成 JS Date，负时区下 toISOString 与本地日期不一致，会错一天；
 *  - `date: 2026-02-30` 默认会被静默滚成 2026-03-02，而设计文档 §7 要求这种日期必须报错。
 * JSON_SCHEMA 两个问题都消除：日期一律是原始字符串，交给 zod 的 z.iso.date() 判定。
 */
const YAML_OPTS = { schema: yaml.JSON_SCHEMA };

export function parseYaml(text, file = "(yaml)") {
  try {
    return yaml.load(text, YAML_OPTS) ?? {};
  } catch (e) {
    fail(file, "(YAML 语法)", String(e.message).split("\n")[0], "合法 YAML");
  }
}

/**
 * 把 `---\n<yaml>\n---\n<body>` 切成 { data, body }。
 * 只有文件**开头**的 `---` 才是 front matter 定界符，正文里的 `---` 不受影响。
 */
export function parseFrontMatter(raw, file = "(unknown)") {
  const text = String(raw ?? "").replace(/^\uFEFF/, "");
  if (!/^---\r?\n/.test(text)) return { data: {}, body: text };

  const rest = text.replace(/^---\r?\n/, "");
  // 找到独占一行的结束定界符（支持 --- 与 ...）
  const m = rest.match(/^(?:---|\.\.\.)[ \t]*\r?\n/m);
  if (!m) fail(file, "(front matter)", "缺少结束定界符 ---", "以 --- 独占一行结束");

  const yamlText = rest.slice(0, m.index);
  const body = rest.slice(m.index + m[0].length);
  return { data: parseYaml(yamlText, file), body };
}
```

**Step 4：确认通过**

```bash
node --test test/frontmatter.test.js
```

预期：`# pass 8`

**Step 5：提交**

```bash
git add lib/frontmatter.js test/frontmatter.test.js
git commit -m "feat: front matter 解析（JSON_SCHEMA，日期保持字符串）"
```

---

### Task 1.3：条目 schema `validateEntry()`

**目标**：按设计文档 §4.1 校验条目，slug 从**文件名**派生（因为实测 `page.fileSlug` 会剥掉日期前缀）。

**文件**
- 修改：`lib/schema.js`
- 测试：`test/schema.test.js`（追加）

**Step 1：写失败测试**

追加到 `test/schema.test.js`：

```js
import { validateEntry } from "../lib/schema.js";

const TAX = {
  default_collection_name: "日常",
  collections: [{ name: "绘画", slug: "drawing" }],
  tags: [{ name: "跑步", slug: "running" }],
};

const base = {
  type: "thought",
  title: "标题",
  date: "2026-10-14",
  body: "正文",
};

test("合法条目通过并补齐默认值", () => {
  const r = validateEntry(base, "content/entries/2026-10-14-a.md", TAX, "2026-10-14-a.md");
  assert.equal(r.highlight, false);
  assert.deepEqual(r.tags, []);
  assert.equal(r.collectionName, "日常");
  assert.equal(r.slug, "2026-10-14-a");
  assert.equal(r.url, "/entry/2026-10-14-a/");
});

test("slug 含日期前缀，来自文件名", () => {
  const r = validateEntry(base, "f", TAX, "2026-10-14-read-a-book.md");
  assert.equal(r.url, "/entry/2026-10-14-read-a-book/");
});

test("front matter 显式 slug 覆盖文件名", () => {
  const r = validateEntry({ ...base, slug: "custom-slug" }, "f", TAX, "2026-10-14-x.md");
  assert.equal(r.url, "/entry/custom-slug/");
});

test("type 拼错即报错且消息含文件路径", () => {
  assert.throws(
    () => validateEntry({ ...base, type: "thougt" }, "content/entries/bad.md", TAX, "bad.md"),
    (e) => e.name === "ContentError" && /content\/entries\/bad\.md/.test(e.message) && /event 或 thought/.test(e.message)
  );
});

test("title 缺失或空报错", () => {
  assert.throws(() => validateEntry({ ...base, title: "" }, "f", TAX, "f.md"), /title/);
  assert.throws(() => validateEntry({ ...base, title: undefined }, "f", TAX, "f.md"), /title/);
});

test("date 不存在（2026-02-30）报错", () => {
  assert.throws(
    () => validateEntry({ ...base, date: "2026-02-30" }, "f", TAX, "f.md"),
    /date/
  );
});

test("date 格式不合法报错", () => {
  for (const d of ["2026-2-3", "2026/10/14", "not-a-date", "2026-13-01"]) {
    assert.throws(() => validateEntry({ ...base, date: d }, "f", TAX, "f.md"), /date/, `应拒绝 ${d}`);
  }
});

test("未来日期允许（设计文档 §7 明确）", () => {
  const r = validateEntry({ ...base, date: "2099-01-01" }, "f", TAX, "f.md");
  assert.equal(r.date, "2099-01-01");
});

test("highlight 非布尔报错", () => {
  assert.throws(() => validateEntry({ ...base, highlight: "yes" }, "f", TAX, "f.md"), /highlight/);
});

test("collection 引用未登记集子报错，并列出可选项", () => {
  assert.throws(
    () => validateEntry({ ...base, collection: "不存在" }, "f", TAX, "f.md"),
    (e) => /不存在/.test(e.message) && /绘画/.test(e.message)
  );
});

test("tags 引用未登记 tag 报错，并列出可选项", () => {
  assert.throws(
    () => validateEntry({ ...base, tags: ["跑步", "未登记"] }, "f", TAX, "f.md"),
    (e) => /未登记/.test(e.message) && /跑步/.test(e.message)
  );
});

test("tags 不是数组报错；元素空字符串报错", () => {
  assert.throws(() => validateEntry({ ...base, tags: "跑步" }, "f", TAX, "f.md"), /tags/);
  assert.throws(() => validateEntry({ ...base, tags: [""] }, "f", TAX, "f.md"), /tags/);
});

test("collection 非字符串报错", () => {
  assert.throws(() => validateEntry({ ...base, collection: 123 }, "f", TAX, "f.md"), /collection/);
});

test("未知字段只警告不中断", () => {
  const warns = [];
  const r = validateEntry({ ...base, titel: "拼错" }, "f", TAX, "f.md", (m) => warns.push(m));
  assert.equal(r.title, "标题");
  assert.equal(warns.length, 1);
  assert.match(warns[0], /titel/);
});

test("正文允许为空", () => {
  const r = validateEntry({ ...base, body: "" }, "f", TAX, "f.md");
  assert.equal(r.body, "");
});
```

**Step 2：确认失败**

```bash
node --test test/schema.test.js
```

预期：FAIL —— `validateEntry` 未导出。

**Step 3：实现**

追加到 `lib/schema.js`：

```js
/** slug 规则（设计文档 §4.3）：小写字母 + 数字 + 单连字符。 */
export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** 已知字段，用于「未知字段只警告」的判定。 */
const ENTRY_KNOWN = new Set([
  "type", "title", "date", "highlight", "collection", "tags", "slug", "body",
]);

const entrySchema = z.object({
  type: z.enum(["event", "thought"], { error: "只能是 event 或 thought" }),
  title: z.string().min(1, { error: "不能为空" }),
  date: z.iso.date({ error: "必须是 YYYY-MM-DD 且是真实存在的日期" }),
  highlight: z.boolean({ error: "必须是布尔值 true/false" }).default(false),
  collection: z.string({ error: "必须是字符串" }).optional(),
  tags: z.array(z.string().min(1, { error: "元素不能为空字符串" }), { error: "必须是数组" }).default([]),
  slug: z.string().regex(SLUG_RE, { error: "必须是小写字母/数字/连字符" }).optional(),
  body: z.string().default(""),
});

/**
 * 从 zod 的 issue 反查实际值。zod v4 的 issue 不保证带原始输入（实测），
 * 所以按 issue.path 回原对象里取，取不到就显示 undefined。
 */
function actualAt(issue, raw) {
  return issue.path.reduce((o, k) => (o == null ? undefined : o[k]), raw);
}

/**
 * 校验一条条目。
 * @param {object} raw        front matter + body
 * @param {string} file       项目相对文件路径
 * @param {object} tax        已校验的 taxonomy
 * @param {string} filename   文件名（用于派生 slug）
 * @param {(msg:string)=>void} [warn] 未知字段警告回调
 */
export function validateEntry(raw, file, tax, filename, warn = () => {}) {
  for (const k of Object.keys(raw)) {
    if (!ENTRY_KNOWN.has(k)) warn(`⚠ ${file}\n  未知字段: ${k}（可能是拼写错误，已忽略）`);
  }

  const parsed = entrySchema.safeParse(raw);
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    fail(file, i.path.join(".") || "(front matter)", actualAt(i, raw), i.message);
  }
  const d = parsed.data;

  if (d.collection && !tax.collections.some((c) => c.name === d.collection)) {
    fail(file, "collection", d.collection,
      `已登记的集子之一: ${tax.collections.map((c) => c.name).join(" / ") || "(登记表里还没有集子)"}`);
  }
  for (const t of d.tags) {
    if (!tax.tags.some((x) => x.name === t)) {
      fail(file, "tags", t,
        `已登记的 tag 之一: ${tax.tags.map((x) => x.name).join(" / ") || "(登记表里还没有 tag)"}`);
    }
  }

  // 文件名的 slug 部分是 `<YYYY-MM-DD>-<slug>`；显式 slug 优先（设计文档 §5.1）
  const derived = String(filename).replace(/\.md$/, "");
  const slug = d.slug || derived;
  if (!SLUG_RE.test(slug)) {
    fail(file, "(slug)", slug, "必须匹配 ^[a-z0-9]+(-[a-z0-9]+)*$，来自文件名或显式 slug");
  }

  return { ...d, file, slug, url: `/entry/${slug}/`, collectionName: d.collection || tax.default_collection_name };
}
```

**Step 4：确认通过**

```bash
node --test test/schema.test.js
```

预期：全部 PASS。

**Step 5：提交**

```bash
git add lib/schema.js test/schema.test.js
git commit -m "feat: 条目 front matter 校验（zod + 文件路径错误提示）"
```

---

### Task 1.4：taxonomy 校验 `validateTaxonomy()`

**目标**：按设计文档 §4.3 校验登记表：slug 格式、集子/tag 各自唯一、name 重复检测。

**文件**
- 新建：`lib/taxonomy.js`
- 测试：`test/taxonomy.test.js`

**Step 1：写失败测试**

`test/taxonomy.test.js`：

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateTaxonomy, resolveCollection, resolveTag } from "../lib/taxonomy.js";

const ok = {
  default_collection_name: "日常",
  collections: [{ name: "绘画", slug: "drawing" }],
  tags: [{ name: "跑步", slug: "running" }],
};

test("合法登记表通过", () => {
  const t = validateTaxonomy(ok, "content/taxonomy.yml");
  assert.equal(t.collections[0].name, "绘画");
});

test("缺 default_collection_name 时默认「日常」", () => {
  const t = validateTaxonomy({ collections: [], tags: [] }, "f");
  assert.equal(t.default_collection_name, "日常");
});

test("slug 格式不合格报错", () => {
  for (const bad of ["Drawing", "draw ing", "draw_ing", "-drawing", "drawing-", "绘画"]) {
    assert.throws(
      () => validateTaxonomy({ ...ok, collections: [{ name: "绘画", slug: bad }] }, "f"),
      (e) => e.name === "ContentError" && /slug/.test(e.message),
      `应拒绝 slug=${bad}`
    );
  }
});

test("集子之间 slug 重复报错", () => {
  assert.throws(
    () => validateTaxonomy({ ...ok, collections: [{ name: "A", slug: "x" }, { name: "B", slug: "x" }] }, "f"),
    /重复|唯一/
  );
});

test("tag 之间 slug 重复报错", () => {
  assert.throws(
    () => validateTaxonomy({ ...ok, tags: [{ name: "A", slug: "x" }, { name: "B", slug: "x" }] }, "f"),
    /重复|唯一/
  );
});

test("集子与 tag 可以同名同 slug（URL 前缀不同）", () => {
  const t = validateTaxonomy({
    collections: [{ name: "跑步", slug: "running" }],
    tags: [{ name: "跑步", slug: "running" }],
  }, "f");
  assert.equal(t.collections[0].slug, t.tags[0].slug);
});

test("同一类里 name 重复报错", () => {
  assert.throws(
    () => validateTaxonomy({ ...ok, collections: [{ name: "A", slug: "a" }, { name: "A", slug: "b" }] }, "f"),
    /name/
  );
});

test("name 为空报错", () => {
  assert.throws(() => validateTaxonomy({ ...ok, tags: [{ name: "", slug: "a" }] }, "f"), /name/);
});

test("登记但未使用是允许的（校验器不做使用率检查）", () => {
  const t = validateTaxonomy({ ...ok, tags: [{ name: "没人用", slug: "nobody" }] }, "f");
  assert.equal(t.tags.length, 1);
});

test("集子 display name 与主集子同名 → 登记表校验报错（避免 /collection/all/ 被遮蔽）", () => {
  // 主集子不占 slug、URL 固定 /collection/all/。若允许再登记一个同名集子，
  // 条目写 `collection: 日常` 就产生歧义，且那个集子的页永远拿不到流量（被静默遮蔽）。
  // 这里选择在**登记表**层面直接拒绝，而不是在 resolveCollection 里默默让主集子优先。
  assert.throws(
    () => validateTaxonomy({
      default_collection_name: "日常",
      collections: [{ name: "日常", slug: "daily-log" }],
      tags: [],
    }, "f"),
    (e) => e.name === "ContentError" && /日常/.test(e.message) && /主集子|default_collection_name/.test(e.message)
  );
});

test("resolveCollection：主集子固定 /collection/all/，已登记集子走自己的 slug", () => {
  const t = validateTaxonomy(ok, "f");
  assert.equal(resolveCollection(t, "日常").url, "/collection/all/");
  assert.equal(resolveCollection(t, "日常").isDefault, true);
  assert.equal(resolveCollection(t, "绘画").url, "/collection/drawing/");
  assert.equal(resolveCollection(t, "绘画").isDefault, false);
});

test("resolveTag 输出 /tag/<slug>/", () => {
  const t = validateTaxonomy(ok, "f");
  assert.equal(resolveTag(t, "跑步").url, "/tag/running/");
});
```

**Step 2：确认失败**

```bash
node --test test/taxonomy.test.js
```

预期：FAIL —— 模块不存在。

**Step 3：实现**

`lib/taxonomy.js`：

```js
import { z } from "zod";
import { fail, SLUG_RE } from "./schema.js";

export const DEFAULT_COLLECTION_NAME = "日常";

const rowSchema = z.object({
  name: z.string().min(1, { error: "不能为空" }),
  slug: z.string().regex(SLUG_RE, { error: "必须是小写字母/数字/连字符（如 phd-thesis）" }),
});

const taxSchema = z.object({
  default_collection_name: z.string().min(1).default(DEFAULT_COLLECTION_NAME),
  collections: z.array(rowSchema).default([]),
  tags: z.array(rowSchema).default([]),
});

function actualAt(issue, raw) {
  return issue.path.reduce((o, k) => (o == null ? undefined : o[k]), raw);
}

/**
 * 校验 taxonomy.yml（设计文档 §4.3）。
 * 主集子不占 slug，URL 固定 /collection/all/ —— 这里只校验格式与唯一性。
 */
export function validateTaxonomy(raw, file) {
  const parsed = taxSchema.safeParse(raw);
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    fail(file, i.path.join(".") || "(taxonomy)", actualAt(i, raw), i.message);
  }
  const tax = parsed.data;

  // 主集子的显示名不得再被登记为普通集子：主集子 URL 固定 /collection/all/，
  // 同名集子的页永远拿不到流量（被静默遮蔽），且条目引用会产生歧义。
  if (tax.collections.some((c) => c.name === tax.default_collection_name)) {
    fail(file, "collections.name", tax.default_collection_name,
      `「${tax.default_collection_name}」是主集子（default_collection_name），不占 slug、URL 固定 /collection/all/，不得再登记为普通集子`);
  }

  for (const [label, rows] of [["collections", tax.collections], ["tags", tax.tags]]) {
    const names = new Map();
    const slugs = new Map();
    for (const row of rows) {
      if (names.has(row.name)) fail(file, `${label}.name`, row.name, "同一类里 name 必须唯一");
      if (slugs.has(row.slug)) fail(file, `${label}.slug`, row.slug, "同一类里 slug 必须唯一（URL 会重复）");
      names.set(row.name, true);
      slugs.set(row.slug, true);
    }
  }
  return tax;
}

/** 显示名 → 集子（含 URL）。主集子固定 /collection/all/。 */
export function resolveCollection(tax, name) {
  if (name === tax.default_collection_name) {
    return { name, slug: "all", url: "/collection/all/", isDefault: true };
  }
  const hit = tax.collections.find((c) => c.name === name);
  return hit ? { ...hit, url: `/collection/${hit.slug}/`, isDefault: false } : null;
}

/** 显示名 → tag（含 URL）。 */
export function resolveTag(tax, name) {
  const hit = tax.tags.find((t) => t.name === name);
  return hit ? { ...hit, url: `/tag/${hit.slug}/` } : null;
}
```

**Step 4：确认通过**

```bash
node --test test/taxonomy.test.js
```

预期：全部 PASS。

**Step 5：提交**

```bash
git add lib/taxonomy.js test/taxonomy.test.js
git commit -m "feat: taxonomy 校验与显示名→URL 解析"
```

---

### Task 1.5：日总结校验 `validateDaily()`

**目标**：按设计文档 §4.2 —— 文件名必须 `YYYY-MM-DD.md`、一天最多一条、`title` 必填。

**文件**
- 修改：`lib/schema.js`
- 测试：`test/schema.test.js`（追加）

**Step 1：写失败测试**

追加到 `test/schema.test.js`：

```js
import { validateDaily, assertNoDuplicateDailies } from "../lib/schema.js";

test("日总结从文件名取日期，不读 front matter 的 date", () => {
  const r = validateDaily({ title: "小结", body: "正文" }, "content/daily/2026-10-14.md", "2026-10-14.md");
  assert.equal(r.date, "2026-10-14");
  assert.equal(r.url, "/day/2026-10-14/");
});

test("日总结 title 必填", () => {
  assert.throws(() => validateDaily({ title: "" }, "f", "2026-10-14.md"), /title/);
});

test("文件名不是 YYYY-MM-DD.md 报错", () => {
  for (const f of ["2026-10-14-note.md", "20261014.md", "2026-10-14.markdown"]) {
    assert.throws(() => validateDaily({ title: "t" }, "content/daily/" + f, f), /文件名/);
  }
});

test("文件名日期不存在（2026-02-30）报错", () => {
  assert.throws(() => validateDaily({ title: "t" }, "content/daily/2026-02-30.md", "2026-02-30.md"), /日期/);
});

test("front matter 里重复写 date 报错（设计文档 §4.2）", () => {
  // 这条守的是「日期只有一处真相」。守卫必须在 zod 解析前查原始对象——
  // zod 默认 strip 未知键，解析后 d.date 恒为 undefined，守卫会静默失效。
  assert.throws(
    () => validateDaily({ title: "t", date: "2026-10-14" }, "content/daily/2026-10-14.md", "2026-10-14.md"),
    (e) => e.name === "ContentError" && /date/.test(e.message) && /front matter/.test(e.message)
  );
});

test("front matter 不写 date 时正常通过", () => {
  const r = validateDaily({ title: "t" }, "content/daily/2026-10-14.md", "2026-10-14.md");
  assert.equal(r.date, "2026-10-14");
});

test("一天两条日总结报错", () => {
  assert.throws(
    () => assertNoDuplicateDailies([
      { date: "2026-10-14", file: "content/daily/2026-10-14.md" },
      { date: "2026-10-14", file: "content/daily/2026-10-14-b.md" },
    ]),
    (e) => /2026-10-14/.test(e.message)
  );
});

test("日期不同则不报错", () => {
  assert.doesNotThrow(() => assertNoDuplicateDailies([
    { date: "2026-10-14" }, { date: "2026-10-15" },
  ]));
});
```

**Step 2：确认失败**

```bash
node --test test/schema.test.js
```

预期：FAIL —— 未导出。

**Step 3：实现**

追加到 `lib/schema.js`：

```js
const DAILY_FILE_RE = /^(\d{4}-\d{2}-\d{2})\.md$/;

const dailySchema = z.object({
  title: z.string().min(1, { error: "不能为空" }),
  body: z.string().default(""),
});

/** 校验一条日总结。日期只从文件名取（设计文档 §4.2：不在 front matter 重复写）。 */
export function validateDaily(raw, file, filename) {
  const m = DAILY_FILE_RE.exec(String(filename));
  if (!m) {
    fail(file, "(文件名)", filename, "必须是 YYYY-MM-DD.md（如 2026-10-14.md）");
  }
  const date = m[1];
  if (!z.iso.date().safeParse(date).success) {
    fail(file, "(文件名中的日期)", date, "必须是真实存在的 YYYY-MM-DD");
  }

  // 设计文档 §4.2：日期只从文件名取，不在 front matter 重复写。
  // ⚠️ 必须在 safeParse **之前**查原始对象：zod 默认 strip 掉未知键，
  // 解析后再看 d.date 恒为 undefined，守卫会退化成死代码。
  // （实测复现：写成 `if (!hasOwn(raw,"date")) { if (raw.date !== undefined) … }` 时
  //   外层成立则内层恒假，从不触发；而 {title, date} 里的 date 被静默丢弃。）
  if (raw.date !== undefined) {
    fail(file, "date", raw.date, "日总结的日期只从文件名取，请在 front matter 里删掉 date");
  }

  const parsed = dailySchema.safeParse(raw);
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    const actual = i.path.reduce((o, k) => (o == null ? undefined : o[k]), raw);
    fail(file, i.path.join(".") || "(front matter)", actual, i.message);
  }
  const d = parsed.data;
  return { ...d, file, date, url: `/day/${date}/` };
}

/** 一天最多一条日总结。 */
export function assertNoDuplicateDailies(dailies) {
  const seen = new Map();
  for (const d of dailies) {
    if (seen.has(d.date)) {
      fail(d.file || "(daily)", "date", d.date,
        `一天最多一条日总结；已存在 ${seen.get(d.date)}${d.file ? `，本次是 ${d.file}` : ""}`);
    }
    seen.set(d.date, d.file || "(unknown)");
  }
}
```

**Step 4：确认通过**

```bash
node --test test/schema.test.js
```

预期：全部 PASS。

**Step 5：提交**

```bash
git add lib/schema.js test/schema.test.js
git commit -m "feat: 日总结校验（文件名即日期，一天一条）"
```

---

### Task 1.6：`load.js` 读盘并归一化

**目标**：把 `content/` 读成 `{ taxonomy, entries, dailies }`，全部经过校验；空目录不崩。

**文件**
- 新建：`lib/load.js`
- 测试：`test/load.test.js`

**Step 1：写失败测试**

`test/load.test.js`（用 `node:fs` 在 `os.tmpdir()` 里搭临时内容目录，避免污染仓库）：

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadContent } from "../lib/load.js";

function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), "ctz-"));
  mkdirSync(join(root, "content/entries"), { recursive: true });
  mkdirSync(join(root, "content/daily"), { recursive: true });
  for (const [rel, text] of Object.entries(files)) {
    const abs = join(root, rel);
    mkdirSync(join(abs, ".."), { recursive: true });
    writeFileSync(abs, text, "utf8");
  }
  return root;
}

const TAX = `default_collection_name: 日常
collections:
  - name: 绘画
    slug: drawing
tags:
  - name: 跑步
    slug: running
`;

test("读出条目与日总结，字段归一化", () => {
  const root = fixture({
    "content/taxonomy.yml": TAX,
    "content/entries/2026-10-14-a.md": "---\ntype: thought\ntitle: 标题\ndate: 2026-10-14\ntags: [跑步]\n---\n正文\n",
    "content/daily/2026-10-14.md": "---\ntitle: 小结\n---\n日总结\n",
  });
  const { taxonomy, entries, dailies } = loadContent(root);
  assert.equal(taxonomy.default_collection_name, "日常");
  assert.equal(entries.length, 1);
  assert.equal(entries[0].title, "标题");
  assert.equal(entries[0].date, "2026-10-14");
  assert.equal(entries[0].body.trim(), "正文");
  assert.equal(dailies.length, 1);
  assert.equal(dailies[0].date, "2026-10-14");
  rmSync(root, { recursive: true, force: true });
});

test("条目之间 slug 冲突时报错", () => {
  const root = fixture({
    "content/taxonomy.yml": TAX,
    "content/entries/2026-10-14-a.md": "---\ntype: thought\ntitle: A\ndate: 2026-10-14\nslug: same\n---\n",
    "content/entries/2026-10-15-b.md": "---\ntype: event\ntitle: B\ndate: 2026-10-15\nslug: same\n---\n",
  });
  assert.throws(() => loadContent(root), /same/);
  rmSync(root, { recursive: true, force: true });
});

test("空 content/entries 正常返回空数组（设计文档 §7）", () => {
  const root = fixture({ "content/taxonomy.yml": TAX });
  const { entries, dailies } = loadContent(root);
  assert.deepEqual(entries, []);
  assert.deepEqual(dailies, []);
  rmSync(root, { recursive: true, force: true });
});

test("非法条目中断并指出文件", () => {
  const root = fixture({
    "content/taxonomy.yml": TAX,
    "content/entries/2026-10-14-bad.md": "---\ntype: 写错了\ntitle: X\ndate: 2026-10-14\n---\n",
  });
  assert.throws(
    () => loadContent(root),
    (e) => e.name === "ContentError" && /2026-10-14-bad\.md/.test(e.message)
  );
  rmSync(root, { recursive: true, force: true });
});

test("taxonomy.yml 缺失时报错而不是静默通过", () => {
  const root = fixture({
    "content/entries/2026-10-14-a.md": "---\ntype: thought\ntitle: A\ndate: 2026-10-14\n---\n",
  });
  assert.throws(() => loadContent(root), /taxonomy/);
  rmSync(root, { recursive: true, force: true });
});

test("条目按日期升序返回，同日保持文件顺序", () => {
  const root = fixture({
    "content/taxonomy.yml": TAX,
    "content/entries/2026-10-14-b.md": "---\ntype: event\ntitle: B\ndate: 2026-10-14\n---\n",
    "content/entries/2026-10-14-a.md": "---\ntype: event\ntitle: A\ndate: 2026-10-14\n---\n",
    "content/entries/2026-10-01-c.md": "---\ntype: event\ntitle: C\ndate: 2026-10-01\n---\n",
  });
  const { entries } = loadContent(root);
  assert.deepEqual(entries.map((e) => e.title), ["C", "A", "B"]);
  rmSync(root, { recursive: true, force: true });
});
```

**Step 2：确认失败**

```bash
node --test test/load.test.js
```

预期：FAIL —— 模块不存在。

**Step 3：实现**

`lib/load.js`：

```js
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parseYaml, parseFrontMatter } from "./frontmatter.js";
import { validateTaxonomy } from "./taxonomy.js";
import { validateEntry, validateDaily, assertNoDuplicateDailies, fail } from "./schema.js";

const TAX_PATH = "content/taxonomy.yml";
const ENTRIES_DIR = "content/entries";
const DAILY_DIR = "content/daily";

const mdFiles = (dir) =>
  existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".md")).sort() : [];

function readEntry(root, filename, tax, warn) {
  const rel = `${ENTRIES_DIR}/${filename}`;
  const { data, body } = parseFrontMatter(readFileSync(join(root, rel), "utf8"), rel);
  return validateEntry({ ...data, body }, rel, tax, filename, warn);
}

function readDaily(root, filename) {
  const rel = `${DAILY_DIR}/${filename}`;
  const { data, body } = parseFrontMatter(readFileSync(join(root, rel), "utf8"), rel);
  return validateDaily({ ...data, body }, rel, filename);
}

/**
 * 读取并校验全部内容。
 * 任一处不合法即抛 ContentError —— 构建必须中断（设计文档 §7）。
 */
export function loadContent(root = process.cwd(), { warn = (m) => console.warn(m) } = {}) {
  // 允许用环境变量覆盖内容根目录 —— Task 4.1 的「坏内容必须中断构建」端到端测试靠它指向临时副本。
  // 不加这个兜底，那个测试会读到仓库自己的正常内容、构建成功，从而**假绿**（实测过：退出码 0、_site 照常产出）。
  const contentRoot = process.env.CTZ_CONTENT_ROOT || root;
  const taxAbs = join(contentRoot, TAX_PATH);
  if (!existsSync(taxAbs)) {
    fail(TAX_PATH, "(文件)", "不存在", "分类登记表必须存在（设计文档 §4.3）");
  }
  const taxonomy = validateTaxonomy(parseYaml(readFileSync(taxAbs, "utf8"), TAX_PATH), TAX_PATH);

  const entries = mdFiles(join(contentRoot, ENTRIES_DIR)).map((f) => readEntry(contentRoot, f, taxonomy, warn));
  const dailies = mdFiles(join(contentRoot, DAILY_DIR)).map((f) => readDaily(contentRoot, f));
  assertNoDuplicateDailies(dailies);

  // slug 冲突
  const bySlug = new Map();
  for (const e of entries) {
    if (bySlug.has(e.slug)) {
      fail(e.file, "slug", e.slug, `slug 冲突：已被 ${bySlug.get(e.slug)} 占用`);
    }
    bySlug.set(e.slug, e.file);
  }

  entries.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  dailies.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const dailyByDate = Object.fromEntries(dailies.map((d) => [d.date, d]));
  const entriesByDate = {};
  for (const e of entries) (entriesByDate[e.date] ||= []).push(e);

  return { taxonomy, entries, dailies, dailyByDate, entriesByDate };
}
```

**Step 4：确认通过**

```bash
node --test test/load.test.js
```

预期：全部 PASS。

**Step 5：提交**

```bash
git add lib/load.js test/load.test.js
git commit -m "feat: 内容读取与归一化（含 slug 冲突检测）"
```

---

### Task 1.7：`calendar.js` 月历网格与月列表

**目标**：按设计文档 §5.2 算出月历网格（周一起始、7 列、5~6 行）与当月列表（倒序），并标识「重点日 / 事件 / 思考」。

**文件**
- 新建：`lib/calendar.js`
- 测试：`test/calendar.test.js`

**Step 1：写失败测试**

`test/calendar.test.js`：

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  daysInMonth, firstWeekday, monthKey, shiftMonth, weekdaysOf,
  buildMonthGrid, buildMonthList, dayOfYear, weekdayName, monthFacts,
} from "../lib/calendar.js";

test("daysInMonth：普通月 / 闰年 2 月 / 平年 2 月", () => {
  assert.equal(daysInMonth("2026-10"), 31);
  assert.equal(daysInMonth("2026-02"), 28);
  assert.equal(daysInMonth("2024-02"), 29);
  assert.equal(daysInMonth("2026-04"), 30);
});

test("firstWeekday 以周一为 0（设计文档 §10 默认值）", () => {
  // 2026-10-01 是周四 → 偏移 3
  assert.equal(firstWeekday("2026-10"), 3);
  // 2026-11-01 是周日 → 偏移 6
  assert.equal(firstWeekday("2026-11"), 6);
  // 2026-06-01 是周一 → 偏移 0
  assert.equal(firstWeekday("2026-06"), 0);
});

test("weekdaysOf 周一到周日", () => {
  assert.deepEqual(weekdaysOf(), ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]);
});

test("weekdayName 正确", () => {
  assert.equal(weekdayName("2026-10-14"), "周三");
  assert.equal(weekdayName("2026-10-18"), "周日");
});

test("shiftMonth 跨年", () => {
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
  assert.equal(shiftMonth("2026-12", 1), "2027-01");
});

test("monthKey / dayOfYear", () => {
  assert.equal(monthKey("2026-10-14"), "2026-10");
  assert.equal(dayOfYear("2026-01-01"), 1);
  assert.equal(dayOfYear("2026-12-31"), 365);
  assert.equal(dayOfYear("2024-12-31"), 366);
});

test("buildMonthGrid：格数 = 7 的整数倍，含前后空白格", () => {
  const g = buildMonthGrid("2026-10", []);
  assert.equal(g.rows, 5);
  assert.equal(g.cells.length, 35);
  assert.equal(g.cells[0].blank, true);       // 周一/周二空白
  assert.equal(g.cells[3].date, "2026-10-01");
  assert.equal(g.cells[34].blank, true);
});

test("buildMonthGrid：6 行月（2026-08：周六起始 → 偏移 5，5+31=36 格 → 补齐 42）", () => {
  const g = buildMonthGrid("2026-08", []);
  assert.equal(g.rows, 6);
  assert.equal(g.cells.length, 42);
});

test("buildMonthGrid：格子只统计重点条目的数量与标题；红/黑点按 hasHighlight", () => {
  const entries = [
    { date: "2026-10-03", type: "event",   highlight: true,  title: "重点一" },
    { date: "2026-10-03", type: "thought", highlight: true,  title: "重点二" },
    { date: "2026-10-03", type: "event",   highlight: false, title: "非重点" },
    { date: "2026-10-08", type: "thought", highlight: true,  title: "重点三" },
  ];
  const g = buildMonthGrid("2026-10", entries);
  const c3 = g.cells.find((c) => c.date === "2026-10-03");
  assert.equal(c3.highlightCount, 2);
  assert.equal(c3.captions[0], "重点一");
  assert.equal(c3.hasHighlight, true);        // 红点（含重点）
  // 「当日条目数」用全部条目（含非重点），与 demo 口径一致
  assert.equal(c3.entryCount, 3);

  const c8 = g.cells.find((c) => c.date === "2026-10-08");
  assert.equal(c8.highlightCount, 1);
  assert.equal(c8.hasHighlight, true);
});

test("buildMonthGrid：无重点的日子黑点（hasHighlight=false）但保留 entryCount", () => {
  const g = buildMonthGrid("2026-10", [
    { date: "2026-10-05", type: "event", highlight: false, title: "x" },
  ]);
  const c = g.cells.find((x) => x.date === "2026-10-05");
  assert.equal(c.highlightCount, 0);
  assert.equal(c.hasHighlight, false);       // 黑点：当日只有普通条目
  assert.equal(c.entryCount, 1);
});

test("buildMonthGrid：标记 today", () => {
  const g = buildMonthGrid("2026-10", [], "2026-10-14");
  assert.equal(g.cells.find((c) => c.date === "2026-10-14").isToday, true);
  assert.equal(g.cells.find((c) => c.date === "2026-10-13").isToday, false);
});

test("buildMonthList：只含日总结，按日期倒序（设计文档 §5.2）", () => {
  const dailies = [
    { date: "2026-10-01", title: "一号" },
    { date: "2026-10-20", title: "二十号" },
  ];
  const list = buildMonthList("2026-10", dailies, []);
  assert.deepEqual(list.map((r) => r.date), ["2026-10-20", "2026-10-01"]);
  assert.equal(list[0].title, "二十号");
});

test("buildMonthList：不含其它月，且不带 highlight 标记字段之外的条目数", () => {
  const dailies = [{ date: "2026-09-30", title: "上月" }, { date: "2026-10-02", title: "本月" }];
  const list = buildMonthList("2026-10", dailies, []);
  assert.deepEqual(list.map((r) => r.date), ["2026-10-02"]);
});

test("buildMonthList：附上当日重点数（demo 的 ★N）", () => {
  const list = buildMonthList("2026-10",
    [{ date: "2026-10-02", title: "t" }],
    [{ date: "2026-10-02", highlight: true }, { date: "2026-10-02", highlight: false }]);
  assert.equal(list[0].highlightCount, 1);
});

test("月视图 facts：条目/重点/日总结/有记录天数", () => {
  const f = monthFacts("2026-10",
    [{ date: "2026-10-01", type: "event", highlight: true },
     { date: "2026-10-01", type: "thought", highlight: false },
     { date: "2026-10-05", type: "event", highlight: false }],
    [{ date: "2026-10-01" }, { date: "2026-10-05" }]);
  assert.equal(f.entries, 3);
  assert.equal(f.highlights, 1);
  assert.equal(f.dailies, 2);
  assert.equal(f.daysWithRecords, "2 / 31");
});
```

> 注：这一节测试里用到的 `monthFacts` 已在文件顶部 import，不要用 `await import`（`node:test` 的普通回调不是 async）。

**Step 2：确认失败**

```bash
node --test test/calendar.test.js
```

预期：FAIL —— 模块不存在。

**Step 3：实现**

`lib/calendar.js`：

```js
/** 月历与月列表计算（设计文档 §5.2）。纯函数，不依赖 Eleventy。 */

const WD = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
export const WEEKDAYS_MON_FIRST = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

const pad = (n) => String(n).padStart(2, "0");
const parse = (s) => {
  const [y, m, d] = String(s).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

export const monthKey = (s) => String(s).slice(0, 7);
export const daysInMonth = (key) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};
/** 周一 = 0（设计文档 §10：周起始日 = 周一）。 */
export const firstWeekday = (key) => {
  const [y, m] = key.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
};
export const shiftMonth = (key, delta) => {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
};
export const weekdayName = (s) => WD[parse(s).getUTCDay()];
export const weekdaysOf = () => [...WEEKDAYS_MON_FIRST];
export const dayOfYear = (s) => {
  const d = parse(s);
  const start = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.round((d.getTime() - start) / 86400000) + 1;
};

/**
 * 月历网格。每格记录「该日重点」相关信息：数量、标题、以及该日是红点还是黑点。
 *
 * ⚠️ 点颜色语义（2026-10-14 拍板，设计文档 §5.2）：**红点 = 当日含重点条目，
 * 黑点 = 当日只有普通条目**——取代 demo 的「黑=事件、红=思考」，不再区分类型。
 * `entryCount` 用全部条目（供「该日有记录」这类判断），两者口径不同，不要混。
 */
export function buildMonthGrid(key, entries = [], today = null) {
  const byDate = new Map();
  for (const e of entries) {
    if (monthKey(e.date) !== key) continue;
    const cell = byDate.get(e.date) || { entryCount: 0, hasHighlight: false, highlights: [] };
    cell.entryCount += 1;                 // 全部条目
    if (e.highlight) {                    // 红点 = 当日含重点；黑点由模板按 hasHighlight=false 画
      cell.hasHighlight = true;
      cell.highlights.push(e);
    }
    byDate.set(e.date, cell);
  }

  const off = firstWeekday(key);
  const n = daysInMonth(key);
  const total = off + n;
  const rows = Math.ceil(total / 7);
  const cells = [];

  for (let i = 0; i < off; i++) cells.push({ blank: true });
  for (let d = 1; d <= n; d++) {
    const date = `${key}-${pad(d)}`;
    const info = byDate.get(date);
    cells.push({
      blank: false,
      date,
      day: d,
      isToday: date === today,
      entryCount: info ? info.entryCount : 0,
      highlightCount: info ? info.highlights.length : 0,
      hasHighlight: Boolean(info && info.hasHighlight),   // 红点/黑点
      captions: info ? info.highlights.map((e) => e.title) : [],
    });
  }
  while (cells.length % 7 !== 0) cells.push({ blank: true });

  return { key, rows, cells };
}

/** 右栏当月列表：只含日总结，倒序（设计文档 §5.2）。 */
export function buildMonthList(key, dailies = [], entries = []) {
  return dailies
    .filter((d) => monthKey(d.date) === key)
    .map((d) => ({
      ...d,
      weekday: weekdayName(d.date),
      highlightCount: entries.filter((e) => e.date === d.date && e.highlight).length,
    }))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/** 月视图顶部的事实条。 */
export function monthFacts(key, entries = [], dailies = []) {
  const es = entries.filter((e) => monthKey(e.date) === key);
  const ds = dailies.filter((d) => monthKey(d.date) === key);
  const days = new Set(es.map((e) => e.date));
  for (const d of ds) days.add(d.date);
  return {
    entries: es.length,
    highlights: es.filter((e) => e.highlight).length,
    dailies: ds.length,
    daysWithRecords: `${days.size} / ${daysInMonth(key)}`,
  };
}
```

**Step 4：确认通过**

```bash
node --test test/calendar.test.js
```

预期：全部 PASS。

**Step 5：提交**

```bash
git add lib/calendar.js test/calendar.test.js
git commit -m "feat: 月历网格与月列表计算（周一起始）"
```

---

### Task 1.8：`stats.js` 统计聚合

**目标**：按设计文档 §6 算总量、按集子/tag 排行（含环比）、按月/按日趋势。日总结单独计数、不计入事件/思考。

**文件**
- 新建：`lib/stats.js`
- 测试：`test/stats.test.js`

**Step 1：写失败测试**

`test/stats.test.js`：

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregate, totals, rankBy, trendByDay, trendByMonth, windowRange, withDelta } from "../lib/stats.js";

const E = (date, type, extra = {}) => ({ date, type, highlight: false, tags: [], collectionName: "日常", ...extra });

const ENTRIES = [
  E("2026-10-01", "event",   { highlight: true,  collectionName: "绘画", tags: ["跑步"] }),
  E("2026-10-02", "thought", { collectionName: "绘画", tags: ["跑步", "播客"] }),
  E("2026-10-03", "event",   { collectionName: "博士学位论文", tags: [] }),
  E("2026-09-10", "event",   { collectionName: "绘画", tags: [] }),
];
const DAILIES = [{ date: "2026-10-01" }, { date: "2026-10-02" }];

test("aggregate：事件/思考/重点/有记录天数", () => {
  const a = aggregate(ENTRIES);
  // 夹具里有 3 个 event（10-01 / 10-03 / 09-10）、1 个 thought（10-02）；
  // days 是**去重后的日期数**，不是条目数——10-01 与 10-02 各一条，10-03、09-10 各一条，共 4 天。
  assert.equal(a.events, 3);
  assert.equal(a.thoughts, 1);
  assert.equal(a.highlights, 1);
  assert.equal(a.total, 4);
  assert.equal(a.days, 4);
});

test("aggregate：重点条目仍计入事件/思考总数（设计文档 §6 口径）", () => {
  const a = aggregate([E("2026-10-01", "event", { highlight: true })]);
  assert.equal(a.events, 1);
  assert.equal(a.highlights, 1);
});

test("aggregate：空数组不崩", () => {
  const a = aggregate([]);
  assert.deepEqual(
    { e: a.events, t: a.thoughts, h: a.highlights, d: a.days },
    { e: 0, t: 0, h: 0, d: 0 }
  );
});

test("totals：日总结单独计数，不计入事件/思考（设计文档 §6）", () => {
  const t = totals(ENTRIES, DAILIES);
  // 与 aggregate 同一夹具：3 event / 1 thought（见上一条测试的说明）
  assert.equal(t.events, 3);
  assert.equal(t.thoughts, 1);
  assert.equal(t.dailies, 2);
  assert.equal(t.highlights, 1);
  assert.equal(t.total, 4);
});

test("windowRange：month / year / all 与上期区间", () => {
  assert.deepEqual(windowRange("month", "2026-10-14"), {
    from: "2026-10-01", to: "2026-10-31", label: "2026 年 10 月",
    prev: { from: "2026-09-01", to: "2026-09-30" },
  });
  const y = windowRange("year", "2026-10-14");
  assert.equal(y.from, "2026-01-01");
  assert.equal(y.to, "2026-12-31");
  assert.deepEqual(y.prev, { from: "2025-01-01", to: "2025-12-31" });
  const all = windowRange("all", "2026-10-14");
  assert.equal(all.prev, null);
});

test("windowRange：1 月的上期是去年 12 月（跨年边界）", () => {
  const r = windowRange("month", "2026-01-15");
  assert.deepEqual(r.prev, { from: "2025-12-01", to: "2025-12-31" });
});

test("month 窗口的 to 用该月真实天数（闰年 2 月）", () => {
  assert.equal(windowRange("month", "2024-02-10").to, "2024-02-29");
  assert.equal(windowRange("month", "2026-02-10").to, "2026-02-28");
});

test("rankBy：按集子聚合，事件/思考分开，降序", () => {
  const rows = rankBy(ENTRIES, (e) => [e.collectionName]);
  assert.equal(rows[0].name, "绘画");
  assert.equal(rows[0].total, 3);
  assert.equal(rows[0].events, 2);
  assert.equal(rows[0].thoughts, 1);
  assert.equal(rows[1].name, "博士学位论文");
  assert.equal(rows[1].total, 1);
});

test("rankBy：按 tag 聚合，一条可计入多个 tag", () => {
  const rows = rankBy(ENTRIES, (e) => e.tags);
  const music = rows.find((r) => r.name === "播客");
  assert.equal(music.total, 1);
  const run = rows.find((r) => r.name === "跑步");
  assert.equal(run.total, 2);
});

test("rankBy：登记但零条目的也保留（值为 0）", () => {
  const rows = rankBy([], (e) => [e.collectionName], ["绘画", "书影音"]);
  assert.deepEqual(rows.map((r) => [r.name, r.total]), [["绘画", 0], ["书影音", 0]]);
});

test("withDelta：上期为 0 显示增加条数", () => {
  assert.equal(withDelta(5, 0).label, "▲ +5 条");
  assert.equal(withDelta(5, 0).direction, "up");
});

test("withDelta：持平 / 增加条数 / 减少条数", () => {
  assert.equal(withDelta(5, 5).label, "=");
  assert.equal(withDelta(6, 4).label, "▲ +2 条");
  assert.equal(withDelta(2, 4).label, "▼ -2 条");
});

test("withDelta：无上期时返回 null 标签", () => {
  assert.equal(withDelta(5, null).label, null);
});

test("trendByDay：按日两条序列，缺日补 0", () => {
  const pts = trendByDay("2026-10", ENTRIES);
  assert.equal(pts.length, 31);
  assert.deepEqual(pts[0], { label: "2026-10-01", events: 1, thoughts: 0 });
  assert.deepEqual(pts[2], { label: "2026-10-03", events: 1, thoughts: 0 });
  assert.deepEqual(pts[1], { label: "2026-10-02", events: 0, thoughts: 1 });
});

test("trendByMonth：按月两条序列", () => {
  const pts = trendByMonth(ENTRIES);
  const oct = pts.find((p) => p.label === "2026-10");
  const sep = pts.find((p) => p.label === "2026-09");
  assert.equal(oct.events, 2);
  assert.equal(oct.thoughts, 1);
  assert.equal(sep.events, 1);
});

test("trendByMonth：本年模式补满 12 个月", () => {
  const pts = trendByMonth(ENTRIES, { year: "2026" });
  assert.equal(pts.length, 12);
  assert.equal(pts[0].label, "2026-01");
  assert.equal(pts[11].label, "2026-12");
  assert.equal(pts[0].events, 0);
});
```

**Step 2：确认失败**

```bash
node --test test/stats.test.js
```

预期：FAIL —— 模块不存在。

**Step 3：实现**

`lib/stats.js`：

```js
import { daysInMonth, monthKey, shiftMonth } from "./calendar.js";

/** 统计聚合（设计文档 §6）。计数单位是条目，日期归属用 date 字段。 */

export function aggregate(list) {
  let events = 0, thoughts = 0, highlights = 0;
  const days = new Set();
  for (const e of list) {
    if (e.type === "event") events += 1;
    else if (e.type === "thought") thoughts += 1;
    if (e.highlight) highlights += 1;
    days.add(e.date);
  }
  return { events, thoughts, highlights, total: list.length, days: days.size };
}

/** 总量卡片。日总结单独计数，不计入事件/思考（设计文档 §6）。 */
export function totals(entries, dailies = []) {
  return { ...aggregate(entries), dailies: dailies.length };
}

const iso = (y, m, d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** 时间窗口：本月 / 本年 / 全部，以及「上期」用于环比。 */
export function windowRange(kind, today) {
  const [y, m] = today.split("-").map(Number);
  if (kind === "month") {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    const prevKey = shiftMonth(key, -1);
    const [py, pm] = prevKey.split("-").map(Number);
    return {
      from: `${key}-01`,
      to: `${key}-${String(daysInMonth(key)).padStart(2, "0")}`,
      label: `${y} 年 ${m} 月`,
      prev: {
        from: `${prevKey}-01`,
        to: `${prevKey}-${String(daysInMonth(prevKey)).padStart(2, "0")}`,
      },
    };
  }
  if (kind === "year") {
    return {
      from: `${y}-01-01`, to: `${y}-12-31`, label: `${y} 年`,
      prev: { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` },
    };
  }
  return { from: "0000-01-01", to: "9999-12-31", label: "全部", prev: null };
}

export const inRange = (date, r) => date >= r.from && date <= r.to;

/**
 * 按某个维度（集子 / tag）排行。
 * @param {(e:object)=>string[]} keyOf 取该条目所属的多个维度名
 * @param {string[]} [knownNames] 登记但零条目的也要出现（值为 0），并决定同分时的顺序
 *
 * 排序：条目数降序；**同分时按登记表顺序（knownNames 的下标）**，未登记的排在其后。
 * 不要按 name 排序——中文会比码位，得到「书影音」在「绘画」前这种与登记表无关的顺序
 * （实测：knownNames=["绘画","书影音"] 且都为零时，按 name 排会变成书影音在前）。
 */
export function rankBy(entries, keyOf, knownNames = []) {
  const acc = new Map();
  const orderOf = (name) => {
    const i = knownNames.indexOf(name);
    return i === -1 ? knownNames.length : i;
  };
  const bump = (name, e) => {
    const row = acc.get(name) || { name, total: 0, events: 0, thoughts: 0 };
    row.total += 1;
    if (e.type === "event") row.events += 1;
    else if (e.type === "thought") row.thoughts += 1;
    acc.set(name, row);
  };
  for (const name of knownNames) acc.set(name, { name, total: 0, events: 0, thoughts: 0 });
  for (const e of entries) for (const name of keyOf(e) || []) bump(name, e);
  return [...acc.values()].sort(
    (a, b) => b.total - a.total || orderOf(a.name) - orderOf(b.name)
  );
}

/** 与上期相比的条数差值；全部窗口没有上期，不显示比较。 */
export function withDelta(current, previous) {
  if (previous === null || previous === undefined) return { label: null, direction: "none" };
  const diff = current - previous;
  if (diff === 0) return { label: "=", direction: "none" };
  return diff > 0
    ? { label: `▲ +${diff} 条`, direction: "up" }
    : { label: `▼ ${diff} 条`, direction: "down" };
}

/** 按日趋势（本月窗口）。缺日补 0。 */
export function trendByDay(key, entries) {
  const n = daysInMonth(key);
  const pts = [];
  for (let d = 1; d <= n; d++) {
    const date = `${key}-${String(d).padStart(2, "0")}`;
    const day = entries.filter((e) => e.date === date);
    pts.push({
      label: date,
      events: day.filter((e) => e.type === "event").length,
      thoughts: day.filter((e) => e.type === "thought").length,
    });
  }
  return pts;
}

/** 按月趋势。传 year 时补满 12 个月，否则只列出现过的月份。 */
export function trendByMonth(entries, { year } = {}) {
  const months = year
    ? Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`)
    : [...new Set(entries.map((e) => monthKey(e.date)))].sort();
  return months.map((k) => {
    const list = entries.filter((e) => monthKey(e.date) === k);
    return {
      label: k,
      events: list.filter((e) => e.type === "event").length,
      thoughts: list.filter((e) => e.type === "thought").length,
    };
  });
}
```

**Step 4：确认通过**

```bash
node --test test/stats.test.js
```

预期：全部 PASS。

**Step 5：提交**

```bash
git add lib/stats.js test/stats.test.js
git commit -m "feat: 统计聚合（总量/排行/环比/趋势）"
```

---

### Task 1.9：跑通全部单测

**目标**：确认 `lib/` 六模块全绿，作为后续接线的前提。

**Step 1**

```bash
npm test
```

预期：`# fail 0`，退出码 0。

**Step 2**：确认 lib/ 没有 import Eleventy（设计文档 §3 分层硬要求）

```bash
grep -rn "@11ty" lib/ || echo "OK: lib/ 不依赖 Eleventy"
```

预期：`OK: lib/ 不依赖 Eleventy`

---

# 阶段 2 · Eleventy 接线与设计系统

### Task 2.1：`content/` 示例内容与 taxonomy

**目标**：有可构建的真实内容；taxonomy 用设计文档 §4.3 给出的初始登记表。

**文件**：新建 `content/taxonomy.yml`、`content/entries/2026-10-14-example.md`、`content/daily/2026-10-14.md`

**Step 1**：`content/taxonomy.yml`——**直接使用设计文档 §4.3 的登记表**（集子与 tag 均已由设计文档确认，不需要新增）

```yaml
# 默认集子的显示名（URL 固定为 /collection/all/，不在这里配 slug）
default_collection_name: 日常

collections:
  - name: 绘画
    slug: drawing
  - name: 博士学位论文
    slug: phd-thesis
  - name: 书影音
    slug: books-films-music

tags:
  - name: PhD V2.0 P1.1
    slug: phd-v2-0-p1-1
  - name: 跑步
    slug: running
  - name: 吉他
    slug: guitar
  - name: 播客
    slug: podcast
  - name: 视频
    slug: video
```

> ⚠️ 项目规矩（设计文档 §11）：**不得擅自新增 tag / 集子**。上面这份是设计文档已确认的初始集合；后续要加，先问你。

**Step 2**：`content/entries/2026-10-14-example.md`（用 demo 的内容风格，替换 demo 的缩写字段）

```markdown
---
type: thought
title: 把时间轴画成了图
date: 2026-10-14
highlight: true
collection: 博士学位论文
tags: ["PhD V2.0 P1.1"]
---

画到一半发现，真正难的不是排列顺序，是给每一段找边界。边界一定下来，之前觉得互相矛盾的两段其实不冲突。
```

**Step 3**：`content/daily/2026-10-14.md`

```markdown
---
title: 把想法画成图，一下清楚了
---

用三根横轴把「已定 / 待验 / 存疑」摆开，之前绕了半个月的问题一眼就看出卡在哪。图比句子诚实。
```

**Step 4**：校验内容能被 lib/ 正确读出

```bash
node -e "import('./lib/load.js').then(m=>{const r=m.loadContent(process.cwd());console.log('entries',r.entries.length,'dailies',r.dailies.length,'| first:',r.entries[0].title,r.entries[0].date,r.entries[0].url)})"
```

预期：`entries 1 dailies 1 | first: 把时间轴画成了图 2026-10-14 /entry/2026-10-14-example/`

**Step 5**：故意制造一个错误，确认构建会拦下来（这是设计文档成功标准 4）

临时把 `type: thought` 改成 `type: thougt`，跑：

```bash
node -e "import('./lib/load.js').then(m=>m.loadContent(process.cwd()))"
```

预期：抛错，消息含 `✖ content/entries/2026-10-14-example.md`、`字段: type`、`实际: "thougt"`、`期望: 只能是 event 或 thought`。**改回来。**

**Step 6**：提交

```bash
git add content/
git commit -m "feat: 初始 taxonomy 与示例内容"
```

---

### Task 2.2：`eleventy.config.js`

**目标**：把 `src/` 作输入目录、注册 `renderContent`、注册 site 全局数据。

**文件**：新建 `eleventy.config.js`

**Step 1**：关键设计（每条都有实测理由，勿随手改）

- 输入目录 `src`、输出 `_site`：`content/` 因此**完全不进** Eleventy 模板管线，正文里的 `{% %}` 不会让构建崩溃（实测过崩溃场景），`tags` 也不会撞上 Eleventy 的保留集合键。
- 用 Eleventy **自带**的 `RenderPlugin` 渲染正文 Markdown（`renderContent("md")`），不 import `markdown-it`——它是 Eleventy 的传递依赖，直接用就是幻影依赖。
- 全局数据只在**一个**地方做校验（`src/_data/site.js`），构建一开始就失败，不产出半成品。

```js
import { RenderPlugin } from "@11ty/eleventy";

export default function (eleventyConfig) {
  // 正文 Markdown 渲染：用 Eleventy 自带插件，避免直接依赖 markdown-it
  eleventyConfig.addPlugin(RenderPlugin);

  // 模板里常用的显示过滤
  eleventyConfig.addFilter("dateStr", (d) =>
    d instanceof Date ? d.toISOString().slice(0, 10) : String(d ?? ""));
  eleventyConfig.addFilter("zhDate", (s) => {
    const [y, m, d] = String(s).split("-");
    return `${y} 年 ${Number(m)} 月 ${Number(d)} 日`;
  });

  eleventyConfig.setInputDirectory("src");
  eleventyConfig.setOutputDirectory("_site");

  // 静态资源原样复制到 _site/assets/（模板引用的 /assets/style.css、/assets/nav.js）
  // 实测：显式 passthrough 比把 css/js 塞进 templateFormats 更稳（后者靠隐式复制，语义含糊）
  eleventyConfig.addPassthroughCopy("src/assets");

  return {
    dir: { includes: "_includes", data: "_data" },
    // 只列真正的模板格式；assets 走 passthrough，不在这里
    templateFormats: ["njk", "11ty.js"],
  };
}
```

> **实测补充（2026-10-14，/tmp/elspike7）**：`src/assets/` 下的 `.css`/`.js` 必须有明确出口，否则模板链接的 `/assets/style.css` 会 404。两种写法都实测可用：① 显式 `addPassthroughCopy("src/assets")`（本计划采用）；② 把 `"css","js"` 写进 `templateFormats`（Eleventy 会 `Copied 2` 原样复制，且 CSS 里的 `{{ }}`/`{% %}` **不会**被模板引擎吃掉——已实测）。推荐 ①，因为 ② 的复制是隐式行为、语义含糊。

**Step 2**：确认配置能被加载（此时还没有模板，应报「没找到模板」而不是配置错误）

```bash
npx @11ty/eleventy 2>&1 | tail -5
```

预期：能正常启动并报告 `Wrote 0 files`（或空输入提示），**不出现** `is not a function` 之类的配置 API 错误。

**Step 3**：提交

```bash
git add eleventy.config.js
git commit -m "feat: Eleventy 配置（src 作输入、RenderPlugin 渲染正文）"
```

---

### Task 2.3：`src/_data/site.js`

**目标**：构建开始时一次性校验全部内容，并把结果交给模板。

**文件**：新建 `src/_data/site.js`

```js
import { loadContent } from "../../lib/load.js";
import { totals, rankBy, withDelta, trendByDay, trendByMonth, windowRange, inRange } from "../../lib/stats.js";
import { resolveCollection, resolveTag } from "../../lib/taxonomy.js";
import { monthKey } from "../../lib/calendar.js";

/**
 * 全局数据：内容校验 + 统计预计算（设计文档 §3：统计不放在模板里算）。
 * lib/ 抛出的 ContentError 会让 Eleventy 中断构建，不产出 _site（设计文档 §7）。
 *
 * ⚠️ 返回的对象是**模板的唯一接口**。Task 3.x 里模板用到的每个键都必须在这里出现，
 * 否则渲染出来是 `undefined`（Nunjucks 对缺失键不报错，会静默留空）。
 */
export default function () {
  const { taxonomy, entries, dailies, dailyByDate, entriesByDate } = loadContent(process.cwd());

  // ⚠️ 用**本地**日期算「今天」，不要用 toISOString()：后者是 UTC，
  // 在 UTC+8 凌晨（本地 00:00–08:00）会解析成昨天，「今日」页会显示前一天。
  // （实测：TZ=Asia/Shanghai 本地 2026-10-14 07:00 → toISOString().slice(0,10) = "2026-10-13"）
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const thisMonth = monthKey(today);
  const thisYear = today.slice(0, 4);

  // 四个可浏览的入口（集子含主集子、tag），登记但未使用的也要生成空态页
  const collections = [
    { name: taxonomy.default_collection_name, slug: "all", url: "/collection/all/", isDefault: true },
    ...taxonomy.collections.map((c) => ({ ...c, url: `/collection/${c.slug}/` })),
  ];
  const tags = taxonomy.tags.map((t) => ({ ...t, url: `/tag/${t.slug}/` }));

  // 日页要覆盖的日期 = 有日总结的 ∪ 有条目的（Task 3.3 的分页源）。
  // 只列日总结会漏掉「有条目但当天没写日总结」的日子。
  const days = [...new Set([...dailies.map((d) => d.date), ...entries.map((e) => e.date)])].sort();

  // 统计页默认窗口 = 本月（设计文档 §10）
  const windows = {};
  for (const kind of ["month", "year", "all"]) {
    const r = windowRange(kind, today);
    const cur = entries.filter((e) => inRange(e.date, r));
    const prev = r.prev ? entries.filter((e) => inRange(e.date, r.prev)) : null;
    const curDailies = dailies.filter((d) => inRange(d.date, r));
    const prevDailies = r.prev ? dailies.filter((d) => inRange(d.date, r.prev)) : null;
    windows[kind] = {
      range: r,
      totals: {
        ...totals(cur, curDailies),
        deltas: prev ? {
          events: withDelta(totals(cur).events, totals(prev).events),
          thoughts: withDelta(totals(cur).thoughts, totals(prev).thoughts),
          highlights: withDelta(totals(cur).highlights, totals(prev).highlights),
        } : null,
      },
      byCollection: rankBy(cur, (e) => [e.collectionName], collections.map((c) => c.name)),
      byTag: rankBy(cur, (e) => e.tags, tags.map((t) => t.name)),
      prevByCollection: prev ? rankBy(prev, (e) => [e.collectionName]) : null,
      prevByTag: prev ? rankBy(prev, (e) => e.tags) : null,
      trend: kind === "month" ? trendByDay(thisMonth, cur)
        : kind === "year" ? trendByMonth(cur, { year: thisYear })
        : trendByMonth(cur),
      dailiesPrev: prevDailies ? prevDailies.length : null,
    };
  }

  // 月视图要生成的月份：内容里出现过的月份 ∪ 本月（用分页逐月生成 /month/<key>/）
  const months = [...new Set([
    ...entries.map((e) => monthKey(e.date)),
    ...dailies.map((d) => monthKey(d.date)),
    thisMonth,
  ])].sort();

  // 统计页三个窗口（Task 3.6 用它做分页源）
  const windowKeys = ["month", "year", "all"];

  return {
    taxonomy, entries, dailies, collections, tags,
    months, days, today, thisMonth, thisYear, windows, windowKeys,
    // 由 load.js 建好、供日页与首页直接取用的索引（Task 3.1 / 3.3 依赖它们）
    dailyByDate, entriesByDate,
  };
}
```

> **接口自检**（Stage 2 收尾前跑一次，避免 Task 3.x 才发现键名对不上）：
>
> ```bash
> npx @11ty/eleventy 2>&1 | tail -3
> # 另用临时模板打印：site.dailyByDate、site.entriesByDate、site.days、site.windowKeys 都必须有值
> ```

> 统计这里刻意**预计算全部三个窗口**（本月/本年/全部），而不是等页面切换时再算——站点是静态的，构建时算一次即可，符合设计文档 §6「统计在构建时算好，页面用手写内联 SVG 画图」。

**Step 1**：验证数据可加载

```bash
npx @11ty/eleventy 2>&1 | tail -5
```

预期：仍无模板，但**不报** `site.js` 相关错误。可加一个临时 `src/probe.11ty.js` 打印 `site.entries.length` 后删除。

**Step 2**：提交

```bash
git add src/_data/site.js
git commit -m "feat: 全局数据（内容校验 + 统计预计算）"
```

---

### Task 2.4：设计系统 CSS（从 G1 demo 移植）

**目标**：把 `docs/ui-demos/g1-line.html` 的视觉**原样**搬成 `src/assets/style.css`，不重新设计。

**文件**：新建 `src/assets/style.css`

**做法（严格照做，避免走样）**

1. 打开 `docs/ui-demos/g1-line.html`，取 `<style>`（第 7 行）到 `</style>`（第 380 行）**之间**的全部 CSS，即第 8–379 行。

   > ⚠️ 行号已实测核对（2026-10-14）：`<style>` 在 **7** 行、`</style>` 在 **380** 行。上轮草案写的 8/379 是错的，`sed -n '9,378p'` 会**丢掉第 379 行的 `}`**——那正是 `@media(max-height:760px)`（第 352 行起）的闭合括号，搬出来的 CSS 从该处起整段失效。务必用第 8–379 行；括号必须平衡（`{` 307 个、`}` 307 个）。
2. 原样粘贴为 `src/assets/style.css`。
3. 做且只做以下 **4 处** 必要改动：

| 改动 | 原因 |
| --- | --- |
| 删除 `.dirbar` 相关全部规则（实测 **11 处**：基础定位与配色、G1 顶右覆盖、深色变体共三段） | 那是 demo 的方向切换条，不是产品功能 |
| 删除 `.brand em` 与顶部 `--top:0px` 注释里的 demo 措辞 | 纯文案清理，可选 |
| 增加 `body::after` 之外的**底栏封底**保持不变（`.tabbar::after` 已在 demo 中） | G1 定稿要求，不要动 |
| 若有 `.mark` 类仅用于 demo（`.brand` 上的 `mark`） | 保留 `mark` 的样式剔除（用 `<div class="brand">` 即可） |

4. **明确不要改**：`--accent:#a8321f`、`--tab:52px`、`.tabbar` 的贴底与 `::after` 封底、`.shell` 底部内边距 `calc(var(--tab) - 8px)`、236px 栅格、字号分界 17px 的字体分工块、`.matrix` 的等比压缩。

**Step 1**：找边界（**不要**照抄行号，以实际输出为准）

```bash
grep -n "<style>\|</style>" docs/ui-demos/g1-line.html
```

**Step 2**：生成 CSS 并核对条目数

```bash
# 8 = <style> 行号 + 1，379 = </style> 行号 - 1（以 Step 1 实测为准）
sed -n '8,379p' docs/ui-demos/g1-line.html > src/assets/style.css
wc -l src/assets/style.css
printf 'braces { %s } %s\n' "$(tr -cd '{' < src/assets/style.css | wc -c | tr -d ' ')" "$(tr -cd '}' < src/assets/style.css | wc -c | tr -d ' ')"
grep -c "dirbar" src/assets/style.css
```

预期：约 371 行；花括号 **307 / 307 平衡**；`dirbar` 计数 > 0（随后手工删除这些行）。

> 花括号这一项是必须的：只数行数、只 grep `dirbar` 都发现不了漏掉末尾 `}` 这类截断错误。

**Step 3**：删掉 `.dirbar` 规则，删完再数一次

> ⚠️ **不能只 `grep -v dirbar` 就完事**。`.dirbar` 的第一条规则**跨两行**：
> 第 67 行以 `.dirbar{…` 开头，第 68 行是续行 `padding:4px;opacity:.42;transition:opacity .18s}`——
> 第二行**不含 `dirbar` 字样**。所以按行过滤会删掉第 67 行却留下第 68 行，
> 结果是 `{` 比 `}` 少一个，**从该处起其后的 CSS 整段失效**，而 `grep -c dirbar` 仍显示 0、
> 看起来「删干净了」。实测：`grep -v dirbar` 后花括号为 `{ 296 } 297`，已失衡。
>
> 正确做法：按**规则块**删除（用编辑器/`sed` 指定行区间，或删除时连带把续行一起处理），
> 删完**必须再查一次花括号平衡**，而不只是查 `dirbar` 计数。

```bash
grep -n "dirbar" src/assets/style.css          # 应为空
# 关键：删完复查括号，必须仍然平衡
printf 'braces { %s } %s\n' "$(tr -cd '{' < src/assets/style.css | wc -c | tr -d ' ')" "$(tr -cd '}' < src/assets/style.css | wc -c | tr -d ' ')"
# 预期 { 296 } 296（删掉 .dirbar 的 11 处规则后，两侧同步减少；不平衡即为删坏了）
```

预期：`dirbar` 无输出，**且花括号两侧相等**。

**Step 4**：确认关键值没被动过

```bash
grep -n "a8321f\|--tab:52px\|calc(var(--tab) - 8px)\|236px\|safe-area-inset-bottom" src/assets/style.css
```

预期：这些值都在。

**Step 5**：提交

```bash
git add src/assets/style.css
git commit -m "feat: 从 G1 定稿移植设计系统 CSS"
```

---

### Task 2.5：基础布局与 G1 底栏

**目标**：页面外壳 = 品牌行 + 内容 + G1 通栏细线底栏（四屏导航）。

**文件**：新建 `src/_includes/base.njk`、`src/assets/nav.js`

`src/_includes/base.njk`：

```njk
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{% if title %}{{ title }} · {% endif %}ctz/bujo</title>
  <link rel="stylesheet" href="/assets/style.css" />
</head>
<body>
  <div class="brand">ctz<span>/</span>bujo</div>

  <main>
    {{ content | safe }}
  </main>

  <nav class="nav tabbar" aria-label="四屏导航">
    <a href="/month/{{ site.thisMonth }}/"{% if navActive == 'month' %} class="on" aria-current="page"{% endif %}>本月</a>
    <a href="/"{% if navActive == 'home' %} class="on" aria-current="page"{% endif %}>今日</a>
    <a href="/collection/all/"{% if navActive == 'index' %} class="on" aria-current="page"{% endif %}>集子 · 标签</a>
    <a href="/stats/"{% if navActive == 'stats' %} class="on" aria-current="page"{% endif %}>统计</a>
  </nav>

  <script src="/assets/nav.js" defer></script>
</body>
</html>
```

> ⚠️ 注意：demo 里底栏是 `<button data-s="...">` + 哈希路由（SPA）；**真实站点是多页静态站**，所以这里必须是 `<a href>` 真实链接。选中态由各页面在 front matter 里声明 `navActive`。

`src/assets/nav.js`（键盘 ← → 与横滑切换四屏；纯渐进增强，无 JS 也能用）：

```js
/* 四屏切换：键盘左右方向键 + 触屏/触控板横滑 → 跳转到相邻屏幕的真实 URL。
   设计文档 §5：四屏可左右滑/方向键切换。这里是渐进增强，禁用 JS 时链接照常可用。 */
(() => {
  const links = [...document.querySelectorAll(".tabbar a")];
  if (!links.length) return;
  const i = links.findIndex((a) => a.classList.contains("on"));

  const go = (step) => {
    const next = links[(i + step + links.length) % links.length];
    if (next) location.href = next.href;
  };

  document.addEventListener("keydown", (e) => {
    if (e.target.matches("input, textarea, select")) return;
    if (e.key === "ArrowRight") go(1);
    else if (e.key === "ArrowLeft") go(-1);
  });

  let sx = 0, sy = 0, tracking = false;
  document.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1) return;
    sx = e.touches[0].clientX; sy = e.touches[0].clientY; tracking = true;
  }, { passive: true });
  document.addEventListener("touchend", (e) => {
    if (!tracking) return;
    tracking = false;
    const dx = e.changedTouches[0].clientX - sx;
    const dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
    go(dx < 0 ? 1 : -1);
  }, { passive: true });

  let acc = 0, last = 0;
  document.addEventListener("wheel", (e) => {
    if (Math.abs(e.deltaX) < 24 || Math.abs(e.deltaX) < Math.abs(e.deltaY)) return;
    const now = Date.now();
    if (now - last > 700) acc = 0;
    last = now;
    acc += e.deltaX;
    if (Math.abs(acc) > 110) { go(acc < 0 ? 1 : -1); acc = 0; }
  }, { passive: true });
})();
```

**Step 1**：CSS 需要 `.tabbar a` 的样式（demo 里是 `.tabbar button`）

在 `src/assets/style.css` 中，把 `.tabbar button` 系列选择器**追加**一份 `a` 的等价规则（不要改原 `button` 规则，方便对照）：

```css
/* 真实站点用 <a> 而非 demo 的 <button>，视觉与 G1 定稿一致 */
.tabbar a{display:inline-block;padding:6px 16px;border-radius:0;background:none;position:relative;
  font-size:12px;letter-spacing:.04em;color:var(--ink-3);text-decoration:none}
.tabbar a:hover{color:var(--ink);background:none}
.tabbar a.on{color:var(--ink);font-weight:600;background:none}
.tabbar a.on::after{content:"";position:absolute;left:16px;right:16px;bottom:0;height:2px;background:var(--accent)}
```

**Step 2**：建一个临时首页验证外壳

`src/index.njk`：

```njk
---
layout: base.njk
title: 今日
navActive: home
---
<div class="wrap"><h1>外壳自检</h1></div>
```

**Step 3**：构建并检查

```bash
npx @11ty/eleventy && grep -o 'class="nav tabbar"' _site/index.html && grep -c "本月\|今日\|集子 · 标签\|统计" _site/index.html
```

预期：找到底栏标记，四个导航词都在。

**Step 4**：提交

```bash
git add src/_includes/base.njk src/assets/nav.js src/assets/style.css src/index.njk
git commit -m "feat: 基础布局与 G1 通栏细线底栏"
```

---

# 阶段 3 · 页面

> 每个页面 Task 都以「`npx @11ty/eleventy` 构建成功 + 断言产物里的关键标记」收尾。设计文档 §5 的路径与 §12.1 的硬约束是验收标准。

### Task 3.1：今日（首页）

**文件**：`src/index.njk`（改写）

**要点**（设计文档 §5 路径表 + §5.3（2026-10-16 夜·八拍板）+ demo 的 `renderDay`/`renderSide`）

- `.dateline`：日期衬线大字（`.dateline b`）+ 星期/第 N 天（em 不用斜体）+ facts「N 条条目 · N 条日总结 · N 条重点」
- 有日总结时渲染 `.pull`（今日小结）：mono 朱红 `.lbl` 标签 + 标题进衬线 `h2`
- `.sect-h h3`（mono 10px + 延伸线）+ 条目列表：每条 `.entry`，条目头用 `.top-row`（**不得复用右栏 `.dlrow .r1` 类名**）、`.idx` 序号、`h4` 标题、**tag 胶囊行**（`.tags` 46px 缩进：`.tag.type` 描边 / `.tag.coll` 黑底反白 / `.tag` 灰描边 / `.tag.hl` 朱红）、摘要 `.excerpt` 46px 缩进
- 空状态：单行 `.empty`「这里是空的。」（2026-10-16 拍板文案）
- 侧栏 `.side`（demo `.blk` 块结构）：块一 `.blk > .blk-h(h3 小月历 + 「月视图 →」链接) + .mini(.mini-head + .mini-dow + .mini-grid)`，格子为 `<a class="mini-cell">`（**CSS 选择器用 `.mini-grid a`，不是 button**）；`mini-foot` **只保留「今天」灰方块一枚图例**；块二 `.blk > .blk-h(h3 统计 + 「查看统计 →」) + .stat-pair`（衬线 30px 大数字**墨色不分色** + `.l` 标签 + `.s`「本月 N」副行，口径 = 条目/日总结）
- 侧栏小月历点进 `/day/<date>/`

关键取数：`site.dailyByDate[site.today]`、`site.entriesByDate[site.today]`、`buildMonthGrid(site.thisMonth, site.entries, site.today)`。

**验证**

```bash
npx @11ty/eleventy
grep -c "dateline" _site/index.html
grep -o "今日小结" _site/index.html | head -1
```

**提交**：`feat: 今日日页（首页）`

---

### Task 3.2：月视图（合并分屏）—— 硬约束最多的一屏

**文件**：新建 `src/month.njk` + `src/month.11tydata.js`

分页生成每个月：`/month/2026-10/`。

`src/month.11tydata.js`：

```js
export default {
  layout: "base.njk",
  // 分页源是 site.js 预计算出的月份列表（内容出现过的月份 ∪ 本月），
  // 不要用条目数组——那会按月内条目数生成重复页面。
  pagination: { data: "site.months", size: 1, alias: "monthKey" },
  permalink: (data) => `/month/${data.monthKey}/`,
};
```

`site.js` 里补一个 `months`：内容中出现过的所有月份 ∪ 本月，升序：

```js
const months = [...new Set([
  ...entries.map((e) => monthKey(e.date)),
  ...dailies.map((d) => monthKey(d.date)),
  thisMonth,
])].sort();
```

然后在 `src/month.njk` 里用 `monthKey` 取该月数据：`buildMonthGrid(monthKey, site.entries, site.today)` 与 `buildMonthList(monthKey, site.dailies, site.entries)`。

**要点**（设计文档 §5.2 + §12.1）

- 结构：`.shell > .month-top + .month-body > (.cal-pane + .list-pane)`
- 左栏：`.dow` 周一到周日、`.matrix`（用 `buildMonthGrid`，`style="--rows: {{ grid.rows }}"`）、`.cal-foot` 图例（**红点=重点 / 黑点=普通** / 点格子定位）
- 每格：日期数字 `.num`、事件点 `.mt`（**红点 `hasHighlight=true` / 黑点 `hasHighlight=false`**，2026-10-14 拍板，不再区分类型）、`.cap` 重点标题截断 + `+N`
- 右栏：`.list-pane > .list-head + .dlrow*`，**只含日总结**（`buildMonthList`），倒序；日总结行尾**只显示红点**（当日 `highlightCount > 0` 时），不显示黑点
- 上一月 / 下一月 / 回到本月：真实链接到 `/month/<key>/`
- 格子点进 `/day/<date>/`（设计文档 §5.2：点格子进日页，不是弹窗）
- `.cal-foot` 的图例**不得被底栏压住**——`calc(var(--tab) - 8px)` 已处理，但必须用 Task 4.2 的脚本复核

**验证**

```bash
npx @11ty/eleventy
ls _site/month/
grep -c "matrix" _site/month/*/index.html
```

**提交**：`feat: 本月合并分屏月视图`

---

### Task 3.3：日页

**文件**：新建 `src/day.njk` + `src/day.11tydata.js`

分页 `site.dailies ∪ {有条目但无日总结的日期}` → `/day/<date>/`。

**要点**：与首页同版式（复用同一段模板体，抽到 `src/_includes/day-body.njk` 并用 `{% include %}`），只是日期来自 URL。用 `{% include %}` 时**不要**在 include 文件里写 front matter（实测：会把 front matter 当正文输出）。侧栏小月历定位到该日所在月。

**验证**

```bash
npx @11ty/eleventy
ls _site/day/
```

**提交**：`feat: 某天详情页`

---

### Task 3.4：条目详情页

**文件**：新建 `src/entry.njk` + `src/entry.11tydata.js`

**要点**（设计文档 §5.1）

- `permalink: /entry/<slug>/`，slug 来自 `entry.slug`（**已由 lib/ 从文件名派生，含日期前缀**，不要用 `page.fileSlug`——实测它会剥掉日期）
- 渲染正文：`{{ entry.body | renderContent("md") | safe }}`
- 页眉显示日期、类型、集子、tag 徽章、重点标记
- 模板里的 `{{ }}` 是 Nunjucks 的，**不是** Liquid（`RenderPlugin` 的 `renderContent` 只跑 Markdown，不会二次解释正文里的模板语法——已实测）

**验证**

```bash
npx @11ty/eleventy
ls _site/entry/
grep -o "<strong>" _site/entry/2026-10-14-example/index.html
```

**提交**：`feat: 条目详情页`

---

### Task 3.5：集子页与 tag 页

**文件**：新建 `src/collection.njk` + `src/collection.11tydata.js`、`src/tag.njk` + `src/tag.11tydata.js`

**要点**

- 集子：`pagination.data: site.collections` → `/collection/<slug>/`，含主集子 `/collection/all/`
- tag：`pagination.data: site.tags` → `/tag/<slug>/`
- 版式沿用 demo 的 `.index-layout`（左 `.rail` 列全部集子与 tag + 计数，右 `.res-list` 列该维度条目，日期倒序）
- 标题显示登记表里的**中文名**；主集子说明「主集子 · /collection/all/」
- 空态：登记但未使用时提示「登记了但未使用的集子 / tag 仍会生成页面，只是列表为空」（设计文档 §4.3）

**验证**

```bash
npx @11ty/eleventy
ls _site/collection/ _site/tag/
test -d _site/collection/all && echo "OK: 主集子页存在"
```

**提交**：`feat: 集子页与 tag 页`

---

### Task 3.6：统计页（手写内联 SVG）

**2026-10-17 验收补充**：窗口标签位于标题下方，margin-top:16px、margin-bottom:0；恢复标题 → KPI（三层块布局）→ 真实链接窗口切换 → 同一 `.grid2` 内排行与趋势卡。横坐标显式条件分支处理首点 0；纵坐标宏显式传最大值，单时间桶绘圆点。回归测试覆盖首点 x=56、最大值 y=30、单点可见、空数据、窗口 href 与块布局；CDP 验证 1440/760/761px 的实际几何、颜色、滚动与跳转。

**文件**：新建 `src/stats.njk` + `src/stats.11tydata.js` + `src/_includes/trend-svg.njk`

**要点**（设计文档 §6）

- 三块：总量卡片（`.kpis`，5 张：事件 / 思考 / 日总结 / 有记录天数 / 重点条目）、横向排行（按集子 + 按 tag，`.rank-row` + 堆叠条）、纵向趋势（折线）
- **不引入客户端图表库**，手写内联 SVG。折线图的实现直接参照 demo 的 `lineChart()`（`docs/ui-demos/g1-line.html:914-934`）：`viewBox="0 0 1000 260"`、4 条水平网格线、事件实线墨黑、思考虚线浅蓝灰 `#6f8fa6`（2026-10-17 修订，与墨黑明度对比至少 3:1）
- 排行条宽度 = `value / max * 100%`；事件用墨色、思考用朱红（与 demo 一致）
- 环比：共用 `withDelta()`，显示「▲ +N 条 / ▼ -N 条 / =」，上期为 0 同样计算差值；全部窗口无比较。通过 Nunjucks global 接线到排行模板；KPI 与排行共用差值显示宏，实心三角用内联 SVG 与文字行居中（inline-flex / align-items:center），排行总数另包 span 并与差值共用 flex 居中行，CDP 验证三角/文字及总数/差值文字中心误差不超过 0.5px

**窗口切换：三个真实页面，不用查询串**（这是上一轮草案的硬缺陷，已修）

> ⚠️ **为什么不能用 `?w=year`**：`page.url` 是**构建期**的值，页面在构建时就已生成成静态 HTML。访客的查询串只存在于浏览器地址栏，服务端/构建期永远看不到它——`page.url` 恒为 `/stats/`，`?w=` 分支永远不会生效。查询串还会让同一份 HTML 被重复缓存、且无法被静态托管按路径路由。**静态站的切换必须是「不同 URL」或「客户端行为」，不能是「构建期读查询串」。**

做法：用 `site.windows`（Task 2.3 已**预计算全部三个窗口**，正是为此）分页生成三个真实页面：

| URL | 窗口 | 说明 |
| --- | --- | --- |
| `/stats/` | month | 默认页（设计文档 §10：默认本月） |
| `/stats/year/` | year | 本年 |
| `/stats/all/` | all | 全部 |

`src/stats.11tydata.js`：

```js
export default {
  layout: "base.njk",
  // 分页源是三个窗口名；site.windows 已经算好了，模板只负责画
  pagination: { data: "site.windowKeys", size: 1, alias: "w" },
  permalink: (data) => (data.w === "month" ? "/stats/" : `/stats/${data.w}/`),
  eleventyExcludeFromCollections: true,
};
```

在 `site.js` 的返回值里补一项（供上面分页用）：

```js
// 统计页三个窗口对应的 URL：month → /stats/（默认），其余 → /stats/<w>/
const windowKeys = ["month", "year", "all"];
```

模板里用 `site.windows[w]` 取当前窗口的数据，三个窗口的切换链接是普通 `<a href="/stats/year/">`，并给当前页加 `aria-current="page"`。

- **深链可用**：`/stats/year/` 可直接分享。
- **零客户端 JS**：纯静态页面，与「不引客户端图表库」的取向一致。
- **可机械验证**：三个文件都应存在（见下方验证与 Task 4.1）。

**验证**

```bash
npx @11ty/eleventy
ls _site/stats/ _site/stats/year/ _site/stats/all/
grep -c "<svg" _site/stats/index.html
grep -o "viewBox=\"0 0 1000 260\"" _site/stats/index.html
# 三个窗口的数字必须不同（否则说明取数没按窗口切）
for f in index year all; do grep -o 'class="kpi"' _site/stats/$f/index.html 2>/dev/null | wc -l; done
```

**提交**：`feat: 统计页（三个窗口各一页，构建时算好，内联 SVG 绘制）`

---

# 阶段 4 · 验证与收尾

### Task 4.1：端到端测试

**文件**：新建 `test/e2e.test.js`

**要点**：用 `node:child_process` 跑一次真实构建到临时目录，断言关键产物存在、统计数字正确。

```js
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

test("条目页渲染出了 Markdown（<strong> 等）", () => {
  const html = readFileSync(join(OUT, "entry/2026-10-14-example/index.html"), "utf8");
  assert.match(html, /<p>/);
});

test("首页不含未渲染的 front matter 定界符", () => {
  const html = readFileSync(join(OUT, "index.html"), "utf8");
  assert.doesNotMatch(html, /^---/m);
});

// ⚠️ 本条是 Step 3 要补的真实测试，先留占位。
// 不要用 assert.ok(true) —— 那恒真、等于没测，会让成功标准 4 看起来被覆盖而实际没有。
// Step 3 会把它替换成下面这段（依赖 load.js 支持 CTZ_CONTENT_ROOT 覆盖内容根目录）：
test.skip("校验失败时构建中断且不产出（设计文档 §7 + 成功标准 4）", () => {
  const root = mkdtempSync(join(tmpdir(), "ctz-e2e-"));
  cpSync("content", join(root, "content"), { recursive: true });
  writeFileSync(join(root, "content/entries/bad.md"), "---\ntype: thougt\ntitle: t\ndate: 2026-10-14\n---\nx\n");
  const out = join(root, "_site");
  let code = 0;
  let stderr = "";
  try {
    execFileSync("npx", ["@11ty/eleventy", "--output", out], {
      stdio: "pipe",
      env: { ...process.env, CTZ_CONTENT_ROOT: root },
    });
  } catch (err) {
    code = err.status ?? 1;
    stderr = String(err.stderr || "");
  }
  assert.notEqual(code, 0, "坏内容必须让构建失败");
  // ⚠️ 不要断言 !existsSync(out)：实测失败时输出目录**仍会被创建**，
  // 因为 passthrough copy（src/assets）在校验之前就跑完了，里面只剩 assets/。
  // 正确的口径是「没有任何 HTML 页面产出」。
  assert.ok(!existsSync(join(out, "index.html")), "失败时不得产出页面");
  assert.ok(!existsSync(join(out, "stats/index.html")), "失败时不得产出页面");
  assert.match(stderr, /type/, "错误信息要指出出问题的字段");
  rmSync(root, { recursive: true, force: true });
});
```

**Step 2**：把 `test()` 里的断言补齐后跑

```bash
npm test
```

预期：全绿。

**Step 3**：把上面那条 `test.skip(...)` 去掉 `.skip`，跑成真实测试

做法：把仓库的 `content/` 复制到临时目录，改坏一个字段，用 `execFileSync(..., { env: { ...process.env, CTZ_CONTENT_ROOT: tmp } })` 跑构建。

两个**实测过的坑**（2026-10-14，Node 24.17.0 + Eleventy 3.1.6）：

1. **必须在 `lib/load.js` 的 `loadContent()` 里真的读 `CTZ_CONTENT_ROOT`**（Task 1.6 已含该兜底）。不加的话，构建会去读仓库自己的正常内容、**成功退出**，这条测试就变成**假绿**——实测过：`exit 0`、`_site` 照常产出。
2. **不要断言「输出目录不存在」**。实测失败时输出目录**仍被创建**，因为 passthrough copy（`src/assets`）在校验之前就执行完了，目录里只剩一个 `assets/`。正确的断言是「**没有任何 HTML 页面**产出」（`index.html`、`stats/index.html` 均不存在）+ 退出码非 0 + stderr 含出错字段名。

**Step 4**：提交

```bash
git add test/e2e.test.js lib/load.js src/_data/site.js
git commit -m "test: 端到端构建断言"
```

---

### Task 4.2：真实站点的硬约束验证脚本

**目标**：把 demo 阶段的 CDP 验证方法（设计文档 §12.3）套到**真实站点**，机械验证 §12.1 与 §12.5 的硬约束。**不要靠肉眼看截图。**

**文件**：新建 `scripts/check-site-constraints.mjs`

**必须覆盖的断言**（每一条都对应设计文档里的明文约束）

| 断言 | 依据 |
| --- | --- |
| 月视图页面不产生滚动（`scrollHeight === clientHeight`） | §12.1 月历必须整体可见 |
| 35/42 个格子零裁切（每格 `scrollHeight <= clientHeight`） | §12.1 |
| 右列表滚动时左月历位移为 0 | §12.1 |
| 次级栏 236px、栏间距 56px | §12.1 统一栅格 |
| 全站滚动条隐藏 | §12.1 |
| G1 底栏四档视口 `gap=0` 贴底（`nav.bottom === innerHeight`） | §12.6 |
| 导航带内网格采样点全部命中底栏、零内容穿透、底色不透明 | §12.6 遮挡检测 |
| 矮视口 760 / 761px 两侧都要测 | §12.3（G1 的旧缺陷只在 ≤760px 复现） |
| 测横向溢出前等切屏动画结束 | §12.3（别把 `translateX` 瞬时值当溢出） |

**做法**：以 `.agents/occl-g1.mjs` 与 `.agents/final-g1.mjs` 为骨架（它们已实现采样点遮挡检测与 gap 检测），把 URL 从 `file://.../docs/ui-demos/g1-line.html` 换成 `http://127.0.0.1:<port>/month/<month>/`，并加一个本地静态服务器（`npx @11ty/eleventy --serve` 或 `node` 起一个极简 server）。

**Step 1**：构建并起服务

```bash
npm run build && npx @11ty/eleventy --serve --port=8080
```

**Step 2**：另开终端跑验证

```bash
node scripts/check-site-constraints.mjs
```

预期：四档视口 × 关键页面全部 PASS。

**Step 3**：提交

```bash
git add scripts/check-site-constraints.mjs
git commit -m "test: 真实站点硬约束验证（CDP 遮挡与贴底检测）"
```

---

### Task 4.3：README 与设计文档回填

**文件**：新建 `README.md`；修改 `docs/specs/2026-10-14-ctz-bujo-share-design.md`

**Step 1**：`README.md` 写「怎么用」——这是给未来的自己看的

内容至少包含：目录结构、写一条条目的完整字段示例、写日总结、`npm run build` / `npm run serve` / `npm test`、以及**新增 tag / 集子必须先登记**这条规矩（设计文档 §11）。

**Step 2**：设计文档回填

> 位置是**文件开头第 8 行的「更新记录」列表**（`**更新记录**` 后追加一条 `- 2026-10-14（…）：…`）——设计文档**没有 §15**，章节只到 §12.6，上轮草案写的「§15 更新记录」是错的。

在「更新记录」追加一条，记录实现阶段定下来的、文档原先没覆盖的事实（这些是本次实测结论，属于设计决策的补充）：

1. **内容层不交给 Eleventy 模板管线**：`content/` 是纯数据，`src/` 才是输入目录。理由是正文里的 `{% %}` 会让 Liquid 预处理崩溃，且 `tags` 会撞 Eleventy 保留键。
2. **YAML 一律用 `JSON_SCHEMA`**：否则 `date: 2026-10-14` 变 `Date`（负时区错一天）、`date: 2026-02-30` 被静默滚成 3 月 2 日，后者违反 §7。
3. **依赖从 2 个变 3 个**：`js-yaml` 成为显式依赖（Eleventy 不原生解析 `.yml`），§7 的「唯一依赖」表述需要改成「Eleventy + zod + js-yaml」。
4. **正文渲染用 Eleventy 自带 `RenderPlugin`** 的 `renderContent("md")`，不引入 `markdown-it`。
5. **条目 slug 不能取 `page.fileSlug`**（会剥掉日期前缀），必须从文件名派生——否则违反 §5.1 的 URL 格式。
6. **四屏在真实站点是四个 URL**（多页静态站），demo 里的哈希路由只在原型中存在。

**Step 3**：提交

```bash
git add README.md docs/specs/2026-10-14-ctz-bujo-share-design.md
git commit -m "docs: README 与设计文档回填实现期结论"
```

---

## 验证清单（全部通过才算做完）

| 检查 | 命令 | 期望 |
| --- | --- | --- |
| 单测全绿 | `npm test` | `fail 0` |
| lib/ 不依赖 Eleventy | `grep -rn "@11ty" lib/` | 无输出 |
| 构建成功 | `npm run build` | 退出码 0，`_site/` 生成 |
| 坏内容中断构建 | 改坏一个 `type` 后 `npm run build` | 退出码非 0，无 `_site`，错误含文件+字段+实际+期望 |
| 关键路由齐全 | `ls _site/month _site/day _site/entry _site/collection _site/tag` | 各目录非空 |
| 主集子 URL 固定 | `test -d _site/collection/all` | 存在 |
| 月视图硬约束 | `node scripts/check-site-constraints.mjs` | 四档视口全 PASS |
| G1 底栏贴底 + 零穿透 | 同上 | `gap=0`，采样点零内容穿透 |
| 未来日期不被拒 | 加一条 `date: 2099-01-01` 的条目，构建 | 成功 |

---

## 风险与取舍

| 风险 | 说明 | 应对 |
| --- | --- | --- |
| 依赖数超出设计文档表述 | §7 写「zod 是唯一依赖」，实测做不到 | 决策 1（推荐 A），并在 Task 4.3 回填文档 |
| CSS 移植走样 | demo 有 370 行 CSS，手抄易漏 | 用 `sed` 按行号整段搬运，不手打；Task 2.4 有核对命令 |
| `renderContent` 是 Eleventy 插件行为 | 若未来 Eleventy 大版本改了插件名，渲染会断 | 单测（Task 4.1）会立刻发现；正文渲染只有一处调用 |
| 分页生成月份的写法 | `src/month.11tydata.js` 的分页源要用预计算的 `site.months`，别用条目数组 | 已写入 Task 3.2 的实现提示 |
| 统计页窗口切换 | 静态站没有客户端状态，需用查询串或三区块 | Task 3.6 已给方案（`?w=`） |
| `eleventyExcludeFromCollections` | 生成页若不排除，会污染集合 | 已实测：本架构下 content 不进模板管线，`src/` 的生成页用 `permalink` 定向即可 |

## 待确认（球在你手上）

1. ~~**决策 1**：taxonomy 的 YAML 解析——按推荐的 **A（加 `js-yaml`）** 走，还是改格式（B）？~~ **已定 A（`js-yaml@^4.1.1` + `JSON_SCHEMA`），2026-10-14 拍板**。
2. ~~包管理器用 **npm** 还是 **pnpm**？（本计划按 npm 写）~~ **已定 npm，2026-10-14 拍板**——计划命令口径本来就是 npm，零改动。
3. ~~统计页的「本月 / 本年 / 全部」切换，用 `?w=` 查询串可以吗？~~ **已定，无需你决定**：查询串在静态站不可能生效（`page.url` 是构建期值），已改为三个真实页面 `/stats/`、`/stats/year/`、`/stats/all/`，见 Task 3.6。

你点头后我就按这个计划开始实现。实现时会走 TDD：每个 Task 先写失败测试，再写实现，再提交。
