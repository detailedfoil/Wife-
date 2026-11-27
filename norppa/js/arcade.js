/* Pikku Norppa: the arcade. Nine mini-games, each on a little stage of its own.
   Swimmy Seal: tap to swim up, slip between the ice and the kelp. Three goes, the average counts.
   Snowball Toss: flick the snowball into a bucket, Paper Toss style. Mind the wind.
   Curling Seal: slide across the ice and stop on the rings.
   Sled Run: steer down the hill between the trees.
   Blackjack: beat the dealer for tokens. Sauna: how she gets clean.
   Ice Stack: set sliding floes down on a tower; the overhang breaks off.
   Puffer Sweeper: minesweeper with pufferfish, one board against the clock.
   Ice Piano: piano tiles; tap the tiles of a tune in order as it speeds up.
   Typing Seal: read a word, then type it before the window shrinks away (developer mode for now).
   Each one plugs into games.js through Games.ext: { label, label2, hint, start, go, view, pointer, key, update }. */
(function (PN) {
  'use strict';
  const T = THREE, U = PN.U, W = PN.World, A = PN.Audio, tr = PN.L, G = PN.Games, K = G.kit;
  const PI = Math.PI;
  const rs = (k) => (Math.random() - 0.5) * 2 * k, rnd = Math.random;
  /* What decides how a game goes (where the gaps, the rocks, the wind are) uses grnd/grs, which are seeded in an online race so both players get the same game.
     Scenery and sparkles keep using rnd/rs, which can be called a different number of times on each phone without anyone noticing. */
  const grnd = () => PN.Games.rnd(), grs = (k) => (grnd() - 0.5) * 2 * k;
  let clock = 0;

  /* ---------- shared bits ---------- */
  function sky(top, bottom) {
    return U.tex(4, 256, (c, w, h) => {
      const gr = c.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, top); gr.addColorStop(1, bottom);
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
    });
  }
  function stage(top, bottom, light) {
    const scene = new T.Scene();
    scene.background = sky(top, bottom);
    scene.add(new T.HemisphereLight(0xffffff, light.ground, light.hemi));
    const d = new T.DirectionalLight(0xffffff, light.key);
    d.position.set(3, 8, 5);
    scene.add(d);
    const camera = new T.PerspectiveCamera(40, 1, 0.1, 200);
    const rig = new T.Group();
    scene.add(rig);
    return { scene, camera, rig };
  }
  /* Match the stage camera to the shape of the screen. Returns half the sideways angle of view. */
  function lens(view) {
    const c = view.camera;
    c.aspect = W.aspect; c.fov = W.camera.fov;
    c.updateProjectionMatrix();
    return Math.atan(Math.tan(c.fov * PI / 360) * c.aspect);
  }

  /* Point a pool stage's camera down at the water, but never so low that her head is pushed off the top: on a wide screen the lens
     is narrow, and the fixed downward look used to crop her at the top. top is how high her head is above the ice. */
  function lookAtPool(view, top) {
    const c = view.camera, p = c.position, half = Math.tan(c.fov * PI / 360);
    const level = Math.atan2(p.y - top, p.z - 0.3);                       // how far below level her head is
    const pitch = Math.min(Math.atan2(p.y + 2, p.z), level + Math.atan(0.9 * half));
    c.lookAt(0, p.y - Math.tan(pitch) * p.z, 0);
  }

  /* The seal that plays the arcade games: a stand-in dressed like the real one. */
  let actor = null;
  function cast(view, norm, shadow) {
    const st = PN.Game.state, main = PN.Game.seal;
    if (!actor) { actor = new PN.Seal({ stage: st.stage }); actor.freeY = true; }
    actor.setStage(st.stage);
    actor.grow = main.grow; actor.applyScale();
    ['head', 'neck', 'face', 'back'].forEach((slot) => actor.setWear(slot, st.wearing[slot]));
    actor.look = null; actor.move = null; actor.gest = null; actor.gestQ = [];
    actor.shadow.visible = shadow;
    actor.g.position.set(0, 0, 0);
    view.rig.add(actor.g);
    view.rig.scale.setScalar(norm / actor.size);
    view.rig.rotation.set(0, 0, 0);
    return actor;
  }
  function face(h) { actor.heading = h; actor.g.rotation.y = h; }

  /* A pool of little balls: snow puffs, bubbles. They shrink away as they age. */
  function Puffs(scene, n, color, opacity) {
    const geo = new T.SphereGeometry(1, 8, 6);
    const mat = new T.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, toneMapped: false, depthWrite: opacity >= 1 });
    const list = [];
    for (let i = 0; i < n; i++) {
      const m = new T.Mesh(geo, mat);
      m.visible = false;
      scene.add(m);
      list.push({ m, life: 0, max: 1, vx: 0, vy: 0, vz: 0, g: 0, r: 0.1 });
    }
    let next = 0;
    return {
      emit(x, y, z, count, speed, r, life, grav) {
        for (let i = 0; i < count; i++) {
          const p = list[next++ % n];
          p.m.position.set(x + rs(r), y + rs(r), z + rs(r));
          p.vx = rs(speed); p.vy = rs(speed) * 0.6 + speed * 0.5; p.vz = rs(speed);
          p.r = r * (0.6 + rnd() * 0.8); p.life = p.max = life * (0.7 + rnd() * 0.6); p.g = grav;
          p.m.scale.setScalar(p.r);   // a new ball starts at its own size (it used to show at full size, a radius-1 sphere, until the next update)
          p.m.visible = true;
        }
      },
      update(dt, dx, dz) {
        for (let i = 0; i < n; i++) {
          const p = list[i];
          if (p.life <= 0) continue;
          p.life -= dt;
          if (p.life <= 0) { p.m.visible = false; continue; }
          p.vy -= p.g * dt;
          p.m.position.x += p.vx * dt + (dx || 0); p.m.position.y += p.vy * dt; p.m.position.z += p.vz * dt + (dz || 0);
          p.m.scale.setScalar(p.r * Math.min(1, p.life / p.max * 1.6));
        }
      },
      clear() { list.forEach((p) => { p.life = 0; p.m.visible = false; }); },
    };
  }

  /* A pull-back aim, shared by the toss and the curl: drag down for power, sideways to aim the other way. */
  function pull(aim, type, x, y, spread) {
    if (type === 'down') return { x0: x, y0: y, p: 0, yaw: 0 };
    if (!aim) return null;
    aim.p = U.clamp((y - aim.y0) / (0.3 * window.innerHeight), 0, 1);
    aim.yaw = U.clamp(-(x - aim.x0) / (0.5 * window.innerWidth), -1, 1) * spread;
    return aim;
  }

  /* Soft layered firs, merged once and shared by all the arcade games. */
  let treeBits = null, treeCount = 0;
  function tree(k) {
    if (!treeBits) {
      const model = PN.Props.spruce(1.95, 0.55, true), green = [], snow = [], trunk = [];
      model.updateMatrixWorld(true);
      model.children.forEach((m, i) => {
        const parts = i === 0 ? trunk : m.material.color.getHex() === PN.COL.snow ? snow : green;
        parts.push({ geo: m.geometry, m: m.matrixWorld, c: m.material.color });
      });
      treeBits = { trunk: U.merge(trunk), green: U.merge(green), cap: U.merge(snow) };
    }
    const g = new T.Group(), foliage = U.mat(0xffffff, { roughness: 1, vertexColors: true });
    g.add(U.mesh(treeBits.trunk, foliage), U.mesh(treeBits.green, foliage), U.mesh(treeBits.cap, foliage));
    g.scale.setScalar(k || 1);
    g.rotation.y = treeCount++ * 2.39996;
    return g;
  }

  /* ================= Swimmy Seal ================= */
  const swim = (() => {
    const H = 4.6, CEIL = 3.9, FLOOR = -3.9, R = 0.27, N = 12;
    let view = null, obs = [], bubbles = null, rays = [], drift = [], used = 5;
    /* Gaps are set far enough ahead to start off the right edge, however wide the screen: a wide landscape one needs more of them. */
    const spacing = () => G.mumMode ? 4.75 : 3.55;
    const need = () => U.clamp(Math.ceil((2 * halfW + 3.2 + 5) / spacing()) + 1, 5, N);
    let halfW = 2.2, sx = -1, y = 0, vy = 0, dead = false, lastGapY = 0, score = 0, live = false, go = 1, goes = 3, scores = [0], avg = 0, wait = 0;

    // One folded ribbon per blade. The two sway shapes meet at the same tip,
    // so the kelp can ripple without moving the edge of the playable gap.
    function kelpBlade() {
      const points = [], wave = [], colors = [], indices = [], rows = 30;
      const dark = new T.Color(0x408676), bright = new T.Color(0xc2e797), tint = new T.Color();
      for (let i = 0; i <= rows; i++) {
        const t = i / rows, envelope = Math.sin(PI * t);
        const width = 0.016 + 0.16 * Math.pow(envelope, 0.55) * (0.86 + 0.14 * Math.cos(t * PI * 9));
        const x = 0.075 * Math.sin(t * PI * 5) * envelope;
        for (const side of [-1, 0, 1]) {
          const px = x + width * side, py = t * 6.6, pz = side === 0 ? 0.06 * envelope : 0;
          points.push(px, py, pz);
          wave.push(px + 0.12 * envelope * Math.sin(t * PI * 4 + 0.6), py, pz);
          tint.copy(dark).lerp(bright, (side === 0 ? 0.37 : 0.08) + 0.44 * t);
          colors.push(tint.r, tint.g, tint.b);
        }
        if (i < rows) for (let j = 0; j < 2; j++) {
          const n = 3 * i + j;
          indices.push(n, n + 1, n + 3, n + 1, n + 4, n + 3);
        }
      }
      const geo = new T.BufferGeometry();
      geo.setIndex(indices); geo.setAttribute('position', new T.Float32BufferAttribute(points, 3));
      geo.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
      geo.morphAttributes.position = [new T.Float32BufferAttribute(wave, 3)];
      geo.computeVertexNormals();
      return geo;
    }

    function lakeBackdrop() {
      const map = U.tex(1536, 384, (c, w, h) => {
        const r = U.rng(1087), water = c.createLinearGradient(0, 0, 0, h);
        for (const [y, col] of [[0, '#b2e6db'], [0.25, '#7ec7c8'], [0.62, '#448ca5'], [1, '#234b70']]) water.addColorStop(y, col);
        c.fillStyle = water; c.fillRect(0, 0, w, h);
        for (let layer = 0; layer < 2; layer++) {
          c.fillStyle = layer ? '#3b7287' : '#5792a1';
          const base = h * (0.70 + layer * 0.12);
          c.beginPath(); c.moveTo(0, h); c.lineTo(0, base);
          for (let x = 0; x < w; x += 96) {
            const crest = base - r() * 47;
            c.bezierCurveTo(x + 28, base + 6, x + 52, crest - 14, x + 96, crest);
          }
          c.lineTo(w, h); c.closePath(); c.fill();
        }
        // Water weeds in the distance, painted together in a single draw.
        c.fillStyle = 'rgba(46,108,119,0.57)';
        for (let i = 0; i < 58; i++) {
          const x = r() * w, y = h * (0.84 + r() * 0.15), length = 10 + r() * 33;
          for (let j = -1; j <= 1; j++) {
            const tip = x + j * 9, top = y - length * (1 - Math.abs(j) * 0.27);
            c.beginPath(); c.moveTo(x - 2, y); c.quadraticCurveTo(tip - 4, top + 8, tip, top);
            c.quadraticCurveTo(tip + 1, top + 13, x + 2, y); c.fill();
          }
        }
      });
      const plane = new T.Mesh(new T.PlaneGeometry(58, 15), new T.MeshBasicMaterial({ map, fog: false, toneMapped: false }));
      plane.position.z = -4;
      return plane;
    }

    function lakeBank(ceiling) {
      // Round the exposed edge over the bank. Each row is a band of snow,
      // blue ice or silt, so the cross-section reads even on a narrow screen.
      const rows = ceiling
        ? [[-2.5, 0.14, 0x80bfca], [-0.75, 0.02, 0xa3d9de], [0.35, 0.09, 0xc1e7e8],
          [0.51, 0.20, 0x95ccda], [0.54, 0.31, 0xafdee4], [0.55, 0.44, 0xdeefee], [0.55, 8, 0xf1f8f6]]
        : [[-2, -0.34, 0x416a76], [-0.8, -0.07, 0x668787], [0.35, -0.03, 0x86a49c],
          [1.15, -0.12, 0x6d8c89], [1.58, -0.24, 0x547879], [1.68, -0.56, 0x4b6973], [1.68, -8, 0x345569]];
      const pts = [], colors = [], idx = [], tint = new T.Color();
      for (let i = 0; i <= 140; i++) {
        const x = (i - 70) * 0.5, swell = 0.045 * Math.sin(x * 1.8) + 0.058 * Math.cos(x * 0.76 + 0.8);
        rows.forEach(([z, y, col], j) => {
          pts.push(x, (ceiling ? CEIL : FLOOR) + y + swell, z);
          tint.setHex(col).multiplyScalar(0.97 + 0.04 * Math.cos(x * 0.65 + j * 0.3));
          colors.push(tint.r, tint.g, tint.b);
          if (i < 140 && j < rows.length - 1) {
            const a = i * rows.length + j, b = a + rows.length;
            idx.push(a, b, a + 1, b, b + 1, a + 1);
          }
        });
      }
      const geo = new T.BufferGeometry();
      geo.setIndex(idx); geo.setAttribute('position', new T.Float32BufferAttribute(pts, 3));
      geo.setAttribute('color', new T.Float32BufferAttribute(colors, 3)); geo.computeVertexNormals();
      return new T.Mesh(geo, U.mat(0xffffff, { vertexColors: true, roughness: ceiling ? 0.54 : 1, side: T.DoubleSide }));
    }

    function build() {
      view = stage('#86d6e4', '#0a2a55', { ground: 0x5f9fd0, hemi: 2.1, key: 1.3 });
      const sc = view.scene;
      sc.add(lakeBackdrop());
      sc.fog = new T.FogExp2(0x5799a9, 0.022);
      const iceM = U.mat(0xb5dae1, { roughness: 0.44 }), rockM = U.mat(0x64828a, { roughness: 1 });
      sc.add(lakeBank(true), lakeBank(false));
      for (let i = 0; i < 12; i++) {
        const bump = U.ball(1, iceM, 0, CEIL + 0.05, -0.6 + rs(0.4), 0.8 + rnd() * 0.9, 0.22 + rnd() * 0.25, 1.2, 12);
        const rock = U.ball(1, rockM, 0, FLOOR - 0.05, rs(0.8), 0.5 + rnd() * 0.8, 0.2 + rnd() * 0.3, 1, 10);
        bump.userData.x = i * 2.1 + rs(0.5); rock.userData.x = i * 2.1 + rs(0.8);
        sc.add(bump, rock); drift.push(bump, rock);
      }
      const rayMap = U.tex(64, 128, (c, w, h) => {
        const edge = c.createLinearGradient(0, 0, w, 0);
        edge.addColorStop(0, 'transparent'); edge.addColorStop(0.48, '#eefff2'); edge.addColorStop(1, 'transparent');
        c.fillStyle = edge; c.fillRect(0, 0, w, h);
        const fade = c.createLinearGradient(0, 0, 0, h);
        fade.addColorStop(0, '#fff'); fade.addColorStop(1, 'transparent');
        c.globalCompositeOperation = 'destination-in'; c.fillStyle = fade; c.fillRect(0, 0, w, h);
        c.globalCompositeOperation = 'source-over';
      });
      const rayM = new T.MeshBasicMaterial({ map: rayMap, color: 0xe7fff3, transparent: true, opacity: 0.27, blending: T.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false });
      for (let i = 0; i < 4; i++) {
        const r = new T.Mesh(new T.PlaneGeometry(1.1 + rnd() * 1.2, 15), rayM);
        r.position.set(-4 + i * 2.6, 0.5, -1.9); r.rotation.z = 0.3;
        r.userData.ph = rnd() * 6;
        sc.add(r); rays.push(r);
      }
      const profile = [[0.035, 0], [0.16, 0.10], [0.27, 0.32], [0.32, 0.62], [0.40, 1.35], [0.46, 2.8], [0.54, 5.2], [0.62, 9]];
      const iceGeo = new T.LatheGeometry(profile.map(([r, y]) => new T.Vector2(r, y)), 14);
      const facets = [], icePos = iceGeo.attributes.position;
      const blue = new T.Color(0x72bfcf), white = new T.Color(0xe7fcf5), tint = new T.Color();
      for (let i = 0; i < icePos.count; i++) {
        const y = icePos.getY(i), angle = Math.atan2(icePos.getX(i), icePos.getZ(i));
        const band = 0.12 * Math.cos(angle * 3 + y * 0.7) + 0.07 * Math.sin(y * 4 + angle);
        tint.copy(blue).lerp(white, U.clamp(0.38 + 0.44 * Math.exp(-y * 1.7) + band, 0, 1));
        facets.push(tint.r, tint.g, tint.b);
      }
      iceGeo.setAttribute('color', new T.Float32BufferAttribute(facets, 3));
      const iceCol = U.mat(0xffffff, { vertexColors: true, roughness: 0.33 });
      const blade = kelpBlade();
      const k1 = U.mat(0x87b8a3, { vertexColors: true, side: T.DoubleSide });
      const k2 = U.mat(0xe2ebc1, { vertexColors: true, side: T.DoubleSide });
      const fishLook = PN.items.muikku.look;
      for (let i = 0; i < N; i++) {
        const g = new T.Group();
        const ice = new T.Mesh(iceGeo, iceCol);
        ice.rotation.y = rnd() * 3;
        const kelp = new T.Group(), fronds = [];
        [[-0.27, -0.45, k1], [0.02, 0, k2], [0.29, -0.3, k1]].forEach((d) => {
          const mesh = new T.Mesh(blade, d[2]), ph = rnd() * 6;
          mesh.position.set(d[0], d[1] - 6.6, rs(0.15));
          kelp.add(mesh); fronds.push({ mesh, ph });
        });
        const fish = PN.Props.fish(fishLook, true);
        fish.scale.setScalar(0.32); fish.rotation.y = PI;
        g.add(ice, kelp, fish);
        sc.add(g);
        obs.push({ g, ice, kelp, fronds, fish, x: 0, top: 0, bot: 0, mid: 0, passed: false, hasFish: false });
      }
      bubbles = Puffs(sc, 40, 0xdff6ff, 0.55);
    }
    function place(o, x) {
      const gap = G.mumMode ? 3.2 : 2.45 - Math.min(0.55, score * 0.025);
      const mid = G.mumMode ? grs(0.7) : U.clamp(lastGapY + grs(2.4), -2.2, 2.2);
      lastGapY = mid;
      o.x = x; o.mid = mid; o.top = mid + gap / 2; o.bot = mid - gap / 2; o.passed = false;
      o.ice.position.y = o.top; o.kelp.position.y = o.bot;
      o.hasFish = grnd() < 0.45; o.fish.visible = o.hasFish;
      o.g.position.x = x;
    }
    function flap() {
      if (dead) return;
      vy = 4.6;
      A.play('bubble');
      bubbles.emit(sx - 0.45, y, 0.25, 3, 0.5, 0.07, 0.9, -2.6);
      actor.gesture('boop', true);
    }
    /* What pays out is the average of the goes so far, rounded, so a lucky go can't carry it. */
    function tally() {
      scores[go - 1] = score;
      avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
      K.result(avg);
    }
    function point() {
      score++; K.shown(score); tally();
    }
    function die() {
      dead = true;
      A.play('thud');
      actor.gesture('surprise', true);
      bubbles.emit(sx, y, 0.3, 12, 1.6, 0.09, 1.1, -2.6);
      if (go < goes) { K.big(tr(score >= 10 ? 'Wow!' : 'Bonk!')); wait = 0.9; }
      else K.over(tr(avg >= 10 ? 'Wow!' : 'Bonk!'));
    }
    /* a fresh stretch of water for the next go */
    function reset() {
      y = 0.3; vy = 0; dead = false; live = false; score = 0; lastGapY = 0;
      G.reseed(go);
      bubbles.clear();
      halfW = H * W.aspect;
      used = need();
      obs.forEach((o, i) => { o.g.visible = i < used; if (i < used) place(o, halfW + 3.2 + i * (spacing() - 0.05)); });
    }
    function nextGo() {
      go++; reset(); scores.push(0); tally();
      K.time(go + '/' + goes); K.shown(0); K.hint(''); K.big('');
      live = true; flap();
    }
    const speed0 = () => (dead ? 0 : live ? 2.7 + Math.min(1.5, score * 0.06) : 1.2);
    const tap = () => { if (dead) { if (go < goes && wait <= 0) nextGo(); } else flap(); };
    return {
      label: 'Gaps', label2: 'Go', hint: 'Tap to swim up. Three goes, and the average counts.',
      view: () => view,
      start() {
        if (!view) build();
        cast(view, 0.37, false);
        actor.g.position.set(0, -0.46, 0);
        face(PI / 2);
        go = 1; goes = G.mumMode ? 1 : 3; scores = [0]; avg = 0; wait = 0;
        reset();
        K.time(go + '/' + goes);
      },
      go() { live = true; flap(); },
      snap() {                                      // the corner picture for an online race
        const n = (v) => Math.round(U.clamp(v, -0.5, 1.5) * 100) / 100, span = CEIL - FLOOR;
        return { y: n((y - FLOOR) / span), d: dead ? 1 : 0, o: obs.slice(0, used).filter((o) => o.x > -halfW - 1 && o.x < halfW + 1).map((o) => [n((o.x + halfW) / (2 * halfW)), n((o.top - FLOOR) / span), n((o.bot - FLOOR) / span)]), s: n((sx + halfW) / (2 * halfW)), v: Math.round(speed0() / (2 * halfW) * 1000) / 1000 };
      },
      pointer(type) { if (type === 'down') tap(); },
      key(k) { if (k === ' ' || k === 'ArrowUp' || k === 'w') tap(); },
      update(dt, playing) {
        clock += dt;
        lens(view);
        const c = view.camera;
        c.position.set(0, 0, H / Math.tan(c.fov * PI / 360)); c.lookAt(0, 0, 0);
        halfW = H * W.aspect; sx = -halfW * 0.42;
        const speed = dead ? 0 : live ? 2.7 + (G.mumMode ? 0 : Math.min(1.5, score * 0.06)) : 1.2;
        const motion = dt * (G.mumMode ? 0.64 : 1), dx = speed * motion;
        // scenery slides by
        drift.forEach((m) => {
          m.userData.x -= dx;
          if (m.userData.x < -12.6) m.userData.x += 25.2;
          m.position.x = m.userData.x;
        });
        rays.forEach((r) => { r.rotation.z = 0.3 + Math.sin(clock * 0.35 + r.userData.ph) * 0.05; });
        // the seal
        if (!live) y = 0.3 + Math.sin(clock * 2.2) * 0.18;
        else {
          vy = Math.max(-6, vy - 11 * motion);
          y += vy * motion;
          if (y + R > CEIL) { y = CEIL - R; vy = Math.min(vy, 0); }
          if (y - R < FLOOR) { y = FLOOR + R; if (G.mumMode) vy = 0; else if (!dead) die(); }
        }
        view.rig.position.set(sx, y, 0);
        view.rig.rotation.z = U.damp(view.rig.rotation.z, live ? U.clamp(vy * 0.11, -0.75, 0.5) : 0, 10, dt);
        // ice above, kelp below
        let far = -99;
        for (let i = 0; i < used; i++) if (obs[i].x > far) far = obs[i].x;
        for (const want = need(); used < want; used++) { const o = obs[used]; o.g.visible = true; place(o, far + spacing() - 0.25 + grnd() * 0.5); far = o.x; }   // the screen got wider
        obs.slice(0, used).forEach((o) => {
          if (live) o.x -= dx;
          if (o.x < -halfW - 1.6) { place(o, far + spacing() - 0.25 + grnd() * 0.5); far = o.x; }
          o.g.position.x = o.x;
          o.fronds.forEach((f) => { f.mesh.morphTargetInfluences[0] = 0.5 + 0.5 * Math.sin(clock * 1.5 + f.ph); });
          if (o.hasFish) { o.fish.position.y = o.mid + Math.sin(clock * 3 + o.x) * 0.12; o.fish.rotation.z = Math.sin(clock * 5 + o.x) * 0.15; }
          if (!playing || dead) return;
          const ax = Math.abs(o.x - sx);
          if (ax < 0.44 + R * 0.8 && (y + R > o.top || y - R < o.bot)) { die(); return; }
          if (o.hasFish && ax < 0.55 && Math.abs(o.fish.position.y - y) < 0.6) {
            o.hasFish = false; o.fish.visible = false;
            point(); A.play('gulp'); K.beat('fish');
            bubbles.emit(o.x, o.mid, 0.2, 5, 0.9, 0.06, 0.7, -2);
          }
          if (!o.passed && o.x + 0.5 < sx - R) { o.passed = true; point(); A.play('pop'); K.hint(''); }
        });
        bubbles.update(dt, -dx, 0);
        if (live && !dead && rnd() < dt * 2) bubbles.emit(sx + 0.5, y + 0.1, 0.2, 1, 0.2, 0.05, 1, -2.2);
        if (dead && go < goes && wait > 0 && playing) { wait -= dt; if (wait <= 0) { K.hint(tr('Average so far: {0}. Tap for go {1} of {2}.', avg, go + 1, goes)); K.beat('again'); } }
        actor.update(dt, clock, null);
      },
    };
  })();

  // Three silhouettes share one material. Each fir is a single mesh, including
  // the bent trunk, shadowed needles and rounded overhang of the snow.
  const winterFirs = [];
  let firNumber = 0, firShadow;
  function winterFir(scale) {
    const variant = firNumber++ % 3;
    if (!winterFirs[variant]) {
      const coords = [], colors = [], triangles = [];
      const shade = new T.Color();
      function tier(rows, phase, branches, lean, dx = 0, dz = 0) {
        const steps = branches === 3 ? 10 : 18;
        const first = coords.length / 3;
        rows.forEach(([y, radius, dip, col], row) => {
          for (let j = 0; j < steps; j++) {
            const a = j * 2 * PI / steps;
            const lobe = (1 + Math.cos(branches * a + phase + 0.28 * Math.sin(2 * a))) * 0.5;
            const r = radius * (0.86 + 0.14 * lobe + 0.025 * Math.sin(3 * a + phase));
            const lift = row / (rows.length - 1);
            const pocket = Math.sin(a + phase) * 0.45 + 0.20 * Math.sin(2 * a - phase);
            coords.push(r * Math.sin(a) + lean * y + dx * (1 - lift), y - dip * (lobe + pocket), r * Math.cos(a) + dz * (1 - lift));
            shade.setHex(col).multiplyScalar(0.93 + 0.07 * lobe);
            colors.push(shade.r, shade.g, shade.b);
            if (row) {
              const lo = first + (row - 1) * steps, n = (j + 1) % steps;
              triangles.push(lo + j, lo + n, lo + j + steps, lo + n, lo + n + steps, lo + j + steps);
            }
          }
        });
      }
      const lean = (variant - 1) * 0.052;
      tier([[0, 0.085, 0, 0x604d46], [0.39, 0.066, 0, 0x896b50]], 0, 3, lean);
      for (let i = 0; i < 4; i++) {
        const base = 0.28 + i * (0.335 + 0.016 * variant), h = 0.72 - i * 0.038;
        const width = (0.53 - i * 0.087) * (1 + (1 - variant) * 0.10);
        const row = (y, r, dip, col) => [base + y * h, r * width, dip * h, col];
        tier([row(0.02, 0.1, 0, 0x2c504c), row(0.12, 0.9, 0.1, 0x335853),
          row(0.23, 1, 0.19, 0x426e60), row(0.36, 0.92, 0.18, 0x527f6d),
          row(0.41, 0.94, 0.18, 0xb8d4dc), row(0.49, 0.87, 0.15, 0xe5efed),
          row(0.69, 0.54, 0.07, 0xf2f6f2), row(0.91, 0.19, 0.02, 0xf7f7f1),
          row(1, 0.012, 0, 0xf6f6ef)], 1.3 * i + variant, 5 + variant % 2, lean);
        // Side boughs taper back into the crown. Only some carry a full cap.
        if (i < 3) for (let j = 0; j < 2; j++) {
          const az = variant + 2.25 * i + 2.8 * j, off = width * (j ? 0.67 : 0.77);
          tier([row(0.13, 0.13, 0.04, 0x355d52), row(0.20, 0.38, 0.09, 0x487461),
            row(0.28, 0.39, 0.075, j ? 0x779687 : 0xbfdbde),
            row(0.41, 0.34, 0.06, j ? 0x94b0a1 : 0xe6efeb),
            row(0.64, 0.12, 0.02, 0xd7e6de), row(0.74, 0.01, 0, 0xe4efe7)],
          az, 3, lean, off * Math.sin(az), off * Math.cos(az));
        }
      }
      const g = new T.BufferGeometry();
      g.setIndex(triangles); g.setAttribute('position', new T.Float32BufferAttribute(coords, 3));
      g.setAttribute('color', new T.Float32BufferAttribute(colors, 3)); g.computeVertexNormals();
      winterFirs[variant] = g;
    }
    const fir = new T.Mesh(winterFirs[variant], U.mat(0xffffff, { vertexColors: true, roughness: 1 }));
    if (!firShadow) {
      const map = U.tex(64, 64, (c) => {
        const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
        g.addColorStop(0, 'rgba(81,113,133,0.29)'); g.addColorStop(0.5, 'rgba(107,137,151,0.18)');
        g.addColorStop(1, 'rgba(134,160,169,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64);
      });
      firShadow = new T.Mesh(new T.PlaneGeometry(1.5, 1.32), new T.MeshBasicMaterial({ map, transparent: true, depthWrite: false }));
      firShadow.rotation.x = -PI / 2; firShadow.position.y = 0.018;
    }
    fir.add(firShadow.clone());
    fir.scale.setScalar(scale); fir.rotation.y = firNumber * 2.39996;
    return fir;
  }

  // One seamless tile painted at startup. Each scene has its own repeat and scroll.
  let powder;
  function powderMap(across, along) {
    if (!powder) powder = U.tex(256, 256, (c, w, h) => {
      const r = U.rng(6482);
      c.fillStyle = '#e4edf4'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 24; i++) {
        const x = r() * w, y = r() * h, length = 18 + r() * 45, depth = 3 + r() * 10;
        const angle = -0.27 + r() * 0.17;
        for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) {
          c.save(); c.translate(x + dx, y + dy); c.rotate(angle); c.scale(length, depth);
          const brush = c.createRadialGradient(0, 0, 0, 0, 0, 1);
          brush.addColorStop(0, i % 3 ? 'rgba(255,251,242,0.6)' : 'rgba(151,185,207,0.34)');
          brush.addColorStop(1, 'rgba(223,235,242,0)');
          c.fillStyle = brush; c.fillRect(-1, -1, 2, 2); c.restore();
        }
      }
    });
    const map = powder.clone();
    map.wrapS = map.wrapT = T.RepeatWrapping; map.repeat.set(across, along);
    return map;
  }

  // A continuous silhouette sits beyond the tree line at all three camera angles.
  let fellMap;
  function fellBackdrop(scene) {
    if (!fellMap) fellMap = U.tex(1024, 128, (c, w, h) => {
      const r = U.rng(624);
      for (let layer = 0; layer < 2; layer++) {
        c.fillStyle = layer ? '#bcd2dc' : '#d5e1e8'; c.beginPath(); c.moveTo(0, h);
        for (let x = 0; x <= w; x += 4) {
          const y = 47 + 24 * layer + 11 * Math.sin(x * 0.017 + layer) + 7 * Math.cos(x * 0.029 - 2 * layer);
          c.lineTo(x, y);
        }
        c.lineTo(w, h); c.fill();
      }
      c.fillStyle = '#abc8d4'; c.beginPath(); c.moveTo(0, h);
      for (let x = 0; x <= w; x += 3) {
        const foot = 93 + 6 * Math.sin(x * 0.022);
        c.lineTo(x, foot); c.lineTo(x + 1.5, foot - 2 - 4 * r());
      }
      c.lineTo(w, h); c.fill();
    });
    const fell = new T.Mesh(new T.PlaneGeometry(136, 15), new T.MeshBasicMaterial({ map: fellMap, transparent: true, depthWrite: false, fog: false, toneMapped: false }));
    fell.position.set(0, 5.1, -62); fell.renderOrder = -1; scene.add(fell);
  }

  /* ================= Snowball Toss =================
     Like the old Paper Toss: flick the snowball at a bucket. The wind is shown, the arc is not.
     New wind every throw; the bucket stays where it is. Keep throwing until the third miss. Every basket counts. */
  const toss = (() => {
    const GRAV = 12, ELEV = 50 * PI / 180, SY = 0.8, SZ = 3.2, ZB = 0.4, RANGE = 5.253, BR = 0.14, RIM = 0.65, HIT = 0.85, RIM_Y = 0.62, WINDK = 0.855;   // HIT: the scoring circle is 30% wider than the bucket looks
    let view = null, ball = null, bucket = null, flag = null, cloth = null, puffs = null, sealSpot = null, windEl = null;
    const restPos = new T.Vector3(0, SY, SZ + ZB), onScreen = new T.Vector3(), edgePos = new T.Vector3(), upDir = new T.Vector3();   // where the snowball waits: the big wind sign hangs right above it
    let wind = 0, score = 0, top = 0, tries = 0, mode = 'ready', wait = 0, drag = null, dist = 5, prevY = 0, rimHit = false, spin = 0;
    const bv = new T.Vector3(), bk = new T.Vector3();

    function build() {
      view = stage('#8cc4f3', '#fff0de', { ground: 0xdde8ff, hemi: 2.2, key: 1.5 });
      const sc = view.scene;
      fellBackdrop(sc);
      sc.fog = new T.Fog(0xeef3fa, 24, 64);
      const ground = new T.Mesh(new T.PlaneGeometry(140, 140), new T.MeshStandardMaterial({ map: powderMap(19, 19), roughness: 1 }));
      ground.rotation.x = -PI / 2;
      sc.add(ground);
      for (let i = 0; i < 26; i++) {
        const t = winterFir(1.6 + rnd() * 1.6);
        const side = i < 16 ? 0 : i % 2 ? 1 : -1;
        if (!side) t.position.set(-16 + i * 2 + rs(0.8), 0, -16 - rnd() * 8);
        else t.position.set(side * (5 + rnd() * 6), 0, -12 + rnd() * 12);
        sc.add(t);
      }
      // A lake-blue enamel pail. The handle folds back behind the opening so
      // the bright lip stays visible throughout the throw.
      const enamel = U.tex(512, 128, (c, w, h) => {
        const body = c.createLinearGradient(0, 0, 0, h);
        body.addColorStop(0, '#447f8a'); body.addColorStop(0.18, '#73abb0');
        body.addColorStop(0.57, '#5c9ba3'); body.addColorStop(1, '#37707b');
        c.fillStyle = body; c.fillRect(0, 0, w, h);
        c.fillStyle = '#f9e4bb'; c.fillRect(0, 13, w, 4); c.fillRect(0, h - 19, w, 3);
        for (let j = 0; j < 10; j++) {
          c.save(); c.translate((j + 0.5) * w / 10, h * 0.51); c.scale(0.52, 1);
          c.strokeStyle = '#ffefd4'; c.lineWidth = 3; c.lineCap = 'round';
          for (let k = 0; k < 6; k++) {
            c.rotate(PI / 3); c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -17);
            c.moveTo(-4, -9); c.lineTo(0, -13); c.lineTo(4, -9); c.stroke();
          }
          c.restore();
        }
      });
      const tin = new T.MeshStandardMaterial({ map: enamel, roughness: 0.42, metalness: 0.08 });
      const lining = U.mat(0x3b6874, { side: T.BackSide, roughness: 0.65 });
      const rim = U.mat(0xffdead, { roughness: 0.38, metalness: 0.09 });
      const shell = new T.CylinderGeometry(RIM, RIM * 0.78, RIM_Y, 36, 1, true);
      bucket = U.group(U.mesh(shell, tin, 0, RIM_Y / 2, 0), U.mesh(shell, lining, 0, RIM_Y / 2, 0),
        U.rot(U.mesh(new T.CircleGeometry(RIM * 0.78, 32), U.mat(0x335865), 0, 0.025, 0), -PI / 2),
        U.rot(U.torus(RIM, 0.033, rim, 0, RIM_Y, 0, 2 * PI, 36), PI / 2),
        U.rot(U.torus(RIM * 0.79, 0.024, rim, 0, 0.046, 0), PI / 2));
      const bail = U.torus(RIM * 0.96, 0.021, U.mat(0x61757b), 0, RIM_Y * 0.80, 0, PI, 28);
      bail.rotation.x = -0.88;
      bucket.add(bail);
      for (const side of [-1, 1]) bucket.add(U.ball(0.044, rim, side * RIM * 0.95, bail.position.y, 0));
      const shadow = U.mesh(new T.CircleGeometry(1.04, 36), new T.MeshBasicMaterial({ color: 0x8196ac, transparent: true, opacity: 0.18, depthWrite: false }), 0, 0.01, 0);
      shadow.rotation.x = -PI / 2; shadow.scale.y = 0.83; bucket.add(shadow);
      sc.add(bucket);
      // a little flag shows which way the wind blows
      flag = new T.Group();
      flag.add(U.cyl(0.025, 0.025, 1.7, U.mat(PN.COL.woodDark), 0, 0.85, 0, 6));
      cloth = new T.Group();
      const pennant = new T.Shape();
      pennant.moveTo(-0.275, 0.16); pennant.quadraticCurveTo(0, 0.19, 0.275, 0.11);
      pennant.lineTo(0.15, -0.015); pennant.lineTo(0.275, -0.12);
      pennant.quadraticCurveTo(0.01, -0.09, -0.275, -0.16); pennant.closePath();
      const c = U.mesh(new T.ShapeGeometry(pennant), U.mat(0xc65040, { side: T.DoubleSide, roughness: 0.86 }), 0.275, 0, 0);
      flag.add(U.ball(0.054, rim, 0, 1.71, 0));
      cloth.add(c); cloth.userData.mesh = c;
      cloth.position.y = 1.5;
      flag.add(cloth);
      sc.add(flag);
      sealSpot = new T.Vector3();
      const packed = new T.SphereGeometry(BR, 28, 20), verts = packed.attributes.position;
      const colors = [], cool = new T.Color(0xb4cfdf), warm = new T.Color(0xfffbef), tint = new T.Color();
      for (let i = 0; i < verts.count; i++) {
        const x = verts.getX(i) / BR, y = verts.getY(i) / BR, z = verts.getZ(i) / BR;
        const fold = Math.sin(5 * x - 2 * z) * Math.cos(4 * y + 3 * z), r = BR * (1 + 0.035 * fold);
        verts.setXYZ(i, x * r, y * r, z * r);
        tint.copy(cool).lerp(warm, U.clamp(0.54 + 0.26 * y + 0.18 * fold, 0, 1));
        colors.push(tint.r, tint.g, tint.b);
      }
      packed.setAttribute('color', new T.Float32BufferAttribute(colors, 3)); packed.computeVertexNormals();
      ball = new T.Mesh(packed, U.mat(0xffffff, { vertexColors: true, roughness: 1 }));
      sc.add(ball);
      puffs = Puffs(sc, 40, 0xffffff, 1);
    }
    const lives = () => G.mumMode ? 5 : 3;
    const throwsLeft = () => tr(lives() - tries === 1 ? 'One miss left' : 'Misses left: {0}', lives() - tries);
    /* New wind, ready for the next throw. */
    function setUp() {
      dist = 5;   // the bucket never moves back
      wind = Math.round((G.mumMode ? 3 : 10) * Math.pow(grnd(), 1.2) * 10) / 10 * (grnd() < 0.5 ? -1 : 1);   // anywhere from 0 to 10, but strong winds come up much less often than gentle ones
      bk.set(0, 0, SZ - dist);
      bucket.position.copy(bk);
      const width = G.mumMode ? 1.35 : 1;
      bucket.scale.set(width, 1, width);
      flag.position.set(0.95, 0, bk.z - 0.2);
      view.rig.position.set(-1.05, 0, bk.z + 0.15);
      paintWind();
      ball.position.set(0, SY, SZ + ZB); ball.visible = true; ball.scale.setScalar(1);
      mode = 'ready'; rimHit = false;
      K.hint(throwsLeft());
      if (G.mumMode || K.tutoring()) aimYaw = solveYaw();
      if (!G.mumMode && throws === 3) K.beat('solo');
    }
    /* The wind, big, right above the snowball: how strong it is, and an arrow that grows with it and points the way it blows.
       The colours are the ones on the throwing guide. */
    function paintWind() {
      if (!windEl) { windEl = document.createElement('div'); windEl.className = 'tw'; windEl.setAttribute('aria-hidden', 'true'); document.getElementById('gamehud').appendChild(windEl); }
      const w = Math.abs(wind), col = ['#ffffff', '#bfe3ff', '#ffe08a', '#ffb066', '#ff7a6b'][Math.min(4, Math.round(w / 2.5))];
      windEl.style.setProperty('--tw', col);
      windEl.innerHTML = '<small>' + tr('Wind') + '</small><b>' + w.toFixed(1) + '</b>'
        + (w ? '<span class="tw-arrow ' + (wind > 0 ? 'r' : 'l') + '"><i style="width:' + Math.round(14 + w * 6.5) + 'px"></i><em></em></span>' : '');
    }
    function placeWind() {
      if (!windEl) return;
      windEl.hidden = mode === 'done';
      view.camera.updateMatrixWorld(true);
      onScreen.copy(restPos).project(view.camera);
      // The sign hangs from the very top of the snowball as it looks on this screen, so it never touches the ball, big or small
      edgePos.copy(restPos).addScaledVector(upDir.setFromMatrixColumn(view.camera.matrixWorld, 1), BR).project(view.camera);
      const rect = W.renderer.domElement.getBoundingClientRect();
      windEl.style.left = (rect.left + (onScreen.x * 0.5 + 0.5) * rect.width) + 'px';
      windEl.style.top = (rect.top + (-edgePos.y * 0.5 + 0.5) * rect.height) + 'px';
    }
    /* The aim line, for the first three throws of the tutorial: a dashed line from the snowball along exactly the swipe that drops it in the bucket
       with this wind, and a finger that flicks along it. The yaw that works is found by running the throw (the same steps the flight uses) for every angle. */
    let throws = 0, aimYaw = 0, aim = null;
    function solveYaw() {
      const v = Math.sqrt(GRAV * RANGE / Math.sin(2 * ELEV)), ch = Math.cos(ELEV) * v, h = 1 / 180;
      let bestYaw = 0, bestD = Infinity;
      for (let yaw = -1.25; yaw <= 1.25; yaw += 0.004) {
        let x = 0, y = SY, z = SZ + ZB, vx = Math.tan(yaw) * ch, vy = Math.sin(ELEV) * v, prev = SY;
        for (let i = 0; i < 1500; i++) {
          vx += wind * WINDK * h; vy -= GRAV * h;
          x += vx * h; y += vy * h; z -= ch * h;
          if (prev >= RIM_Y && y < RIM_Y) { const d = Math.hypot(x - bk.x, z - bk.z); if (d < bestD) { bestD = d; bestYaw = yaw; } break; }
          prev = y;
        }
      }
      return bestYaw;
    }
    function buildAim() {
      const el = document.createElement('div');
      el.className = 'tl'; el.setAttribute('aria-hidden', 'true');
      el.innerHTML = '<svg><line class="glow"/><line class="dash"/><polygon/><circle/><g class="fing">' + G.fingerShapes + '</g><text></text></svg>';
      const hud = document.getElementById('gamehud'); hud.insertBefore(el, hud.firstChild);   // first, so the wind sign hangs in front of it
      const q = (n) => el.querySelector(n);
      aim = { el, svg: q('svg'), glow: q('.glow'), dash: q('.dash'), head: q('polygon'), ring: q('circle'), fing: q('.fing'), label: q('text'), w: 0, h: 0 };
      aim.label.textContent = tr('Flick along the line');
    }
    function placeAim() {
      const show = (G.mumMode || (K.tutoring() && throws < 3)) && mode === 'ready';
      if (!aim) { if (!show) return; buildAim(); }
      aim.el.hidden = !show;
      if (!show) return;
      const rect = W.renderer.domElement.getBoundingClientRect(), w = window.innerWidth, h = window.innerHeight;
      if (aim.w !== w || aim.h !== h) { aim.svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h); aim.w = w; aim.h = h; }
      const sx = rect.left + (onScreen.x * 0.5 + 0.5) * rect.width, sy = rect.top + (-onScreen.y * 0.5 + 0.5) * rect.height;
      const ang = Math.abs(aimYaw) < 0.02 ? 0 : aimYaw + Math.sign(aimYaw) * 0.07;   // the swipe's own angle, past the small dead zone a swipe has to clear
      const dx = Math.sin(ang), dy = -Math.cos(ang);
      let len = U.clamp((sy - (rect.top + 120)) * 0.8, 120, 420);
      if (Math.abs(dx) > 0.01) len = Math.min(len, ((dx > 0 ? w - 34 - sx : sx - 34) / Math.abs(dx)));   // a strong wind leans the line a long way: keep its end on the screen
      const ex = sx + dx * len, ey = sy + dy * len, px = -dy, py = dx;
      [aim.glow, aim.dash].forEach((l) => { l.setAttribute('x1', sx); l.setAttribute('y1', sy); l.setAttribute('x2', ex); l.setAttribute('y2', ey); });
      aim.head.setAttribute('points', [ex, ey, ex - dx * 26 + px * 14, ey - dy * 26 + py * 14, ex - dx * 26 - px * 14, ey - dy * 26 - py * 14].map((n) => n.toFixed(1)).join(' '));
      aim.ring.setAttribute('cx', sx); aim.ring.setAttribute('cy', sy); aim.ring.setAttribute('r', 26);
      const t = (clock * 0.75) % 1.5, f = Math.min(1, t), e = f * f * (3 - 2 * f), k = 1.25;
      aim.fing.setAttribute('transform', 'translate(' + (sx + dx * len * e - 16 * k).toFixed(1) + ' ' + (sy + dy * len * e - 2 * k).toFixed(1) + ') scale(' + k + ')');
      aim.fing.style.opacity = t < 1.15 ? 1 : 0;
      aim.label.setAttribute('x', U.clamp(ex, 105, w - 105)); aim.label.setAttribute('y', ey - 34);
    }
    function launch(yaw) {
      const v = Math.sqrt(GRAV * RANGE / Math.sin(2 * ELEV)), ch = Math.cos(ELEV) * v;
      bv.set(Math.tan(yaw) * ch, Math.sin(ELEV) * v, -ch);   // a sideways shot keeps its full reach, so leaning into the wind never falls short
      mode = 'fly'; prevY = SY; spin = 8; throws++;
      A.play('whoosh');
      K.hint('');
    }
    function miss(text) {
      if (mode === 'out') return;
      mode = 'out'; wait = 0.9;
      A.play('nope'); actor.gesture('no', true);
      K.big(text);
    }
    function basket() {
      mode = 'in'; wait = 0.9;
      score++; K.shown(score);
      if (score > top) { top = score; K.result(top); }
      A.play('match'); A.play('thud', 0.1);
      puffs.emit(bk.x, RIM_Y + 0.1, bk.z, 10, 1.4, 0.09, 0.5, 4);
      actor.gesture(score % 5 === 0 ? 'clap' : 'happy', true);
      K.big(score % 5 === 0 ? String(score) + '!' : tr('In!'));
    }
    return {
      label: 'Baskets', back: true, nocount: true, hint: 'Flick the snowball into the bucket. Three misses and it is over.',
      snap() {                                        // the corner picture for an online race: the pail, the snowball and the wind, from above
        const r = (n) => Math.round(n * 100) / 100;
        return { b: ball && ball.visible ? [r(ball.position.x), r(ball.position.z), r(ball.position.y)] : null, k: [r(bk.x), r(bk.z)], w: wind, m: mode === 'fly' ? 1 : mode === 'in' ? 2 : mode === 'out' ? 3 : 0, t: tries, l: lives() };
      },
      view: () => view,
      start() {
        if (!view) build();
        cast(view, 0.42, true);
        face(0);
        score = 0; top = 0; tries = 0; throws = 0; puffs.clear();
        setUp();
      },
      stop() { if (aim) { aim.el.remove(); aim = null; } if (windEl) { windEl.remove(); windEl = null; } },
      go() {},
      pointer(type, x, y) {
        if (mode !== 'ready') return;
        if (type === 'down') { drag = { x, y, t: performance.now() }; return; }
        if (!drag || type !== 'up') return;
        const dx = x - drag.x, dy = y - drag.y;
        drag = null;
        if (dy > (G.mumMode ? -16 : -30) || Math.hypot(dx, dy) < (G.mumMode ? 22 : 40)) return;           // a flick has to go up the screen
        // like Paper Toss: the swipe's own angle is the throw's angle, one to one. A swipe within about 4 degrees of
        // straight goes dead straight. Wind 10 needs a lean of about 45 degrees, and each point is roughly 4.5 degrees.
        const ang = Math.atan2(dx, -dy);
        launch(U.clamp(Math.sign(ang) * Math.max(0, Math.abs(ang) - 0.07), -1.25, 1.25));
      },
      update(dt, playing) {
        clock += dt;
        lens(view);
        view.camera.position.set(0, 2.1, SZ + 2.6);
        // On a short or wide screen the view is shallow and the snowball slips down behind the hint, or off the bottom. Tip the
        // camera down until the ball sits no lower than about four fifths of the way down, with room under it for the hint.
        // (A tall phone keeps the tip it always had, 11.5 degrees.)
        const tip = Math.max(11.5, 30.6 - 0.62 * view.camera.fov / 2) * PI / 180;
        view.camera.lookAt(0, 2.1 - 10 * Math.sin(tip), SZ + 2.6 - 10 * Math.cos(tip));
        placeWind();
        placeAim();
        // the flag streams out with the wind
        const w = Math.abs(wind) / 10;
        cloth.rotation.y = wind >= 0 ? 0 : PI;
        cloth.rotation.z = -1.3 * (1 - Math.min(1, w * 1.6));
        cloth.userData.mesh.rotation.y = Math.sin(clock * (4 + 8 * w)) * (0.1 + 0.35 * w);
        if (mode === 'ready') ball.position.y = SY + Math.sin(clock * 3) * 0.02;
        if (mode === 'fly' || mode === 'out' && ball.visible && bv.lengthSq() > 0.01) {
          const steps = 3, h = dt * (G.mumMode ? 0.78 : 1) / steps, hit = G.mumMode ? 1.25 : HIT;
          for (let i = 0; i < steps; i++) {
            bv.x += wind * WINDK * h   /* a point of wind pushes the snowball about a quarter of a metre off line; 10 is a hard but possible shove */; bv.y -= GRAV * h;
            ball.position.addScaledVector(bv, h);
            const p = ball.position, d = Math.hypot(p.x - bk.x, p.z - bk.z);
            ball.rotation.x -= spin * h;
            if (mode === 'fly' && prevY >= RIM_Y && p.y < RIM_Y) {
              if (d < hit - BR * 0.5) { p.set(bk.x + (p.x - bk.x) * 0.5, RIM_Y - 0.25, bk.z + (p.z - bk.z) * 0.5); bv.set(0, 0, 0); basket(); break; }
              if (d < hit + BR) {                                      // clang off the rim
                A.play('tap'); A.play('thud', 0.1);
                const ox = (p.x - bk.x) / (d || 1), oz = (p.z - bk.z) / (d || 1);
                bv.set(ox * 2.2, Math.abs(bv.y) * 0.4, oz * 2.2);
                p.y = RIM_Y + 0.01; rimHit = true;
                miss(tr('So close!'));
              }
            }
            if (mode === 'fly' && p.y < RIM_Y && d < hit + BR && d > hit - BR) { bv.x *= -0.4; bv.z *= -0.4; miss(tr('So close!')); }
            prevY = p.y;
            if (p.y < BR) {
              p.y = BR;
              puffs.emit(p.x, BR, p.z, 6, 1.1, 0.09, 0.45, 5);
              bv.set(0, 0, 0);
              if (mode === 'fly') miss(tr('Miss'));
              break;
            }
          }
        }
        if ((mode === 'in' || mode === 'out') && playing) {
          wait -= dt;
          if (wait <= 0) {
            if (mode === 'out') tries++;
            if (tries >= lives()) { mode = 'done'; K.over(tr(score >= 15 ? 'Wow!' : score >= 5 ? 'Nice!' : 'Done!')); }
            else setUp();
          }
        }
        puffs.update(dt);
        actor.update(dt, clock, null);
      },
    };
  })();

  /* ================= Curling Seal ================= */
  const curl = (() => {
    const MU = 2.4, START_Z = 3, BANK = 3.0, R = 0.45, FAR = -13.5, SLIDES = 8;
    let view = null, rings = null, arrow = null, shaft = null, tipA = null, blocks = [], puffs = null;
    let left = 0, aim = null, mode = 'aim', n = 0, rest = 0, score = 0, trail = 0;
    const pos = { x: 0, z: START_Z }, vel = { x: 0, z: 0 }, target = { x: 0, z: -6 };

    function build() {
      view = stage('#9cc8f6', '#f4f8ff', { ground: 0xdde8ff, hemi: 2.2, key: 1.5 });
      const sc = view.scene;
      fellBackdrop(sc);
      sc.fog = new T.Fog(0xeef4fb, 26, 70);
      const snow = new T.Mesh(new T.PlaneGeometry(140, 140), new T.MeshStandardMaterial({ map: powderMap(19, 19), roughness: 1 }));
      snow.rotation.x = -PI / 2; snow.position.y = -0.03;
      const rink = U.tex(384, 1024, (c, w, h) => {
        const r = U.rng(487), sheet = c.createLinearGradient(0, 0, w, 0);
        sheet.addColorStop(0, '#afcdd8'); sheet.addColorStop(0.12, '#c4e0e7');
        sheet.addColorStop(0.54, '#d5e8eb'); sheet.addColorStop(0.90, '#c1dce5'); sheet.addColorStop(1, '#abcbd7');
        c.fillStyle = sheet; c.fillRect(0, 0, w, h);
        c.lineCap = 'round';
        for (let i = 0; i < 95; i++) {
          const x = r() * w, y = r() * h, len = 10 + r() * 62, bend = r() * 20 - 10;
          c.strokeStyle = i % 4 ? 'rgba(255,255,251,0.34)' : 'rgba(119,170,186,0.20)';
          c.lineWidth = 0.7 + r() * 1.3;
          c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + bend, y + len * 0.6, x + bend * 1.6, y + len); c.stroke();
        }
        for (const side of [0.045, 0.955]) {
          c.fillStyle = '#9abdc9'; c.fillRect(w * side - 1, 0, 2, h);
          for (let y = 36; y < h; y += 32) c.fillRect(w * side + (side < 0.5 ? 0 : -7), y, 7, 1.5);
        }
      });
      const ice = new T.Mesh(new T.PlaneGeometry(BANK * 2 + 0.6, 26), new T.MeshStandardMaterial({ map: rink, roughness: 0.36 }));
      ice.rotation.x = -PI / 2; ice.position.z = -4;
      sc.add(snow, ice);
      const bankM = U.mat(0xffffff, { roughness: 1 });
      [-1, 1].forEach((sd) => {
        sc.add(U.ball(1, bankM, sd * (BANK + 0.95), -0.1, -4, 0.9, 0.55, 14, 16));
        for (let i = 0; i < 9; i++) { const t = winterFir(1.4 + rnd() * 1.4); t.position.set(sd * (BANK + 2.2 + rnd() * 5), 0, 5 - i * 2.6 + rs(0.8)); sc.add(t); }
      });
      for (let i = 0; i < 12; i++) { const t = winterFir(1.8 + rnd() * 1.5); t.position.set(-11 + i * 2 + rs(0.6), 0, -19 - rnd() * 6); sc.add(t); }
      sc.add(U.box(BANK * 2, 0.012, 0.09, U.glow(0xd8382f), 0, 0.006, START_Z - 0.9));
      const tex = U.tex(256, 256, (c) => {
        const ring = (r, col) => { c.fillStyle = col; c.beginPath(); c.arc(128, 128, r * 126 / 2.0, 0, PI * 2); c.fill(); };
        ring(2.0, '#315c8b'); ring(1.96, '#477cac'); ring(1.60, '#f7f4e9');
        ring(1.20, '#bb5348'); ring(1.16, '#ce6859'); ring(0.85, '#f7f4e9');
        ring(0.55, '#edba64'); ring(0.12, '#354d62');
        // Fine registration marks stay inside the printed house as it moves and scales.
        c.strokeStyle = 'rgba(255,251,229,0.8)'; c.lineWidth = 2;
        for (let i = 0; i < 16; i++) {
          const a = i * PI / 8, inner = i % 4 ? 119 : 114;
          c.beginPath(); c.moveTo(128 + inner * Math.cos(a), 128 + inner * Math.sin(a));
          c.lineTo(128 + 123 * Math.cos(a), 128 + 123 * Math.sin(a)); c.stroke();
        }
      });
      rings = new T.Mesh(new T.CircleGeometry(2.0, 48), new T.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.92, toneMapped: false }));
      rings.rotation.x = -PI / 2; rings.position.y = 0.012;
      sc.add(rings);
      arrow = new T.Group();
      const gold = U.glow(0xf0b429);
      shaft = U.box(0.13, 0.02, 1, gold, 0, 0, -0.5);
      const sh = new T.Group(); sh.add(shaft);
      tipA = U.cone(0.26, 0.5, gold, 0, 0, 0, 3); tipA.rotation.x = -PI / 2; tipA.scale.y = 1;
      arrow.add(sh, tipA); arrow.userData.sh = sh;
      arrow.position.y = 0.04; arrow.visible = false;
      sc.add(arrow);
      // Bevel the slab inside its existing collision footprint. Its blue sides
      // stand out from the flat sheet, with a pale frost line beneath the cap.
      const blockFace = new T.Shape();
      blockFace.moveTo(-0.62, 0.04); blockFace.lineTo(0.60, 0.04); blockFace.lineTo(0.62, 0.43);
      blockFace.lineTo(0.47, 0.55); blockFace.lineTo(-0.43, 0.57); blockFace.lineTo(-0.62, 0.48);
      blockFace.closePath();
      const blockGeo = new T.ExtrudeGeometry(blockFace, { depth: 0.43, bevelEnabled: true, bevelSegments: 2, bevelSize: 0.025, bevelThickness: 0.025 });
      blockGeo.translate(0, 0, -0.215);
      const frost = new T.Color(0xc5e6e8), deep = new T.Color(0x6399b7), tone = new T.Color(), iceColors = [];
      const faces = blockGeo.attributes.position;
      for (let i = 0; i < faces.count; i++) {
        const y = faces.getY(i), x = faces.getX(i);
        const vein = 0.15 * Math.exp(-Math.pow((y - 0.28 - 0.05 * x) / 0.07, 2));
        tone.copy(deep).lerp(frost, U.clamp(y * 1.25 + vein, 0, 1)); iceColors.push(tone.r, tone.g, tone.b);
      }
      blockGeo.setAttribute('color', new T.Float32BufferAttribute(iceColors, 3));
      for (let i = 0; i < 2; i++) {
        const b = U.group(U.mesh(blockGeo, U.mat(0xffffff, { vertexColors: true, roughness: 0.38 })),
          U.ball(1, bankM, 0, 0.565, 0, 0.62, 0.075, 0.24, 18));
        b.visible = false;
        sc.add(b);
        blocks.push({ g: b, on: false, x: 0, z: 0, ph: 0, sp: 1.6 });
      }
      puffs = Puffs(sc, 40, 0xffffff, 1);
    }
    function next() {
      n++;
      G.reseed(n);
      target.x = n === 1 ? 0 : grs(G.mumMode ? 0.6 : 1.5);
      target.z = n === 1 || G.mumMode ? -6.5 : -(5 + grnd() * 5);
      rings.position.set(target.x, 0.012, target.z);
      const size = G.mumMode ? 1.4 : 1;
      rings.scale.set(size, size, 1);
      pos.x = 0; pos.z = START_Z; vel.x = vel.z = 0;
      mode = 'aim'; aim = null;
      const count = G.mumMode ? 0 : n >= 6 ? 2 : n >= 3 ? 1 : 0;
      blocks.forEach((b, i) => {
        b.on = i < count; b.g.visible = b.on;
        b.z = U.lerp(START_Z, target.z, i ? 0.72 : 0.42); b.ph = grnd() * 6; b.sp = 1.3 + grnd() * 0.9;
      });
      face(PI);
      if (count) K.beat('blocks');
    }
    function stop(text, pts, sad) {
      mode = 'rest'; rest = 1.15; vel.x = vel.z = 0;
      score += pts;
      if (pts) K.score(score);
      K.big(text);
      if (sad) { A.play('thud'); actor.gesture('shake', true); puffs.emit(pos.x, 0.3, pos.z, 8, 1.6, 0.12, 0.5, 5); }
      else if (pts) { A.play(pts === 5 ? 'award' : 'match'); actor.gesture('happy', true); }
      else { A.play('nope'); actor.gesture('sad', true); }
      K.beat('stopped');
    }
    return {
      label: 'Points', label2: 'Slides', hint: 'Pull back and let go to slide.',
      snap() {                                        // the corner picture for an online race: the ice from above
        const r = (n) => Math.round(n * 100) / 100;
        return { p: [r(pos.x), r(pos.z)], g: [r(target.x), r(target.z)], bl: blocks.filter((b) => b.on).map((b) => [r(b.x), r(b.z)]), n, m: mode === 'slide' ? 1 : 0 };
      },
      view: () => view,
      start() {
        if (!view) build();
        cast(view, 0.6, true);
        left = SLIDES; n = 0; score = 0;
        K.time(left);
        puffs.clear(); arrow.visible = false;
        next();
      },
      go() {},
      pointer(type, x, y) {
        if (mode !== 'aim') return;
        if (type === 'down') { aim = pull(null, 'down', x, y); return; }
        if (!aim) return;
        pull(aim, type, x, y, 0.5);
        if (type === 'up') {
          if (aim.p > 0.08) {
            const v = 3 + 7 * aim.p;
            vel.x = Math.sin(aim.yaw) * v; vel.z = -Math.cos(aim.yaw) * v;
            mode = 'slide'; left--; K.time(left); K.hint('');
            A.play('whoosh');
          }
          aim = null;
        }
      },
      update(dt, playing) {
        clock += dt;
        lens(view);
        // Back the camera off along its line of sight until her start spot clears the hint line: on a short or wide screen the narrow lens
        // used to leave her below the bottom edge. A tall phone needs hardly any (k is about 1).
        const half = Math.tan(view.camera.fov * PI / 360), tk = Math.tan(Math.atan2(6.4, 15) + Math.atan(0.62 * half));
        const back = Math.max(1, 8.2 * tk / (15 * tk - 6.4));
        view.camera.position.set(0, 6.4 * back, -5.2 + 15 * back); view.camera.lookAt(0, 0, -5.2);
        blocks.forEach((b) => {
          if (!b.on) return;
          b.x = Math.sin(clock * b.sp + b.ph) * 2.2;
          b.g.position.set(b.x, 0, b.z);
        });
        const show = mode === 'aim' && !!aim && aim.p > 0.03 && playing;
        arrow.visible = show;
        if (show) {
          const len = 0.6 + aim.p * 2.4;
          arrow.position.set(pos.x, 0.04, pos.z - 0.2);
          arrow.rotation.y = -aim.yaw;
          arrow.userData.sh.scale.z = len;
          tipA.position.z = -len - 0.2;
          face(PI - aim.yaw);
        }
        if (mode === 'slide') {
          const motion = dt * (G.mumMode ? 0.75 : 1), sp = Math.hypot(vel.x, vel.z), dec = MU * motion;
          if (sp <= dec) {
            const d = Math.hypot(pos.x - target.x, pos.z - target.z) / rings.scale.x;
            const pts = d < 0.55 ? 5 : d < 1.2 ? 3 : d < 2.0 ? 1 : 0;
            stop(pts === 5 ? tr('Bullseye!') : pts ? '+' + pts : tr('Miss'), pts, false);
          } else {
            const k = (sp - dec) / sp;
            vel.x *= k; vel.z *= k;
            pos.x += vel.x * motion; pos.z += vel.z * motion;
            face(Math.atan2(vel.x, vel.z));
            trail -= dt;
            if (trail <= 0 && sp > 1.5) { trail = 0.06; puffs.emit(pos.x, 0.08, pos.z + 0.3, 1, 0.5, 0.07, 0.4, 2); }
            if (Math.abs(pos.x) > BANK - R || pos.z < FAR) stop(tr('Out!'), 0, true);
            else blocks.forEach((b) => {
              if (mode === 'slide' && b.on && Math.abs(pos.x - b.x) < 0.65 + R * 0.8 && Math.abs(pos.z - b.z) < 0.25 + R) stop(tr('Bonk!'), 0, true);
            });
          }
        } else if (mode === 'rest' && playing) {
          rest -= dt;
          if (rest <= 0) { if (left <= 0) { mode = 'done'; K.over(tr(score >= 20 ? 'Wow!' : 'Time!')); } else next(); }
        }
        view.rig.position.set(pos.x, 0, pos.z);
        puffs.update(dt);
        actor.update(dt, clock, null);
      },
    };
  })();

  /* ================= Sled Run ================= */
  const sled = (() => {
    const SPAWN = -52, GONE = 9, LEN = 90, REP = 14;
    let view = null, gtex = null, board = null, puffs = null, piste = null, banks = [];
    const pool = { tree: [], rock: [], fish: [], ramp: [] };
    let live = [], track = 2.1, x = 0, tx = 0, vx = 0, dist = 0, bonus = 0, rowAt = 0, free = 2, air = 0, dead = false, going = false, shown = -1, rows = 0, spray = 0;
    let wide = false, perPx = 0.012, lastPx = null, saves = 0;
    /* The lane and the finger, sized from the screen. Upright, the lane fills most of the width and the finger picks a spot on it.
       On a wide screen that same lane would be far too wide for the seal to keep up, so there it stays about as wide as it is upright
       and the seal slides exactly as far as the finger does (perPx is one screen pixel, in world units, at the seal). */
    const DEPTH = 9.86;                                  // how far in front of the camera the seal sits
    function fit(hh) {
      wide = W.aspect > 1.05;
      track = U.clamp(Math.tan(hh) * 10 * 0.78, 1.5, 2.1);
      perPx = Math.tan(hh) * DEPTH / (window.innerWidth / 2);
    }

    function build() {
      view = stage('#84bcf0', '#f7fbff', { ground: 0xdde8ff, hemi: 2.2, key: 1.5 });
      const sc = view.scene;
      fellBackdrop(sc);
      sc.fog = new T.Fog(0xf1f6fd, 24, 54);
      gtex = powderMap(9, REP);
      const ground = new T.Mesh(new T.PlaneGeometry(90, LEN), new T.MeshStandardMaterial({ map: gtex, roughness: 1 }));
      ground.rotation.x = -PI / 2; ground.position.z = -LEN / 2 + 12;
      sc.add(ground);
      // Long, faint runner grooves give the snow a sense of motion. Their
      // curves close at the tile seam so the trail can scroll continuously.
      const trailTex = U.tex(256, 512, (c, w, h) => {
        const gr = c.createLinearGradient(0, 0, w, 0);
        gr.addColorStop(0, 'rgba(163,188,206,0)'); gr.addColorStop(0.11, 'rgba(163,188,206,0.34)');
        gr.addColorStop(0.28, 'rgba(216,230,238,0.52)'); gr.addColorStop(0.68, 'rgba(234,239,239,0.46)');
        gr.addColorStop(0.9, 'rgba(173,198,213,0.35)'); gr.addColorStop(1, 'rgba(173,198,213,0)');
        c.fillStyle = gr; c.fillRect(0, 0, w, h);
        for (const base of [76, 95, 169, 188]) {
          for (const highlight of [false, true]) {
            c.lineWidth = highlight ? 1.3 : 2.4;
            c.strokeStyle = highlight ? 'rgba(255,252,242,0.55)' : 'rgba(142,169,188,0.24)';
            c.beginPath();
            for (let y = 0; y <= h; y += 4) {
              const t = y / h * 2 * PI, x = base + (base < 128 ? 11 * Math.sin(t) : 8 * Math.cos(t + 0.6)) + (highlight ? 1.8 : 0);
              if (y) c.lineTo(x, y); else c.moveTo(x, y);
            }
            c.stroke();
          }
        }
      });
      trailTex.wrapT = T.RepeatWrapping; trailTex.repeat.y = 8;
      piste = U.mesh(new T.PlaneGeometry(1, LEN), new T.MeshStandardMaterial({ map: trailTex, transparent: true, depthWrite: false, roughness: 1 }), 0, 0.012, -LEN / 2 + 12);
      piste.rotation.x = -PI / 2; sc.add(piste);
      const profile = [[0, 0, 0xc9dce6], [0.4, 0.08, 0xd5e3ea], [1.1, 0.27, 0xeaf0f2], [2.4, 0.48, 0xf5f5ee], [5, 0.27, 0xd9e6ec], [18, 0.10, 0xe2ecf2]];
      for (const side of [-1, 1]) {
        const points = [], colors = [], indices = [], tint = new T.Color();
        for (let j = 0; j <= 80; j++) {
          const phase = j * PI / 8 + side * 0.9;
          for (const [radius, height, color] of profile) {
            const swell = 1 + 0.21 * Math.sin(phase) + 0.10 * Math.sin(phase * 2 + 0.5);
            points.push(side * radius * (0.78 + 0.22 * swell), height * swell, 25 - j * 1.5);
            tint.setHex(color); colors.push(tint.r, tint.g, tint.b);
          }
          if (j === 80) break;
          for (let i = 0; i < profile.length - 1; i++) {
            const a = j * profile.length + i, b = a + profile.length;
            if (side > 0) indices.push(a, a + 1, b, a + 1, b + 1, b);
            else indices.push(a, b, a + 1, a + 1, b, b + 1);
          }
        }
        const geo = new T.BufferGeometry();
        geo.setAttribute('position', new T.Float32BufferAttribute(points, 3)); geo.setIndex(indices);
        geo.setAttribute('color', new T.Float32BufferAttribute(colors, 3)); geo.computeVertexNormals();
        const bank = U.mesh(geo, U.mat(0xffffff, { vertexColors: true, roughness: 1 }));
        bank.userData.side = side; banks.push(bank); sc.add(bank);
      }

      const birch = new T.MeshStandardMaterial({ color: 0xd6a069, map: U.surfaceTex('wood'), roughness: 0.7 });
      const runner = U.mat(0x825a47), paint = U.mat(0xbc5546);
      board = new T.Group();
      // Five birch slats and two bent runners follow the same upturned nose.
      for (let i = -2; i <= 2; i++) {
        const x = i * 0.126;
        board.add(U.box(0.118, 0.054, 1.46, birch, x, 0.074, 0.06),
          U.rot(U.box(0.118, 0.054, 0.38, birch, x, 0.163, -0.83), 0.55));
      }
      for (const x of [-0.22, 0.22]) {
        const points = [[0.80, 0.01], [0.30, 0.012], [-0.50, 0.013], [-0.76, 0.045], [-0.95, 0.17], [-0.98, 0.30]];
        const rail = new T.CatmullRomCurve3(points.map(([z, y]) => new T.Vector3(x, y, z)));
        board.add(new T.Mesh(new T.TubeGeometry(rail, 20, 0.027, 8, false), runner));
      }
      board.add(U.box(0.63, 0.035, 0.10, paint, 0, 0.117, 0.64),
        U.rot(U.box(0.63, 0.035, 0.085, paint, 0, 0.244, -0.92), 0.55));
      sc.add(board);
      const rockM = U.mat(0x7f8894, { roughness: 1 }), capM = U.mat(0xffffff, { roughness: 1 });
      for (let i = 0; i < 64; i++) pool.tree.push({ m: winterFir(1), kind: 'tree' });
      for (let i = 0; i < 12; i++) pool.rock.push({ m: U.group(U.ball(0.42, rockM, 0, 0.2, 0, 1, 0.7, 0.9, 10), U.ball(0.36, capM, 0, 0.36, 0, 1, 0.4, 0.85, 10)), kind: 'rock' });
      const look = PN.items.ahven.look;
      for (let i = 0; i < 6; i++) {
        const f = PN.Props.fish(look, true);
        f.scale.setScalar(0.6);
        pool.fish.push({ m: U.group(f), kind: 'fish', inner: f });
      }
      const rampTex = U.tex(128, 128, (c, w, h) => {
        c.fillStyle = '#d8e8ed'; c.fillRect(0, 0, w, h);
        c.fillStyle = '#99b9c9'; c.fillRect(0, 0, 5, h); c.fillRect(w - 5, 0, 5, h);
        c.strokeStyle = '#ca7057'; c.lineWidth = 6; c.lineJoin = 'round'; c.lineCap = 'round';
        for (const y of [51, 81]) {
          c.beginPath(); c.moveTo(39, y); c.lineTo(64, y - 14); c.lineTo(89, y); c.stroke();
        }
      });
      const rampM = new T.MeshStandardMaterial({ map: rampTex, roughness: 0.65 });
      for (let i = 0; i < 3; i++) {
        const r = U.group(U.rot(U.box(1.1, 0.08, 1.3, rampM, 0, 0.22, 0), 0.34),
          U.rot(U.box(1.12, 0.09, 0.14, paint, 0, 0.4, -0.52), 0.34));
        pool.ramp.push({ m: r, kind: 'ramp' });
      }
      Object.keys(pool).forEach((k) => pool[k].forEach((it) => { it.m.visible = false; it.live = false; sc.add(it.m); }));
      puffs = Puffs(sc, 50, 0xffffff, 1);
    }
    function put(kind, px, pz, r, sc) {
      const it = pool[kind].find((o) => !o.live);
      if (!it) return null;
      it.live = true; it.x = px; it.z = pz; it.r = r;
      it.m.visible = true; it.m.position.set(px, 0, pz);
      if (kind === 'tree') it.m.scale.setScalar(sc || 1);
      live.push(it);
      return it;
    }
    const lane = (i) => -track + i * track / 2;
    function row(z) {
      rows++;
      // the forest either side
      put('tree', -(track + 1.0 + rnd() * 1.4), z + rs(1), 0, 1.2 + rnd() * 0.9);
      put('tree', track + 1.0 + rnd() * 1.4, z + rs(1), 0, 1.2 + rnd() * 0.9);
      put('tree', (rows % 2 ? 1 : -1) * (track + 3.2 + rnd() * 4), z + rs(1.5), 0, 1.5 + rnd() * 1.2);
      if (rows < 3) return;
      // one lane is always open, and never far from the last open one
      free = U.clamp(free + Math.round(grs(2.4)), 0, 4);
      const count = G.mumMode ? 1 : 1 + (grnd() < 0.6 ? 1 : 0) + (dist > 150 && grnd() < 0.35 ? 1 : 0);
      const lanes = [0, 1, 2, 3, 4].filter((i) => i !== free);
      for (let i = lanes.length - 1; i > 0; i--) { const j = Math.floor(grnd() * (i + 1)); const t = lanes[i]; lanes[i] = lanes[j]; lanes[j] = t; }   // a shuffle that gives the same result on every browser
      lanes.slice(0, count).forEach((i) => {
        if (grnd() < 0.65) put('tree', lane(i) + grs(0.22), z + grs(0.7), 0.4, 0.95 + grnd() * 0.3);
        else put('rock', lane(i) + grs(0.22), z + grs(0.7), 0.36);
      });
      const r = grnd();
      if (r < 0.3) put('fish', lane(free), z, 0.45);
      else if (r < 0.4) put('ramp', lane(free), z, 0.5);
    }
    function crash() {
      dead = true;
      A.play('thud'); A.play('sneeze');
      actor.gesture('surprise', true);
      puffs.emit(x, 0.4, -0.3, 18, 3, 0.16, 0.7, 6);
      K.over(tr(dist > 300 ? 'Wow!' : 'Crash!'));
    }
    return {
      label: 'Metres', hint: 'Slide your finger to steer.',
      view: () => view,
      start() {
        if (!view) build();
        cast(view, 0.6, true);
        face(PI);
        live.forEach((it) => { it.live = false; it.m.visible = false; });
        live = [];
        puffs.clear();
        x = tx = vx = 0; dist = 0; bonus = 0; free = 2; air = 0; dead = false; going = false; shown = -1; rows = 0; lastPx = null;
        fit(lens(view));
        saves = G.mumMode ? 2 : 0;
        const spacing = G.mumMode ? 9 : 6;
        for (let z = -spacing; z > SPAWN; z -= spacing) row(z);
        rowAt = 0;
      },
      go() { going = true; A.play('whoosh'); },
      snap() {                                      // the corner picture for an online race
        const r2 = (n) => Math.round(n * 100) / 100, items = [];
        ['tree', 'rock', 'fish', 'ramp'].forEach((kind, k) => pool[kind].forEach((o) => {
          if (o.live && o.r > 0 && o.z > -24 && o.z < 4 && Math.abs(o.x) <= track + 0.4) items.push([k, r2(o.x / track), r2(o.z)]);
        }));
        return { x: r2(x / track), it: items.slice(0, 24), v: dead ? 0 : going ? r2(9 + Math.min(9, dist / 60)) : 3, d: dead ? 1 : 0 };
      },
      pointer(type, px) {
        if (type === 'up') { lastPx = null; return; }
        if (!wide) { tx = U.clamp((px / window.innerWidth * 2 - 1) * track * 1.15, -track, track); return; }
        if (type === 'down' || lastPx === null) { lastPx = px; return; }     // touching down only picks the finger up
        tx = U.clamp(tx + (px - lastPx) * perPx, -track, track);
        lastPx = px;
      },
      update(dt, playing) {
        clock += dt;
        fit(lens(view));
        view.camera.position.set(0, 4.6, 9); view.camera.lookAt(0, 0.5, -7);
        const speed = dead ? 0 : going ? (G.mumMode ? 5.5 + Math.min(2, dist / 100) : 9 + Math.min(9, dist / 60)) : 3;
        const dz = speed * dt;
        gtex.offset.y = (gtex.offset.y + dz * REP / LEN) % 1;
        const trailMap = piste.material.map;
        trailMap.offset.y = (trailMap.offset.y + dz * trailMap.repeat.y / LEN) % 1;
        piste.scale.x = track * 2 + 1.4;
        banks.forEach((bank) => { bank.position.x = bank.userData.side * (track + 0.55); bank.position.z = (bank.position.z + dz) % 24; });
        if (going && !dead) {
          dist += dz;
          const key = K.keys();
          if (key) tx = U.clamp(tx + key * 8 * dt, -track, track);
          tx = U.clamp(tx, -track, track);
          const maxV = wide ? 16 : 9;                                      // how fast the seal may slide sideways
          const want = U.damp(x, tx, wide ? 22 : 12, dt), step = U.clamp(want - x, -maxV * dt, maxV * dt);
          x += step; vx = step / dt;
          if (air > 0) air -= dt;
          rowAt -= dz;
          if (rowAt <= 0) { rowAt += G.mumMode ? 9 : Math.max(4.8, 6.5 - dist / 250); row(SPAWN); }
          const m = Math.floor(dist) + bonus;
          if (m !== shown) { shown = m; K.score(m, true); if (m === 40) K.hint(''); }
          spray -= dt;
          if (spray <= 0 && air <= 0) { spray = 0.05; puffs.emit(x + rs(0.25), 0.1, 0.7, 1, 0.7, 0.08, 0.35, 3); }
        } else vx = 0;
        // everything on the hill comes up to meet the seal
        for (let i = live.length - 1; i >= 0; i--) {
          const it = live[i];
          it.z += dz;
          it.m.position.z = it.z;
          if (it.kind === 'fish') { it.inner.rotation.y += dt * 3; it.inner.position.y = 0.55 + Math.sin(clock * 4 + it.x) * 0.08; }
          if (it.z > GONE) { it.live = false; it.m.visible = false; live.splice(i, 1); continue; }
          if (!playing || dead || !it.r || air > 0) continue;
          const margin = G.mumMode && (it.kind === 'tree' || it.kind === 'rock') ? 0.12 : 0.3;
          if (Math.abs(it.z + 0.2) < 0.55 && Math.abs(it.x - x) < it.r + margin) {
            if (it.kind === 'fish') {
              it.live = false; it.m.visible = false; live.splice(i, 1);
              bonus += 10; K.big('+10'); A.play('gulp'); K.beat('fish');
              K.score(Math.floor(dist) + bonus);
            } else if (it.kind === 'ramp') {
              it.r = 0; air = 0.9; bonus += 20;
              K.big(tr('Jump!')); A.play('boing'); K.beat('ramp');
              K.score(Math.floor(dist) + bonus);
            } else if (saves > 0) {
              saves--; it.r = 0;
              A.play('thud', 0.4);
              K.big(tr('Keep going!'));
            } else crash();
          }
        }
        const y = air > 0 ? Math.sin((1 - air / 0.9) * PI) * 1.3 : 0;
        view.rig.position.set(x, y + 0.08, 0);
        view.rig.rotation.z = U.damp(view.rig.rotation.z, U.clamp(-vx * 0.045, -0.5, 0.5), 10, dt);
        face(PI - U.clamp(vx * 0.04, -0.4, 0.4));
        board.position.set(x, y, 0); board.rotation.z = view.rig.rotation.z; board.rotation.y = -U.clamp(vx * 0.04, -0.4, 0.4);
        puffs.update(dt, 0, dz);
        actor.update(dt, clock, null);
      },
    };
  })();

  /* ---------- Blackjack ----------
     Bet from 5 tokens up to all in, hit or stand, beat the dealer without going over 21. A win pays back 3.5 times the bet
     (your bet plus 2.5 times more). You sit down with ten tokens and play until you cash out, they are all gone, or the house
     runs out at 50 tokens of winnings. Only the winnings turn into coins, 0.7 a token (data.js), so at most 35 a visit.
     Tuned by simulating thousands of visits with the hit-under-16, stand-on-16 rule: small, steady bets make about 27 coins
     a minute, like the other games, and bolder betting pays about the same on average but far more often ends with nothing.
     The dealer is quick and the next bet is ready the moment a hand is over, so a hand takes about four seconds. */
  const bj = (() => {
    const START = 10, MIN = 5, PAY = 3.5, CAP = 50;    // the house can pay out 50 tokens of winnings (25 coins), then the table closes
    // The most she can bet is a third of her pile (5 at least). All in, over and over, paid twice what any other game does for no skill at all.
    const most = () => Math.min(stack, Math.max(MIN, Math.floor(stack / 3)));
    const SUITS = ['♠', '♥', '♦', '♣'], RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    let view = null, el = null, deck = [], you = [], house = [], stack = START, bet = 0, frac = 0, mode = 'bet', wait = 0, msg = '', hide = true, lock = 0;
    /* The pace of a hand, in seconds. The dealer used to be done before anyone could follow what happened, so now each card gets time to sink in:
       the deal goes one card at a time, then a pause on Stand, the hidden card turns over, and every card the dealer draws gets its own beat. */
    const DEAL_STEP = 0.5, PAUSE = { stand: 0.8, bust: 0.9, reveal: 1.1, draw: 1.1 };
    let shownYou = 0, shownHouse = 0, dealt = 0, flipHole = false;   // how many cards of each hand are face up on the table so far
    const fresh = new Set();   // cards that have just arrived: only these slide in, so a repaint does not replay every card
    const total = (h) => {
      let t = 0, aces = 0;
      h.forEach((c) => { const r = c % 13; if (r === 0) { aces++; t += 11; } else t += Math.min(10, r + 1); });
      while (t > 21 && aces) { t -= 10; aces--; }
      return t;
    };
    const draw = () => deck.pop();
    function suggestedMove() {
      const score = total(you), dealer = total(house.slice(0, 1));
      const lowTotal = you.reduce((sum, card) => sum + Math.min(10, card % 13 + 1), 0);
      const soft = score > lowTotal;
      const stand = soft ? score >= 19 || (score === 18 && dealer <= 8)
        : score >= 17 || (score >= 13 && dealer <= 6) || (score === 12 && dealer >= 4 && dealer <= 6);
      return stand ? 'stand' : 'hit';
    }
    function shuffle() {
      deck = [];
      for (let i = 0; i < 52; i++) deck.push(i);
      for (let i = 51; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const x = deck[i]; deck[i] = deck[j]; deck[j] = x; }
    }
    const card = (c, down, flip) => {
      const cls = (fresh.has(c) ? ' deal' : '') + (flip ? ' flip' : '');
      if (down) return '<span class="bj-card down' + cls + '"></span>';
      const index = Math.floor(c / 13), suit = SUITS[index];
      return '<span class="bj-card' + (index === 1 || index === 2 ? ' red' : '') + cls + '"><small aria-hidden="true">' + suit
        + '</small><span>' + RANKS[c % 13] + '<i>' + suit + '</i></span></span>';
    };
    /* a tower of chips that grows with the tokens she has */
    function chips() {
      const n = Math.min(7, Math.ceil(stack / 3)), colours = ['#e5484d', '#f4f7ff', '#3b82f6', '#f2a71b'];
      let s = '';
      for (let k = 0; k < n; k++) s += '<i style="--c:' + colours[k % colours.length] + '"></i>';
      return s;
    }
    function paint() {
      const btn = (act, label, cls, off) => '<button data-bj="' + act + '" class="' + (cls || '') + '"' + (off ? ' disabled' : '') + '>' + label + '</button>';
      const mine = you.slice(0, shownYou), theirs = house.slice(0, shownHouse), live = mode === 'dealing' || mode === 'play' || mode === 'house';
      const suggestion = G.mumMode && mode === 'play' ? suggestedMove() : '';
      let btns = '';
      // With only one bet possible (5) there is nothing to slide, so no slider; otherwise it runs from the minimum to the maximum
      if (mode === 'bet') btns = btn('bet', betLabel(), 'go', stack < MIN) + (most() > MIN ? '<div class="bj-slide"><input type="range" id="bjRange" min="0" max="100" step="1" value="' + Math.round(frac * 100) + '" aria-label="' + tr('How much to bet') + '">'
        + '<span class="bj-ticks"><i></i><i></i><i></i></span><span class="bj-ends"><span>' + tr('Minimum') + '</span><span>' + tr('Maximum') + '</span></span></div>' : '');
      else btns = btn('hit', tr('Hit'), suggestion === 'hit' ? 'go' : '', mode !== 'play')
        + btn('stand', tr('Stand'), suggestion === 'hit' ? '' : 'go', mode !== 'play');
      el.innerHTML = '<div class="bj-top"><div class="bj-row"><div class="bj-who">' + tr('Dealer') + '<b>' + (theirs.length ? (hide ? (G.mumMode ? total(theirs.slice(0, 1)) + ' + ?' : '?') : total(theirs)) : '') + '</b></div><div class="bj-cards">'
        + theirs.map((c, k) => card(c, hide && k === 1, flipHole && k === 1)).join('') + '</div></div>'
        + '<div class="bj-row"><div class="bj-who">' + tr('You') + '<b>' + (mine.length ? total(mine) : '') + '</b></div><div class="bj-cards">' + mine.map((c) => card(c)).join('') + '</div></div></div>'
        + '<div class="bj-panel"><div class="bj-bank"><div class="bj-stack" aria-hidden="true">' + chips() + '</div><div class="bj-have"><b>' + stack + '</b><span>' + tr(stack === 1 ? 'token' : 'tokens') + '</span></div>'
        + (live ? '<div class="bj-bet"><span>' + tr('On the table') + '</span><b>' + bet + '</b></div>' : '') + '</div>'
        + '<div class="bj-msg">' + (suggestion ? tr(suggestion === 'hit' ? 'Try Hit' : 'Try Stand') : msg) + '</div><div class="bj-potential" id="bjPotential">' + potentialLabel() + '</div><div class="bj-btns">' + btns + '</div></div>';
      fresh.clear(); flipHole = false;
      if (mode === 'bet' && most() > MIN) K.beat('slide');   // tutorial: the first time there is more than one bet to choose from
    }
    // How much the bar says: nothing is 5, the top is everything, and in between is that share of what you have now.
    const betNow = () => Math.min(most(), Math.max(MIN, Math.round(MIN + frac * (most() - MIN))));
    const betLabel = () => tr('Bet {0}', betNow());
    const potentialLabel = () => {
      if (mode === 'done' || (mode === 'bet' && stack < MIN)) return '';
      const stake = mode === 'bet' ? betNow() : bet, back = Math.round(stake * PAY);
      return tr('Potential win: +{0} tokens', back - stake);
    };
    function money() { K.shown(stack); K.result(Math.min(CAP, Math.max(0, stack - START))); }
    function deal(b) {
      if (mode !== 'bet' || stack < MIN || b < 1) return;
      bet = b; stack -= b; money();
      shuffle(); you = [draw(), draw()]; house = [draw(), draw()]; hide = true; msg = '';
      shownYou = shownHouse = dealt = 0; fresh.clear();
      mode = 'dealing'; wait = 0.25;   // the cards go down one at a time (see update): you, the dealer, you, the dealer, whose second card stays face down
      paint();
    }
    function settle() {
      const p = total(you), d = total(house);
      if (p > 21) { msg = tr('Over 21. You lose {0}.', bet); A.play('thud'); actor.gesture('no', true); }
      else if (d > 21 || p > d) { const back = Math.round(bet * PAY); stack += back; msg = tr(d > 21 ? 'Dealer goes over. You win {0}!' : 'You win {0}!', back - bet); A.play('award'); actor.gesture('happy', true); }
      else if (p === d) { stack += bet; msg = tr('A tie. You get your bet back.'); A.play('tap'); }
      else { msg = tr('Dealer wins. You lose {0}.', bet); A.play('nope'); actor.gesture('shake', true); }
      money();
      // The next bet is ready straight away, with this hand left on the table until the next deal. A short lock stops a quick
      // double tap on Hit dealing a hand by mistake. Only the end of the table (all gone, or the house beaten) waits a moment.
      if (stack < MIN || stack - START >= CAP) { mode = 'done'; wait = 1.8; } else { mode = 'bet'; lock = 0.35; }
      paint(); K.beat('settled');
    }
    function act(a) {
      if (a === 'bet') { if (lock <= 0) deal(betNow()); return; }
      if (mode !== 'play') return;
      if (a === 'hit') {
        you.push(draw()); shownYou++; fresh.add(you[you.length - 1]); A.play('pop');
        if (total(you) > 21) { mode = 'house'; wait = PAUSE.bust; paint(); }        // the dealer turns the hidden card over, then it is settled
        else if (total(you) === 21) { mode = 'house'; wait = PAUSE.stand; paint(); }
        else paint();
      } else if (a === 'stand') { A.play('tap'); mode = 'house'; wait = PAUSE.stand; paint(); }
    }
    function build() {
      view = stage('#0d2b3a', '#1c6a55', { ground: 0x224a40, hemi: 1.9, key: 1.6 });
      // A fine, hand-made felt grain. Kept low-contrast so the table still reads as a clean cartoon.
      const feltTex = U.tex(192, 192, (c, w, h) => {
        const r = U.rng(714);
        c.fillStyle = '#17694f'; c.fillRect(0, 0, w, h);
        for (let i = 0; i < 2600; i++) {
          const v = r() < 0.52 ? '255,255,255' : '5,45,32';
          c.fillStyle = 'rgba(' + v + ',' + (0.018 + r() * 0.045) + ')';
          const x = r() * w, y = r() * h, len = 1 + r() * 2.2;
          c.fillRect(x, y, len, 1);
        }
        // Soft, scattered felt flecks rather than a noisy photographic surface.
        for (let i = 0; i < 90; i++) {
          c.fillStyle = 'rgba(194,235,208,' + (0.025 + r() * 0.035) + ')';
          c.beginPath(); c.arc(r() * w, r() * h, 0.5 + r() * 1.1, 0, PI * 2); c.fill();
        }
      });
      feltTex.wrapS = feltTex.wrapT = T.RepeatWrapping;
      feltTex.repeat.set(4, 4);
      const feltMat = new T.MeshStandardMaterial({ map: feltTex, color: 0xffffff, roughness: 1 });
      view.scene.add(U.ball(1, feltMat, 0, -1.02, 0, 2.6, 1, 2.6, 36));
      // A slim brass piping follows the curved edge of the felt.
      const trim = U.torus(2.47, 0.032, U.mat(0xd8a94b, { metalness: 0.28, roughness: 0.42 }), 0, -0.71, 0, PI * 2, 96);
      trim.rotation.x = PI / 2;
      view.scene.add(trim);
      const rail = U.torus(2.55, 0.105, U.mat(0x784b38, { roughness: 0.65 }), 0, -0.79, 0, PI * 2, 96);
      rail.rotation.x = PI / 2; view.scene.add(rail);
      // One painted wall behind the dealer. The pools of lamplight stay soft at phone scale.
      const wall = U.tex(768, 256, (c, w, h) => {
        const shade = c.createLinearGradient(0, 0, 0, h);
        shade.addColorStop(0, '#26444a'); shade.addColorStop(1, '#163437');
        c.fillStyle = shade; c.fillRect(0, 0, w, h);
        for (let x = 0; x < w; x += 96) {
          c.strokeStyle = '#345052'; c.lineWidth = 2; c.strokeRect(x + 6, -12, 84, 208);
          c.strokeStyle = '#2e494c'; c.strokeRect(x + 11, -12, 74, 203);
        }
        c.fillStyle = '#705a43'; c.fillRect(0, 205, w, 4);
        [290, 478].forEach(x => {
          const light = c.createRadialGradient(x, 143, 2, x, 143, 78);
          light.addColorStop(0, 'rgba(255,209,134,.45)'); light.addColorStop(1, 'rgba(255,209,134,0)');
          c.fillStyle = light; c.fillRect(x - 78, 65, 156, 156);
          c.fillStyle = '#b99865'; c.fillRect(x - 2, 141, 4, 20); c.fillRect(x - 7, 158, 14, 3);
          c.fillStyle = '#ffde9f'; c.beginPath(); c.moveTo(x - 6, 128); c.lineTo(x + 6, 128);
          c.lineTo(x + 12, 144); c.lineTo(x - 12, 144); c.closePath(); c.fill();
        });
      });
      wall.wrapS = T.RepeatWrapping; wall.repeat.x = 3;
      view.scene.add(U.mesh(new T.PlaneGeometry(36, 4), new T.MeshBasicMaterial({ map: wall }), 0, 0.70, -4.2));
      view.camera.position.set(0, 0.5, 4.6);
      el = document.getElementById('bjTable');
      el.addEventListener('click', (e) => { const b = e.target.closest('[data-bj]'); if (b && !b.disabled) act(b.dataset.bj); });
      el.addEventListener('input', (e) => {
        if (e.target.id !== 'bjRange') return;
        frac = e.target.value / 100;
        const b = el.querySelector('[data-bj="bet"]'); if (b) b.textContent = betLabel();
        const potential = el.querySelector('#bjPotential'); if (potential) potential.textContent = potentialLabel();
      });
    }
    return {
      label: 'Tokens', back: true, backLabel: 'Cash out', nocount: true, hint: '',
      view: () => view,
      start() {
        if (!view) build();
        cast(view, 0.62, true);
        face(0);
        stack = START; bet = 0; frac = 0; you = []; house = []; mode = 'bet'; hide = true; lock = 0; wait = 0;
        shownYou = shownHouse = dealt = 0; flipHole = false; fresh.clear();
        msg = tr('You have {0} tokens. Place a bet.', START);
        el.hidden = false;
        paint();
      },
      stop() { el.hidden = true; el.innerHTML = ''; },
      go() { K.score(0, true); money(); },
      pointer() {},
      key(k) { if (k === 'h') act('hit'); else if (k === 's') act('stand'); },
      update(dt, playing) {
        clock += dt;
        lens(view);
        // Held sideways the lens is narrow and crops the seal's head, so step back until the same height shows as on an upright phone
        const back = U.clamp(2.1 / Math.tan(view.camera.fov * PI / 360) / 4.77, 1, 1.5);
        view.camera.position.set(0, -0.75 + 1.25 * back, 4.6 * back);
        view.camera.lookAt(0, -0.75, 0);
        actor.update(dt, clock, null);
        if (lock > 0) lock -= dt;
        if (!playing || wait <= 0) return;
        wait -= dt * (G.mumMode ? 0.75 : 1);
        if (wait > 0) return;
        if (mode === 'dealing') {
          if (dealt < 4) {
            if (dealt % 2 === 0) { shownYou++; fresh.add(you[shownYou - 1]); } else { shownHouse++; fresh.add(house[shownHouse - 1]); }
            dealt++; A.play('pop'); wait = dealt < 4 ? DEAL_STEP : 0.55; paint();
          } else if (total(you) === 21) { mode = 'house'; wait = PAUSE.stand; paint(); }
          else { mode = 'play'; paint(); K.beat('play'); }
        } else if (mode === 'house') {
          if (hide) { hide = false; flipHole = true; A.play('pop'); wait = PAUSE.reveal; paint(); }
          else if (total(you) <= 21 && total(house) < 17) { house.push(draw()); shownHouse++; fresh.add(house[house.length - 1]); A.play('pop'); wait = PAUSE.draw; paint(); }
          else settle();
        } else if (mode === 'done') {
          if (stack < MIN) { el.hidden = true; K.over(tr('All gone!')); return; }
          if (stack - START >= CAP) { el.hidden = true; K.over(tr('You beat the house!')); return; }
        }
      },
    };
  })();

  /* ================= Ice Cream Stack ================= */
  /* Stack ice cream: a layer slides across, tap to set it down. Whatever hangs over the edge breaks off, so the tower narrows.
     Miss the tower altogether and the game is over. */
  const stack = (() => {
    const S0 = 2, BH = 0.42, SNOW = 0.08, R = 3, TOL = 0.09, GROW = 0.12, HOP = 0.28, KEEP = 46;
    // A square spreading into an equal-area circle expands equally on both axes.
    const CREAM_SPREAD = 2 / Math.sqrt(PI), CONE_RADIUS = S0 * CREAM_SPREAD / 2;
    const speedAt = (n) => Math.min(6, 2.6 + 0.085 * n);
    let view = null, bodyGeo = null, softGeo = null, puffs = null, circleGeo = null, scoopPoints = null, baseIce = null;
    let history = [], revealT = 0;
    const flavours = [0xedb0bd, 0xffe3a9, 0xb5d9b8, 0xc39882, 0xc4b6dc, 0xf1bb8f];
    let cream, batchCream;
    const towerBounds = new T.Box3(), revealCentre = new T.Vector3(), revealSize = new T.Vector3();
    let blocks = [], cuts = [], cur = null, top = null;
    let score = 0, misses = 0, streak = 0, turn = 0, mode = 'idle', wait = 0, camY = 0, hopT = 1;
    const at = new T.Vector3(), from = new T.Vector3(), to = new T.Vector3();

    function floe(w, d, n) {
      const g = new T.Group();
      g.add(new T.Mesh(bodyGeo, cream[n % flavours.length]));
      g.scale.set(w, 1, d);
      view.scene.add(g);
      return g;
    }
    // Only the newest four layers need their own deforming geometry. Older
    // scoops share one circular shape, also used when batching the full tower.
    function roundScoop(mesh, target, dt) {
      const previous = mesh.userData.round || 0;
      const amount = Math.min(target, previous + dt * 0.9);
      if (amount === previous) return;
      mesh.userData.round = amount;
      if (amount >= 1) {
        if (mesh.geometry !== circleGeo) mesh.geometry.dispose();
        mesh.geometry = circleGeo;
      } else {
        const p = mesh.geometry.attributes.position, power = 0.18 + 0.82 * U.smooth(0, 1, amount);
        for (let i = 0; i < p.count; i++) {
          const x = scoopPoints[i * 3], z = scoopPoints[i * 3 + 2];
          p.setX(i, Math.sign(x) * Math.pow(Math.abs(x), power) / 2);
          p.setZ(i, Math.sign(z) * Math.pow(Math.abs(z), power) / 2);
        }
        p.needsUpdate = true; mesh.geometry.computeVertexNormals(); mesh.geometry.computeBoundingSphere();
      }
    }
    function build() {
      view = stage('#efdff3', '#fff5e5', { ground: 0xe7d5cf, hemi: 2.1, key: 1.6 });
      // A soft fold follows the scoop around its equator. Painting in UV space
      // lets the same detail follow the corners as a landed scoop rounds off.
      const ribbons = U.tex(256, 128, (c, w, h) => {
        const wash = c.createLinearGradient(0, 0, 0, h);
        wash.addColorStop(0, '#fffef8'); wash.addColorStop(0.38, '#fffdf9');
        wash.addColorStop(0.8, '#f2e5e0'); wash.addColorStop(1, '#dfccca');
        c.fillStyle = wash; c.fillRect(0, 0, w, h);
        for (let band = 0; band < 3; band++) {
          c.beginPath();
          for (let x = 0; x <= w; x += 2) {
            const a = x / w * 2 * PI, y = 30 + band * 30 + 8 * Math.sin(a + band) + 4 * Math.cos(2 * a - band);
            if (x) c.lineTo(x, y); else c.moveTo(x, y);
          }
          for (let x = w; x >= 0; x -= 2) {
            const a = x / w * 2 * PI;
            c.lineTo(x, 34 + band * 30 + 11 * Math.sin(a + band) + 4 * Math.cos(2 * a - band));
          }
          c.closePath(); c.fillStyle = 'rgba(177,138,134,0.22)'; c.fill();
        }
        const r = U.rng(945);
        c.fillStyle = 'rgba(144,109,103,0.26)';
        for (let i = 0; i < 44; i++) {
          c.beginPath(); c.ellipse(3 + r() * (w - 6), 8 + r() * (h - 16), 0.7 + r() * 1.3, 0.7, r() * PI, 0, 2 * PI); c.fill();
        }
      });
      ribbons.wrapS = T.RepeatWrapping;
      cream = flavours.map(color => new T.MeshStandardMaterial({ color, map: ribbons, roughness: 0.87 }));
      batchCream = new T.MeshStandardMaterial({ map: ribbons, vertexColors: true, roughness: 0.87 });
      bodyGeo = new T.BoxGeometry(1, BH, 1); bodyGeo.translate(0, BH / 2, 0);
      // Visual rounding spreads the cream; logical slab dimensions stay unchanged.
      softGeo = new T.SphereGeometry(1, 24, 16);
      scoopPoints = softGeo.attributes.position.array.slice();
      const points = softGeo.attributes.position, rounded = (x) => Math.sign(x) * Math.pow(Math.abs(x), 0.18);
      for (let i = 0; i < points.count; i++) points.setXYZ(i, rounded(points.getX(i)) / 2, (rounded(points.getY(i)) + 1) * BH / 2, rounded(points.getZ(i)) / 2);
      softGeo.computeVertexNormals();
      circleGeo = softGeo.clone();
      const roundPoints = circleGeo.attributes.position;
      for (let i = 0; i < roundPoints.count; i++) { roundPoints.setX(i, scoopPoints[i * 3] / 2); roundPoints.setZ(i, scoopPoints[i * 3 + 2] / 2); }
      circleGeo.computeVertexNormals();
      const sc = view.scene;
      const waffle = U.tex(256, 256, (c, w, h) => {
        const toast = c.createLinearGradient(0, 0, 0, h);
        toast.addColorStop(0, '#d59c61'); toast.addColorStop(0.5, '#edbc80'); toast.addColorStop(1, '#d59c61');
        c.fillStyle = toast; c.fillRect(0, 0, w, h);
        // Offset light and shadow on each crossing makes the lattice look baked in.
        for (const [dy, width, col] of [[2, 4, '#c08a56'], [0, 3.5, '#e8b67a'], [-1, 1.5, '#f8d59b']]) {
          c.strokeStyle = col; c.lineWidth = width; c.beginPath();
          for (let x = -w - 32; x <= w * 2 + 32; x += 32) {
            c.moveTo(x, dy - 4); c.lineTo(x + w + 8, h + dy + 4);
            c.moveTo(x, dy - 4); c.lineTo(x - w - 8, h + dy + 4);
          }
          c.stroke();
        }
      });
      waffle.wrapS = waffle.wrapT = T.RepeatWrapping; waffle.repeat.set(2, 1);
      const cone = U.cyl(CONE_RADIUS, 0.025, 4, new T.MeshStandardMaterial({ map: waffle, roughness: 0.95 }), 0, -2.1, 0, 48);
      const rim = U.rot(U.torus(CONE_RADIUS - 0.05, 0.075, U.mat(0xe4b884), 0, -0.10, 0, PI * 2, 48), PI / 2);
      const base = baseIce = U.mesh(softGeo.clone(), cream[1], 0, -BH, 0); base.scale.set(S0, 1, S0);
      const china = U.mat(0xfff5e1, { roughness: 0.42 }), glaze = U.mat(0x7db7b6, { roughness: 0.32 });
      const plate = U.cyl(3.0, 2.85, 0.16, china, 0, -4.20, 0, 64);
      const band = U.rot(U.torus(2.87, 0.035, glaze, 0, -4.12, 0, PI * 2, 64), PI / 2);
      const hairline = U.rot(U.torus(2.69, 0.013, glaze, 0, -4.118, 0, PI * 2, 64), PI / 2);
      sc.add(cone, rim, base, plate, band, hairline);
      puffs = Puffs(sc, 40, 0xffffff, 1);
    }
    function hopTo() { from.copy(at); hopT = 0; }
    function spawn() {
      const axis = turn++ % 2 ? 'z' : 'x';
      cur = { g: floe(top.w, top.d, score + 1), axis, p: -R, v: speedAt(score), w: top.w, d: top.d };
      cur.g.position.set(top.x + (axis === 'x' ? -R : 0), top.y, top.z + (axis === 'z' ? -R : 0));
      mode = 'slide'; hopTo();
    }
    function fall(g, sx, sz) { cuts.push({ g, vx: sx * 1.6, vz: sz * 1.6, vy: 0, rx: sz * 2.4, rz: -sx * 2.4 }); }
    function drop() {
      if (mode !== 'slide') return;
      const x = cur.axis === 'x', c = x ? top.x : top.z, size = x ? top.w : top.d;
      const delta = cur.p, ad = Math.abs(delta), sgn = delta < 0 ? -1 : 1;
      if (ad >= size) {                                        // clean past the tower: the floe is lost
        fall(cur.g, x ? sgn : 0, x ? 0 : sgn); cur = null; hopTo();
        misses++; streak = 0; A.play('nope'); actor.gesture('no', true);
        mode = 'rest'; wait = 0.75;
        return;
      }
      let keep = size, mid = c;
      if (ad <= TOL) {                                         // spot on: nothing breaks, and a run of them wins some width back
        streak++;
        if (streak >= 3 && size < S0) keep = Math.min(S0, size + GROW);
        K.big(tr('Perfect!')); A.play('match'); K.beat('perfect');
        puffs.emit(top.x, top.y + 0.1, top.z, 10, 1.6, 0.1, 0.5, 4);
      } else {
        streak = 0; keep = size - ad; mid = c + delta / 2;
        const off = floe(x ? ad : top.w, x ? top.d : ad, score + 1), oc = c + delta + sgn * (size - ad) / 2;
        off.position.set(x ? oc : top.x, top.y, x ? top.z : oc);
        fall(off, x ? sgn : 0, x ? 0 : sgn);
        A.play('pop'); K.beat('cut');
      }
      top = { x: x ? mid : top.x, z: x ? top.z : mid, w: x ? keep : top.w, d: x ? top.d : keep, y: top.y + BH };
      cur.g.scale.set(top.w, 1, top.d); cur.g.position.set(top.x, top.y - BH, top.z);
      cur.g.children[0].geometry = softGeo.clone(); cur.g.userData.settle = 0; cur.g.userData.layer = score + 1;
      cur.g.userData.width = top.w; cur.g.userData.depth = top.d;
      cur.g.updateMatrixWorld(true); towerBounds.expandByObject(cur.g);
      blocks.push(cur.g); cur = null;
      // Retain the entire tower for the reveal, batching older layers for phones.
      if (blocks.length > KEEP + 15) {
        const parts = [];
        for (let i = 0; i < 16; i++) {
          const old = blocks.shift(); old.updateMatrixWorld(true);
          parts.push({ geo: circleGeo, m: old.children[0].matrixWorld.clone(), c: old.children[0].material.color }); view.scene.remove(old);
          if (old.children[0].geometry !== circleGeo) old.children[0].geometry.dispose();
        }
        const geometry = U.merge(parts), uv = geometry.attributes.uv, source = circleGeo.attributes.uv;
        // U.merge generates world-space UVs for terrain. Restore the scoop UVs
        // in its expanded vertex order so tall towers keep the same cream folds.
        for (let i = 0; i < uv.count; i++) {
          const j = circleGeo.index.getX(i % circleGeo.index.count);
          uv.setXY(i, source.getX(j), source.getY(j));
        }
        const batch = new T.Mesh(geometry, batchCream);
        history.push(batch); view.scene.add(batch);
      }
      score++; K.score(score); K.hint('');
      if (score % 10 === 0) { A.play('award'); actor.gesture('happy', true); }
      mode = 'rest'; wait = 0.16;
    }
    return {
      label: 'Scoops', hint: 'Tap to stack the ice cream. Keep your cone balanced!',
      snap() {                                        // the corner picture for an online race: the tower and the sliding scoop, from above
        const r = (n) => Math.round(n * 100) / 100;
        return top ? { t: [r(top.x), r(top.z), r(top.w), r(top.d)], c: cur ? [r(cur.g.position.x), r(cur.g.position.z), r(cur.w), r(cur.d)] : null, n: score } : null;
      },
      view: () => view,
      peek: () => (cur && mode === 'slide' ? cur.p : null),
      start() {
        if (!view) build();
        blocks.concat(cuts.map((c) => c.g)).forEach((g) => {
          view.scene.remove(g);
          const geo = g.children[0].geometry;
          if (geo !== bodyGeo && geo !== softGeo && geo !== circleGeo) geo.dispose();
        });
        if (cur) view.scene.remove(cur.g);
        history.forEach((m) => { view.scene.remove(m); m.geometry.dispose(); }); history = [];
        blocks = []; cuts = []; cur = null; puffs.clear(); revealT = 0;
        if (baseIce.geometry !== circleGeo) baseIce.geometry.dispose();
        baseIce.geometry = softGeo.clone(); baseIce.userData.round = 0; baseIce.scale.set(S0, 1, S0);
        towerBounds.set(new T.Vector3(-3, -4.3, -3), new T.Vector3(3, 0, 3));
        top = { x: 0, z: 0, w: S0, d: S0, y: 0 };
        score = 0; misses = 0; streak = 0; turn = 0; mode = 'idle'; camY = 0; hopT = 1;
        cast(view, 0.8, false);
        face(PI / 4);
        at.set(0, 0, 0);
      },
      go() { spawn(); },
      pointer(type) { if (type === 'down') drop(); },
      key(k) { if (k === ' ' || k === 'Enter' || k === 'ArrowDown' || k === 'ArrowUp') drop(); },
      update(dt, playing) {
        clock += dt;
        const half = lens(view);
        // A wide screen has plenty of width but little height. Fit the sliding
        // scoop and its rider vertically too, leaving room for the game HUD.
        const vertical = view.camera.fov * PI / 360;
        const usableHeight = Math.max(0.35, 1 - 120 / window.innerHeight);
        const fitHalf = view.camera.aspect > 1
          ? Math.min(half, Math.atan(Math.tan(vertical) * usableHeight)) : half;
        const d = (R * 0.707 + S0 * 0.75) / Math.tan(fitHalf), k = d * 0.577;
        camY = U.damp(camY, top.y, 4, dt);
        view.camera.position.set(k, camY + 1.2 + k, k);
        view.camera.lookAt(0, camY + 1.2, 0);
        if (cur && mode === 'slide' && playing) {
          cur.p += cur.v * dt;
          if (cur.p > R) { cur.p = 2 * R - cur.p; cur.v = -cur.v; } else if (cur.p < -R) { cur.p = -2 * R - cur.p; cur.v = -cur.v; }
          if (cur.axis === 'x') cur.g.position.x = top.x + cur.p; else cur.g.position.z = top.z + cur.p;
          if (score === 0 && Math.abs(cur.p) < TOL * 0.5) K.beat('now');   // tutorial: the first scoop waits right over the tower for the tap
        }
        if (mode === 'rest' && playing) {
          wait -= dt;
          if (wait <= 0) {
            if (misses >= 1) { mode = 'reveal'; revealT = 0; }
            else spawn();
          }
        }
        // Each scoop becomes circular/oval as four more successful layers land.
        roundScoop(baseIce, Math.min(1, score / 4), dt);
        const baseWidth = S0 * U.lerp(1, CREAM_SPREAD, baseIce.userData.round || 0);
        baseIce.scale.set(baseWidth, 1, baseWidth);
        // Give each landed scoop a tiny squash as its corners soften.
        blocks.forEach((g) => {
          roundScoop(g.children[0], U.clamp((score - g.userData.layer) / 4, 0, 1), dt);
          const spread = U.lerp(1, CREAM_SPREAD, g.children[0].userData.round || 0);
          g.scale.set(g.userData.width * spread, 1, g.userData.depth * spread);
          g.userData.settle = Math.min(1, (g.userData.settle || 0) + dt / 0.28);
          g.children[0].scale.y = 1 - 0.07 * Math.sin(g.userData.settle * PI);
        });
        if (mode === 'reveal' || mode === 'done') {
          revealT += dt;
          const progress = U.smooth(0, 1.8, revealT);
          towerBounds.getCenter(revealCentre); towerBounds.getSize(revealSize);
          revealCentre.y += 0.7;
          const radius = Math.hypot(revealSize.x, revealSize.y + 2, revealSize.z) / 2;
          const vertical = view.camera.fov * PI / 360;
          const distance = radius / Math.sin(Math.min(half, vertical)) * 1.10;
          // Orbit the finished cone for one gentle turn during the pull-back.
          const angle = PI / 4 + U.smooth(0, 3.6, revealT) * PI * 2;
          const direction = new T.Vector3(Math.sin(angle) * Math.SQRT2, 0.65, Math.cos(angle) * Math.SQRT2).normalize();
          const target = revealCentre.clone().addScaledVector(direction, distance);
          view.camera.position.lerp(target, progress);
          const focus = new T.Vector3(0, camY + 1.2, 0).lerp(revealCentre, progress);
          view.camera.lookAt(focus);
          if (mode === 'reveal' && revealT >= 3.6) { mode = 'done'; K.over(tr('Sweet!')); }
        }
        // she rides the sliding floe, and hops across to each new one
        if (cur) to.set(cur.g.position.x, top.y + BH, cur.g.position.z); else to.set(top.x, top.y, top.z);
        if (hopT < 1) {
          hopT = Math.min(1, hopT + dt / HOP);
          const e = hopT * hopT * (3 - 2 * hopT);
          at.lerpVectors(from, to, e); at.y += Math.sin(PI * hopT) * 0.55;
        } else at.copy(to);
        view.rig.position.copy(at);
        for (let i = cuts.length - 1; i >= 0; i--) {
          const c = cuts[i];
          c.vy -= 14 * dt;
          c.g.position.x += c.vx * dt; c.g.position.y += c.vy * dt; c.g.position.z += c.vz * dt;
          c.g.rotation.x += c.rx * dt; c.g.rotation.z += c.rz * dt;
          if (c.g.position.y < camY - 14) { view.scene.remove(c.g); cuts.splice(i, 1); }
        }
        puffs.update(dt, 0, 0);
        actor.update(dt, clock, null);
      },
    };
  })();

  // The two lake games share a quiet sheet of water. The ripple tile and the
  // frosted cross-section of each floe are made once, including after replays.
  let poolWater, floeGeometry, floeMaterial;
  function lakeStage(seed, dusk = false) {
    const view = stage(dusk ? '#b1acc9' : '#a3ccdc', dusk ? '#ffdfc9' : '#faedde',
      { ground: dusk ? 0xb6a4bf : 0xbacfd9, hemi: 1.9, key: 1.45 });
    const sc = view.scene;
    sc.fog = new T.Fog(0xd4e3e4, 16, 58);
    fellBackdrop(sc);
    if (!poolWater) {
      const water = U.tex(256, 256, (c, w, h) => {
        const r = U.rng(562);
        c.fillStyle = '#548e9e'; c.fillRect(0, 0, w, h);
        for (let i = 0; i < 46; i++) {
          const x = r() * w, y = r() * h, len = 8 + r() * 38, bow = 2 + r() * 3;
          c.fillStyle = i % 4 ? 'rgba(195,230,225,0.28)' : 'rgba(46,99,123,0.23)';
          for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) {
            c.beginPath(); c.moveTo(x + dx, y + dy);
            c.quadraticCurveTo(x + dx + len * 0.45, y + dy - bow, x + dx + len, y + dy);
            c.quadraticCurveTo(x + dx + len * 0.55, y + dy - bow + 3, x + dx, y + dy); c.fill();
          }
        }
      });
      water.wrapS = water.wrapT = T.RepeatWrapping; water.repeat.set(24, 24);
      poolWater = new T.MeshStandardMaterial({ map: water, roughness: 0.42 });
      const profile = [[0.01, -0.31, 0x829eaf], [0.86, -0.31, 0x769eae], [0.99, -0.22, 0x8bb6c5],
        [1.0, -0.09, 0xafcdd0], [1.025, -0.04, 0xd1e1e0], [1.025, 0.005, 0xeef2ef],
        [0.94, 0.03, 0xf9f8ef], [0.01, 0.03, 0xf2f5ee], [0, 0.03, 0xf2f5ee]];
      floeGeometry = new T.LatheGeometry(profile.map(([radius, y]) => new T.Vector2(radius, y)), 24);
      const pos = floeGeometry.attributes.position, col = [], tint = new T.Color();
      for (let j = 0; j < pos.count; j++) {
        const x = pos.getX(j), z = pos.getZ(j), a = Math.atan2(x, z);
        const edge = 1 + 0.034 * Math.cos(3 * a) + 0.017 * Math.sin(5 * a);
        pos.setXYZ(j, x * edge, pos.getY(j), z * edge);
        tint.setHex(profile[j % profile.length][2]); col.push(tint.r, tint.g, tint.b);
      }
      floeGeometry.setAttribute('color', new T.Float32BufferAttribute(col, 3)); floeGeometry.computeVertexNormals();
      floeMaterial = U.mat(0xffffff, { vertexColors: true, roughness: 0.76 });
    }
    const surface = dusk ? poolWater.clone() : poolWater;
    if (dusk) surface.color.set(0xffc9dc);
    const lake = U.mesh(new T.PlaneGeometry(160, 160), surface, 0, -0.2, 0);
    lake.rotation.x = -PI / 2;
    sc.add(lake, new T.Mesh(floeGeometry, floeMaterial));
    const r = U.rng(seed);
    for (let i = 0; i < 16; i++) {
      const a = r() * PI * 2, d = 3.2 + r() * 16, k = 0.4 + r() * 1.3;
      const f = U.mesh(floeGeometry, floeMaterial, Math.cos(a) * d, -0.12, Math.sin(a) * d - 4);
      f.scale.set(k, 0.38, k * (0.79 + 0.12 * Math.cos(i))); f.rotation.y = r() * 3; sc.add(f);
    }
    return view;
  }

  /* ================= Puffer Sweeper ================= */
  /* Minesweeper under the ice: nine by nine tiles with ten pufferfish under them. Tap a tile to open it; a number says how many
     pufferfish touch it. The first tap is always safe and opens a patch, and the pufferfish are only placed after it, on a board
     that sweep.js has checked can be cleared without one guess. Wake a pufferfish and it is over, with nothing to show for it.
     Clear the lot and the coins go by the clock: the quicker, the more (data.js). The clock starts on the first tap.
     Flags are optional. Hold a tile, or switch to Flag and tap. Tap a number whose flags are all down to open the rest around it. */
  const puff = (() => {
    const HOLD = 140, Sw = PN.Sweep;
    let size = 9, mineCount = 10, saves = 0;
    const FLAG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 21V3.5" stroke="#233d55" stroke-width="2.3" stroke-linecap="round"/><path d="M8 4q5-2 12 1l-3.4 2.6 2.5 2.8q-6-2-11 .5z" fill="#e87956" stroke="#b65a48" stroke-width=".8"/><circle cx="7" cy="3.5" r="1.5" fill="#ffe3a4"/></svg>';
    const FISH = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4.8 8-2.5-1 .8 3-2 2 2.5 1.1-.4 3.3 3-1.1m12.5-6.8 2.8-1.3-.8 3.5 2.1 2.2-2.8 1.2.1 3.2-2.6-1.3M7 5.9l.1-3 2.3 1.4L12 1.6l1.8 2.6 3-1.3-.3 3.3" fill="#e9a346"/>'
      + '<ellipse cx="12" cy="12.5" rx="8.8" ry="8.2" fill="#efbe5e"/><path d="M4.4 14q7.7-3.7 15.1 0-1.4 6.2-7.5 6.6-6.3-.4-7.6-6.6" fill="#fff0c9"/>'
      + '<g fill="#293b49"><ellipse cx="8.8" cy="11.5" rx="1.45" ry="1.9"/><ellipse cx="15.2" cy="11.5" rx="1.45" ry="1.9"/><ellipse cx="12" cy="15" rx="1" ry=".8"/></g><g fill="white"><circle cx="8.5" cy="11" r=".48"/><circle cx="14.9" cy="11" r=".48"/></g><path d="M5.4 14h1.8m9.6 0h1.8" stroke="#df987c" stroke-width="1.2" stroke-linecap="round"/></svg>';
    let view = null, el = null, cells = [], prizeEl = null, modeEl = null, tipEl = null, fish = [];
    let mines = null, num = null, open = null, mark = null, left = 0, flags = 0, t = 0, mode = 'idle', flagging = false, wait = 0, press = null, shownT = -1, shownP = -1;

    let framedWidth = 0, framedHeight = 0;
    function frameBoard() {
      const w = window.innerWidth, h = window.innerHeight;
      if (w === framedWidth && h === framedHeight) return;
      framedWidth = w; framedHeight = h;
      const cam = view.camera;
      if (window.matchMedia('(orientation: landscape) and (min-width: 480px) and (max-height: 520px)').matches) {
        const space = el.getBoundingClientRect().left;
        cam.setViewOffset(w, h, (w - space) / 2, -h * 0.23, w, h);
      } else if (cam.view && cam.view.enabled) cam.clearViewOffset();
    }
    /* A round little pufferfish for the water beside her. */
    function puffer() {
      const g = new T.Group(), dark = U.mat(0x263647, { roughness: 0.34 }), gold = U.mat(0xd99a48);
      const body = new T.SphereGeometry(0.3, 28, 20), colors = [], p = body.attributes.position;
      const belly = new T.Color(0xffedcb), top = new T.Color(0xedb45d), tint = new T.Color();
      for (let i = 0; i < p.count; i++) {
        const t = U.smooth(-0.12, 0.03, p.getY(i) + 0.012 * Math.cos(p.getX(i) * 28));
        tint.copy(belly).lerp(top, t); colors.push(tint.r, tint.g, tint.b);
      }
      body.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
      g.add(new T.Mesh(body, U.mat(0xffffff, { vertexColors: true, roughness: 0.75 })));
      const up = new T.Vector3(0, 1, 0), v = new T.Vector3(), spine = new T.ConeGeometry(0.030, 0.076, 8);
      for (let i = 0; i < 28; i++) {
        const y = 1 - (i + 0.5) / 14, r = Math.sqrt(1 - y * y), a = i * 2.39996, x = Math.cos(a) * r, z = Math.sin(a) * r;
        if (z > 0.47 && y > -0.38 && y < 0.72) continue;
        const m = U.mesh(spine, gold, x * 0.316, y * 0.316, z * 0.316);
        m.quaternion.setFromUnitVectors(up, v.set(x, y, z)); g.add(m);
      }
      for (const side of [-1, 1]) {
        g.add(U.ball(0.052, dark, side * 0.111, 0.063, 0.266, 0.91, 1.17, 0.58),
          U.ball(0.014, U.glow(0xfffdf3), side * 0.111 - 0.012, 0.084, 0.293),
          U.ball(0.04, U.mat(0xe39a80), side * 0.163, -0.015, 0.251, 1, 0.46, 0.3));
        const fin = U.ball(0.091, gold, side * 0.293, -0.026, 0, 0.82, 0.42, 0.9); fin.rotation.z = side * 0.45; g.add(fin);
      }
      g.add(U.ball(0.030, dark, 0, -0.040, 0.298, 0.82, 0.66, 0.35));
      const tail = U.ball(0.105, gold, 0, 0, -0.327, 0.44, 1.1, 1.2); tail.rotation.x = -0.28; g.add(tail);
      return g;
    }
    function build() {
      view = lakeStage(81);
      const sc = view.scene;
      [[-1.42, 0.35, 0.45], [1.45, -0.1, -0.4]].forEach((p, i) => { const g = puffer(); g.position.set(p[0], -0.12, p[1]); g.rotation.y = p[2]; sc.add(g); fish.push({ g, big: 1, y: -0.12, ph: i * 2.1 }); });
      view.camera.position.set(0, 2.5, 7.2);
      el = document.getElementById('puffBoard');
      el.innerHTML = '<div class="pf-tip" id="pfTip"></div><div class="pf-grid"></div>'
        + '<div class="pf-bar"><span class="pf-prize" id="pfPrize"></span><span class="pf-mode" id="pfMode" role="group"><button data-pf="dig"></button><button data-pf="flag"></button></span></div>';
      prizeEl = document.getElementById('pfPrize'); modeEl = document.getElementById('pfMode'); tipEl = document.getElementById('pfTip');
      const tile = (e) => { const b = e.target.closest ? e.target.closest('.pf-c') : null; return b ? +b.dataset.i : -1; };
      const drop = () => { if (press) { clearTimeout(press.timer); press = null; } };
      el.addEventListener('pointerdown', (e) => {
        drop();
        const i = tile(e);
        if (i < 0 || (e.button != null && e.button > 0)) return;
        press = { i, x: e.clientX, y: e.clientY, held: false, timer: setTimeout(() => { if (press && press.i === i) press.held = hold(i); }, HOLD) };
      });
      el.addEventListener('pointermove', (e) => { if (press && !press.held && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 14) drop(); });
      el.addEventListener('pointerup', (e) => {
        if (!press) return;
        const p = press, at = document.elementFromPoint(e.clientX, e.clientY), b = at && at.closest ? at.closest('.pf-c') : null;
        drop();
        if (!p.held && b && +b.dataset.i === p.i) tap(p.i);
      });
      el.addEventListener('pointercancel', drop);
      el.addEventListener('contextmenu', (e) => e.preventDefault());
      modeEl.addEventListener('click', (e) => { const b = e.target.closest('[data-pf]'); if (b) { flagging = b.dataset.pf === 'flag'; A.play('tap'); bar(); } });
    }
    function resizeBoard() {
      const count = size * size;
      if (cells.length === count) return;
      el.style.setProperty('--board-size', size);
      cells = Array.from({ length: count }, (_, i) => {
        const tile = document.createElement('button');
        tile.dataset.i = i;
        tile.tabIndex = -1;
        return tile;
      });
      el.querySelector('.pf-grid').replaceChildren(...cells);
    }
    function bar() {
      const b = modeEl.children;
      b[0].innerHTML = tr('Open'); b[1].innerHTML = FLAG + tr('Flag');
      b[0].className = flagging ? '' : 'on'; b[1].className = flagging ? 'on' : '';
      b[0].setAttribute('aria-pressed', String(!flagging)); b[1].setAttribute('aria-pressed', String(flagging));
      el.classList.toggle('flagging', flagging);
    }
    function paint(i) {
      const c = cells[i];
      if (open[i]) { c.className = 'pf-c open n' + num[i]; c.textContent = num[i] || ''; }
      else if (mark[i]) { c.className = 'pf-c flag'; c.innerHTML = FLAG; }
      else { c.className = 'pf-c'; c.textContent = ''; }
    }
    function clockNow() {
      const secs = Math.floor(t), prize = Math.floor(PN.Sim.gamePay('puff', Math.max(1, Math.ceil(t))) * PN.Sim.gameMult(PN.Game.state, 'puff'));
      if (secs !== shownT) { shownT = secs; K.time(PN.mmss(secs)); }
      if (prize !== shownP) { shownP = prize; prizeEl.innerHTML = PN.UI.ic('coin') + '<b>' + prize + '</b>'; prizeEl.setAttribute('aria-label', tr('Coins for clearing it now: {0}', prize)); }
    }
    function setFlag(i) {
      if (mode !== 'play' || open[i]) return;
      mark[i] = mark[i] ? 0 : 1; flags += mark[i] ? 1 : -1;
      paint(i); A.play('tick'); K.shown(mineCount - flags);
    }
    /* A long press flags a shut tile. False: there was nothing to flag, so the press counts as a plain tap. */
    function hold(i) {
      if (mode !== 'play' || open[i]) return false;
      const st = PN.Game.state;
      if (st.settings.haptics && navigator.vibrate) { try { navigator.vibrate(14); } catch (e) { /* not allowed here */ } }
      setFlag(i);
      return true;
    }
    /* Open a tile and whatever comes with it. Stop digging when a pufferfish is found. */
    function dig(i) {
      if (mines[i]) {
        if (saves > 0) {
          saves--;
          setFlag(i);
          tipEl.textContent = tr('Pufferfish spotted and flagged!');
        } else boom(i);
        return false;
      }
      tipEl.textContent = '';
      const got = Sw.flood(size, size, mines, num, open, i);
      got.forEach((j) => { if (mark[j]) { mark[j] = 0; flags--; } paint(j); if (j !== i || got.length > 1) cells[j].classList.add('fresh'); });
      left -= got.length;
      return true;
    }
    function tap(i) {
      const first = mode === 'ready';                           // the first tap always opens, whichever way the switch is set
      if (first) {
        mines = Sw.make(size, size, mineCount, i); num = Sw.counts(size, size, mines);
        mode = 'play'; tipEl.textContent = '';
      }
      if (mode !== 'play') return;
      if (open[i]) {
        if (!num[i]) return;
        const nb = Sw.hood(size, size)[i];
        let fl = 0, hid = 0;
        nb.forEach((j) => { if (!open[j]) { if (mark[j]) fl++; else hid++; } });
        if (fl !== num[i] || !hid) return;
        const before = left;
        for (let k = 0; k < nb.length; k++) { const j = nb[k]; if (!open[j] && !mark[j] && !dig(j)) return; }
        A.play(before - left > 2 ? 'pop' : 'tap');
      } else {
        if (flagging && !first) { setFlag(i); return; }
        if (mark[i]) return;                                   // a flag keeps a tile shut
        const before = left;
        if (!dig(i)) return;
        A.play(before - left > 2 ? 'pop' : 'tap');
      }
      K.shown(mineCount - flags);
      if (first) K.beat('open');
      if (left === 0) win();
    }
    function win() {
      mode = 'won';
      for (let i = 0; i < cells.length; i++) if (!open[i] && !mark[i]) { mark[i] = 1; paint(i); }
      flags = mineCount; K.shown(0);
      K.result(Math.max(1, Math.ceil(t)));
      A.play('award'); actor.gesture('happy', true);
      K.over(tr('All clear!'));
    }
    function boom(i) {
      mode = 'boom'; wait = 1.1;
      for (let j = 0; j < cells.length; j++) {
        if (mines[j] && !mark[j]) { cells[j].className = 'pf-c open puff' + (j === i ? ' hit' : ''); cells[j].innerHTML = FISH; }
        else if (!mines[j] && mark[j]) cells[j].classList.add('wrong');
      }
      K.result(0);
      A.play('thud'); actor.gesture('surprise', true);
      fish.forEach((f) => { f.big = 1.4; });
    }
    return {
      label: 'Pufferfish', label2: 'Time', nocount: true, hint: '',
      view: () => view,
      peek: () => ({ mines, open, mark, num, left, flags, t, mode, flagging }),
      tap, hold,
      start() {
        if (!view) build();
        cast(view, 0.85, true);
        face(0);
        framedWidth = 0;
        size = G.mumMode ? 6 : 9;
        mineCount = G.mumMode ? 4 : 10;
        saves = G.mumMode ? 2 : 0;
        resizeBoard();
        mines = null; num = new Uint8Array(cells.length); open = new Uint8Array(cells.length); mark = new Uint8Array(cells.length);
        left = cells.length - mineCount; flags = 0; t = 0; mode = 'ready'; flagging = false; wait = 0; press = null; shownT = shownP = -1;
        fish.forEach((f) => { f.big = 1; f.g.scale.setScalar(1); });
        for (let i = 0; i < cells.length; i++) paint(i);
        bar(); clockNow();
        tipEl.textContent = tr('Tap any tile to start. Hold a tile to flag it.');
        el.hidden = false;
      },
      stop() { if (press) { clearTimeout(press.timer); press = null; } el.hidden = true; },
      go() { K.shown(mineCount); },
      pointer() {},
      key() {},
      update(dt, playing) {
        clock += dt;
        lens(view);
        frameBoard(); lookAtPool(view, 1.2);
        fish.forEach((f) => {
          f.g.position.y = f.y + Math.sin(clock * 1.4 + f.ph) * 0.045;
          f.g.rotation.z = Math.sin(clock * 0.9 + f.ph) * 0.12;
          f.g.scale.setScalar(U.damp(f.g.scale.x, f.big, 9, dt));
        });
        actor.update(dt, clock, null);
        if (!playing) return;
        if (mode === 'play') { t += dt; clockNow(); }
        else if (mode === 'boom') { wait -= dt; if (wait <= 0) { mode = 'done'; A.play('nope'); K.over(tr('Pufferfish!')); } }
      },
    };
  })();

  /* ================= Ice Piano ================= */
  /* Piano tiles on the ice. A tune comes down four lanes as tiles, one tile a note, as long as the note is. Tap them in order,
     lowest first: each tap plays its note, so playing well plays the tune. The tune loops and gets faster. Tap a lane the next
     tile is not in, or let a tile slide off the bottom, and it is over. The first tile waits for the first tap.
     The score is the tiles played. Tunes live in data.js (PN.SONGS). */
  const piano = (() => {
    const LANES = 4, SPAN = 11, LINE = 0.74, START = 78, RISE = 7.5, MAX = 134, BOUNCE = 0.09;
    const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    let kantele = null;
    let view = null, el = null, cv = null, g2 = null, W = 0, H = 0, song = null, chart = [], total = 0;
    let pos = 0, next = 0, n = 0, mode = 'idle', wait = 0, bad = -1, badTile = -1, lastLane = -1, lastAt = 0, bop = 0, why = '';

    /* 'Bb4' as a frequency. */
    function freq(name) {
      const m = /^([A-G])(b|#)?(\d)$/.exec(name), semi = SEMI[m[1]] + (m[2] === 'b' ? -1 : m[2] === '#' ? 1 : 0) + (+m[3] + 1) * 12;
      return 440 * Math.pow(2, (semi - 69) / 12);
    }
    /* Turn a tune into tiles: when each starts (in sixteenths), how long, its note, and a lane. The lane follows the tune:
       up the scale moves right, down moves left, a repeated note hops to a lane beside it. Never the same lane twice running,
       and the last tile's lane differs from the first, so the loop joins up. The same every time, so it can be learnt. */
    function read(sg) {
      const r = U.rng(7), out = [];
      let at = 0, lane = 1, last = 0;
      sg.notes.split(/\s+/).forEach((tok) => {
        if (tok === '|' || !tok) return;
        const parts = tok.split(':'), f = freq(parts[0]), d = +parts[1];
        if (out.length) {
          const dir = f > last * 1.001 ? 1 : f < last * 0.999 ? -1 : 0, pick = [];
          for (let l = 0; l < LANES; l++) if (l !== lane && (dir === 0 ? Math.abs(l - lane) === 1 : (l - lane) * dir > 0)) pick.push(l);
          if (!pick.length) for (let l = 0; l < LANES; l++) if (l !== lane) pick.push(l);
          lane = pick[Math.floor(r() * pick.length)];
        }
        out.push({ at, d, f, lane }); at += d; last = f;
      });
      if (out[out.length - 1].lane === out[0].lane) out[out.length - 1].lane = [0, 1, 2, 3].filter((l) => l !== out[0].lane && l !== out[out.length - 2].lane)[0];
      return { tiles: out, len: at };
    }
    // How tall a sixteenth is on screen. A tune with faster notes (song.speed) gets shorter tiles, not a faster scroll: it moves down the screen at
    // the same pace as Ievan polkka and just fits more, shorter tiles in view.
    const unit = () => H / SPAN / ((song && song.speed) || 1);
    let lastSong = null;
    function pickSong() {
      // Remember the last tune across reloads, with an in-memory fallback if storage is blocked.
      try { lastSong = localStorage.getItem('pikkunorppa.kantele.lastSong') || lastSong; } catch (e) { /* storage is optional */ }
      const songs = Object.keys(PN.SONGS), fresh = songs.filter((id) => id !== lastSong);
      const choices = fresh.length ? fresh : songs;
      if (G.seeded()) return PN.SONGS[songs.slice().sort()[Math.floor(grnd() * songs.length)]];   // an online race: the same tune for both, not the one remembered here
      const id = choices[Math.floor(Math.random() * choices.length)];
      lastSong = id;
      try { localStorage.setItem('pikkunorppa.kantele.lastSong', id); } catch (e) { /* keep the in-memory choice */ }
      return PN.SONGS[id];
    }
    let snapPos = null, snapAt = 0;
    const tile = (i) => chart[i % chart.length];
    const startOf = (i) => Math.floor(i / chart.length) * total + tile(i).at;
    // The speed-up steps come every half of Ievan's tiles (REF), counted in this tune's sixteenths, so the climb is the same whichever tune it is
    // (for Ievan that is exactly half a loop). song.speed scales it all so every tune earns what Ievan does.
    const REF = 83;
    const bpm = (p) => (song.speed || 1) * (G.mumMode ? START * 0.6
      : Math.min(MAX, START + RISE * Math.floor(p / (total * (REF / 2) / chart.length))));
    function songTitle(text) {
      let e = document.getElementById('gSong');
      // Older cached HTML may not contain the title element yet.
      if (!e) {
        e = document.createElement('div'); e.id = 'gSong'; e.className = 'g-song';
        document.getElementById('gamehud').appendChild(e);
      }
      const quit = document.getElementById('gQuit');
      if (e.parentNode !== quit.parentNode) quit.before(e);
      e.textContent = text; e.hidden = !text;
    }
    function size() {
      const r = el.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
      if (!r.width) return;
      W = r.width; H = r.height;
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
      g2.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function box(x, y, w, h, rad) {
      g2.beginPath();
      g2.moveTo(x + rad, y); g2.arcTo(x + w, y, x + w, y + h, rad); g2.arcTo(x + w, y + h, x, y + h, rad); g2.arcTo(x, y + h, x, y, rad); g2.arcTo(x, y, x + w, y, rad);
      g2.closePath();
    }
    function draw() {
      if (!W) return;
      const lw = W / LANES, u = unit(), line = H * LINE;
      g2.clearRect(0, 0, W, H);
      for (let lane = 0; lane < LANES; lane++) {
        const cx = (lane + 0.5) * lw, ringing = lastLane === lane ? bop : 0;
        if (lane) {
          g2.fillStyle = 'rgba(30,21,28,.46)'; g2.fillRect(lane * lw - 1, 0, 2, H);
          g2.fillStyle = 'rgba(255,226,171,.12)'; g2.fillRect(lane * lw + 1, 0, 1, H);
        }
        g2.fillStyle = 'rgba(26,24,31,.45)'; g2.fillRect(cx + 1, 0, 2, H);
        g2.strokeStyle = ringing ? '#ffe3a6' : '#bd9b70'; g2.lineWidth = 1.4;
        g2.beginPath(); g2.moveTo(cx, 0);
        g2.quadraticCurveTo(cx + ringing * Math.sin(ringing * PI * 4) * 6, H * 0.55, cx, H); g2.stroke();
      }
      if (bad >= 0) { g2.fillStyle = 'rgba(226,80,58,.55)'; g2.fillRect(bad * lw, 0, lw, H); }
      const first = Math.max(0, next - 6);
      for (let i = first; i < first + 40; i++) {
        const t = tile(i), s = startOf(i), bottom = line - (s - pos) * u, h = t.d * u, top = bottom - h;
        if (bottom < -4) break;
        if (top > H) continue;
        const x = t.lane * lw + 4, w = lw - 8, y = top + 3, hh = h - 6, rad = Math.min(14, hh / 2);
        if (i < next) { g2.fillStyle = 'rgba(255,255,255,.1)'; box(x, y, w, hh, rad); g2.fill(); continue; }
        if (i === badTile) g2.fillStyle = '#e2503a';
        else {
          const gr = g2.createLinearGradient(0, y, 0, y + hh), guided = G.mumMode && i === next;
          gr.addColorStop(0, guided ? '#e9ffe6' : '#fffae9');
          gr.addColorStop(0.73, guided ? '#a1ddb2' : '#f0dcb9');
          gr.addColorStop(1, guided ? '#7abb97' : '#d5b48f');
          g2.fillStyle = gr;
        }
        box(x, y, w, hh, rad); g2.fill();
        if (i !== badTile) {
          g2.fillStyle = 'rgba(255,255,250,.72)'; box(x + 5, y + 3, w - 10, Math.min(3, hh / 4), 1.5); g2.fill();
          if (hh > 21 && (i !== 0 || mode !== 'ready')) {
            const cx = x + w / 2, cy = y + hh / 2;
            g2.beginPath(); g2.moveTo(cx - 4.5, cy); g2.lineTo(cx, cy - 3);
            g2.lineTo(cx + 4.5, cy); g2.lineTo(cx, cy + 3); g2.closePath();
            g2.fillStyle = 'rgba(124,99,74,.52)'; g2.fill();
          }
        }
        if (i === 0 && mode === 'ready') {
          g2.fillStyle = '#17264d'; g2.font = '600 ' + Math.round(Math.min(20, lw * 0.24)) + 'px DynaPuff, sans-serif'; g2.textAlign = 'center'; g2.textBaseline = 'middle';
          g2.fillText(tr('Start'), x + w / 2, y + hh / 2 + 1);
        }
      }
    }
    function fail(lane, i, text) {
      mode = 'fail'; wait = 0.9; bad = lane; badTile = i; why = text;
      A.play('nope'); actor.gesture('surprise', true);
    }
    function tap(lane) {
      if (mode !== 'ready' && mode !== 'play') return;
      const t = tile(next);
      if (mode === 'ready') { if (lane !== t.lane) return; mode = 'play'; K.hint(''); }
      else if (lane !== t.lane || (startOf(next) - pos) * unit() > H * LINE) {
        if (lane === lastLane && clock - lastAt < BOUNCE) return;        // the same finger landing twice
        fail(lane, -1, tr('Wrong tile!'));
        return;
      }
      A.note(t.f, Math.max(0.2, t.d * 15 / bpm(pos) * 1.15));
      lastLane = lane; lastAt = clock; bop = 1;
      next++; n++; K.score(n);
      if (n === 1) K.beat('go');
    }
    function build() {
      view = lakeStage(33, true);
      // A small five-string kantele: tapered wooden soundbox, bridge and tuning pins.
      // Attached to the seal's squash rig so pups and adults hold the same proportions.
      kantele = new T.Group();
      const outline = new T.Shape();
      outline.moveTo(-0.68, -0.22); outline.lineTo(0.66, -0.14);
      outline.quadraticCurveTo(0.76, -0.12, 0.69, 0.02);
      outline.lineTo(0.32, 0.32); outline.quadraticCurveTo(0.26, 0.37, 0.15, 0.34);
      outline.lineTo(-0.68, 0.10); outline.quadraticCurveTo(-0.76, 0.02, -0.68, -0.22);
      const wood = new T.MeshStandardMaterial({ color: 0xd9aa74, map: U.surfaceTex('wood'), roughness: 0.65 });
      const body = new T.Mesh(new T.ExtrudeGeometry(outline, { depth: 0.09, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.035, bevelThickness: 0.025, curveSegments: 12 }), wood);
      kantele.add(body);
      const dark = U.mat(0x805331, { roughness: 0.85 });
      const hole = U.mesh(new T.CircleGeometry(0.065, 24), dark, -0.05, 0, 0.117);
      kantele.add(hole, U.torus(0.079, 0.008, U.mat(0xb3794d), -0.05, 0, 0.118),
        U.torus(0.099, 0.005, U.mat(0xf3cb92), -0.05, 0, 0.118));
      const stringMat = U.mat(0xffedbb, { roughness: 0.35, metalness: 0.3 });
      function bar(x1, y1, x2, y2, radius, material, z) {
        const d = new T.Vector3(x2 - x1, y2 - y1, 0);
        const mesh = new T.Mesh(new T.CylinderGeometry(radius, radius, d.length(), 8), material);
        mesh.position.set((x1 + x2) / 2, (y1 + y2) / 2, z);
        mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize());
        kantele.add(mesh);
      }
      bar(-0.57, -0.16, -0.57, 0.09, 0.024, dark, 0.14);
      for (let i = 0; i < 5; i++) {
        const y = -0.14 + i * 0.052, x = 0.56 - i * 0.072, endY = -0.09 + i * 0.085;
        bar(-0.57, y, x, endY, 0.008, stringMat, 0.155);
        const pin = U.mesh(new T.SphereGeometry(0.023, 10, 8), dark, x, endY, 0.155);
        kantele.add(pin);
      }
      kantele.position.set(0, 0.37, 1.0);
      kantele.rotation.set(-0.35, 0, -0.10);
      view.camera.position.set(0, 2.5, 7.2);
      el = document.getElementById('pianoBoard'); cv = document.getElementById('pianoCanvas'); g2 = cv.getContext('2d');
      el.addEventListener('pointerdown', (e) => {
        if (e.button != null && e.button > 0) return;
        e.preventDefault();
        const r = el.getBoundingClientRect();
        tap(Math.max(0, Math.min(LANES - 1, Math.floor((e.clientX - r.left) / r.width * LANES))));
      });
      el.addEventListener('contextmenu', (e) => e.preventDefault());
      window.addEventListener('resize', () => { if (!el.hidden) { size(); draw(); } });
    }
    return {
      label: 'Tiles', nocount: true, hint: 'Tap the Start tile, then every tile in order.',
      snap() {                                        // the corner picture for an online race: the next tiles sliding down the four lanes
        if (!chart.length) return null;
        const now = performance.now(), v = snapPos === null || now <= snapAt ? 0 : (pos - snapPos) * unit() / H / ((now - snapAt) / 1000);
        snapPos = pos; snapAt = now;
        const tiles = [];
        for (let i = Math.max(0, next - 1); i < next + 7; i++) tiles.push([tile(i).lane, Math.round((startOf(i) - pos) * unit() / H * 100) / 100]);
        return { t: tiles, v: Math.round(Math.max(0, v) * 100) / 100, n, m: mode === 'fail' ? 1 : 0, l: LANES };
      },
      /* tutorial: point at the Start tile, and only a tap in its lane begins */
      tutSpot(step) {
        if (step !== 'start' || !cv || !W) return null;
        const r = cv.getBoundingClientRect(), t = tile(0), u = unit(), lw = W / LANES, bottom = H * LINE - (startOf(0) - pos) * u, h = t.d * u;
        return { spot: { x: r.left + (t.lane + 0.5) * lw * r.width / W, y: r.top + (bottom - h / 2) * r.height / H }, where: (px) => Math.floor((px - r.left) / r.width * LANES) === t.lane };
      },
      view: () => view,
      peek: () => ({ pos, next, n, mode, lane: chart.length ? tile(next).lane : -1, bpm: bpm(pos), total, count: chart.length }),
      read, tap,
      start() {
        if (!view) build();
        cast(view, 0.85, true);
        face(0);
        actor.sq.add(kantele);
        song = pickSong();
        const c = read(song); chart = c.tiles; total = c.len;
        PN.Games.opts = { pay: song.pay || 1 };
        songTitle(song.title);   // keep the current tune visible throughout the round
        pos = 0; next = 0; n = 0; mode = 'ready'; wait = 0; bad = -1; badTile = -1; lastLane = -1; lastAt = 0; bop = 0;
        el.hidden = false;
        size(); draw();
        A.hush(true);
      },
      stop() { songTitle(''); if (kantele.parent) kantele.parent.remove(kantele); actor.flipL.position.set(0.66, 0.2, 0.36); actor.flipR.position.set(-0.66, 0.2, 0.36); el.hidden = true; A.hush(false); if (view) view.rig.position.y = 0; },
      go() { K.score(0, true); },
      pointer() {},
      key() {},
      update(dt, playing) {
        clock += dt;
        lens(view);
        lookAtPool(view, 1.2);
        bop = Math.max(0, bop - dt * 7);
        view.rig.position.y = Math.sin(bop * PI) * 0.07;
        actor.update(dt, clock, null);
        actor.flipL.position.set(0.62, 0.31, 0.78);
        actor.flipR.position.set(-0.62, 0.31, 0.78);
        actor.flipL.rotation.set(-0.12 - bop * 0.18, -0.45, 0.18);
        actor.flipR.rotation.set(-0.12, 0.45, -0.18);
        if (!W) size();
        if (playing && mode === 'play') {
          pos += dt * bpm(pos) / 15;
          const t = tile(next), u = unit();
          if (H * LINE - (startOf(next) - pos) * u - t.d * u > H) fail(t.lane, next, tr('Missed one!'));
        } else if (playing && mode === 'fail') { wait -= dt; if (wait <= 0) { mode = 'done'; K.over(why); } }
        draw();
      },
    };
  })();


  /* ================= Typing Seal ================= */
  /* How fast can you type? A word comes up with a quick 3, 2, 1 (1.5 seconds in all, so it can be read before the clock starts), then a window to type it in
     that shrinks as the run goes on (PN.typeWindow). Every letter is checked as it is typed, no Enter. A wrong letter, or running out of time, costs a heart (a typo also starts the same word over, with a new 3, 2, 1 and timer);
     three hearts and it is over. A word with no typo adds to the streak, and a streak makes the fins smash harder, with more snow flying off the keys. After each word a fish is thrown in to her mouth. The score is the words typed.
     Words are in data.js (PN.TYPE_WORDS). In an online race both players get the same words, in the same language, from the shared seed.
     The box under the word is a real text input so a phone keyboard comes up; it is kept equal to what has been typed correctly so far. */
  const typer = (() => {
    const CFG = PN.TYPE, TIER = [0, 1, 2];
    let view = null, el = null, wordEl = null, countEl = null, barEl = null, boxEl = null, inEl = null, phEl = null, livesEl = null, streakEl = null, cardEl = null;
    let fishes = [], puffs = null, fish = null, flight = 0, fishI = 0, sealScreenY = 0, besideCard = false, camX = 0, halfW = 3;
    let kb = null, keys = {}, keyList = [], space = null, fins = [], finAlt = 0;
    let paintRoom, pixelsPerUnit = 107;
    const mp = new T.Vector3(), kp = new T.Vector3();
    let mode = 'idle', t = 0, word = '', typed = 0, n = 0, lives = 3, maxLives = 3, streak = 0, typo = false, win = 1, lang = 'en', recent = [], said = -1, wait = 0, mum = false, shown = '';
    const coarse = () => !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

    /* The next word: easy ones at first, longer words and short phrases later. The same for both players in a race (reseed per word). */
    function pick() {
      G.reseed(n);
      const words = PN.TYPE_WORDS[lang];
      const p3 = mum ? 0 : n < 8 ? 0 : Math.min(0.5, (n - 8) / 40), p1 = Math.max(0.12, 1 - n / 18), p2 = Math.max(0, 1 - p1 - p3), sum = p1 + p2 + p3;
      const r = grnd() * sum, tier = r < p1 ? 0 : r < p1 + p2 ? 1 : 2, list = words[tier];
      let w = list[0];
      for (let i = 0; i < 24; i++) { w = list[Math.floor(grnd() * list.length)]; if (recent.indexOf(w) < 0) break; }
      recent.push(w); if (recent.length > 14) recent.shift();
      return w;
    }
    function fit() {
      if (!wordEl || !word) return;
      wordEl.style.fontSize = '';
      const range = document.createRange();
      range.selectNodeContents(wordEl);
      const width = range.getBoundingClientRect().width;
      // Both bounds include the postcard's brief scale animation. Leave a little ink margin.
      const available = wordEl.getBoundingClientRect().width - 4;
      if (available > 0 && width > available) {
        const font = parseFloat(getComputedStyle(wordEl).fontSize);
        wordEl.style.fontSize = Math.max(1, Math.floor(font * available / width) - 1) + 'px';
      }
    }
    function sizeBoard() {
      // Mobile browsers can resize just the visual viewport when the system keyboard opens.
      const visibleHeight = Math.min(window.innerHeight, window.visualViewport?.height || window.innerHeight);
      el.style.setProperty('--ty-vh', visibleHeight + 'px');
      el.classList.toggle('compact', visibleHeight <= 520);
      besideCard = visibleHeight <= 520 && window.innerWidth >= 480 && window.innerWidth > visibleHeight;
      el.classList.toggle('beside', besideCard);
      el.classList.toggle('shallow', visibleHeight <= 250 && besideCard);
      const bandTop = 48, bandBottom = besideCard ? visibleHeight : el.offsetTop;
      pixelsPerUnit = U.clamp((bandBottom - bandTop) * 0.78, 45, 125);
      sealScreenY = besideCard ? Math.max(73, visibleHeight * 0.55) : bandBottom - pixelsPerUnit * 0.67 - 8;
      const sealX = window.innerWidth * (besideCard ? 0.165 : 0.43);
      paintRoom(window.innerWidth, window.innerHeight, sealScreenY + pixelsPerUnit * 0.17, sealX, pixelsPerUnit / 107);
      fit();
    }
    function paintWord() {
      const kids = wordEl.children;
      if (kids.length !== word.length) {
        wordEl.innerHTML = '';
        for (let i = 0; i < word.length; i++) { const s = document.createElement('span'); s.textContent = word[i]; wordEl.appendChild(s); }
        fit();
      }
      for (let i = 0; i < word.length; i++) kids[i].className = i < typed ? 'done' : i === typed && mode === 'type' ? 'cur' : '';
    }
    function lifeRow(hitAt) {
      let h = '';
      for (let i = 0; i < maxLives; i++) h += PN.UI.ic('heartfull').replace('class="ic"', 'class="ic' + (i >= lives ? ' lost' : '') + (i === hitAt ? ' hit' : '') + '"');
      livesEl.innerHTML = h;
      livesEl.setAttribute('aria-label', tr('Hearts left: {0}', lives));
    }
    function streakText() { streakEl.textContent = streak >= 3 ? tr('Streak {0}', streak) : ''; }
    function setPh() {
      const text = mode === 'ready' ? tr(coarse() ? 'Tap here, then type' : 'Press any key to start') : mode === 'show' ? tr('Read it...') : mode === 'type' ? tr('Type it!') : '';
      if (text !== shown) { shown = text; phEl.textContent = text; }
      boxEl.classList.toggle('typing', typed > 0);
    }
    /* Where the camera goes so she and the fish sit in the band above the word card, whatever the screen: the same size on the screen on a phone, a wide
       window and a desktop (PXU pixels to a unit), and in a short landscape window to the left of the card, low down, out of the way of the keyboard. */
    function layout() {
      const hpx = window.innerHeight, a = W.aspect, half = Math.tan(W.camera.fov * PI / 360), dz = hpx / (2 * half * pixelsPerUnit);
      const cy = 0.35 + dz * 0.28, ndcY = 1 - 2 * sealScreenY / hpx;
      const theta = Math.atan((cy - 0.35) / dz) + Math.atan(ndcY * half), cx = (besideCard ? 0.67 : 0.14) * dz * half * a;
      camX = cx; halfW = dz * half * a;
      view.camera.position.set(cx, cy, dz);
      view.camera.lookAt(cx, cy - dz * Math.tan(theta), 0);
    }
    function focus() { try { inEl.focus({ preventScroll: true }); } catch (e) { /* the browser said no: a tap will do it */ } }

    function nextWord(again) {   // again: a typo, so the same word starts over
      if (!again) word = pick();
      const first = n === 0 || again;   // the first word of a run and a restart after a typo get the 3, 2, 1; other words start as they appear
      typed = 0; typo = false; mode = first ? 'show' : 'type'; t = 0; said = -1;
      win = PN.typeWindow(n, word.length, mum);
      cardEl.className = first ? 'ty-card show' : 'ty-card'; countEl.className = 'ty-count'; countEl.textContent = '';
      if (first) { boxEl.classList.add('wait'); boxEl.classList.remove('live'); }   // nothing to type yet: the box stays out of sight (the keyboard stays up)
      barEl.style.width = '100%'; barEl.className = '';
      inEl.value = '';
      wordEl.innerHTML = ''; paintWord(); setPh();
      if (!first) startTyping();
    }
    function startTyping() {
      mode = 'type'; t = 0;
      cardEl.className = 'ty-card'; void cardEl.offsetWidth; cardEl.className = 'ty-card go';   // the card flashes green and the box pops up: now is the time to look at the keyboard
      boxEl.classList.remove('wait'); boxEl.classList.add('live'); boxEl.classList.remove('pop'); void boxEl.offsetWidth; boxEl.classList.add('pop');
      countEl.className = 'ty-count'; countEl.textContent = '';
      A.play('chirp', 0.5);
      const st = PN.Game.state;
      if (st && st.settings.haptics && navigator.vibrate) { try { navigator.vibrate(40); } catch (e) { /* not allowed here */ } }
      paintWord(); setPh();
      if (document.activeElement !== inEl) focus();
    }
    function hit() {   // one heart gone
      lives--; streak = 0;
      lifeRow(lives); streakText();
      actor.gesture('shake', true); A.play('nope');
      const st = PN.Game.state;
      if (st && st.settings.haptics && navigator.vibrate) { try { navigator.vibrate(30); } catch (e) { /* not allowed here */ } }
      if (lives <= 0) { mode = 'done'; K.over(tr('Out of hearts!')); }
    }
    function wrong() {
      typo = true; hit();
      boxEl.classList.remove('bad'); void boxEl.offsetWidth; boxEl.classList.add('bad');
      if (mode !== 'done') { nextWord(true); K.beat('typo'); }   // the same word from the first letter, with the 3, 2, 1 and a fresh timer
    }
    function late() {
      for (let i = typed; i < word.length; i++) wordEl.children[i].style.color = '#d8334f';
      cardEl.classList.remove('late'); void cardEl.offsetWidth; cardEl.classList.add('late');
      countEl.className = 'ty-count pop'; countEl.textContent = tr('Too slow!');
      mode = 'gap'; wait = 1.0; barEl.style.width = '0%'; boxEl.classList.add('wait'); boxEl.classList.remove('live');
      hit();
      if (mode === 'gap' && n >= 3) K.beat('shrink');
    }
    function done() {
      n++; K.score(n);
      streak = typo ? 0 : streak + 1; streakText();
      mode = 'gap'; wait = 0.6; paintWord(); boxEl.classList.add('wait'); boxEl.classList.remove('live');
      throwFish();
      if (n % 10 === 0) A.play('chirp');
      if (n === 1) K.beat('first'); else if (n === 4) K.beat('streak');
    }
    /* Letters typed (from the box or the keyboard). Each one is right or a typo; only one heart goes for one burst of letters. */
    function chars(str) {
      let bad = false;
      str = str.normalize('NFC');   // an accent can arrive as a letter plus a combining mark on some keyboards
      for (let i = 0; i < str.length && mode === 'type'; i++) {
        const c = str[i].toLowerCase();
        if (c === word[typed]) {
          typed++; A.play('tap', 0.12); smash(c, true);
          if (typed === word.length) { done(); break; }
        } else if (!bad) { bad = true; smash(c, false); wrong(); }
      }
      if (mode === 'type') { paintWord(); setPh(); }
      inEl.value = mode === 'type' ? word.slice(0, typed) : '';
    }
    /* A fin comes down on a key (the other fin on the other side, one after the other in the middle). ok: false means a typo, and the key flashes red. */
    function smash(ch, ok) {
      /* Strictly left fin, right fin, left fin... on a key from that fin's side. Exact keys do not matter. */
      const side = finAlt, f = fins[side]; finAlt ^= 1; const _u = 0, pool = keyList.filter(q => side ? q.x < 0.05 : q.x > -0.05);
      const k = ch === ' ' ? space : pool[Math.floor(rnd() * pool.length)];
      f.t = 0; f.k = k; f.hit = false; f.big = rnd() < 0.25; k.ok = ok ? 1 : -1;
    }
    /* After a word, a fish is thrown in from off screen, in an arc, to her mouth. */
    function throwFish() {
      fish = fishes[fishI++ % fishes.length]; fish.m.visible = true; flight = 0.0001; fish.m.scale.setScalar(fish.s);
    }
    function begin() {
      if (mode !== 'ready') return;
      mode = 'gap'; wait = 0.25; K.hint(''); boxEl.classList.add('wait'); focus(); setPh();
    }

    function fishMesh(id) {
      const m = new T.Group(), f = PN.Props.fish(PN.items[id].look, true);
      f.scale.setScalar(1); f.rotation.y = PI; m.add(f); m.visible = false;
      return { m, f, s: 0.22 };
    }
    /* A little keyboard in front of her: three rows of keys and a space bar, in her own space so it grows with her. The fins smash the key that was typed. */
    function keyboard() {
      kb = new T.Group();
      const enamel = U.mat(0x377d78), rim = U.mat(0x244c50), brass = U.mat(0xd7a65a);
      function casePart(w, h, d, r, mat, x, y, z) {
        const shape = new T.Shape();
        const a = w / 2, b = d / 2;
        shape.moveTo(-a + r, -b); shape.lineTo(a - r, -b); shape.quadraticCurveTo(a, -b, a, -b + r);
        shape.lineTo(a, b - r); shape.quadraticCurveTo(a, b, a - r, b);
        shape.lineTo(-a + r, b); shape.quadraticCurveTo(-a, b, -a, b - r);
        shape.lineTo(-a, -b + r); shape.quadraticCurveTo(-a, -b, -a + r, -b);
        const geo = new T.ExtrudeGeometry(shape, { depth: h, bevelEnabled: true, bevelSegments: 2, bevelSize: 0.012, bevelThickness: 0.012, curveSegments: 4 });
        geo.rotateX(-PI / 2);
        const part = U.mesh(geo, mat, x, y, z); kb.add(part); return part;
      }
      casePart(1.68, 0.05, 0.84, 0.11, rim, 0, 0.035, 1.25);
      casePart(1.64, 0.09, 0.81, 0.10, enamel, 0, 0.077, 1.25);
      casePart(1.41, 0.012, 0.53, 0.06, rim, 0, 0.163, 1.33);
      const roller = U.mesh(new T.CylinderGeometry(0.052, 0.052, 1.27, 16), rim, 0, 0.225, 0.975);
      roller.rotation.z = PI / 2; kb.add(roller);
      for (const side of [-1, 1]) {
        const knob = U.mesh(new T.CylinderGeometry(0.078, 0.078, 0.09, 16), brass, side * 0.68, 0.225, 0.975);
        knob.rotation.z = PI / 2; kb.add(knob);
      }
      const slip = U.tex(256, 96, c => {
        c.fillStyle = '#fff2d5'; c.fillRect(0, 0, 256, 96);
        c.fillStyle = '#ba7964'; c.fillRect(209, 11, 27, 28);
        c.fillStyle = '#a3aca3';
        for (const [y, w] of [[31, 84], [44, 70], [57, 98]]) c.fillRect(21, y, w, 3);
      });
      const letter = U.mesh(new T.PlaneGeometry(0.86, 0.23), U.mat(0xffffff, { map: slip, side: T.DoubleSide }), 0, 0.31, 0.96);
      letter.rotation.x = -0.26; kb.add(letter);
      const rows = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'], sp = 0.13;
      const cap = new T.CylinderGeometry(0.052, 0.058, 0.048, 14);
      function key(ch, x, z, w) {
        const mat = U.mat(ch === ' ' ? 0xf0c583 : 0xffeed2, { roughness: 0.55 });
        const y = 0.215;
        const mesh = w ? casePart(w, 0.027, 0.09, 0.035, mat, x, y, z) : U.mesh(cap, mat, x, y, z);
        if (!w) kb.add(mesh);
        const k = { x, z, y, mesh, mat, press: 0, ok: 1 };
        keyList.push(k); return k;
      }
      rows.forEach((row, ri) => row.split('').forEach((ch, i) => { keys[ch] = key(ch, (i - (row.length - 1) / 2) * sp, 1.13 + ri * sp); }));
      space = key(' ', 0, 1.52, 0.65);
      keyList.pop();   // the space bar is not one of the keys a wrong letter lands on
    }
    function build() {
      view = stage('#aec9c9', '#dfba8a', { ground: 0xf0d3ad, hemi: 1.65, key: 1.85 });
      view.scene.background.dispose();
      paintRoom = PN.TypingArt.room(view.scene);
      const sc = view.scene;
      keyboard();
      ['muikku', 'ahven', 'hauki'].forEach((id) => { const fm = PN.items[id] ? fishMesh(id) : fishMesh('muikku'); sc.add(fm.m); fishes.push(fm); });
      puffs = Puffs(sc, 36, 0xfff1b5, 1);
      el = document.getElementById('tyBoard'); wordEl = document.getElementById('tyWord'); countEl = document.getElementById('tyCount'); barEl = document.getElementById('tyBar');
      boxEl = document.getElementById('tyBox'); inEl = document.getElementById('tyIn'); phEl = document.getElementById('tyPh'); livesEl = document.getElementById('tyLives');
      streakEl = document.getElementById('tyStreak'); cardEl = document.getElementById('tyCard');
      inEl.setAttribute('aria-label', tr('Type the word'));
      inEl.addEventListener('input', () => {
        if (mode !== 'type') { inEl.value = ''; return; }
        const v = inEl.value;
        if (v.length <= typed) { inEl.value = word.slice(0, typed); return; }   // a backspace: nothing to take back
        chars(v.slice(typed));
      });
      inEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });
      // A tap anywhere (but the top bar) keeps the keyboard up and the box focused; in the pause before the first word it also starts the game.
      document.addEventListener('pointerdown', (e) => {
        if (el.hidden || !PN.Games.active || (e.target.closest && e.target.closest('.g-top'))) return;
        if (e.target !== inEl) e.preventDefault();
        if (mode === 'ready') begin(); else focus();
      }, true);
      streakEl.before(countEl);
      const resize = () => { if (!el.hidden) sizeBoard(); };
      window.addEventListener('resize', resize);
      window.visualViewport?.addEventListener('resize', resize);
    }
    return {
      label: 'Words', nocount: true, hint: '',
      view: () => view,
      peek: () => ({ mode, word, typed, n, lives, streak, win, lang, left: win - t }),
      type: (s) => chars(s), begin,
      crop() {   // the part of the screen worth sending in an online race: just the seal and her keyboard (the word is sent as numbers and drawn over it)
        if (!view) return null;
        const c = view.camera, v = new T.Vector3(), out = { x0: 1, x1: -1, y0: 1, y1: -1 };
        c.updateMatrixWorld();
        [[-1.15, -0.15], [1.15, -0.15], [-1.15, 1.2], [1.15, 1.2]].forEach(([x, y]) => {
          v.set(x * 0.55 * 1.3, y * 0.55 * 1.3, 0.55).project(c);
          out.x0 = Math.min(out.x0, v.x); out.x1 = Math.max(out.x1, v.x); out.y0 = Math.min(out.y0, v.y); out.y1 = Math.max(out.y1, v.y);
        });
        const f = (a) => Math.max(0, Math.min(1, a));
        const x = f((out.x0 + 1) / 2), y = f((1 - out.y1) / 2), x2 = f((out.x1 + 1) / 2), y2 = f((1 - out.y0) / 2);
        return x2 - x > 0.1 && y2 - y > 0.05 ? { x, y, w: x2 - x, h: y2 - y } : null;
      },
      snap() {   // the corner picture in an online race: the word and how far they have got, drawn small
        if (!word) return null;
        return { w: word, p: typed, l: lives, k: maxLives, n, s: streak, m: mode === 'show' ? 1 : mode === 'type' ? 2 : 0, c: mode === 'show' ? Math.max(1, said > 0 ? 3 - said + 1 : 3) : 0, f: mode === 'type' ? Math.round(Math.max(0, 1 - t / win) * 100) / 100 : 1 };
      },
      start() {
        if (!view) build();
        cast(view, 0.55, true);
        face(0);
        actor.sq.add(kb);
        fins = [{ fin: actor.flipL, rx: 0.62, rot: [-0.12, -0.45, 0.18], t: 1, k: null, hit: true }, { fin: actor.flipR, rx: -0.62, rot: [-0.12, 0.45, -0.18], t: 1, k: null, hit: true }];
        mum = G.mumMode;
        const v = G.versusInfo && G.versusInfo();
        lang = v && (v.lang === 'fi' || v.lang === 'en') ? v.lang : (PN.isFi() ? 'fi' : 'en');
        maxLives = mum ? CFG.mumLives : CFG.lives; lives = maxLives;
        n = 0; streak = 0; recent = []; word = ''; typed = 0; mode = 'ready'; t = 0; wait = 0; said = -1; shown = ''; fish = null; flight = 0;
        fishes.forEach((f) => { f.m.visible = false; });
        K.hint(coarse() ? 'Tap the box and type the word.' : 'Press any key and type the word.');
        wordEl.innerHTML = ''; wordEl.style.fontSize = ''; wordEl.textContent = tr('Ready?');
        countEl.className = 'ty-count'; countEl.textContent = ''; cardEl.className = 'ty-card'; barEl.style.width = '100%'; barEl.className = '';
        inEl.value = ''; boxEl.className = 'ty-box';
        lifeRow(-1); streakText(); setPh();
        el.hidden = false;
        sizeBoard();
        if (!coarse()) focus();
      },
      stop() { if (el) { el.hidden = true; inEl.blur(); inEl.value = ''; } mode = 'idle'; if (kb && kb.parent) kb.parent.remove(kb); if (actor && actor.g) { actor.flipL.position.set(0.66, 0.2, 0.36); actor.flipR.position.set(-0.66, 0.2, 0.36); } },
      go() { K.score(0, true); },
      pointer() {},
      key(k) {
        if (mode === 'ready') { if (k && k.length === 1) begin(); return; }
        if (mode === 'type' && document.activeElement !== inEl && k && k.length === 1) { chars(k); focus(); }
      },
      update(dt, playing) {
        clock += dt;
        lens(view);
        layout();
        puffs.update(dt, 0, 0);
        actor.update(dt, clock, null);
        // the fins: down on the typed key and back to rest
        fins.forEach((f) => {
          if (f.t < 1) {
            f.t += dt / 0.17;
            const p = Math.sin(PI * Math.min(1, f.t)), k = f.k, w = f.big ? 1.9 : 1;
            f.fin.position.set(U.lerp(f.rx, k.x, p * 0.9), U.lerp(0.31, k.y + 0.16, p) + (f.big ? 0.35 * Math.sin(PI * Math.min(1, f.t * 0.5)) : 0), U.lerp(0.78, k.z - 0.08, p));
            f.fin.rotation.set(f.rot[0] + p * 0.7 * w, f.rot[1], f.rot[2] + (f.big ? Math.sin(f.t * 20) * 0.3 : 0));
            if (f.t >= 0.5 && !f.hit) {
              f.hit = true; k.press = 1; if (f.big) actor.gesture('shake', true);
              k.mesh.getWorldPosition(kp);
              puffs.emit(kp.x, kp.y + 0.1, kp.z, (f.big ? 8 : 2) + Math.min(6, streak), 0.7, 0.04, 0.45, 2);
            }
          } else { f.fin.position.set(f.rx, 0.31, 0.78); f.fin.rotation.set(f.rot[0], f.rot[1], f.rot[2]); }
        });
        keyList.concat([space]).forEach((k) => {
          k.press = Math.max(0, k.press - dt * 7);
          k.mesh.position.y = k.y - 0.04 * k.press;
          k.mat.emissive.setHex(k.ok > 0 ? 0x2f9e63 : 0xd8334f); k.mat.emissiveIntensity = k.press;
        });
        // the fish comes in from off screen to her mouth
        if (fish && flight > 0) {
          flight += dt / 1.2;
          const q = Math.min(1, flight);
          actor.mouthA.getWorldPosition(mp);
          const sx = camX + halfW + 1.2, sy = mp.y + 0.25;
          fish.m.position.set(U.lerp(sx, mp.x, q), U.lerp(sy, mp.y, q) + Math.sin(q * PI) * 0.35, mp.z);
          fish.m.rotation.z = q * 3;
          if (q >= 1) {
            fish.m.visible = false; flight = 0;
            actor.gesture('gulp', true); A.play('gulp'); A.play('squeak', 0.5);
            puffs.emit(mp.x, mp.y, mp.z + 0.1, 8, 1.4, 0.06, 0.6, 2);
          }
        }
        const bob = Math.sin(clock * 2.4) * 0.02;
        view.rig.position.y = bob;
        if (!playing) return;
        if (mode === 'gap') { wait -= dt; if (wait <= 0) nextWord(); }
        else if (mode === 'show') {
          t += dt;
          const c = 3 - Math.floor(t / (CFG.show / 3));
          if (c !== said && c >= 1) { said = c; countEl.textContent = String(c); countEl.className = 'ty-count pop'; A.play('tick'); }
          if (t >= CFG.show) startTyping();
        } else if (mode === 'type') {
          t += dt;
          const left = win - t, frac = Math.max(0, left / win);
          barEl.style.width = (frac * 100).toFixed(1) + '%';
          barEl.className = frac < 0.25 ? 'low' : frac < 0.55 ? 'mid' : '';
          if (t > 0.6 && countEl.textContent === tr('Go!')) countEl.textContent = '';
          if (left <= 0) late();
        }
      },
    };
  })();


  /* ---------- Sauna: how she gets clean ----------
     Not a game for coins: a go is a run of rounds, and every round that goes well scrubs a share of the dirt away (see Sim.saunaDone).
     A heat bar fills up the side with a gold line on it, like the swing bar in a golf game. Hold her by the head and pull her out of the sauna
     when the bar is on the line; the bar stops the moment she is out. Then dunk her in the ice hole to start the next round.
     She is a rag doll: held by the head she hangs from it like a pendulum (the pull of the drag swings her), let go and she falls, lands and flops flat.
     The physics runs in a flat plane (x across, y up) and she moves toward the camera as she goes through the door. Five rounds, up to 3 points each. */
  const sauna = (() => {
    let need = 5;   // rounds in this go
    const HINT = 'Hold her by the head. When the bar is on the gold line, drag her down out of the sauna and into the ice hole.';
    const GRAV = 8, GP = 3.2, BENCH = 0.5, HALF = 0.29, ZIN = -0.8, TUB = { x: -0.07, z: 3.0, r: 0.95 }, ZOUT = TUB.z, OUTX = 1.02, HEADOUT = 0.2, LEN = 1.5, ROLL = -PI / 2, CH = 3.1;   // CH: how tall the cabin is
    let view = null, layer = null, targetEl = null, fillEl = null, rag = null, door = null, lamp = null, stonesMat = null, steam = null, splash = null, sparks = null, ripple = null, rippleMat = null;
    let rollG = null, roll = 0, phi = 0, phiV = 0;   // phi: how far her head is tilted off her body, in the screen plane
    const qa = new T.Quaternion(), qb = new T.Quaternion(), qc = new T.Quaternion(), qt = new T.Quaternion(), zax = new T.Vector3(0, 0, 1), fdir = new T.Vector3(), fup = new T.Vector3(), zero = new T.Vector3(), fm = new T.Matrix4();
    let faceW = 0;   // how much her face is turned to the camera (while she is held)
    let draining = false, tutRound = false, tutHold = false, armed = true, autoT = 0, doorT = 0, live = false, mode = 'in', zone = 'in', round = 0, score = 0, bar = 0, target = 0.7, tol = 0.07, held = false, grounded = true, th = 0, om = 0, z = ZIN, doorOpen = 0, rippleT = 0, steamT = 0, ptr = null, clockT = 0, outAt = 0;
    const com = { x: -0.35, y: BENCH + HALF }, vel = { x: 0, y: 0 }, head = { x: 0, y: 0 }, hv = { x: 0, y: 0 }, gv = { x: 0, y: 0 }, acc = { x: 0, y: 0 }, offs = { x: 0, y: 0 };   // offs: where on the screen she was grabbed, relative to the finger
    let h0 = { x: 0.6, y: 0.1 }, ell = 0.6, tints = [], measured = false;
    const ray = new T.Raycaster(), v3 = new T.Vector3(), v2 = new T.Vector2(), bx = new T.Box3();
    const hvec = () => { const c = Math.cos(th), s = Math.sin(th); hv.x = h0.x * c - h0.y * s; hv.y = h0.x * s + h0.y * c; };
    const floorY = (x) => (zone === 'in' ? (x > -0.9 && x < 0.4 ? BENCH : 0.05) : (Math.abs(x - TUB.x) < TUB.r * 0.85 ? -0.8 : 0.05));
    /* where a finger on the screen is, on the flat plane the seal is moving in */
    function worldAt(x, y, plane) {
      v2.set(x / window.innerWidth * 2 - 1, -(y / window.innerHeight) * 2 + 1); ray.setFromCamera(v2, view.camera);
      const o = ray.ray.origin, d = ray.ray.direction, t = (plane - o.z) / d.z;
      return { x: o.x + d.x * t, y: o.y + d.y * t };
    }
    function fit() {
      // framed like the sketch: the cabin fills most of the width, the heat bar sits to its right and the ice hole lies in front, low on the screen
      const c = view.camera; c.aspect = W.aspect; c.fov = W.camera.fov; c.updateProjectionMatrix();
      const tv = Math.tan(c.fov * PI / 360), k = Math.max(8.0 * 0.534 * 0.462 / (tv * c.aspect), 4.1 / tv) / 8.0;
      c.position.set(0.27, 0.57 + 3.4 * k, 0.8 + 7.2 * k); c.lookAt(0.27, 0.57, 0.8); c.updateMatrixWorld(true);
    }
    function build() {
      view = stage('#1c2a4a', '#4a3a58', { ground: 0xdfe9f2, hemi: 1.15, key: 0.9 });
      const sc = view.scene;
      const snow = new T.MeshStandardMaterial({ color: 0xe3eef9, map: U.surfaceTex('snow'), roughness: 1 });
      const timber = U.tex(512, 256, (g, w, h) => {
        const grain = U.rng(521);
        for (let row = 0; row < 4; row++) {
          const y = row * 64, wash = g.createLinearGradient(0, y, 0, y + 64);
          wash.addColorStop(0, ['#dfb385', '#deb084', '#e8bb8c', '#d9ab81'][row]);
          wash.addColorStop(0.78, '#d7a678'); wash.addColorStop(1, '#c69770');
          g.fillStyle = wash; g.fillRect(0, y, w, h / 4);
          g.lineCap = 'round'; g.lineWidth = 1.6;
          for (let n = 0; n < 9; n++) {
            const x = grain() * w, line = y + 6 + grain() * 52, len = 24 + grain() * 115;
            g.strokeStyle = n % 2 ? 'rgba(105,63,43,.12)' : 'rgba(255,230,194,.25)';
            g.beginPath(); g.moveTo(x, line); g.bezierCurveTo(x + len * .4, line - 4, x + len * .7, line + 3, x + len, line); g.stroke();
          }
          g.strokeStyle = 'rgba(119,72,43,.18)'; g.beginPath();
          g.ellipse(75 + grain() * 355, y + 31, 13, 3, 0, 0, PI * 2); g.stroke();
          g.fillStyle = '#b68a69'; g.fillRect(0, y + 62, w, 2);
        }
      });
      timber.wrapS = timber.wrapT = T.RepeatWrapping;
      const wood = new T.MeshStandardMaterial({ color: 0xffedcf, map: timber, roughness: .9 });
      const dark = new T.MeshStandardMaterial({ color: 0xbd937a, map: timber, roughness: .9 });
      // Map planks in cabin units so a narrow post and a broad wall show the same grain size.
      function board(w, h, d, material, x, y, z, vertical = false) {
        const mesh = U.box(w, h, d, material, x, y, z), geo = mesh.geometry;
        const { position, normal, uv } = geo.attributes;
        for (let i = 0; i < uv.count; i++) {
          const top = Math.abs(normal.getY(i)) > .5, side = Math.abs(normal.getX(i)) > .5;
          const along = side ? position.getZ(i) + z : position.getX(i) + x;
          const across = top ? position.getZ(i) + z : position.getY(i) + y;
          uv.setXY(i, (vertical ? across : along) / 2.1, (vertical ? along : across) / .92);
        }
        return mesh;
      }
      // the snow is a slab with a real hole in it, so she can go right down into the water
      const gs = new T.Shape(); gs.moveTo(-8, -7); gs.lineTo(8, -7); gs.lineTo(8, 5); gs.lineTo(-8, 5); gs.closePath();
      const hp = new T.Path(); hp.absarc(TUB.x, -TUB.z, 1.0, 0, PI * 2, true); gs.holes.push(hp);
      const ground = new T.Mesh(new T.ExtrudeGeometry(gs, { depth: 0.3, bevelEnabled: false, curveSegments: 48 }), snow);
      ground.rotation.x = -PI / 2; ground.position.y = -0.3; sc.add(ground);
      // a small, tall cabin for one seal: the front wall has a big window and a door
      const WT = 2.9, tw = CH - WT, DH = 2.5;   // the window runs from the sill up to WT; the door is DH tall
      [[-1.275, CH / 2, 0.15, CH], [-0.475, 0.15, 1.45, 0.3], [-0.475, WT + tw / 2, 1.45, tw], [0.325, CH / 2, 0.15, CH], [0.775, (DH + CH) / 2, 0.75, CH - DH], [1.21, CH / 2, 0.12, CH]].forEach((r) => sc.add(board(r[2], r[3], 0.12, wood, r[0], r[1], 0)));
      sc.add(board(1.55, 0.05, 0.16, dark, -0.475, 0.32, 0.04));   // the window sill
      sc.add(board(0.12, CH, 1.4, wood, -1.35, CH / 2, -0.7), board(0.12, CH, 1.4, wood, 1.27, CH / 2, -0.7), board(2.76, CH, 0.12, wood, -0.04, CH / 2, -1.4));
      // A shallow pitched roof, capped in snow with a little overhang at the eaves.
      for (const side of [-1, 1]) {
        const slope = -side * 0.23;
        const eave = board(1.68, .12, 1.83, dark, -.04 + side * .80, CH + .18, -.70);
        eave.rotation.z = slope; sc.add(eave);
        const cap = U.box(1.73, .13, 1.88, snow, eave.position.x, CH + .29, -.70);
        cap.rotation.z = slope; sc.add(cap);
      }
      const gable = new T.Shape();
      gable.moveTo(-1.46, CH); gable.lineTo(-.04, CH + .37); gable.lineTo(1.38, CH); gable.closePath();
      sc.add(new T.Mesh(new T.ExtrudeGeometry(gable, { depth: .09, bevelEnabled: false }), wood));
      const chimney = U.mat(0x575a64, { roughness: .85 });
      sc.add(U.box(.23, .54, .26, chimney, .80, CH + .47, -.99),
        U.box(.30, .065, .32, chimney, .80, CH + .75, -.99));
      sc.add(board(2.6, 0.06, 1.4, dark, -0.04, 0.03, -0.7));
      sc.add(board(1.3, 0.08, 0.8, wood, -0.3, BENCH - 0.04, -0.95), board(1.3, 0.08, 0.4, wood, -0.3, 1.05, -1.2));
      sc.add(board(0.34, 0.5, 0.34, U.mat(0x33363d, { roughness: 0.6, metalness: 0.4 }), -1.18, 0.28, -0.75));
      stonesMat = new T.MeshStandardMaterial({ color: 0x6a3a24, emissive: 0xff5a1a, roughness: 1 });
      for (let i = 0; i < 5; i++) sc.add(U.ball(0.07 + rnd() * 0.03, i % 3 ? U.mat(0x55524f, { roughness: 1 }) : stonesMat, -1.18 + rs(0.1), 0.55 + rnd() * 0.03, -0.75 + rs(0.1), 1, 0.8, 1, 8, 6));
      lamp = new T.PointLight(0xffa85a, 6, 5); lamp.position.set(-0.3, 2.1, -0.4); sc.add(lamp);
      door = new T.Group(); door.position.set(1.15, 0, 0.08);
      door.add(board(0.75, DH, 0.05, dark, -0.375, DH / 2, 0, true), U.ball(0.035, U.mat(0xe2b680, { roughness: 0.4 }), -0.65, 1.2, 0.04));
      // A warm wall lamp gives the point light a visible source above the bench.
      const bronze = U.mat(0x6f5346, { roughness: .75 });
      sc.add(U.box(.29, .36, .09, bronze, -.78, 2.12, -1.28),
        U.box(.21, .24, .10, U.mat(0xffda95, { emissive: 0xffba65, emissiveIntensity: .75 }), -.78, 2.12, -1.22));
      for (const y of [2.02, 2.12, 2.22]) sc.add(U.box(.27, .025, .035, bronze, -.78, y, -1.16));
      // Snow-dusted birch rounds stacked beside the wall.
      const bark = U.mat(0xc4b7a2, { roughness: .94 }), cut = U.mat(0xe6c598);
      for (const [x, y] of [[1.52, .13], [1.76, .13], [1.64, .32]]) {
        const log = U.cyl(.13, .13, .54, bark, x, y, -.48, 14);
        log.rotation.x = PI / 2;
        const end = U.cyl(.106, .106, .012, cut, x, y, -.202, 14);
        end.rotation.x = PI / 2; sc.add(log, end);
      }
      sc.add(door);
      // a hole in the ice to dunk her in
      // One continuous rolled edge blends submerged blue ice into the soft snow shelf.
      const rings = [[.966, -.23, 0x81b9cd], [.970, -.066, 0xaddce6], [.987, .009, 0xc9e8ee],
        [1.035, .047, 0xe7f3f6], [1.10, .053, 0xf3f8fb], [1.21, .022, 0xeaf2f8], [1.30, -.008, 0xe3eef9]];
      const positions = [], colors = [], indices = [], segments = 80;
      rings.forEach(([radius, height, tint], row) => {
        const color = new T.Color(tint);
        for (let n = 0; n < segments; n++) {
          const a = n * PI * 2 / segments, variation = .55 * Math.sin(3*a) + .3 * Math.cos(5*a) + .15 * Math.sin(8*a);
          const r = radius + variation * (.009 + .008 * row);
          positions.push(r * Math.cos(a), height + .009 * variation, r * Math.sin(a));
          colors.push(color.r, color.g, color.b);
          if (row) {
            const here = row * segments + n, next = row * segments + (n + 1) % segments;
            indices.push(here - segments, next, here, here - segments, next - segments, next);
          }
        }
      });
      const ice = new T.BufferGeometry();
      ice.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
      ice.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
      ice.setIndex(indices); ice.computeVertexNormals();
      const lip = new T.Mesh(ice, new T.MeshStandardMaterial({ vertexColors: true, roughness: .73 }));
      lip.position.set(TUB.x, 0, TUB.z); sc.add(lip);
      const shaft = new T.Mesh(new T.CylinderGeometry(1.0, 1.0, 1.5, 48, 1, true), new T.MeshStandardMaterial({ color: 0x0d4a7a, side: T.BackSide, roughness: 0.4 })); shaft.position.set(TUB.x, -0.75, TUB.z); sc.add(shaft);
      const bottom = new T.Mesh(new T.CircleGeometry(1.0, 48), new T.MeshStandardMaterial({ color: 0x082c4d, roughness: 0.6 })); bottom.rotation.x = -PI / 2; bottom.position.set(TUB.x, -1.45, TUB.z); sc.add(bottom);
      const lake = U.tex(256, 256, (g, w, h) => {
        const depth = g.createRadialGradient(120, 111, 18, 128, 128, 132);
        depth.addColorStop(0, '#205471'); depth.addColorStop(.68, '#357990'); depth.addColorStop(1, '#80bfc9');
        g.fillStyle = depth; g.fillRect(0, 0, w, h);
        const rand = U.rng(517);
        g.lineCap = 'round';
        for (let i = 0; i < 26; i++) {
          const x = rand()*w, y = rand()*h, length = 5 + rand()*22;
          g.lineWidth = 1 + rand()*2; g.strokeStyle = 'rgba(196,236,240,.23)';
          g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + length*.5, y + 2, x + length, y); g.stroke();
        }
      });
      const water = new T.Mesh(new T.CircleGeometry(1, 80), new T.MeshStandardMaterial({
        map: lake, transparent: true, opacity: .78, roughness: .35, depthWrite: false
      }));
      water.rotation.x = -PI / 2; water.position.set(TUB.x, -.10, TUB.z); sc.add(water);
      rippleMat = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
      ripple = U.torus(0.3, 0.02, rippleMat, TUB.x, 0.05, TUB.z, PI * 2, 24); ripple.rotation.x = PI / 2; sc.add(ripple);
      const t1 = tree(1.2), t2 = tree(0.9); t1.position.set(-2.1, 0, -1.2); t2.position.set(2.2, 0, -1.2); sc.add(t1, t2);
      steam = Puffs(sc, 60, 0xffffff, 0.4); splash = Puffs(sc, 60, 0x9cdef7, 0.85); sparks = Puffs(sc, 40, 0xffd45c, 1);
      rag = new T.Group(); sc.add(rag); rollG = new T.Group(); rag.add(rollG);
      layer = document.createElement('div'); layer.className = 'sx-layer'; document.getElementById('gamehud').appendChild(layer);
      const bar = document.createElement('div'); bar.className = 'sx-bar'; layer.appendChild(bar);
      targetEl = document.createElement('div'); targetEl.className = 'sx-target'; bar.appendChild(targetEl);
      fillEl = document.createElement('div'); fillEl.className = 'sx-fill'; bar.appendChild(fillEl);
    }
    /* put the real seal on the rag doll: body centre at the pivot, in profile, scaled to a good size, and work out where her head is */
    function dress() {
      cast(view, 0.62, false);
      if (actor.shadow.parent) actor.g.remove(actor.shadow);
      rollG.add(actor.g); rollG.rotation.set(0, 0, 0); roll = 0;
      rag.position.set(0, 0, 0); rag.rotation.set(0, 0, 0); rag.scale.setScalar(1);
      actor.g.position.set(0, 0, 0); actor.look = null; actor.heading = PI / 2; actor.g.rotation.y = PI / 2;
      actor.update(0.001, clock, null); rag.updateMatrixWorld(true);
      bx.setFromObject(actor.g);
      const size = bx.getSize(v3), len = Math.max(size.x, size.z), s = LEN / len;
      const ctr = bx.getCenter(new T.Vector3());
      rag.scale.setScalar(s); actor.g.position.set(-ctr.x, -ctr.y, -ctr.z); rag.updateMatrixWorld(true);
      actor.headP.getWorldPosition(v3);
      h0 = { x: v3.x, y: v3.y }; ell = Math.hypot(h0.x, h0.y);
      tints = [];
      const seen = new Set();
      actor.g.traverse((o) => { if (!o.isMesh || !o.material) return; [].concat(o.material).forEach((m) => { if (m.emissive && !seen.has(m) && m.color && m.color.getHex() > 0x606060) { seen.add(m); tints.push({ m, e: m.emissive.getHex(), i: m.emissiveIntensity }); } }); });
    }
    function untint() { tints.forEach((t) => { t.m.emissive.setHex(t.e); t.m.emissiveIntensity = t.i; }); }
    function heat() {
      tints.forEach((t) => { t.m.emissive.setRGB(1, 0.25, 0.1); t.m.emissiveIntensity = bar * 0.5; });
      fillEl.style.height = bar * 100 + '%';
      lamp.intensity = 5 + bar * 9; stonesMat.emissiveIntensity = 0.6 + bar * 1.8;
    }
    function newTarget() {
      tol = Math.max(0.03, 0.07 - round * 0.01); target = 0.5 + rnd() * 0.4;
      targetEl.style.bottom = (target - tol) * 100 + '%'; targetEl.style.height = tol * 200 + '%';
    }
    function toRest() {
      phi = phiV = 0; zone = 'in'; mode = 'in'; held = false; grounded = true; z = ZIN; th = 0; om = 0; vel.x = vel.y = 0; gv.x = gv.y = acc.x = acc.y = 0;
      com.x = -0.35; com.y = BENCH + HALF; armed = true; autoT = 0; draining = false; bar = 0; roll = 0; newTarget(); heat(); hvec(); head.x = com.x + hv.x; head.y = com.y + hv.y;
      K.hint(tr(HINT));
    }
    function judge() {
      const d = Math.abs(bar - target), pts = tutRound ? 3 : d < tol * 0.4 ? 3 : d < tol ? 2 : d < tol * 2.2 ? 1 : 0;
      tutHold = false;
      if (!tutRound && pts > 0) { score++; K.score(score, true); document.getElementById('gScore').textContent = score + '/' + need; }   // a round counts if she came out near enough
      K.big(tr(pts === 3 ? 'Perfect!' : pts === 2 ? 'Good' : pts === 1 ? 'Nearly' : bar < target ? 'Too cold' : 'Too hot'), 1.3);
      A.play(pts ? 'match' : 'nope'); actor.gesture(pts >= 2 ? 'happy' : pts ? 'surprise' : 'sad', true);
      if (pts === 3) sparks.emit(head.x, head.y, z + 0.3, 16, 2.2, 0.05, 0.8, 4);
      mode = 'out'; zone = 'out'; doorT = 1.2; outAt = clockT; K.hint(tr('Down into the ice hole with her!'));
      if (tutRound) K.beat('out');
    }
    function dunk() {
      A.play('bubble'); A.play('pop', 0.5); actor.gesture('shake', true);
      splash.emit(TUB.x, 0.12, TUB.z, 30, 2.4, 0.06, 1.0, 9); rippleT = 0.7;
      if (!tutRound) round++;
      if (round >= need) { held = false; live = false; mode = 'done'; K.over(tr(score >= need ? 'Squeaky clean!' : 'All done!')); return; }
      // she stays in the water, cooled off: pull her out again and put her back in the sauna when you like
      mode = 'dunked'; draining = true; newTarget(); heat();   // the bar runs down on its own, not all at once K.hint(tr('Cooled! Drag her back up into the sauna.'));
      if (tutRound) K.beat('cool');
    }
    /* the screen is split in two: above this line (the foot of the cabin) she is inside the sauna, below it she is outside. Crossing it takes her through the door by itself. */
    function splitY() { return (-v3.set(0, 0, 0.1).project(view.camera).y * 0.5 + 0.5) * window.innerHeight; }
    /* put her back in the sauna: she glides in through the door and settles on the bench, and the next round begins */
    function enter() {
      const keep = held;   // still holding her: she stays in the hand, ready to be pulled straight back out; let go and she glides to the bench
      zone = 'in'; mode = 'in'; armed = false; doorT = 1.2;
      if (!keep) { held = false; autoT = 0.9; vel.x = vel.y = 0; om = 0; roll = 0; }
      A.play('squeak', 0.4); K.hint(tr(HINT));
      if (tutRound) { tutRound = false; K.beat('solo'); }
    }
    function step(dt) {
      if (autoT > 0) {   // being carried in: slide to the bench with the door held open
        autoT -= dt; const k = 1 - Math.exp(-dt * 6);
        com.x += (-0.35 - com.x) * k; com.y += (BENCH + HALF + 0.12 - com.y) * k; th += (Math.round(th / (2 * PI)) * 2 * PI - th) * k; om = 0; vel.x = vel.y = 0; hvec(); head.x = com.x + hv.x; head.y = com.y + hv.y;
        if (autoT <= 0) armed = true;
        return;
      }
      if (held && ptr) {
        const sp = splitY();
        let fy0 = ptr.y;
        if (zone === 'out' && mode === 'out') fy0 = Math.max(fy0, sp + 10);   // once she is out she stays out until she has been dunked
        if (zone === 'in' && !armed) fy0 = Math.min(fy0, sp - 10);
        const w = worldAt(ptr.x + offs.x, fy0 + offs.y, z);   // the same spot of her stays under the finger, even as she moves toward the camera
        let tx = w.x, ty = w.y;
        if (zone === 'in') {
          tx = U.clamp(tx, -0.55, 0.9); ty = Math.min(ty, CH - 0.1);
        } else { tx = U.clamp(tx, -0.75, 1.1); ty = U.clamp(ty, Math.abs(tx - TUB.x) < TUB.r * 0.9 ? -1.2 : 0.3, CH - 0.1); }
        const px = head.x, py = head.y, k = 1 - Math.exp(-dt * 16);
        head.x += (tx - head.x) * k; head.y += (ty - head.y) * k;
        const nvx = (head.x - px) / dt, nvy = (head.y - py) / dt;
        acc.x += (U.clamp((nvx - gv.x) / dt, -45, 45) - acc.x) * 0.35; acc.y += (U.clamp((nvy - gv.y) / dt, -45, 45) - acc.y) * 0.35;
        gv.x = nvx; gv.y = nvy;
        // she hangs from her head: a pendulum whose pivot is the finger, so the drag swings her
        hvec();
        const psi = Math.atan2(hv.y, hv.x), ux = -Math.cos(psi), uy = -Math.sin(psi);
        om += ((-ux * (GP + acc.y * 1.3) + uy * acc.x * 1.3) / ell - 0.55 * om) * dt; th += om * dt; hvec();
        com.x = head.x - hv.x; com.y = head.y - hv.y;
        const fy = floorY(com.x) + HALF;
        if (com.y < fy) { head.y += fy - com.y; com.y = fy; }
        vel.x = U.clamp(gv.x, -4, 4); vel.y = U.clamp(gv.y, -2, 4); grounded = false;   // a fast drag must not turn into a slingshot on release
        if (zone === 'in' && !armed && ptr.y < sp - 80) armed = true;   // she is well inside now, so pulling her out counts
        if (zone === 'in' && mode === 'in' && armed && ptr.y > sp) judge();   // dragged down across the line: out through the door she goes
        else if (zone === 'out' && mode === 'dunked' && ptr.y < sp - 6) enter();   // dragged back up over the line: back into the sauna
        if (mode === 'out' && clockT - outAt > 0.5 && com.y < 0.1 && Math.abs(com.x - TUB.x) < TUB.r) dunk();
      } else {
        vel.y -= GRAV * dt; com.x += vel.x * dt; com.y += vel.y * dt;
        if (zone === 'in') com.x = U.clamp(com.x, -0.55, 0.36); else com.x = U.clamp(com.x, -0.75, 1.1);
        const fy = floorY(com.x) + HALF; grounded = false;
        if (com.y <= fy) { com.y = fy; vel.y = vel.y < -1.2 ? -vel.y * 0.25 : 0; grounded = true; vel.x *= Math.exp(-7 * dt); }
        if (grounded) { const tt = Math.round(th / (2 * PI)) * 2 * PI; om += (-70 * (th - tt) - 10 * om) * dt; } else om *= Math.exp(-0.4 * dt);
        th += om * dt; hvec(); head.x = com.x + hv.x; head.y = com.y + hv.y;
        const inHole = Math.abs(com.x - TUB.x) < TUB.r * 0.85 && zone === 'out';
        if (inHole && com.y < 0.1) { vel.y *= Math.exp(-3 * dt); vel.x *= Math.exp(-3 * dt); if (mode === 'out' && clockT - outAt > 0.5) dunk(); }
      }
    }
    return {
      label: 'Rounds', hint: HINT,
      view: () => view,
      /* tutorial: point at her head, and only grabbing it ends the pause */
      tutSpot(step) {
        if (step !== 'gold' || !view) return null;
        actor.headP.getWorldPosition(v3); v3.project(view.camera);
        const sx = (v3.x * 0.5 + 0.5) * window.innerWidth, sy = (-v3.y * 0.5 + 0.5) * window.innerHeight;
        return { spot: { x: sx, y: sy }, where: (px, py) => Math.hypot(px - sx, py - sy) < 90 };
      },
      /* where things are on the screen, for tests */
      dbg() {
        const at = (x, y, zz) => { v3.set(x, y, zz).project(view.camera); return { x: (v3.x * 0.5 + 0.5) * window.innerWidth, y: (-v3.y * 0.5 + 0.5) * window.innerHeight }; };
        actor.headP.getWorldPosition(v3); v3.project(view.camera);
        return { head: { x: (v3.x * 0.5 + 0.5) * window.innerWidth, y: (-v3.y * 0.5 + 0.5) * window.innerHeight }, door: at(0.7, 1.2, 0), out: at(1.0, 1.2, ZOUT), tub: at(TUB.x, 0.2, ZOUT), cabin: at(-0.4, 1.8, 0), bench: at(-0.45, 1.3, ZIN), hx: head.x, com: { x: com.x, y: com.y }, zone, mode, bar, target, tol, th, round, score };
      },
      start() {
        if (!view) build();
        dress(); fit();
        need = (PN.Games.opts && PN.Games.opts.need) || 5;
        live = false; round = 0; score = 0; rippleT = 0; ptr = null; steam.clear(); splash.clear(); sparks.clear();
        tutRound = K.tutoring(); tutHold = false;   // the first time, round one is a guided practice that does not count
        layer.hidden = false; toRest();
        document.getElementById('gScore').textContent = '0/' + need;
      },
      stop() { live = false; held = false; if (layer) layer.hidden = true; untint(); if (actor && !actor.shadow.parent) actor.g.add(actor.shadow); },
      go() { live = true; },
      key() {},
      pointer(type, x, y) {
        if (!live) return;
        if (type === 'down') {
          actor.headP.getWorldPosition(v3); v3.project(view.camera);
          const sx = (v3.x * 0.5 + 0.5) * window.innerWidth, sy = (-v3.y * 0.5 + 0.5) * window.innerHeight;
          if (Math.hypot(x - sx, y - sy) < 90) {
            held = true; ptr = { x, y }; offs.x = sx - x; offs.y = sy - y;
            gv.x = gv.y = acc.x = acc.y = 0;
            actor.gesture('surprise', true); A.play('squeak', 0.4);
          }
        } else if (type === 'move') { if (held) ptr = { x: U.clamp(x, 0, window.innerWidth), y: U.clamp(y, 0, window.innerHeight - 70) }; }
        else if (held) { held = false; actor.gesture('wiggle', true); }
      },
      update(dt, playing) {
        clock += dt; clockT += dt;
        fit();
        const d = Math.min(dt, 1 / 30);
        if (draining && mode !== 'out') { bar = Math.max(0, bar - 0.55 * d); if (bar <= 0) draining = false; }   // cooling off in the water
        if (playing && live && mode === 'in' && !draining) {
          if (tutRound && bar >= target) { bar = target; if (!tutHold) { tutHold = true; K.beat('gold'); } }
          else if (!tutHold) bar = Math.min(1, bar + (0.09 + round * 0.012) * (1 + 2.2 * U.smooth(Math.max(0, target - 0.4), target, bar)) * d);   // slow at first, then it picks up as it nears the line
          if (bar >= 1) {   // cooked too long: she is flung out of the door
            held = false; zone = 'out'; z = ZOUT; com.x = 1.15; com.y = 1.0; vel.x = 1.2; vel.y = 2.6; om = 7; head.x = com.x; head.y = com.y; judge();
          }
        }
        const om0 = om;
        if (live || playing) { step(d * 0.5); step(d * 0.5); }
        // her head is a second, looser part: it lags behind when her body is flung round, then springs back
        const alpha = U.clamp((om - om0) / d, -70, 70);
        phiV += (-alpha * 0.9 - 38 * phi - 3.2 * phiV) * d; phi = U.clamp(phi + phiV * d, -0.95, 0.95);
        if (mode !== 'out') heat();
        // through the door she comes toward you; the door swings open for her
        const zT = zone === 'out' ? ZOUT : ZIN;
        z += (zT - z) * (1 - Math.exp(-d * 9));
        doorT = Math.max(0, doorT - dt);
        const dT = autoT > 0 || doorT > 0 || (zone === 'in' && held && ptr && ptr.y > splitY() - 150) ? 1 : 0;
        doorOpen += (dT - doorOpen) * (1 - Math.exp(-d * 6)); door.rotation.y = doorOpen * 1.45;
        roll += ((held ? ROLL : 0) - roll) * (1 - Math.exp(-d * 8)); rollG.rotation.x = roll;
        actor.headP.position.x = 0; actor.headP.position.z = 0.82;   // undo last frame's push before the model sets her pose
        actor.heading = PI / 2; actor.look = held ? view.camera.position : null; actor.update(dt, clock, null);
        actor.g.rotation.y = PI / 2;
        rag.position.set(com.x, com.y, z); rag.rotation.z = th;
        rag.updateMatrixWorld(true); actor.headP.parent.getWorldQuaternion(qa); qc.copy(qa).invert();
        faceW += ((held ? 1 : 0) - faceW) * (1 - Math.exp(-d * 8));
        if (faceW > 0.01) {   // held: turn her face to the camera, with the top of her head pointing away from her body
          actor.headP.getWorldPosition(v3); fdir.copy(view.camera.position).sub(v3).normalize(); fup.set(hv.x, hv.y, 0).normalize();
          fm.lookAt(fdir, zero, fup); qt.setFromRotationMatrix(fm); qt.premultiply(qc);
          actor.headP.quaternion.slerp(qt, faceW);
        }
        if (faceW > 0.01) {   // and while she is held, her head floats out a little from her body so it does not sink into it
          actor.headP.getWorldPosition(v3); fup.set(hv.x, hv.y, 0).normalize().multiplyScalar(HEADOUT * faceW).add(v3);
          actor.headP.parent.worldToLocal(fup); actor.headP.position.copy(fup);
        }
        qb.setFromAxisAngle(zax, phi);
        actor.headP.quaternion.premultiply(qc.multiply(qb).multiply(qa));   // turn the head about its own centre, in the screen plane
        // steam off the stones, thicker as she cooks; a ring on the water after a dunk
        steamT -= dt; if (steamT <= 0) { steamT = 0.14 - bar * 0.08; steam.emit(-1.75, 0.75, -1.0, 1, 0.25, 0.08, 1.8, -0.25); }
        steam.update(dt, 0, 0); splash.update(dt, 0, 0); sparks.update(dt, 0, 0);
        if (rippleT > 0) { rippleT = Math.max(0, rippleT - dt); const k = 1 - rippleT / 0.7; ripple.scale.setScalar(1 + k * 1.6); rippleMat.opacity = (1 - k) * 0.8; } else rippleMat.opacity = 0;
      },
    };
  })();

  /* Coffee Memory is all in coffee.js (its rules and its 3D cafe), which puts itself in G.ext. A phone can briefly hold an old copy of the
     page that does not ask for that file, or an old copy of the file itself; either way the new one is fetched here. */
  if (!(PN.Coffee && PN.Coffee.V >= 4)) { const sc = document.createElement('script'); sc.src = 'js/coffee.js?v=4'; document.head.appendChild(sc); }

  G.ext.swim = swim; G.ext.stack = stack; G.ext.puff = puff; G.ext.piano = piano; G.ext.type = typer; G.ext.toss = toss; G.ext.curl = curl; G.ext.sled = sled; G.ext.bj = bj; G.ext.sauna = sauna;
})(window.PN = window.PN || {});

/* Seal Seat Shuffle: a roofless Three.js bus, viewed from above. */
(function (PN) {
  'use strict';
  const T = THREE, U = PN.U, W = PN.World, K = PN.Games.kit, tr = PN.L;
  const FIRST_ROWS = 8, ROW_PITCH = 1.15, ARRIVE = 0.24, REVEAL = 0.65, DEPART = 0.22, CRAWL = 0.80, CRAWL_START = 0.70;
  const tapPosition = new T.Vector3(), matrix = new T.Matrix4();
  const position = new T.Vector3(), scale = new T.Vector3(), rotation = new T.Quaternion();
  let view = null, bus, scenery, cushions, seatBacks, pickSeats, player, playerRig;
  let round = 0, total = 0, seats = [], phase = 'done', elapsed = 0, deadline = 0, best = 0, chosen = -1, hold = 0;
  /* Online race: both players ride the same bus (same seats, same passengers). Each taps a seat and tells the other which; if it is the same seat,
     whoever tapped first keeps it and the other is moved to the nearest free seat. pending is my pick for this bus until that is settled. */
  let pending = null, theirPicks = {}, chooseAt = 0, myRing = null, friendRing = null;
  let busWidth = 0, busExtra = 0, travel = 0, clock = 0, lastWidth = 0, lastHeight = 0, departFrom = 0;
  /* First-time tutorial: tutStep 1 is a bus that shows where to tap, 2 is a bus with no help, 0 is the real game. These two buses stand still, have no time limit and score nothing. */
  let tutStep = 0, guide = null;
  let materials, geometry, templates, wheels = [], batches = [];
  const ownedGeometries = new Set(), ownedMaterials = new Set();
  const color = new T.Color();

  const rowsFor = n => FIRST_ROWS + Math.floor((n - 1) / 4) * 2;
  function layout(n) {
    const side = Math.ceil(n / 4), rows = rowsFor(n), list = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < side * 2; c++) {
      const x = c + (c >= side ? 0.8 : 0);
      list.push({ x, y: r * ROW_PITCH, z: (r - (rows - 1) / 2) * ROW_PITCH + 0.3, occupied: false });
    }
    return list;
  }
  function evaluate(list) {
    const occupied = list.filter(s => s.occupied);
    let best = 0;
    list.forEach(s => {
      let nearest = s.occupied ? 0 : Infinity;
      if (!s.occupied) occupied.forEach(p => {
        const squared = (s.x - p.x) ** 2 + (s.y - p.y) ** 2;
        if (squared < nearest) nearest = squared;
      });
      s.distance = Math.sqrt(nearest); best = Math.max(best, s.distance);
    });
    return best;
  }
  /* Uniform passenger scatter favours corners: they have fewer neighbours.
     Vary the region of the open gap instead, then verify the real distances.
     The selected region never changes a seat's score or the heat map. */
  function populateSeats(list, round, random) {
    random = random || Math.random;
    const columns = Math.ceil(round / 4) * 2, rows = list.length / columns;
    const category = i => {
      const row = Math.floor(i / columns), column = i % columns;
      const end = row === 0 || row === rows - 1, side = column === 0 || column === columns - 1;
      return end && side ? 'corner' : end || side ? 'edge' : 'interior';
    };
    const roll = random();
    const region = roll < 0.12 ? 'corner' : columns > 2 ? (roll < 0.55 ? 'edge' : 'interior') : 'edge';
    const targets = list.map((s, i) => i).filter(i => category(i) === region);
    const target = list[targets[Math.floor(random() * targets.length)]];
    let fallback = null, fallbackScore = -1;
    for (let attempt = 0; attempt < 18; attempt++) {
      list.forEach(s => { s.occupied = false; });
      const radius = 1.1 + random() * 1.4;
      const pool = list.filter(s => (s.x - target.x) ** 2 + (s.y - target.y) ** 2 > radius * radius);
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      const count = Math.min(pool.length, Math.max(2, Math.round(list.length * (0.16 + random() * 0.12))));
      pool.slice(0, count).forEach(s => { s.occupied = true; });
      for (let correction = 0; correction < 8; correction++) {
        const best = evaluate(list);
        const winners = list.map((s, i) => !s.occupied && Math.abs(s.distance - best) < 1e-7 ? i : -1).filter(i => i >= 0);
        if (winners.every(i => category(i) === region)) return;
        // Fill competing gaps outside the intended region with real passengers.
        const competing = winners.filter(i => category(i) !== region && list[i] !== target);
        if (!competing.length) break;
        list[competing[Math.floor(random() * competing.length)]].occupied = true;
        if (list.filter(s => s.occupied).length >= Math.ceil(list.length * 0.40)) break;
      }
      const best = evaluate(list);
      const winners = list.map((s, i) => !s.occupied && Math.abs(s.distance - best) < 1e-7 ? i : -1).filter(i => i >= 0);
      const score = winners.filter(i => category(i) === region).length / winners.length;
      if (score > fallbackScore) { fallbackScore = score; fallback = list.map(s => s.occupied); }
    }
    // A bounded fallback keeps generation quick on phones, even with unusual RNG.
    list.forEach((s, i) => { s.occupied = fallback[i]; });
  }
  function mat(hex, extra) {
    const m = new T.MeshStandardMaterial(Object.assign({ color: hex, roughness: 0.76 }, extra));
    ownedMaterials.add(m); return m;
  }
  function geo(g) { ownedGeometries.add(g); return g; }
  function roundedBox() {
    const g = new T.BoxGeometry(1, 1, 1, 6, 6, 6), p = g.attributes.position;
    const inner = new T.Vector3(), v = new T.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      inner.set(U.clamp(v.x, -0.40, 0.40), U.clamp(v.y, -0.40, 0.40), U.clamp(v.z, -0.40, 0.40));
      v.sub(inner).normalize().multiplyScalar(0.10).add(inner);
      p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals(); return geo(g);
  }
  function box(parent, m, w, h, d, x, y, z) {
    const mesh = new T.Mesh(geometry.round, m);
    mesh.scale.set(w, h, d); mesh.position.set(x, y, z); parent.add(mesh); return mesh;
  }
  function ball(parent, m, x, y, z, sx, sy, sz) {
    const mesh = new T.Mesh(geometry.ball, m);
    mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); parent.add(mesh); return mesh;
  }
  function transform(x, y, z, sx, sy, sz) {
    position.set(x, y, z); scale.set(sx, sy, sz);
    return matrix.compose(position, rotation, scale);
  }
  function instanced(parent, g, m, transforms) {
    const mesh = new T.InstancedMesh(g, m, transforms.length);
    transforms.forEach((v, i) => mesh.setMatrixAt(i, v));
    mesh.instanceMatrix.needsUpdate = true;
    // Buses move beyond their resting bounds during the short transitions.
    mesh.frustumCulled = false;
    parent.add(mesh); batches.push(mesh); return mesh;
  }

  /* Use the game's actual seal models for passengers too. Freeze three coats
     into instanced batches so a wide bus does not need dozens of live rigs. */
  function makeTemplate(stage) {
    const seal = new PN.Seal({ stage });
    seal.freeY = true; seal.shadow.visible = false; seal.heading = Math.PI;
    seal.g.rotation.y = Math.PI; seal.g.scale.setScalar(0.29);
    seal.update(0, 0, null); seal.g.updateMatrixWorld(true);
    const bounds = new T.Box3(), center = new T.Vector3();
    seal.g.traverseVisible(m => {
      if (!m.isMesh || m.material.opacity === 0) return;
      if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
      bounds.union(m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld));
    });
    bounds.getCenter(center);
    const parts = [];
    seal.g.traverseVisible(m => {
      if (!m.isMesh || m.material.opacity === 0) return;
      const local = m.matrixWorld.clone(); local.elements[12] -= center.x; local.elements[14] -= center.z;
      parts.push({ geometry: m.geometry, material: m.material, matrix: local });
    });
    return { seal, parts };
  }
  function passengers(places) {
    const groups = new Map(), translation = new T.Matrix4();
    places.forEach((p, i) => {
      const template = templates[p.coat == null ? i % templates.length : p.coat];
      translation.makeTranslation(p.x, 0.94, p.z);
      template.parts.forEach(part => {
        const key = part.geometry.uuid + '/' + part.material.uuid;
        if (!groups.has(key)) groups.set(key, { part, transforms: [] });
        groups.get(key).transforms.push(new T.Matrix4().multiplyMatrices(translation, part.matrix));
      });
    });
    groups.forEach(({ part, transforms }) => instanced(bus, part.geometry, part.material, transforms));
  }
  // The same uncoloured upholstery takes the blue seat dye and each heat-map colour.
  let upholstery, stopEnamel, streetMap, chassisShade;
  function seatCloth() {
    return U.tex(128, 128, (c, w, h) => {
      c.fillStyle = '#fafafa'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#dfdfdf'; c.lineWidth = 2; c.strokeRect(9, 9, w - 18, h - 18);
      c.strokeStyle = '#eeeeee'; c.lineWidth = 3;
      for (let x = 19; x < w - 18; x += 18) {
        c.beginPath(); c.moveTo(x, 24); c.lineTo(x + 6, 19); c.lineTo(x + 12, 24); c.stroke();
      }
    });
  }
  function stopSign() {
    return U.tex(96, 112, (c, w, h) => {
      c.fillStyle = '#f6d481'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#305674'; c.fillRect(10, 10, w - 20, h - 20);
      c.fillStyle = '#fff2c9'; c.fillRect(24, 30, 48, 46);
      c.fillRect(29, 74, 8, 9); c.fillRect(59, 74, 8, 9);
      c.fillStyle = '#456b84'; c.fillRect(29, 35, 38, 19);
      c.fillRect(30, 64, 6, 5); c.fillRect(60, 64, 6, 5);
    });
  }
  function build() {
    const scene = new T.Scene(); scene.background = new T.Color(0xcbdfe5);
    scene.add(new T.HemisphereLight(0xfffaf0, 0x718d9b, 2.0));
    const sun = new T.DirectionalLight(0xffffff, 1.7); sun.position.set(-5, 14, -8); scene.add(sun);
    const camera = new T.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 500);
    camera.up.set(0, 1, 0);
    view = { scene, camera };
    geometry = {
      round: roundedBox(), ball: geo(new T.SphereGeometry(1, 16, 12)),
      tire: geo(new T.CylinderGeometry(0.60, 0.60, 0.28, 20)),
      hub: geo(new T.CylinderGeometry(0.24, 0.24, 0.30, 16)),
      shade: geo(new T.PlaneGeometry(1, 1)),
      hit: geo(new T.BoxGeometry(0.96, 0.10, 1.10)),
      marker: geo(new T.TorusGeometry(0.38, 0.035, 8, 28)),
      arrow: geo(new T.ConeGeometry(0.30, 0.55, 16)),
    };
    if (!streetMap) {
      streetMap = U.tex(256, 256, (c, w, h) => {
        const tint = c.createLinearGradient(0, 0, w, 0);
        [[0, '#b8cad1'], [.07, '#98acb7'], [.22, '#869aa8'], [.28, '#7c919f'], [.38, '#8da1ad'],
          [.62, '#8da1ad'], [.72, '#7c919f'], [.78, '#869aa8'], [.93, '#98acb7'], [1, '#b8cad1']].forEach(([at, col]) => tint.addColorStop(at, col));
        c.fillStyle = tint; c.fillRect(0, 0, w, h);
        const r = U.rng(49); c.fillStyle = 'rgba(223,236,240,.12)';
        for (let i = 0; i < 160; i++) c.fillRect(r() * w, r() * h, 0.8 + r() * 1.5, 1 + r() * 6);
      });
      streetMap.wrapT = T.RepeatWrapping; streetMap.repeat.y = 22;
      chassisShade = U.tex(64, 64, (c) => {
        const shade = c.createRadialGradient(32, 32, 10, 32, 32, 32);
        shade.addColorStop(0, 'rgba(34,52,64,.38)'); shade.addColorStop(.65, 'rgba(34,52,64,.24)'); shade.addColorStop(1, 'rgba(34,52,64,0)');
        c.fillStyle = shade; c.fillRect(0, 0, 64, 64);
      });
    }
    if (!upholstery) upholstery = seatCloth();
    if (!stopEnamel) stopEnamel = stopSign();
    materials = {
      sign: mat(0xffffff, { map: stopEnamel }),
      shade: mat(0xffffff, { map: chassisShade, transparent: true, depthWrite: false }), runner: mat(0x607f87),
      paint: mat(0xf3bc42), trim: mat(0x28568a), cream: mat(0xf4eee0), floor: mat(0xe9d7b5),
      seat: mat(0x6b9bdd), cushion: mat(0xffffff, { map: upholstery }), frame: mat(0x315584), tire: mat(0x334453), hub: mat(0xb6cbd0),
      glass: mat(0xa8def1, { roughness: 0.18, transparent: true, opacity: 0.20, depthWrite: false }), light: mat(0xffe4a2, { emissive: 0xffd388, emissiveIntensity: 0.35 }),
      red: mat(0xdc807b), road: mat(0xffffff, { map: streetMap }), line: mat(0xeaf1e8), snow: mat(0xe6f1ed),
      green: mat(0x62a984), gold: mat(0xffd36b, { emissive: 0xffcc54, emissiveIntensity: 0.4 }),
      mint: mat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.25 }), blue: mat(0x3975a1),
    };
    if (!templates) templates = [0, 1, 2].map(makeTemplate);
    if (!player) {
      player = new PN.Seal({ stage: PN.Game.state.stage }); player.freeY = true; player.shadow.visible = false;
      playerRig = new T.Group(); playerRig.add(player.g);
    }
    playerRig.visible = false;
  }
  function clearBus() {
    if (bus) view.scene.remove(bus);
    if (scenery) view.scene.remove(scenery);
    if (playerRig.parent) playerRig.parent.remove(playerRig);
    batches.forEach(mesh => mesh.dispose()); batches = []; wheels = []; guide = null;
  }
  function makeBus() {
    clearBus();
    bus = new T.Group(); scenery = new T.Group(); view.scene.add(scenery, bus);
    const center = (seats[0].x + seats[seats.length - 1].x) / 2;
    busWidth = Math.ceil(round / 4) * 2 + 1.15;
    const half = busWidth / 2, rows = rowsFor(round);
    busExtra = (rows - FIRST_ROWS) * ROW_PITCH;
    const front = z => z - busExtra / 2, rear = z => z + busExtra / 2;
    // A quiet snowy street. All surfaces, kerbs and lane marks are meshes.
    box(scenery, materials.snow, 130, 0.16, 160, 0, -0.71, 0);
    box(scenery, materials.road, busWidth + 3.3, 0.08, 150, 0, -0.57, 0);
    [-1, 1].forEach(sign => {
      const x = sign * (half + 1.8);
      box(scenery, materials.cream, 0.23, 0.18, 150, x, -0.50, 0);
      for (let z = -25; z <= 25; z += 3.2) box(scenery, materials.line, 0.07, 0.015, 1.35, sign * (half + 1.1), -0.515, z);
      for (let i = 0; i < 5; i++) {
        ball(scenery, materials.snow, sign * (half + 2.4 + i % 2), -0.50, -10 + i * 5, 0.8, 0.20, 1.4);
        const bushX = sign * (half + 3.3 + 0.25 * (i % 2)), bushZ = -11 + i * 5;
        ball(scenery, materials.green, bushX, -0.30, bushZ, 0.65, 0.5, 0.65);
        ball(scenery, materials.snow, bushX - 0.05, -0.07, bushZ + 0.04, 0.59, 0.34, 0.61);
      }
    });
    // A ploughed verge and a small enamel stop marker alongside the passenger side.
    const verge = half + 2.28;
    box(scenery, materials.snow, 0.92, 0.17, 150, verge, -0.49, 0);
    box(scenery, materials.frame, 0.09, 1.95, 0.09, verge, 0.49, 5.8);
    const sign = box(scenery, materials.sign, 0.73, 0.86, 0.08, verge, 1.35, 5.8);
    sign.rotation.y = Math.PI - 0.22;
    box(scenery, materials.snow, 0.78, 0.08, 0.12, verge, 1.79, 5.8).rotation.y = sign.rotation.y;
    const shade = new T.Mesh(geometry.shade, materials.shade);
    shade.rotation.x = -Math.PI / 2; shade.position.set(0.09, -0.51, 0.12);
    shade.scale.set(busWidth * 1.48, (11.8 + busExtra) * 1.22, 1); bus.add(shade);
    // Chassis, exposed floor, low cutaway walls and separate window panels.
    box(bus, materials.trim, busWidth, 0.95, 11.8 + busExtra, 0, 0.12, -0.1);
    box(bus, materials.floor, busWidth - 0.25, 0.14, 11.25 + busExtra, 0, 0.68, 0.02);
    // Rubber aisle runner with a warm binding, visible between the seat pairs.
    box(bus, materials.runner, 0.53, 0.015, 10.98 + busExtra, 0, 0.762, 0);
    [-1, 1].forEach(sign => {
      box(bus, materials.cream, 0.027, 0.015, 10.98 + busExtra, sign * 0.237, 0.773, 0);
      const x = sign * (half - 0.10);
      box(bus, materials.paint, 0.18, 0.53, 10.9 + busExtra, x, 0.86, -0.05);
      box(bus, materials.cream, 0.20, 0.10, 10.9 + busExtra, x, 1.14, -0.05);
      for (let i = 0; i < rows; i++) box(bus, materials.glass, 0.10, 0.25, 0.89, x, 1.31, seats[i * Math.ceil(round / 4) * 2].z);
      box(bus, materials.cream, 0.035, 0.065, 10.68 + busExtra, sign * (half - 0.005), 0.73, -0.05);
      // Mirror stalks are outside the cabin, away from the selectable seats.
      box(bus, materials.trim, 0.56, 0.08, 0.10, sign * (half + 0.15), 1.16, front(-5.12));
      box(bus, materials.glass, 0.20, 0.30, 0.14, sign * (half + 0.40), 1.19, front(-5.12));
      [front(-3.7), rear(3.9)].forEach(z => {
        const wheel = new T.Group(); wheel.position.set(sign * (half - 0.03), 0.05, z);
        const tire = new T.Mesh(geometry.tire, materials.tire), hub = new T.Mesh(geometry.hub, materials.hub);
        tire.rotation.z = hub.rotation.z = Math.PI / 2;
        wheel.add(tire, hub); bus.add(wheel); wheels.push(wheel);
      });
    });
    box(bus, materials.paint, busWidth, 1.18, 0.45, 0, 0.58, front(-5.63));
    // Open windscreen: the driver is visible above the taller front panel.
    [-1, 1].forEach(sign => box(bus, materials.cream, 0.10, 0.60, 0.12, sign * (half - 0.20), 1.47, front(-5.34)));
    box(bus, materials.paint, busWidth - 0.12, 0.08, 0.12, 0, 1.80, front(-5.34));
    box(bus, materials.cream, busWidth - 0.35, 0.10, 0.06, 0, 0.42, front(-5.88));
    box(bus, materials.trim, busWidth + 0.08, 0.17, 0.26, 0, 0.48, front(-5.91));
    box(bus, materials.paint, busWidth, 0.60, 0.27, 0, 0.93, rear(5.52));
    box(bus, materials.cream, busWidth, 0.08, 0.29, 0, 1.26, rear(5.52));
    box(bus, materials.trim, busWidth + 0.06, 0.16, 0.24, 0, 0.48, rear(5.72));
    [-1, 1].forEach(sign => {
      box(bus, materials.light, 0.36, 0.22, 0.10, sign * (half - 0.40), 0.85, front(-5.88));
      box(bus, materials.red, 0.20, 0.22, 0.08, sign * (half - 0.25), 0.95, rear(5.68));
    });
    // A little Finnish flag on the nose, constructed from solid geometry.
    box(bus, materials.cream, 0.65, 0.04, 0.38, 0, 1.19, front(-5.65));
    box(bus, materials.blue, 0.12, 0.015, 0.38, -0.1, 1.218, front(-5.65));
    box(bus, materials.blue, 0.65, 0.015, 0.10, 0, 1.22, front(-5.65));
    // Driver's cabin and steering wheel remain clear of the growing passenger cabin.
    const driverX = -half + 0.70;
    box(bus, materials.frame, 0.67, 0.15, 0.70, driverX, 0.83, front(-4.94));
    const steering = new T.Mesh(geometry.marker, materials.frame);
    steering.position.set(driverX, 1.14, front(-5.38)); steering.rotation.x = -Math.PI * 0.30; steering.scale.setScalar(0.50); bus.add(steering);
    box(bus, materials.cream, 0.70, 0.035, 0.64, half - 0.65, 0.77, front(-4.93));
    const cushionMatrices = [], backs = [], legs = [], hits = [];
    seats.forEach(s => {
      s.worldX = s.x - center;
      cushionMatrices.push(transform(s.worldX, 0.83, s.z, 0.84, 0.18, 0.93).clone());
      backs.push(transform(s.worldX, 1.06, s.z + 0.44, 0.85, 0.53, 0.14).clone());
      legs.push(transform(s.worldX, 0.74, s.z, 0.13, 0.24, 0.60).clone());
      hits.push(transform(s.worldX, 0.97, s.z, 1, 1, 1).clone());
    });
    cushions = instanced(bus, geometry.round, materials.cushion, cushionMatrices);
    seatBacks = instanced(bus, geometry.round, materials.cushion, backs);
    instanced(bus, geometry.round, materials.frame, legs);
    pickSeats = instanced(bus, geometry.hit, materials.seat, hits);
    pickSeats.visible = false; // Raycaster still tests the explicit hit mesh; it is never rendered.
    passengers(seats.filter(s => s.occupied).map(s => ({ x: s.worldX, z: s.z })).concat([{ x: driverX, z: front(-4.94), coat: 1 }]));
    bus.add(playerRig); playerRig.visible = false;
    cushions.name = 'shuffle-seat-cushions';
    paintSeats(); fitCamera();
    travel = Math.max(60, view.camera.position.length() * 3);
    bus.position.z = travel; bus.updateMatrixWorld(true);
  }
  function fitCamera() {
    const camera = view.camera, w = window.innerWidth, h = window.innerHeight;
    lastWidth = w; lastHeight = h;
    const header = document.querySelector('.g-top').getBoundingClientRect();
    const hint = document.getElementById('gHint').getBoundingClientRect();
    const top = Math.max(70, header.bottom + 16), bottom = Math.min(h - 65, hint.top - 15);
    camera.aspect = w / h;
    // Frame the bus between the HUD and hint without flattening its depth.
    const centerNdc = 1 - (top + bottom) / h;
    camera.setViewOffset(w, h, 0, -centerNdc * h / 2, w, h);
    const corners = [], p = new T.Vector3(), elevation = 35 * Math.PI / 180;
    for (const x of [-busWidth / 2 - 0.55, busWidth / 2 + 0.55])
      for (const y of [-0.65, 2.0]) for (const z of [-6.05 - busExtra / 2 - CRAWL_START, 5.9 + busExtra / 2 + CRAWL_START]) corners.push(new T.Vector3(x, y, z));
    let distance = 18;
    for (let i = 0; i < 65; i++) {
      camera.position.set(0, 0.65 + Math.sin(elevation) * distance, -Math.cos(elevation) * distance);
      camera.lookAt(0, 0.65, 0); camera.updateMatrixWorld(true);
      if (corners.every(c => {
        p.copy(c).project(camera);
        const px = (p.x * 0.5 + 0.5) * w, py = (-p.y * 0.5 + 0.5) * h;
        return px >= 16 && px <= w - 16 && py >= top && py <= bottom;
      })) break;
      distance *= 1.045;
    }
  }
  function paintSeats() {
    const revealing = phase === 'reveal' || phase === 'depart' || phase === 'done';
    const empty = seats.filter(s => !s.occupied), worst = Math.min(...empty.map(s => s.distance));
    seats.forEach((s, i) => {
      if (revealing && !s.occupied) {
        const quality = best - worst < 1e-7 ? 1 : (s.distance - worst) / (best - worst);
        color.setHSL(quality / 3, 0.82, 0.48);
      } else if (revealing) color.setHSL(0, 0.82, 0.48);   // a seat with a seal on it is as bad as a seat can be: red
      else color.setHex(s.occupied ? 0x507bb5 : 0x6b9bdd);
      cushions.setColorAt(i, color); seatBacks.setColorAt(i, color);
    });
    cushions.instanceColor.needsUpdate = seatBacks.instanceColor.needsUpdate = true;
  }
  /* The bottom hint turns into a card while the tutorial runs; it keeps one height so the bus is framed the same on both tutorial buses. */
  function say(lines, button) {
    const el = document.getElementById('gHint');
    if (!lines) { el.classList.remove('tut'); el.textContent = ''; return; }
    el.classList.add('tut'); el.textContent = '';
    [].concat(lines).forEach(line => { const d = document.createElement('div'); d.textContent = tr(line); el.appendChild(d); });
    if (button) {   // tapping anywhere moves on too (see pointer)
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'btn small'; b.textContent = tr('Tap anywhere to continue');
      b.addEventListener('click', () => { PN.Audio.play('tap'); advance(); });
      el.appendChild(b);
    }
  }
  function advance() {
    if (!tutStep || phase !== 'reveal') return;
    if (++tutStep > 2) { tutStep = 0; PN.Games.tutorial.mark('shuffle'); round = 0; say(null); }
    phase = 'depart'; departFrom = bus.position.z; elapsed = 0;
  }
  function addGuide() {
    guide = new T.Group();
    seats.forEach(s => {
      if (s.occupied || s.distance < best - 1e-7) return;
      const ring = new T.Mesh(geometry.marker, materials.gold), arrow = new T.Mesh(geometry.arrow, materials.gold);
      ring.rotation.x = -Math.PI / 2; ring.position.set(s.worldX, 1.0, s.z); ring.scale.set(1.2, 1.3, 1);
      arrow.rotation.x = Math.PI; arrow.position.set(s.worldX, 2.0, s.z); arrow.userData.base = 2.0;
      guide.add(ring, arrow);
    });
    bus.add(guide);
  }
  function next() {
    round = tutStep ? 1 : round + 1; seats = layout(round);
    PN.Games.reseed(round); pending = null; myRing = friendRing = null;
    populateSeats(seats, round, PN.Games.seeded() ? PN.Games.rnd : undefined);
    best = evaluate(seats); chosen = -1; phase = 'arrive'; elapsed = 0;
    if (tutStep === 1) say('Tap the seat furthest from any other seal. Try the one with the arrow!');
    else if (tutStep === 2) say('Your turn! Tap the seat furthest from the seals.');
    else { say(null); K.hint(tr('Bus {0} / {1} · Find your personal space', round, 20)); }
    makeBus();
    if (tutStep === 1) addGuide();
  }
  function seatPlayer(s) {
    playerRig.visible = true; playerRig.position.set(s.worldX, 0.92, s.z); playerRig.scale.setScalar(1);
    player.heading = Math.PI; player.g.rotation.y = Math.PI; player.g.position.set(0, 0, 0);
    player.gesture('nod', true); player.update(0, clock, null); playerRig.updateMatrixWorld(true);
    // Measure the complete dressed seal in its holder's space, independent of
    // the bus's position and of the miniature scale used in a previous round.
    const bounds = new T.Box3(), inverse = playerRig.matrixWorld.clone().invert();
    player.g.traverseVisible(m => {
      if (!m.isMesh || m.material.opacity === 0) return;
      if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
      bounds.union(m.geometry.boundingBox.clone().applyMatrix4(new T.Matrix4().multiplyMatrices(inverse, m.matrixWorld)));
    });
    const size = bounds.getSize(new T.Vector3()), center = bounds.getCenter(new T.Vector3());
    const k = Math.min(0.82 / size.x, 0.95 / size.z, 0.90 / size.y);
    player.g.position.set(-center.x, -bounds.min.y, -center.z); playerRig.scale.setScalar(k);
    const ring = new T.Mesh(geometry.marker, materials.mint);
    ring.rotation.x = -Math.PI / 2; ring.position.set(s.worldX, 0.94, s.z); ring.scale.set(1.04, 1.14, 1); bus.add(ring);
    if (myRing) bus.remove(myRing);
    myRing = ring;
  }
  /* The other player's seat, shown once I have chosen: a gold ring and an arrow. */
  function showFriendSeat(i) {
    if (!bus || i < 0 || !seats[i]) return;
    if (friendRing) bus.remove(friendRing);
    const s = seats[i], ring = new T.Mesh(geometry.marker, materials.gold), arrow = new T.Mesh(geometry.arrow, materials.gold), grp = new T.Group();
    ring.rotation.x = -Math.PI / 2; ring.position.set(s.worldX, 1.0, s.z); ring.scale.set(1.2, 1.3, 1);
    arrow.rotation.x = Math.PI; arrow.position.set(s.worldX, 1.9, s.z);
    grp.add(ring, arrow); bus.add(grp); friendRing = grp;
  }
  const pointsOf = (i) => {
    const free = seats.filter((s) => !s.occupied), worst = Math.min(...free.map((s) => s.distance));
    return i < 0 ? 0 : best > worst ? Math.max(0, Math.min(100, Math.round(100 * (seats[i].distance - worst) / (best - worst)))) : 100;
  };
  const nearestFree = (from, taken) => {
    let pick = -1, d = Infinity;
    seats.forEach((st, i) => {
      if (st.occupied || taken.indexOf(i) >= 0) return;
      const q = (st.x - seats[from].x) ** 2 + (st.y - seats[from].y) ** 2;
      if (q < d - 1e-9) { d = q; pick = i; }
    });
    return pick;
  };
  /* Work out who gets which seat now that both picks are known (or the other player's never came), then score mine. */
  function settle(force) {
    if (!pending || pending.done) return;
    const theirs = theirPicks[pending.round], net = PN.Games.net;
    if (!theirs && !force) return;
    pending.done = true;
    const mine = pending.i, t = theirs ? theirs.s : -1;
    let myFinal = mine, theirFinal = t, lost = false;
    if (mine >= 0 && t === mine) {
      const iWin = pending.t < theirs.t || (pending.t === theirs.t && net && net.tie());
      if (iWin) theirFinal = nearestFree(t, [mine]); else { myFinal = nearestFree(mine, [t]); lost = true; }
    }
    pending.final = myFinal; pending.theirsFinal = theirFinal; pending.theirsKnown = !!theirs;
    const points = pointsOf(myFinal);
    total += points; K.score(total);
    chosen = myFinal;
    if (myFinal !== mine && myFinal >= 0) seatPlayer(seats[myFinal]);
    if (theirFinal >= 0) showFriendSeat(theirFinal);
    paintSeats();
    if (lost) { K.big(tr('Taken!'), 1.1, 'too-slow'); K.hint(tr('They got there first. You moved to the next seat · +{0} points', points)); }
    else if (mine >= 0) K.hint(tr('+{0} points · Green = best · Red = worst', points));
  }
  function choose(i) {
    if (phase !== 'choose') return;
    if (performance.now() >= deadline) i = -1;
    if (i >= 0 && seats[i].occupied) return;
    if (tutStep === 1 && i >= 0 && seats[i].distance < best - 1e-7) return;   // the first bus only takes the best seat
    chosen = i;
    if (PN.Games.seeded()) {                                                    // an online race: the points wait for the other player's pick
      pending = { round, i, t: Math.round(performance.now() - chooseAt) };
      if (PN.Games.net) PN.Games.net.send('seat', { r: round, s: i, t: pending.t });
      hold = i < 0 ? 0.55 : Math.max(0, (deadline - performance.now()) / 1000);
      phase = 'reveal'; elapsed = 0;
      if (i >= 0) seatPlayer(seats[i]);
      paintSeats();
      if (i < 0) { K.big(tr('Too slow!'), 1.3, 'too-slow'); K.hint(tr('You missed the bus! · 0 points')); }
      PN.Audio.play(i < 0 ? 'tick' : 'tap');
      settle(i < 0);                                                    // settles at once if their pick is already here (or mine is a miss)
      return;
    }
    // Points run from the worst free seat (0) to the best (100). Measured from nothing, a seat tapped without looking still scored about 56.
    const free = seats.filter((s) => !s.occupied), worst = Math.min(...free.map((s) => s.distance));
    const points = i < 0 ? 0 : best > worst ? Math.max(0, Math.min(100, Math.round(100 * (seats[i].distance - worst) / (best - worst)))) : 100;
    hold = tutStep ? Infinity : i < 0 ? 0.55 : Math.max(0, (deadline - performance.now()) / 1000);   // the bus waits out its time anyway, so tapping fast does not make the game shorter; a missed bus lingers a beat so the message can be read
    if (!tutStep) { total += points; K.score(total); }
    phase = 'reveal'; elapsed = 0;
    if (guide) guide.visible = false;
    if (i >= 0) seatPlayer(seats[i]);
    paintSeats();
    if (tutStep === 1) say('The further from other seals, the more points. Green seats score most, red seats least.', true);
    else if (tutStep === 2) say([points === 100 ? 'Perfect pick! That was the best seat.' : 'Good try! The green seats would have scored even more.', "That's the tutorial done. From now on the bus won't wait, so be quick!"], true);
    else {
      if (i < 0) K.big(tr('Too slow!'), 1.3, 'too-slow');
      K.hint(i < 0 ? tr('You missed the bus! · 0 points') : tr('+{0} points · Green = best · Red = worst', points));
    }
    PN.Audio.play(i < 0 ? 'tick' : points === 100 ? 'sparkle' : 'tap');
  }
  PN.Games.ext.shuffle = {
    label: 'Points', hint: 'Choose the seat furthest from its nearest seal.', nocount: true,
    view: () => view,
    start() {
      build();
      const st = PN.Game.state;
      player.setStage(st.stage); player.grow = PN.Game.seal.grow; player.applyScale();
      ['head', 'neck', 'face', 'back'].forEach(slot => player.setWear(slot, st.wearing[slot]));
      round = 0; total = 0; clock = 0; theirPicks = {}; pending = null; tutStep = (PN.Games.seeded() || PN.Games.tutorial.seen('shuffle')) ? 0 : 1; next();
    },
    go() { K.score(0, true); },
    remote(m) {                                      // the other player's pick for a bus, from the online race
      if (m.kind !== 'seat' || typeof m.r !== 'number') return;
      theirPicks[m.r] = { s: m.s | 0, t: m.t | 0 };
      if (pending && pending.round === m.r) {
        if (!pending.done) settle(false);
        else if (!pending.theirsKnown) {            // late: my seat stands, and I can still see where they sat
          const t = m.s | 0; pending.theirsKnown = true;
          if (t >= 0 && t !== pending.final) showFriendSeat(t);
          else if (t >= 0) showFriendSeat(nearestFree(t, [pending.final]));
        }
      }
    },
    pointer(type, x, y) {
      if (type === 'down' && tutStep && phase === 'reveal' && elapsed > 0.45) { PN.Audio.play('tap'); advance(); return; }
      if (type !== 'down' || phase !== 'choose') return;
      if (performance.now() >= deadline) { choose(-1); return; }
      const rect = W.renderer.domElement.getBoundingClientRect();
      view.camera.updateMatrixWorld(true); bus.updateMatrixWorld(true);
      let nearest = -1, shortest = Infinity;
      seats.forEach((seat, i) => {
        if (seat.occupied) return;
        // Compare on-screen centres so perspective and the moving bus cannot
        // make a near miss disappear into the aisle, a seat back or the road.
        tapPosition.set(seat.worldX, 0.97, seat.z);
        bus.localToWorld(tapPosition); tapPosition.project(view.camera);
        const dx = rect.left + (tapPosition.x * 0.5 + 0.5) * rect.width - x;
        const dy = rect.top + (-tapPosition.y * 0.5 + 0.5) * rect.height - y;
        const distance = dx * dx + dy * dy;
        if (distance < shortest) { shortest = distance; nearest = i; }
      });
      if (nearest >= 0) choose(nearest);
    },
    update(dt, playing) {
      if (!view) return;
      if (lastWidth !== window.innerWidth || lastHeight !== window.innerHeight) fitCamera();
      clock += dt;
      if (!playing) return;
      elapsed += dt;
      if (phase === 'arrive') {
        const t = Math.min(elapsed, ARRIVE), u = t / ARRIVE;
        // Ease from a fast arrival to the same nonzero speed as the crawl.
        bus.position.z = CRAWL_START + CRAWL * (ARRIVE - t)
          + (travel - CRAWL_START - CRAWL * ARRIVE) * Math.pow(1 - u, 3);
        if (elapsed >= ARRIVE) { phase = 'choose'; chooseAt = performance.now(); deadline = tutStep ? Infinity : chooseAt + 1100; elapsed = 0; }
      } else if (phase === 'choose') {
        if (!tutStep) bus.position.z -= CRAWL * dt;   // the tutorial buses wait where they stopped
        if (performance.now() >= deadline) choose(-1);
      } else if (phase === 'reveal') {
        if (!tutStep) bus.position.z -= CRAWL * dt;
        if (elapsed >= REVEAL + hold) { if (PN.Games.seeded()) settle(true); phase = 'depart'; departFrom = bus.position.z; elapsed = 0; }
      } else if (phase === 'depart') {
        const t = Math.min(elapsed, DEPART);
        // Accelerate out of the crawl without a position or speed jump.
        bus.position.z = departFrom - CRAWL * t - travel * Math.pow(t / DEPART, 3);
        if (elapsed >= DEPART) {
          if (round === 20) { phase = 'done'; K.over(total + ' / 2,000'); K.hint(tr('Twenty buses · A little space to yourself')); }
          else next();
        }
      }
      if (guide && guide.visible) guide.children.forEach(m => {
        if (m.userData.base) m.position.y = m.userData.base + Math.abs(Math.sin(clock * 4)) * 0.35;
        else m.scale.set(1.2 + Math.sin(clock * 5) * 0.12, 1.3 + Math.sin(clock * 5) * 0.12, 1);
      });
      wheels.forEach(wheel => { wheel.rotation.x = bus.position.z / 0.60; });
      if (playerRig.visible) player.update(dt, clock, null);
    },
    stop() {
      clearBus();
      ownedGeometries.forEach(g => g.dispose()); ownedMaterials.forEach(m => m.dispose());
      ownedGeometries.clear(); ownedMaterials.clear();
      // Native seal geometry/materials are shared with the home scene. Keep
      // these four rigs for replay, as the other arcade games do with their actor.
      view = null; bus = scenery = cushions = pickSeats = null; seats = []; phase = 'done'; tutStep = 0; say(null);
    },
    layout, evaluate, populateSeats,
    peek: () => ({ round, rows: rowsFor(round), total, phase, best, chosen, seats: seats.map(s => ({ x: s.worldX, y: 0.97, z: s.z + (bus ? bus.position.z : 0), occupied: s.occupied, distance: s.distance })) }),
  };
})(window.PN);

