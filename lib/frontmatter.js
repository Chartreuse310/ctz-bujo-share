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
