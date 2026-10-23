import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

test('集子显示全部标签并隐藏集子，标签页显示集子并隐藏全部标签', () => {
  const root = mkdtempSync(join(tmpdir(), 'ctz-index-'));
  const out = resolve('.e2e-site/index-metadata');
  try {
    mkdirSync(join(root, 'content/entries'), { recursive: true });
    mkdirSync(join(root, 'content/daily'));
    writeFileSync(join(root, 'content/taxonomy.yml'), 'default_collection_name: 日常\ncollections:\n  - { name: 绘画, slug: drawing }\ntags:\n  - { name: 标签甲, slug: alpha }\n  - { name: "长标签 & <测试>", slug: long }\n');
    for (const [slug, collection, tags] of [
      ['multiple', '绘画', ['标签甲', '长标签 & <测试>']],
      ['none', '绘画', []],
      ['default', undefined, ['标签甲']],
    ]) {
      writeFileSync(join(root, `content/entries/2026-10-23-${slug}.md`), `---\ntype: event\ntitle: ${slug}\ndate: 2026-10-23\n${collection ? `collection: ${collection}\n` : ''}tags: ${JSON.stringify(tags)}\n---\n\n正文。`);
    }
    execFileSync(process.execPath, ['node_modules/@11ty/eleventy/cmd.cjs', '--output', out], { env: { ...process.env, CTZ_CONTENT_ROOT: root }, stdio: 'pipe' });
    const rows = path => [...readFileSync(join(out, path, 'index.html'), 'utf8').matchAll(/<a class="resrow"[\s\S]*?<\/a>/g)].map(m => m[0]);
    const metadata = row => row.match(/<div class="r">([\s\S]*?)<\/div>/)[1];
    const drawing = rows('collection/drawing');
    assert.equal(drawing.length, 2);
    const multiple = metadata(drawing.find(row => row.includes('>multiple</h4>')));
    assert.match(multiple, /class="tag type">事件/);
    assert.match(multiple, /># 标签甲<\/span>/);
    assert.match(multiple, /># 长标签 &amp; &lt;测试&gt;<\/span>/);
    assert.ok(!multiple.includes('绘画'));
    assert.equal((metadata(drawing.find(row => row.includes('>none</h4>'))).match(/class="tag/g) || []).length, 1, '无标签时只保留类型');
    const defaults = rows('collection/all');
    assert.equal(defaults.length, 1);
    assert.match(metadata(defaults[0]), /># 标签甲<\/span>/);
    assert.ok(!metadata(defaults[0]).includes('日常'));
    const tagged = rows('tag/alpha');
    assert.equal(tagged.length, 2);
    for (const row of tagged) {
      assert.match(metadata(row), /class="tag type">事件/);
      assert.match(metadata(row), />(绘画|日常)<\/span>/);
      assert.ok(!metadata(row).includes('# '), '标签页连其他标签也不重复展示');
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(out, { recursive: true, force: true });
  }
});
