// The source already follows daily order; checkbox click order is irrelevant.
export function selectedItems(items, ids) {
  return items.filter(item => ids.has(item.id));
}
