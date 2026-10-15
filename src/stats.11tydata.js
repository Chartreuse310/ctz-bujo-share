export default {
  layout: "base.njk",
  // 分页源是三个窗口名；site.windows 已经算好了，模板只负责画
  pagination: { data: "site.windowKeys", size: 1, alias: "w" },
  permalink: (data) => (data.w === "month" ? "/stats/" : `/stats/${data.w}/`),
  eleventyExcludeFromCollections: true,
};
