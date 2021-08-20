const processArgs = require("./general/process-args"),
  clearPromises = require("./general/clear-promises"),
  JoinedLocationTree = require("./joiner/joined-location-tree"),
  PathTree = require("./joiner/path-tree"),
  { createSerializingGlobalListener } = require("./general/jobable");

const args = processArgs();

createSerializingGlobalListener();

(async function() {
  try {
    const promises = [],
      event = { at: new Date(), eventType: "startup" },
      trees = { joined: ["joined"], source: ["secrets", "prod", "lib"] },
      joinedLocationTrees = {};

    console.log(`Joining files in ${trees.joined.join(", ")} and ${trees.source.join(", ")}`);

    for (const [name, dirs] of Object.entries(trees)) {
      joinedLocationTrees[name] = new JoinedLocationTree({
        name,
        pathTrees: dirs.map(dir => new PathTree({ root: dir, promises, event, args })),
        promises,
        event,
        args,
      });
    }

    joinedLocationTrees.joined.watchJoinedLocationTree(joinedLocationTrees.source);
    await clearPromises(promises);

    joinedLocationTrees.source.watchJoinedLocationTree(joinedLocationTrees.joined);
  } catch (err) {
    console.error(err.stack);
  }
})();
