// Isolated browser fixtures: never written into public content/.
export const shareFixtures = [
  { id: 'daily', kind: 'daily', title: '今天的小结', tags: [], html: '<p>今天完成了记录，也留下一些想法。</p>' },
  { id: 'short', kind: 'event', title: '🏃 跑步与记录', collection: '日常', tags: ['跑步'], html: '<p>完整正文第一段。</p><p>这是摘要后仍要导出的最后一段。👨‍👩‍👧‍👦 é</p>' },
  { id: 'long', kind: 'thought', title: '长文与续页', collection: '日常', tags: [], highlight: true,
    html: Array.from({length: 15}, (_, i) => `<p>第${i + 1}段：${'中文正文与标点，保持阅读顺序。👩🏽‍🎨 '.repeat(9)}</p>`).join('') },
  { id: 'paragraph', kind: 'thought', title: '超长单段', collection: '日常', tags: [], html: `<p>${'单段 👨‍👩‍👧‍👦 é 🏃🏽‍♀️ 内容不裁切，'.repeat(220)}</p>` },
  { id: 'rules', kind: 'thought', title: '分隔线跨页', tags: [], html: '<p>之前。</p>' + '<hr>'.repeat(50) + '<p>之后。</p>' },
  { id: 'blocks', kind: 'event', title: '列表、引用与宽内容', collection: '日常', tags: ['已有标签'],
    html: `<ol start="3">${Array.from({length: 16}, (_, i) => `<li>列表${i} ${'有序内容 '.repeat(28)}</li>`).join('')}</ol><blockquote><p>${'引用段落 '.repeat(180)}</p></blockquote><pre><code>${'wide_code_'.repeat(90)}</code></pre><table><tbody><tr><th>列一</th><th>列二</th></tr><tr><td>${'long-word'.repeat(30)}</td><td>正文</td></tr></tbody></table><p><a href="https://example.com">${'https://example.com/'.repeat(30)}</a></p>` },
];
