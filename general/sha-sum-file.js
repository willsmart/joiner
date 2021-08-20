const { spawn } = require("child_process");

// TODO check performance vs other approaches
async function shaSumFile(path) {
  const child = spawn("shasum", [path]);
  return await new Promise((resolve, reject) => {
    let op = "";
    child.stdout.on("data", data => {
      op += String(data);
    });
    child.on("close", function(code) {
      switch (code) {
        case 0:
          const match = /^([a-f0-9]{40}) /.exec(op),
            shasum = match && match[1];
          console.log(`shasum for "${path}" : "${shasum}"`);
          if (!shasum) {
            reject(`Expected shasum for ${path} (op: "${op}"). TODO crap error msg`);
            break;
          }
          resolve(shasum);
          break;
        case 1:
          console.log(`shasum found no file for "${path}"`);
          resolve();
          break;
        default:
          reject(`Unexpected shasum return code for ${path}: ${code}. TODO crap error msg`);
          break;
      }
    });
  });
}

module.exports = shaSumFile;
