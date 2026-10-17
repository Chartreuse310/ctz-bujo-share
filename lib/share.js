// JSON in a script data block must never contain an HTML closing tag.
export function shareJson(value) {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, c =>
    ({ '<': '\\u003c', '>': '\\u003e', '&': '\\u0026', '\u2028': '\\u2028', '\u2029': '\\u2029' })[c]);
}
