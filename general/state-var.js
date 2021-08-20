// state-var
// © Will Smart 2018. Licence: MIT

const PublicApi = require('./public-api');
const ConvertIds = require('../datapoints/convert-ids');
const changeDetectorObject = require('./change-detector-object');

class StateVar {
  // public methods
  static publicMethods() {
    return ['stateVar', 'commitStateVar', 'datapointId'];
  }

  constructor({ cache }) {
    const stateVar = this;
    Object.assign(stateVar, {
      cache,
      state: {},
    });
  }

  get stateVar() {
    const stateVar = this;
    if (!stateVar.cdo) {
      stateVar.cdo = changeDetectorObject(stateVar.state);
    }
    return stateVar.cdo.useObject;
  }

  commitStateVar() {
    const stateVar = this,
      { cdo } = stateVar;
    if (!cdo) return;
    stateVar.commitStateChange('state', cdo);
    stateVar.state = cdo.modifiedObject;
    stateVar.cdo = undefined;
  }

  static datapointId(path) {
    return ConvertIds.recomposeId({ rowId: 'state__default', fieldName: path.replace('.', '_') }).datapointId;
  }

  commitStateChange(path, cdo) {
    const stateVar = this,
      { cache } = stateVar,
      { changeObject, deletionsObject, modified } = cdo;
    if (!modified[0]) return;
    if (deletionsObject) {
      for (const key of Object.keys(deletionsObject)) {
        const datapointId = StateVar.datapointId(`${path}.${key}`),
          datapoint = cache.getExistingDatapoint(datapointId);
        if (datapoint) {
          datapoint.setValue(undefined);
        }
      }
    }
    if (changeObject) {
      for (const [key, value] of Object.entries(changeObject)) {
        if (value && typeof value == 'object') {
          stateVar.commitStateChange(`${path}_${key}`, value);
          value = value.modifiedObject;
        }
        const datapointId = StateVar.datapointId(`${path}.${key}`),
          datapoint = cache.getOrCreateDatapoint(datapointId);
        datapoint.setValue(value);
      }
    }
  }
}

// API is the public facing class
module.exports = PublicApi({
  fromClass: StateVar,
  hasExposedBackDoor: true,
});
