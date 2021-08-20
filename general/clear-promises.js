module.exports = clearPromises;

async function clearPromises(promises) {
  while (promises.length) {
    await Promise.all(promises.splice(0, promises.length));
  }
}
