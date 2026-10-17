import { test } from 'node:test';
import assert from 'node:assert/strict';
import nunjucks from 'nunjucks';
const env = new nunjucks.Environment(new nunjucks.FileSystemLoader('src/_includes'));
env.addFilter('substr', (s, start) => String(s).slice(start));
const render = (pts) => env.render('trend-svg.njk', { pts });

test('趋势首点从左边界开始，最大值落在顶部且与刻度一致', () => {
  const svg = render([{ label:'2026-10-01', events:0, thoughts:1 }, { label:'2026-10-02', events:5, thoughts:0 }]);
  const path = svg.match(/<path d="([^"]+)"/)[1];
  assert.equal(path, 'M56 214 L976 30');
});
test('单月份趋势仍有可见数据点', () => {
  const svg = render([{ label:'2026-10', events:5, thoughts:1 }]);
  assert.match(svg, /<circle[^>]*cx="516"[^>]*cy="30"/);
});
test('空趋势不产生无效数字', () => {
  assert.doesNotMatch(render([]), /NaN|Infinity/);
});
