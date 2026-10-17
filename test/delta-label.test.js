import { test } from 'node:test';
import assert from 'node:assert/strict';
import nunjucks from 'nunjucks';
import { withDelta } from '../lib/stats.js';
const env = new nunjucks.Environment(new nunjucks.FileSystemLoader('src/_includes'));
env.addFilter('substr', (s, start) => String(s).slice(start));
const render = delta => env.renderString('{% from "delta-label.njk" import deltaLabel %}{{ deltaLabel(delta) }}', { delta });

test('上下实心三角独立于文字，保留完整可访问名称', () => {
  for (const [current, previous, label, path] of [[7,0,'▲ +7 条','M0 8L5 0L10 8Z'],[2,5,'▼ -3 条','M0 0L10 0L5 8Z']]) {
    const html=render(withDelta(current, previous));
    assert.ok(html.includes('aria-label="'+label+'"'));
    assert.ok(html.includes('d="'+path+'"'));
    assert.ok(html.includes('<span aria-hidden="true">'+label.slice(2)+'</span>'));
  }
});
test('持平不显示三角', () => {
  assert.equal(render(withDelta(5,5)), '=');
});
