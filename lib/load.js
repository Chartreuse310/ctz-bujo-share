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
  // 不加这个兜底，那个测试会读到仓库自己的正常内容、构建成功，从而假绿（实测过：退出码 0、_site 照常产出）。
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

  // 同日条目手动排序（设计文档 §4.4，2026-10-16 拍板）：
  // 同日内 → 有 order 的按升序在最前 → 无 order 的按文件名序跟后 → order 相同按文件名序兜底。
  // 只影响日页/首页的当日分组；跨日排序与集子/tag/统计的日期倒序规则不变。
  const byFilename = (a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0);
  const withOrder = (e) => (e.order == null ? Infinity : e.order);
  for (const list of Object.values(entriesByDate)) {
    list.sort((a, b) => withOrder(a) - withOrder(b) || byFilename(a, b));
  }

  return { taxonomy, entries, dailies, dailyByDate, entriesByDate };
}
