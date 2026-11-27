/* The Typing Seal post office. The painted room only needs a redraw when the window or keyboard changes size. */
(function (PN) {
  'use strict';
  const T = THREE;

  function room(scene) {
    const canvas = document.createElement('canvas'), c = canvas.getContext('2d');
    const scenery = new Image();
    let texture, width = 0, height = 0, sill = 0, sealX = 0, scale = 1;

    function fill(x, y, w, h, color) { c.fillStyle = color; c.fillRect(x, y, w, h); }
    function panel(x, y, w, h, r, color) {
      c.beginPath(); c.roundRect(x, y, w, h, r); c.fillStyle = color; c.fill();
    }
    function oval(x, y, rx, ry, color) {
      c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fillStyle = color; c.fill();
    }
    function line(points, color, weight) {
      c.beginPath(); c.moveTo(points[0], points[1]);
      for (let i = 2; i < points.length; i += 2) c.lineTo(points[i], points[i + 1]);
      c.strokeStyle = color; c.lineWidth = weight; c.stroke();
    }
    function envelope(x, y, size, angle, paper) {
      c.save(); c.translate(x, y); c.rotate(angle); c.scale(size, size);
      panel(-59, -30, 120, 68, 5, '#816650'); panel(-60, -34, 120, 68, 4, paper);
      line([-59, -31, -5, 4, 0, 6, 5, 4, 59, -31], '#bba789', 1.7);
      line([-57, 31, -19, -1], '#cebfa5', 1); line([57, 31, 19, -1], '#cebfa5', 1);
      oval(0, 6, 8, 6.5, '#bd5e54'); oval(-1, 4, 5, 3.5, '#d78974');
      c.restore();
    }
    function pencil(x, y, angle) {
      c.save(); c.translate(x, y); c.rotate(angle);
      panel(-3, -42, 7, 75, 2, '#bd5944'); fill(-2, -36, 2, 65, '#ed9c74');
      fill(-3, -37, 7, 5, '#d9b77c');
      c.beginPath(); c.moveTo(-3, 32); c.lineTo(4, 32); c.lineTo(0, 43); c.closePath(); c.fillStyle = '#f3cc99'; c.fill();
      line([0, 42, 0.5, 39], '#384d54', 2); c.restore();
    }
    function paint() {
      const w = width, h = height;
      if (!w || !h) return;
      const pixel = Math.min(1.6, window.devicePixelRatio || 1, 1800 / Math.max(w, h));
      const cw = Math.max(1, Math.round(w * pixel)), ch = Math.max(1, Math.round(h * pixel));
      if (canvas.width !== cw || canvas.height !== ch || !texture) {
        if (texture) texture.dispose();
        canvas.width = cw; canvas.height = ch;
        texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace;
        texture.generateMipmaps = false; texture.minFilter = T.LinearFilter;
        scene.background = texture;
      }
      c.setTransform(cw / w, 0, 0, ch / h, 0, 0);
      // The sill marks the far edge of the writing desk, behind the seal.
      fill(0, 0, w, sill, '#aac9d1');
      if (scenery.naturalWidth) {
        const s = Math.max(w / scenery.naturalWidth, sill / scenery.naturalHeight);
        c.drawImage(scenery, (w - scenery.naturalWidth * s) / 2, (sill - scenery.naturalHeight * s) * 0.55, scenery.naturalWidth * s, scenery.naturalHeight * s);
      }
      for (const x of [0, w * 0.77, w - 8]) {
        fill(x, 0, 8, sill, '#946e53'); fill(x + 2, 0, 3, sill, '#ead29f');
      }
      const wood = c.createLinearGradient(0, sill, w * 0.18, h);
      wood.addColorStop(0, '#e1b986'); wood.addColorStop(0.42, '#d1a16f'); wood.addColorStop(1, '#ba895f');
      fill(0, sill, w, h - sill, wood);
      fill(0, sill, w, 3, '#e9cda0'); fill(0, sill + 3, w, 6, '#b88d69'); fill(0, sill + 9, w, 3, '#957659');
      const r = PN.U.rng(144);
      for (let y = sill + 23; y < h; y += 15 + r() * 18) {
        for (let x = -32; x < w; x += 110 + r() * 140) {
          const len = 34 + r() * 95;
          c.beginPath(); c.moveTo(x, y); c.bezierCurveTo(x + len / 3, y - 2.5, x + len / 2, y + 2, x + len, y);
          c.strokeStyle = 'rgba(125,80,46,.12)'; c.lineWidth = 1.4; c.stroke();
        }
      }
      const matW = Math.min(w * 0.9, 760), matX = (w - matW) / 2, matY = sill + 35 * scale;
      const matH = Math.max(122, Math.min(h - matY - 28, 450));
      panel(matX, matY + 4, matW, matH, 18, '#9f785a');
      panel(matX, matY, matW, matH, 18, '#437971');
      c.beginPath(); c.roundRect(matX + 5, matY + 5, matW - 10, matH - 10, 14);
      c.strokeStyle = '#8fb3a1'; c.lineWidth = 1; c.setLineDash([4, 4]); c.stroke(); c.setLineDash([]);
      const shadowY = sill + 28 * scale;
      c.save(); c.translate(sealX, shadowY); c.scale(68 * scale, 10 * scale);
      const shadow = c.createRadialGradient(0, 0, 0, 0, 0, 1);
      shadow.addColorStop(0, 'rgba(52,44,45,.30)'); shadow.addColorStop(1, 'rgba(52,44,45,0)');
      oval(0, 0, 1, 1, shadow); c.restore();
      // Correspondence waiting at the near edge, away from the live word.
      const bottom = matY + matH;
      envelope(matX + 27, bottom + 12, 0.98, -0.20, '#e5c49a');
      envelope(matX + 24, bottom + 2, 0.95, -0.11, '#fff0d4');
      pencil(matX + matW - 20, bottom - 9, 0.55);
      texture.needsUpdate = true;
    }
    scenery.onload = paint;
    scenery.src = 'art/typing-saimaa.webp';
    return (w, h, y, x, zoom) => {
      const nextSill = Math.max(16, Math.round(y));
      if (width === w && height === h && sill === nextSill && sealX === x && scale === zoom) return;
      width = w; height = h; sill = nextSill; sealX = x; scale = zoom; paint();
    };
  }

  PN.TypingArt = { room };
})(window.PN);
