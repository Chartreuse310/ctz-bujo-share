import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shareJson } from '../lib/share.js';
import { selectedItems } from '../src/assets/share-selection.js';

test('分享数据安全嵌入脚本且正文、emoji 和特殊字符往返不变', () => {
  const data = { title: '🏃 <标题>', body: '</script><script>alert(1)</script>\u2028\u2029 & "正文"' };
  const json = shareJson(data);
  assert.doesNotMatch(json, /[<>&\u2028\u2029]/);
  assert.deepEqual(JSON.parse(json), data);
});

test('默认全选、部分选择、全取消；选择顺序不改变来源顺序', () => {
  const items = [{ id: 'daily' }, { id: 'order-1' }, { id: 'order-2' }, { id: 'filename' }];
  assert.deepEqual(selectedItems(items, new Set(items.map(x => x.id))), items);
  assert.deepEqual(selectedItems(items, new Set(['filename', 'daily', 'order-1'])), [items[0], items[1], items[3]]);
  assert.deepEqual(selectedItems(items, new Set()), []);
  assert.deepEqual(selectedItems([], new Set()), []);
});
