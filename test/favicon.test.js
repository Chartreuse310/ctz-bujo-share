import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('全站标签页图标使用部署前缀，SVG 有方形画布及独立问号', () => {
  const base = readFileSync('src/_includes/base.njk', 'utf8');
  assert.match(base, /rel="icon" type="image\/svg\+xml" href="{{ base }}\/assets\/favicon.svg"/);
  const svg = readFileSync('src/assets/favicon.svg', 'utf8');
  assert.match(svg, /viewBox="0 0 64 64"/);
  assert.match(svg, /id="question"/);
  assert.match(svg, /stroke-linecap="round"/);
});
