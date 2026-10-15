import { z } from "zod";
import { fail } from "./errors.js";

/** slug 规则（设计文档 §4.3）：小写字母 + 数字 + 单连字符。定义在 taxonomy（登记表是 slug 的家），schema.js 转出口保持兼容。 */
export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

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

/**
 * 机械归一：只做可判定的等价变换（设计文档 §11.1 / §7）——
 * NFKC 全角→半角、大小写；空白差异用两个形态比对（见 suggestName）。
 * 不做中文相似度猜测：「绘画」与「书影音」编辑距离也可能很近却毫无关系，
 * 给错误的「最接近」比不给更糟，所以没有可机械判定的差异就不建议。
 */
export const normalizeName = (s) =>
  String(s ?? "").normalize("NFKC").toLowerCase();

/** 归一后的两种空白形态：折叠成单格 / 去掉全部空白（「仅差空白」的机械判定）。 */
const forms = (s) => {
  const n = normalizeName(s).replace(/\s+/g, " ").trim();
  return [n, n.replace(/ /g, "")];
};

/**
 * 名称匹配三态（设计文档 §7 / §11.1 的分工）：
 *  - exact：原样命中（含主集子名）→ 放行
 *  - close：NFKC+小写+空白折叠后与某个已登记名等价（即仅差空白/全半角/大小写）。
 *          归一是**录入层**（§11.1，Agent 落盘前抹平）的职责；构建期是第二道防线，
 *          按 §7 必须**报错**并给出最接近的已登记名称，不能静默放行。
 *  - none：连 NFKC 都不命中 → 无可机械判定的接近项，不给建议（中文相似度不可靠）。
 * match 字段：close/exact 时为命中的已登记名，none 时为 null。
 */
export function suggestName(tax, kind, input) {
  const rows = kind === "collection"
    ? [{ name: tax.default_collection_name }, ...tax.collections]
    : tax.tags;
  if (rows.some((r) => r.name === input)) return { status: "exact", match: input };

  // close：归一后任一空白形态相等（「仅差空白/全半角/大小写」的机械判定）
  const inForms = new Set(forms(input));
  const close = rows.find((r) => forms(r.name).some((f) => inForms.has(f)));
  if (close) return { status: "close", match: close.name };
  return { status: "none", match: null };
}

/**
 * 可复制的登记片段（设计文档 §7：未登记引用报错时给出）。
 * slug 永远留空 —— 不自动生成 slug，用户自己决定（§5.2 硬约束）。
 */
export function registrationSnippet(kind, name) {
  const label = kind === "collection" ? "collections" : "tags";
  return `${label}:\n  - name: ${name}\n    slug: `; // slug 由用户填写，不代生成
}
