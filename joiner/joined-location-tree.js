const makeClassWatchable = require("../general/watchable"),
  JoinedLocationInfo = require("./joined-location-info");

class JoinedLocationTree {
  constructor({ name, pathTrees, promises, event }) {
    const jlt = this;
    Object.assign(jlt, {
      name,
      pathTrees,
      callbackKey: `JoinedLocationTree:${name}`,
      joinedLocationInfos: {},
    });
    jlt.watchTreeInfos();

    jlt.joinedLocationInfoForLocation("", promises, event);
  }

  watchJoinedLocationTree(sibling) {
    const jlt = this,
      { callbackKey } = jlt;
    sibling.watch({
      callbackKey,
      oncreate: function(joinedLocationInfo, promises, event) {
        jlt
          .joinedLocationInfoForLocation(joinedLocationInfo.location, promises, event)
          .siblingCreated(joinedLocationInfo, promises, event);
      },
      onmodify: function(joinedLocationInfo, promises, event) {
        jlt
          .joinedLocationInfoForLocation(joinedLocationInfo.location, promises, event)
          .siblingModified(joinedLocationInfo, promises, event);
      },
      ondelete: function(joinedLocationInfo, promises, event) {
        jlt
          .joinedLocationInfoForLocation(joinedLocationInfo.location, promises, event)
          .siblingDeleted(joinedLocationInfo, promises, event);
      },
    });
  }

  watchTreeInfos() {
    const jlt = this,
      { pathTrees, callbackKey } = jlt;
    pathTrees.forEach(pathTree =>
      pathTree.watch({
        callbackKey,
        oncreatePathInfo: function(pathInfo, promises, event) {
          jlt
            .joinedLocationInfoForLocation(pathInfo.location, promises, event)
            .setPathInfo({ pathInfo, pathTree: pathInfo.pathTree }, promises, event);
        },
        ondeletePathInfo: function(pathInfo, promises, event) {
          jlt
            .joinedLocationInfoForLocation(pathInfo.location, promises, event)
            .setPathInfo({ pathInfo: undefined, pathTree: pathInfo.pathTree }, promises, event);
        },
        oncreate: (pathInfo, promises, event) => {
          jlt.joinedLocationInfoForLocation(pathInfo.location, promises, event).oncreate(pathInfo, promises, event);
        },
        onmodify: (pathInfo, promises, event) => {
          jlt.joinedLocationInfoForLocation(pathInfo.location, promises, event).onmodify(pathInfo, promises, event);
        },
        ondelete: (pathInfo, promises, event) => {
          jlt.joinedLocationInfoForLocation(pathInfo.location, promises, event).ondelete(pathInfo, promises, event);
        },
      }),
    );
  }

  unwatchTreeInfos() {
    const jlt = this,
      { pathTrees, callbackKey } = jlt;
    pathTrees.forEach(pathTree => pathTree.unwatch({ callbackKey }));
  }

  joinedLocationInfoForLocation(location, promises, event) {
    const jlt = this,
      { joinedLocationInfos } = jlt,
      joinedLocationInfo = joinedLocationInfos[location];
    if (joinedLocationInfo) return joinedLocationInfo;

    const parentLocation = JoinedLocationTree.parentOfLocation(location),
      parent =
        parentLocation === undefined ? undefined : jlt.joinedLocationInfoForLocation(parentLocation, promises, event);

    return (joinedLocationInfos[location] = new JoinedLocationInfo({
      location,
      parent,
      joinedLocationTree: jlt,
      promises,
      event,
    }));
  }

  static parentOfLocation(location) {
    const index = location.lastIndexOf("/");
    return index == -1 ? undefined : location.substring(0, index);
  }
}

makeClassWatchable(JoinedLocationTree);

module.exports = JoinedLocationTree;
