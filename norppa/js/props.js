/* Pikku Norppa: small helpers and every little 3D object in the game.
   Fish, food, things to wear, things for the shore, finds from the lake bottom.
   Everything is built from simple shapes, so there are no model files to load. */
(function (PN) {
  'use strict';
  const T = THREE;
  const TAU = Math.PI * 2;

  /* ---------- helpers ---------- */
  const U = PN.U = {};
  U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
  U.smooth = (a, b, x) => { const t = U.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  U.hex = (n) => '#' + ('000000' + (n >>> 0).toString(16)).slice(-6);
  U.rng = (seed) => () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };

  const mats = {};
  U.mat = (color, o) => {
    const key = color + '|' + (o ? JSON.stringify(o) : '');
    if (!mats[key]) mats[key] = new T.MeshStandardMaterial(Object.assign({ color, roughness: 0.9, metalness: 0 }, o));
    return mats[key];
  };
  U.glow = (color, o) => {
    const key = 'g' + color + '|' + (o ? JSON.stringify(o) : '');
    if (!mats[key]) mats[key] = new T.MeshBasicMaterial(Object.assign({ color, toneMapped: false }, o));
    return mats[key];
  };
  U.tex = (w, h, draw) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  };
  U.mesh = (geo, material, x, y, z) => { const m = new T.Mesh(geo, material); m.position.set(x || 0, y || 0, z || 0); return m; };
  U.ball = (r, material, x, y, z, sx, sy, sz, seg) => {
    const m = U.mesh(new T.SphereGeometry(r, seg || 16, Math.max(8, Math.round((seg || 16) * 0.7))), material, x, y, z);
    if (sx) m.scale.set(sx, sy || sx, sz || sx);
    return m;
  };
  U.cyl = (rt, rb, h, material, x, y, z, seg) => U.mesh(new T.CylinderGeometry(rt, rb, h, seg || 12), material, x, y, z);
  U.box = (w, h, d, material, x, y, z) => U.mesh(new T.BoxGeometry(w, h, d), material, x, y, z);
  U.cone = (r, h, material, x, y, z, seg) => U.mesh(new T.ConeGeometry(r, h, seg || 12), material, x, y, z);
  U.torus = (r, tube, material, x, y, z, arc, seg) => U.mesh(new T.TorusGeometry(r, tube, 8, seg || 24, arc || TAU), material, x, y, z);
  U.group = function () { const g = new T.Group(); for (let i = 0; i < arguments.length; i++) if (arguments[i]) g.add(arguments[i]); return g; };
  U.rot = (o, x, y, z) => { o.rotation.set(x || 0, y || 0, z || 0); return o; };
  U.shadows = (obj, cast, receive) => {
    obj.traverse((o) => { if (o.isMesh) { o.castShadow = cast !== false; o.receiveShadow = !!receive; } });
    return obj;
  };
  /* A soft round glow that always faces the camera. */
  let glowTex = null;
  U.halo = (color, size, opacity) => {
    if (!glowTex) glowTex = U.tex(64, 64, (g) => {
      const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,0.55)');
      r.addColorStop(0.6, 'rgba(255,255,255,0.14)'); r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r; g.fillRect(0, 0, 64, 64);
    });
    const s = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color, transparent: true, opacity: opacity == null ? 1 : opacity,
      depthWrite: false, blending: T.AdditiveBlending, toneMapped: false, fog: false }));
    s.scale.setScalar(size);
    return s;
  };

  const C = PN.COL = {
    wood: 0x7a5236, woodDark: 0x4d3323, woodLight: 0xb98a5a, coal: 0x24262b, snow: 0xf6f9ff,
    red: 0xd8382f, falu: 0x9c2f26, blue: 0x2f63c9, yellow: 0xf0b429, green: 0x3f8f5a, cream: 0xf7f1e3,
    gold: 0xf5c542, spruce: 0x2e5a4c, pink: 0xf59ab5, stone: 0x8f98a3, warm: 0xffc46b,
  };
  const gold = () => U.mat(C.gold, { metalness: 0.35, roughness: 0.3, emissive: 0x6a4a08, emissiveIntensity: 0.55 });
  const UPV = new T.Vector3(0, 1, 0);
  /* A thin rod from one point to another. */
  U.rod = (a, b, r, material, seg) => {
    const va = new T.Vector3(a[0], a[1], a[2]), vb = new T.Vector3(b[0], b[1], b[2]), d = vb.clone().sub(va);
    const m = U.mesh(new T.CylinderGeometry(r, r, d.length(), seg || 6), material);
    m.position.copy(va).addScaledVector(d, 0.5);
    m.quaternion.setFromUnitVectors(UPV, d.normalize());
    return m;
  };
  /* Sit something on the seal's head at a point, with its up pointing straight out of the head. */
  function stick(o, x, y, z, lift) {
    const n = new T.Vector3(x / 0.382, y / 0.318, z / 0.339).normalize();
    o.position.set(x, y, z).addScaledVector(n, lift || 0);
    o.quaternion.setFromUnitVectors(UPV, n);
    return o;
  }
  /* A flat heart outline to cut shapes from. k: size. */
  function heartShape(k, Kind) {
    const s = new (Kind || T.Shape)();
    s.moveTo(0, -0.42 * k);
    s.bezierCurveTo(-0.62 * k, 0.02 * k, -0.5 * k, 0.52 * k, -0.2 * k, 0.52 * k);
    s.bezierCurveTo(-0.06 * k, 0.52 * k, 0, 0.42 * k, 0, 0.3 * k);
    s.bezierCurveTo(0, 0.42 * k, 0.06 * k, 0.52 * k, 0.2 * k, 0.52 * k);
    s.bezierCurveTo(0.5 * k, 0.52 * k, 0.62 * k, 0.02 * k, 0, -0.42 * k);
    return s;
  }
  /* A little flame: soft teardrops one inside another. Returns the group and a flicker to call every frame. */
  const teardrop = (r, h) => new T.LatheGeometry([[0, 0], [0.62, 0.04], [1, 0.22], [0.9, 0.42], [0.55, 0.7], [0.22, 0.9], [0, 1]].map((q) => new T.Vector2(q[0] * r, q[1] * h)), 10);
  function makeFlame(k) {
    const g = new T.Group(), parts = [];
    [[0xff7a1a, 0.075, 0.24, 0.85], [0xffb02e, 0.052, 0.17, 0.95], [0xffe27a, 0.03, 0.1, 1]].forEach((f, i) => {
      const m = U.mesh(teardrop(f[1] * k, f[2] * k), new T.MeshBasicMaterial({ color: f[0], toneMapped: false, transparent: true, opacity: f[3], depthWrite: false }));
      m.renderOrder = 2 + i; g.add(m); parts.push(m);
    });
    return { g, tick(t, ph) {
      const p = ph || 0, kk = 1 + 0.16 * Math.sin(t * 12 + p) + 0.08 * Math.sin(t * 19.3 + p * 2);
      parts.forEach((m, i) => { m.scale.set(1 + 0.08 * Math.sin(t * 8 + p + i), kk, 1); m.rotation.z = 0.1 * Math.sin(t * 5.7 + p + i); });
    } };
  }
  const P = PN.Props = {};
  /* A box with soft, rounded edges (a superellipsoid): folded cloth, cushions. e near 1 is a ball, near 0 a box. */
  function softBox(w, h, d, e) {
    const g = new T.SphereGeometry(1, 28, 18), p = g.attributes.position;
    const f = (v) => Math.sign(v) * Math.pow(Math.abs(v), e);
    for (let i = 0; i < p.count; i++) p.setXYZ(i, f(p.getX(i)) * w / 2, f(p.getY(i)) * h / 2, f(p.getZ(i)) * d / 2);
    g.computeVertexNormals();
    return g;
  }
  /* A cushion: square from above with soft corners, plump in the middle and thin at the edges. */
  function cushionGeo(w, h, d) {
    const g = new T.SphereGeometry(1, 28, 18), p = g.attributes.position;
    const f = (v, e) => Math.sign(v) * Math.pow(Math.abs(v), e);
    for (let i = 0; i < p.count; i++) {
      const x = f(p.getX(i), 0.38), z = f(p.getZ(i), 0.38), edge = Math.max(Math.abs(x), Math.abs(z));
      p.setXYZ(i, x * w / 2, p.getY(i) * h / 2 * (1 - 0.55 * edge * edge), z * d / 2);
    }
    g.computeVertexNormals();
    return g;
  }
  /* Knitted wool: cream, red bands, a row of little hearts, blue diamonds and the V of the stitches. Shared by the folded
     blanket at the den door and the one she sleeps under. */
  let knitTex = null;
  P.knitTex = function () {
    if (knitTex) return knitTex;
    knitTex = U.tex(256, 256, (c, w, h) => {
      c.fillStyle = '#f3e9d6'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#b8322b'; [[0, 24], [30, 6], [220, 6], [232, 24]].forEach((b) => c.fillRect(0, b[0], w, b[1]));
      for (let x = 16; x < w; x += 32) {
        c.beginPath(); c.moveTo(x, 138); c.bezierCurveTo(x - 2, 135, x - 11, 130, x - 11, 124); c.bezierCurveTo(x - 11, 117, x - 3, 115, x, 121);
        c.bezierCurveTo(x + 3, 115, x + 11, 117, x + 11, 124); c.bezierCurveTo(x + 11, 130, x + 2, 135, x, 138); c.fill();
      }
      c.fillStyle = '#2f5d8c';
      for (let x = 8; x < w; x += 16) [70, 186].forEach((y) => { c.beginPath(); c.moveTo(x, y - 6); c.lineTo(x + 6, y); c.lineTo(x, y + 6); c.lineTo(x - 6, y); c.fill(); });
      c.globalAlpha = 0.16; c.strokeStyle = '#5a3a2a'; c.lineWidth = 1;
      for (let y = 0; y < h; y += 6) for (let x = 0; x < w; x += 6) { c.beginPath(); c.moveTo(x, y); c.lineTo(x + 3, y + 5); c.lineTo(x + 6, y); c.stroke(); }
      c.globalAlpha = 1;
    });
    knitTex.wrapS = knitTex.wrapT = T.RepeatWrapping;
    return knitTex;
  };

  /* ---------- fish ---------- */
  function fishTexture(look) {
    const r = U.rng((look.back ^ look.belly) | 0);
    return U.tex(128, 64, (g, w, h) => {
      const grad = g.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, U.hex(look.back)); grad.addColorStop(0.4, U.hex(look.back));
      grad.addColorStop(0.62, U.hex(look.belly)); grad.addColorStop(1, U.hex(look.belly));
      g.fillStyle = grad; g.fillRect(0, 0, w, h);
      g.fillStyle = U.hex(look.mark || 0);
      if (look.pattern === 'stripes') {
        g.globalAlpha = 0.7;
        [0.1, 0.18, 0.26, 0.34, 0.42].forEach((u) => [u, 1 - u].forEach((uu) => {
          g.beginPath(); g.ellipse(uu * w, h * 0.2, w * 0.016, h * 0.3, 0, 0, TAU); g.fill();
        }));
      } else if (look.pattern === 'spots' || look.pattern === 'marble') {
        g.globalAlpha = 0.8;
        const n = look.pattern === 'marble' ? 46 : 34, big = look.pattern === 'marble' ? 4.2 : 2.2;
        for (let i = 0; i < n; i++) {
          g.beginPath(); g.ellipse(r() * w, (0.06 + r() * 0.52) * h, 1 + r() * big, 1 + r() * big * 0.7, r() * 3, 0, TAU); g.fill();
        }
      }
    });
  }

  function finShape(pts) {
    const s = new T.Shape();
    s.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
    s.closePath();
    return new T.ShapeGeometry(s);
  }

  /* A fish lying along x, nose to +x. look comes from the FISH table. */
  P.fish = function (look) {
    const b = look.tall, c = b * 0.55, snout = look.snout || 1;
    const geo = new T.SphereGeometry(1, 22, 14);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const f = x < 0 ? 1 - 0.6 * Math.pow(-x, 1.6) : 1 - 0.28 * x * x;
      pos.setXYZ(i, x * (x > 0 ? snout : 1), y * b * f, z * c * f);
    }
    geo.computeVertexNormals();
    const isGold = look.pattern === 'gold';
    const body = new T.Mesh(geo, new T.MeshStandardMaterial({ map: fishTexture(look), roughness: 0.42,
      emissive: isGold ? 0xb07a10 : 0x000000, emissiveIntensity: isGold ? 0.7 : 0 }));
    const finMat = new T.MeshStandardMaterial({ color: look.fin, roughness: 0.6, side: T.DoubleSide,
      emissive: isGold ? 0xb07a10 : 0x000000, emissiveIntensity: isGold ? 0.5 : 0 });
    const tail = U.mesh(finShape([[0, 0], [-0.52, 0.44], [-0.36, 0], [-0.52, -0.44]]), finMat, -0.9, 0, 0);
    tail.scale.set(1, b / 0.34, 1);
    const d = look.dorsal || 1;
    const dorsal = U.mesh(finShape([[0.3, 0], [-0.02, 0.2 * d], [-0.36, 0.02]]), finMat, 0, b * 0.9, 0);
    const belly = U.mesh(finShape([[0.05, 0], [-0.2, -0.16], [-0.25, 0]]), finMat, -0.1, -b * 0.88, 0);
    const g = U.group(body, tail, dorsal, belly);
    [-1, 1].forEach((s) => {
      const side = U.mesh(finShape([[0, 0], [-0.26, -0.1], [-0.2, 0.06]]), finMat, 0.28 * snout, -b * 0.3, s * c * 0.86);
      side.rotation.y = s * 0.5;
      g.add(side);
      g.add(U.ball(0.075, U.mat(0xffffff, { roughness: 0.3 }), 0.62 * snout, b * 0.2, s * c * 0.66));
      g.add(U.ball(0.045, U.mat(look.eye || 0x16181c, { roughness: 0.2 }), 0.64 * snout, b * 0.2, s * (c * 0.66 + 0.045)));
    });
    g.scale.setScalar(0.3 * look.len);
    g.userData.len = 0.6 * look.len;
    return g;
  };

  /* ---------- shop food ---------- */
  const food = {
    katkarapu() {
      const pink = U.mat(0xff8f7a, { roughness: 0.5 });
      const g = U.group(U.rot(U.torus(0.15, 0.065, pink, 0, 0, 0, 4.3, 18), 0, 0, 0.3));
      for (let i = 0; i < 5; i++) {
        const a = 0.5 + i * 0.85;
        g.add(U.rot(U.torus(0.066, 0.012, U.mat(0xf06a55, { roughness: 0.5 }), Math.cos(a) * 0.15, Math.sin(a) * 0.15, 0, TAU, 12), 0, Math.PI / 2, a));
      }
      const tail = U.cone(0.07, 0.12, U.mat(0xf06a55), Math.cos(4.75) * 0.17, Math.sin(4.75) * 0.17, 0, 6);
      tail.scale.z = 0.35; tail.rotation.z = 2.4;
      g.add(tail, U.ball(0.018, U.mat(C.coal), 0.2, 0.08, 0.04), U.ball(0.018, U.mat(C.coal), 0.2, 0.08, -0.04));
      return g;
    },
    kalakukko() {
      const crust = U.mat(0x6b4226, { roughness: 0.85 });
      const g = U.group(U.ball(0.3, crust, 0, 0.17, 0, 1, 0.58, 0.8, 20));
      g.add(U.ball(0.2, U.mat(0x8a5a36, { roughness: 0.9 }), 0, 0.26, 0, 1.1, 0.4, 0.8));
      [-0.1, 0.02, 0.14].forEach((x) => g.add(U.rot(U.box(0.02, 0.01, 0.2, U.mat(0x4a2c18), x, 0.345, 0), 0, 0.5, 0)));
      return g;
    },
    lohikeitto() {
      const bowl = U.mesh(new T.SphereGeometry(0.28, 24, 12, 0, TAU, Math.PI / 2, Math.PI / 2), U.mat(0x3d6fb5, { roughness: 0.35, side: T.DoubleSide }), 0, 0.28, 0);
      bowl.scale.y = 0.8;
      const soup = U.rot(U.mesh(new T.CircleGeometry(0.265, 24), U.mat(0xf6e3b4, { roughness: 0.4 }), 0, 0.26, 0), -Math.PI / 2);
      const g = U.group(bowl, soup, U.torus(0.28, 0.018, U.mat(0xf2f5fa, { roughness: 0.3 }), 0, 0.28, 0));
      g.children[2].rotation.x = Math.PI / 2;
      [[0.08, 0.05], [-0.1, 0.02], [0.0, -0.11], [-0.05, 0.13]].forEach((p, i) => {
        g.add(U.rot(U.box(0.075, 0.05, 0.075, U.mat(0xff9478, { roughness: 0.5 }), p[0], 0.275, p[1]), 0, i, 0));
      });
      [[0.14, -0.06], [-0.13, -0.08], [0.03, 0.04], [0.1, 0.13]].forEach((p) => g.add(U.ball(0.022, U.mat(0x5fa052), p[0], 0.285, p[1])));
      return g;
    },
    /* A tall can of fizzy energy drink, with its own made-up label. A parody: a seal, not a sports brand. */
    sealsius() {
      // The label wraps all the way round the can, so only the middle third of the picture faces you. Keep the art there.
      const tex = U.tex(900, 512, (c, w, h) => {
        const cx = w / 2;
        c.fillStyle = '#f6f7f9'; c.fillRect(0, 0, w, h);
        const body = c.createLinearGradient(0, 0, w, 0);
        body.addColorStop(0, 'rgba(0,0,0,.16)'); body.addColorStop(0.2, 'rgba(255,255,255,.3)'); body.addColorStop(0.5, 'rgba(255,255,255,0.25)'); body.addColorStop(0.8, 'rgba(255,255,255,.1)'); body.addColorStop(1, 'rgba(0,0,0,.18)');
        c.fillStyle = body; c.fillRect(0, 0, w, h);
        c.textAlign = 'center';
        c.fillStyle = '#7e8590'; c.font = '600 18px sans-serif'; c.fillText('ENERGY DRINK', cx, 50);
        // a swirl in the warm gradient, with a seal's whisker dots
        const sw = c.createLinearGradient(cx - 60, 70, cx + 60, 200);
        sw.addColorStop(0, '#f7c531'); sw.addColorStop(1, '#ef5a3c');
        c.strokeStyle = sw; c.lineWidth = 22; c.lineCap = 'round';
        c.beginPath(); c.arc(cx, 132, 46, -0.3 * Math.PI, 1.6 * Math.PI, true); c.stroke();
        c.fillStyle = '#2a2d33';
        [0, 14, 28].forEach((d) => { c.beginPath(); c.arc(cx + 10 + d, 136, 4.2, 0, 7); c.fill(); });
        c.fillStyle = '#16181c'; c.font = '800 40px sans-serif'; c.fillText('SEALSIUS', cx, 250);
        c.fillStyle = '#ef5a3c'; c.font = '700 20px sans-serif'; c.fillText('LIVE FLIPPER', cx, 282);
        c.fillStyle = '#f08a1c'; c.beginPath(); c.arc(cx - 52, 330, 24, 0, 7); c.fill();
        c.fillStyle = '#3f8f3a'; c.beginPath(); c.ellipse(cx - 40, 304, 12, 6, -0.6, 0, 7); c.fill();
        c.fillStyle = '#ffd34a'; c.beginPath(); c.moveTo(cx - 6, 336); c.arc(cx + 18, 330, 24, 0.3, 3.4); c.closePath(); c.fill();
        c.fillStyle = '#16181c'; c.fillRect(0, 370, w, 96);
        c.fillStyle = '#ef5a3c'; c.fillRect(cx - 128, 370, 16, 96);
        c.textAlign = 'left';
        c.font = '700 16px sans-serif'; c.fillStyle = '#ef5a3c'; c.fillText('SPARKLING CLOUDBERRY', cx - 100, 360);
        c.fillStyle = '#ffffff'; c.font = '700 17px sans-serif';
        ['ZERO SUGAR', '7 VITAMINS', 'EXTRA SQUEAKY'].forEach((t, i) => c.fillText('\u25B8 ' + t, cx - 100, 398 + i * 25));
        const base = c.createLinearGradient(0, 466, 0, h);
        base.addColorStop(0, '#d5d9df'); base.addColorStop(1, '#8b929c');
        c.fillStyle = base; c.fillRect(0, 466, w, h - 466);
        c.textAlign = 'center'; c.fillStyle = '#16181c'; c.font = '700 14px sans-serif'; c.fillText('VERY HIGH SQUEAK CONTENT', cx, 494);
      });
      const can = U.mesh(new T.CylinderGeometry(0.115, 0.115, 0.44, 28), new T.MeshStandardMaterial({ map: tex, roughness: 0.35, metalness: 0.25 }), 0, 0.22, 0);
      can.rotation.y = Math.PI + 0.35;
      const metal = U.mat(0xb9bfc7, { roughness: 0.25, metalness: 0.7 });
      const g = U.group(can, U.cyl(0.108, 0.115, 0.03, U.mat(0x1d1f24, { roughness: 0.4, metalness: 0.5 }), 0, 0.455, 0, 28),
        U.cyl(0.092, 0.092, 0.014, metal, 0, 0.475, 0, 24));
      g.add(U.rot(U.torus(0.03, 0.007, metal, 0, 0.5, 0, TAU, 14), Math.PI / 2, 0, 0));
      return g;
    },
    lakkamehu() {
      const glass = new T.MeshStandardMaterial({ color: 0xffb02e, roughness: 0.12, transparent: true, opacity: 0.86,
        emissive: 0xc46a00, emissiveIntensity: 0.45 });
      const g = U.group(U.cyl(0.12, 0.13, 0.3, glass, 0, 0.15, 0, 18), U.cyl(0.05, 0.11, 0.1, glass, 0, 0.35, 0, 18),
        U.cyl(0.05, 0.05, 0.08, glass, 0, 0.44, 0, 14), U.cyl(0.058, 0.058, 0.05, U.mat(0xb98a5a), 0, 0.5, 0, 12));
      g.add(U.cyl(0.133, 0.133, 0.13, U.mat(0xfff6dc, { roughness: 0.7 }), 0, 0.16, 0, 18));
      [[0, 0.02], [0.03, -0.02], [-0.03, -0.02]].forEach((p) => g.add(U.ball(0.026, U.mat(0xf08a1c), p[0], 0.17 + p[1], 0.128)));
      return g;
    },
  };

  /* ---------- the ball ---------- */
  P.ball = function () {
    const tex = U.tex(256, 128, (g, w, h) => {
      const cols = ['#e2463c', '#ffffff', '#2f7fd6', '#ffffff', '#f6c231', '#ffffff'];
      for (let i = 0; i < 6; i++) { g.fillStyle = cols[i]; g.fillRect(i * w / 6, 0, w / 6 + 1, h); }
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h * 0.09); g.fillRect(0, h * 0.91, w, h * 0.09);
    });
    return new T.Mesh(new T.SphereGeometry(0.24, 28, 20), new T.MeshStandardMaterial({ map: tex, roughness: 0.35 }));
  };

  /* ---------- poo ---------- */
  P.poop = function () {
    const m = U.mat(0x7a5233, { roughness: 0.75 });
    const g = U.group(U.ball(0.17, m, 0, 0.09, 0, 1, 0.62, 1), U.ball(0.125, m, 0.01, 0.2, 0, 1, 0.66, 1),
      U.ball(0.078, m, 0, 0.29, 0.01, 1, 0.8, 1), U.cone(0.035, 0.07, m, 0.012, 0.36, 0, 8));
    return g;
  };

  /* ---------- things to wear ----------
     Head and face items are built around the centre of the seal's head (a ball about
     0.6 across each way). Neck items are built around the collar ring. */
  function knitTexture(main, trim) {
    return U.tex(128, 64, (g, w, h) => {
      g.fillStyle = U.hex(main); g.fillRect(0, 0, w, h);
      g.fillStyle = U.hex(trim);
      g.fillRect(0, h * 0.58, w, 3); g.fillRect(0, h * 0.9, w, 3);
      for (let i = 0; i < 16; i++) {                     // a row of little knitted diamonds
        const x = (i + 0.5) * w / 16, y = h * 0.76;
        g.beginPath(); g.moveTo(x, y - 6); g.lineTo(x + 3.2, y); g.lineTo(x, y + 6); g.lineTo(x - 3.2, y); g.fill();
      }
      g.globalAlpha = 0.12; g.fillStyle = '#000';
      for (let x = 0; x < w; x += 4) g.fillRect(x, 0, 1, h);   // ribbing
    });
  }
  function pipo(main, trim) {
    const dome = U.mesh(new T.SphereGeometry(0.43, 24, 12, 0, TAU, 0, Math.PI / 2),
      new T.MeshStandardMaterial({ map: knitTexture(main, trim), roughness: 1 }), 0, 0.38, 0);
    dome.scale.y = 0.72;
    const brim = U.rot(U.torus(0.435, 0.07, U.mat(trim, { roughness: 1 }), 0, 0.39, 0, TAU, 28), Math.PI / 2);
    const pom = U.ball(0.115, U.mat(trim, { roughness: 1 }), 0, 0.74, 0);
    return U.rot(U.group(dome, brim, pom), -0.1, 0, 0.1);
  }
  const wear = {
    pipo_red: () => pipo(C.red, C.cream),
    pipo_blue: () => pipo(C.blue, C.cream),
    pipo_yellow: () => pipo(C.yellow, 0x2f4a8a),
    pipo_pink: () => pipo(0xf48fb1, C.cream),
    pipo_green: () => pipo(0x3f8f5a, C.cream),
    karvalakki() {
      const fur = U.mat(0x7a5a3c, { roughness: 1 }), dark = U.mat(0x5a4029, { roughness: 1 });
      const dome = U.mesh(new T.SphereGeometry(0.47, 24, 12, 0, TAU, 0, Math.PI / 2), fur, 0, 0.33, 0);
      dome.scale.y = 0.75;
      const g = U.group(dome, U.rot(U.torus(0.47, 0.085, dark, 0, 0.35, 0, TAU, 28), Math.PI / 2),
        U.ball(0.2, dark, 0, 0.5, 0.37, 1.25, 0.8, 0.45),                                                      // front flap, turned up
        U.ball(0.2, dark, 0.6, 0.08, 0, 0.5, 1.3, 0.95), U.ball(0.2, dark, -0.6, 0.08, 0, 0.5, 1.3, 0.95));    // ear flaps, down
      return U.rot(g, -0.08, 0, 0);
    },
    juhlahattu() {
      const tex = U.tex(64, 64, (c, w, h) => {
        c.fillStyle = '#ffd23f'; c.fillRect(0, 0, w, h); c.fillStyle = '#e2334f';
        for (let i = -3; i < 8; i++) { c.beginPath(); c.moveTo(i * 16, 0); c.lineTo(i * 16 + 8, 0); c.lineTo(i * 16 + 40, h); c.lineTo(i * 16 + 32, h); c.fill(); }
      });
      const blue = U.mat(0x4f8fe6, { roughness: 0.9 });
      const g = U.group(U.mesh(new T.ConeGeometry(0.21, 0.52, 20), new T.MeshStandardMaterial({ map: tex, roughness: 0.6 }), 0, 0.26, 0),
        U.ball(0.065, blue, 0, 0.54, 0), U.rot(U.torus(0.205, 0.024, blue, 0, 0.015, 0, TAU, 20), Math.PI / 2));
      g.position.set(-0.1, 0.5, 0.03); g.rotation.set(-0.05, 0, 0.22);
      return U.group(g);
    },
    baskeri() {
      const felt = U.mat(0xb8263a, { roughness: 1 });
      const g = U.group(U.ball(0.44, felt, 0, 0, 0, 1, 0.3, 1, 24), U.rot(U.torus(0.3, 0.05, U.mat(0x8f1c2c, { roughness: 1 }), 0, -0.08, 0, TAU, 24), Math.PI / 2),
        U.cyl(0.018, 0.018, 0.09, felt, 0, 0.15, 0, 6));
      g.position.set(0.08, 0.56, 0); g.rotation.set(-0.12, 0, -0.32);
      return U.group(g);
    },
    olkihattu() {
      const straw = U.mat(0xe3c27a, { roughness: 1 });
      const g = U.group(U.cyl(0.66, 0.68, 0.03, straw, 0, 0.42, 0, 32), U.cyl(0.35, 0.4, 0.2, straw, 0, 0.53, 0, 24), U.ball(0.35, straw, 0, 0.63, 0, 1, 0.22, 1, 24),
        U.cyl(0.405, 0.41, 0.07, U.mat(0xd8382f, { roughness: 0.8 }), 0, 0.475, 0, 24));
      return U.rot(g, -0.16, 0, 0.06);
    },
    kokinhattu() {
      const w = U.mat(0xffffff, { roughness: 0.9 }), g = new T.Group();
      g.add(U.cyl(0.3, 0.3, 0.26, w, 0, 0.58, 0, 24), U.ball(0.3, w, 0, 0.84, 0, 1.1, 0.7, 1.1, 20));
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; g.add(U.ball(0.17, w, Math.cos(a) * 0.24, 0.8, Math.sin(a) * 0.24, 1, 0.9, 1, 14)); }
      return U.rot(g, -0.08, 0, -0.08);
    },
    yolakki() {
      const white = U.mat(0xfafafa, { roughness: 0.85 }), black = U.mat(0x15171c, { roughness: 0.35 });
      const peak = U.mesh(new T.CylinderGeometry(0.33, 0.33, 0.025, 24, 1, false, -1.0, 2.0), black, 0, 0.435, 0.2);
      peak.rotation.x = 0.22;
      const g = U.group(U.ball(0.45, white, 0, 0.6, 0, 1, 0.3, 1, 24), U.cyl(0.375, 0.385, 0.12, black, 0, 0.48, 0, 24), peak, U.ball(0.04, gold(), 0, 0.49, 0.39));
      return U.rot(g, -0.1, 0, 0.05);
    },
    silinteri() {
      const black = U.mat(0x1b1d24, { roughness: 0.45 });
      const g = U.group(U.cyl(0.25, 0.23, 0.44, black, 0, 0.26, 0, 24), U.cyl(0.42, 0.42, 0.03, black, 0, 0.03, 0, 28),
        U.cyl(0.236, 0.232, 0.08, U.mat(0xc22a3a, { roughness: 0.6 }), 0, 0.09, 0, 24));
      g.position.set(0.05, 0.5, 0); g.rotation.set(-0.1, 0, -0.14);
      return U.group(g);
    },
    velho() {
      const blue = U.mat(0x3b4cc0, { roughness: 0.9 }), star = new T.MeshStandardMaterial({ color: 0xffe07a, emissive: 0xffc93a, emissiveIntensity: 0.7, roughness: 0.4 });
      const tip = U.mesh(new T.ConeGeometry(0.135, 0.42, 16), blue, 0.12, 1.09, 0);
      tip.rotation.z = -0.6;
      const g = U.group(U.cyl(0.56, 0.58, 0.03, blue, 0, 0.44, 0, 28), U.mesh(new T.CylinderGeometry(0.13, 0.36, 0.5, 20), blue, 0, 0.69, 0), tip,
        U.rot(U.torus(0.365, 0.022, star, 0, 0.465, 0, TAU, 24), Math.PI / 2));
      [[0.4, 0.6], [2.3, 0.78], [4.1, 0.62], [5.4, 0.84], [1.3, 0.86]].forEach((q) => {
        const rad = 0.36 - (q[1] - 0.44) / 0.5 * 0.23 + 0.01;
        g.add(U.ball(0.04, star, Math.cos(q[0]) * rad, q[1], Math.sin(q[0]) * rad, 1, 1, 1, 8));
      });
      return U.rot(g, -0.1, 0, 0.04);
    },
    viikinki() {
      const iron = U.mat(0xa9b3bf, { roughness: 0.3, metalness: 0.25 }), band = U.mat(0x7c8794, { roughness: 0.35, metalness: 0.25 }), horn = U.mat(0xf3ead3, { roughness: 0.6 });
      const dome = U.mesh(new T.SphereGeometry(0.46, 24, 12, 0, TAU, 0, Math.PI / 2), iron, 0, 0.32, 0);
      dome.scale.y = 0.78;
      const g = U.group(dome, U.rot(U.torus(0.462, 0.045, band, 0, 0.33, 0, TAU, 28), Math.PI / 2), U.rot(U.torus(0.36, 0.03, band, 0, 0.32, 0, Math.PI, 20), 0, Math.PI / 2, 0));
      [-1, 1].forEach((s) => {
        const h = new T.Group(), low = new T.CylinderGeometry(0.062, 0.1, 0.24, 12), top = new T.ConeGeometry(0.063, 0.27, 12);
        low.translate(0, 0.12, 0); top.translate(0, 0.135, 0);
        const tipM = new T.Mesh(top, horn);
        tipM.position.y = 0.23; tipM.rotation.z = s * 0.7;
        h.add(new T.Mesh(low, horn), tipM);
        h.position.set(s * 0.4, 0.5, 0); h.rotation.z = -s * 1.05;
        g.add(h);
      });
      return U.rot(g, -0.08, 0, 0);
    },
    kukka() {
      const f = new T.Group(), white = U.mat(0xffffff, { roughness: 0.8 });
      for (let i = 0; i < 9; i++) {
        const a = i / 9 * TAU, p = U.ball(0.07, white, Math.cos(a) * 0.105, 0.02, Math.sin(a) * 0.105, 1.35, 0.3, 0.62, 10);
        p.rotation.y = -a; f.add(p);
      }
      f.add(U.ball(0.065, U.mat(0xf5b81e, { roughness: 0.9 }), 0, 0.035, 0, 1, 0.6, 1, 12), U.ball(0.06, U.mat(0x5fae5a), 0.15, 0, 0.12, 1.5, 0.3, 0.8, 8));
      f.scale.setScalar(1.4);
      return U.group(stick(f, -0.3, 0.47, 0.2, 0.02));
    },
    kissa() {
      const dark = U.mat(0x2b2b33, { roughness: 1 }), pink = U.mat(0xf59ab5, { roughness: 0.9 });
      const g = U.group(U.torus(0.615, 0.026, dark, 0, 0, 0, Math.PI, 26));
      [-1, 1].forEach((s) => {
        const e = U.group(U.rot(U.mesh(new T.ConeGeometry(0.15, 0.27, 4), dark, 0, 0.135, 0), 0, Math.PI / 4, 0), U.rot(U.mesh(new T.ConeGeometry(0.09, 0.17, 4), pink, 0, 0.105, 0.06), 0, Math.PI / 4, 0));
        e.scale.z = 0.55;
        g.add(stick(e, s * 0.33, 0.48, 0, -0.03));
      });
      return g;
    },
    pupu() {
      const white = U.mat(0xffffff, { roughness: 1 }), pink = U.mat(0xf7a8c0, { roughness: 0.9 });
      const g = U.group(U.torus(0.615, 0.026, white, 0, 0, 0, Math.PI, 26));
      [-1, 1].forEach((s) => {
        const e = U.group(U.ball(0.1, white, 0, 0.3, 0, 1, 3.1, 0.55, 14), U.ball(0.1, pink, 0, 0.3, 0.035, 0.55, 2.5, 0.35, 12));
        e.position.set(s * 0.21, 0.5, 0); e.rotation.set(-0.06, 0, s > 0 ? -0.36 : 0.12);
        g.add(e);
      });
      return g;
    },
    sarvet() {
      const m = U.mat(0x8a6a48, { roughness: 0.9 }), g = U.group(U.torus(0.615, 0.022, U.mat(0x5a4029), 0, 0, 0, Math.PI, 26));
      const limb = (r0, r1, len) => { const geo = new T.CylinderGeometry(r1, r0, len, 7); geo.translate(0, len / 2, 0); return new T.Mesh(geo, m); };
      [-1, 1].forEach((s) => {
        const a = new T.Group(), t1 = limb(0.028, 0.012, 0.2), t2 = limb(0.026, 0.012, 0.2), t3 = limb(0.022, 0.01, 0.16);
        t1.position.y = 0.16; t1.rotation.x = 0.95;                      // a tine pointing forward
        t2.position.y = 0.3; t2.rotation.z = s * 0.95;                   // one pointing in
        t3.position.y = 0.44; t3.rotation.set(-0.5, 0, -s * 0.6);
        a.add(limb(0.042, 0.026, 0.46), t1, t2, t3, U.ball(0.026, m, 0, 0.46, 0));
        a.position.set(s * 0.2, 0.5, 0); a.rotation.z = -s * 0.5;
        g.add(a);
      });
      return g;
    },
    kuulokkeet() {
      const shell = U.mat(0x2bb3a3, { roughness: 0.4 }), dark = U.mat(0x23262d, { roughness: 0.6 });
      const g = U.group(U.torus(0.63, 0.035, dark, 0, 0, 0, Math.PI, 26));
      [-1, 1].forEach((s) => {
        g.add(U.rot(U.cyl(0.19, 0.19, 0.09, shell, s * 0.67, -0.02, 0, 20), 0, 0, Math.PI / 2), U.rot(U.cyl(0.16, 0.16, 0.06, dark, s * 0.615, -0.02, 0, 20), 0, 0, Math.PI / 2),
          U.ball(0.06, U.mat(0xffffff, { roughness: 0.4 }), s * 0.715, -0.02, 0, 0.3, 1, 1, 10));
      });
      return g;
    },
    sieni() {
      const tex = U.tex(128, 64, (c, w, h) => {
        c.fillStyle = '#d8322a'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff';
        const r = U.rng(5);
        for (let i = 0; i < 16; i++) { c.beginPath(); c.ellipse(r() * w, 8 + r() * (h - 20), 5 + r() * 4, 4 + r() * 3, 0, 0, TAU); c.fill(); }
      });
      const cap = U.mesh(new T.SphereGeometry(0.56, 28, 12, 0, TAU, 0, Math.PI / 2), new T.MeshStandardMaterial({ map: tex, roughness: 0.6 }), 0, 0.3, 0);
      cap.scale.y = 0.66;
      return U.rot(U.group(cap, U.rot(U.torus(0.52, 0.045, U.mat(0xfff6e6, { roughness: 0.9 }), 0, 0.3, 0, TAU, 28), Math.PI / 2)), -0.1, 0, 0.06);
    },
    sadekeha() {
      const ring = U.rot(U.torus(0.3, 0.036, new T.MeshStandardMaterial({ color: 0xffe07a, emissive: 0xffc93a, emissiveIntensity: 0.9, roughness: 0.3 }), 0, 0.9, 0, TAU, 32), Math.PI / 2);
      const glow = U.halo(0xffd86b, 0.9, 0.35);
      glow.position.y = 0.9;
      return U.rot(U.group(ring, glow), -0.12, 0, 0.08);
    },
    bow() {
      const m = U.mat(0xe2334f, { roughness: 0.7 });
      const g = U.group(U.ball(0.15, m, -0.14, 0, 0, 1, 0.72, 0.45), U.ball(0.15, m, 0.14, 0, 0, 1, 0.72, 0.45),
        U.ball(0.06, U.mat(0xb8203a, { roughness: 0.7 }), 0, 0, 0.02));
      g.position.set(0.27, 0.5, 0.16); g.rotation.set(-0.3, 0.25, -0.45);
      return U.group(g);
    },
    earmuffs() {
      const fluff = U.mat(0xffb3c8, { roughness: 1 });
      return U.group(U.torus(0.615, 0.028, U.mat(0x5a3a4a), 0, 0, 0, Math.PI, 26),
        U.ball(0.18, fluff, 0.62, 0, 0, 0.6, 1, 1), U.ball(0.18, fluff, -0.62, 0, 0, 0.6, 1, 1));
    },
    tonttu() {
      const red = U.mat(0xcf2b2b, { roughness: 1 }), white = U.mat(0xffffff, { roughness: 1 });
      const cone = U.cone(0.43, 0.62, red, 0, 0.68, 0, 24);
      const tip = U.rot(U.cone(0.17, 0.42, red, 0.2, 1.02, 0, 16), 0, 0, -1.25);
      const g = U.group(cone, tip, U.rot(U.torus(0.44, 0.085, white, 0, 0.4, 0, TAU, 28), Math.PI / 2), U.ball(0.1, white, 0.44, 0.97, 0));
      return U.rot(g, -0.08, 0, -0.06);
    },
    wreath() {
      const g = U.group(U.rot(U.torus(0.45, 0.032, U.mat(0x4f9a52), 0, 0.38, 0, TAU, 28), Math.PI / 2));
      const cols = [0xffffff, 0xffd84a, 0xf48fb1, 0x7fb6ff, 0xffffff, 0xff9d5c, 0xd6a7ff, 0xffd84a, 0xf48fb1];
      cols.forEach((col, i) => {
        const a = i / cols.length * TAU, x = Math.cos(a) * 0.46, z = Math.sin(a) * 0.46;
        g.add(U.ball(0.075, U.mat(col, { roughness: 0.8 }), x, 0.4, z, 1, 0.75, 1));
        g.add(U.ball(0.03, U.mat(0xf2b01e), x * 1.1, 0.42, z * 1.1));
        const a2 = a + 0.35;
        g.add(U.ball(0.05, U.mat(0x5fae5a), Math.cos(a2) * 0.46, 0.37, Math.sin(a2) * 0.46, 1.3, 0.4, 0.8));
      });
      return U.rot(g, -0.1, 0, 0);
    },
    crown() {
      const au = gold();
      const g = U.group(U.mesh(new T.CylinderGeometry(0.17, 0.145, 0.11, 16, 1, true), au, 0, 0, 0));
      g.children[0].material = new T.MeshStandardMaterial({ color: C.gold, metalness: 0.35, roughness: 0.3, emissive: 0x6a4a08, emissiveIntensity: 0.55, side: T.DoubleSide });
      for (let i = 0; i < 5; i++) {
        const a = i / 5 * TAU;
        g.add(U.cone(0.042, 0.1, au, Math.cos(a) * 0.158, 0.1, Math.sin(a) * 0.158, 8));
        g.add(U.ball(0.024, U.mat(i % 2 ? 0x3f7fe0 : 0xe23b4a, { roughness: 0.2, emissive: i % 2 ? 0x10306a : 0x6a0a14, emissiveIntensity: 0.6 }), Math.cos(a) * 0.165, 0, Math.sin(a) * 0.165));
      }
      g.position.set(0.06, 0.6, 0.04);
      return U.rot(U.group(g), -0.1, 0, -0.12);
    },
    scarf_red: () => scarf(0xd8382f, 0xf7f1e3),
    scarf_green: () => scarf(0x2f8f5f, 0x2f8f5f),
    scarf_blue: () => scarf(0x1f4fb0, 0xffffff),
    scarf_rainbow: () => scarf(0xe2334f, 0x4f8fe6, [0xe2334f, 0xf28c28, 0xf5d042, 0x3fa85a, 0x4f8fe6, 0x8a5ad6]),
    huivi() {
      const red = U.mat(0xd8382f, { roughness: 1 }), tri = new T.Shape();
      tri.moveTo(-0.22, 0); tri.lineTo(0.22, 0); tri.lineTo(0, -0.36); tri.closePath();
      const flap = U.mesh(new T.ExtrudeGeometry(tri, { depth: 0.03, bevelEnabled: false }), red, 0, 0, -0.015);
      const hang = U.group(flap, U.ball(0.028, U.mat(0xffffff), -0.07, -0.08, 0.02, 1, 1, 0.5), U.ball(0.028, U.mat(0xffffff), 0.07, -0.08, 0.02, 1, 1, 0.5), U.ball(0.028, U.mat(0xffffff), 0, -0.2, 0.02, 1, 1, 0.5));
      hang.position.set(0.5, -0.33, 0.17); hang.rotation.set(0.1, 0, 0.22);
      return U.group(new T.Mesh(new T.TorusGeometry(0.622, 0.075, 10, 36), red), hang);
    },
    solmuke() {
      const red = U.mat(0xc22a3a, { roughness: 0.7 });
      const bow = U.group(U.ball(0.13, red, -0.12, 0, 0, 1, 0.72, 0.45), U.ball(0.13, red, 0.12, 0, 0, 1, 0.72, 0.45), U.ball(0.055, U.mat(0x8f1c2c, { roughness: 0.7 }), 0, 0, 0.02));
      bow.position.set(0.5, -0.42, 0.18); bow.rotation.set(0.1, 0, 0.22);
      return U.group(new T.Mesh(new T.TorusGeometry(0.62, 0.04, 8, 36), U.mat(0x1b1d24, { roughness: 0.6 })), bow);
    },
    solmio() {
      const blue = U.mat(0x2f63c9, { roughness: 0.7 }), blade = new T.Shape();
      blade.moveTo(-0.045, 0); blade.lineTo(0.045, 0); blade.lineTo(0.085, -0.3); blade.lineTo(0, -0.4); blade.lineTo(-0.085, -0.3); blade.closePath();
      const tie = U.group(U.mesh(new T.ExtrudeGeometry(blade, { depth: 0.025, bevelEnabled: false }), blue, 0, -0.03, -0.012), U.ball(0.06, blue, 0, 0, 0, 1, 0.85, 0.6),
        U.rot(U.box(0.2, 0.03, 0.03, U.mat(0xf5c542), 0, -0.2, 0.012), 0, 0, 0.5));
      tie.position.set(0.5, -0.37, 0.18); tie.rotation.set(0.1, 0, 0.22);
      return U.group(new T.Mesh(new T.TorusGeometry(0.62, 0.05, 8, 36), U.mat(0xffffff, { roughness: 0.8 })), tie);
    },
    kukkakaulus() {
      const g = U.group(new T.Mesh(new T.TorusGeometry(0.622, 0.03, 6, 36), U.mat(0x4f9a52)));
      const cols = [0xf48fb1, 0xffd84a, 0xffffff, 0xff9d5c, 0xd6a7ff];
      for (let i = 0; i < 22; i++) {
        const a = i / 22 * TAU, x = Math.cos(a) * 0.63, y = Math.sin(a) * 0.63;
        g.add(U.ball(0.085, U.mat(cols[i % 5], { roughness: 0.8 }), x, y, (i % 2) * 0.03, 1, 1, 0.8, 10), U.ball(0.03, U.mat(0xf2b01e), x * 1.05, y * 1.05, 0.07));
      }
      return g;
    },
    helmet() {
      const pearl = U.mat(0xfff8ef, { roughness: 0.18 }), g = new T.Group();
      for (let i = 0; i < 38; i++) { const a = i / 38 * TAU; g.add(U.ball(0.05, pearl, Math.cos(a) * 0.63, Math.sin(a) * 0.63, 0, 1, 1, 1, 10)); }
      return g;
    },
    mitali() {
      const medal = U.group(U.rot(U.cyl(0.115, 0.115, 0.03, gold(), 0, -0.2, 0, 20), Math.PI / 2), U.rot(U.cyl(0.07, 0.07, 0.04, U.mat(0xffe59a, { roughness: 0.3, emissive: 0x6a4a08, emissiveIntensity: 0.5 }), 0, -0.2, 0, 16), Math.PI / 2),
        U.box(0.09, 0.14, 0.02, U.mat(0x1f4fb0, { roughness: 0.8 }), 0, -0.05, 0));
      medal.position.set(0.5, -0.36, 0.18); medal.rotation.set(0.1, 0, 0.22);
      return U.group(new T.Mesh(new T.TorusGeometry(0.62, 0.045, 8, 36), U.mat(0x1f4fb0, { roughness: 0.8 })), medal);
    },
    bell() {
      const g = U.group(U.torus(0.615, 0.04, U.mat(0xc22a2a, { roughness: 0.8 }), 0, 0, 0, TAU, 32));
      const b = U.group(U.ball(0.115, gold(), 0, 0, 0), U.torus(0.03, 0.012, gold(), 0, 0.12, 0, TAU, 10),
        U.box(0.13, 0.02, 0.03, U.mat(0x5a3d08), 0, -0.06, 0.1));
      b.position.set(0.5, -0.4, 0.13);
      g.add(b);
      return g;
    },
    glasses: () => specs(false),
    shades: () => specs(true),
    punanena() {
      return U.group(U.ball(0.088, U.mat(0xe5262e, { roughness: 0.2, emissive: 0x7a0a10, emissiveIntensity: 0.5 }), 0, -0.075, 0.63, 1, 1, 1, 16), U.ball(0.022, U.glow(0xffffff), -0.03, -0.04, 0.7));
    },
    viikset() {
      const m = U.mat(0x5a3a22, { roughness: 0.9 }), g = new T.Group();
      [-1, 1].forEach((s) => {
        g.add(U.rot(U.ball(0.095, m, s * 0.115, -0.15, 0.665, 1.5, 0.55, 0.5, 12), 0, s * 0.3, -s * 0.22),
          U.ball(0.05, m, s * 0.25, -0.115, 0.61, 1, 1, 0.6, 10), U.ball(0.03, m, s * 0.285, -0.07, 0.585));
      });
      return g;
    },
    silmalappu() {
      const black = U.mat(0x15171c, { roughness: 0.6 });
      const patch = stick(U.ball(0.15, black, 0, 0, 0, 1, 0.28, 1.05, 16), 0.245, 0.04, 0.52, 0.05);
      const strap = new T.Mesh(new T.TorusGeometry(0.607, 0.018, 6, 40), black);
      strap.rotation.set(Math.PI / 2, 0, 0);
      const tilt = U.group(strap);
      tilt.rotation.z = -0.5; tilt.position.y = 0.16;
      return U.group(patch, tilt);
    },
    sydanlasit() {
      const frame = U.mat(0xe2334f, { roughness: 0.35 }), g = new T.Group();
      const outer = heartShape(0.36);
      outer.holes.push(heartShape(0.28, T.Path));
      const rim = new T.ExtrudeGeometry(outer, { depth: 0.022, bevelEnabled: false, curveSegments: 14 }), lens = new T.ShapeGeometry(heartShape(0.29), 14);
      [-1, 1].forEach((s) => {
        const eye = U.group(U.mesh(rim, frame, 0, 0, -0.011), U.mesh(lens, new T.MeshStandardMaterial({ color: 0xff8fb0, roughness: 0.1, transparent: true, opacity: 0.55, side: T.DoubleSide })));
        eye.position.set(s * 0.235, 0.03, 0.6); eye.rotation.y = s * 0.3;
        g.add(eye);
        g.add(temple(frame, s, 0.1));
      });
      g.add(U.rot(U.cyl(0.014, 0.014, 0.12, frame, 0, 0.1, 0.645, 6), 0, 0, Math.PI / 2));
      return g;
    },
    monokkeli() {
      const au = gold(), g = new T.Group();
      const ring = U.torus(0.165, 0.02, au, 0.235, 0.045, 0.6, TAU, 26);
      ring.rotation.y = 0.3;
      const lens = U.mesh(new T.CircleGeometry(0.16, 24), new T.MeshStandardMaterial({ color: 0xd8ecff, roughness: 0.05, transparent: true, opacity: 0.35 }), 0.235, 0.045, 0.6);
      lens.rotation.y = 0.3;
      g.add(ring, lens);
      for (let i = 0; i <= 9; i++) {                       // the chain, hanging in a curve down to the collar
        const k = i / 9;
        g.add(U.ball(0.016, au, 0.39 + 0.17 * k, -0.02 - 0.42 * k - 0.1 * Math.sin(k * Math.PI), 0.56 - 0.3 * k));
      }
      return g;
    },
    laskettelulasit() {
      const g = new T.Group(), seg = (k, a, p0, p1, m) => {
        const mesh = new T.Mesh(new T.SphereGeometry(1, 24, 8, Math.PI / 2 - a, a * 2, Math.PI / 2 - p1, p1 - p0), m);
        mesh.scale.set(0.618 * k, 0.564 * k, 0.582 * k);
        return mesh;
      };
      g.add(seg(1.045, 0.66, 0.42, 0.78, U.mat(0x23262d, { roughness: 0.6, side: T.DoubleSide })),
        seg(1.07, 0.58, 0.47, 0.73, new T.MeshStandardMaterial({ color: 0xff9a3c, roughness: 0.08, emissive: 0x7a2a00, emissiveIntensity: 0.35, side: T.DoubleSide })));
      const strap = new T.Mesh(new T.TorusGeometry(0.44, 0.035, 6, 36), U.mat(0x2f63c9, { roughness: 0.9 }));
      strap.rotation.x = Math.PI / 2; strap.position.y = 0.35; strap.scale.set(1.06, 1, 1);
      g.add(strap);
      return g;
    },
    /* ---- on the back: built around a point on top of the seal's back, just behind the head; +z is toward the head ---- */
    ilmapallo() {
      const red = U.mat(0xe5334f, { roughness: 0.25 });
      return U.group(U.rod([0, 0, 0], [0.14, 1.32, -0.28], 0.008, U.mat(0xf2f4f7)), U.ball(0.3, red, 0.17, 1.62, -0.34, 1, 1.18, 1, 20),
        U.rot(U.cone(0.05, 0.07, red, 0.14, 1.28, -0.28, 8), 0.2, 0, 0.1), U.ball(0.05, U.glow(0xffffff), 0.07, 1.74, -0.12, 1, 1.4, 0.5), U.ball(0.05, U.mat(0xc22a3a), 0, 0.02, 0, 1, 0.5, 1));
    },
    ankka() {
      const y = U.mat(0xffd23f, { roughness: 0.4 }), o = U.mat(0xf28c28, { roughness: 0.5 }), k = U.mat(0x15171c, { roughness: 0.2 });
      return U.group(U.ball(0.18, y, 0, 0.13, -0.02, 1, 0.82, 1.25, 16), U.ball(0.12, y, 0, 0.32, 0.12, 1, 1, 1, 14), U.ball(0.06, o, 0, 0.3, 0.24, 1.1, 0.45, 1, 10),
        U.ball(0.02, k, 0.055, 0.35, 0.21), U.ball(0.02, k, -0.055, 0.35, 0.21), U.rot(U.cone(0.07, 0.12, y, 0, 0.21, -0.23, 8), -0.9, 0, 0),
        U.ball(0.1, y, 0.15, 0.13, -0.04, 0.35, 0.6, 1), U.ball(0.1, y, -0.15, 0.13, -0.04, 0.35, 0.6, 1));
    },
    reppu() {
      const teal = U.mat(0x2a9d8f, { roughness: 0.8 }), yel = U.mat(0xf5c542, { roughness: 0.8 }), dark = U.mat(0x264653, { roughness: 0.8 });
      const g = U.group(U.ball(0.27, teal, 0, 0.24, -0.1, 1, 0.95, 0.8, 16), U.ball(0.2, yel, 0, 0.36, -0.1, 1.12, 0.5, 0.86, 14), U.ball(0.13, dark, 0, 0.17, -0.3, 1.1, 0.8, 0.5, 12),
        U.box(0.06, 0.05, 0.03, U.mat(0xf2f4f7, { roughness: 0.3 }), 0, 0.3, -0.31), U.rot(U.torus(0.05, 0.016, dark, 0, 0.5, -0.1, Math.PI, 10), 0, Math.PI / 2, 0));
      [-1, 1].forEach((s) => g.add(U.rot(U.torus(0.26, 0.028, dark, s * 0.17, 0.1, 0.02, Math.PI, 14), 0, Math.PI / 2 + s * 0.25, 0)));
      return g;
    },
    viitta() {
      const geo = new T.PlaneGeometry(1.2, 1.5, 8, 10);
      geo.rotateX(-Math.PI / 2);
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x0 = p.getX(i), t = (0.75 - p.getZ(i)) / 1.5;                 // t: 0 at the collar, 1 at the far hem
        const x = x0 * (0.8 + 0.45 * t);
        p.setXYZ(i, x, 0.09 + 0.07 * t + 0.07 * Math.sin(t * 6.2) - 0.5 * x * x * (1 - 0.5 * t) + 0.03 * Math.sin(x0 * 9) * t, 0.32 - t * 1.5);
      }
      geo.computeVertexNormals();
      return U.group(new T.Mesh(geo, new T.MeshStandardMaterial({ color: 0xd8262e, roughness: 0.8, side: T.DoubleSide })),
        U.ball(0.05, gold(), 0.22, 0.09, 0.34), U.ball(0.05, gold(), -0.22, 0.09, 0.34), U.rod([-0.22, 0.09, 0.34], [0.22, 0.09, 0.34], 0.015, gold()));
    },
    dinopiikit() {
      const m = U.mat(0x58b368, { roughness: 0.7 }), g = new T.Group();
      [[0.26, 0.03, 0.1, 0.8], [0, 0, 0, 1.05], [-0.27, -0.07, -0.25, 1], [-0.54, -0.18, -0.4, 0.85], [-0.79, -0.31, -0.5, 0.65]].forEach((q) => {
        const c = U.mesh(new T.ConeGeometry(0.18 * q[3], 0.4 * q[3], 4), m, 0, 0.16 * q[3], 0);
        c.rotation.y = Math.PI / 4; c.scale.x = 0.45;
        const h = U.group(c);
        h.position.set(0, q[1] - 0.02, q[0]); h.rotation.x = q[2];
        g.add(h);
      });
      return g;
    },
    haineva() {
      const fin = new T.Shape();
      fin.moveTo(0.3, 0); fin.quadraticCurveTo(0.12, 0.42, -0.2, 0.66); fin.quadraticCurveTo(-0.08, 0.3, -0.26, 0); fin.closePath();
      const geo = new T.ExtrudeGeometry(fin, { depth: 0.05, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2, curveSegments: 10 });
      geo.translate(0, 0, -0.025);
      const m = U.mesh(geo, U.mat(0x7d8a99, { roughness: 0.5 }), 0, -0.03, -0.05);
      m.rotation.y = -Math.PI / 2;
      return U.group(m);
    },
    perhonen() {
      const g = U.group(U.ball(0.06, U.mat(0x23262d), 0, 0.22, 0, 1, 4, 1, 10));
      const wing = (r, x, y, col) => U.group(U.ball(r * 1.09, U.mat(0x23262d, { roughness: 0.8 }), x, y, 0, 1, 1.12, 0.03, 18), U.ball(r, U.mat(col, { roughness: 0.6 }), x, y, 0, 1, 1.12, 0.08, 18));
      [-1, 1].forEach((s) => {
        const w = U.group(wing(0.36, 0.42, 0.56, 0xf28c28), wing(0.25, 0.32, 0.16, 0xf5c542),
          U.ball(0.035, U.mat(0xffffff), 0.62, 0.78, 0, 1, 1, 1), U.ball(0.028, U.mat(0xffffff), 0.7, 0.62, 0, 1, 1, 1), U.ball(0.05, U.mat(0x23262d), 0.4, 0.6, 0, 1, 1, 0.9));
        w.scale.x = s; w.rotation.y = -s * 0.5;
        g.add(w);
      });
      return g;
    },
    enkeli() {
      const white = U.mat(0xffffff, { roughness: 0.9 }), g = new T.Group();
      [-1, 1].forEach((s) => {
        const w = new T.Group();
        [[1.0, 0.62, 0.34, 0.24], [0.52, 0.56, 0.3, 0.22], [0.08, 0.46, 0.26, 0.2], [-0.3, 0.34, 0.2, 0.16]].forEach((f, i) => {
          const pivot = U.group(U.ball(f[2], white, f[1] * 0.62, 0, -i * 0.012, f[1] / f[2], 0.6, 0.2, 14));
          pivot.rotation.z = f[0];
          w.add(pivot);
        });
        w.position.set(s * 0.08, 0.14, 0); w.scale.x = s; w.rotation.y = -s * 0.45;
        g.add(w);
      });
      return g;
    },
  };
  function scarf(a, b, stripes) {
    const cols = stripes || [a, b];
    const tex = U.tex(cols.length * 8, 8, (g, w, h) => {
      cols.forEach((c, i) => { g.fillStyle = U.hex(c); g.fillRect(i * 8, 0, 8, h); });
    });
    tex.wrapS = T.RepeatWrapping; tex.repeat.set(stripes ? 3 : 8, 1);
    const m = new T.MeshStandardMaterial({ map: tex, roughness: 1 });
    const ring = new T.Mesh(new T.TorusGeometry(0.625, 0.11, 10, 36), m);
    const flat = new T.MeshStandardMaterial({ color: a, roughness: 1 });
    const end = U.rot(U.box(0.2, 0.44, 0.075, flat, 0.56, -0.5, 0.17), 0.1, 0, 0.22);
    const tip = U.rot(U.box(0.2, 0.07, 0.076, new T.MeshStandardMaterial({ color: b, roughness: 1 }), 0.602, -0.69, 0.189), 0.1, 0, 0.22);
    return U.group(ring, end, tip, U.ball(0.125, flat, 0.52, -0.28, 0.15, 1, 0.9, 0.8));
  }
  /* A glasses arm: from the outer edge of the frame, back along the side of the head to the ear, just above the fur. */
  function temple(frame, s, y) {
    const R = [0.618, 0.564, 0.582], pts = [];
    const pitch = Math.asin(y / R[1]);
    for (let i = 0; i <= 8; i++) {
      const yaw = 0.62 + (1.42 - 0.62) * i / 8, k = 1.035;
      pts.push(new T.Vector3(s * Math.sin(yaw) * Math.cos(pitch) * R[0] * k, y, Math.cos(yaw) * Math.cos(pitch) * R[2] * k));
    }
    pts.unshift(new T.Vector3(s * 0.39, y, 0.565));                     // the hinge on the frame
    return new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 24, 0.013, 6, false), frame);
  }
  function specs(dark) {
    const frame = U.mat(dark ? 0x15171c : 0x6b3f2a, { roughness: 0.35 });
    const g = new T.Group();
    [-1, 1].forEach((s) => {
      const ring = U.torus(0.16, 0.019, frame, s * 0.235, 0.045, 0.6, TAU, 26);
      ring.rotation.y = s * 0.3;
      g.add(ring);
      if (dark) {
        const lens = U.mesh(new T.CircleGeometry(0.155, 24), new T.MeshStandardMaterial({ color: 0x0c1220, roughness: 0.08, transparent: true, opacity: 0.88 }), s * 0.235, 0.045, 0.6);
        lens.rotation.y = s * 0.3;
        g.add(lens);
      }
      g.add(temple(frame, s, 0.06));
    });
    g.add(U.rot(U.cyl(0.014, 0.014, 0.14, frame, 0, 0.075, 0.645, 6), 0, 0, Math.PI / 2));
    return g;
  }
  P.wear = (id) => (wear[id] ? wear[id]() : new T.Group());

  /* ---------- things for the shore ----------
     Each returns { g, tick(t, env) }. env.night runs 0 (day) to 1 (dark). */
  function spruce(h, r, snow) {
    const g = new T.Group();
    g.add(U.cyl(r * 0.1, r * 0.14, h * 0.25, U.mat(C.woodDark), 0, h * 0.12, 0, 7));
    for (let i = 0; i < 3; i++) {
      const k = 1 - i * 0.27, y = h * (0.34 + i * 0.24), hh = h * 0.44 * (1 - i * 0.12);
      g.add(U.cone(r * k, hh, U.mat(C.spruce, { roughness: 1 }), 0, y, 0, 10));
      if (snow) g.add(U.cone(r * k * 0.86, hh * 0.72, U.mat(C.snow, { roughness: 1 }), 0, y + hh * 0.17, 0, 10));
    }
    return g;
  }
  P.spruce = spruce;

  const decor = {
    lantern() {
      const iron = U.mat(0x2b2f36, { roughness: 0.5 });
      const glass = new T.MeshBasicMaterial({ color: 0xffd27a, toneMapped: false });
      const stump = U.group(U.ball(0.26, U.mat(C.snow), 0, 0.3, 0, 1, 0.34, 1));   // a pad of snow to stand on
      const lamp = U.group(U.cyl(0.115, 0.125, 0.045, iron, 0, 0.36, 0), U.cyl(0.085, 0.095, 0.21, glass, 0, 0.49, 0),
        U.cone(0.135, 0.1, iron, 0, 0.645, 0), U.rot(U.torus(0.075, 0.012, iron, 0, 0.71, 0, Math.PI, 12), 0, 0, 0));
      [0, 1, 2, 3].forEach((i) => lamp.add(U.cyl(0.01, 0.01, 0.21, iron, Math.cos(i * 1.57 + 0.78) * 0.095, 0.49, Math.sin(i * 1.57 + 0.78) * 0.095, 5)));
      const halo = U.halo(0xffb45a, 1.7, 0.9); halo.position.y = 0.5;
      const g = U.group(stump, lamp, halo);
      return { g, glass, halo, lightAt: new T.Vector3(0, 0.62, 0),
        tick(t, env) {
          const on = env.lamp, f = 0.92 + 0.08 * Math.sin(t * 9) * Math.sin(t * 5.3);
          glass.color.setHex(0xffd27a).multiplyScalar(on ? 0.75 + 0.25 * f : 0.22);
          halo.material.opacity = on * (0.3 + 0.6 * env.night) * f;
        } };
    },
    snowman() {
      const s = U.mat(C.snow, { roughness: 1 }), coal = U.mat(C.coal);
      const g = U.group(U.ball(0.44, s, 0, 0.38, 0, 1, 0.92, 1, 20), U.ball(0.31, s, 0, 0.95, 0, 1, 1, 1, 20), U.ball(0.22, s, 0, 1.38, 0, 1, 1, 1, 20));
      g.add(U.rot(U.cone(0.04, 0.2, U.mat(0xf08a2c), 0, 1.38, 0.3, 8), Math.PI / 2));
      [[-0.08, 1.45], [0.08, 1.45]].forEach((p) => g.add(U.ball(0.027, coal, p[0], p[1], 0.2)));
      [-0.07, -0.025, 0.025, 0.07].forEach((x) => g.add(U.ball(0.016, coal, x, 1.3 + Math.abs(x) * 0.5, 0.205)));
      [0.82, 0.98, 1.12].forEach((y) => g.add(U.ball(0.028, coal, 0, y, 0.305 - Math.abs(y - 0.96) * 0.25)));
      const twig = U.mat(C.woodDark);
      g.add(U.rot(U.cyl(0.016, 0.02, 0.5, twig, 0.46, 1.08, 0, 5), 0, 0, -1.0), U.rot(U.cyl(0.016, 0.02, 0.5, twig, -0.46, 1.12, 0, 5), 0, 0, 0.85));
      g.add(U.rot(U.torus(0.21, 0.05, U.mat(C.red, { roughness: 1 }), 0, 1.2, 0, TAU, 20), Math.PI / 2));
      g.add(U.rot(U.box(0.09, 0.26, 0.04, U.mat(C.red, { roughness: 1 }), 0.14, 1.07, 0.2), 0, 0, -0.15));
      const hat = U.group(U.cyl(0.13, 0.16, 0.2, U.mat(0x36465f, { roughness: 0.6 }), 0, 0.1, 0), U.cyl(0.21, 0.21, 0.02, U.mat(0x36465f, { roughness: 0.6 }), 0, 0, 0));
      hat.position.set(0.02, 1.56, 0); hat.rotation.z = -0.14;
      g.add(hat);
      return { g };
    },
    flag() {
      const tex = U.tex(180, 110, (c, w, h) => {
        c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h);
        c.fillStyle = '#17377f'; c.fillRect(50, 0, 30, h); c.fillRect(0, 40, w, 30);
      });
      const geo = new T.PlaneGeometry(1.05, 0.64, 12, 4);
      geo.translate(0.525, 0, 0);
      const cloth = U.mesh(geo, new T.MeshStandardMaterial({ map: tex, roughness: 0.9, side: T.DoubleSide }), 0.04, 3.05, 0);
      const base = geo.attributes.position.array.slice();
      const g = U.group(U.cyl(0.035, 0.045, 3.5, U.mat(0xf2f4f7, { roughness: 0.5 }), 0, 1.75, 0, 10), U.ball(0.07, gold(), 0, 3.54, 0),
        cloth, U.ball(0.2, U.mat(C.snow), 0, 0.03, 0, 1, 0.4, 1));
      return { g, tick(t, env) {
        const p = geo.attributes.position, w = 0.6 + env.wind * 1.6;
        for (let i = 0; i < p.count; i++) {
          const x = base[i * 3], y = base[i * 3 + 1];
          p.setZ(i, Math.sin(x * 5.2 - t * (2.5 + w * 2)) * 0.09 * x * (0.6 + w * 0.4));
          p.setY(i, y - x * x * 0.1 * (1.2 - Math.min(1, w * 0.7)) + Math.sin(x * 4 - t * 3) * 0.015 * x);
        }
        p.needsUpdate = true; geo.computeVertexNormals();
      } };
    },
    /* A garland of bulbs over the den door. The den hands over the arch to follow. */
    lights(arch) {
      const g = new T.Group(), bulbs = [];
      const cols = [0xffe2a0, 0xff5a4a, 0xffd23f, 0x58d68d, 0x5aa9ff];
      const pts = arch || (() => { const a = []; for (let i = 0; i <= 12; i++) { const k = i / 12 * Math.PI; a.push(new T.Vector3(Math.cos(k) * 0.9, Math.sin(k) * 0.8 + 0.1, 0)); } return a; })();
      const curve = new T.CatmullRomCurve3(pts);
      g.add(new T.Mesh(new T.TubeGeometry(curve, 40, 0.012, 5), U.mat(0x1f2a24)));
      const n = 13;
      for (let i = 0; i < n; i++) {
        const p = curve.getPoint((i + 0.5) / n);
        const m = new T.MeshBasicMaterial({ color: cols[i % cols.length], toneMapped: false });
        const b = U.ball(0.055, m, p.x, p.y - 0.04, p.z, 1, 1.25, 1, 10);
        const h = U.halo(cols[i % cols.length], 0.5, 0.5); h.position.copy(b.position);
        g.add(b, h); bulbs.push({ m, h, c: new T.Color(cols[i % cols.length]), ph: i * 1.7 });
      }
      return { g, tick(t, env) {
        bulbs.forEach((b) => {
          const tw = 0.72 + 0.28 * Math.sin(t * 2.2 + b.ph);
          b.m.color.copy(b.c).multiplyScalar(0.55 + 0.45 * tw);
          b.h.material.opacity = (0.12 + 0.55 * env.night) * tw;
        });
      } };
    },
    sled() {
      const wood = U.mat(C.woodLight, { roughness: 0.7 }), iron = U.mat(0x3a3f47, { roughness: 0.4 });
      const g = new T.Group();
      [-0.22, 0.22].forEach((z) => {
        g.add(U.box(1.7, 0.025, 0.035, iron, -0.15, 0.02, z));
        g.add(U.rot(U.box(0.3, 0.025, 0.035, iron, 0.82, 0.09, z), 0, 0, 0.5));
        g.add(U.box(0.035, 0.9, 0.035, wood, 0.1, 0.47, z), U.box(0.035, 0.4, 0.035, wood, 0.55, 0.22, z));
      });
      g.add(U.box(0.5, 0.035, 0.5, wood, 0.34, 0.42, 0), U.box(0.05, 0.05, 0.62, wood, 0.1, 0.93, 0));
      g.add(U.box(0.04, 0.035, 0.44, wood, 0.1, 0.62, 0));
      return { g };
    },
    campfire() {
      const g = new T.Group(), stone = U.mat(C.stone, { roughness: 1 });
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; g.add(U.ball(0.1, stone, Math.cos(a) * 0.36, 0.05, Math.sin(a) * 0.36, 1.1, 0.7, 0.9, 8)); }
      [0, 1, 2].forEach((i) => g.add(U.rot(U.cyl(0.045, 0.05, 0.55, U.mat(C.woodDark), 0, 0.1, 0, 7), Math.PI / 2 - 0.25, i * 2.1, 0)));
      // flames: soft teardrops one inside another, the hottest in the middle
      const drop = (r, h) => new T.LatheGeometry([[0, 0], [0.62, 0.04], [1, 0.22], [0.9, 0.42], [0.55, 0.7], [0.22, 0.9], [0, 1]].map((q) => new T.Vector2(q[0] * r, q[1] * h)), 12);
      const flames = [];
      [[0xff5a14, 0.2, 0.58, 0, 0, 0.78], [0xff7a1a, 0.1, 0.32, 0.13, 0.05, 0.8], [0xff7a1a, 0.09, 0.27, -0.11, -0.08, 0.8],
        [0xff9d1f, 0.145, 0.45, 0, 0, 0.92], [0xffdc66, 0.09, 0.31, 0, 0, 1]].forEach((f, i) => {
        const m = U.mesh(drop(f[1], f[2]), new T.MeshBasicMaterial({ color: f[0], toneMapped: false, transparent: true, opacity: f[5], depthWrite: false }), f[3], 0.09, f[4]);
        m.renderOrder = 2 + i;
        g.add(m); flames.push({ m, ph: i * 2.3 });
      });
      const halo = U.halo(0xff8a3a, 2.4, 0.8); halo.position.y = 0.4; g.add(halo);
      const stick = U.rot(U.cyl(0.012, 0.012, 0.9, U.mat(C.woodDark), 0.5, 0.33, 0.12, 5), 0, 0, 1.15);
      const sausage = U.rot(U.mesh(new T.CapsuleGeometry(0.035, 0.13, 4, 8), U.mat(0xb5532e, { roughness: 0.5 }), 0.14, 0.5, 0.12), 0, 0, 1.15);
      g.add(stick, sausage);
      return { g, lightAt: new T.Vector3(0, 0.5, 0), flicker: 1,
        tick(t, env) {
          flames.forEach((f) => {
            const k = 1 + 0.18 * Math.sin(t * 11 + f.ph) + 0.1 * Math.sin(t * 17.3 + f.ph * 2);
            f.m.scale.set(1 + 0.1 * Math.sin(t * 7 + f.ph), k, 1 + 0.1 * Math.cos(t * 8 + f.ph));
            f.m.rotation.z = 0.09 * Math.sin(t * 5.3 + f.ph);
            f.m.rotation.x = 0.07 * Math.sin(t * 4.1 + f.ph * 1.7);
          });
          this.flicker = 0.85 + 0.15 * Math.sin(t * 10) * Math.sin(t * 6.1);
          halo.material.opacity = (0.35 + 0.5 * env.night) * this.flicker;
        } };
    },
    iceheart() {
      const s = new T.Shape();
      s.moveTo(0, -0.42);
      s.bezierCurveTo(-0.62, 0.02, -0.5, 0.52, -0.2, 0.52);
      s.bezierCurveTo(-0.06, 0.52, 0, 0.42, 0, 0.3);
      s.bezierCurveTo(0, 0.42, 0.06, 0.52, 0.2, 0.52);
      s.bezierCurveTo(0.5, 0.52, 0.62, 0.02, 0, -0.42);
      const geo = new T.ExtrudeGeometry(s, { depth: 0.16, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 3, curveSegments: 16 });
      geo.translate(0, 0, -0.08);
      const ice = new T.MeshStandardMaterial({ color: 0xc8ecff, roughness: 0.06, transparent: true, opacity: 0.8, emissive: 0x3d7fb5, emissiveIntensity: 0.35 });
      const heart = U.mesh(geo, ice, 0, 0.98, 0);
      const g = U.group(heart, U.box(0.6, 0.5, 0.42, new T.MeshStandardMaterial({ color: 0xdaf2ff, roughness: 0.1, transparent: true, opacity: 0.85, emissive: 0x3d7fb5, emissiveIntensity: 0.2 }), 0, 0.25, 0),
        U.ball(0.5, U.mat(C.snow), 0, 0.02, 0, 1, 0.22, 0.9));
      const halo = U.halo(0x9fd8ff, 1.6, 0.3); halo.position.y = 1; g.add(halo);
      return { g, tick(t, env) { ice.emissiveIntensity = 0.3 + 0.5 * env.night + 0.5 * env.aurora; halo.material.opacity = 0.1 + 0.3 * env.night; } };
    },
    feeder() {
      const wood = U.mat(C.wood), g = new T.Group();
      g.add(U.cyl(0.04, 0.05, 1.3, wood, 0, 0.65, 0, 8), U.box(0.62, 0.04, 0.46, U.mat(C.woodLight), 0, 1.3, 0));
      [-1, 1].forEach((s) => {
        g.add(U.rot(U.box(0.44, 0.03, 0.56, U.mat(C.woodDark), s * 0.17, 1.75, 0), 0, 0, s * -0.6));
        g.add(U.rot(U.box(0.46, 0.07, 0.6, U.mat(C.snow), s * 0.175, 1.8, 0), 0, 0, s * -0.6));
        g.add(U.cyl(0.018, 0.018, 0.36, wood, s * 0.27, 1.5, 0.19, 5), U.cyl(0.018, 0.018, 0.36, wood, s * 0.27, 1.5, -0.19, 5));
      });
      for (let i = 0; i < 9; i++) g.add(U.ball(0.018, U.mat(0xd9b36a), -0.2 + (i % 3) * 0.07 + 0.02 * i, 1.335, -0.1 + Math.floor(i / 3) * 0.08));
      // kuukkeli, the Siberian jay: soft grey-brown with a rusty tail
      const bird = new T.Group(), body = U.mat(0x8c7f74, { roughness: 1 }), rust = U.mat(0xc4683a, { roughness: 1 });
      const head = U.group(U.ball(0.066, U.mat(0x5e534c, { roughness: 1 }), 0, 0, 0), U.rot(U.cone(0.02, 0.06, U.mat(0x2a2522), 0, -0.005, 0.085, 6), Math.PI / 2),
        U.ball(0.012, U.mat(0x0c0c0c, { roughness: 0.2 }), 0.045, 0.015, 0.045), U.ball(0.012, U.mat(0x0c0c0c, { roughness: 0.2 }), -0.045, 0.015, 0.045));
      head.position.set(0, 0.12, 0.07);
      bird.add(U.ball(0.09, body, 0, 0.06, 0, 0.9, 0.95, 1.25), head, U.rot(U.box(0.05, 0.015, 0.17, rust, 0, 0.07, -0.16), 0.35),
        U.ball(0.05, rust, 0.07, 0.07, -0.02, 0.4, 0.8, 1.3), U.ball(0.05, rust, -0.07, 0.07, -0.02, 0.4, 0.8, 1.3),
        U.cyl(0.006, 0.006, 0.06, U.mat(0x2a2522), 0.03, -0.02, 0, 4), U.cyl(0.006, 0.006, 0.06, U.mat(0x2a2522), -0.03, -0.02, 0, 4));
      bird.position.set(0.12, 1.37, 0.05); bird.rotation.y = -0.6;
      g.add(bird);
      return { g, bird, tick(t) {
        const cyc = t % 7;
        const peck = cyc > 4.6 && cyc < 6.2 ? Math.max(0, Math.sin((cyc - 4.6) * 12)) : 0;
        head.rotation.x = peck * 0.9;
        head.rotation.y = cyc < 4.6 ? Math.sin(Math.floor(cyc * 1.1) * 2.4) * 0.7 : 0;
        const hop = cyc > 2 && cyc < 2.3 ? Math.sin((cyc - 2) / 0.3 * Math.PI) : 0;
        bird.position.y = 1.37 + hop * 0.07;
        bird.position.x = 0.12 - (cyc > 2.15 ? 0.1 : 0);
      } };
    },
    xmastree() {
      const g = spruce(2.5, 0.85, true), lights = [];
      const star = U.mesh(new T.OctahedronGeometry(0.14), new T.MeshBasicMaterial({ color: 0xffe27a, toneMapped: false }), 0, 2.58, 0);
      star.scale.set(1, 1.5, 0.45);
      const halo = U.halo(0xffd86b, 1.1, 0.7); halo.position.y = 2.58;
      g.add(star, halo);
      const r = U.rng(77), cols = [0xe2334f, 0xf5c542, 0x4f8fe6, 0xffffff];
      for (let i = 0; i < 22; i++) {
        const k = r(), y = 0.6 + k * 1.6, rad = 0.82 * (1 - k * 0.82) * 0.9, a = r() * TAU;
        if (i % 2) g.add(U.ball(0.06, U.mat(cols[i % 4], { roughness: 0.25, emissive: cols[i % 4], emissiveIntensity: 0.25 }), Math.cos(a) * rad, y, Math.sin(a) * rad));
        else {
          const m = new T.MeshBasicMaterial({ color: 0xffe2a0, toneMapped: false });
          g.add(U.ball(0.035, m, Math.cos(a) * rad, y, Math.sin(a) * rad));
          lights.push({ m, ph: i });
        }
      }
      return { g, tick(t, env) {
        lights.forEach((l) => l.m.color.setHex(0xffe2a0).multiplyScalar(0.55 + 0.45 * Math.sin(t * 2.4 + l.ph)));
        halo.material.opacity = 0.25 + 0.5 * env.night;
        star.rotation.y = t * 0.6;
      } };
    },
    sauna() {
      const red = U.mat(C.falu, { roughness: 0.95 }), white = U.mat(0xf4f1ea, { roughness: 0.8 }), snow = U.mat(C.snow, { roughness: 1 });
      const g = new T.Group();
      g.add(U.box(2.3, 1.5, 1.9, red, 0, 0.75, 0));
      [[-1.15, -0.95], [1.15, -0.95], [-1.15, 0.95], [1.15, 0.95]].forEach((p) => g.add(U.box(0.1, 1.5, 0.1, white, p[0], 0.75, p[1])));
      // gable ends and roof
      const gable = new T.Shape(); gable.moveTo(-1.2, 0); gable.lineTo(1.2, 0); gable.lineTo(0, 0.78); gable.closePath();
      [-0.95, 0.95].forEach((z) => g.add(U.mesh(new T.ExtrudeGeometry(gable, { depth: 0.02, bevelEnabled: false }), red, 0, 1.5, z - 0.01)));
      [-1, 1].forEach((s) => {
        g.add(U.rot(U.box(1.62, 0.07, 2.3, U.mat(0x3a3f47), s * 0.66, 1.93, 0), 0, 0, s * -0.575));
        g.add(U.rot(U.box(1.66, 0.22, 2.36, snow, s * 0.68, 2.06, 0), 0, 0, s * -0.575));
      });
      g.add(U.ball(0.3, snow, 0, 2.42, 0, 0.9, 0.5, 4.0, 10));
      // door, window, steps
      g.add(U.box(0.62, 1.1, 0.06, white, -0.5, 0.57, 0.96), U.box(0.5, 1.0, 0.07, U.mat(C.woodDark), -0.5, 0.54, 0.97), U.ball(0.03, gold(), -0.32, 0.55, 1.02));
      const glass = new T.MeshBasicMaterial({ color: 0xffc46b, toneMapped: false });
      g.add(U.box(0.62, 0.62, 0.06, white, 0.5, 0.86, 0.96), U.box(0.5, 0.5, 0.07, glass, 0.5, 0.86, 0.97),
        U.box(0.03, 0.5, 0.08, white, 0.5, 0.86, 0.975), U.box(0.5, 0.03, 0.08, white, 0.5, 0.86, 0.975));
      g.add(U.box(0.8, 0.12, 0.4, U.mat(C.wood), -0.5, 0.06, 1.2), U.box(0.84, 0.05, 0.44, snow, -0.5, 0.14, 1.2));
      g.add(U.box(0.26, 0.6, 0.26, U.mat(0x5b5f66), 0.55, 2.3, -0.3), U.box(0.3, 0.07, 0.3, snow, 0.55, 2.62, -0.3));
      const halo = U.halo(0xffb45a, 2.2, 0.5); halo.position.set(0.5, 0.86, 1.15); g.add(halo);
      return { g, chimney: new T.Vector3(0.55, 2.7, -0.3), door: new T.Vector3(-0.5, 0, 1.6),
        tick(t, env) { glass.color.setHex(0xffc46b).multiplyScalar(0.5 + 0.5 * env.night); halo.material.opacity = 0.1 + 0.55 * env.night; } };
    },
    /* ---- lights ---- */
    lumilyhty() {
      const snow = U.mat(C.snow, { roughness: 1 }), g = new T.Group();
      const glow = new T.MeshBasicMaterial({ color: 0xffb04a, toneMapped: false });
      [[7, 0.25, 0.1, 0.105], [6, 0.19, 0.27, 0.1], [4, 0.115, 0.43, 0.095], [1, 0, 0.57, 0.09]].forEach((L, li) => {
        for (let i = 0; i < L[0]; i++) { const a = (i + li * 0.5) / L[0] * TAU; g.add(U.ball(L[3], snow, Math.cos(a) * L[1], L[2], Math.sin(a) * L[1], 1, 1, 1, 10)); }
      });
      const halo = U.halo(0xffa040, 1.5, 0.6);
      halo.position.y = 0.28;
      g.add(U.ball(0.13, glow, 0, 0.2, 0, 1, 1.4, 1, 10), halo, U.ball(0.38, snow, 0, 0, 0, 1, 0.16, 1));
      return { g, tick(t, env) {
        const f = 0.9 + 0.1 * Math.sin(t * 9.3) * Math.sin(t * 5.1);
        glow.color.setHex(0xffb04a).multiplyScalar(0.7 + 0.3 * f); halo.material.opacity = (0.25 + 0.55 * env.night) * f;
      } };
    },
    jaalyhty() {
      const ice = new T.MeshStandardMaterial({ color: 0xcdeeff, roughness: 0.08, transparent: true, opacity: 0.55, emissive: 0xffa040, emissiveIntensity: 0.25, side: T.DoubleSide, depthWrite: false });
      const fl = makeFlame(1), halo = U.halo(0xffa040, 1.3, 0.6);
      fl.g.position.y = 0.13; halo.position.y = 0.22;
      const g = U.group(U.ball(0.32, U.mat(C.snow), 0, 0, 0, 1, 0.16, 1), U.cyl(0.17, 0.17, 0.03, U.mat(0xcfe6f5, { roughness: 0.2 }), 0, 0.055, 0, 20), U.cyl(0.035, 0.035, 0.07, U.mat(0xfff6e0), 0, 0.1, 0, 8),
        U.mesh(new T.CylinderGeometry(0.2, 0.17, 0.3, 20, 1, true), ice, 0, 0.2, 0), fl.g, halo);
      return { g, tick(t, env) {
        fl.tick(t, 1.3); ice.emissiveIntensity = 0.2 + 0.5 * env.night;
        halo.material.opacity = (0.2 + 0.55 * env.night) * (0.92 + 0.08 * Math.sin(t * 10));
      } };
    },
    /* Two torches, one each side of the den door. */
    ulkotulet() {
      const g = new T.Group(), flames = [], halos = [], iron = U.mat(0x2b2f36, { roughness: 0.5 });
      [-1, 1].forEach((s) => {
        const torch = new T.Group(), fl = makeFlame(1.3), halo = U.halo(0xff8a3a, 1.5, 0.6);
        fl.g.position.y = 0.85; halo.position.y = 0.96;
        torch.add(U.cyl(0.02, 0.026, 0.8, U.mat(C.woodDark), 0, 0.4, 0, 6), U.cyl(0.078, 0.05, 0.1, iron, 0, 0.82, 0, 10), fl.g, halo, U.ball(0.16, U.mat(C.snow), 0, 0, 0, 1, 0.3, 1));
        torch.position.set(s * 1.45, 0, 0); torch.rotation.z = -s * 0.07;
        g.add(torch); flames.push(fl); halos.push(halo);
      });
      return { g, tick(t, env) {
        flames.forEach((f, i) => f.tick(t, i * 2.1));
        halos.forEach((h, i) => { h.material.opacity = (0.3 + 0.5 * env.night) * (0.88 + 0.12 * Math.sin(t * 9 + i * 2)); });
      } };
    },
    tahti() {
      const wood = U.mat(C.woodDark), st = new T.Shape(), N = 7;
      for (let i = 0; i < N * 2; i++) {
        const a = i / (N * 2) * TAU + Math.PI / 2, r = i % 2 ? 0.15 : 0.36;
        if (i) st.lineTo(Math.cos(a) * r, Math.sin(a) * r); else st.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      st.closePath();
      const geo = new T.ExtrudeGeometry(st, { depth: 0.02, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.07, bevelSegments: 1 });
      geo.translate(0, 0, -0.01);
      const paper = new T.MeshBasicMaterial({ color: 0xffe6a8, toneMapped: false }), halo = U.halo(0xffc46b, 2.0, 0.7);
      const star = U.group(U.mesh(geo, paper), halo);
      star.position.set(0.45, 1.9, 0);
      const g = U.group(U.cyl(0.03, 0.04, 2.5, wood, 0, 1.25, 0, 8), U.rod([0, 2.42, 0], [0.45, 2.52, 0], 0.02, wood), U.rod([0.45, 2.52, 0], [0.45, 2.24, 0], 0.006, U.mat(0x2b2f36)), star,
        U.ball(0.2, U.mat(C.snow), 0, 0.03, 0, 1, 0.4, 1));
      return { g, tick(t, env) {
        star.rotation.y = Math.sin(t * 0.7) * (0.15 + env.wind * 0.5); star.rotation.z = Math.sin(t * 1.1) * 0.05 * (1 + env.wind);
        paper.color.setHex(0xffe6a8).multiplyScalar(0.62 + 0.38 * env.night); halo.material.opacity = 0.12 + 0.6 * env.night;
      } };
    },
    /* ---- camp and comfort ---- */
    matto() {
      const tex = U.tex(64, 256, (c, w, h) => {
        const cols = ['#c8463c', '#f2e8d5', '#3f6fa8', '#f2e8d5', '#e0a93b', '#f2e8d5', '#4f8f6a', '#f2e8d5'], r = U.rng(11);
        let y = 0, i = 0;
        while (y < h) { const hh = 8 + Math.floor(r() * 10); c.fillStyle = cols[i % cols.length]; c.fillRect(0, y, w, hh); y += hh; i++; }
        c.globalAlpha = 0.1; c.fillStyle = '#000';
        for (let x = 0; x < w; x += 3) c.fillRect(x, 0, 1, h);                 // the weave
      });
      const geo = new T.PlaneGeometry(2.0, 3.0, 8, 12);
      geo.rotateX(-Math.PI / 2);
      const rug = U.mesh(geo, new T.MeshStandardMaterial({ map: tex, roughness: 1 }), 0, 0, 0);
      return { g: U.group(rug), flat: true,
        /* Lie along the ground. yAt(x, z) gives the height of the ground under a point of the rug. */
        conform(yAt) {
          const p = geo.attributes.position;
          for (let i = 0; i < p.count; i++) p.setY(i, yAt(p.getX(i), p.getZ(i)) + 0.009);
          p.needsUpdate = true; geo.computeVertexNormals(); geo.computeBoundingSphere();
        } };
    },
    pilkki() {
      const g = new T.Group(), wood = U.mat(C.woodLight, { roughness: 0.8 }), snow = U.mat(C.snow, { roughness: 1 }), pail = U.mat(0x5a7fa8, { roughness: 0.5, side: T.DoubleSide });
      const hole = U.mesh(new T.CircleGeometry(0.2, 20), new T.MeshBasicMaterial({ color: 0x0b1e3a }), 0, 0.014, 0);
      hole.rotation.x = -Math.PI / 2;
      g.add(hole, U.rot(U.torus(0.23, 0.05, snow, 0, 0.02, 0, TAU, 20), Math.PI / 2));
      g.add(U.cyl(0.2, 0.2, 0.045, U.mat(0xc22a3a, { roughness: 0.8 }), -0.58, 0.37, 0.15, 14));                 // the stool
      [0, 1, 2].forEach((i) => { const a = i * 2.09 + 0.4; g.add(U.rod([-0.58 + Math.cos(a) * 0.08, 0.36, 0.15 + Math.sin(a) * 0.08], [-0.58 + Math.cos(a) * 0.21, 0, 0.15 + Math.sin(a) * 0.21], 0.018, wood)); });
      g.add(U.ball(0.14, snow, 0.36, 0.05, 0.1, 1, 0.7, 1), U.rod([0.38, 0.05, 0.1], [0.05, 0.52, 0.02], 0.014, wood), U.rod([0.05, 0.52, 0.02], [0, 0.02, 0], 0.004, U.mat(0xf2f4f7)), U.ball(0.03, U.mat(0xe2334f), 0.02, 0.22, 0.01));
      g.add(U.mesh(new T.CylinderGeometry(0.15, 0.12, 0.24, 14, 1, true), pail, -0.1, 0.12, 0.6), U.cyl(0.12, 0.12, 0.02, pail, -0.1, 0.01, 0.6, 14));
      const fish = P.fish(PN.items.ahven.look);
      fish.scale.setScalar(0.2); fish.position.set(-0.1, 0.25, 0.6); fish.rotation.z = Math.PI / 2 - 0.25;
      g.add(fish);
      return { g };
    },
    laituri() {
      const g = new T.Group(), wood = U.mat(0x8a6a4c, { roughness: 0.9 }), post = U.mat(C.woodDark), steel = U.mat(0xb7bec7, { roughness: 0.4 });
      for (let i = 0; i < 12; i++) g.add(U.box(1.0, 0.05, 0.25, wood, 0, 0.34, 0.15 + i * 0.28));
      [0.3, 1.5, 2.7, 3.3].forEach((z) => [-0.45, 0.45].forEach((x) => g.add(U.cyl(0.05, 0.05, 0.9, post, x, 0.1, z, 7))));
      [-0.45, 0.45].forEach((x) => g.add(U.box(0.06, 0.06, 3.3, post, x, 0.29, 1.7)));
      const snow = U.box(0.96, 0.07, 3.3, U.mat(C.snow, { roughness: 1 }), 0, 0.395, 1.7);
      g.add(snow);
      [-0.18, 0.18].forEach((x) => g.add(U.rod([x, 0.8, 3.5], [x, -0.2, 3.5], 0.02, steel)));
      [0.1, 0.35, 0.6].forEach((y) => g.add(U.rod([-0.18, y, 3.5], [0.18, y, 3.5], 0.016, steel)));
      return { g, float: true, tick(t, env) { snow.visible = env.snow > 0.4; } };
    },
    teltta() {
      const g = new T.Group(), cloth = U.mat(0xf28c28, { roughness: 0.85 }), tri = new T.Shape(), door = new T.Shape();
      tri.moveTo(-0.85, 0); tri.lineTo(0.85, 0); tri.lineTo(0, 1.15); tri.closePath();
      door.moveTo(-0.4, 0); door.lineTo(0.4, 0); door.lineTo(0, 0.76); door.closePath();
      const inside = new T.MeshBasicMaterial({ color: 0x3a2412 }), halo = U.halo(0xffb45a, 1.7, 0.4);
      halo.position.set(0, 0.4, 1.15);
      g.add(U.mesh(new T.ExtrudeGeometry(tri, { depth: 1.9, bevelEnabled: false }), cloth, 0, 0, -0.95), U.mesh(new T.ShapeGeometry(door), inside, 0, 0.01, 0.957),
        U.rod([0, 1.15, -1.05], [0, 1.15, 1.05], 0.02, U.mat(C.woodDark)), U.ball(0.2, U.mat(C.snow), 0, 1.14, 0, 0.9, 0.35, 5, 10), halo);
      [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach((q) => g.add(U.rod([q[0] * 0.5, 0.6, q[1] * 0.95], [q[0] * 1.3, 0, q[1] * 1.35], 0.006, U.mat(0xf2f4f7))));
      return { g, tick(t, env) { inside.color.setHex(0xffb060).multiplyScalar(0.16 + 0.84 * env.night); halo.material.opacity = 0.5 * env.night; } };
    },
    vene() {
      const g = new T.Group(), wood = U.mat(C.woodLight, { roughness: 0.8 });
      const hull = new T.Mesh(new T.SphereGeometry(1, 24, 10, 0, TAU, Math.PI / 2, Math.PI / 2), new T.MeshStandardMaterial({ color: 0x8a5a36, roughness: 0.8, side: T.DoubleSide }));
      hull.scale.set(0.6, 0.42, 1.55); hull.position.y = 0.42;
      const rim = new T.Mesh(new T.TorusGeometry(1, 0.035, 6, 36), U.mat(0xf2ead8, { roughness: 0.7 }));
      rim.rotation.x = Math.PI / 2; rim.scale.set(0.6, 1.55, 1.2); rim.position.y = 0.42;
      const snow = U.ball(0.45, U.mat(C.snow, { roughness: 1 }), 0, 0.3, 0, 1, 0.3, 2.6, 12);
      g.add(hull, rim, snow, U.box(1.05, 0.04, 0.24, wood, 0, 0.33, 0.35), U.box(0.95, 0.04, 0.24, wood, 0, 0.33, -0.5));
      [-1, 1].forEach((s) => g.add(U.rod([s * 0.2, 0.38, 0.1], [s * 1.25, 0.52, -0.5], 0.022, wood), U.rot(U.box(0.12, 0.02, 0.36, wood, s * 1.33, 0.53, -0.55), 0, s * 1.0, 0)));
      return { g: U.group(g), float: true, tick(t, env) {
        const frozen = env.ice > 0.35;
        snow.visible = frozen && env.snow > 0.4;
        g.position.y = frozen ? -0.02 : -0.14 + Math.sin(t * 1.3) * 0.02; g.rotation.z = frozen ? 0.09 : Math.sin(t * 0.9) * 0.04;
      } };
    },
    palju() {
      const g = new T.Group(), wood = U.mat(0x9a6a40, { roughness: 0.85 }), iron = U.mat(0x2b2f36, { roughness: 0.5 });
      const water = U.mesh(new T.CircleGeometry(0.77, 24), new T.MeshStandardMaterial({ color: 0x4fb3d9, roughness: 0.15, emissive: 0x1c5a7a, emissiveIntensity: 0.4 }), 0, 0.7, 0);
      water.rotation.x = -Math.PI / 2;
      g.add(U.mesh(new T.CylinderGeometry(0.8, 0.72, 0.75, 22, 1, true), new T.MeshStandardMaterial({ color: 0x9a6a40, roughness: 0.85, side: T.DoubleSide }), 0, 0.42, 0),
        U.cyl(0.72, 0.72, 0.04, wood, 0, 0.07, 0, 22), water, U.rot(U.torus(0.745, 0.02, iron, 0, 0.25, 0, TAU, 28), Math.PI / 2), U.rot(U.torus(0.782, 0.02, iron, 0, 0.62, 0, TAU, 28), Math.PI / 2));
      g.add(U.cyl(0.2, 0.2, 0.5, iron, 0.98, 0.3, -0.2, 12), U.cyl(0.05, 0.05, 1.0, iron, 0.98, 1.0, -0.2, 8), U.box(0.5, 0.12, 0.3, wood, -0.2, 0.1, 0.98), U.box(0.5, 0.12, 0.25, wood, -0.2, 0.26, 0.88));
      const steam = [], glow = U.halo(0xff8a3a, 0.8, 0.5);
      for (let i = 0; i < 5; i++) { const m = U.ball(0.16, new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, depthWrite: false }), 0, 0.8, 0, 1, 1, 1, 8); g.add(m); steam.push(m); }
      glow.position.set(0.98, 0.25, 0.02); g.add(glow);
      return { g, tick(t, env) {
        steam.forEach((m, i) => {
          const k = (t * 0.22 + i / 5) % 1;
          m.position.set(Math.sin(i * 2.4 + t * 0.6) * 0.3, 0.75 + k * 1.1, Math.cos(i * 1.7) * 0.25); m.scale.setScalar(0.6 + k * 1.3); m.material.opacity = 0.34 * (1 - k) * Math.min(1, k * 6);
        });
        glow.material.opacity = (0.25 + 0.4 * env.night) * (0.9 + 0.1 * Math.sin(t * 8));
      } };
    },
    /* ---- snow and ice ---- */
    luminorppa() {
      const s = U.mat(C.snow, { roughness: 1 }), coal = U.mat(C.coal), g = new T.Group();
      g.add(U.ball(0.5, s, 0, 0.3, -0.1, 1, 0.72, 1.5, 18), U.ball(0.36, s, 0, 0.52, 0.55, 1, 0.95, 1, 18),
        U.ball(0.16, s, 0.42, 0.1, 0.25, 1.4, 0.4, 0.8), U.ball(0.16, s, -0.42, 0.1, 0.25, 1.4, 0.4, 0.8),
        U.ball(0.14, s, 0.12, 0.12, -0.92, 0.8, 0.4, 1.5), U.ball(0.14, s, -0.12, 0.12, -0.92, 0.8, 0.4, 1.5));
      g.add(U.ball(0.042, coal, 0.13, 0.6, 0.865), U.ball(0.042, coal, -0.13, 0.6, 0.865), U.ball(0.036, coal, 0, 0.5, 0.905, 1.3, 0.8, 1));
      [-1, 1].forEach((k) => [0, 1, 2].forEach((i) => g.add(U.rod([k * 0.07, 0.45, 0.88], [k * 0.32, 0.4 + i * 0.06, 0.8], 0.006, U.mat(C.woodDark)))));
      return { g };
    },
    lumilinna() {
      const s = U.mat(0xf2f6ff, { roughness: 1 }), sh = U.mat(0xdde7f7, { roughness: 1 }), g = new T.Group(), night = new T.MeshBasicMaterial({ color: 0x1a2a4a });
      const tower = (x, z, r, h) => {
        g.add(U.cyl(r, r * 1.08, h, s, x, h / 2, z, 14));
        for (let i = 0; i < 6; i++) {
          const a = i / 6 * TAU, b = U.box(r * 0.5, 0.16, r * 0.3, sh, x + Math.cos(a) * r * 0.82, h + 0.07, z + Math.sin(a) * r * 0.82);
          b.rotation.y = -a + Math.PI / 2; g.add(b);
        }
      };
      [[-0.9, 0.7], [0.9, 0.7], [-0.9, -0.7], [0.9, -0.7]].forEach((q) => tower(q[0], q[1], 0.36, 1.1));
      tower(0, -0.1, 0.48, 1.7);
      g.add(U.box(1.8, 0.75, 0.24, s, 0, 0.375, 0.7), U.box(1.8, 0.75, 0.24, s, 0, 0.375, -0.7), U.box(0.24, 0.75, 1.4, s, -0.9, 0.375, 0), U.box(0.24, 0.75, 1.4, s, 0.9, 0.375, 0));
      for (let i = 0; i < 5; i++) g.add(U.box(0.18, 0.14, 0.26, sh, -0.6 + i * 0.3, 0.81, 0.7));
      const gate = U.mesh(new T.CircleGeometry(0.3, 16, 0, Math.PI), night, 0, 0.1, 0.825);
      gate.scale.y = 1.4;
      const pennant = U.group(U.mesh(new T.PlaneGeometry(0.42, 0.24), U.mat(0xd8382f, { roughness: 0.9, side: T.DoubleSide }), 0.22, 0, 0));
      pennant.position.set(0, 2.42, -0.1);
      g.add(gate, U.box(0.6, 0.1, 0.02, night, 0, 0.05, 0.825), U.cyl(0.015, 0.015, 0.8, U.mat(C.woodDark), 0, 2.15, -0.1, 6), pennant);
      return { g, tick(t, env) { pennant.rotation.y = Math.sin(t * (2 + env.wind * 3)) * 0.4; } };
    },
    /* ---- festive ---- */
    kurpitsa() {
      const g = new T.Group(), skin = U.mat(0xf28c28, { roughness: 0.6 }), lit = new T.MeshBasicMaterial({ color: 0x5a2a08, toneMapped: false }), bright = new T.Color(0xffd24a);
      for (let i = 0; i < 8; i++) { const a = (i + 0.5) / 8 * TAU; g.add(U.ball(0.15, skin, Math.cos(a) * 0.14, 0.25, Math.sin(a) * 0.14, 1, 1.2, 1, 12)); }
      g.add(U.ball(0.27, skin, 0, 0.25, 0, 1, 0.92, 1, 16), U.rot(U.cyl(0.025, 0.035, 0.12, U.mat(0x5a7a3a), 0.01, 0.5, 0, 6), 0, 0, 0.25));
      const tri = new T.Shape(), mouth = new T.Shape();
      tri.moveTo(-0.06, 0); tri.lineTo(0.06, 0); tri.lineTo(0, 0.09); tri.closePath();
      mouth.moveTo(-0.17, 0.05); mouth.lineTo(-0.1, 0.01); mouth.lineTo(-0.05, 0.05); mouth.lineTo(0, 0.01); mouth.lineTo(0.05, 0.05); mouth.lineTo(0.1, 0.01); mouth.lineTo(0.17, 0.05);
      mouth.quadraticCurveTo(0, -0.2, -0.17, 0.05);
      const eye = new T.ShapeGeometry(tri), face = new T.Group();
      [-1, 1].forEach((k) => { const e = U.mesh(eye, lit, k * 0.105, 0.3, 0.262); e.rotation.y = k * 0.38; face.add(e); });
      const smile = U.mesh(new T.ShapeGeometry(mouth), lit, 0, 0.19, 0.282);
      smile.rotation.x = 0.12;
      const halo = U.halo(0xffa63a, 1.3, 0.6);
      halo.position.set(0, 0.25, 0.2);
      face.add(smile);
      g.add(face, halo, U.ball(0.36, U.mat(C.snow), 0, 0, 0, 1, 0.16, 1));
      return { g, tick(t, env) {
        const f = 0.9 + 0.1 * Math.sin(t * 8.7) * Math.sin(t * 5.9);
        lit.color.setHex(0x5a2a08).lerp(bright, (0.12 + 0.88 * env.night) * f); halo.material.opacity = (0.08 + 0.6 * env.night) * f;
      } };
    },
    /* A string of little flags over the den door, in the place of the fairy lights. */
    viirit(arch) {
      const g = new T.Group(), flags = [];
      const pts = arch || (() => { const a = []; for (let i = 0; i <= 12; i++) { const k = i / 12 * Math.PI; a.push(new T.Vector3(Math.cos(k) * 0.9, Math.sin(k) * 0.8 + 0.1, 0)); } return a; })();
      const curve = new T.CatmullRomCurve3(pts), tri = new T.Shape();
      tri.moveTo(-0.09, 0); tri.lineTo(0.09, 0); tri.lineTo(0, -0.21); tri.closePath();
      const geo = new T.ShapeGeometry(tri), cols = [0xe2334f, 0xf5c542, 0x4f8fe6, 0x58b368, 0xf48fb1];
      g.add(new T.Mesh(new T.TubeGeometry(curve, 40, 0.012, 5), U.mat(0xf2f4f7)));
      for (let i = 0; i < 11; i++) {
        const p = curve.getPoint((i + 0.5) / 11), f = U.mesh(geo, U.mat(cols[i % cols.length], { roughness: 0.85, side: T.DoubleSide }), p.x, p.y - 0.01, p.z + 0.02);
        g.add(f); flags.push(f);
      }
      return { g, tick(t, env) { flags.forEach((f, i) => { f.rotation.x = Math.sin(t * (2 + env.wind * 2) + i * 1.3) * (0.12 + env.wind * 0.3); }); } };
    },
    ilmapallot() {
      const sway = new T.Group(), cols = [0xe5334f, 0xf5c542, 0x4f8fe6, 0x58b368, 0xf48fb1];
      [[-0.32, 1.55, 0.05], [0.3, 1.7, -0.1], [0, 2.05, 0.08], [-0.15, 1.75, -0.3], [0.2, 1.4, 0.28]].forEach((q, i) => {
        const m = U.mat(cols[i], { roughness: 0.25 });
        sway.add(U.rod([0, 0, 0], [q[0], q[1] - 0.3, q[2]], 0.006, U.mat(0xf2f4f7)), U.ball(0.26, m, q[0], q[1], q[2], 1, 1.18, 1, 16), U.cone(0.04, 0.06, m, q[0], q[1] - 0.31, q[2], 8),
          U.ball(0.045, U.glow(0xffffff), q[0] - 0.09, q[1] + 0.12, q[2] + 0.2, 1, 1.4, 0.5));
      });
      return { g: U.group(sway, U.ball(0.07, U.mat(C.woodDark), 0, 0, 0, 1, 0.6, 1)), tick(t, env) {
        sway.rotation.z = Math.sin(t * 0.8) * 0.05 - (env.wind - 0.3) * 0.25; sway.rotation.x = Math.sin(t * 0.63 + 1) * 0.05;
      } };
    },
    lahjat() {
      const g = U.group(U.ball(0.5, U.mat(C.snow), 0.08, 0, 0.1, 1, 0.1, 1));
      const box = (w, h, d, col, rib, x, z, ry) => {
        const r = U.mat(rib, { roughness: 0.5 });
        const b = U.group(U.box(w, h, d, U.mat(col, { roughness: 0.7 }), 0, h / 2, 0), U.box(w * 1.02, h * 1.02, d * 0.16, r, 0, h / 2, 0), U.box(w * 0.16, h * 1.02, d * 1.02, r, 0, h / 2, 0),
          U.ball(0.06, r, -0.05, h + 0.03, 0, 1, 0.7, 0.6), U.ball(0.06, r, 0.05, h + 0.03, 0, 1, 0.7, 0.6));
        b.position.set(x, 0.02, z); b.rotation.y = ry;
        g.add(b);
      };
      box(0.42, 0.3, 0.42, 0xd8382f, 0xf5c542, -0.12, -0.05, 0.3);
      box(0.3, 0.22, 0.3, 0x2f63c9, 0xffffff, 0.3, 0.12, -0.4);
      box(0.24, 0.34, 0.24, 0x3f8f5a, 0xe2334f, 0.08, 0.34, 0.9);
      return { g };
    },
    /* ---- nature and friends ---- */
    joutsen() {
      const white = U.mat(0xffffff, { roughness: 0.85 }), black = U.mat(0x15171c, { roughness: 0.4 }), body = new T.Group();
      body.add(U.ball(0.3, white, 0, 0.24, 0, 1, 0.8, 1.6, 16), U.rot(U.cone(0.14, 0.34, white, 0, 0.36, -0.5, 10), -1.0, 0, 0),
        U.ball(0.22, white, 0.2, 0.3, -0.05, 0.4, 0.75, 1.7, 12), U.ball(0.22, white, -0.2, 0.3, -0.05, 0.4, 0.75, 1.7, 12));
      const neck = new T.CatmullRomCurve3([new T.Vector3(0, 0.3, 0.36), new T.Vector3(0, 0.55, 0.52), new T.Vector3(0, 0.82, 0.44), new T.Vector3(0, 0.99, 0.5)]);
      const head = U.group(U.ball(0.085, white, 0, 0, 0, 1, 0.9, 1.15, 12), U.rot(U.cone(0.05, 0.1, U.mat(0xf5c542, { roughness: 0.5 }), 0, -0.01, 0.11, 8), Math.PI / 2, 0, 0),
        U.rot(U.cone(0.033, 0.1, black, 0, -0.015, 0.17, 8), Math.PI / 2, 0, 0), U.ball(0.014, black, 0.05, 0.02, 0.06), U.ball(0.014, black, -0.05, 0.02, 0.06));
      head.position.set(0, 1.01, 0.53);
      body.add(new T.Mesh(new T.TubeGeometry(neck, 14, 0.058, 8), white), head);
      return { g: U.group(body), float: true, tick(t, env) {
        body.position.y = env.ice > 0.35 ? 0 : -0.08 + Math.sin(t * 1.2) * 0.015; body.rotation.z = Math.sin(t * 0.9) * 0.02; head.rotation.y = Math.sin(t * 0.4) * 0.5;
      } };
    },
    poro() {
      const fur = U.mat(0x8a7560, { roughness: 1 }), pale = U.mat(0xe9e2d6, { roughness: 1 }), dark = U.mat(0x4a3a2c, { roughness: 1 }), horn = U.mat(0xb9a07a, { roughness: 0.9 }), eye = U.mat(0x15171c, { roughness: 0.2 });
      const g = new T.Group(), head = new T.Group();
      g.add(U.ball(0.3, fur, 0, 0.78, 0, 1, 0.95, 1.75, 16), U.ball(0.22, pale, 0, 0.72, 0.42, 1, 1, 0.9, 12), U.ball(0.09, pale, 0, 0.86, -0.52, 1, 1, 0.8));
      [[0.16, 0.34], [-0.16, 0.34], [0.16, -0.36], [-0.16, -0.36]].forEach((q) => g.add(U.cyl(0.045, 0.035, 0.6, fur, q[0], 0.33, q[1], 7), U.cyl(0.045, 0.05, 0.07, dark, q[0], 0.035, q[1], 7)));
      head.add(U.ball(0.15, fur, 0, 0, 0, 1, 1, 1.15, 12), U.ball(0.1, pale, 0, -0.04, 0.17, 1, 0.85, 1.1, 10), U.ball(0.035, dark, 0, -0.02, 0.275),
        U.ball(0.022, eye, 0.095, 0.04, 0.1), U.ball(0.022, eye, -0.095, 0.04, 0.1), U.ball(0.06, fur, 0.16, 0.08, -0.05, 1.4, 0.5, 0.8), U.ball(0.06, fur, -0.16, 0.08, -0.05, 1.4, 0.5, 0.8));
      const limb = (r0, r1, len) => { const geo = new T.CylinderGeometry(r1, r0, len, 6); geo.translate(0, len / 2, 0); return new T.Mesh(geo, horn); };
      [-1, 1].forEach((s) => {
        const a = new T.Group(), t1 = limb(0.02, 0.01, 0.16), t2 = limb(0.02, 0.01, 0.18), t3 = limb(0.018, 0.008, 0.14);
        t1.position.y = 0.12; t1.rotation.x = 1.0; t2.position.y = 0.26; t2.rotation.z = s * 0.9; t3.position.y = 0.38; t3.rotation.set(-0.5, 0, -s * 0.6);
        a.add(limb(0.03, 0.018, 0.4), t1, t2, t3);
        a.position.set(s * 0.07, 0.1, -0.03); a.rotation.set(-0.2, 0, -s * 0.5);
        head.add(a);
      });
      head.position.set(0, 1.27, 0.68);
      g.add(U.rod([0, 0.85, 0.4], [0, 1.2, 0.62], 0.11, fur, 10), head, U.rot(U.torus(0.125, 0.025, U.mat(C.red, { roughness: 0.9 }), 0, 1.0, 0.5, TAU, 14), -1.0, 0, 0), U.ball(0.04, gold(), 0, 0.9, 0.6));
      return { g, tick(t) {
        const c = t % 9;
        head.rotation.x = c > 6 && c < 8 ? Math.sin((c - 6) / 2 * Math.PI) * 0.5 : Math.sin(t * 0.8) * 0.04; head.rotation.y = Math.sin(t * 0.35) * 0.35;
      } };
    },
    /* ---- the cosy den: all of these sit on the den, in its own space (the door is at z 1.9) ---- */
    tyynyt() {
      const g = new T.Group(), heap = new T.Group();
      const pillow = (col, w, d) => U.mesh(cushionGeo(w, 0.2, d), U.mat(col, { roughness: 0.95 }), 0, 0, 0);
      const a = pillow(0xe0a93b, 0.5, 0.5), b = pillow(0x3c8c8a, 0.46, 0.46), c = pillow(0xd9828f, 0.42, 0.42);
      a.position.set(-0.08, 0.1, 0.02); a.rotation.y = 0.3;
      b.position.set(0.22, 0.1, -0.16); b.rotation.set(0.05, -0.4, 0.04);
      c.position.set(0.06, 0.27, -0.06); c.rotation.set(-0.95, 0.2, 0.1);              // leaning on the others
      [a, b].forEach((q) => q.add(U.ball(0.025, U.mat(0xf7f1e3), 0, 0.1, 0, 1, 0.5, 1, 8)));
      // and a little red heart on top
      const hs = new T.Shape();
      hs.moveTo(0, -0.11); hs.bezierCurveTo(-0.02, -0.08, -0.14, -0.02, -0.14, 0.04); hs.bezierCurveTo(-0.14, 0.11, -0.05, 0.13, 0, 0.07);
      hs.bezierCurveTo(0.05, 0.13, 0.14, 0.11, 0.14, 0.04); hs.bezierCurveTo(0.14, -0.02, 0.02, -0.08, 0, -0.11);
      const heart = U.mesh(new T.ExtrudeGeometry(hs, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 4, curveSegments: 10 }), U.mat(0xc8323c, { roughness: 0.9 }), 0.3, 0.17, 0.1);
      heart.rotation.set(-1.15, 0.4, 0);
      heap.add(a, b, c, heart);
      heap.rotation.y = -0.5;
      g.add(heap);
      return { g, conform(yAt) { heap.position.y = Math.min(yAt(-0.15, 0), yAt(0.2, -0.15)) + 0.01; } };
    },
    kynttilat() {
      const g = new T.Group(), flames = [], halos = [], spots = [[-0.92, 2.18, 1], [-0.72, 2.42, 0.62]];
      const glass = new T.MeshStandardMaterial({ color: 0xffe6c0, roughness: 0.12, transparent: true, opacity: 0.45, emissive: 0xff9a3a, emissiveIntensity: 0.35, depthWrite: false });
      const wax = U.mat(0xf8f0dc, { roughness: 0.7, emissive: 0xffb060, emissiveIntensity: 0.25 });
      const jars = spots.map((q, i) => {
        const j = new T.Group(), k = q[2], fl = makeFlame(0.42 * k), halo = U.halo(0xffa04a, 0.75 * k, 0.5);
        fl.g.position.y = 0.17 * k; halo.position.y = 0.2 * k;
        const jar = U.mesh(new T.CylinderGeometry(0.075 * k, 0.07 * k, 0.2 * k, 14, 1, true), glass, 0, 0.1 * k, 0);
        jar.renderOrder = 1;
        j.add(U.cyl(0.058 * k, 0.058 * k, 0.12 * k, wax, 0, 0.06 * k, 0, 12), U.cyl(0.004, 0.004, 0.04 * k, U.mat(0x2b2f36), 0, 0.135 * k, 0, 4), jar, fl.g, halo);
        j.position.set(q[0], 0, q[1]);
        g.add(j); flames.push(fl); halos.push(halo);
        return j;
      });
      // the warm glow from inside the den, laid over the dark doorway
      const glowTex = U.tex(128, 128, (c, w, h) => {
        const r = c.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
        r.addColorStop(0, 'rgba(255,184,96,1)'); r.addColorStop(0.45, 'rgba(255,128,48,0.5)'); r.addColorStop(1, 'rgba(255,96,24,0)');
        c.fillStyle = r; c.fillRect(0, 0, w, h);
      });
      const glow = new T.Mesh(new T.CircleGeometry(0.86, 28, 0, Math.PI), new T.MeshBasicMaterial({ map: glowTex, transparent: true, opacity: 0.2, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false }));
      glow.position.set(0, 0, 1.875); glow.userData.noThumb = true; glow.renderOrder = 2;
      g.add(glow);
      return { g, conform(yAt) { jars.forEach((j) => { j.position.y = yAt(j.position.x, j.position.z); }); glow.position.y = Math.max(yAt(-0.4, 1.9), yAt(0.4, 1.9)) - 0.02; },
        tick(t, env) {
          flames.forEach((f, i) => f.tick(t, i * 1.7));
          halos.forEach((h, i) => { h.material.opacity = (0.25 + 0.55 * env.night) * (0.85 + 0.15 * Math.sin(t * 8 + i * 2)); });
          glow.material.opacity = (0.18 + 0.72 * env.night) * (0.9 + 0.06 * Math.sin(t * 5.3) + 0.04 * Math.sin(t * 13.1));
        } };
    },
    verho() {
      const tex = U.tex(128, 256, (c, w, h) => {
        c.fillStyle = '#8f2a2a'; c.fillRect(0, 0, w, h);
        c.fillStyle = '#f2e6cf'; c.fillRect(0, h - 42, w, 6); c.fillRect(0, h - 16, w, 6);                    // cream bands near the hem
        c.fillStyle = '#2f5d8c'; c.fillRect(0, h - 34, w, 16);
        c.fillStyle = '#f0b429'; for (let x = 4; x < w; x += 16) { c.beginPath(); c.moveTo(x, h - 26); c.lineTo(x + 4, h - 31); c.lineTo(x + 8, h - 26); c.lineTo(x + 4, h - 21); c.fill(); }
        c.globalAlpha = 0.12; c.fillStyle = '#000'; for (let y = 0; y < h; y += 3) c.fillRect(0, y, w, 1);   // the weave
        c.globalAlpha = 1;
      });
      const wool = new T.MeshStandardMaterial({ map: tex, roughness: 1, side: T.DoubleSide });
      const g = new T.Group(), panels = [];
      // a panel hangs from the top of the arch, is gathered back at the side by a tie, and falls to the ground
      const panel = (sd) => {
        const nu = 10, nv = 18, pos = [], uv = [], idx = [];
        for (let j = 0; j <= nv; j++) {
          const v = j / nv;
          for (let i = 0; i <= nu; i++) {
            const u = i / nu;
            const ao = (88 - 64 * Math.min(1, v / 0.42)) * Math.PI / 180;                  // the outer edge follows the arch, then drops
            const ox = v < 0.42 ? Math.cos(ao) * 1.02 : 0.98 + 0.06 * (v - 0.42), oy = v < 0.42 ? Math.sin(ao) * 1.02 : U.lerp(0.43, -0.3, (v - 0.42) / 0.58);
            const tie = 0.5, ix = v < tie ? U.lerp(0.04, 0.82, Math.pow(v / tie, 0.8)) : U.lerp(0.82, 0.66, (v - tie) / (1 - tie));
            const iy = v < tie ? U.lerp(0.99, 0.4, v / tie) : U.lerp(0.4, -0.3, (v - tie) / (1 - tie));
            const x = U.lerp(ox, ix, u), y = U.lerp(oy, iy, u);
            const fold = Math.sin(u * Math.PI * 5) * (0.02 + 0.03 * Math.abs(v - tie) * 2);
            pos.push(sd * x, y, 2.03 + fold + 0.05 * u * (1 - Math.abs(v - tie) * 2));
            uv.push(sd > 0 ? u : 1 - u, 1 - v);
          }
        }
        for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + 1, c2 = a + nu + 1, d = c2 + 1; idx.push(a, c2, b, b, c2, d); }
        const geo = new T.BufferGeometry();
        geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
        geo.setIndex(idx); geo.computeVertexNormals();
        const m = new T.Mesh(geo, wool);
        const cord = U.rot(U.torus(0.09, 0.022, U.mat(0xf0c860, { roughness: 0.6 }), sd * 0.86, 0.4, 2.07, TAU, 14), 0, 0.3 * sd, 1.2 * sd);
        const tassel = U.cone(0.035, 0.12, U.mat(0xf0c860, { roughness: 0.8 }), sd * 0.9, 0.27, 2.1, 8);
        g.add(m, cord, tassel); panels.push(m);
      };
      panel(-1); panel(1);
      // a soft swag across the top
      const swag = new T.Mesh(new T.TubeGeometry(new T.QuadraticBezierCurve3(new T.Vector3(-0.42, 0.96, 2.06), new T.Vector3(0, 0.78, 2.12), new T.Vector3(0.42, 0.96, 2.06)), 16, 0.06, 8, false), wool);
      g.add(swag);
      return { g, conform(yAt) {
        // the hem rests on the ground on each side, however high the ground is there
        panels.forEach((m) => {
          const p = m.geometry.attributes.position;
          for (let i = 0; i < p.count; i++) { const gy = yAt(p.getX(i), p.getZ(i)) + 0.01; if (p.getY(i) < gy) p.setY(i, gy); }
          p.needsUpdate = true; m.geometry.computeVertexNormals();
        });
      } };
    },
    talja() {
      // a reindeer hide: warm brown fur, darker down the spine, paler at the edges, in the shape of a hide
      const W2 = 1.5, L2 = 1.9;
      const tex = U.tex(192, 256, (c, w, h) => {
        const r = U.rng(31);
        c.save(); c.translate(w / 2, h / 2);
        const sx = w / 2 / 1.0, sy = h / 2 / 1.0;
        c.beginPath();
        // outline: neck at the top, four leg flaps, a rounded rump
        const pts = [[0, -0.98], [0.2, -0.88], [0.26, -0.68], [0.62, -0.72], [0.86, -0.62], [0.6, -0.46], [0.66, -0.1], [0.62, 0.3], [0.92, 0.48], [0.84, 0.66], [0.52, 0.6],
          [0.38, 0.86], [0.12, 0.97], [-0.12, 0.97], [-0.38, 0.86], [-0.52, 0.6], [-0.84, 0.66], [-0.92, 0.48], [-0.62, 0.3], [-0.66, -0.1], [-0.6, -0.46], [-0.86, -0.62], [-0.62, -0.72], [-0.26, -0.68], [-0.2, -0.88]];
        pts.forEach((q, i) => { const x = q[0] * sx * 0.98, y = q[1] * sy * 0.98; if (!i) c.moveTo(x, y); else { const p0 = pts[i - 1]; c.quadraticCurveTo(p0[0] * sx * 0.98, p0[1] * sy * 0.98, (p0[0] + q[0]) / 2 * sx * 0.98, (p0[1] + q[1]) / 2 * sy * 0.98); } });
        c.closePath();
        const gr = c.createRadialGradient(0, 0, 4, 0, 0, w * 0.62);
        gr.addColorStop(0, '#7a5638'); gr.addColorStop(0.6, '#9c7656'); gr.addColorStop(1, '#d9c4a6');
        c.fillStyle = gr; c.fill();
        c.clip();
        c.fillStyle = 'rgba(70,46,30,0.55)'; c.fillRect(-w * 0.07, -h / 2, w * 0.14, h);                                  // the darker spine
        for (let i = 0; i < 2600; i++) {                                                                                  // fur strokes
          const x = (r() - 0.5) * w, y = (r() - 0.5) * h, l = 3 + r() * 6, a = Math.atan2(y, x) + (r() - 0.5) * 0.6;
          c.strokeStyle = r() < 0.5 ? 'rgba(255,240,220,0.18)' : 'rgba(40,24,14,0.16)'; c.lineWidth = 1;
          c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke();
        }
        c.restore();
      });
      const geo = new T.PlaneGeometry(W2, L2, 14, 18);
      geo.rotateX(-Math.PI / 2);
      const hide = U.mesh(geo, new T.MeshStandardMaterial({ map: tex, roughness: 1, alphaTest: 0.5, side: T.DoubleSide }), 0, 0, 0);
      hide.rotation.y = 0.95;                                     // lying the way she curls up on it
      return { g: U.group(hide), flat: true,
        conform(yAt) {
          const p = geo.attributes.position, cs = Math.cos(hide.rotation.y), sn = Math.sin(hide.rotation.y);
          for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, yAt(x * cs + z * sn, -x * sn + z * cs) + 0.012); }
          p.needsUpdate = true; geo.computeVertexNormals(); geo.computeBoundingSphere();
        } };
    },
    ryijy() {
      // a rya rug: rich reds and oranges round a stepped diamond, a dark blue border and fringe at both ends
      const tex = U.tex(160, 256, (c, w, h) => {
        const r = U.rng(53), F = 18;
        c.clearRect(0, 0, w, h);
        c.fillStyle = '#26406b'; c.fillRect(0, F, w, h - 2 * F);
        c.fillStyle = '#b8322b'; c.fillRect(10, F + 10, w - 20, h - 2 * F - 20);
        const steps = ['#e0a93b', '#d4602e', '#f3e3c3', '#9c2a2a', '#e0a93b', '#26406b'];
        steps.forEach((col, i) => {                                                                              // the stepped diamond in the middle
          const rx = (w / 2 - 22) * (1 - i / steps.length), ry = (h / 2 - F - 26) * (1 - i / steps.length);
          c.fillStyle = col; c.beginPath(); c.moveTo(w / 2, h / 2 - ry); c.lineTo(w / 2 + rx, h / 2); c.lineTo(w / 2, h / 2 + ry); c.lineTo(w / 2 - rx, h / 2); c.closePath(); c.fill();
        });
        c.fillStyle = '#f3e3c3';                                                                                 // little stars in the corners
        [[30, F + 30], [w - 30, F + 30], [30, h - F - 30], [w - 30, h - F - 30]].forEach((q) => { for (let a = 0; a < 4; a++) { c.save(); c.translate(q[0], q[1]); c.rotate(a * Math.PI / 2); c.fillRect(-2, 0, 4, 9); c.restore(); } });
        for (let i = 0; i < 3500; i++) {                                                                         // the shaggy pile
          const x = r() * w, y = F + r() * (h - 2 * F);
          c.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)'; c.fillRect(x, y, 1 + r() * 2, 2 + r() * 3);
        }
        c.fillStyle = '#efe2c6';                                                                                 // the fringe
        for (let x = 3; x < w - 2; x += 6) { c.fillRect(x, 2 + r() * 3, 3, F - 2); c.fillRect(x, h - F, 3, F - 2 - r() * 3); }
      });
      const geo = new T.PlaneGeometry(1.15, 1.7, 10, 14);
      geo.rotateX(-Math.PI / 2);
      const rug = U.mesh(geo, new T.MeshStandardMaterial({ map: tex, roughness: 1, alphaTest: 0.5, side: T.DoubleSide }), 0, 0, 0);
      rug.rotation.y = 1.35;
      return { g: U.group(rug), flat: true,
        conform(yAt) {
          const p = geo.attributes.position, cs = Math.cos(rug.rotation.y), sn = Math.sin(rug.rotation.y);
          for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, yAt(x * cs + z * sn, -x * sn + z * cs) + 0.014); }
          p.needsUpdate = true; geo.computeVertexNormals(); geo.computeBoundingSphere();
        } };
    },
    peitto() {
      const tex = P.knitTex().clone(); tex.needsUpdate = true; tex.repeat.set(1, 0.6);
      const wool = new T.MeshStandardMaterial({ map: tex, roughness: 1 });
      const g = new T.Group(), pile = new T.Group();
      [[0, 0.055, 0, 0], [0.015, 0.155, -0.01, 0.06], [-0.01, 0.25, 0.012, -0.05]].forEach((q, i) => {
        const slab = U.mesh(softBox(0.78 - i * 0.03, 0.11, 0.52 - i * 0.02, 0.32), wool, q[0], q[1], q[2]);
        slab.rotation.y = q[3];
        pile.add(slab);
      });
      pile.rotation.y = 0.4;
      g.add(pile);
      return { g, setOut(on) { pile.visible = on; }, conform(yAt) { pile.position.y = Math.min(yAt(-0.3, 0), yAt(0.3, 0), yAt(0, 0.2)) - 0.005; } };
    },
  };
  P.decor = (id, arg) => (decor[id] ? decor[id](arg) : { g: new T.Group() });

  /* ---------- finds from the lake bottom ---------- */
  const trinket = {
    kivi() {
      return U.group(U.ball(0.3, U.mat(0x8f98a3, { roughness: 0.35 }), 0, 0.17, 0, 1, 0.56, 0.8, 22),
        U.rot(U.torus(0.262, 0.016, U.mat(0xe9edf2, { roughness: 0.35 }), 0, 0.2, 0, TAU, 28), 1.35, 0.3, 0));
    },
    kapy() {
      const g = U.group(U.ball(0.15, U.mat(0x6a4a30), 0, 0.26, 0, 1, 1.7, 1, 14));
      for (let ring = 0; ring < 6; ring++) {
        const y = 0.06 + ring * 0.075, rad = 0.155 * Math.sin((ring + 0.9) / 7 * Math.PI) + 0.02;
        for (let i = 0; i < 8; i++) {
          const a = i / 8 * TAU + ring * 0.4;
          const sc = U.ball(0.05, U.mat(ring % 2 ? 0x8a6240 : 0x7a5536), Math.cos(a) * rad, y, Math.sin(a) * rad, 1, 0.5, 1, 6);
          sc.rotation.set(0.5, -a, 0); g.add(sc);
        }
      }
      return U.rot(g, 0, 0, 0.5);
    },
    lapanen() {
      const red = U.mat(0xcf3340, { roughness: 1 });
      const g = U.group(U.mesh(new T.CapsuleGeometry(0.17, 0.2, 6, 14), red, 0, 0.36, 0), U.rot(U.mesh(new T.CapsuleGeometry(0.065, 0.1, 4, 10), red, 0.2, 0.3, 0), 0, 0, -0.7),
        U.cyl(0.175, 0.185, 0.14, U.mat(0xf7f1e3, { roughness: 1 }), 0, 0.1, 0, 16));
      g.children[0].scale.z = 0.6; g.children[2].scale.z = 0.62;
      [[0, 0.44], [-0.07, 0.36], [0.07, 0.36], [0, 0.28]].forEach((p) => g.add(U.ball(0.022, U.mat(0xffffff), p[0], p[1], 0.1)));
      return U.rot(g, 0, 0, -0.25);
    },
    uistin() {
      const steel = U.mat(0xdfe6ee, { metalness: 0.5, roughness: 0.22, emissive: 0x56606c, emissiveIntensity: 0.5 });
      const g = U.group(U.ball(0.3, steel, 0, 0, 0, 1, 0.26, 0.1, 18), U.ball(0.05, U.mat(0xe2334f, { roughness: 0.3 }), 0.31, 0, 0),
        U.torus(0.03, 0.008, steel, -0.33, 0, 0), U.rot(U.torus(0.06, 0.01, U.mat(0x8a929c, { metalness: 0.4, roughness: 0.3 }), 0.42, -0.04, 0, 3.6, 12), 0, 0, 2.2),
        U.ball(0.03, U.mat(0xf5c542, { roughness: 0.3 }), 0.12, 0.02, 0.03));
      return U.rot(g, 0, 0, 0.5);
    },
    markka() {
      const au = U.mat(0xd9a441, { metalness: 0.4, roughness: 0.3, emissive: 0x5a3a05, emissiveIntensity: 0.5 });
      const g = U.group(U.rot(U.cyl(0.24, 0.24, 0.04, au, 0, 0, 0, 28), Math.PI / 2), U.torus(0.225, 0.02, au, 0, 0, 0, TAU, 28),
        U.rot(U.cyl(0.15, 0.15, 0.05, U.mat(0xe8bb5a, { metalness: 0.4, roughness: 0.25, emissive: 0x5a3a05, emissiveIntensity: 0.5 }), 0, 0, 0, 24), Math.PI / 2),
        U.box(0.035, 0.16, 0.06, au, 0.01, 0, 0), U.rot(U.box(0.03, 0.07, 0.06, au, -0.02, 0.055, 0), 0, 0, 0.7));
      return U.rot(g, -0.2, 0.5, 0.15);
    },
    avain() {
      const br = U.mat(0x9a7b3a, { metalness: 0.4, roughness: 0.4, emissive: 0x3a2a08, emissiveIntensity: 0.5 });
      const g = U.group(U.torus(0.1, 0.03, br, -0.22, 0, 0), U.rot(U.cyl(0.026, 0.026, 0.42, br, 0.09, 0, 0, 8), 0, 0, Math.PI / 2),
        U.box(0.035, 0.1, 0.03, br, 0.26, -0.06, 0), U.box(0.035, 0.07, 0.03, br, 0.19, -0.045, 0));
      return U.rot(g, 0, 0, 0.6);
    },
    tuohivene() {
      const hull = U.mesh(new T.SphereGeometry(0.34, 18, 10, 0, TAU, Math.PI / 2, Math.PI / 2), U.mat(0xe9dcc0, { roughness: 0.8, side: T.DoubleSide }), 0, 0.18, 0);
      hull.scale.set(1, 0.45, 0.42);
      const g = U.group(hull, U.cyl(0.012, 0.012, 0.42, U.mat(C.woodDark), 0, 0.33, 0, 5));
      const sail = U.mesh(finShape([[0, 0], [0.22, 0.05], [0, 0.3]]), new T.MeshStandardMaterial({ color: 0xe2a53a, side: T.DoubleSide, roughness: 0.8 }), 0.01, 0.2, 0);
      g.add(sail);
      [-0.2, -0.07, 0.08, 0.2].forEach((x) => g.add(U.box(0.05, 0.012, 0.004, U.mat(0x4a3a2a), x, 0.13, 0.125 * Math.sqrt(1 - x * x / 0.116))));
      return g;
    },
    poronkello() {
      const br = U.mat(0xc9973a, { metalness: 0.4, roughness: 0.3, emissive: 0x5a3a05, emissiveIntensity: 0.5 });
      const pts = [[0.03, 0.34], [0.09, 0.32], [0.13, 0.24], [0.16, 0.1], [0.2, 0.02], [0.215, 0]].map((p) => new T.Vector2(p[0], p[1]));
      const g = U.group(new T.Mesh(new T.LatheGeometry(pts, 20), new T.MeshStandardMaterial({ color: 0xc9973a, metalness: 0.4, roughness: 0.3, emissive: 0x5a3a05, emissiveIntensity: 0.5, side: T.DoubleSide })),
        U.ball(0.05, br, 0, 0.02, 0), U.torus(0.07, 0.022, U.mat(0x6a3f26, { roughness: 0.8 }), 0, 0.4, 0, TAU, 14));
      return U.rot(g, 0, 0, 0.2);
    },
    kuksa() {
      const wood = new T.MeshStandardMaterial({ color: 0xb07a45, roughness: 0.55, side: T.DoubleSide });
      const cup = U.mesh(new T.SphereGeometry(0.22, 20, 12, 0, TAU, Math.PI / 2, Math.PI / 2), wood, 0, 0.22, 0);
      const g = U.group(cup, U.rot(U.mesh(new T.CircleGeometry(0.205, 20), U.mat(0x7a5230, { roughness: 0.7 }), 0, 0.2, 0), -Math.PI / 2),
        U.rot(U.torus(0.22, 0.02, U.mat(0xb07a45, { roughness: 0.55 }), 0, 0.22, 0, TAU, 22), Math.PI / 2));
      const handle = U.rot(U.torus(0.085, 0.035, U.mat(0xb07a45, { roughness: 0.55 }), 0.3, 0.19, 0, TAU, 14), Math.PI / 2);
      handle.scale.set(1.25, 1, 0.5);
      g.add(handle);
      return g;
    },
    pulloposti() {
      const glass = new T.MeshStandardMaterial({ color: 0x8fd6c2, roughness: 0.08, transparent: true, opacity: 0.55 });
      const g = U.group(U.cyl(0.035, 0.035, 0.22, U.mat(0xfff3d6, { roughness: 0.8 }), 0, 0.2, 0, 10), U.cyl(0.11, 0.11, 0.34, glass, 0, 0.19, 0, 18),
        U.cyl(0.045, 0.11, 0.09, glass, 0, 0.405, 0, 18), U.cyl(0.045, 0.045, 0.09, glass, 0, 0.49, 0, 14),
        U.cyl(0.04, 0.045, 0.07, U.mat(0xa9763e), 0, 0.555, 0, 10), U.torus(0.037, 0.008, U.mat(0xe2334f), 0, 0.2, 0, TAU, 10));
      g.children[5].rotation.x = Math.PI / 2;
      return U.rot(g, 0, 0, -0.9);
    },
    meripihka() {
      const m = new T.MeshStandardMaterial({ color: 0xf59b1c, roughness: 0.12, transparent: true, opacity: 0.9, emissive: 0xc45f00, emissiveIntensity: 0.6, flatShading: true });
      const a = new T.Mesh(new T.IcosahedronGeometry(0.24, 1), m);
      a.scale.set(1.1, 0.75, 0.85); a.position.y = 0.19; a.rotation.set(0.3, 0.5, 0.2);
      return U.group(a, U.ball(0.03, U.mat(0x7a3a05), 0.03, 0.2, 0.05));
    },
    jokihelmi() {
      const shell = new T.MeshStandardMaterial({ color: 0x3a3f4a, roughness: 0.5, side: T.DoubleSide });
      const inner = new T.MeshStandardMaterial({ color: 0xd9d4e6, roughness: 0.2, side: T.BackSide });
      const half = () => { const h = new T.Mesh(new T.SphereGeometry(0.3, 20, 10, 0, TAU, Math.PI / 2, Math.PI / 2), shell); h.scale.set(1.25, 0.42, 0.85); h.add(new T.Mesh(new T.SphereGeometry(0.29, 20, 10, 0, TAU, Math.PI / 2, Math.PI / 2), inner)); return h; };
      const lower = half(); lower.position.y = 0.13;
      const upper = half(); upper.position.set(0, 0.2, -0.24); upper.rotation.x = Math.PI + 1.1;
      const pearl = U.ball(0.105, new T.MeshStandardMaterial({ color: 0xfdf6ff, roughness: 0.12, emissive: 0x9a8fb5, emissiveIntensity: 0.45 }), 0, 0.14, 0.02, 1, 1, 1, 20);
      return U.group(lower, upper, pearl);
    },
  };

  /* Any item by id, for the shop and album pictures and for showing finds. */
  P.item = function (id) {
    const it = PN.items[id];
    if (!it) return new T.Group();
    if (it.kind === 'fish') return P.fish(it.look);
    if (it.kind === 'food' || it.kind === 'med') return food[id]();
    if (it.kind === 'wear') return P.wear(id);
    if (it.kind === 'decor') return P.decor(id).g;
    if (it.kind === 'trinket') return trinket[id]();
    if (id === 'ball') return P.ball();
    return new T.Group();
  };

  /* ---------- small pictures of every item, drawn once at start-up ---------- */
  PN.Thumbs = {
    map: {},
    build(size) {
      const r = new T.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
      r.setPixelRatio(1); r.setSize(size, size, false);
      const scene = new T.Scene();
      scene.add(new T.HemisphereLight(0xffffff, 0xb8c6e0, 2.4));
      const key = new T.DirectionalLight(0xfff4e2, 2.6); key.position.set(2, 4, 5); scene.add(key);
      const cam = new T.PerspectiveCamera(28, 1, 0.1, 100);
      const box = new T.Box3(), c = new T.Vector3(), s = new T.Vector3();
      const dirs = { fish: [0.25, 0.3, 1], decor: [0.9, 0.55, 1], wear: [0.5, 0.35, 1], trinket: [0.5, 0.75, 1], food: [0.4, 0.8, 1], med: [0.5, 0.4, 1], toy: [0.3, 0.3, 1] };
      Object.keys(PN.items).forEach((id) => {
        const it = PN.items[id], obj = P.item(id);
        const glows = [];
        obj.traverse((o) => { if (o.isSprite || o.userData.noThumb) glows.push(o); });       // glows look odd in small pictures, and throw the framing off
        glows.forEach((o) => o.parent.remove(o));
        scene.add(obj);
        box.setFromObject(obj); box.getCenter(c); box.getSize(s);
        const rad = Math.max(0.12, s.length() / 2);
        const d = dirs[it.kind] || dirs.wear;
        const dist = rad / Math.sin(cam.fov * Math.PI / 360) * 1.02;
        cam.position.set(d[0], d[1], d[2]).normalize().multiplyScalar(dist).add(c);
        cam.lookAt(c);
        r.render(scene, cam);
        PN.Thumbs.map[id] = r.domElement.toDataURL('image/png');
        scene.remove(obj);
      });
      r.dispose();
      if (r.forceContextLoss) r.forceContextLoss();
    },
    get(id) { return PN.Thumbs.map[id] || ''; },
  };
})(window.PN = window.PN || {});
