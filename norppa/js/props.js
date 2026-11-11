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
  const P = PN.Props = {};

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
  };
  function scarf(a, b) {
    const tex = U.tex(64, 8, (g, w, h) => {
      for (let i = 0; i < 8; i++) { g.fillStyle = U.hex(i % 2 ? b : a); g.fillRect(i * 8, 0, 8, h); }
    });
    tex.wrapS = T.RepeatWrapping; tex.repeat.set(2, 1);
    const m = new T.MeshStandardMaterial({ map: tex, roughness: 1 });
    const ring = new T.Mesh(new T.TorusGeometry(0.625, 0.11, 10, 36), m);
    const flat = new T.MeshStandardMaterial({ color: a, roughness: 1 });
    const end = U.rot(U.box(0.2, 0.44, 0.075, flat, 0.56, -0.5, 0.17), 0.1, 0, 0.22);
    const tip = U.rot(U.box(0.2, 0.07, 0.076, new T.MeshStandardMaterial({ color: b, roughness: 1 }), 0.602, -0.69, 0.189), 0.1, 0, 0.22);
    return U.group(ring, end, tip, U.ball(0.125, flat, 0.52, -0.28, 0.15, 1, 0.9, 0.8));
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
      const arm = U.cyl(0.013, 0.013, 0.5, frame, s * 0.5, 0.06, 0.36, 6);
      arm.rotation.set(Math.PI / 2, 0, s * -0.38);
      g.add(arm);
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
        obj.traverse((o) => { if (o.isSprite) glows.push(o); });       // glows look odd in small pictures, and throw the framing off
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
