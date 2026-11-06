/** 暂停分享时以最后记录锚定月份和统计；空库沿用构建日。 */
export function archiveDate(entries, dailies, buildDate, archived) {
  if (!archived) return buildDate;
  return [...entries, ...dailies].map(item => item.date).sort().at(-1) ?? buildDate;
}
