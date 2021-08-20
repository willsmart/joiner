// diff
// © Will Smart 2018. Licence: MIT

// This is a simple diff generator
// output is a fairly custom format
//  for example
// diffAny({a:1,b:[2,1]},{b:[1],c:2})
// ==
// {
//   objectDiff: {
//     a: undefined,
//     b: {arrayDiff:[
//       { at: 0, value: 1 }
//       { deleteAt: 1 }
//     ]},
//     c: {value: 2}
//   }
// }

// API is the function. Use via
//   const diffAny = require(pathToDiff)

const log = require('./log'),
  isEqual = require('./is-equal');

module.exports = diffAny;

function diffAny(was, is, memberIsEqualFn) {
  if (was === is) return;
  if (Array.isArray(is)) {
    return Array.isArray(was)
      ? diffArray(was, is, memberIsEqualFn)
      : {
          value: is,
        };
  }
  if (is && typeof is == 'object' && is.constructor == Object)
    return diffObject(
      was && typeof was == 'object' && was.constructor == Object ? was : undefined,
      is,
      memberIsEqualFn
    );
  if (typeof was == typeof is && was == is) return;
  return {
    value: is,
  };
}

function diffObject(was, is, memberIsEqualFn) {
  let diff;
  if (was) {
    for (const key in was) {
      if (was.hasOwnProperty(key)) {
        if (!is.hasOwnProperty(key)) {
          if (!diff) diff = {};
          diff[key] = undefined;
          continue;
        }
        const wasChild = was[key],
          isChild = is[key],
          diffChild = diffAny(wasChild, isChild, memberIsEqualFn);

        if (diffChild) {
          if (!diff) diff = {};
          diff[key] = diffChild;
        }
      }
    }
  }

  for (const key in is) {
    if (is.hasOwnProperty(key) && !(was && was.hasOwnProperty(key))) {
      const isChild = is[key];

      if (!diff) diff = {};
      diff[key] = {
        value: isChild,
      };
    }
  }
  return diff
    ? {
        objectDiff: diff,
      }
    : undefined;
}

function diffArray_o(was, is) {
  let diff;
  // TODO better diff algorithm
  let index;
  was = was || [];

  const edits = 0;

  for (index = is.length - 1; index >= was.length; index--) {
    const isChild = is[index];

    if (!diff)
      diff = {
        arrayDiff: [],
      };
    diff.arrayDiff.push(
      Object.assign({
        insertAt: was.length,
        value: isChild,
      })
    );
  }

  for (index = was.length - 1; index >= is.length; index--) {
    const wasChild = was[index],
      diffChild = diffAny(wasChild);

    if (diffChild) {
      if (!diff)
        diff = {
          arrayDiff: [],
        };
      diff.arrayDiff.unshift({
        deleteAt: index,
      });
    }
  }

  for (index = 0; index < was.length && index < is.length; index++) {
    const wasChild = was[index],
      isChild = is[index],
      diffChild = diffAny(wasChild, isChild);

    if (diffChild) {
      if (!diff)
        diff = {
          arrayDiff: [],
        };
      diff.arrayDiff.push(
        Object.assign(diffChild, {
          at: index,
        })
      );
    }
  }

  return diff;
}

// Thank you Nickolas Butler http://www.codeproject.com/Articles/42279/Investigating-Myers-diff-algorithm-Part-of
// Based on Myers alg. See http://www.xmailserver.org/diff2.pdf

function arrayDiffEdits(from, to, elementsEqual) {
  if (!elementsEqual) elementsEqual = (a, b) => a == b;
  const fromLength = from.length,
    toLength = to.length,
    halfBlockLength = fromLength + toLength + 2,
    blockLength = 2 * halfBlockLength,
    blockCount = fromLength + toLength + 2,
    blocks = [{}];
  let d,
    solved = false;

  log('diff', `Diff: ${JSON.stringify({ fromLength, toLength, blockLength, blockCount })}`);
  for (d = 0; d <= fromLength + toLength && !solved; d++) {
    log('diff', `${JSON.stringify({ d })}`);
    const block = blocks[d];
    for (let k = -d; k <= d; k += 2) {
      log('diff', `${JSON.stringify({ k })}`);
      /* down or right? */
      const down = k == -d || (k != d && (block[k - 1] || 0) < (block[k + 1] || 0)),
        kPrev = down ? k + 1 : k - 1,
        /* start point */
        xStart = block[kPrev] || 0,
        yStart = xStart - kPrev,
        /* mid point */
        xMid = down ? xStart : xStart + 1,
        yMid = xMid - k;

      /* end point */
      let xEnd = xMid,
        yEnd = yMid;

      /* follow diagonal */
      while (xEnd < fromLength && yEnd < toLength && elementsEqual(from[xEnd], to[yEnd])) {
        xEnd++;
        yEnd++;
      }
      log('diff', `${JSON.stringify({ down, kPrev, xStart, yStart, xMid, yMid, xEnd, yEnd })}`);

      /* save end point */
      block[k] = xEnd;

      /* check for solution */
      if (xEnd >= fromLength && yEnd >= toLength) {
        log('diff', `SOLVED`);
        solved = true;
        break;
      }
    }
    log('diff', `Block at d:${d} -> ${JSON.stringify(block)}`);
    blocks.push(Object.assign({}, block));
  }

  log('diff', `Blocks: ${JSON.stringify(blocks)}`);

  let atX = fromLength,
    atY = toLength,
    dels = 0,
    copies = 0;

  const edits = [];

  for (d--; atX > 0 || atY > 0; d--) {
    const block = blocks[d];

    log('diff', `${JSON.stringify({ d, block, edits: edits.join(''), atX, atY })}`);

    const k = atX - atY,
      /* end point is in block[0] */
      xEnd = block[k] || 0,
      yEnd = xEnd - k,
      /* down or right? */
      down = k == -d || (k != d && (block[k - 1] || 0) < (block[k + 1] || 0)),
      kPrev = down ? k + 1 : k - 1,
      /* start point */
      xStart = block[kPrev] || 0,
      yStart = xStart - kPrev,
      /* mid point */
      xMid = down ? xStart : xStart + 1,
      yMid = xMid - k;

    log('diff', `${JSON.stringify({ k, xEnd, down, kPrev, xStart, yStart, xMid, yMid, xEnd, yEnd })}`);

    const localCopies = Math.min(fromLength, xEnd) - Math.max(0, xMid),
      localDels = Math.min(fromLength, xMid) - Math.max(0, xStart),
      localInserts = Math.min(toLength, yMid) - Math.max(0, yStart);

    copies += localCopies;

    if (dels && (copies || localInserts)) {
      edits.push(['d', dels]);
      dels = 0;
    }

    if (copies && (localDels || localInserts)) {
      edits.push(['c', copies]);
      copies = 0;
    }

    if (localInserts) {
      for (let i = Math.max(0, yStart); i < Math.min(toLength, yMid); i++) {
        edits.push(['i', to[i]]);
      }
    }

    dels += localDels;

    atX = xStart;
    atY = yStart;
  }

  if (copies) {
    edits.push(['c', copies]);
  }
  if (dels) {
    edits.push(['d', dels]);
  }
  edits.reverse();
  log('diff', `Path : ${edits.join('')}`);

  return processEdits_delIns(edits);
}

function processEdits_delIns(edits) {
  let dels = 0;
  const ret = [],
    inss = [];
  for (const [type, value] of edits) {
    switch (type) {
      case 'd':
        dels += value;
        break;
      case 'c':
        flushDelIns();
        ret.push(['c', value]);
        break;
      case 'f':
        inss.push(value);
        dels++;
        break;
      case 'i':
        inss.push(value);
        break;
    }
  }

  flushDelIns();
  return ret;

  function flushDelIns() {
    while (dels && inss.length) {
      ret.push(['f', inss.shift()]);
      dels--;
    }
    while (inss.length) {
      ret.push(['i', inss.shift()]);
    }
    if (dels) {
      ret.push(['d', dels]);
      dels = 0;
    }
  }
}

function diffArray(from, to, memberIsEqualFn) {
  if (!Array.isArray(to)) to = [];
  const edits = arrayDiffEdits(from, to, memberIsEqualFn ? memberIsEqualFn : (a, b) => isEqual(a, b)),
    ret = { arrayDiff: [] },
    diff = ret.arrayDiff;

  // inserts first
  let fromIndex = 0,
    pushIndex = 0;
  for (const [type, value] of edits) {
    switch (type) {
      case 'd':
      case 'c':
        fromIndex += value;
        pushIndex = diff.length;
        break;
      case 'f':
        fromIndex++;
        pushIndex = diff.length;
        break;
      case 'i':
        diff.splice(pushIndex, 0, { insertAt: fromIndex, value });
        break;
    }
  }

  // then dels
  fromIndex = 0;
  for (const [type, value] of edits) {
    switch (type) {
      case 'd':
        for (let d = value; d--; ) {
          const fromChild = from[fromIndex],
            diffChild = diffAny(fromChild);
          if (diffChild) diff.push({ deleteAt: fromIndex });
          fromIndex++;
        }
        break;
      case 'c':
        fromIndex += value;
        break;
      case 'f':
        fromIndex++;
        break;
    }
  }

  // then diffs
  fromIndex = 0;
  for (const [type, value] of edits) {
    switch (type) {
      case 'd':
      case 'c':
        fromIndex += value;
        break;
      case 'f':
        const diffChild = diffAny(from[fromIndex], value);
        diff.push(Object.assign(diffChild, { at: fromIndex++, value }));
        break;
    }
  }
  return diff.length ? ret : undefined;
}
function applyDiff(from, edits) {
  const to = [];
  let fromIndex = 0;

  for (const [type, value] of edits) {
    switch (type) {
      case 'd':
        fromIndex += value;
        break;
      case 'c':
        to.push(...from.slice(fromIndex, fromIndex + value));
        fromIndex += value;
        break;
      case 'f':
        to.push(value);
        fromIndex++;
        break;
      case 'i':
        to.push(value);
        break;
    }
  }
  return to;
}

if (typeof window !== 'undefined') {
  const Rand = require('random-seed');

  function randInt(rand, max, power) {
    return Math.floor(Math.pow(rand.random(), power) * max);
  }

  function randArray(rand) {
    return Array.from(Array(randInt(rand, 10, 2))).map(() => randInt(rand, 10, 2));
  }

  window.mockDiff = function(count = 1, seed = 1234) {
    const rand = Rand.create(seed);
    disableNoboLog('diff');
    for (let i = 0; i < count; i++) {
      const from = randArray(rand),
        to = randArray(rand),
        edits = arrayDiffEdits(from, to);
      to2 = applyDiff(from, edits);

      if (!isEqual(to, to2)) {
        log(
          'err',
          `Diff ${i} failed\n  from : ${JSON.stringify(from)}\n  to   : ${JSON.stringify(
            to
          )}\n  to2  : ${JSON.stringify(to2)}\n  edits: ${JSON.stringify(edits)}`
        );
        enableNoboLog('diff');
        debugger;
        arrayDiffEdits(from, to);
        applyDiff(from, edits);
        break;
      }
    }
  };
}
