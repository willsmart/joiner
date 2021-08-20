// code-snippet
// © Will Smart 2018. Licence: MIT

// A wrapper for vm allowing both server and client to run amophous code
// The key win here is a mechanism to safely ensure the variables and objects referenced in the code are set

// API is auto-generated at the bottom from the public interface of the CodeSnippet class

const PublicApi = require('./public-api');
const changeDetectorObject = require('./change-detector-object');
const wrapFunctionLocals = require('./wrap-function-locals');
const log = require('../general/log');
const ConvertIds = require('../datapoints/convert-ids');

let nextLocalId = 1;

class Code {
  static withString(codeString) {
    const codes = Code.codes || (Code.codes = {});
    return codes[codeString] || (codes[codeString] = new Code(codeString));
  }

  constructor(codeString) {
    const code = this;
    Object.assign(code, wrapFunctionLocals(codeString));
  }

  evalOnContext(context, state, event, allocateRowObject, getDatapointValue) {
    const code = this,
      { wrappedFunction } = code,
      changeDetectingContext = changeDetectorObject(context);
    let result = wrappedFunction
      ? event
        ? wrappedFunction.call(
            event.target || event,
            changeDetectingContext.useObject,
            state,
            {},
            event,
            allocateRowObject,
            getDatapointValue
          )
        : wrappedFunction(changeDetectingContext.useObject, state, {}, event, allocateRowObject, getDatapointValue)
      : undefined;
    return {
      context,
      changeDetectingContext,
      result,
    };
  }

  evalOnModelCDO(modelCDO, state, event, allocateRowObject, getDatapointValue) {
    const code = this,
      { wrappedFunction } = code;
    let result = wrappedFunction
      ? event
        ? wrappedFunction.call(
            event.target || event,
            modelCDO,
            state,
            modelCDO,
            event,
            allocateRowObject,
            getDatapointValue
          )
        : wrappedFunction(modelCDO, state, modelCDO, event, allocateRowObject, getDatapointValue)
      : undefined;
    return {
      modelCDO,
      result,
    };
  }
}

class CodeSnippet {
  // public methods
  static publicMethods() {
    return ['evaluate', 'safeEvaluate', 'names', 'func', 'parse', 'setAsFunction'];
  }

  constructor({ code, func, names, ignoreNames = {} }) {
    const codeSnippet = this;

    codeSnippet.defaultValue = '...';
    codeSnippet.defaultTimeout = 1000;
    codeSnippet.ignoreNames = ignoreNames;
    codeSnippet.codeString = code;

    if (typeof func == 'function') {
      codeSnippet.setAsFunction({ func, names });
    } else {
      codeSnippet.code = Code.withString(code);
    }
  }

  get names() {
    return this._names || this.code.names;
  }

  setAsFunction({ func, names }) {
    const codeSnippet = this;

    if (typeof func != 'function') return;

    delete codeSnippet._func;
    if (!names || typeof names != 'object') names = {};
    codeSnippet._names = names && typeof names == 'object' ? names : {};
    codeSnippet._func = func;
  }

  forEachName(callback, names, stack) {
    const codeSnippet = this;

    stack = stack || [];
    names = names || codeSnippet.names;

    let hasName = false;
    for (const [name, value] of Object.entries(names)) {
      if (codeSnippet.ignoreNames[name]) continue;
      hasName = true;
      stack.push(name);
      if (!value || typeof value != 'object' || !codeSnippet.forEachName(callback, value, stack)) {
        callback(...stack);
      }
      stack.pop();
    }
    return hasName;
  }

  safeEvaluate({
    cache,
    getDatapointValue,
    rowId,
    getRowObject,
    valueForNameCallback,
    valuesByName,
    defaultValue,
    timeout,
    event,
    evaluationState,
  }) {
    try {
      return { error: undefined, result: this.evaluate(arguments[0]) };
    } catch (error) {
      return { error, result: defaultValue || this.defaultValue };
    }
  }

  evaluate({
    cache,
    getDatapointValue,
    rowId,
    getRowObject,
    valueForNameCallback,
    valuesByName,
    defaultValue,
    timeout,
    event,
    evaluationState,
  }) {
    const codeSnippet = this,
      sandbox = {};

    if (!defaultValue) defaultValue = codeSnippet.defaultValue;
    if (!timeout) timeout = codeSnippet.defaultTimeout;

    let allocateRowObject_localIdIndex = 0;
    const //stateVar = cache ? cache.stateVar : undefined,
      state = getRowObject('state__page'),
      rowObject = rowId ? getRowObject(rowId) : undefined,
      allocateRowObject = (typeName, initialValues) => {
        if (!evaluationState) return;
        const localIds = evaluationState.localIds || (evaluationState.localIds = []),
          localIdIndex = allocateRowObject_localIdIndex++,
          localId = localIds.length > localIdIndex ? localIds[localIdIndex] : (localIds[localIdIndex] = nextLocalId++);
        const row = getRowObject(ConvertIds.recomposeId({ typeName, proxyKey: `l${localId}` }).rowId);
        if (initialValues && typeof initialValues == 'object') {
          Object.assign(row, initialValues);
        }
        return row;
      };

    if (typeof valueForNameCallback != 'function') {
      valueForNameCallback = (...names) => {
        let values = valuesByName;
        let index = 0;
        for (const name of names) {
          if (!values || typeof values != 'object') return;
          if (index < names.length - 1) values = values[name];
          else return values[name];
          index++;
        }
      };
    }

    codeSnippet.forEachName((...names) => {
      let localSandbox = sandbox,
        index = 0;
      for (const name of names) {
        const value = valueForNameCallback(...names.slice(0, index + 1));
        if (index == names.length - 1 || changeDetectorObject.isCDO(value)) {
          localSandbox[name] = value;
          break;
        } else {
          localSandbox = localSandbox[name] ? localSandbox[name] : (localSandbox[name] = {});
        }
        index++;
      }
    });

    let result = codeSnippet.defaultValue;
    try {
      if (codeSnippet._func) {
        if (event) {
          result = codeSnippet._func.call(event, sandbox, state, allocateRowObject);
        } else result = codeSnippet._func(sandbox, state, allocateRowObject);
      } else if (rowObject) {
        ({ result } = codeSnippet.code.evalOnModelCDO(rowObject, state, event, allocateRowObject, getDatapointValue));
      } else {
        ({ result } = codeSnippet.code.evalOnContext(sandbox, state, event, allocateRowObject, getDatapointValue));
      }
    } catch (error) {
      if (error.log !== false) {
        log('err.code', `Error while evaluating code: ${error.message}`);
      }
      throw error;
      //} finally {
      //if (stateVar) stateVar.commitStateVar();
    }

    return result;
  }
}

// API is the public facing class
module.exports = PublicApi({
  fromClass: CodeSnippet,
  hasExposedBackDoor: true,
});
