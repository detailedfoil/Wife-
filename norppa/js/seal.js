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
     the middle of the back runs along u = 0.75 and the canvas top is the front. */
  function coatTexture(stage, isHead) {
    const c = COAT[stage], r = U.rng(31 + stage * 17 + (isHead ? 5 : 0));
    return U.tex(512, 256, (g, w, h) => {
      const edge = css(mix(c.back, c.belly, 0.64));
      const grad = g.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, edge); grad.addColorStop(0.05, css(c.belly)); grad.addColorStop(0.45, css(c.belly));
      grad.addColorStop(0.59, css(c.back)); grad.addColorStop(0.91, css(c.back)); grad.addColorStop(1, edge);
      g.fillStyle = grad; g.fillRect(0, 0, w, h);
      if (c.spots !== 'none') {
        const n = isHead ? 16 : 78;
        for (let i = 0; i < n; i++) {
          const u = 0.57 + r() * 0.36, v = isHead ? 0.5 + r() * 0.42 : 0.1 + r() * 0.8;
          const ry = (isHead ? 4 : 5) + r() * (isHead ? 3 : 5);
          const rx = ry * 1.5 / Math.max(0.4, Math.sin(Math.PI * v));
          g.beginPath(); g.ellipse(u * w, v * h, rx, ry, 0, 0, TAU);
          if (c.spots === 'ring') {
            g.fillStyle = 'rgba(70,80,94,0.38)'; g.fill();
            g.lineWidth = 2; g.strokeStyle = 'rgba(226,232,238,0.8)'; g.stroke();
          } else { g.fillStyle = 'rgba(120,132,146,0.3)'; g.fill(); }
        }
      }
      if (isHead) {                              // a paler face at the front
        const f = g.createLinearGradient(0, 0, 0, h * 0.5);
        f.addColorStop(0, css(c.face, 1)); f.addColorStop(0.55, css(c.face, 0.85)); f.addColorStop(1, css(c.face, 0));
        g.fillStyle = f; g.fillRect(0, 0, w, h * 0.5);
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
  function fitNeckwear(source, stage, id) {
    const c = COAT[stage], bodyZ = 1.05 - 1.2 * c.body;
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
        p.setXYZ(i, px, Math.max(0.035, py) - 0.46, (pz - bodyZ) / c.body);
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
    const nu = 28, nv = 22, pos = [], uv = [], idx = [], Z0 = -0.86, Z1 = 0.24, TH = 1.95;
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
      const v = j / nv, uz = Z0 + (Z1 - Z0) * v;
      for (let i = 0; i <= nu; i++) {
        const u = i / nu, th = -TH + 2 * TH * u;
        const q = at(uz, th, 0.05);
        q[1] -= Math.max(0, Math.abs(th) - 1.35) * 0.1 - Math.sin(uz * 11 + th * 2) * 0.008 * Math.max(0, Math.abs(th) - 1.0);
        pos.push(q[0], q[1], q[2]); uv.push(u * 2, v * 1.4);
      }
    }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    // the folded-over top edge by her neck
    const edge = [];
    for (let i = 0; i <= 12; i++) { const th = -TH + 2 * TH * i / 12, q = at(Z1, th, 0.08); edge.push(new T.Vector3(q[0], q[1] - Math.max(0, Math.abs(th) - 1.35) * 0.1, q[2])); }
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
      white: new T.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
      dark: new T.MeshStandardMaterial({ color: 0x2a1f1c, roughness: 0.5 }),
      line: new T.MeshBasicMaterial({ color: 0x33261f }),
      whisker: new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }),
      arc: new T.TorusGeometry(0.078, 0.017, 6, 16, Math.PI),
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

  class Seal {
    constructor(opts) {
      opts = opts || {};
      const S = sharedBits();
      this.isPup = !!opts.pup;
      this.seed = Math.random() * 100;
      this.stage = -1;
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
        e.add(ball, h1, h2, arc);
        this.headP.add(e);
        this.eyes.push({ g: e, ball, h1, h2, arc });
      });

      // muzzle: two pads, a nose, a little mouth, whiskers
      this.muzzle = new T.Group();
      this.headP.add(this.muzzle);
      this.pads = [];
      [-1, 1].forEach((s) => {
        const pad = new T.Mesh(new T.SphereGeometry(0.135, 18, 14));
        pad.scale.set(1, 0.8, 0.75);
        pad.position.copy(onHead(s * 0.17, -0.3, 0.99));
        this.muzzle.add(pad); this.pads.push(pad);
        for (let i = 0; i < 3; i++) {
          const wg = new T.CylinderGeometry(0.0055, 0.002, 0.36, 4); wg.translate(0, 0.18, 0);
          const wk = new T.Mesh(wg, S.whisker);
          wk.position.copy(pad.position).add(new T.Vector3(s * 0.1, -0.01 + (i - 1) * 0.035, 0.0));     // rooted in the cheek pad
          wk.rotation.order = 'YZX';
          wk.rotation.set(0, s * 0.42, -s * (Math.PI / 2 + (i - 1) * 0.24));                                  // swept back along the face
          this.muzzle.add(wk);
          this.muzzle.add(U.ball(0.011, S.dark, pad.position.x + s * (0.02 + i * 0.035), pad.position.y + 0.02 - (i % 2) * 0.045, pad.position.z + 0.098 - i * 0.012));
        }
      });
      const nose = U.ball(0.062, S.dark, 0, 0, 0, 1.25, 0.8, 0.7, 14);
      nose.position.copy(onHead(0, -0.13, 1.04));
      this.muzzle.add(nose, U.ball(0.014, S.white, nose.position.x - 0.02, nose.position.y + 0.02, nose.position.z + 0.036));
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
      this.tear = U.ball(0.035, new T.MeshBasicMaterial({ color: 0x8fd0ff, transparent: true, opacity: 0.9 }), 0, 0, 0, 0.8, 1.2, 0.8, 8);
      this.tear.position.copy(onHead(0.5, -0.12, 1.02)); this.tear.visible = false;
      this.headP.add(this.tear);

      // dirt patches
      this.dirtMat = new T.MeshBasicMaterial({ color: 0x6b5138, transparent: true, opacity: 0, depthWrite: false });
      [[0.5, 0.86, 0.2, 0.22], [-0.42, 0.95, -0.25, 0.26], [0.2, 1.0, -0.6, 0.2], [-0.62, 0.62, 0.3, 0.18], [0.6, 0.6, -0.5, 0.2]].forEach((d) => {
        const m = U.ball(d[3], this.dirtMat, d[0], d[1], d[2], 1, 0.35, 1, 10);
        m.lookAt(0, 0.4, d[2]); m.rotateX(Math.PI / 2); m.renderOrder = 2;
        this.sq.add(m);
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
      this.setStage(opts.stage || 0);
    }

    setStage(stage) {
      if (stage === this.stage) return;
      this.stage = stage;
      const c = COAT[stage], m = coat(stage), k = c.body;
      this.body.material = m.body; this.head.material = m.head;
      this.pads.forEach((p) => { p.material = m.pad; });
      [this.tailL, this.tailR, this.flipL.children[0], this.flipR.children[0]].forEach((f) => { f.material = m.flip; f.castShadow = true; });
      this.body.scale.set(1, 1, k);
      this.body.position.set(0, 0.46, 1.05 - 1.2 * k);
      this.tailG.position.set(0, 0.17, 1.05 - 2.4 * k + 0.12);
      this.headP.scale.setScalar(c.head);
      // Growth changes the neck proportions, so refit from the original item.
      if (this.wornId.neck) {
        const id = this.wornId.neck; this.wornId.neck = null; this.setWear('neck', id);
      }
      this.backA.position.set(0, 1.062, 1.05 - 1.44 * k); this.backA.scale.setScalar(0.5 + 0.5 * k);
      this.eyes.forEach((e) => e.g.scale.setScalar(c.eye));
      this.baseScale = this.isPup ? 0.4 : c.scale;
      this.shadow.scale.set(2.3, 1.2 + 2.2 * k, 1);
      this.applyScale();
    }
    applyScale() { this.g.scale.setScalar(this.baseScale * this.grow); }
    makeBlanket() {
      const b = blanketGeometry(), tex = PN.Props.knitTex();
      const wool = new T.MeshStandardMaterial({ map: tex, roughness: 1, side: T.DoubleSide });
      const m = new T.Mesh(b.g, wool), cuff = new T.Mesh(b.cuff, new T.MeshStandardMaterial({ color: 0xb8322b, roughness: 1 }));
      m.add(cuff); m.castShadow = true; m.receiveShadow = true; cuff.castShadow = true; m.visible = false;
      this.body.add(m);
      this.blanket = m;
    }
    get size() { return this.baseScale * this.grow; }

    setWear(slot, id) {
      if (this.wornId[slot] === id) return;
      if (this.worn[slot]) {
        const old = this.worn[slot]; old.parent.remove(old);
        if (slot === 'neck') old.traverse((m) => { if (m.isMesh) m.geometry.dispose(); });
      }
      this.worn[slot] = null; this.wornId[slot] = id;
      if (!id) return;
      const source = PN.Props.wear(id);
      const o = U.shadows(slot === 'neck' ? fitNeckwear(source, this.stage, id) : source, true, false);
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
      this.headP.position.y = 0.78 - (this.worn.neck ? p.drop * 0.1 : p.drop);
      this.shadow.material.opacity = 0.55 * U.clamp(1 - p.lift * 1.6, 0.25, 1);

      this.eyes.forEach((E) => {
        const open = p.eye;
        E.ball.visible = open > 0.12;
        E.ball.scale.set(wide, Math.max(0.12, open) * 1.1 * wide, 0.62);
        E.h1.visible = E.h2.visible = open > 0.45;
        E.arc.visible = open <= 0.12;
        E.arc.rotation.z = eyeMode === 1 ? 0 : Math.PI;
        E.arc.position.y = eyeMode === 1 ? -0.03 : 0.03;
      });
      this.mouth.scale.y = U.lerp(1, -1, p.frown) || 0.001;
      this.maw.visible = p.mouth > 0.06;
      this.maw.scale.set(1.15 * (0.7 + p.mouth * 0.5), Math.max(0.1, p.mouth * 1.5), 0.6);
      this.blushMat.opacity = p.blush;
      this.blushMat.color.setHex(mood === 'sick' && !asleep ? 0x9fd6b0 : 0xff8fa8);
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
      }
    }
  }
  Seal.v1 = new T.Vector3();
  Seal.COAT = COAT;
  PN.Seal = Seal;
})(window.PN = window.PN || {});
