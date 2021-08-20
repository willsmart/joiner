// map_values
// © Will Smart 2018. Licence: MIT

// Simply applies a map over the values in a plain object
// eg mapValues({a:1,b:2}, v=>v+1) == {a:2,b:3}

// API if the function
// include as:
//  const mapValues = require(pathToFile)
module.exports = mapValues;

function mapValues(object, fn) {
  const ret = {};
  Object.keys(object).forEach(key => {
    const val = fn(object[key], key);
    if (val != undefined) ret[key] = val;
  });
  return ret;
}
