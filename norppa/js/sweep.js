/* Pikku Norppa: the board behind Puffer Sweep. No drawing here, only the puzzle itself, so it can be tested on its own.
   A board is a grid of tiles with pufferfish under some of them. Every board handed out by make() can be cleared from the
   first tap without a single guess, using only the plain rule: look at one number, count the tiles around it.
   If the pufferfish it counts are all found, the rest around it are safe. If the hidden tiles around it are exactly the
   pufferfish still missing, they are all pufferfish. solve() plays a board that way and says whether it gets to the end. */
(function (PN) {
  'use strict';
  const hoods = {};
  /* The tiles touching each tile, worked out once for every board size. */
  function hood(w, h) {
    const key = w + 'x' + h;
    if (hoods[key]) return hoods[key];
    const out = [];
    for (let i = 0; i < w * h; i++) {
      const x = i % w, y = (i - x) / w, list = [];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if ((dx || dy) && nx >= 0 && ny >= 0 && nx < w && ny < h) list.push(ny * w + nx);
      }
      out.push(list);
    }
    return (hoods[key] = out);
  }
  /* The number on every tile: how many pufferfish touch it. */
  function counts(w, h, mines) {
    const nb = hood(w, h), num = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) { let c = 0; const l = nb[i]; for (let k = 0; k < l.length; k++) c += mines[l[k]]; num[i] = c; }
    return num;
  }
  /* Open a tile, and if nothing touches it, everything around it too. Returns the tiles opened. */
  function flood(w, h, mines, num, open, start) {
    const nb = hood(w, h), todo = [start], got = [];
    while (todo.length) {
      const i = todo.pop();
      if (open[i] || mines[i]) continue;
      open[i] = 1; got.push(i);
      if (!num[i]) { const l = nb[i]; for (let k = 0; k < l.length; k++) if (!open[l[k]]) todo.push(l[k]); }
    }
    return got;
  }
  /* Play the board from the first tap with the plain rule only. ok: it was cleared with no guessing.
     Also counts what it took (taps on safe tiles, pufferfish worked out, passes over the board), for the payout sums. */
  function solve(w, h, mines, start) {
    const n = w * h, nb = hood(w, h), num = counts(w, h, mines), open = new Uint8Array(n), mark = new Uint8Array(n);
    let left = n, taps = 1, found = 0, passes = 0;
    for (let i = 0; i < n; i++) left -= mines[i];
    if (mines[start]) return { ok: false, taps: 0, found: 0, passes: 0 };
    left -= flood(w, h, mines, num, open, start).length;
    let moved = true;
    while (moved && left > 0) {
      moved = false; passes++;
      for (let i = 0; i < n; i++) {
        if (!open[i] || !num[i]) continue;
        const l = nb[i];
        let hid = 0, fl = 0;
        for (let k = 0; k < l.length; k++) { const j = l[k]; if (!open[j]) { if (mark[j]) fl++; else hid++; } }
        if (!hid) continue;
        if (fl === num[i]) {
          for (let k = 0; k < l.length; k++) { const j = l[k]; if (!open[j] && !mark[j]) { taps++; left -= flood(w, h, mines, num, open, j).length; } }
          moved = true;
        } else if (fl + hid === num[i]) {
          for (let k = 0; k < l.length; k++) { const j = l[k]; if (!open[j] && !mark[j]) { mark[j] = 1; found++; } }
          moved = true;
        }
      }
    }
    return { ok: left === 0, taps, found, passes };
  }
  /* A fresh board with `count` pufferfish, none under or next to the first tap, that solve() can clear.
     Boards that would need a guess are thrown away and dealt again; about one deal in three is kept. */
  function make(w, h, count, start, rnd) {
    rnd = rnd || Math.random;
    const n = w * h, near = hood(w, h)[start], pool = [];
    for (let i = 0; i < n; i++) if (i !== start && near.indexOf(i) < 0) pool.push(i);
    let mines = null;
    for (let go = 0; go < 20000; go++) {
      mines = new Uint8Array(n);
      for (let k = 0; k < count; k++) {
        const j = k + Math.floor(rnd() * (pool.length - k)), t = pool[k];
        pool[k] = pool[j]; pool[j] = t;
        mines[pool[k]] = 1;
      }
      if (solve(w, h, mines, start).ok) break;
    }
    return mines;
  }
  PN.Sweep = { hood, counts, flood, solve, make };
})(typeof window !== 'undefined' ? (window.PN = window.PN || {}) : (global.PN = global.PN || {}));
