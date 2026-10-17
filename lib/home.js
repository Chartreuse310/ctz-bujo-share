/** 首页聚合；与四屏数据互不修改，日期沿用内容 date（含未来日期）。 */
export function buildHome(entries, dailies) {
  const ordered = [...entries].sort((a,b) => b.date.localeCompare(a.date) || a.file.localeCompare(b.file));
  const dates = [...entries, ...dailies].map(e=>e.date).sort();
  return {
    thoughts: ordered.filter(e=>e.type === 'thought'),
    recent: ordered.filter(e=>e.type === 'event').slice(0,5),
    start: dates[0] ?? null,
    latest: dates.at(-1) ?? null,
  };
}

/** 首页只展示纯文本摘录；不把 Markdown 图片或 HTML 注入摘要。 */
export function homeText(body = '') {
  return body.replace(/```[\s\S]*?```/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]*>/g, '')
    .replace(/^\s{0,3}(?:#{1,6} |>|[-*+] )/gm, '')
    .replace(/[*_`~]/g, '').replace(/\s+/g, ' ').trim();
}
