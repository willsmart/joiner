// clone
// © Will Smart 2018. Licence: MIT

// This is a simple util to attach names to elements
// API is the function. Use via
//   const nameForElement = require(pathToFile)
// or
//   const {nameForElement, cloneShowingElementNames} = require(pathToFile)

module.exports = nameForElement;
Object.assign(nameForElement, {
  nameForElement,
  cloneShowingElementNames,
});

let nextElementIndex = 1;

function nameForElement(element) {
  let name = element.getAttribute('nobo-name');
  if (!name) {
    name = `#${nextElementIndex++}`;
    element.setAttribute('nobo-name', name);
  }
  return name;
}

function cloneShowingElementNames(value) {
  return _cloneShowingElementNames(value).clone;
}

function _cloneShowingElementNames(value) {
  if (Array.isArray(value)) {
    let names = value.map(el => (el.getAttribute ? nameForElement(el) : undefined));
    if (!names.find(name => name)) names = undefined;
    return {
      clone: value.map(el => (el.getAttribute ? el : _cloneShowingElementNames(el).clone)),
      name: names ? names.join(', ') : undefined,
    };
  } else if (value && typeof value == 'object') {
    if (value.getAttribute) return { clone: value, name: nameForElement(value) };
    const clone = {};
    for (const [key, child] of Object.entries(value)) {
      const { name: childName, clone: childClone } = _cloneShowingElementNames(child);
      clone[key] = childClone;
      if (childName) clone[`${key}--${Array.isArray(childName) ? 'names' : 'name'}`] = childName;
    }
    return { clone };
  }
  return { clone: value };
}
