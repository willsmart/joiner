// jobable
// © Will Smart 2018. Licence: MIT

// This is a stupidly simple job runner

// API is the function. Require via
//   const makeClassJobable = require(pathToFile)
// then after creating your class use as:
//   makeClassJobable(TheClass)

const clearPromises = require("./clear-promises");
let globalListener;

module.exports = makeClassJobable;
Object.assign(makeClassJobable, {
  setGlobalListener: listener => {
    globalListener = listener;
  },

  _runJobObjects: [],
  _runJobInterval: undefined,

  createSerializingGlobalListener: () => {
    makeClassJobable.setGlobalListener((type, me) => {
      if (type != "queuedAsyncJobs") return;
      if (!me._willRunJobs) {
        me._willRunJobs = true;
        makeClassJobable._runJobObjects.push(me);
      }
      if (!makeClassJobable._runJobInterval) {
        makeClassJobable._runJobInterval = setInterval(async () => {
          makeClassJobable._runJobInterval = undefined;
          while (makeClassJobable._runJobObjects.length) {
            const mes = makeClassJobable._runJobObjects;
            makeClassJobable._runJobObjects = [];
            await Promise.all(
              mes.map(async me => {
                me._willRunJobs = undefined;
                await me.runJobs();
              }),
            );
          }
        });
      }
    });
  },
});

function makeClassJobable(watchableClass) {
  Object.assign(watchableClass.prototype, {
    // Pass a function to this for queueing. It will be run the next time runJobs is called
    // alternately a Promise can be passed, which will be awaited the next time runJobs is called
    queueAsyncJob: function(job, jobSetIndex = 0) {
      if (typeof job != "function" && (typeof job != "object" || typeof job.then != "function")) return;
      const me = this;
      const asyncJobSets = me._asyncJobSets || (me._asyncJobSets = []),
        asyncJobSet = asyncJobSets[jobSetIndex] || (asyncJobSets[jobSetIndex] = []);
      asyncJobSet.push(job);
      me.notifyListeners && me.notifyListeners("queuedAsyncJobs", me, [job]);
      globalListener && globalListener("queuedAsyncJobs", me, [job]);
      return jobSetIndex;
    },

    // Similar to queueAsyncJob, but takes an array of jobs
    queueAsyncJobs: function(jobs, jobSetIndex = 0) {
      if (!Array.isArray(jobs)) return;
      const me = this;
      if (!Array.isArray(jobs)) return;
      const asyncJobSets = me._asyncJobSets || (me._asyncJobSets = []),
        asyncJobSet = asyncJobSets[jobSetIndex] || (asyncJobSets[jobSetIndex] = []);
      asyncJobSet.push(...jobs);
      me.notifyListeners && me.notifyListeners("queuedAsyncJobs", me, jobs);
      globalListener && globalListener("queuedAsyncJobs", me, jobs);
      return jobSetIndex;
    },

    // similar to queueAsyncJob, but you specify how long to wait until the jo0b should be run.
    // This is measured in seconds. Jobs are run in batches at this.secondsPerBatch intervals (def four per sec)
    // Note that the seconds parameter is not exact, but is a lower bound on how long it will actually take to kick off the job
    queueDelayedJob: function(seconds, job) {
      const me = this,
        { secondsPerBatch = 0.25 } = this,
        batchCount = Math.round(seconds / secondsPerBatch);
      if (batchCount <= 0) return this.queueAsyncJob(job);

      const delayedJobs = me._delayedJobs || (me._delayedJobs = []),
        jobs = delayedJobs[batchCount] || (delayedJobs[batchCount] = []);
      jobs.push(job);

      if (!me._delayedJobsTimeout) setDelayedJobTimeout();
      function setDelayedJobTimeout() {
        if (me._delayedJobsTimeout) return;
        me._delayedJobsTimeout = setTimeout(() => {
          me._delayedJobsTimeout = undefined;
          me.queueAsyncJobs(delayedJobs.shift());
          if (delayedJobs.length) setDelayedJobTimeout();
        }, secondsPerBatch);
      }
    },

    // This is the async function of this class.
    // Runs all the outstanding jobs. This is done by evaluating each job function providing a promises array
    // The job functions themselves can return a promise (i.e. be async functions) and/or can simply push any promises that result onto the promises array.
    // This function awaits over all those promises, allowing any number of jobs to be run cleanly and in parallel.
    runJobs: async function(previousPromises) {
      const promiseSets = this.prepareToRunJobs(previousPromises);
      for (const promises of promiseSets) await clearPromises(promises);
    },

    // helper function for runJobs. Exposed since it could be useful for caller code to take ownership of the promises array.
    prepareToRunJobs: function(previousPromises) {
      const me = this,
        { _asyncJobSets: asyncJobSets } = me;
      if (!(asyncJobSets && asyncJobSets.length)) return [];
      me._asyncJobSets = [];
      const promiseSets = previousPromises && previousPromises.length ? [previousPromises] : [];
      for (const asyncJobSet of asyncJobSets) {
        if (!asyncJobSet) continue;
        const promises = undefined;
        for (let job of asyncJobSet) {
          if (typeof job == "function") {
            try {
              job = job(promises);
            } catch (err) {
              console.error(err.stack);
            }
          }
          if (typeof job == "object" && typeof job.then == "function") {
            (promises || (promises = [])).push(job);
          }
        }
        if (promises) promiseSets.push(promises);
      }
      return promiseSets;
    },
  });
}
