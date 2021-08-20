module.exports = log;

let enabledLogs = { err: true };

function logIsEnabled(module) {
  let parent = enabledLogs;
  for (const part of module.split('.')) {
    let val = parent[part];
    if (!val) {
      if (val === false) return false;
      val = parent.other;
      if (!val) return false;
    }
    if (val === true) return true;
    if (typeof val !== 'object') return false;
    parent = val;
  }
  return true;
}

function log(module, ...args) {
  if (!logIsEnabled(module)) return false;
  if (args.length == 1 && typeof args[0] == 'function') args = [args[0]()];
  if (module === 'err' || module.startsWith('err.')) {
    console.error.apply(console, args);
  } else console.log.apply(console, args);
  return true;
}

log.enableLog = function(module) {
  if (module === undefined) {
    enabledLogs = {
      err: true,
      diff: false,
      verbose: false,
      //dp: false,
      db: false,
      other: { verbose: false, other: true },
    };
    return;
  }
  enabledLogs[module] = true;
};

log.disableLog = function(module) {
  if (module === undefined) {
    enabledLogs = { err: true };
    return;
  }
  delete enabledLogs[module];
};

if (typeof window !== 'undefined') {
  window.enableNoboLog = log.enableLog;
  window.disableNoboLog = log.disableLog;
}
