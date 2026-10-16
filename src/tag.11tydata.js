export default {
  layout: "base.njk",
  navActive: "index",
  // ⚠️ permalink 不用 tg.url（已带前缀，见 entry.11tydata.js 说明），由 slug 现算
  pagination: { data: "site.tags", size: 1, alias: "tg" },
  permalink: (data) => `/tag/${data.tg.slug}/`,
  // 模板变量统一叫 t（tag）。历史上 alias 一直叫 tg 但模板用 t——t 一直是 undefined，
  // Nunjucks 静默渲染成空态页（线上 tag 页 h1="#"、恒 0 条，2026-10-16 夜·十才实测揪出）。
  // 这里用 eleventyComputed 把 t 显式接到分页项，模板与侧栏选中态都用 t。
  eleventyComputed: {
    t: (data) => data.tg,
  },
};
