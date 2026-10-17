/** Fisher–Yates 无放回抽样；重复抽到同一集合时换入一个未展示项。 */
export function sampleThoughts(items, count = 3, random = Math.random, previous = []) {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const selected = shuffled.slice(0, count);
  if (selected.length && items.length > selected.length && selected.every(x=>previous.includes(x))) {
    selected[selected.length - 1] = items.find(x=>!selected.includes(x));
  }
  return selected;
}

if (typeof document !== 'undefined') {
  const pool = [...document.querySelectorAll('#thought-pool template')];
  const list = document.querySelector('#thought-list');
  const button = document.querySelector('#shuffle-thoughts');
  if (list && button && pool.length) {
    let previous = [];
    const refresh = () => {
      previous = sampleThoughts(pool, 3, Math.random, previous);
      list.replaceChildren(...previous.map(t=>t.content.cloneNode(true)));
    };
    refresh();
    button.hidden = pool.length <= 3;
    button.addEventListener('click', refresh);
  }
}
