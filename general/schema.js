const strippedValues = require('./stripped-values');
const ConvertIds = require('../datapoints/convert-ids');
const PublicApi = require('./public-api');
const CodeSnippet = require('./code-snippet');
const log = require('./log');

// API is auto-generated at the bottom from the public interface of this class
class SchemaDefn {
  // public methods
  static publicMethods() {
    return ['allTypes', 'source', 'addLayout', 'loadSource', 'clear', 'fieldForDatapoint'];
  }

  constructor() {
    this.clear();
  }

  get allTypes() {
    return this._allTypes;
  }

  get source() {
    return this._source;
  }

  addLayout(object) {
    if (!Array.isArray(object)) object = [object];
    object.forEach(child => {
      this._addLayout(child);
    });
  }

  clear() {
    this._allTypes = {};
    this._source = [];
  }

  loadSource(source) {
    if (!Array.isArray(source)) return;
    source.forEach(layout => {
      this._addLayout(layout);
    });
  }

  fieldForDatapoint({ typeName, fieldName }) {
    return this.allTypes[typeName].fields[fieldName];
  }

  getType(name) {
    let schema = this;
    if (name && typeof name == 'object') return name.getEnclosingType();
    return (
      this._allTypes[name] ||
      (this._allTypes[name] = {
        _: 'Type',
        stripped: function() {
          let ret = {};
          if (Object.keys(this.fields).length) ret.fields = strippedValues(this.fields);
          return ret;
        },
        name: name,
        protected: false,
        ownerField: undefined,
        fields: {},
        getEnclosingType: function() {
          return this;
        },
        getField: function(name, dataType, isVirtual, isMultiple) {
          if (name == undefined) {
            return;
          }
          const type = this;
          dataType = schema.getType(dataType);
          return (
            type.fields[name] ||
            (type.fields[name] = {
              _: 'Field',
              stripped: function() {
                let ret = {
                  dataType: this.dataType.name,
                };
                if (this.default !== undefined) ret.default = this.default;
                if (this.get !== undefined) ret.get = this.get;
                if (this.sort !== undefined) ret.sort = this.sort;
                if (this.isVirtual) ret.isVirtual = true;
                if (this.isMultiple) ret.isMultiple = true;
                if (Object.keys(this.links).length) ret.links = strippedValues(this.links);
                return ret;
              },
              name: name,
              dataType: dataType,
              isVirtual: isVirtual || false,
              isMultiple: isMultiple || false,
              isId: /^[A-Z]/.test(dataType.name),
              enclosingType: type,
              links: {},
              fullName: type.name + '::' + name,
              getEnclosingType: function() {
                return type;
              },
              getField: function(name, dataType, isVirtual, isMultiple) {
                if (name == undefined) return this;
                return this.dataType.getField(name, dataType, isVirtual, isMultiple);
              },
              getDatapointId: function({ dbRowId, proxyKey }) {
                return ConvertIds.recomposeId({
                  typeName: this.enclosingType.name,
                  dbRowId,
                  proxyKey,
                  fieldName: this.name,
                }).datapointId;
              },
              getLinkedToField: function() {
                const linkKeys = Object.keys(this.links);
                if (!linkKeys.length) return;
                const link = this.links[linkKeys[0]];
                return link.left === this ? link.right : link.left;
              },
              getLink: function(toField, linkType) {
                const field = this;
                return (
                  field.links[toField.fullName] ||
                  (field.links[toField.fullName] = toField.links[field.fullName] = {
                    _: 'Link',
                    stripped: function() {
                      return {
                        left: this.left.fullName,
                        right: this.right.fullName,
                        linkType: this.type,
                      };
                    },
                    left: field,
                    right: toField,
                    type: linkType,
                  })
                );
              },
            })
          );
        },
      })
    );
  }

  _addLayout(object, me, myFieldName, as, depth) {
    const schema = this;

    depth = depth || 0;
    if (depth == 0) {
      schema._source.push(object);
    }

    const myField = me ? me.getField() : undefined;

    if (Array.isArray(object)) {
      let array = object;
      object = {};
      array.forEach(val => {
        if (typeof val == 'string') object[val] = null;
      });
    }

    if (typeof object == 'string' || typeof object == 'number' || typeof object == 'boolean') {
      if (myField) {
        myField.default = object;
      }
    } else if (object && typeof object == 'object') {
      Object.keys(object).forEach(key => {
        let val = object[key];
        switch (key) {
          case 'as':
            if (typeof val == 'string') as = val;
            break;
          case 'get':
            if (!myField) break;
            myField.isVirtual = true;
            myField.get = new CodeSnippet({ code: val });
            break;
          case 'sort':
            if (!myField) break;
            myField.sort = new CodeSnippet({ code: val });
            break;
          case 'protectedTable':
            if (me && val) me.getEnclosingType().protected = true;
            break;
          case 'ownerField':
            if (me && val && typeof val == 'string') me.getEnclosingType().ownerField = val;
            break;
          case 'default':
          case 'unique':
            if (myField) myField[key] = val;
            break;
          default:
            const match = /^(?:(?:(\w+)\s*)?(--|~-|-~|~<|>~)\s*)?([\w_]+)(?:\((?:(\w+)|\[([A-Z]\w*)\])\))?$/.exec(key);
            const linkTypes = {
              '--': {},
              '~-': {
                rightIsVirtual: true,
              },
              '-~': {
                leftIsVirtual: true,
              },
              '~<': {
                rightIsVirtual: true,
                rightIsMultiple: true,
              },
              '>~': {
                leftIsVirtual: true,
                leftIsMultiple: true,
              },
            };
            if (!match) {
              log('error.schema', `Ignoring undecipherable db layout field: ${key}`);
              break;
            }
            const asName = match[1],
              linkType = match[2],
              childFieldName = match[4] || match[5] ? match[3] : undefined,
              childTypeName = match[4] || match[5] || match[3],
              isMultiple = Boolean(match[5]);
            if (linkType && isMultiple) {
              log(
                'error.schema',
                `Ignoring link field with its datatype specified as an array. Please use athe appropriate link type (like '~<'). The field spec was: ${key}`
              );
              break;
            }
            const linkTypeInfo = linkType ? linkTypes[linkType] : undefined;
            const childField =
              me && childFieldName
                ? me.getField(
                    childFieldName,
                    childTypeName,
                    linkTypeInfo ? linkTypeInfo.rightIsVirtual : isMultiple,
                    linkTypeInfo ? linkTypeInfo.rightIsMultiple : isMultiple
                  )
                : schema.getType(childTypeName);

            const myLocalFieldName = schema._addLayout(
              val,
              childField,
              childFieldName,
              asName || myFieldName,
              depth + 1
            );

            if (linkType && me && myLocalFieldName) {
              const myLocalField = schema
                .getType(childTypeName)
                .getField(
                  myLocalFieldName,
                  me.dataType || me,
                  linkTypeInfo ? linkTypeInfo.leftIsVirtual : false,
                  linkTypeInfo ? linkTypeInfo.leftIsMultiple : false
                );
              myLocalField.getLink(childField, linkType);
            }
        }
      });
    }
    return as;
  }
}

// API is the public facing class
module.exports = PublicApi({
  fromClass: SchemaDefn,
  hasExposedBackDoor: true,
});
