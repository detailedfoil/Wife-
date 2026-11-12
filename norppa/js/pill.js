/* Pikku Norppa: spotting the pill in a camera frame.
   Looks for one small, round, white thing: a pale, colourless blob that is roughly a circle or an oval.
   It is deliberately easy-going. Everything happens on the phone; no picture is kept or sent anywhere. */
(function (PN) {
  'use strict';
  const Pill = {};
  /* rgba: Uint8ClampedArray of w*h*4. Returns { ok, x, y, r, score } with x, y, r as fractions of the width. */
  Pill.find = function (rgba, w, h) {
    const n = w * h, mask = new Uint8Array(n), lab = new Int32Array(n).fill(-1);
    for (let i = 0, p = 0; i < n; i++, p += 4) {
      const r = rgba[p], g = rgba[p + 1], b = rgba[p + 2];
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      // pale and nearly colourless; warm wood and skin are too yellow or pink to pass
      if (mx > 105 && (mx - mn) < 0.17 * mx + 6 && (r - b) < 0.13 * mx + 6) mask[i] = 1;
    }
    const short = Math.min(w, h), stack = new Int32Array(n);
    let best = null;
    for (let s = 0; s < n; s++) {
      if (!mask[s] || lab[s] >= 0) continue;
      let top = 0, area = 0, x0 = w, x1 = 0, y0 = h, y1 = 0, sx = 0, sy = 0;
      stack[top++] = s; lab[s] = s;
      while (top) {
        const i = stack[--top], x = i % w, y = (i - x) / w;
        area++; sx += x; sy += y;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        if (x > 0 && mask[i - 1] && lab[i - 1] < 0) { lab[i - 1] = s; stack[top++] = i - 1; }
        if (x < w - 1 && mask[i + 1] && lab[i + 1] < 0) { lab[i + 1] = s; stack[top++] = i + 1; }
        if (y > 0 && mask[i - w] && lab[i - w] < 0) { lab[i - w] = s; stack[top++] = i - w; }
        if (y < h - 1 && mask[i + w] && lab[i + w] < 0) { lab[i + w] = s; stack[top++] = i + w; }
      }
      const bw = x1 - x0 + 1, bh = y1 - y0 + 1, d = Math.sqrt(area * 4 / Math.PI);
      if (d < 0.035 * short || d > 0.6 * short) continue;            // a speck, or half the picture
      if (x0 === 0 || y0 === 0 || x1 === w - 1 || y1 === h - 1) continue;   // runs off the edge
      const fill = area / (bw * bh), ratio = Math.min(bw, bh) / Math.max(bw, bh);
      if (fill < 0.6 || ratio < 0.45) continue;                      // a circle fills 79% of its box
      const score = Math.min(1, fill / 0.785) * (0.6 + 0.4 * ratio);
      if (!best || score > best.score) best = { ok: true, x: sx / area / w, y: sy / area / w, r: d / 2 / w, score };
    }
    return best || { ok: false, score: 0 };
  };
  /* Grab a frame from a <video> and look for the pill in it. */
  Pill.fromVideo = function (video) {
    const vw = video.videoWidth, vh = video.videoHeight;
    if (!vw || !vh) return { ok: false, score: 0 };
    const k = 200 / Math.max(vw, vh), w = Math.max(1, Math.round(vw * k)), h = Math.max(1, Math.round(vh * k));
    const c = Pill._c || (Pill._c = document.createElement('canvas'));
    c.width = w; c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, w, h);
    return Pill.find(ctx.getImageData(0, 0, w, h).data, w, h);
  };
  PN.Pill = Pill;
})(window.PN = window.PN || {});
