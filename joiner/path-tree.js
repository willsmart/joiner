const makeClassWatchable = require("../general/watchable"),
  makeClassJobable = require("../general/jobable"),
  PathInfo = require("./path-info");

class PathTree {
  constructor({ root, promises, event }) {
    const pt = this;
    Object.assign(pt, {
      root,
      callbackKey: "PathTree",
      pathInfos: {},
    });

    pt.rootPathTree = pt.pathInfoForLocation("", promises, event);
  }

  pathInfoForLocation(location, promises, event) {
    const pt = this,
      { pathInfos } = pt;
    return pathInfos[location] || (pathInfos[location] = new PathInfo({ location, pathTree: pt, promises, event }));
  }

  refreshedPathInfoForLocation(location, promises, event) {
    const pt = this, 
      { pathInfos } = pt;
    if (pathInfos[location]) pathInfos[location].refresh(promises, event);
    return pt.pathInfoForLocation(location, promises, event);
  }

  pathForLocation(location) {
    return `${this.root}${location}`;
  }
}

makeClassWatchable(PathTree);
makeClassJobable(PathTree);

module.exports = PathTree;
