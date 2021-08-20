// watchable
// © Will Smart 2018. Licence: MIT

// This is a stupidly simple observer pattern util

// API is the function. Require via
//   const makeClassWatchable = require(pathToFile)
// then after creating your class use as:
//   makeClassWatchable(TheClass)

module.exports = makeClassWatchable;

let g_nextUniqueCallbackIndex = 1;

function uniqueCallbackKey() {
  return `callback__${g_nextUniqueCallbackIndex++}`;
}

function makeClassWatchable(watchableClass) {
  Object.assign(watchableClass.prototype, {
    watch: function(listener) {
      const me = this;
      if (!listener.callbackKey) listener.callbackKey = uniqueCallbackKey();
      if (me.listeners === undefined) {
        me.listeners = [listener];
        if (typeof me.firstListenerAdded == "function") {
          me.firstListenerAdded.call(me);
        }
      } else {
        const listeners = me.listeners.slice();
        let index = listeners.findIndex(listener2 => listener.callbackKey == listener2.callbackKey);
        if (index == -1) listeners.push(listener);
        else listeners[index] = listener;
        me.listeners = listeners;
      }
      if (typeof me.listenersChanged == "function") {
        me.listenersChanged.call(me);
      }
      return listener.callbackKey;
    },

    stopWatching: function({ callbackKey }) {
      const me = this;

      if (!me.listeners) return;
      let index = me.listeners.findIndex(listener => listener.callbackKey == callbackKey);
      if (index == -1) return;
      const listeners = me.listeners.slice(),
        listener = listeners.splice(index, 1)[0];
      if (!listeners.length) {
        delete me.listeners;
        if (typeof me.lastListenerRemoved == "function") {
          me.lastListenerRemoved.call(me);
        }
      } else {
        me.listeners = listeners;
      }
      if (typeof me.listenersChanged == "function") {
        me.listenersChanged.call(me);
      }
      return listener;
    },

    forEachListener: function(type, callback) {
      const me = this,
        { listeners } = me;

      if (!listeners) return;

      for (const listener of listeners) {
        if (typeof listener[type] == "function") callback.call(me, listener);
      }
    },

    notifyListeners: function(type, ...args) {
      const me = this;
      me.forEachListener(type, listener => {
        listener[type].apply(me, args);
      });
    },
  });
}
