import { z } from "zod";
import { suggestName, registrationSnippet, SLUG_RE } from "./taxonomy.js";
import { ContentError, fail } from "./errors.js";

export { ContentError, fail, SLUG_RE };

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

  if (d.collection) {
    const s = suggestName(tax, "collection", d.collection);
    if (s.status !== "exact") {
      fail(file, "collection", d.collection,
        (s.status === "close"
          ? `未登记，但与已登记集子「${s.match}」仅差空白/全半角/大小写，请改用「${s.match}」或在登记表里核对`
          : `已登记的集子之一: ${tax.collections.map((c) => c.name).join(" / ") || "(登记表里还没有集子)"}`
        )
        + `\n  登记片段（粘到 content/taxonomy.yml，slug 自己定，不代生成）:\n    ${registrationSnippet("collection", d.collection).replace(/\n/g, "\n    ")}`);
    }
  }
  for (const t of d.tags) {
    const s = suggestName(tax, "tag", t);
    if (s.status !== "exact") {
      fail(file, "tags", t,
        (s.status === "close"
          ? `未登记，但与已登记 tag「${s.match}」仅差空白/全半角/大小写，请改用「${s.match}」或在登记表里核对`
          : `已登记的 tag 之一: ${tax.tags.map((x) => x.name).join(" / ") || "(登记表里还没有 tag)"}`
        )
        + `\n  登记片段（粘到 content/taxonomy.yml，slug 自己定，不代生成）:\n    ${registrationSnippet("tag", t).replace(/\n/g, "\n    ")}`);
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
