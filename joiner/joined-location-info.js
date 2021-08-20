class JoinedLocationInfo {
  constructor({ joinedLocationTree, location, parent, promises, event }) {
    const jli = this;
    Object.assign(jli, {
      joinedLocationTree,
      location,
      parent,
      children: [],

      isDirectory: false,
      events: event ? [event] : [],
      pathTrees: joinedLocationTree.pathTrees,
      pathInfos: joinedLocationTree.pathTrees.map(pathTree => pathTree.pathInfos[location]),
    });

    if (parent) parent.children.push(this);

    jli.refreshWinningPathInfo(promises, event);
  }

  setPathInfo({ pathInfo, pathTree }, promises, event) {
    const jli = this,
      { pathInfos, joinedLocationTree } = jli,
      index = joinedLocationTree.pathTrees.indexOf(pathTree);
    if (index >= 0) pathInfos[index] = pathInfo;
    jli.refreshWinningPathInfo(promises, event);
  }

  refreshWinningPathInfo(promises, event) {
    const jli = this,
      { nonDirectoryAncestor, pathInfos, winningPathInfo: winningPathInfoWas, events, joinedLocationTree } = jli;
    const winningPathInfo = nonDirectoryAncestor ? undefined : pathInfos.find(pathInfo => pathInfo && pathInfo.stat);
    jli.winningPathInfo = winningPathInfo && {
      location: winningPathInfo.location,
      pathTree: winningPathInfo.pathTree,
      stat: winningPathInfo.stat,
      pathInfo: winningPathInfo,
    };

    if (winningPathInfo) {
      if (winningPathInfoWas) {
        if (winningPathInfo.stat.shasum == winningPathInfoWas.stat.shasum) return;
        events.push(event);
        joinedLocationTree.notifyListeners("onmodify", jli, promises, event);
      } else {
        events.push(event);
        joinedLocationTree.notifyListeners("oncreate", jli, promises, event);
      }

      jli.refreshIsDirectory();
    } else if (winningPathInfoWas) {
      events.push(event);
      jli.refreshIsDirectory();
      joinedLocationTree.notifyListeners("ondelete", jli, promises, event);
    }
  }

  refreshIsDirectory(promises, event) {
    const jli = this,
      { isDirectory: isDirectoryWas, winningPathInfo, children } = jli,
      isDirectory = winningPathInfo && winningPathInfo.stat.isDirectory;
    if (isDirectory == isDirectoryWas) return;
    jli.isDirectory = isDirectory;
    for (const child of children) child.refreshWinningPathInfo(promises, event);
  }

  oncreate() {
    this.onmodify.apply(this, arguments);
  }

  onmodify(pathInfo, promises, event) {
    const jli = this,
      { pathTrees, pathInfos } = jli,
      treeIndex = pathTrees.find(pathTree => pathTree === pathInfo.pathTree);

    pathInfos[treeIndex] = pathInfo;
    jli.refreshWinningPathInfo(promises, event);
  }

  ondelete(pathInfo, promises, event) {
    const jli = this,
      { pathTrees, pathInfos } = jli,
      treeIndex = pathTrees.find(pathTree => pathTree === pathInfo.pathTree);

    pathInfos[treeIndex] = undefined;
    jli.refreshWinningPathInfo(promises, event);
  }

  siblingCreated(siblingJoinedLocationInfo, promises, event) {
    this.siblingModified(siblingJoinedLocationInfo, promises, event);
  }

  siblingModified({ winningPathInfo: siblingPathInfoObject }, promises, event) {
    const siblingPathInfo = siblingPathInfoObject && siblingPathInfoObject.pathInfo,
      jli = this,
      { parent, location, winningPathInfo: pathInfoObject } = jli;
    let pathInfo = pathInfoObject && pathInfoObject.pathInfo;
    if (!pathInfo) {
      if (!parent) {
        console.error("Expected a parent. TODO crap err msg");
        return;
      }
      const parentPathInfo = parent.winningPathInfo;
      if (!parentPathInfo || !parentPathInfo.stat.isDirectory) {
        console.error("Expected a dir. TODO crap err msg");
        return;
      }
      const { pathTree } = parentPathInfo;
      pathInfo = pathTree.pathInfoForLocation(location, promises, event);
    }
    pathInfo.overwrite({ withPathInfo: siblingPathInfo }, promises, event);
  }

  siblingDeleted({}, promises, event) {
    const jli = this,
      { winningPathInfo, pathInfos } = jli;
    if (!winningPathInfo) return;

    for (const pathInfo of pathInfos) {
      if (!(pathInfo && pathInfo.stat)) continue;
      pathInfo.delete(promises, event);
    }
  }
}

module.exports = JoinedLocationInfo;
