// names-from-code
// © Will Smart 2018. Licence: MIT

const locateEnd = require('./locate-end');
const unicodeCategories = require('./unicode-categories');

const permissableGlobals = {
  Function: true,
  Math: true,
  Object: true,
  console: true,
  model: true,
  event: true,
  state: true,
  newrow: true,
};
const jsKeywords = {
  break: true,
  case: true,
  catch: true,
  continue: true,
  debugger: true,
  default: true,
  delete: true,
  do: true,
  else: true,
  finally: true,
  for: true,
  function: true,
  if: true,
  in: true,
  instanceof: true,
  new: true,
  return: true,
  switch: true,
  this: true,
  throw: true,
  try: true,
  typeof: true,
  var: true,
  void: true,
  while: true,
  with: true,
  class: true,
  const: true,
  enum: true,
  export: true,
  extends: true,
  import: true,
  super: true,
  implements: true,
  interface: true,
  let: true,
  package: true,
  private: true,
  protected: true,
  public: true,
  static: true,
  yield: true,
  null: true,
  true: true,
  false: true,
  undefined: true,
  NaN: true,
  Infinity: true,
  eval: true,
  arguments: true,
};

// API is the public facing class
module.exports = namesFromCodeString;

function namesFromCodeString(codeString) {
  const root = locateEnd(codeString, false),
    names = {};
  addNamesFromCode(codeString, root, names);
  return names;
}

function addNamesFromCode(codeString, part, names) {
  let { range, type } = part,
    [partStart, partEnd] = range;
  if (partEnd === undefined) partEnd = codeString.length;

  switch (type) {
    case '...':
    case '${}':
    case '()':
    case '[]':
    case '{}':
      if (!part.children) addNamesFromCodeString(codeString.substring(partStart, partEnd), names);
      else {
        let start = partStart;
        for (const child of part.children) {
          const [childStart, childEnd] = child.range;
          if (childStart > start) {
            addNamesFromCodeString(codeString.substring(start, childStart), names);
          }
          start = childEnd;

          addNamesFromCode(codeString, child, names);
        }
      }
      break;
    default:
      if (part.children) {
        for (const child of part.children) {
          addNamesFromCode(codeString, child, names);
        }
      }
  }
}

function addNamesFromCodeString(codeString, names) {
  const validVariable = `(?:${unicodeCategories.varStart})(?:${unicodeCategories.varInnard})*`,
    re = new RegExp(`(.*?)((?:state\.)?${validVariable})`, 'g'),
    allowableGapRe = /(?<!\.\s*)$/;
  let match;
  while ((match = re.exec(codeString))) {
    const gap = match[1],
      name = match[2];
    if (!allowableGapRe.test(gap)) continue;
    if (!(permissableGlobals[name] || jsKeywords[name])) names[name] = true;
  }
}
