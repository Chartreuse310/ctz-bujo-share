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
