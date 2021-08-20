// locate-end
// © Will Smart 2018. Licence: MIT

// This locates the end of a string literal or code block from some point in a string

// API is the function. Use via
//   const locateEnd = require(pathToFile)

/* eg:

locateEnd('` ${1+"\\"two\\""+three(four[5])}`+six')
= 
{
  range: [0, 32],
  type: "``",
  children: [
    {
      range: [2, 31],
      type: "${}",
      children: [
        { range: [6, 15], type: '""' },
        { range: [21, 30], type: "()", children: [{ range: [26, 29], type: "[]" }] }
      ]
    }
  ]
}

locateEnd('eeepies','p') == {"range":[0,4],"type":"p"}
*/

module.exports = locateEnd;
locateEnd.locateEndOfString = locateEndOfString;

function locateEndOfString(string, closeChar, openIndex) {
  const openIndexWas = openIndex;
  if (closeChar !== false && (typeof closeChar != 'string' || closeChar.length != 1)) {
    closeChar = string.charAt(openIndex);
    switch (closeChar) {
      case '"':
      case "'":
      case '`':
        break;
      default:
        return locateEnd(string, undefined, openIndex);
    }
    openIndex++;
  }

  let regex;
  switch (closeChar) {
    case false:
      regex = /(?:\\$|(?!\$\{)[\s\S])*/g;
      break;
    case '`':
      regex = /(?:\\`|\\$|(?!\$\{)[^`])*/g;
      break;
    case "'":
      regex = /(?=((?:\\'|[^'])*))\1'/g;
      break;
    case '"':
      regex = /(?=((?:\\"|[^"])*))\1"/g;
      break;
    default:
      return locateEnd(string, closeChar, openIndex);
  }
  const ret = {
    range: [openIndexWas, undefined],
    type: closeChar === false ? '...`' : `${closeChar}${closeChar}`,
  };
  if (closeChar !== false && closeChar != '`') {
    regex.lastIndex = openIndex;
    const match = regex.exec(string);
    if (match) ret.range[1] = regex.lastIndex;
    return ret;
  }

  regex.lastIndex = openIndex;
  while (true) {
    regex.exec(string);
    if (regex.lastIndex == string.length) return ret;
    const endChar = string.charAt(regex.lastIndex);
    if (endChar === closeChar) {
      ret.range[1] = regex.lastIndex + 1;
      return ret;
    }

    // must be a ${
    const child = locateEnd(string, undefined, regex.lastIndex + 1);
    if (!child) return;
    if (child.type == '{}') {
      child.type = '${}';
      child.range[0]--;
    }
    ret.children = ret.children || [];
    ret.children.push(child);
    if (child.range[1] === undefined) return ret;
    regex.lastIndex = child.range[1];
  }
}

const bracketTypes = {
  '(': ')',
  '[': ']',
  '{': '}',
};

function locateEnd(string, closeChar, openIndex = 0) {
  const ret = {
    range: [openIndex, undefined],
  };
  let closeCharClass = '';
  if (closeChar !== false && (typeof closeChar != 'string' || closeChar.length != 1)) {
    const openChar = string.charAt(openIndex);
    closeChar = bracketTypes[openChar];
    switch (openChar) {
      case '"':
      case "'":
      case '`':
        return locateEndOfString(string, undefined, openIndex);
    }
    if (!closeChar) return;
    openIndex++;
  }
  switch (closeChar) {
    case false:
      ret.type = '...';
      break;
    case '"':
    case "'":
    case '`':
      return locateEndOfString(string, closeChar, openIndex);
    case '}':
      ret.type = '{}';
      break;
    case ')':
      ret.type = '()';
      break;
    case ']':
      ret.type = '[]';
      break;
    default:
      ret.type = closeChar;
      closeCharClass = `\\${closeChar}`;
      break;
  }

  const regex = new RegExp(`[^'"\\\`{}()[\\]${closeCharClass}]*`, 'g');

  regex.lastIndex = openIndex;
  while (true) {
    const match = regex.exec(string);
    if (regex.lastIndex == string.length) return ret;
    const endChar = string.charAt(regex.lastIndex);
    if (endChar === closeChar) {
      ret.range[1] = regex.lastIndex + 1;
      return ret;
    }
    let child;
    switch (endChar) {
      case '`':
      case "'":
      case '"':
        child = locateEndOfString(string, undefined, regex.lastIndex);
        break;
      case '[':
      case '{':
      case '(':
        child = locateEnd(string, undefined, regex.lastIndex);
        break;
      default:
        return;
    }
    if (!child) return;
    ret.children = ret.children || [];
    ret.children.push(child);
    if (child.range[1] === undefined) return ret;
    regex.lastIndex = child.range[1];
  }
}
