/* Pikku Norppa: spotting the pill in a photo.
   Looks for one small white tablet: a pale, colourless, evenly lit blob whose outline is a clean circle or oval,
   sitting on something that is not white. Everything happens on the phone; no picture is kept or sent anywhere. */
(function (PN) {
  'use strict';
  const Pill = {};
  Pill.SIZE = 480;       // photos are shrunk so the long side is this many pixels
  /* rgba: Uint8ClampedArray of w*h*4. Returns { ok, x, y, r, score } with x, y, r as fractions of the width. */
  /* The light changes how white the pill looks, so try a few strictnesses of "pale" and keep the best clean oval. */
  Pill.find = function (rgba, w, h, dbg) {
    let best = { ok: false, score: 0 };
    for (const t of Pill.LEVELS) { const r = pass(rgba, w, h, t, dbg); if (r.ok && r.score > best.score) best = r; }
    return best;
  };
  Pill.SD = 0.18;
  Pill.LEVELS = [0.09, 0.13, 0.17, 0.21, 0.26];
  function pass(rgba, w, h, T, dbg) {
    const n = w * h, mask = new Uint8Array(n), lab = new Int32Array(n).fill(-1), lum = new Uint8Array(n);
    for (let i = 0, p = 0; i < n; i++, p += 4) {
      const r = rgba[p], g = rgba[p + 1], b = rgba[p + 2];
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      lum[i] = mx;
      // pale and nearly colourless; warm wood and skin are too yellow or pink to pass
      if (mx > 110 && (mx - mn) < T * mx + 5) mask[i] = 1;
    }
    const short = Math.min(w, h), stack = new Int32Array(n);
    let best = null;
    for (let s = 0; s < n; s++) {
      if (!mask[s] || lab[s] >= 0) continue;
      let top = 0, area = 0, x0 = w, x1 = 0, y0 = h, y1 = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, sl = 0, sll = 0;
      const first = top;
      stack[top++] = s; lab[s] = s;
      const px = [];
      while (top) {
        const i = stack[--top], x = i % w, y = (i - x) / w;
        area++; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; sl += lum[i]; sll += lum[i] * lum[i];
        if (px.length < 60000) px.push(i);
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        if (x > 0 && mask[i - 1] && lab[i - 1] < 0) { lab[i - 1] = s; stack[top++] = i - 1; }
        if (x < w - 1 && mask[i + 1] && lab[i + 1] < 0) { lab[i + 1] = s; stack[top++] = i + 1; }
        if (y > 0 && mask[i - w] && lab[i - w] < 0) { lab[i - w] = s; stack[top++] = i - w; }
        if (y < h - 1 && mask[i + w] && lab[i + w] < 0) { lab[i + w] = s; stack[top++] = i + w; }
      }
      const d = Math.sqrt(area * 4 / Math.PI);
      if (d < 0.03 * short || d > 0.3 * short) continue;                   // a speck, or far too big
      if (x0 <= 1 || y0 <= 1 || x1 >= w - 2 || y1 >= h - 2) continue;       // runs off the edge
      // the oval with the same spread as the blob: a solid oval matches its own exactly
      const cx = sx / area, cy = sy / area;
      const vxx = sxx / area - cx * cx, vyy = syy / area - cy * cy, vxy = sxy / area - cx * cy;
      const tr = vxx + vyy, det = vxx * vyy - vxy * vxy, disc = Math.sqrt(Math.max(0, tr * tr / 4 - det));
      const l1 = tr / 2 + disc, l2 = Math.max(1e-6, tr / 2 - disc);
      const a = 2 * Math.sqrt(l1), b = 2 * Math.sqrt(l2), ratio = b / a, solid = area / (Math.PI * a * b);
      if (dbg) dbg.push({ cx: Math.round(cx), cy: Math.round(cy), d: +d.toFixed(0), ratio: +ratio.toFixed(2), solid: +solid.toFixed(2) });
      if (ratio < 0.6 || solid < 0.95 || solid > 1.05) continue;
      // how much of the blob lies inside that oval, and how clean the ground around it is
      const ang = 0.5 * Math.atan2(2 * vxy, vxx - vyy), ca = Math.cos(ang), sa = Math.sin(ang);
      let inside = 0;
      for (let k = 0; k < px.length; k++) {
        const i = px[k], x = i % w - cx, y = (i - i % w) / w - cy, u = (x * ca + y * sa) / a, v = (-x * sa + y * ca) / b;
        if (u * u + v * v <= 1.06) inside++;
      }
      const fit = inside / px.length;
      if (dbg) dbg[dbg.length - 1].fit = +fit.toFixed(3);
      if (fit < 0.972) continue;
      let ring = 0, ringMask = 0, rl = 0;
      const R = Math.ceil(a * 1.7);
      for (let yy = Math.max(0, Math.floor(cy - R)); yy <= Math.min(h - 1, Math.ceil(cy + R)); yy++) {
        for (let xx = Math.max(0, Math.floor(cx - R)); xx <= Math.min(w - 1, Math.ceil(cx + R)); xx++) {
          const x = xx - cx, y = yy - cy, u = (x * ca + y * sa) / a, v = (-x * sa + y * ca) / b, q = u * u + v * v;
          if (q > 1.25 * 1.25 && q <= 1.7 * 1.7) { ring++; const i = yy * w + xx; if (mask[i]) ringMask++; rl += lum[i]; }
        }
      }
      const clutter = ring ? ringMask / ring : 1;
      const mean = sl / area, sd = Math.sqrt(Math.max(0, sll / area - mean * mean));
      if (dbg) Object.assign(dbg[dbg.length - 1], { clutter: +clutter.toFixed(2), sd: +(sd / mean).toFixed(2), dl: +(mean - rl / ring).toFixed(0) });
      if (clutter > 0.06) continue;                                          // it must stand alone on a ground that is not white
      if (sd > Pill.SD * mean) continue;                                        // evenly lit, like a plain tablet
      if (mean < rl / ring + 12) continue;                                   // and clearly paler than what it sits on
      const score = fit * Math.min(solid, 2 - solid) * (0.7 + 0.3 * ratio) * (1 - clutter);
      const c = { ok: true, x: cx / w, y: cy / w, r: d / 2 / w, score, ratio, solid, fit, clutter, sd: sd / mean };
      if (!best || score > best.score) best = c;
    }
    return best || { ok: false, score: 0 };
  }
  /* Look for the pill in a photo (a File or Blob from the camera). Resolves to the same result as find(). */
  Pill.fromFile = async function (file) {
    let bmp;
    try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { bmp = await createImageBitmap(file); }
    const k = Math.min(1, Pill.SIZE / Math.max(bmp.width, bmp.height)), w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bmp, 0, 0, w, h);
    if (bmp.close) bmp.close();
    return Pill.find(ctx.getImageData(0, 0, w, h).data, w, h);
  };
  PN.Pill = Pill;
})(window.PN = window.PN || {});
