const fs = require("fs"),
  { promisify } = require("util"),
  stat_p = promisify(fs.stat),
  readdir_p = promisify(fs.readdir),
  unlink_p = promisify(fs.unlink),
  mkdir_p = promisify(fs.mkdir),
  rmdir_p = promisify(fs.rmdir),
  copyFile_p = promisify(fs.copyFile),
  shaSumFile = require("../general/sha-sum-file");

class PathInfo {
  constructor({ pathTree, location, promises, event }) {
    const pi = this;
    Object.assign(pi, {
      pathTree,
      location,
      path: pathTree.pathForLocation(location),
      stat: undefined,
      events: event ? [event] : [],
      fsWatcher: undefined,
      files: {},
      pendingEvent: undefined,
    });
    pathTree.notifyListeners("oncreatePathInfo", pi, promises, event);
    pi.refresh(promises, event);
  }

  watchFile() {
    const pi = this,
      { path, fsWatcher, pathTree, location } = pi;
    if (fsWatcher) return;
    console.log(`>>watch ${path}`);
    if (pi.path == "secrets/secrets.yml") console.log(`watch ${pi.path}`);
    pi.fsWatcher = fs.watch(path, {}, eventType => {
      console.log(`${eventType} change in ${path} (${pi.pendingEvent ? "has" : "no"} pending event)`);
      if (pi.pendingEvent) return;
      pi.pendingEvent = { at: new Date(), eventType, pathTree, location };
      pathTree.queueAsyncJob(promises => pi.refresh(promises, pi.pendingEvent));
    });
  }

  unwatchFile() {
    const pi = this,
      { fsWatcher } = pi;
    if (!fsWatcher) return;
    console.log(`<<unwatch ${path}`);
    pi.fsWatcher = undefined;
    fsWatcher.close();
  }

  refresh(promises, event) {
    const pi = this,
      { path, pathTree } = pi;

    if (!promises) {
      pathTree.queueAsyncJob(promises => pi.refresh(promises, event));
      return;
    }

    promises.push(
      new Promise(async () => {
        const stat = {},
          statParts = await Promise.all([
            shaSumFile(path).then(shasum => ({ shasum })),
            stat_p(path)
              .then(stat => ({
                mtimeMs: stat.mtimeMs,
                isDirectory: stat.isDirectory(),
                isFile: stat.isFile(),
                exists: true,
              }))
              .catch(err => {
                if (err.message.startsWith("ENOENT:")) return {};
                console.error(`Couldn't stat file '${path}': ${err.message}`);
                return {};
              }),
          ]);

        for (const statPart of statParts) Object.assign(stat, statPart);
        pi.setStat(stat.exists && stat, promises, event);
      }),
    );
  }

  setStat(stat, promises, event) {
    const pi = this,
      { path, stat: statWas, pathTree, events, location } = pi;
    pi.stat = stat;

    pi.pendingEvent = undefined;

    if (stat && stat.isDirectory) {
      promises.push(
        readdir_p(path)
          .then(files => {
            pi.setFiles(files, promises, event);
          })
          .catch(err => {
            console.error(`Couldn't readdir ${path}: ${err.message}`);
            pi.setFiles([], promises, event);
          }),
      );
    } else pi.setFiles([], promises, event);

    let type;
    if (!statWas) {
      if (!stat) return;
      type = "create";
      pi.watchFile();
    } else if (!stat) {
      pi.unwatchFile();
      type = "delete";
    } else if (stat.shasum != statWas.shasum) type = "modify";
    else return;

    if (event && !event.type && event.pathTree === pathTree && event.location == location) {
      event.type = type;
      event.stat = stat;
    }

    events.push(event);

    console.log(`${type} on ${path} : ${JSON.stringify(event)}`);

    pathTree.notifyListeners(`on${type}`, pi, promises, event);

    if (!stat) {
      pathTree.notifyListeners("ondeletePathInfo", pi, promises, event);
    }
  }

  setFiles(files, promises, event) {
    const pi = this,
      { location, files: byFileWas, pathTree } = pi,
      byFile = {};

    console.log(`Files for ${pi.path} : ${files.join(", ")}`);

    for (const file of files) {
      if (byFileWas[file]) byFile[file] = byFileWas[file];
      else byFile[file] = pathTree.refreshedPathInfoForLocation(`${location}/${file}`, promises, event);
    }
    pi.files = byFile;

    for (const [file, child] of Object.entries(byFileWas)) {
      // TODO clean up old PathInfos
      if (!byFile[file]) child.refresh(promises, event);
    }
  }

  overwriteAsDirectory(promises, _event) {
    const pi = this,
      { stat, path } = pi;

    console.log(`${path}->Dir ${stat ? (stat.isDirectory ? " (was dir)" : " (was file)") : ""}`);
    if (stat) {
      if (stat.isDirectory) return;
      promises.push(
        unlink_p(path)
          .catch(err => console.error(`Couldn't unlink file to replace with dir '${path}': ${err.message}`))
          .then(() =>
            mkdir_p(path, { recursive: true }).catch(err =>
              console.error(`Couldn't make dir after unlink '${path}': ${err.message}`),
            ),
          ),
      );
    } else {
      promises.push(
        mkdir_p(path, { recursive: true }).catch(err => console.error(`Couldn't make dir '${path}': ${err.message}`)),
      );
    }
  }

  overwrite({ withPathInfo }, promises, event) {
    if (withPathInfo.stat.isDirectory) {
      this.overwriteAsDirectory(promises, event);
      return;
    }

    const pi = this,
      { stat, path } = pi,
      { stat: fromStat, path: fromPath } = withPathInfo,
      { shasum: fromShasum } = fromStat;

    console.log(`${path} ->File(${fromPath})  ${stat ? (stat.isDirectory ? " (was dir)" : " (was file)") : ""}`);

    if (stat) {
      const { shasum, isDirectory } = stat;

      if (isDirectory) {
        promises.push(
          rmdir_p(path)
            .catch(err => console.error(`Couldn't remove dir to replace with file '${path}': ${err.message}`))
            .then(() =>
              copyFile_p(fromPath, path).catch(err =>
                console.error(`Couldn't copy file after removing dir '${path}': ${err.message}`),
              ),
            ),
        );
        return;
      }

      if (shasum == fromShasum) return;
    }
    promises.push(
      copyFile_p(fromPath, path).catch(err => console.error(`Couldn't copy file '${path}': ${err.message}`)),
    );
  }

  delete(promises, _event) {
    const pi = this,
      { stat } = pi;

    console.log(`${path} ->nada  ${stat ? (stat.isDirectory ? " (was dir)" : " (was file)") : ""}`);

    if (stat) promises.push(pi._delete());
  }

  _delete() {
    const pi = this,
      { stat, path, files } = pi;
    console.log(` -- delete ${path}  ${stat ? (stat.isDirectory ? " (was dir)" : " (was file)") : ""}`);
    if (!stat) return;
    const { isDirectory } = stat;

    if (isDirectory) {
      if (Object.keys(files).length) {
        return Promise.all(Object.values(files).map(childPathInfo => childPathInfo._delete())).then(() =>
          rmdir_p(path).catch(err => console.error(`Couldn't remove dir '${path}': ${err.message}`)),
        );
      } else return rmdir_p(path).catch(err => console.error(`Couldn't remove dir '${path}': ${err.message}`));
    } else return unlink_p(path).catch(err => console.error(`Couldn't unlink file '${path}': ${err.message}`));
  }
}

module.exports = PathInfo;
