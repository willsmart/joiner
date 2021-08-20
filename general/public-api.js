// convert_ids
// © Will Smart 2018. Licence: MIT

// PublicApi wraps a given class in a function that mimics the class's public methods
// essentially it allows js to support private methods/properties on a class
// I am sure this is available in other modules, this is just my version.

// To use, create a class, and provide a static method called publicMethods that returns an array of strings
// eg.

// class MyPrivateClass {
//   static publicMethods() {
//     return [
//       'publicMethod',
//       'publicGetter',
//       'publicStaticMethod'
//     ]
//   }
//   publicMethod() {this.privateMethod()}
//   privateMethod() {}
//   get publicGetter() {return `It's ${this.privateGetter}`}
//   get privateGetter() {return '42'}
//   static publicStaticMethod() {this.privateStaticMethod()}
//   static privateStaticMethod() {}
// }
//
// Essentially returns a class exposing only the public methods from MyPrivateClass
// const PublicInterface = PublicApi({fromClass:MyPrivateClass})
//
// or allowing instances of PublicInterface to have a '__private' property
//  which points to the underlying MyPrivateClass thus potentially easing debugging
//  and making instance construction a little quicker and instance size a little smaller
// const PublicInterface = PublicApi({fromClass:MyPrivateClass, hasExposedBackDoor:true})
//
// Use PublicInterface like a class
// const blic = new PublicInterface()
// blic.publicGetter == "It's 42"
// blic.privateGetter == undefined

// note that setters aren't supported as yet

// API is the class wrapping function. include as
// const PublicApi = require(pathToFile)
module.exports = PublicApi;

// simple function to wrap a class, exposing only the public interface to outsiders
function PublicApi({ fromClass, hasExposedBackDoor }) {
  const publicInstanceMethods = [],
    publicInstanceGetterMethods = [];

  fromClass.publicMethods().forEach(methodName => {
    if (fromClass.prototype.__lookupGetter__(methodName)) {
      let method = fromClass.prototype.__lookupGetter__(methodName);
      publicInstanceGetterMethods.push({ methodName, method });
    } else if (fromClass.prototype[methodName]) {
      let method = fromClass.prototype[methodName];
      publicInstanceMethods.push({ methodName, method });
    }
  });

  const PublicClass = function(arguments = {}) {
    const private = new fromClass(arguments);
    private.publicApi = this;

    if (hasExposedBackDoor) this.__private = private;
    else {
      publicInstanceGetterMethods.forEach(({ methodName, method }) => {
        this.__defineGetter__(
          methodName,
          function() {
            return method.apply(private, arguments);
          }
        );
      });
      publicInstanceMethods.forEach(({ methodName, method }) => {
        this[methodName] = function() {
          return method.apply(private, arguments);
        };
      });
    }
  };

  fromClass.publicMethods().forEach(methodName => {
    if (fromClass.__lookupGetter__(methodName)) {
      let method = fromClass.__lookupGetter__(methodName);
      PublicClass.__defineGetter__(
        methodName,
        function() {
          return method.apply(fromClass, arguments);
        }
      );
    } else if (fromClass[methodName]) {
      let method = fromClass[methodName];
      PublicClass[methodName] = function() {
        return method.apply(fromClass, arguments);
      };
    }

    publicInstanceGetterMethods.forEach(({ methodName, method }) => {
      PublicClass.prototype.__defineGetter__(
        methodName,
        function() {
          return method.apply(this.__private, arguments);
        }
      );
    });
    publicInstanceMethods.forEach(({ methodName, method }) => {
      PublicClass.prototype[methodName] = function() {
        return method.apply(this.__private, arguments);
      };
    });
  });

  return PublicClass;
}
