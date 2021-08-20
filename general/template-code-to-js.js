// template-code-to-js
// © Will Smart 2018. Licence: MIT

const { locateEndOfString } = require('./locate-end');

// Takes a piece of template string code and converts it to a JS code string

module.exports = templateCodeToJs;

function templateCodeToJs(templateCode) {
  const info = locateEndOfString(templateCode, false, 0);
  let prevEnd = 0,
    literal = templateCode;
  const parts = [];

  if (info.children) {
    literal = undefined;
    for (const { range } of info.children) {
      const [start, end] = range;
      if (start > prevEnd) {
        parts.push(`\`${templateCode.substring(prevEnd, start).replace('`', '\\`')}\``);
      }
      parts.push(`(${templateCode.substring(start + 2, (prevEnd = end) - 1)})`);
    }
  }
  if (prevEnd < templateCode.length) {
    parts.push(`\`${templateCode.substring(prevEnd).replace('`', '\\`')}\``);
  }

  if (parts.length == 1 && /^\([\s\S]*\)$/.test(parts[0])) {
    parts[0] = parts[0].substring(1, parts[0].length - 1);
  }
  return {
    parts,
    js: parts.join('+'),
    literal,
  };
}
