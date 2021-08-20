// change-detector-object
// © Will Smart 2018. Licence: MIT

module.exports = changeDetectorObject;

changeDetectorObject.isCDO = object => {
  return object && typeof object == 'object' && '__cdo__' in object;
};

function changeDetectorObject(baseObject, readOnly, setParentModified) {
  if (!baseObject || typeof baseObject != 'object') return baseObject;
  const changeObject = {},
    deletionsObject = {},
    modified = [false];
  function setModified() {
    if (readOnly) throw { log: false, type: 'ImmutableCDOMutation', message: 'Cannot mutate in non-mutating CDO' };
    if (setParentModified) setParentModified();
    modified[0] = true;
  }
  return {
    changeObject,
    deletionsObject,
    modified,
    get modifiedObject() {
      if (!modified[0]) return baseObject;
      const newObject = Object.assign({}, baseObject);
      if (deletionsObject) for (const key of Object.keys(deletionsObject)) delete newObject[key];
      if (changeObject) {
        for (const [key, newValue] of Object.entries(changeObject)) {
          if (newValue && typeof newValue == 'object') {
            newObject[key] = newValue.modifiedObject;
          } else newObject[key] = newValue;
        }
      }
      return newObject;
    },
    clearChanges: () => {
      for (key of Object.keys(changeObject)) delete changeObject[key];
      for (key of Object.keys(deletionsObject)) delete deletionsObject[key];
      modified[0] = false;
    },
    useObject: new Proxy(
      {},
      {
        getPrototypeOf: () => Object.getPrototypeOf(baseObject),
        isExtensible: () => Object.isExtensible(baseObject),
        getOwnPropertyDescriptor: (_obj, prop) =>
          deletionsObject[prop]
            ? undefined
            : Object.getOwnPropertyDescriptor(changeObject, prop) || Object.getOwnPropertyDescriptor(baseObject, prop),
        defineProperty: (_obj, key, descriptor) => {
          setModified();
          delete deletionsObject[key];
          return Object.defineProperty(changeObject, key, descriptor);
        },
        has: (_obj, key) => key == '__cdo__' || (!deletionsObject[key] && (key in changeObject || key in baseObject)),
        get: (_obj, key) => {
          if (deletionsObject[key]) return;
          if (key in changeObject) {
            const ret = changeObject[key];
            return ret && typeof ret == 'object' ? ret.useObject : ret;
          }
          const ret = baseObject[key];
          if (ret && typeof ret == 'object') {
            return (changeObject[key] = changeDetectorObject(ret, readOnly, setModified)).useObject;
          }
          return ret;
        },
        set: (_obj, key, value) => {
          setModified();
          delete deletionsObject[key];
          if (value && typeof value == 'object') {
            return (changeObject[key] = changeDetectorObject(value, readOnly, setModified)).useObject;
          }
          changeObject[key] = value;
          return true;
        },
        deleteProperty: (_obj, key) => {
          setModified();
          delete changeObject[key];
          deletionsObject[key] = true;
          return true;
        },
        ownKeys: () => {
          if (!modified[0]) return Reflect.ownKeys(baseObject);
          const keys = new Set([...Reflect.ownKeys(baseObject), ...Reflect.ownKeys(changeObject)]);
          for (const key of Object.keys(deletionsObject)) keys.delete(key);
          return [...keys];
        },
      }
    ),
  };
}
