/* Pikku Norppa: the seal.
   A chubby body, a round head, big glossy eyes and a face that can show how it feels.
   Three coats for three ages: white pup, silver youngster, ringed grown-up. */
(function (PN) {
  'use strict';
  const T = THREE, U = PN.U, TAU = Math.PI * 2;

  const COAT = [
    { back: [246, 243, 236], belly: [255, 254, 250], face: [255, 255, 255], spots: 'none', pad: 0xffffff, flip: 0xe4e0d8, scale: 0.6, head: 1.16, body: 0.86, eye: 1.12 },
    { back: [176, 187, 198], belly: [243, 240, 234], face: [232, 232, 228], spots: 'soft', pad: 0xf7f5f0, flip: 0x98a4b0, scale: 0.8, head: 1.07, body: 0.94, eye: 1.05 },
    { back: [120, 132, 146], belly: [233, 228, 218], face: [214, 212, 206], spots: 'ring', pad: 0xf1eee8, flip: 0x6c7886, scale: 1.0, head: 1.0, body: 1.0, eye: 1.0 },
  ];
  const css = (c, a) => 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (a == null ? 1 : a) + ')';
  const mix = (a, b, t) => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t));

  /* Coat texture. The spheres are turned so their poles sit at nose and tail;
     the middle of the back runs along u = 0.75 (the sides at 0.5 and 1, the belly at 0.25)
     and the canvas top is the front. */
  const AP = () => PN.Appearance;
  const rgb = (id) => { const n = parseInt(AP().colors[id][2].slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const FADE = [0.5, 0.2, 0];             // how far a natural coat is washed toward the white pup coat at each age
  const MARK = [0.25, 0.6, 1];             // how clearly natural markings show at each age
  function coatColors(stage, a) {
    const c = Object.assign({}, COAT[stage]);
    c.mark = 1;
    if (!a) return c;
    const grow = (id, base) => (AP().dream(id) ? rgb(id) : mix(rgb(id), base, FADE[stage]));
    if (a.coat !== 'original') c.back = grow(a.coat, COAT[0].back);
    if (a.belly !== 'original') c.belly = grow(a.belly, COAT[0].belly);
    if (a.coat !== 'original' || a.belly !== 'original') c.face = mix(c.back, c.belly, 0.75);
    if (a.pattern !== 'original') { c.spots = a.pattern === 'plain' ? 'none' : a.pattern; c.mark = MARK[stage]; }
    return c;
  }
  /* Does this look need the sharper body texture? */
  const fineArt = (a) => !!a && (a.decal !== 'none' || a.finish === 'shimmer');

  /* Little stamps for the clinic's special markings, drawn in a box from -1 to 1 (y down, toward the tail). */
  const STAMP = {
    hearts(g) { g.beginPath(); g.moveTo(0, 0.92); g.bezierCurveTo(-1.25, 0.05, -0.85, -1.0, 0, -0.38); g.bezierCurveTo(0.85, -1.0, 1.25, 0.05, 0, 0.92); g.fill(); },
    stars(g) { star(g, 5, 1, 0.45); g.fill(); },
    sparkles(g) { g.beginPath(); g.moveTo(0, -1); g.quadraticCurveTo(0.1, -0.1, 1, 0); g.quadraticCurveTo(0.1, 0.1, 0, 1); g.quadraticCurveTo(-0.1, 0.1, -1, 0); g.quadraticCurveTo(-0.1, -0.1, 0, -1); g.fill(); },
    moons(g) { g.beginPath(); g.arc(0, 0, 0.95, 0, TAU); g.fill(); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(0.42, -0.22, 0.8, 0, TAU); g.fill(); },
    flowers(g, col) {
      for (let i = 0; i < 5; i++) { const t = i / 5 * TAU - Math.PI / 2; g.beginPath(); g.arc(Math.cos(t) * 0.5, Math.sin(t) * 0.5, 0.44, 0, TAU); g.fill(); }
      g.fillStyle = css(mix(col, [255, 236, 150], 0.7)); g.beginPath(); g.arc(0, 0, 0.3, 0, TAU); g.fill();
    },
    paws(g) {
      g.beginPath(); g.ellipse(0, 0.32, 0.46, 0.4, 0, 0, TAU); g.fill();
      [[-0.6, -0.18], [-0.22, -0.58], [0.22, -0.58], [0.6, -0.18]].forEach(([x, y]) => { g.beginPath(); g.ellipse(x, y, 0.19, 0.23, x * 0.5, 0, TAU); g.fill(); });
    },
    snowflakes(g) {
      g.lineWidth = 0.15; g.lineCap = 'round'; g.beginPath();
      for (let i = 0; i < 6; i++) {
        const t = i / 6 * TAU, cx = Math.cos(t), sy = Math.sin(t);
        g.moveTo(0, 0); g.lineTo(cx * 0.95, sy * 0.95);
        [0.5, 0.72].forEach((k) => { const px = cx * k, py = sy * k, l = 0.28 - (k - 0.5) * 0.4;
          [-0.7, 0.7].forEach((d) => { g.moveTo(px, py); g.lineTo(px + Math.cos(t + d) * l, py + Math.sin(t + d) * l); }); });
      }
      g.stroke();
    },
    leaves(g, col) {
      g.beginPath(); g.moveTo(0, -0.95); g.bezierCurveTo(0.75, -0.55, 0.7, 0.35, 0, 0.72); g.bezierCurveTo(-0.7, 0.35, -0.75, -0.55, 0, -0.95); g.fill();
      g.strokeStyle = css(mix(col, [255, 255, 255], 0.45)); g.lineWidth = 0.08; g.lineCap = 'round';
      g.beginPath(); g.moveTo(0, -0.7); g.lineTo(0, 1.0);
      [-0.35, 0, 0.3].forEach((y) => { g.moveTo(0, y); g.lineTo(0.38, y - 0.22); g.moveTo(0, y); g.lineTo(-0.38, y - 0.22); });
      g.stroke();
    },
    cloudberries(g, col) {
      [[0, 0.05], [-0.36, -0.2], [0.36, -0.2], [-0.4, 0.25], [0.4, 0.25], [0, -0.45], [0, 0.5]].forEach(([x, y]) => {
        g.fillStyle = css(col); g.beginPath(); g.arc(x * 1.1, y * 1.1, 0.3, 0, TAU); g.fill();
        g.fillStyle = css(mix(col, [255, 255, 255], 0.55)); g.beginPath(); g.arc(x * 1.1 - 0.08, y * 1.1 - 0.09, 0.08, 0, TAU); g.fill();
      });
      g.fillStyle = css([110, 150, 90]); [-0.5, 0, 0.5].forEach((x) => { g.beginPath(); g.ellipse(x * 0.5, -0.9, 0.22, 0.1, x, 0, TAU); g.fill(); });
    },
    butterflies(g, col) {
      [[-1, -0.28, 0.5, 0.4, -0.5], [1, -0.28, 0.5, 0.4, 0.5], [-1, 0.38, 0.34, 0.3, 0.4], [1, 0.38, 0.34, 0.3, -0.4]].forEach(([s, y, rx, ry, rot]) => {
        g.beginPath(); g.ellipse(s * 0.46, y, rx, ry, rot, 0, TAU); g.fill();
      });
      g.fillStyle = css(mix(col, [255, 255, 255], 0.6));
      [[-1, -0.3], [1, -0.3]].forEach(([s, y]) => { g.beginPath(); g.arc(s * 0.5, y, 0.14, 0, TAU); g.fill(); });
      g.fillStyle = css(mix(col, [20, 25, 40], 0.55)); g.beginPath(); g.ellipse(0, 0.05, 0.09, 0.62, 0, 0, TAU); g.fill();
    },
  };
  STAMP.constellation = STAMP.stars;
  function star(g, n, ro, ri) {
    g.beginPath();
    for (let i = 0; i < n * 2; i++) { const t = i / (n * 2) * TAU - Math.PI / 2, r = i % 2 ? ri : ro; g[i ? 'lineTo' : 'moveTo'](Math.cos(t) * r, Math.sin(t) * r); }
    g.closePath();
  }
  function stampCanvas(kind, col) {
    const c = document.createElement('canvas'); c.width = c.height = 96;
    const g = c.getContext('2d');
    g.translate(48, 48); g.scale(44, 44);
    g.fillStyle = g.strokeStyle = css(col);
    STAMP[kind](g, col);
    return c;
  }
  /* Put a stamp on the coat at (u, v) with radius r pixels. Stretched sideways so it looks round on the body. */
  function putStamp(g, img, w, h, u, v, r, rot) {
    const xs = 1.5 / Math.max(0.4, Math.sin(Math.PI * v));
    g.save(); g.translate(u * w, v * h); g.scale(xs, 1); g.rotate(rot); g.drawImage(img, -r, -r, r * 2, r * 2); g.restore();
  }
  /* A soft-edged wash of one colour over part of the canvas: vertical and horizontal ramps of [position, alpha]. */
  function wash(g, w, h, col, vStops, uStops) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const o = c.getContext('2d');
    const vg = o.createLinearGradient(0, 0, 0, h); vStops.forEach(([p, al]) => vg.addColorStop(p, css(col, al)));
    o.fillStyle = vg; o.fillRect(0, 0, w, h);
    if (uStops) {
      o.globalCompositeOperation = 'destination-in';
      const ug = o.createLinearGradient(0, 0, w, 0); uStops.forEach(([p, al]) => ug.addColorStop(p, 'rgba(0,0,0,' + al + ')'));
      o.fillStyle = ug; o.fillRect(0, 0, w, h);
    }
    g.drawImage(c, 0, 0);
  }
  const BACK = [[0.46, 0], [0.56, 1], [0.94, 1], [1, 0]];          // just the back, soft at the sides

  function drawDecals(g, w, h, a, r) {
    const col = rgb(a.decalColor), S = w / 512, kind = a.decal, one = a.decalLayout === 'one';
    g.save(); g.globalAlpha = a.decalOpacity;
    if (kind === 'aurora') {
      // northern lights: glowing waves running from neck to tail along the back
      const bands = one ? [[0.75, 7]] : [[0.68, 3], [0.75, 3.5], [0.82, 3]];
      bands.forEach(([u0, thick], bi) => {
        const hue = bi % 2 ? mix(col, [150, 110, 230], 0.45) : col;
        for (let k = 3; k >= 0; k--) {
          g.strokeStyle = css(k ? hue : mix(hue, [255, 255, 255], 0.4), k ? 0.18 : 0.85);
          g.lineWidth = thick * S * a.decalSize * (1 + k * 1.4); g.lineCap = 'round';
          g.beginPath();
          for (let v = 0.14; v <= 0.86; v += 0.01) { const u = u0 + Math.sin(v * 13 + bi * 2) * 0.025; g[v < 0.145 ? 'moveTo' : 'lineTo'](u * w, v * h); }
          g.stroke();
        }
      });
    } else if (kind === 'constellation') {
      const img = stampCanvas('stars', col);
      const shape = [[0, 0], [0.25, 0.08], [0.48, 0.02], [0.66, 0.16], [0.62, 0.42], [0.9, 0.5], [0.95, 0.24]];
      const groups = one ? [[0.75, 0.47, 1]] : [[0.7, 0.3, 0.45], [0.8, 0.62, 0.45]];
      groups.forEach(([cu, cv, k]) => {
        const sz = k * a.decalSize, pts = shape.map(([x, y]) => [cu + (y - 0.25) * 0.24 * sz, cv + (x - 0.5) * 0.62 * sz]);
        g.strokeStyle = css(col, 0.7); g.lineWidth = 1.4 * S; g.setLineDash([4 * S, 3 * S]);
        g.beginPath(); pts.slice(0, 5).forEach(([u, v], i) => g[i ? 'lineTo' : 'moveTo'](u * w, v * h)); g.lineTo(pts[5][0] * w, pts[5][1] * h); g.lineTo(pts[6][0] * w, pts[6][1] * h); g.lineTo(pts[3][0] * w, pts[3][1] * h); g.stroke();
        g.setLineDash([]);
        pts.forEach(([u, v], i) => putStamp(g, img, w, h, u, v, (i % 3 ? 4.5 : 7) * S * (0.6 + 0.4 * sz), r() * 0.6));
      });
    } else {
      const img = stampCanvas(kind, col), spin = /stars|snowflakes|sparkles|flowers|leaves/.test(kind);
      if (one) putStamp(g, img, w, h, 0.75, 0.45, 42 * S * a.decalSize, 0);
      else {
        // a jittered grid down the back so the little ones never pile up
        for (let row = 0; row < 5; row++) for (let col2 = 0; col2 < 3; col2++) {
          if ((row + col2) % 2 && r() < 0.2) continue;
          const u = 0.645 + col2 * 0.105 + (r() - 0.5) * 0.04, v = 0.2 + row * 0.15 + (r() - 0.5) * 0.06;
          putStamp(g, img, w, h, u, v, (10.5 + r() * 3) * S * a.decalSize, spin ? r() * TAU : (r() - 0.5) * 0.7);
        }
      }
    }
    g.restore();
  }

  function coatTexture(stage, isHead, a) {
    const c = coatColors(stage, a), fine = !isHead && fineArt(a);
    return U.tex(fine ? 1024 : 512, fine ? 512 : 256, (g, w, h) => {
      const S = w / 512, r = U.rng((a ? a.seed : 31) + stage * 17 + (isHead ? 5 : 0));
      const edge = css(mix(c.back, c.belly, 0.64));
      const grad = g.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, edge); grad.addColorStop(0.05, css(c.belly)); grad.addColorStop(0.45, css(c.belly));
      grad.addColorStop(0.59, css(c.back)); grad.addColorStop(0.91, css(c.back)); grad.addColorStop(1, edge);
      g.fillStyle = grad; g.fillRect(0, 0, w, h);
      if (a && !isHead && a.gradient !== 'none') wash(g, w, h, rgb(a.gradient), [[0.22, 0], [0.62, 0.55], [1, 0.95]], BACK);
      if (a && !isHead && a.tail !== 'none') wash(g, w, h, rgb(a.tail), [[0.83, 0], [0.93, 1], [1, 1]]);
      if (c.spots !== 'none') {
        const n = (isHead ? 16 : 78) * (c.spots === 'freckles' ? 2 : c.spots === 'mottled' ? 0.5 : 1);
        const size = a ? a.patternSize : 1, strength = (a ? a.patternOpacity / 0.8 : 1) * c.mark;
        const custom = a && a.marking !== 'original' ? rgb(a.marking) : null;
        for (let i = 0; i < n; i++) {
          const u = 0.57 + r() * 0.36, v = isHead ? 0.5 + r() * 0.42 : 0.1 + r() * 0.8;
          const ry = ((isHead ? 4 : 5) + r() * (isHead ? 3 : 5)) * S * size * (c.spots === 'freckles' ? 0.4 : c.spots === 'mottled' ? 1.9 : 1);
          const rx = ry * 1.5 / Math.max(0.4, Math.sin(Math.PI * v));
          g.beginPath(); g.ellipse(u * w, v * h, rx, ry, 0, 0, TAU);
          if (c.spots === 'ring') {
            g.fillStyle = css(mix(c.back, [35, 40, 48], 0.5), 0.38 * strength); g.fill();
            g.lineWidth = 2 * S * size; g.strokeStyle = css(custom || [226, 232, 238], Math.min(1, 0.8 * strength)); g.stroke();
          } else { g.fillStyle = css(custom || [120, 132, 146], Math.min(1, (custom ? 0.6 : 0.3) * strength)); g.fill(); }
        }
      }
      if (a && !isHead && a.decal !== 'none') drawDecals(g, w, h, a, r);
      if (isHead) {                              // a paler face at the front
        const f = g.createLinearGradient(0, 0, 0, h * 0.5);
        f.addColorStop(0, css(c.face, 1)); f.addColorStop(0.55, css(c.face, 0.85)); f.addColorStop(1, css(c.face, 0));
        g.fillStyle = f; g.fillRect(0, 0, w, h * 0.5);
        // a mask round the eyes and over the brow, leaving the chin and muzzle pale
        if (a && a.mask !== 'none') wash(g, w, h, rgb(a.mask), [[0, 0.92], [0.17, 0.92], [0.27, 0]], [[0, 0.9], [0.06, 0], [0.42, 0], [0.5, 0.92], [1, 0.9]]);
      }
      if (a && a.finish === 'shimmer') {          // tiny glints in the fur
        for (let i = 0; i < (isHead ? 160 : 520); i++) {
          g.fillStyle = 'rgba(255,255,255,' + (0.35 + r() * 0.5).toFixed(2) + ')';
          g.beginPath(); g.arc(r() * w, r() * h, (0.5 + r() * 0.9) * S, 0, TAU); g.fill();
        }
      }
    });
  }

  function bodyGeometry() {
    const g = new T.SphereGeometry(1, 48, 32);
    g.rotateX(Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const ux = p.getX(i), uy = p.getY(i), uz = p.getZ(i);
      const f = uz < 0 ? 1 - 0.5 * Math.pow(-uz, 1.5) : 1 + 0.05 * uz;
      let x = ux * 0.8 * f, y = uy * 0.64 * f;
      if (uy < 0) { y *= 0.74; x *= 1 + 0.12 * -uy; }           // belly squashed against the ground
      if (uz < 0) y -= 0.12 * uz * uz;                           // the back end droops
      p.setXYZ(i, x, y, uz * 1.2);
    }
    g.computeVertexNormals();
    return g;
  }
  /* Neckwear sits around the base of the head, tilted back over the nape and
     forward under the chin. It is carried by the body rig, but never wrapped
     around the torso. Original colour/UVs and ornament detail are preserved. */
  // Subdivide loose cloth so it can drape smoothly around the neck.
  function neckClothGeometry(geo) {
    const input = geo.index ? geo.toNonIndexed() : geo, p = input.attributes.position, uv = input.attributes.uv;
    const points = [], coords = [];
    const split = (a, b, c, depth) => {
      const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      const lengths = [dist(a, b), dist(b, c), dist(c, a)], longest = Math.max(...lengths);
      if (longest > 0.10 && depth < 8) {
        if (lengths[1] === longest) { const t = a; a = b; b = c; c = t; }
        else if (lengths[2] === longest) { const t = c; c = b; b = a; a = t; }
        const mid = a.map((v, i) => (v + b[i]) / 2);
        split(a, mid, c, depth + 1); split(mid, b, c, depth + 1);
      } else [a, b, c].forEach((v) => { points.push(...v.slice(0, 3)); coords.push(...v.slice(3)); });
    };
    for (let i = 0; i < p.count; i += 3) {
      const at = (k) => [p.getX(k), p.getY(k), p.getZ(k), uv ? uv.getX(k) : 0, uv ? uv.getY(k) : 0];
      split(at(i), at(i + 1), at(i + 2), 0);
    }
    const out = new T.BufferGeometry();
    out.setAttribute('position', new T.Float32BufferAttribute(points, 3)); out.setAttribute('uv', new T.Float32BufferAttribute(coords, 2));
    if (input !== geo) input.dispose(); geo.dispose();
    return out;
  }
  function fitNeckwear(source, stage, id, appearance) {
    const a = PN.Appearance.normalize(appearance), width = a.bodyWidth;
    const c = Object.assign({}, COAT[stage]); c.body *= a.bodyLength; c.head *= a.headSize;
    const bodyZ = 1.05 - 1.2 * c.body;
    const fitted = new T.Group();
    const drapes = /^(scarf_|huivi$|solmuke$|solmio$|mitali$|bell$)/.test(id);
    source.updateMatrixWorld(true);
    source.traverse((mesh) => {
      if (!mesh.isMesh) return;
      let root = mesh;
      while (root.parent && root.parent !== source) root = root.parent;
      const hanging = drapes && root !== source.children[0];
      let geo = mesh.geometry.clone(); geo.applyMatrix4(mesh.matrixWorld);
      if (hanging && /^(BoxGeometry|ExtrudeGeometry)$/.test(mesh.geometry.type)) geo = neckClothGeometry(geo);
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), depth = p.getZ(i), radius = Math.hypot(x, y);
        const angle = Math.atan2(y, x), sx = Math.cos(angle), sy = Math.sin(angle);
        // An anatomical collar: broad at the sides of the head, high at the
        // nape, and low under the chin. Loose scarf ends remain at the chest.
        const thickness = (radius - 0.625) * 0.75;
        const px = (0.66 * c.head + thickness) * sx;
        const py = 0.58 + (sy >= 0 ? 0.53 : 0.44 * c.head) * sy + thickness * sy;
        const pz = 0.60 - 0.45 * c.head * sy + depth * 0.7 - thickness * 0.6 * sy;
        // Convert the neck position into the body's local coordinates so it
        // follows body motion without inheriting the head's independent turns.
        p.setXYZ(i, px / width, (Math.max(0.035, py + 0.46 * (width - 1)) - 0.46 * width) / width, (pz - bodyZ) / c.body);
      }
      geo.computeVertexNormals(); geo.computeBoundingSphere();
      const m = new T.Mesh(geo, mesh.material); m.castShadow = true;
      fitted.add(m);
    });
    // Props.wear creates these geometries for this item; the fitted copies own their lifetime.
    source.traverse((mesh) => { if (mesh.isMesh) mesh.geometry.dispose(); });
    return fitted;
  }

  /* The snuggle blanket, shaped to lie over the body: across the back from side to side, from near the tail up to the neck.
     Made in the body's own space (it rides on the body mesh), a little outside the fur, the hem hanging a touch wavy. */
  function blanketGeometry() {
    const nu = 28, nv = 22, pos = [], uv = [], idx = [], Z0 = -0.94, TH = 1.85;
    // Curve round the neck: cover the shoulders without pulling over the face.
    const front = (th) => 0.30 + 0.40 * Math.pow(Math.sin(th), 2);
    const at = (uz, th, off) => {
      const f = uz < 0 ? 1 - 0.5 * Math.pow(-uz, 1.5) : 1 + 0.05 * uz, rr = Math.sqrt(Math.max(0.02, 1 - uz * uz));
      const ux = Math.sin(th) * rr, uy = Math.cos(th) * rr;
      let x = ux * 0.8 * f, y = uy * 0.64 * f;
      if (uy < 0) { y *= 0.74; x *= 1 + 0.12 * -uy; }
      if (uz < 0) y -= 0.12 * uz * uz;
      const n = Math.hypot(Math.sin(th), Math.cos(th));
      return [x + Math.sin(th) / n * off, y + Math.cos(th) / n * off, uz * 1.2];
    };
    for (let j = 0; j <= nv; j++) {
      const v = j / nv;
      for (let i = 0; i <= nu; i++) {
        const u = i / nu, th = -TH + 2 * TH * u, uz = Z0 + (front(th) - Z0) * v;
        const q = at(uz, th, 0.075);
        q[1] -= Math.max(0, Math.abs(th) - 1.35) * 0.1 - Math.sin(uz * 11 + th * 2) * 0.008 * Math.max(0, Math.abs(th) - 1.0);
        pos.push(q[0], q[1], q[2]); uv.push(u, v);
      }
    }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    // the folded-over top edge by her neck
    const edge = [];
    for (let i = 0; i <= 12; i++) { const th = -TH + 2 * TH * i / 12, q = at(front(th), th, 0.10); edge.push(new T.Vector3(q[0], q[1] - Math.max(0, Math.abs(th) - 1.35) * 0.1, q[2])); }
    const cuff = new T.TubeGeometry(new T.CatmullRomCurve3(edge), 40, 0.05, 8, false);
    return { g, cuff };
  }
  function headGeometry() {
    const g = new T.SphereGeometry(0.6, 40, 28);
    g.rotateX(Math.PI / 2);
    g.scale(1.03, 0.94, 0.97);
    return g;
  }
  const HR = [0.618, 0.564, 0.582];                 // head radii
  /* A point on the head from a bearing (yaw) and height (pitch), in radians. */
  const onHead = (yaw, pitch, k) => new T.Vector3(Math.sin(yaw) * Math.cos(pitch) * HR[0] * k, Math.sin(pitch) * HR[1] * k, Math.cos(yaw) * Math.cos(pitch) * HR[2] * k);
  const aim = (o, yaw, pitch) => { o.rotation.order = 'YXZ'; o.rotation.y = yaw; o.rotation.x = -pitch; return o; };

  let shared = null;
  function sharedBits() {
    if (shared) return shared;
    shared = {
      body: bodyGeometry(), head: headGeometry(),
      eye: new T.SphereGeometry(0.108, 22, 16),
      eyeMat: new T.MeshStandardMaterial({ color: 0x1a1210, roughness: 0.06 }),
      pupilMat: new T.MeshStandardMaterial({ color: 0x100e12, roughness: 0.1 }),
      white: new T.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
      dark: new T.MeshStandardMaterial({ color: 0x2a1f1c, roughness: 0.5 }),
      line: new T.MeshBasicMaterial({ color: 0x33261f }),
      whisker: new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }),
      arc: new T.TorusGeometry(0.078, 0.017, 6, 16, Math.PI),
      star: (() => { const sh = new T.Shape(); for (let i = 0; i < 10; i++) { const t = i / 10 * TAU + Math.PI / 2, r = i % 2 ? 0.018 : 0.046; sh[i ? 'lineTo' : 'moveTo'](Math.cos(t) * r, Math.sin(t) * r); } return new T.ShapeGeometry(sh); })(),
      smile: new T.TorusGeometry(0.04, 0.0095, 6, 12, Math.PI),
      flip: (() => { const g = new T.SphereGeometry(1, 14, 10); g.scale(0.15, 0.055, 0.3); g.translate(0, 0, 0.24); return g; })(),
      tail: (() => { const g = new T.SphereGeometry(1, 14, 10); g.scale(0.13, 0.045, 0.27); g.translate(0, 0, -0.22); return g; })(),
      blob: U.tex(64, 64, (g) => {
        const r = g.createRadialGradient(32, 32, 2, 32, 32, 32);
        r.addColorStop(0, 'rgba(20,30,60,0.55)'); r.addColorStop(0.6, 'rgba(20,30,60,0.2)'); r.addColorStop(1, 'rgba(20,30,60,0)');
        g.fillStyle = r; g.fillRect(0, 0, 64, 64);
      }),
      coats: {},
    };
    return shared;
  }
  function coat(stage) {
    const S = sharedBits();
    if (!S.coats[stage]) {
      const mk = (isHead) => new T.MeshPhysicalMaterial({ map: coatTexture(stage, isHead), roughness: 0.86, metalness: 0,
        sheen: 1, sheenRoughness: 0.5, sheenColor: new T.Color(stage === 0 ? 0xffffff : 0xdfe8f2) });
      S.coats[stage] = { body: mk(false), head: mk(true), pad: new T.MeshStandardMaterial({ color: COAT[stage].pad, roughness: 0.9 }),
        flip: new T.MeshStandardMaterial({ color: COAT[stage].flip, roughness: 0.8 }) };
    }
    return S.coats[stage];
  }

  /* A flipper texture with its tip dipped in colour. The tip of a sphere-built flipper sits at u = tipU. */
  function tipTexture(base, tip, tipU) {
    return U.tex(64, 32, (g, w, h) => {
      g.fillStyle = css(base); g.fillRect(0, 0, w, h);
      const t = g.createLinearGradient(0, 0, w, 0);
      [[-0.3, 0], [-0.16, 1], [0.16, 1], [0.3, 0]].forEach(([d, al]) => t.addColorStop(Math.min(1, Math.max(0, tipU + d)), css(tip, al)));
      g.fillStyle = t; g.fillRect(0, 0, w, h);
    });
  }
  const FINISH = {
    pearl: { roughness: 0.55, iridescence: 0.75, iridescenceIOR: 1.4, iridescenceThicknessRange: [180, 420], sheenColor: 0xfff2ff, sheenRoughness: 0.35 },
    shimmer: { roughness: 0.5, clearcoat: 0.55, clearcoatRoughness: 0.22, sheenColor: 0xffffff, sheenRoughness: 0.3 },
    aurora: { roughness: 0.5, iridescence: 1, iridescenceIOR: 1.6, iridescenceThicknessRange: [260, 820], sheenColor: 0x8affd6, sheenRoughness: 0.4 },
  };
  function appearanceCoat(stage, a) {
    const c = coatColors(stage, a), base = coat(stage);
    const body = base.body.clone(), head = base.head.clone();
    body.map = coatTexture(stage, false, a); head.map = coatTexture(stage, true, a);
    if (a.finish !== 'none') [body, head].forEach((m) => {
      const f = FINISH[a.finish];
      Object.keys(f).forEach((k) => { if (k === 'sheenColor') m.sheenColor = new T.Color(f[k]); else if (k === 'iridescenceThicknessRange') m[k] = f[k].slice(); else m[k] = f[k]; });
    });
    const pad = base.pad.clone();
    if (a.belly !== 'original' || a.coat !== 'original') pad.color.setRGB(...c.face.map((v) => v / 255), T.SRGBColorSpace);
    const flipBase = a.coat !== 'original' ? mix(c.back, [0, 0, 0], 0.09) : [(COAT[stage].flip >> 16) & 255, (COAT[stage].flip >> 8) & 255, COAT[stage].flip & 255];
    const fin = (tip, tipU) => {
      const m = base.flip.clone();
      if (tip === 'none') m.color.setRGB(...flipBase.map((v) => v / 255), T.SRGBColorSpace);
      else { m.color.set(0xffffff); m.map = tipTexture(flipBase, rgb(tip), tipU); }
      return m;
    };
    return { body, head, pad, flip: fin(a.flippers, 0.25), tail: fin(a.tail, 0.75) };
  }

  class Seal {
    constructor(opts) {
      opts = opts || {};
      const S = sharedBits();
      this.isPup = !!opts.pup;
      this.seed = Math.random() * 100;
      this.stage = -1;
      this.appearance = PN.Appearance.normalize(opts.appearance);
      this.g = new T.Group();                  // place and heading
      this.sq = new T.Group();                 // squash, stretch, lean; pivots at the ground
      this.g.add(this.sq);

      this.shadow = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: S.blob, transparent: true, depthWrite: false, opacity: 0.55, toneMapped: false }));
      this.shadow.rotation.x = -Math.PI / 2; this.shadow.position.set(0, 0.015, -0.1); this.shadow.scale.set(2.3, 3.4, 1);
      this.shadow.renderOrder = 1;
      this.g.add(this.shadow);

      this.body = new T.Mesh(S.body);
      this.body.castShadow = true;
      this.sq.add(this.body);

      // tail flippers
      this.tailG = new T.Group();
      this.tailL = new T.Mesh(S.tail); this.tailR = new T.Mesh(S.tail);
      this.tailL.rotation.y = 0.42; this.tailR.rotation.y = -0.42;
      this.tailG.add(this.tailL, this.tailR);
      this.sq.add(this.tailG);

      // front flippers
      this.flipL = new T.Group(); this.flipR = new T.Group();
      this.flipL.add(new T.Mesh(S.flip)); this.flipR.add(new T.Mesh(S.flip));
      this.flipL.position.set(0.66, 0.2, 0.36); this.flipR.position.set(-0.66, 0.2, 0.36);
      this.flipL.rotation.order = this.flipR.rotation.order = 'YXZ';
      this.sq.add(this.flipL, this.flipR);

      // head
      this.headP = new T.Group();
      this.headP.position.set(0, 0.78, 0.82);
      this.headP.rotation.order = 'YXZ';
      this.sq.add(this.headP);
      this.head = new T.Mesh(S.head);
      this.head.castShadow = true;
      this.headP.add(this.head);

      // eyes
      this.eyes = [];
      [-1, 1].forEach((s) => {
        const e = aim(new T.Group(), s * 0.42, 0.07);
        e.position.copy(onHead(s * 0.42, 0.07, 0.93));
        const ball = new T.Mesh(S.eye, S.eyeMat); ball.scale.set(1, 1.1, 0.62);
        const h1 = U.ball(0.035, S.white, -0.036, 0.048, 0.056, 1, 1, 0.5, 10);
        const h2 = U.ball(0.017, S.white, 0.042, -0.034, 0.06, 1, 1, 0.5, 8);
        const arc = new T.Mesh(S.arc, S.line); arc.position.z = 0.045; arc.visible = false;
        const pupil = U.ball(0.054, S.pupilMat, 0, 0, 0.063, 1, 1.1, 0.18, 16);
        const starH = new T.Mesh(S.star, S.white); starH.position.set(-0.034, 0.046, 0.074); starH.visible = false;
        e.add(ball, pupil, h1, h2, arc, starH);
        this.headP.add(e);
        this.eyes.push({ g: e, ball, pupil, h1, h2, arc, star: starH });
      });

      // muzzle: two pads, a nose, a little mouth, whiskers
      this.muzzle = new T.Group();
      this.headP.add(this.muzzle);
      this.pads = []; this.whiskers = [];
      [-1, 1].forEach((s) => {
        const pad = new T.Mesh(new T.SphereGeometry(0.135, 18, 14));
        pad.scale.set(1, 0.8, 0.75);
        pad.position.copy(onHead(s * 0.17, -0.3, 0.99));
        this.muzzle.add(pad); this.pads.push(pad);
        for (let i = 0; i < 3; i++) {
          const wg = new T.CylinderGeometry(0.0055, 0.002, 0.36, 4); wg.translate(0, 0.18, 0);
          const wk = new T.Mesh(wg, S.whisker); this.whiskers.push(wk);
          wk.position.copy(pad.position).add(new T.Vector3(s * 0.1, -0.01 + (i - 1) * 0.035, 0.0));     // rooted in the cheek pad
          wk.rotation.order = 'YZX';
          wk.rotation.set(0, s * 0.42, -s * (Math.PI / 2 + (i - 1) * 0.24));                                  // swept back along the face
          this.muzzle.add(wk);
          this.muzzle.add(U.ball(0.011, S.dark, pad.position.x + s * (0.02 + i * 0.035), pad.position.y + 0.02 - (i % 2) * 0.045, pad.position.z + 0.098 - i * 0.012));
        }
      });
      const nose = this.nose = U.ball(0.062, S.dark, 0, 0, 0, 1.25, 0.8, 0.7, 14);
      nose.position.copy(onHead(0, -0.13, 1.04));
      this.noseShine = U.ball(0.014, S.white, nose.position.x - 0.02, nose.position.y + 0.02, nose.position.z + 0.036);
      this.muzzle.add(nose, this.noseShine);
      this.mouth = new T.Group();
      this.mouth.position.copy(onHead(0, -0.46, 1.0));
      [-1, 1].forEach((s) => { const a = new T.Mesh(S.smile, S.line); a.rotation.z = Math.PI; a.position.x = s * 0.04; this.mouth.add(a); });
      this.maw = U.ball(0.06, new T.MeshBasicMaterial({ color: 0x7a2a35 }), 0, -0.035, -0.015, 1.15, 1, 0.6, 12);
      this.maw.add(U.ball(0.04, new T.MeshBasicMaterial({ color: 0xff8f9f }), 0, -0.03, 0.02, 1, 0.6, 0.6, 8));
      this.maw.visible = false;
      this.mouth.add(this.maw);
      this.muzzle.add(this.mouth);

      // brow dots, ear dots, blush
      [-1, 1].forEach((s) => {
        const b1 = U.ball(0.014, S.dark); b1.position.copy(onHead(s * 0.36, 0.42, 1.0)); this.headP.add(b1);
        const b2 = U.ball(0.012, S.dark); b2.position.copy(onHead(s * 0.47, 0.39, 1.0)); this.headP.add(b2);
        const ear = U.ball(0.02, S.dark); ear.position.copy(onHead(s * 1.3, 0.12, 1.0)); this.headP.add(ear);
      });
      this.blushMat = new T.MeshBasicMaterial({ color: 0xff8fa8, transparent: true, opacity: 0.4, depthWrite: false });
      [-1, 1].forEach((s) => {
        const b = aim(new T.Mesh(new T.CircleGeometry(0.095, 20), this.blushMat), s * 0.78, -0.24);
        b.position.copy(onHead(s * 0.78, -0.24, 1.006)); b.scale.set(1.3, 0.8, 1); b.renderOrder = 2;
        this.headP.add(b);
      });
      // cheek freckles (a clinic extra), hidden until bought
      this.freckleMat = new T.MeshBasicMaterial({ color: 0x8a6250, transparent: true, opacity: 0.75, depthWrite: false });
      this.freckleG = new T.Group(); this.freckleG.visible = false;
      [-1, 1].forEach((s) => [[0.62, -0.08], [0.72, -0.13], [0.82, -0.09], [0.67, -0.2], [0.78, -0.24], [0.9, -0.18]].forEach(([y, p]) => {
        const d = aim(new T.Mesh(new T.CircleGeometry(0.016, 8), this.freckleMat), s * y, p);
        d.position.copy(onHead(s * y, p, 1.008)); d.renderOrder = 3; this.freckleG.add(d);
      }));
      this.headP.add(this.freckleG);
      this.tear = U.ball(0.035, new T.MeshBasicMaterial({ color: 0x8fd0ff, transparent: true, opacity: 0.9 }), 0, 0, 0, 0.8, 1.2, 0.8, 8);
      this.tear.position.copy(onHead(0.5, -0.12, 1.02)); this.tear.visible = false;
      this.headP.add(this.tear);

      // dirt patches
      this.dirtG = new T.Group(); this.body.add(this.dirtG);
      this.dirtG.position.set(0, -0.46, 0.15);
      this.dirtMat = new T.MeshBasicMaterial({ color: 0x6b5138, transparent: true, opacity: 0, depthWrite: false });
      [[0.5, 0.86, 0.2, 0.22], [-0.42, 0.95, -0.25, 0.26], [0.2, 1.0, -0.6, 0.2], [-0.62, 0.62, 0.3, 0.18], [0.6, 0.6, -0.5, 0.2]].forEach((d) => {
        const m = U.ball(d[3], this.dirtMat, d[0], d[1], d[2], 1, 0.35, 1, 10);
        m.lookAt(0, 0.4, d[2]); m.rotateX(Math.PI / 2); m.renderOrder = 2;
        this.dirtG.add(m);
      });

      // where things attach
      this.neckA = new T.Group(); this.body.add(this.neckA); // fitted in the torso's own coordinates
      this.mouthA = new T.Object3D(); this.mouthA.position.set(0, -0.3, 0.62); this.headP.add(this.mouthA);
      this.topA = new T.Object3D(); this.topA.position.set(0, 0.7, 0.05); this.headP.add(this.topA);
      this.noseA = new T.Object3D(); this.noseA.position.set(0, 0.05, 0.75); this.headP.add(this.noseA);
      this.backA = new T.Group(); this.sq.add(this.backA);                 // on top of the back, just behind the head; placed in setStage
      this.worn = { head: null, neck: null, face: null, back: null };
      this.wornId = { head: null, neck: null, face: null, back: null };

      // state
      this.mood = 'ok'; this.asleep = false; this.sulk = false; this.scared = false; this.petting = 0; this.washing = false;
      this.look = null;                           // a point in the world to look at, or null
      this.heading = 0; this.move = null;
      this.gest = null; this.gestQ = [];
      this.blinkT = 2 + Math.random() * 3; this.blink = 0;
      this.idleT = 2; this.idleYaw = 0; this.idleRoll = 0; this.peekT = 4 + Math.random() * 4; this.peek = 0;
      this.p = { yaw: 0, pitch: 0, roll: 0, bPitch: 0, bRoll: 0, lift: 0, eye: 1, mouth: 0, frown: 0, fl: 0, fr: 0, tail: 0, drop: 0, blush: 0.4 };
      this.sqv = 1; this.sqVel = 0;
      this.baseScale = 1; this.grow = 1;
      this.hit = [this.body, this.head];
      this.body.userData.seal = this; this.head.userData.seal = this;
      this.cosy = false; this.blanket = null; this.blanketK = 0;     // cosy: she has a snuggle blanket to sleep under
      this.eyeMats = [S.eyeMat.clone(), S.eyeMat.clone()]; this.noseMaterial = S.dark.clone(); this.whiskerMat = S.whisker.clone();
      this.eyes.forEach((e, i) => { e.ball.material = this.eyeMats[i]; }); this.nose.material = this.noseMaterial;
      this.whiskers.forEach((w) => { w.material = this.whiskerMat; });
      this.rosy = 0; this.starEyes = false;
      this.setStage(opts.stage || 0);
      const sharedResources = new Set(Object.values(S));
      Object.values(S.coats).forEach((c) => Object.values(c).forEach((v) => sharedResources.add(v)));
      this.ownedGeometry = new Set(); this.ownedMaterial = new Set();
      this.g.traverse((m) => {
        if (m.geometry && !sharedResources.has(m.geometry)) this.ownedGeometry.add(m.geometry);
        if (m.material && !sharedResources.has(m.material) && !Object.values(this.appearanceMats).includes(m.material)) this.ownedMaterial.add(m.material);
      });
    }

    setStage(stage) {
      if (stage === this.stage) return;
      this.stage = stage; this.setAppearance(this.appearance, true);
    }
    setAppearance(input, force) {
      const a = PN.Appearance.normalize(input);
      if (!force && PN.Appearance.equal(a, this.appearance)) return;
      const old = this.appearance;
      this.appearance = a;
      const c = COAT[this.stage], k = c.body * a.bodyLength, width = a.bodyWidth;
      // Only the parts painted into textures or materials need rebuilding; the rest is a quick colour or scale change.
      const texKey = JSON.stringify([this.stage, a.coat, a.belly, a.marking, a.pattern, a.patternSize, a.patternOpacity, a.seed,
        a.decal, a.decalColor, a.decalSize, a.decalOpacity, a.decalLayout, a.gradient, a.mask, a.flippers, a.tail, a.finish]);
      if (this.texKey !== texKey) {
        this.releaseAppearance();
        this.texKey = texKey; this.appearanceMats = appearanceCoat(this.stage, a);
        const m = this.appearanceMats;
        this.body.material = m.body; this.head.material = m.head;
        this.pads.forEach((p) => { p.material = m.pad; });
        [this.flipL.children[0], this.flipR.children[0]].forEach((f) => { f.material = m.flip; f.castShadow = true; });
        [this.tailL, this.tailR].forEach((f) => { f.material = m.tail; f.castShadow = true; });
      }
      const col = (id) => PN.Appearance.colors[id][2];
      this.eyeMats[0].color.set(col(a.eye));
      this.eyeMats[1].color.set(col(a.eyeRight === 'same' ? a.eye : a.eyeRight));
      this.starEyes = a.eyeStar === 'star';
      this.noseMaterial.color.set(col(a.nose));
      this.whiskerMat.color.set(col(a.whiskerColor));
      this.whiskers.forEach((w) => { w.scale.y = a.whiskerLength; });
      this.rosy = a.cheeks === 'rosy' ? 0.42 : 0;
      this.freckleG.visible = a.freckles === 'cheeks';
      this.nose.scale.set(1.25 * a.noseSize, 0.8 * a.noseSize, 0.7 * a.noseSize);
      this.noseShine.position.copy(this.nose.position).add(new T.Vector3(-0.02, 0.02, 0.036).multiplyScalar(a.noseSize));
      this.body.scale.set(width, width, k);
      this.body.position.set(0, 0.46 * width, 1.05 - 1.2 * k);
      this.tailG.position.set(0, 0.17, 1.05 - 2.4 * k + 0.12);
      this.headP.scale.setScalar(c.head * a.headSize);
      this.headHeight = 0.78 + 0.46 * (width - 1);
      this.headP.position.y = this.headHeight;
      this.flipL.position.x = 0.66 * width; this.flipR.position.x = -0.66 * width;
      if (this.wornId.neck && (force || old.headSize !== a.headSize || old.bodyWidth !== width || old.bodyLength !== a.bodyLength)) {
        const id = this.wornId.neck; this.wornId.neck = null; this.setWear('neck', id);
      }
      this.backA.position.set(0, 1.062 * width, 1.05 - 1.44 * k); this.backA.scale.setScalar((0.5 + 0.5 * k) * width);
      this.eyes.forEach((e, i) => {
        const yaw = (i ? 1 : -1) * 0.42 * a.eyeSpacing;
        aim(e.g, yaw, 0.07); e.g.position.copy(onHead(yaw, 0.07, 0.93));
        e.g.scale.setScalar(c.eye * a.eyeSize);
      });
      this.baseScale = this.isPup ? 0.4 : c.scale;
      this.shadow.scale.set(2.3 * width, 1.2 + 2.2 * k, 1);
      this.applyScale();
    }
    releaseAppearance() {
      if (!this.appearanceMats) return;
      Object.values(this.appearanceMats).forEach((m) => { if (m.map) U.releaseTex(m.map); m.dispose(); });
      this.appearanceMats = null;
    }
    dispose() {
      this.releaseAppearance();
      this.ownedGeometry.forEach((g) => g.dispose()); this.ownedMaterial.forEach((m) => m.dispose());
      Object.values(this.worn).forEach((o) => { if (o) o.traverse((m) => { if (m.geometry) m.geometry.dispose(); }); });
      if (this.blanket) this.blanket.traverse((m) => { if (m.geometry) m.geometry.dispose(); if (m.material) m.material.dispose(); });
    }
    applyScale() { this.g.scale.setScalar(this.size); }
    makeBlanket() {
      if (this.blanket) {
        const old = this.blanket; old.parent.remove(old);
        old.traverse((m) => { if (m.isMesh) { m.geometry.dispose(); m.material.dispose(); } });
      }
      const b = blanketGeometry(), tex = PN.Props.knitTex();
      const wool = new T.MeshStandardMaterial({ map: tex, roughness: 1, side: T.DoubleSide });
      const m = new T.Mesh(b.g, wool), cuff = new T.Mesh(b.cuff, new T.MeshStandardMaterial({ color: 0xb8322b, roughness: 1 }));
      m.add(cuff); m.castShadow = true; m.receiveShadow = true; cuff.castShadow = true; m.visible = false;
      this.body.add(m);
      this.blanket = m;
    }
    get size() { return this.baseScale * this.grow * this.appearance.size; }

    setWear(slot, id) {
      if (this.wornId[slot] === id) return;
      if (this.worn[slot]) {
        const old = this.worn[slot]; old.parent.remove(old);
        old.traverse((m) => { if (m.isMesh) m.geometry.dispose(); });
      }
      this.worn[slot] = null; this.wornId[slot] = id;
      if (!id) return;
      const source = PN.Props.wear(id);
      const o = U.shadows(slot === 'neck' ? fitNeckwear(source, this.stage, id, this.appearance) : source, true, false);
      (slot === 'neck' ? this.neckA : slot === 'back' ? this.backA : this.headP).add(o);
      this.worn[slot] = o;
    }
    setDirt(k) { this.dirtMat.opacity = U.clamp(k, 0, 1) * 0.5; }
    setMood(m) { this.mood = m; }

    /* Play a little move: happy, chomp, boop, shake, no, yawn, hop, clap, wave, sad, surprise, gulp, wiggle, sneeze. */
    gesture(name, force) {
      const dur = { happy: 1.3, chomp: 1.0, boop: 0.45, shake: 0.9, no: 0.9, yawn: 1.8, hop: 0.6, clap: 1.2, wave: 1.4, sad: 2.0,
        surprise: 0.7, gulp: 0.5, wiggle: 1.0, sneeze: 0.7, nod: 0.7, bleh: 0.9 }[name] || 1;
      if (this.gest && !force && this.gest.name !== 'boop') { if (this.gestQ.length < 2) this.gestQ.push(name); return; }
      this.gest = { name, t: 0, dur };
    }

    /* Galumph to a spot. Resolves when it gets there. */
    moveTo(x, z, opts) {
      if (this.move) this.move.done(false);          // a new trip cancels the old one
      return new Promise((resolve) => {
        this.move = { x, z, speed: (opts && opts.speed) || 1.5, face: opts && opts.face, done: resolve, ph: 0 };
      });
    }
    halt() { if (this.move) { const m = this.move; this.move = null; m.done(false); } }
    place(x, y, z, heading) {
      this.g.position.set(x, y, z);
      if (heading != null) { this.heading = heading; this.g.rotation.y = heading; }
    }
    worldOf(anchor, out) { return anchor.getWorldPosition(out); }

    update(dt, t, groundY) {
      const p = this.p, c = COAT[this.stage];
      const asleep = this.asleep, mood = this.mood;
      let yaw = 0, pitch = 0, roll = 0, bPitch = 0, bRoll = 0, lift = 0, sq = 1;
      let eye = 1, eyeMode = 0, mouth = 0, frown = 0, fl = 0, fr = 0, tail = 0, drop = 0, blush = 0.38, wide = 1;

      // breathing
      const br = Math.sin(t * (asleep ? 1.15 : 2.2) + this.seed);
      sq += br * (asleep ? 0.03 : 0.014);

      // moving about
      if (this.move) {
        const mv = this.move, dx = mv.x - this.g.position.x, dz = mv.z - this.g.position.z, d = Math.hypot(dx, dz);
        if (d < 0.06) {
          this.move = null;
          if (mv.face != null) this.heading = mv.face;
          mv.done(true);
        } else {
          this.heading = Math.atan2(dx, dz);
          mv.ph += dt * 9;
          const push = 0.5 + 0.5 * Math.max(0, Math.sin(mv.ph));
          const stepLen = Math.min(d, mv.speed * push * dt * this.size / 0.8 + 0.2 * dt);
          this.g.position.x += dx / d * stepLen; this.g.position.z += dz / d * stepLen;
          bPitch += Math.sin(mv.ph) * 0.13; sq += Math.sin(mv.ph + 1.2) * 0.07; lift += Math.max(0, Math.sin(mv.ph)) * 0.06;
          fl += Math.sin(mv.ph) * 0.5; fr += Math.sin(mv.ph) * 0.5; tail += Math.sin(mv.ph + 2) * 0.5;
        }
      }
      if (groundY && !this.freeY) this.g.position.y = U.damp(this.g.position.y, groundY(this.g.position.x, this.g.position.z), 12, dt);
      // turn toward the heading the short way round
      let dh = this.heading - this.g.rotation.y;
      dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      this.g.rotation.y += dh * Math.min(1, dt * (this.move ? 7 : 4));

      // where to look
      if (this.look && !asleep) {
        const hp = this.headP.getWorldPosition(Seal.v1), lx = this.look.x - hp.x, ly = this.look.y - hp.y, lz = this.look.z - hp.z;
        const a = Math.atan2(lx, lz) - this.g.rotation.y;
        yaw += U.clamp(Math.atan2(Math.sin(a), Math.cos(a)), -0.85, 0.85);
        pitch += U.clamp(Math.atan2(ly, Math.hypot(lx, lz)), -0.3, 0.75);
      } else if (!asleep) {
        this.idleT -= dt;
        if (this.idleT <= 0) {
          this.idleT = 1.6 + Math.random() * 3.5;
          this.idleYaw = (Math.random() - 0.5) * 0.9; this.idleRoll = Math.random() < 0.4 ? (Math.random() - 0.5) * 0.5 : 0;
        }
        yaw += this.idleYaw; roll += this.idleRoll;
      }

      // how it feels
      if (asleep) {
        eye = 0; eyeMode = 2; sq -= 0.08; pitch -= 0.3; drop = 0.12; roll = 0.16; fl = -0.3; fr = -0.3; blush = 0.3;
      } else if (this.scared) {
        // anxious: wide eyes, hunched small, trembling, glancing about
        eye = 1; wide = 1.22; frown = 0.7; mouth = 0.12 + 0.06 * Math.sin(t * 17); sq -= 0.05; pitch -= 0.16; drop = 0.05; blush = 0.15;
        bRoll += Math.sin(t * 31) * 0.016; roll += Math.sin(t * 27) * 0.02; fl += 0.35; fr += 0.35;
        yaw = Math.sin(t * 1.3) > 0.55 ? 0.5 : Math.sin(t * 1.3) < -0.55 ? -0.5 : yaw * 0.3;
      } else if (this.sulk) {
        eye = 0; eyeMode = 2; pitch += 0.22; yaw = -0.55; frown = 1; blush = 0.2;
        this.peekT -= dt;
        if (this.peekT <= 0) { this.peekT = 3.5 + Math.random() * 4; this.peek = 0.9; }
        if (this.peek > 0) { this.peek -= dt; yaw = 0.75; eye = 0.7; eyeMode = 0; pitch = 0.05; }
      } else if (mood === 'sick') {
        eye = 0.55; frown = 0.8; pitch -= 0.18; drop = 0.05; bRoll += Math.sin(t * 23) * 0.012; blush = 0.75;
      } else if (mood === 'hungry') {
        frown = 0.5; mouth = 0.25 + 0.25 * Math.max(0, Math.sin(t * 2.4)); pitch += 0.08; blush = 0.3;
      } else if (mood === 'tired') {
        eye = 0.5; pitch -= 0.12; drop = 0.04;
      } else if (mood === 'sad' || mood === 'dirty') {
        eye = 0.8; frown = 0.9; pitch -= 0.14;
      } else if (mood === 'happy') {
        tail += Math.sin(t * 5) * 0.35; blush = 0.55; bRoll += Math.sin(t * 2.2) * 0.02;
      }

      // being stroked or washed
      if (this.petting > 0 && !asleep) {
        this.petting -= dt;
        if (!this.sulk) { eye = 0; eyeMode = 1; blush = 0.75; pitch += 0.18; roll += Math.sin(t * 4) * 0.12; sq += Math.sin(t * 9) * 0.02; tail += Math.sin(t * 9) * 0.5; }
        else { blush = 0.4; }
      }
      if (this.washing) { eye = 0; eyeMode = 1; roll += Math.sin(t * 6) * 0.1; bRoll += Math.sin(t * 7) * 0.04; fl += 0.4 + Math.sin(t * 8) * 0.3; fr += 0.4 + Math.cos(t * 8) * 0.3; }

      // one-off moves
      if (this.gest) {
        const G = this.gest; G.t += dt;
        const k = Math.min(1, G.t / G.dur), bell = Math.sin(k * Math.PI);
        switch (G.name) {
          case 'happy': lift += Math.abs(Math.sin(k * Math.PI * 3)) * 0.24 * (1 - k * 0.5); eye = 0; eyeMode = 1; mouth = 0.6 * bell;
            fl += Math.sin(k * 40) * 0.7; fr += Math.sin(k * 40) * 0.7; tail += Math.sin(k * 34) * 0.7; blush = 0.75; sq += Math.sin(k * Math.PI * 6) * 0.06; break;
          case 'chomp': mouth = Math.abs(Math.sin(k * Math.PI * 3)) * 0.9; pitch += Math.sin(k * Math.PI * 3) * 0.08 + 0.05; eye = 0; eyeMode = 1; sq += Math.sin(k * Math.PI * 6) * 0.03; break;
          case 'gulp': mouth = k < 0.5 ? 1 : 1 - (k - 0.5) * 2; pitch += 0.3 * bell; eye = 0; eyeMode = 1; sq += 0.08 * bell; break;
          case 'boop': sq -= 0.13 * Math.sin(k * Math.PI) * (1 - k); eye = k < 0.5 ? 0.2 : 1; break;
          case 'shake': roll += Math.sin(k * 50) * 0.3 * bell; bRoll += Math.sin(k * 50 + 1) * 0.12 * bell; eye = 0; eyeMode = 1; fl += 0.5 * bell; fr += 0.5 * bell; break;
          case 'no': yaw += Math.sin(k * Math.PI * 5) * 0.5 * bell; eye = 0; eyeMode = 2; frown = 1; break;
          case 'nod': pitch += Math.sin(k * Math.PI * 4) * 0.22 * bell; break;
          case 'yawn': mouth = Math.pow(bell, 0.6); eye = 1 - bell; eyeMode = bell > 0.5 ? 2 : 0; pitch += 0.35 * bell; sq += 0.05 * bell; break;
          case 'hop': lift += bell * 0.3; sq += Math.sin(k * TAU) * 0.08; fl += bell * 0.6; fr += bell * 0.6; break;
          case 'clap': { const cl = Math.abs(Math.sin(k * Math.PI * 4)); fl += 0.9; fr += 0.9; this.clap = cl; eye = 0; eyeMode = 1; mouth = 0.4; bPitch -= 0.2 * bell; break; }
          case 'wave': fl += 1.3 * Math.min(1, bell * 2); this.wave = Math.sin(k * 30) * 0.5; mouth = 0.3; roll += 0.15 * bell; break;
          case 'sad': pitch -= 0.3 * bell; frown = 1; eye = 0.6; drop = 0.08 * bell; break;
          case 'surprise': wide = 1 + 0.25 * bell; lift += bell * 0.12; mouth = 0.5 * bell; sq += 0.07 * bell; break;
          case 'wiggle': bRoll += Math.sin(k * 30) * 0.12 * bell; roll += Math.sin(k * 30 + 1) * 0.15 * bell; tail += Math.sin(k * 40) * 0.8; eye = 0; eyeMode = 1; break;
          case 'sneeze': pitch += k < 0.5 ? 0.35 * (k * 2) : -0.45 * Math.sin((k - 0.5) * TAU); eye = k > 0.45 ? 0 : 1; eyeMode = 2; mouth = k > 0.5 ? 0.6 * (1 - k) * 2 : 0; sq += k > 0.5 ? -0.1 * Math.sin((k - 0.5) * TAU) : 0.04; break;
          case 'bleh': mouth = 0.8 * bell; frown = 1; eye = 0; eyeMode = 2; yaw += Math.sin(k * 30) * 0.2 * bell; break;
          default: break;
        }
        if (G.name !== 'clap') this.clap = 0;
        if (G.name !== 'wave') this.wave = 0;
        if (k >= 1) { this.gest = null; this.clap = 0; this.wave = 0; if (this.gestQ.length) this.gesture(this.gestQ.shift(), true); }
      }

      // blinking
      this.blinkT -= dt;
      if (this.blinkT <= 0) { this.blinkT = 1.8 + Math.random() * 4; this.blink = 0.14; }
      if (this.blink > 0) { this.blink -= dt; if (eyeMode === 0) eye = Math.min(eye, 0.05); }

      // ease everything toward its target
      const e = (key, target, rate) => { p[key] = U.damp(p[key], target, rate, dt); };
      e('yaw', yaw, 7); e('pitch', pitch, 7); e('roll', roll, 6); e('bPitch', bPitch, 14); e('bRoll', bRoll, 14); e('lift', lift, 22);
      e('eye', eye, 26); e('mouth', mouth, 20); e('frown', frown, 6); e('fl', fl, 14); e('fr', fr, 14); e('tail', tail, 14); e('drop', drop, 4); e('blush', blush, 4);
      // squash has a little bounce of its own
      this.sqVel += (sq - this.sqv) * 180 * dt; this.sqVel *= Math.exp(-13 * dt); this.sqv += this.sqVel * dt;
      const s = U.clamp(this.sqv, 0.7, 1.35), w = 1 / Math.sqrt(s);

      this.sq.scale.set(w, s, w);
      this.sq.position.y = p.lift;
      this.sq.rotation.set(-p.bPitch, 0, p.bRoll);
      this.headP.rotation.set(-p.pitch, p.yaw, p.roll);
      // A collar supports the chin: do not sink the sleeping head through it.
      this.headP.position.y = this.headHeight - (this.worn.neck ? p.drop * 0.1 : p.drop);
      this.shadow.material.opacity = 0.55 * U.clamp(1 - p.lift * 1.6, 0.25, 1);

      this.eyes.forEach((E) => {
        const open = p.eye;
        E.ball.visible = E.pupil.visible = open > 0.12;
        E.pupil.scale.set(wide, Math.max(0.12, open) * 1.1 * wide, 0.18);
        E.ball.scale.set(wide, Math.max(0.12, open) * 1.1 * wide, 0.62);
        E.h1.visible = E.h2.visible = open > 0.45;
        E.star.visible = this.starEyes && E.h1.visible; if (E.star.visible) E.h1.visible = false;
        E.arc.visible = open <= 0.12;
        E.arc.rotation.z = eyeMode === 1 ? 0 : Math.PI;
        E.arc.position.y = eyeMode === 1 ? -0.03 : 0.03;
      });
      this.mouth.scale.y = U.lerp(1, -1, p.frown) || 0.001;
      this.maw.visible = p.mouth > 0.06;
      this.maw.scale.set(1.15 * (0.7 + p.mouth * 0.5), Math.max(0.1, p.mouth * 1.5), 0.6);
      const poorly = mood === 'sick' && !asleep;
      this.blushMat.opacity = poorly ? p.blush : Math.max(p.blush, this.rosy);
      this.blushMat.color.setHex(poorly ? 0x9fd6b0 : 0xff8fa8);
      this.tear.visible = (mood === 'sad' || (this.isPup && mood === 'hungry')) && !asleep;
      if (this.tear.visible) this.tear.position.y = onHead(0.5, -0.12, 1.02).y - ((t * 0.25 + this.seed) % 1) * 0.16;

      const clap = this.clap || 0, wave = this.wave || 0;
      // Keep clapping flippers on the chest side of the scarf.
      this.flipL.position.z = this.flipR.position.z = 0.36 - (this.worn.neck ? 0.34 * clap : 0);
      this.flipL.rotation.set(0.28 - p.fl * 0.8, 0.95 - clap * 1.5, 0.12 + p.fl * 0.5 + wave);
      this.flipR.rotation.set(0.28 - p.fr * 0.8, -0.95 + clap * 1.5, -0.12 - p.fr * 0.5);
      this.tailG.rotation.set(p.tail * 0.5 - 0.05, Math.sin(t * 1.3 + this.seed) * 0.06, 0);
      this.muzzle.scale.setScalar(1 + (this.gest && this.gest.name === 'chomp' ? 0.03 * Math.sin(t * 30) : 0.012 * Math.sin(t * 3.1 + this.seed)));
      // tucked up under her blanket while she sleeps: it settles down over her, and is folded away when she wakes
      const tuck = asleep && this.cosy ? 1 : 0;
      if (tuck && !this.blanket) this.makeBlanket();
      if (this.blanket) {
        this.blanketK += (tuck - this.blanketK) * Math.min(1, dt * 4);
        const k = this.blanketK;
        this.blanket.visible = k > 0.03;
        this.blanket.position.y = 0.45 * (1 - k) * (1 - k);
        this.blanket.scale.set(1 + 0.12 * (1 - k), 1 + 0.12 * (1 - k), 1);
        // Put back accessories aside for sleep; restore them when she wakes.
        this.backA.visible = !asleep && k < 0.5;
      } else {
        this.backA.visible = !asleep;
      }
    }
  }
  Seal.v1 = new T.Vector3();
  /* A small picture of a special marking for the clinic's buttons. */
  const icons = {};
  Seal.stampIcon = function (kind) {
    if (icons[kind]) return icons[kind];
    const col = [126, 104, 160];
    let c;
    if (kind === 'aurora' || kind === 'constellation') {
      c = document.createElement('canvas'); c.width = c.height = 96;
      const g = c.getContext('2d');
      if (kind === 'aurora') {
        [[30, [95, 205, 165]], [50, [150, 120, 225]], [70, [95, 205, 165]]].forEach(([y, hue]) => {
          g.strokeStyle = css(hue); g.lineWidth = 8; g.lineCap = 'round'; g.beginPath();
          for (let x = 10; x <= 86; x += 2) g[x === 10 ? 'moveTo' : 'lineTo'](x, y + Math.sin(x / 9 + y) * 7);
          g.stroke();
        });
      } else {
        const pts = [[14, 30], [32, 22], [50, 30], [62, 46], [80, 40], [84, 66], [58, 70]];
        g.strokeStyle = css(col, 0.6); g.lineWidth = 2.5; g.setLineDash([5, 4]); g.beginPath(); pts.forEach(([x, y], i) => g[i ? 'lineTo' : 'moveTo'](x, y)); g.lineTo(62, 46); g.stroke();
        g.setLineDash([]); g.fillStyle = css(col);
        pts.forEach(([x, y], i) => { g.save(); g.translate(x, y); g.scale(i % 3 ? 6 : 9, i % 3 ? 6 : 9); star(g, 5, 1, 0.45); g.fill(); g.restore(); });
      }
    } else c = stampCanvas(kind, col);
    return (icons[kind] = c.toDataURL());
  };
  Seal.COAT = COAT;
  PN.Seal = Seal;
})(window.PN = window.PN || {});
