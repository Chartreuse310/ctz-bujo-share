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
