// test-rig
// © Will Smart 2018. Licence: MIT

// This is a simple testing rig

const Readline = require('readline');

const PublicApi = require('../general/public-api');
const DbSchemaUpdater = require('../db/db-schema-updater');
const DbSeeder = require('../db/db-seeder');
const isEqual = require('../general/is-equal');

// API is auto-generated at the bottom from the public interface of this class

class TestRig {
  // public methods
  static publicMethods() {
    return ['go', 'task', 'startTask', 'endTask'];
  }

  constructor({ path, verbosity, failVerbosity, verboseDb, moduleName, tearDownAfter }) {
    Object.assign(this, {
      path,
      verbosity,
      failVerbosity,
      verboseDb,
      moduleName,
      tearDownAfter,
    });
    this.taskResults = [];
    this.failCount = 0;
  }

  async assert(
    thisShouldHappen,
    value,
    options = {
      equals: true,
    }
  ) {
    const rig = this;

    const { equals, unordered, exact, sameObject, includes, includedBy, essential, throws } = options;
    let didThrow = false;
    try {
      if (typeof value == 'function') value = value();
      value = await value;
    } catch (err) {
      didThrow = true;
      if (!options.throws)
        throw new Error(`Failed assert where ${thisShouldHappen}:
          Threw while getting value: ${err.stack}`);
    }
    let res = `No comparison options chosen. Please use one of: equals, sameObject, includes, includedBy, throws`;

    if (options.hasOwnProperty('throws')) {
      res = !didThrow && options.throws ? 'Expected a throw' : true;
    } else if (options.hasOwnProperty('sameObject')) {
      res =
        value === options.sameObject || `Values are different objects:\n${value}\n ... vs ...\n${options.sameObject}`;
    } else if (options.hasOwnProperty('includes')) {
      res = isEqual(value, includes, {
        allowSuperset: true,
        verboseFail: true,
        unordered,
      });
      if (res !== true && res !== '>') {
        res = `${res}
          (Expected value is to right. I would have allowed it to be a subset)`;
      }
    } else if (options.hasOwnProperty('includedBy')) {
      res = isEqual(includedBy, value, {
        allowSuperset: true,
        verboseFail: true,
        unordered,
      });
      if (res !== true && res !== '>') {
        res = `${res}
          (Expected value is to left. I would have allowed it to be a superset)`;
      }
    } else {
      res = isEqual(value, equals, {
        verboseFail: true,
        unordered,
        exact,
      });
    }

    const ok = res === true || res === '>';

    if (!ok) rig.taskResults[rig.taskResults.length - 1].failCount++;

    rig.taskResults[rig.taskResults.length - 1].asserts.push({
      thisShouldHappen,
      ok,
    });

    if (!ok && essential) {
      throw new Error(res);
    } else if ((ok ? rig.verbosity : rig.failVerbosity) >= 3) {
      if (ok) {
        console.log(`    ---> Successful in asserting that ${thisShouldHappen}`);
      } else {
        console.log(`    ---X Failed to assert that ${thisShouldHappen}:
      ${res.replace('\n', '\n        ')}`);
      }
    } else if ((ok ? rig.verbosity : rig.failVerbosity) >= 2) {
      console.log(`       > ${rig.taskSummary()}`);
    } else if ((ok ? rig.verbosity : rig.failVerbosity) >= 1) {
      Readline.clearLine(process.stdout); // clear current text
      Readline.cursorTo(process.stdout, 0); // move cursor to beginning of line
      process.stdout.write(`       > ${rig.taskSummary()}`);
    }
  }

  taskSummary(index) {
    const rig = this;

    if (index === undefined) index = rig.taskResults.length - 1;
    return rig.taskResults[index].asserts.map(res => (res.ok ? '.' : 'x')).join('');
  }

  static async go(options, code) {
    const rig = new TestRig(options);

    await rig.start();
    await code.call(rig, rig);
    await rig.end();

    return rig;
  }

  async start() {
    const rig = this;

    if (rig.verbosity >= 4) {
      console.log(`
  ======================================================
  Test the ${rig.moduleName} component
  - - - - - - - - - - - - - - - - - - - - - - - - - - -`);
    } else if (rig.verbosity >= 1) console.log(`===> Test the ${rig.moduleName} component`);

    if (rig.path) {
      await rig.task('Set up db', async function() {
        await rig.setupDb();
      });
      await rig.task('Seed db', async function() {
        await rig.seedDb();
      });
    }
  }

  async end() {
    const rig = this;

    if (rig.path && rig.tearDownAfter) {
      await rig.task('Tear down db', async function() {
        await rig.tearDownDB();
      });
    }

    if (rig.verbosity >= 4) {
      console.log(`  - - - - - - - - - - - - - - - - - - - - - - - - - - -
  Done testing the ${rig.moduleName} component
  =====================================================

`);
    } else if (rig.verbosity >= 1) console.log(`---< Done testing the ${rig.moduleName} component`);
  }

  async task(name, code) {
    if (name && typeof name == 'object') name = name.name;

    const rig = this;

    rig.startTask({
      name,
    });
    try {
      await code();
    } catch (err) {
      rig.assert(
        name,
        () => {
          throw new Error(`${err.stack}\n\nRethrown`);
        },
        {
          throws: false,
        }
      );
    }
    rig.endTask({
      name,
    });
  }

  startTask(name) {
    if (name && typeof name == 'object') name = name.name;

    const rig = this;

    if (rig.taskName !== undefined) {
      rig.endTask();
    }
    if (name === undefined) return;

    rig.taskName = name;
    rig.taskResults.push({
      taskName: name,
      asserts: [],
      failCount: 0,
    });

    if (rig.verbosity >= 4) {
      console.log(`
    -------------------------------------------------
    ${name}
    - - - - - - - - - - - - - - - - - - - - - - - - -`);
    } else if (rig.verbosity >= 1) console.log(`  ---> ${rig.taskName}`);
  }

  endTask() {
    const rig = this;

    rig.failCount += rig.taskResults[rig.taskResults.length - 1].failCount;

    if (rig.verbosity >= 4) {
      console.log(`    - - - - - - - - - - - - - - - - - - - - - - - - -
Done ${rig.taskName}
   < [${rig.taskSummary()}]
-------------------------------------------------
`);
    } else if (rig.verbosity >= 1) {
      console.log(`    Results: [${rig.taskSummary()}]`);
    }

    delete rig.taskName;
  }

  async setupDb() {
    const rig = this,
      updater = rig.dbSchemaUpdater;

    const { schema } = await updater.performUpdate({
      dryRun: false,
      renew: true,
    });

    rig.schema = schema;
    rig.connection = await updater.connection();
  }

  async seedDb() {
    const rig = this,
      seeder = rig.dbSeeder;

    await seeder.insertSeeds({
      quiet: !rig.verboseDb,
    });
  }

  async tearDownDB() {
    const rig = this,
      updater = rig.dbSchemaUpdater;

    await updater.performUpdate({
      dryRun: false,
      drop: true,
    });
  }

  get dbSchemaUpdater() {
    const rig = this;

    if (!rig.path) return;
    return rig._updater
      ? rig._updater
      : (rig._updater = new DbSchemaUpdater({
          path: `${rig.path}/db`,
          verbose: rig.verboseDb,
        }));
  }

  get dbSeeder() {
    const rig = this;

    if (!rig.path) return;
    return rig._seeder
      ? rig._seeder
      : (rig._seeder = new DbSeeder({
          path: `${rig.path}/db`,
          verbose: rig.verboseDb,
        }));
  }
}

// API is the public facing class
module.exports = PublicApi({
  fromClass: TestRig,
  hasExposedBackDoor: true,
});
