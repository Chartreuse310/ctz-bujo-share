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
