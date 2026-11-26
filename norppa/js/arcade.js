/* Pikku Norppa: the arcade. Nine mini-games, each on a little stage of its own.
   Swimmy Seal: tap to swim up, slip between the ice and the kelp. Three goes, the average counts.
   Snowball Toss: flick the snowball into a bucket, Paper Toss style. Mind the wind.
   Curling Seal: slide across the ice and stop on the rings.
   Sled Run: steer down the hill between the trees.
   Blackjack: beat the dealer for tokens. Löyly: keep the sauna heat just right.
   Ice Stack: set sliding floes down on a tower; the overhang breaks off.
   Puffer Sweeper: minesweeper with pufferfish, one board against the clock.
   Ice Piano: piano tiles; tap the tiles of a tune in order as it speeds up.
   Each one plugs into games.js through Games.ext: { label, label2, hint, start, go, view, pointer, key, update }. */
(function (PN) {
  'use strict';
  const T = THREE, U = PN.U, W = PN.World, A = PN.Audio, tr = PN.L, G = PN.Games, K = G.kit;
  const PI = Math.PI;
  const rs = (k) => (Math.random() - 0.5) * 2 * k, rnd = Math.random;
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

    function frond(mat, ph) {
      const root = new T.Group(), joints = [];
      let cur = root;
      for (let i = 0; i < 12; i++) {
        const j = new T.Group();
        j.position.y = i ? 0.55 : 0;
        j.add(U.ball(0.3, mat, 0, 0.28, 0, 0.5, 1.05, 0.22, 10));
        cur.add(j); joints.push(j); cur = j;
      }
      return { root, joints, ph };
    }
    function build() {
      view = stage('#86d6e4', '#0a2a55', { ground: 0x5f9fd0, hemi: 2.1, key: 1.3 });
      const sc = view.scene;
      sc.fog = new T.Fog(0x1c5a8c, 9, 34);
      const iceM = U.mat(0xe8f6ff, { roughness: 0.35 }), sandM = U.mat(0x2a4f73, { roughness: 1 }), rockM = U.mat(0x3a6288, { roughness: 1 });
      sc.add(U.box(70, 12, 2.9, iceM, 0, CEIL + 6, -1), U.box(70, 12, 3.4, sandM, 0, FLOOR - 6, 0));
      for (let i = 0; i < 12; i++) {
        const bump = U.ball(1, iceM, 0, CEIL + 0.05, -0.6 + rs(0.4), 0.8 + rnd() * 0.9, 0.22 + rnd() * 0.25, 1.2, 12);
        const rock = U.ball(1, rockM, 0, FLOOR - 0.05, rs(0.8), 0.5 + rnd() * 0.8, 0.2 + rnd() * 0.3, 1, 10);
        bump.userData.x = i * 2.1 + rs(0.5); rock.userData.x = i * 2.1 + rs(0.8);
        sc.add(bump, rock); drift.push(bump, rock);
      }
      const rayM = new T.MeshBasicMaterial({ color: 0xc8f2ff, transparent: true, opacity: 0.075, blending: T.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false });
      for (let i = 0; i < 4; i++) {
        const r = new T.Mesh(new T.PlaneGeometry(1.1 + rnd() * 1.2, 15), rayM);
        r.position.set(-4 + i * 2.6, 0.5, -1.9); r.rotation.z = 0.3;
        r.userData.ph = rnd() * 6;
        sc.add(r); rays.push(r);
      }
      const iceCol = new T.MeshStandardMaterial({ color: 0xd4efff, roughness: 0.2, flatShading: true, emissive: 0x1d4468 });
      const iceGeo = new T.CylinderGeometry(0.62, 0.3, 9, 6), tipGeo = new T.ConeGeometry(0.3, 0.35, 6);
      const k1 = U.mat(0x2f9160, { roughness: 0.8 }), k2 = U.mat(0x44ab6e, { roughness: 0.8 });
      const fishLook = PN.items.muikku.look;
      for (let i = 0; i < N; i++) {
        const g = new T.Group();
        const ice = new T.Group();
        const tip = new T.Mesh(tipGeo, iceCol); tip.rotation.x = PI; tip.position.y = -0.17;
        ice.add(U.mesh(iceGeo, iceCol, 0, 4.5, 0), tip);
        ice.rotation.y = rnd() * 3;
        const kelp = new T.Group(), fronds = [];
        [[-0.27, -0.45, k1], [0.02, 0, k2], [0.29, -0.3, k1]].forEach((d) => {
          const f = frond(d[2], rnd() * 6);
          f.root.position.set(d[0], d[1] - 6.6, rs(0.15));
          kelp.add(f.root); fronds.push(f);
        });
        const fish = PN.Props.fish(fishLook);
        fish.scale.setScalar(0.32); fish.rotation.y = PI;
        g.add(ice, kelp, fish);
        sc.add(g);
        obs.push({ g, ice, kelp, fronds, fish, x: 0, top: 0, bot: 0, mid: 0, passed: false, hasFish: false });
      }
      bubbles = Puffs(sc, 40, 0xdff6ff, 0.55);
    }
    function place(o, x) {
      const gap = G.mumMode ? 3.2 : 2.45 - Math.min(0.55, score * 0.025);
      const mid = G.mumMode ? rs(0.7) : U.clamp(lastGapY + rs(2.4), -2.2, 2.2);
      lastGapY = mid;
      o.x = x; o.mid = mid; o.top = mid + gap / 2; o.bot = mid - gap / 2; o.passed = false;
      o.ice.position.y = o.top; o.kelp.position.y = o.bot;
      o.hasFish = rnd() < 0.45; o.fish.visible = o.hasFish;
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
        for (const want = need(); used < want; used++) { const o = obs[used]; o.g.visible = true; place(o, far + spacing() - 0.25 + rnd() * 0.5); far = o.x; }   // the screen got wider
        obs.slice(0, used).forEach((o) => {
          if (live) o.x -= dx;
          if (o.x < -halfW - 1.6) { place(o, far + spacing() - 0.25 + rnd() * 0.5); far = o.x; }
          o.g.position.x = o.x;
          o.fronds.forEach((f) => f.joints.forEach((j, i) => { j.rotation.z = Math.sin(clock * 1.5 + i * 0.6 + f.ph) * 0.03; }));
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
      sc.fog = new T.Fog(0xeef3fa, 24, 64);
      const ground = new T.Mesh(new T.PlaneGeometry(140, 140), U.mat(0xf6f9ff, { roughness: 1 }));
      ground.rotation.x = -PI / 2;
      sc.add(ground);
      for (let i = 0; i < 26; i++) {
        const t = tree(1.6 + rnd() * 1.6);
        const side = i < 16 ? 0 : i % 2 ? 1 : -1;
        if (!side) t.position.set(-16 + i * 2 + rs(0.8), 0, -16 - rnd() * 8);
        else t.position.set(side * (5 + rnd() * 6), 0, -12 + rnd() * 12);
        sc.add(t);
      }
      // a tin bucket, open at the top
      const tin = new T.MeshStandardMaterial({ color: 0x9fb0c2, metalness: 0.55, roughness: 0.35, side: T.DoubleSide });
      bucket = new T.Group();
      bucket.add(U.mesh(new T.CylinderGeometry(RIM, RIM * 0.78, RIM_Y, 24, 1, true), tin, 0, RIM_Y / 2, 0));
      bucket.add(U.rot(U.mesh(new T.CircleGeometry(RIM * 0.78, 24), tin, 0, 0.02, 0), -PI / 2));
      bucket.add(U.rot(U.torus(RIM, 0.025, U.mat(0xc7d3df, { metalness: 0.6, roughness: 0.3 }), 0, RIM_Y, 0, PI * 2, 32), PI / 2));
      bucket.add(U.rot(U.torus(RIM * 0.92, 0.012, U.mat(0x7d8b99, { metalness: 0.6, roughness: 0.4 }), 0, RIM_Y + 0.18, 0, PI, 24), 0, 0, 0));
      bucket.add(U.mesh(new T.CircleGeometry(1.16, 24), new T.MeshBasicMaterial({ color: 0x8aa0bb, transparent: true, opacity: 0.18, depthWrite: false }), 0, 0.01, 0));
      bucket.children[bucket.children.length - 1].rotation.x = -PI / 2;
      sc.add(bucket);
      // a little flag shows which way the wind blows
      flag = new T.Group();
      flag.add(U.cyl(0.025, 0.025, 1.7, U.mat(PN.COL.woodDark), 0, 0.85, 0, 6));
      cloth = new T.Group();
      const c = U.mesh(new T.PlaneGeometry(0.55, 0.32, 6, 1), new T.MeshStandardMaterial({ color: PN.COL.red, side: T.DoubleSide, roughness: 0.8 }), 0.275, 0, 0);
      cloth.add(c); cloth.userData.mesh = c;
      cloth.position.y = 1.5;
      flag.add(cloth);
      sc.add(flag);
      sealSpot = new T.Vector3();
      ball = new T.Mesh(new T.SphereGeometry(BR, 14, 10), U.mat(0xffffff, { roughness: 1 }));
      sc.add(ball);
      puffs = Puffs(sc, 40, 0xffffff, 1);
    }
    const lives = () => G.mumMode ? 5 : 3;
    const throwsLeft = () => tr(lives() - tries === 1 ? 'One miss left' : 'Misses left: {0}', lives() - tries);
    /* New wind, ready for the next throw. */
    function setUp() {
      dist = 5;   // the bucket never moves back
      wind = Math.round((G.mumMode ? 3 : 10) * Math.pow(rnd(), 1.2) * 10) / 10 * (rnd() < 0.5 ? -1 : 1);   // anywhere from 0 to 10, but strong winds come up much less often than gentle ones
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
      sc.fog = new T.Fog(0xeef4fb, 26, 70);
      const snow = new T.Mesh(new T.PlaneGeometry(140, 140), U.mat(0xf6f9ff, { roughness: 1 }));
      snow.rotation.x = -PI / 2; snow.position.y = -0.03;
      const ice = new T.Mesh(new T.PlaneGeometry(BANK * 2 + 0.6, 26), U.mat(0xcfe6fa, { roughness: 0.28 }));
      ice.rotation.x = -PI / 2; ice.position.z = -4;
      sc.add(snow, ice);
      const bankM = U.mat(0xffffff, { roughness: 1 });
      [-1, 1].forEach((sd) => {
        sc.add(U.ball(1, bankM, sd * (BANK + 0.95), -0.1, -4, 0.9, 0.55, 14, 16));
        for (let i = 0; i < 9; i++) { const t = tree(1.4 + rnd() * 1.4); t.position.set(sd * (BANK + 2.2 + rnd() * 5), 0, 5 - i * 2.6 + rs(0.8)); sc.add(t); }
      });
      for (let i = 0; i < 12; i++) { const t = tree(1.8 + rnd() * 1.5); t.position.set(-11 + i * 2 + rs(0.6), 0, -19 - rnd() * 6); sc.add(t); }
      sc.add(U.box(BANK * 2, 0.012, 0.09, U.glow(0xd8382f), 0, 0.006, START_Z - 0.9));
      const tex = U.tex(256, 256, (c) => {
        const ring = (r, col) => { c.fillStyle = col; c.beginPath(); c.arc(128, 128, r * 126 / 2.0, 0, PI * 2); c.fill(); };
        ring(2.0, '#2f63c9'); ring(1.6, '#ffffff'); ring(1.2, '#d8382f'); ring(0.85, '#ffffff'); ring(0.55, '#f0b429'); ring(0.12, '#24262b');
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
      for (let i = 0; i < 2; i++) {
        const b = U.group(U.box(1.3, 0.6, 0.5, new T.MeshStandardMaterial({ color: 0x9fd0f5, roughness: 0.2, flatShading: true }), 0, 0.3, 0),
          U.ball(1, bankM, 0, 0.6, 0, 0.66, 0.14, 0.27, 12));
        b.visible = false;
        sc.add(b);
        blocks.push({ g: b, on: false, x: 0, z: 0, ph: 0, sp: 1.6 });
      }
      puffs = Puffs(sc, 40, 0xffffff, 1);
    }
    function next() {
      n++;
      target.x = n === 1 ? 0 : rs(G.mumMode ? 0.6 : 1.5);
      target.z = n === 1 || G.mumMode ? -6.5 : -(5 + rnd() * 5);
      rings.position.set(target.x, 0.012, target.z);
      const size = G.mumMode ? 1.4 : 1;
      rings.scale.set(size, size, 1);
      pos.x = 0; pos.z = START_Z; vel.x = vel.z = 0;
      mode = 'aim'; aim = null;
      const count = G.mumMode ? 0 : n >= 6 ? 2 : n >= 3 ? 1 : 0;
      blocks.forEach((b, i) => {
        b.on = i < count; b.g.visible = b.on;
        b.z = U.lerp(START_Z, target.z, i ? 0.72 : 0.42); b.ph = rnd() * 6; b.sp = 1.3 + rnd() * 0.9;
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
      sc.fog = new T.Fog(0xf1f6fd, 24, 54);
      // A quiet snow wash replaces the busy, dark repeating oval pattern.
      gtex = U.tex(256, 256, (c, w, h) => {
        c.fillStyle = '#f8fbff'; c.fillRect(0, 0, w, h);
        const wash = c.createLinearGradient(0, 0, w, 0);
        wash.addColorStop(0, 'rgba(177,201,224,0)'); wash.addColorStop(0.5, 'rgba(177,201,224,0.055)'); wash.addColorStop(1, 'rgba(177,201,224,0)');
        c.fillStyle = wash; c.fillRect(0, 0, w, h);
      });
      gtex.wrapS = gtex.wrapT = T.RepeatWrapping; gtex.repeat.set(9, REP);
      const ground = new T.Mesh(new T.PlaneGeometry(90, LEN), new T.MeshStandardMaterial({ map: gtex, roughness: 1 }));
      ground.rotation.x = -PI / 2; ground.position.z = -LEN / 2 + 12;
      sc.add(ground);
      // The broad packed trail blends softly into the banks, without painted lanes.
      const trailTex = U.tex(256, 16, (c, w, h) => {
        const gr = c.createLinearGradient(0, 0, w, 0);
        gr.addColorStop(0, 'rgba(184,207,229,0)'); gr.addColorStop(0.12, 'rgba(184,207,229,0.32)');
        gr.addColorStop(0.3, 'rgba(220,233,245,0.26)'); gr.addColorStop(0.5, 'rgba(239,246,252,0.16)');
        gr.addColorStop(0.7, 'rgba(220,233,245,0.26)'); gr.addColorStop(0.88, 'rgba(184,207,229,0.32)'); gr.addColorStop(1, 'rgba(184,207,229,0)');
        c.fillStyle = gr; c.fillRect(0, 0, w, h);
      });
      piste = U.mesh(new T.PlaneGeometry(1, LEN), new T.MeshStandardMaterial({ map: trailTex, transparent: true, depthWrite: false, roughness: 1 }), 0, 0.012, -LEN / 2 + 12);
      piste.rotation.x = -PI / 2; sc.add(piste);
      // Smooth rolled snowbanks keep the route legible without hiding obstacles.
      const profile = [[0, 0], [0.4, 0.08], [1.1, 0.27], [2.4, 0.48], [5, 0.27], [18, 0.10]];
      [-1, 1].forEach((side) => {
        const points = [], indices = [];
        for (let j = 0; j <= 8; j++) for (const p of profile) points.push(side * p[0], p[1], 12 - j * LEN / 8);
        for (let j = 0; j < 8; j++) for (let i = 0; i < profile.length - 1; i++) {
          const a = j * profile.length + i, b = a + profile.length;
          if (side > 0) indices.push(a, a + 1, b, a + 1, b + 1, b);
          else indices.push(a, b, a + 1, a + 1, b, b + 1);
        }
        const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(points, 3)); geo.setIndex(indices); geo.computeVertexNormals();
        const bank = U.mesh(geo, U.mat(0xf4f8ff, { roughness: 1 })); bank.userData.side = side; banks.push(bank); sc.add(bank);
      });
      const wood = U.mat(PN.COL.woodLight, { roughness: 0.7 });
      board = U.group(U.box(0.62, 0.06, 1.5, wood, 0, 0.05, 0.05), U.rot(U.box(0.62, 0.06, 0.4, wood, 0, 0.16, -0.82), 0.7), U.box(0.5, 0.03, 0.06, U.mat(PN.COL.red), 0, 0.09, -0.4));
      sc.add(board);
      const rockM = U.mat(0x7f8894, { roughness: 1 }), capM = U.mat(0xffffff, { roughness: 1 });
      for (let i = 0; i < 64; i++) pool.tree.push({ m: tree(1), kind: 'tree' });
      for (let i = 0; i < 12; i++) pool.rock.push({ m: U.group(U.ball(0.42, rockM, 0, 0.2, 0, 1, 0.7, 0.9, 10), U.ball(0.36, capM, 0, 0.36, 0, 1, 0.4, 0.85, 10)), kind: 'rock' });
      const look = PN.items.ahven.look;
      for (let i = 0; i < 6; i++) {
        const f = PN.Props.fish(look);
        f.scale.setScalar(0.6);
        pool.fish.push({ m: U.group(f), kind: 'fish', inner: f });
      }
      const rampM = U.mat(0xdcecff, { roughness: 0.5 });
      for (let i = 0; i < 3; i++) {
        const r = U.group(U.rot(U.box(1.1, 0.08, 1.3, rampM, 0, 0.22, 0), 0.34), U.rot(U.box(1.12, 0.09, 0.14, U.mat(PN.COL.red), 0, 0.4, -0.52), 0.34));
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
      free = U.clamp(free + Math.round(rs(2.4)), 0, 4);
      const count = G.mumMode ? 1 : 1 + (rnd() < 0.6 ? 1 : 0) + (dist > 150 && rnd() < 0.35 ? 1 : 0);
      const lanes = [0, 1, 2, 3, 4].filter((i) => i !== free).sort(() => rnd() - 0.5).slice(0, count);
      lanes.forEach((i) => {
        if (rnd() < 0.65) put('tree', lane(i) + rs(0.22), z + rs(0.7), 0.4, 0.95 + rnd() * 0.3);
        else put('rock', lane(i) + rs(0.22), z + rs(0.7), 0.36);
      });
      const r = rnd();
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
        gtex.offset.y += dz * REP / LEN;
        piste.scale.x = track * 2 + 1.4;
        banks.forEach((bank) => { bank.position.x = bank.userData.side * (track + 0.55); });
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
      return down ? '<span class="bj-card down' + cls + '"></span>'
        : '<span class="bj-card' + (Math.floor(c / 13) === 1 || Math.floor(c / 13) === 2 ? ' red' : '') + cls + '"><span>' + RANKS[c % 13] + '<i>' + SUITS[Math.floor(c / 13)] + '</i></span></span>';
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

  /* ---------- Löyly: the sauna game ----------
     Played like the fishing in Stardew Valley. A needle (how hot she feels) wanders up and down the thermometer.
     Hold to throw water on the stones and the green band rises; let go and it sinks. Keep the needle in the green
     to fill the calm meter. Fill it and the round is won, then the next one is harder. Let it run dry and it is over. */
  const sauna = (() => {
    let ladle, water, stream, pour = 0;
    const stoveX = -0.95, lip = new T.Vector3(), target = new T.Vector3(stoveX, 0.03, 1.0), up = new T.Vector3(0, 1, 0), delta = new T.Vector3();
    let view = null, steam = null, stones = null, el = null, zoneEl = null, pinEl = null, calmEl = null, padEl = null;
    let goal = 7, lvl = 0, band = 0, bandV = 0, size = 0.3, pin = 0.4, pinT = 0.5, pinV = 0, hop = 0, calm = 0.35, round = 0, hold = false, live = false, rest = 0, splash = 0;
    function build() {
      view = stage('#3a2114', '#6b4023', { ground: 0x5a3a22, hemi: 1.7, key: 1.3 });
      const sc = view.scene;
      const wood = U.mat(0xb9824d, { roughness: 0.85 }), dark = U.mat(0x8a5a32, { roughness: 0.9 });
      sc.add(U.box(9, 6, 0.2, wood, 0, 1.6, -1.7));
      for (let i = -5; i <= 5; i++) sc.add(U.box(0.035, 6, 0.03, dark, i * 0.8, 1.6, -1.58));
      sc.add(U.box(9, 0.2, 6, dark, 0, -1.05, 0.6));
      sc.add(U.box(5.2, 0.16, 1.5, wood, -0.4, -0.08, -0.85));            // the bench she sits on
      sc.add(U.box(5.2, 0.14, 0.9, wood, -0.4, -0.6, 0.25));              // the step below it
      sc.add(U.box(1.0, 0.95, 0.9, U.mat(0x33363d, { roughness: 0.6, metalness: 0.4 }), stoveX, -0.62, 1.0));   // the stove
      stones = new T.MeshStandardMaterial({ color: 0x6a3a24, emissive: 0xff5a1a, roughness: 1 });
      for (let i = 0; i < 9; i++) sc.add(U.ball(0.17 + rnd() * 0.06, i % 3 ? U.mat(0x55524f, { roughness: 1 }) : stones, stoveX + rs(0.3), -0.1 + rnd() * 0.08, 1.0 + rs(0.26), 1, 0.8, 1, 8, 6));
      const lamp = new T.PointLight(0xffa85a, 6, 9); lamp.position.set(stoveX, 0.5, 1.7); sc.add(lamp);
      steam = Puffs(sc, 50, 0xffffff, 0.5);
      // Pivot at the bowl: the long wooden handle tips as water runs over its left lip.
      ladle = new T.Group(); ladle.position.set(stoveX + 0.3, 1.0, 1.25);
      const ladleWood = U.mat(0xc7945b, { roughness: 0.8 });
      ladle.add(U.mesh(new T.SphereGeometry(0.19, 24, 12, 0, PI * 2, PI / 2, PI / 2), ladleWood, 0, 0, 0));
      const rim = U.torus(0.19, 0.025, ladleWood, 0, 0, 0, PI * 2, 24); rim.rotation.x = PI / 2; ladle.add(rim);
      ladle.add(U.rod([0.15, -0.03, 0], [0.78, 0.22, 0], 0.035, ladleWood, 16));
      water = U.cyl(0.155, 0.155, 0.012, U.mat(0x8ed9f5, { transparent: true, opacity: 0.85 }), 0, -0.035, 0, 24); ladle.add(water); sc.add(ladle);
      stream = U.cyl(0.018, 0.025, 1, U.mat(0x9cdef7, { transparent: true, opacity: 0.8 }), 0, 0, 0, 12); stream.visible = false; sc.add(stream);

      view.camera.position.set(0, 0.9, 5.6);
      el = document.getElementById('saunaGauge'); zoneEl = document.getElementById('sgZone'); pinEl = document.getElementById('sgPin'); calmEl = document.getElementById('sgCalm'); padEl = document.getElementById('saunaPad');
      padEl.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); padEl.setPointerCapture(e.pointerId); if (live) hold = true; });
      const release = () => { hold = false; };
      padEl.addEventListener('pointerup', release); padEl.addEventListener('pointercancel', release); padEl.addEventListener('lostpointercapture', release);
      padEl.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (live) hold = true; } });
      padEl.addEventListener('keyup', release); padEl.addEventListener('blur', release); window.addEventListener('blur', release);

    }
    function newRound() {
      lvl = round * 2 / 7;                       // a gentle increase across the whole visit
      size = G.mumMode ? 0.66 : Math.max(0.32, 0.42 - lvl * 0.018);
      band = 0.2; bandV = 0; pin = 0.3; pinT = 0.4; pinV = 0; hop = 0.9; calm = G.mumMode ? 0.62 : 0.5; rest = 0;
    }
    function paint() {
      zoneEl.style.height = (size * 100) + '%'; zoneEl.style.bottom = (band * 100) + '%';
      pinEl.style.top = ((1 - pin) * 100) + '%';
      calmEl.style.height = (calm * 100) + '%';
      zoneEl.classList.toggle('out', !(pin >= band && pin <= band + size));
    }
    return {
      label: 'Rounds', hint: 'Hold the ladle to pour water. Keep the needle in the green.',
      view: () => view,
      start() {
        if (!view) build();
        cast(view, 0.62, true);
        actor.g.position.set(-0.5, 0, -0.75);
        face(0.25);
        goal = (PN.Games.opts && PN.Games.opts.need) || 7;
        round = 0; live = false; hold = false; pour = 0; splash = 0; stream.visible = false; ladle.rotation.z = 0; steam.clear();
        newRound();
        el.hidden = false; padEl.hidden = false; padEl.classList.remove('on'); paint();
        document.getElementById('gScore').textContent = '0/' + goal;
      },
      stop() { live = false; hold = false; stream.visible = false; el.hidden = true; padEl.hidden = true; },
      go() { live = true; },
      pointer(type, x, y) { if (type === 'up') hold = false; else if (type === 'down') { const r = padEl.getBoundingClientRect(); hold = x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; } },
      key() {},
      update(dt, playing) {
        clock += dt;
        lens(view);
        view.camera.lookAt(0, -0.15, 0);
        actor.update(dt, clock, null);
        steam.update(dt, 0, 0);
        stones.emissiveIntensity = 0.6 + pin * 1.6;
        const pressing = playing && live && rest <= 0 && (hold || K.keys() !== 0);
        pour = U.damp(pour, pressing ? 1 : 0, 12, dt);
        ladle.rotation.z = pour * 0.95;
        water.visible = pour < 0.8;
        stream.visible = pressing && pour > 0.25;
        if (stream.visible) {
          ladle.updateMatrixWorld(true); lip.set(-0.17, 0, 0); ladle.localToWorld(lip);
          delta.subVectors(lip, target); stream.position.copy(lip).add(target).multiplyScalar(0.5);
          stream.quaternion.setFromUnitVectors(up, delta.clone().normalize()); stream.scale.y = delta.length();
          stream.scale.x = stream.scale.z = 0.85 + 0.15 * Math.sin(clock * 32);
        }
        padEl.classList.toggle('on', pressing);
        if (!playing || !live) return;
        if (rest > 0) { rest -= dt; if (rest <= 0) newRound(); paint(); return; }
        // the green band: water lifts it, and it sinks back on its own, with a small bounce off the bottom
        bandV += (pressing ? 1.9 : -1.6) * dt;
        const bandSpeed = G.mumMode ? 0.46 : 0.85;
        bandV = U.clamp(bandV, -bandSpeed, bandSpeed);
        band += bandV * dt;
        if (band < 0) { band = 0; bandV = Math.abs(bandV) * 0.15; }
        if (band > 1 - size) { band = 1 - size; bandV = 0; }
        if (pressing) { splash -= dt; if (splash <= 0) { splash = 0.16; steam.emit(stoveX, 0.2, 1.0, 2, 0.5, 0.16, 1.3, -1.6); if (rnd() < 0.25) A.play('bubble', 0.25); } }
        // the needle: wanders towards a spot, then picks another; the later the round, the jumpier
        const k = 1 + lvl * 0.12;
        hop -= dt;
        if (hop <= 0) {
          hop = (0.55 + rnd() * 1.15) / Math.sqrt(k) * (G.mumMode ? 1.5 : 1);
          pinT = G.mumMode ? U.clamp(pin + rs(0.19), 0.18, 0.82) : U.clamp(pin + rs(0.36 + 0.035 * lvl), 0.04, 0.96);
        }
        pinV += ((pinT - pin) * 9 * k - pinV * 4.6) * dt;
        pin = U.clamp(pin + pinV * dt, 0, 1);
        const inside = pin >= band && pin <= band + size;
        calm = U.clamp(calm + (inside ? (G.mumMode ? 0.21 : 0.16) : (G.mumMode ? -0.035 : -0.08)) * dt, 0, 1);
        paint();
        if (calm >= 1) {
          round++; K.score(round, true); document.getElementById('gScore').textContent = round + '/' + goal;
          A.play(round >= goal ? 'award' : 'match'); actor.gesture('happy', true);
          steam.emit(stoveX, 0.25, 1.0, 14, 1.1, 0.2, 1.6, -1.4);
          if (round >= goal) { live = false; hold = false; stream.visible = false; el.hidden = true; padEl.hidden = true; K.over(tr('Squeaky clean!')); return; }
          K.big(tr('Lovely!'));
          rest = 1.3;
        } else if (calm <= 0) {
          live = false; hold = false; stream.visible = false;
          A.play('nope'); actor.gesture(pin > band ? 'shake' : 'no', true);
          el.hidden = true; padEl.hidden = true;
          K.over(tr(pin > band + size ? 'Too hot!' : 'Too cold!'));
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
    const flavours = [0xf7d5df, 0xffedc6, 0xc4e4cc, 0xd2b5a5, 0xd6cdf1, 0xf5d3a9];
    const towerBounds = new T.Box3(), revealCentre = new T.Vector3(), revealSize = new T.Vector3();
    let blocks = [], cuts = [], cur = null, top = null;
    let score = 0, misses = 0, streak = 0, turn = 0, mode = 'idle', wait = 0, camY = 0, hopT = 1;
    const at = new T.Vector3(), from = new T.Vector3(), to = new T.Vector3();

    function floe(w, d, n) {
      const g = new T.Group();
      g.add(new T.Mesh(bodyGeo, U.mat(flavours[n % flavours.length], { roughness: 0.95 })));
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
        c.fillStyle = '#dbad78'; c.fillRect(0, 0, w, h);
        c.strokeStyle = 'rgba(145,92,45,0.24)'; c.lineWidth = 3;
        for (let x = -w; x < w * 2; x += 32) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x + w, h); c.moveTo(x, 0); c.lineTo(x - w, h); c.stroke(); }
      });
      waffle.wrapS = waffle.wrapT = T.RepeatWrapping; waffle.repeat.set(3, 2);
      const cone = U.cyl(CONE_RADIUS, 0.025, 4, new T.MeshStandardMaterial({ map: waffle, roughness: 0.95 }), 0, -2.1, 0, 48);
      const rim = U.rot(U.torus(CONE_RADIUS - 0.05, 0.075, U.mat(0xe4b884), 0, -0.10, 0, PI * 2, 48), PI / 2);
      const base = baseIce = U.mesh(softGeo.clone(), U.mat(flavours[1], { roughness: 0.95 }), 0, -BH, 0); base.scale.set(S0, 1, S0);
      const plate = U.cyl(3.0, 2.85, 0.16, U.mat(0xfff8ef), 0, -4.20, 0, 48);
      sc.add(cone, rim, base, plate);
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
        const batch = new T.Mesh(U.merge(parts), U.mat(0xffffff, { vertexColors: true, roughness: 0.95 }));
        history.push(batch); view.scene.add(batch);
      }
      score++; K.score(score); K.hint('');
      if (score % 10 === 0) { A.play('award'); actor.gesture('happy', true); }
      mode = 'rest'; wait = 0.16;
    }
    return {
      label: 'Scoops', hint: 'Tap to stack the ice cream. Keep your cone balanced!',
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

  /* ================= Puffer Sweeper ================= */
  /* Minesweeper under the ice: nine by nine tiles with ten pufferfish under them. Tap a tile to open it; a number says how many
     pufferfish touch it. The first tap is always safe and opens a patch, and the pufferfish are only placed after it, on a board
     that sweep.js has checked can be cleared without one guess. Wake a pufferfish and it is over, with nothing to show for it.
     Clear the lot and the coins go by the clock: the quicker, the more (data.js). The clock starts on the first tap.
     Flags are optional. Hold a tile, or switch to Flag and tap. Tap a number whose flags are all down to open the rest around it. */
  const puff = (() => {
    const HOLD = 140, Sw = PN.Sweep;
    let size = 9, mineCount = 10, saves = 0;
    const FLAG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 21V4" stroke="#17264d" stroke-width="2.4" stroke-linecap="round" fill="none"/><path d="M8.6 4.4l10.4 3.7-10.4 4z" fill="#f2683c" stroke="#f2683c" stroke-width="1.2" stroke-linejoin="round"/></svg>';
    const FISH = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.8v3.4M12 18.8v3.4M1.8 12h3.4M18.8 12h3.4M4.8 4.8l2.4 2.4M19.2 4.8l-2.4 2.4M4.8 19.2l2.4-2.4M19.2 19.2l-2.4-2.4" stroke="#c9822a" stroke-width="1.8" stroke-linecap="round" fill="none"/>'
      + '<circle cx="12" cy="12" r="7.2" fill="#f6c443"/><path d="M5.4 14.6a7.2 7.2 0 0 0 13.2 0z" fill="#fff1c9"/><circle cx="9.2" cy="10.4" r="1.5" fill="#17264d"/><circle cx="14.8" cy="10.4" r="1.5" fill="#17264d"/>'
      + '<path d="M10.5 14.3h3" stroke="#17264d" stroke-width="1.5" stroke-linecap="round" fill="none"/></svg>';
    let view = null, el = null, cells = [], prizeEl = null, modeEl = null, tipEl = null, fish = [];
    let mines = null, num = null, open = null, mark = null, left = 0, flags = 0, t = 0, mode = 'idle', flagging = false, wait = 0, press = null, shownT = -1, shownP = -1;

    /* A round little pufferfish for the water beside her. */
    function puffer() {
      const g = new T.Group(), skin = U.mat(0xf2c14e, { roughness: 0.6 }), thorn = U.mat(0xc98a2b, { roughness: 0.6 }), dark = U.mat(0x17264d, { roughness: 0.4 });
      const up = new T.Vector3(0, 1, 0), v = new T.Vector3();
      g.add(U.ball(0.3, skin, 0, 0, 0, 1, 1, 1, 20));
      g.add(U.ball(0.27, U.mat(0xfff1c9, { roughness: 0.7 }), 0, -0.05, 0.03, 1, 0.95, 1, 18));
      for (let i = 0; i < 34; i++) {
        const y = 1 - (i + 0.5) / 17, r = Math.sqrt(1 - y * y), a = i * 2.39996, x = Math.cos(a) * r, z = Math.sin(a) * r;
        if (z > 0.5 && y > -0.35 && y < 0.65) continue;                 // keep the face clear
        const c = U.cone(0.034, 0.12, thorn, x * 0.32, y * 0.32, z * 0.32, 6);
        c.quaternion.setFromUnitVectors(up, v.set(x, y, z));
        g.add(c);
      }
      [-1, 1].forEach((sd) => {
        g.add(U.ball(0.075, U.mat(0xffffff, { roughness: 0.3 }), sd * 0.115, 0.09, 0.245, 1, 1, 0.7, 12), U.ball(0.038, dark, sd * 0.12, 0.09, 0.3, 1, 1, 0.6, 10));
        const fin = U.ball(0.09, thorn, sd * 0.31, -0.03, 0, 0.5, 1, 1.1, 10); fin.rotation.z = sd * 0.5; g.add(fin);
      });
      g.add(U.ball(0.045, dark, 0, -0.035, 0.292, 1, 0.5, 0.5, 10));
      const tail = U.cone(0.12, 0.2, thorn, 0, 0, -0.38, 8); tail.rotation.x = PI / 2; tail.scale.x = 0.35; g.add(tail);
      return g;
    }
    function build() {
      view = stage('#86bdf0', '#eef7ff', { ground: 0xbfdcff, hemi: 2.0, key: 1.7 });
      const sc = view.scene, snow = U.mat(0xffffff, { roughness: 1 }), ice = U.mat(0xa9d6f5, { roughness: 0.45 });
      const lake = U.mesh(new T.CircleGeometry(80, 40), U.mat(0x2b68b3, { roughness: 0.3 }), 0, -0.2, 0);
      lake.rotation.x = -PI / 2;
      sc.add(lake, U.cyl(1.02, 0.9, 0.32, ice, 0, -0.18, 0, 9), U.cyl(1.06, 1.02, 0.06, snow, 0, 0, 0, 9));
      const r = U.rng(81);
      for (let i = 0; i < 16; i++) {
        const a = r() * PI * 2, d = 3.2 + r() * 16, k = 0.4 + r() * 1.3;
        const f = U.cyl(k, k * 0.92, 0.12, snow, Math.cos(a) * d, -0.16, Math.sin(a) * d - 4, 7);
        f.rotation.y = r() * 3; sc.add(f);
      }
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
        lookAtPool(view, 1.2);
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
      const id = choices[Math.floor(Math.random() * choices.length)];
      lastSong = id;
      try { localStorage.setItem('pikkunorppa.kantele.lastSong', id); } catch (e) { /* keep the in-memory choice */ }
      return PN.SONGS[id];
    }
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
      e.style.cssText = 'position:absolute;top:calc(66px + env(safe-area-inset-top, 0px));left:50%;transform:translateX(-50%);width:max-content;max-width:calc(100% - 32px);box-sizing:border-box;padding:7px 14px;border-radius:16px;background:rgba(16,43,82,.88);color:#fff;font:700 16px var(--body, sans-serif);line-height:1.3;text-align:center;text-shadow:none;z-index:4;pointer-events:none';
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
      g2.fillStyle = 'rgba(255,255,255,.07)';
      for (let l = 1; l < LANES; l++) g2.fillRect(l * lw - 1, 0, 2, H);
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
          gr.addColorStop(0, guided ? '#edffed' : '#fafdff');
          gr.addColorStop(1, guided ? '#8edba9' : '#bfe0fa');
          g2.fillStyle = gr;
        }
        box(x, y, w, hh, rad); g2.fill();
        if (i !== badTile) { g2.fillStyle = 'rgba(255,255,255,.9)'; box(x + 5, y + 4, w - 10, Math.min(5, hh / 3), 2.5); g2.fill(); }
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
      view = stage('#86bdf0', '#eef7ff', { ground: 0xbfdcff, hemi: 2.0, key: 1.7 });
      const sc = view.scene, snow = U.mat(0xffffff, { roughness: 1 }), ice = U.mat(0xa9d6f5, { roughness: 0.45 });
      const lake = U.mesh(new T.CircleGeometry(80, 40), U.mat(0x2b68b3, { roughness: 0.3 }), 0, -0.2, 0);
      lake.rotation.x = -PI / 2;
      sc.add(lake, U.cyl(1.02, 0.9, 0.32, ice, 0, -0.18, 0, 9), U.cyl(1.06, 1.02, 0.06, snow, 0, 0, 0, 9));
      const r = U.rng(33);
      for (let i = 0; i < 16; i++) {
        const a = r() * PI * 2, d = 3.2 + r() * 16, k = 0.4 + r() * 1.3;
        const f = U.cyl(k, k * 0.92, 0.12, snow, Math.cos(a) * d, -0.16, Math.sin(a) * d - 4, 7);
        f.rotation.y = r() * 3; sc.add(f);
      }
      // A small five-string kantele: tapered wooden soundbox, bridge and tuning pins.
      // Attached to the seal's squash rig so pups and adults hold the same proportions.
      kantele = new T.Group();
      const outline = new T.Shape();
      outline.moveTo(-0.68, -0.22); outline.lineTo(0.66, -0.14);
      outline.quadraticCurveTo(0.76, -0.12, 0.69, 0.02);
      outline.lineTo(0.32, 0.32); outline.quadraticCurveTo(0.26, 0.37, 0.15, 0.34);
      outline.lineTo(-0.68, 0.10); outline.quadraticCurveTo(-0.76, 0.02, -0.68, -0.22);
      const wood = U.mat(0xdba361, { roughness: 0.8 });
      const body = new T.Mesh(new T.ExtrudeGeometry(outline, { depth: 0.09, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.035, bevelThickness: 0.025, curveSegments: 12 }), wood);
      kantele.add(body);
      const dark = U.mat(0x805331, { roughness: 0.85 });
      const hole = U.mesh(new T.CircleGeometry(0.065, 24), dark, -0.05, 0, 0.117);
      kantele.add(hole);
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
      window.addEventListener('resize', () => { if (!el.hidden) size(); });
    }
    return {
      label: 'Tiles', nocount: true, hint: 'Tap the Start tile, then every tile in order.',
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


  /* ---------- Sauna lab (developer mode only) ----------
     Four rough ideas for replacing Löyly, to try and compare. They pay nothing, cost no energy and save nothing (see `lab` in data.js and finish() in games.js).
     1 whack the sweat beads with the vihta, 2 scrub the dirt off with it, 3 ladle rhythm, 4 whack the beads while the steam makes them swell.
     The 3D room is shared; the beads, dirt, rings and meter are plain HTML laid over it, placed by projecting the seal and the stones onto the screen. */
  const lab = (() => {
    const stoveX = -0.95, STEAMY = 0.35, ZONE = [0.4, 0.7], LEN = 30;
    let view = null, steam = null, stones = null, ladle = null, layer = null, meterFill = null, vihta = null, padBtn = null;
    let kind = '', live = false, time = LEN, score = 0, steamLvl = 0, spawn = 0, rectT = 0, throwT = 0, cool = 0, zoneT = 0, hits = 0, nextBeat = 0, beatN = 0, touching = false, last = null;
    let body = { x0: 100, y0: 200, x1: 300, y1: 400 }, stone = { x: 100, y: 500 };
    let beads = [], patches = [], beats = [];
    const box = new T.Box3(), pv = new T.Vector3();
    const px = () => Math.max(34, Math.min(window.innerWidth, window.innerHeight) * 0.085);
    const html = (tag, cls, parent) => { const e = document.createElement(tag); e.className = cls; (parent || layer).appendChild(e); return e; };

    function build() {
      view = stage('#3a2114', '#6b4023', { ground: 0x5a3a22, hemi: 1.7, key: 1.3 });
      const sc = view.scene;
      const wood = U.mat(0xb9824d, { roughness: 0.85 }), dark = U.mat(0x8a5a32, { roughness: 0.9 });
      sc.add(U.box(9, 6, 0.2, wood, 0, 1.6, -1.7));
      for (let i = -5; i <= 5; i++) sc.add(U.box(0.035, 6, 0.03, dark, i * 0.8, 1.6, -1.58));
      sc.add(U.box(9, 0.2, 6, dark, 0, -1.05, 0.6));
      sc.add(U.box(5.2, 0.16, 1.5, wood, -0.4, -0.08, -0.85));
      sc.add(U.box(5.2, 0.14, 0.9, wood, -0.4, -0.6, 0.25));
      sc.add(U.box(1.0, 0.95, 0.9, U.mat(0x33363d, { roughness: 0.6, metalness: 0.4 }), stoveX, -0.62, 1.0));
      stones = new T.MeshStandardMaterial({ color: 0x6a3a24, emissive: 0xff5a1a, roughness: 1 });
      for (let i = 0; i < 9; i++) sc.add(U.ball(0.17 + rnd() * 0.06, i % 3 ? U.mat(0x55524f, { roughness: 1 }) : stones, stoveX + rs(0.3), -0.1 + rnd() * 0.08, 1.0 + rs(0.26), 1, 0.8, 1, 8, 6));
      const lamp = new T.PointLight(0xffa85a, 6, 9); lamp.position.set(stoveX, 0.5, 1.7); sc.add(lamp);
      steam = Puffs(sc, 50, 0xffffff, 0.5);
      ladle = new T.Group(); ladle.position.set(stoveX + 0.3, 1.0, 1.25);
      const lw = U.mat(0xc7945b, { roughness: 0.8 });
      ladle.add(U.mesh(new T.SphereGeometry(0.19, 24, 12, 0, PI * 2, PI / 2, PI / 2), lw, 0, 0, 0));
      ladle.add(U.rod([0.15, -0.03, 0], [0.78, 0.22, 0], 0.035, lw, 16));
      sc.add(ladle);
      view.camera.position.set(-0.5, 0.9, 5.6);   // centred on the seal, so the stove is on the screen too
      layer = document.createElement('div'); layer.className = 'lab-layer'; document.getElementById('gamehud').appendChild(layer);
    }
    /* Where the seal and the stones are on the screen right now. */
    function measure() {
      view.camera.updateMatrixWorld(true); view.rig.updateMatrixWorld(true);
      box.setFromObject(actor.g);
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (let i = 0; i < 8; i++) {
        pv.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(view.camera);
        const x = (pv.x * 0.5 + 0.5) * window.innerWidth, y = (-pv.y * 0.5 + 0.5) * window.innerHeight;
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
      const w = x1 - x0, h = y1 - y0;
      body = { x0: x0 + w * 0.15, x1: x1 - w * 0.15, y0: Math.max(90, y0 + h * 0.15), y1: Math.min(window.innerHeight - 140, y1 - h * 0.1) };
      pv.set(stoveX, 0.1, 1.0).project(view.camera);
      stone = { x: (pv.x * 0.5 + 0.5) * window.innerWidth, y: (-pv.y * 0.5 + 0.5) * window.innerHeight };
    }
    const inBody = () => ({ x: body.x0 + rnd() * (body.x1 - body.x0), y: body.y0 + rnd() * (body.y1 - body.y0) });
    function swat(x, y) {
      vihta.style.left = x + 'px'; vihta.style.top = y + 'px';
      vihta.classList.remove('swat'); void vihta.offsetWidth; vihta.classList.add('swat');
    }
    function setScore(n, quiet) { score = Math.max(0, n); K.score(score, quiet); }

    /* the steam meter (rhythm and whack plus steam) */
    function meter(lo, hi) {
      const m = html('div', 'lab-meter');
      const z = html('i', 'lab-zone', m); z.style.bottom = lo * 100 + '%'; z.style.height = (hi - lo) * 100 + '%';
      meterFill = html('b', 'lab-fill', m);
    }
    function ladleThrow(amount) {
      throwT = 0.35; steamLvl = Math.min(1, steamLvl + amount);
      steam.emit(stoveX, 0.2, 1.0, 8, 0.9, 0.18, 1.5, -1.5); A.play('bubble', 0.5);
    }

    /* whack the beads */
    function addBead(clean) {
      const e = html('i', 'lab-bead' + (clean ? ' clean' : '')), p = inBody(), s = px();
      e.style.setProperty('--s', s + 'px'); e.style.left = p.x + 'px'; e.style.top = p.y + 'px';
      beads.push({ e, x: p.x, y: p.y, s, life: kind === 'steam' ? 1.9 : 1.5, clean });
    }
    function whack(x, y) {
      let pick = null, best = 1e9;
      beads.forEach((b) => { const d = Math.hypot(b.x - x, b.y - y), reach = b.s * (b.e.classList.contains('swollen') ? 0.72 : 0.5) + 16; if (d < reach && d < best) { best = d; pick = b; } });
      swat(x, y);
      if (!pick) return;
      beads.splice(beads.indexOf(pick), 1);
      pick.e.classList.add('hit'); setTimeout(() => pick.e.remove(), 220);
      if (pick.clean) { setScore(score - 1); A.play('nope'); return; }
      setScore(score + (pick.e.classList.contains('swollen') ? 2 : 1)); A.play('pop');
    }
    function tickBeads(dt) {
      const rate = kind === 'steam' ? 1 + steamLvl * 1.2 : 1;
      spawn -= dt * rate;
      if (spawn <= 0) { spawn = Math.max(0.38, 0.85 - (LEN - time) * 0.015); addBead(rnd() < 0.2); }
      beads = beads.filter((b) => {
        b.life -= dt;
        if (kind === 'steam') b.e.classList.toggle('swollen', steamLvl > STEAMY && !b.clean);
        b.e.style.opacity = b.life < 0.4 ? Math.max(0, b.life / 0.4) : 1;
        if (b.life <= 0) { b.e.remove(); return false; }
        return true;
      });
    }

    /* scrub the dirt */
    function scrubTo(x, y) {
      vihta.style.left = x + 'px'; vihta.style.top = y + 'px'; vihta.classList.add('on');
      if (!last) { last = { x, y }; return; }
      const moved = Math.hypot(x - last.x, y - last.y);
      patches.forEach((p) => {
        if (p.dirt <= 0) return;
        // how close the stroke from the last point to this one came to the middle of the patch
        const dx = x - last.x, dy = y - last.y, len2 = dx * dx + dy * dy || 1;
        const t = U.clamp(((p.x - last.x) * dx + (p.y - last.y) * dy) / len2, 0, 1);
        if (Math.hypot(last.x + dx * t - p.x, last.y + dy * t - p.y) < p.r + 10) {
          p.dirt -= moved / (p.r * 4.5);
          p.e.style.opacity = Math.max(0, p.dirt);
          if (p.dirt <= 0) { p.e.remove(); setScore(score + 1); A.play('chirp', 0.5); steam.emit(stoveX, 0.2, 1.0, 3, 0.6, 0.15, 1.2, -1.5); }
        }
      });
      last = { x, y };
      if (live && score >= patches.length) { live = false; K.over(tr('Squeaky clean!')); A.play('award'); actor.gesture('happy', true); }
    }

    /* ladle rhythm */
    const APPROACH = 0.9;
    function tickBeat(dt) {
      nextBeat -= dt;
      if (nextBeat <= 0) {
        nextBeat = Math.max(0.78, 1.15 - beatN * 0.012); beatN++;
        const e = html('i', 'lab-ring'); e.style.left = stone.x + 'px'; e.style.top = stone.y + 'px';
        beats.push({ e, age: 0, done: false });
      }
      steamLvl = Math.max(0, steamLvl - 0.07 * dt);
      if (steamLvl >= ZONE[0] && steamLvl <= ZONE[1]) { zoneT += dt; }
      setScore(hits + Math.floor(zoneT), true);
      beats = beats.filter((b) => {
        b.age += dt;
        const k = Math.min(1, b.age / APPROACH);
        b.e.style.transform = 'scale(' + (1 + 2.4 * (1 - k)) + ')';
        b.e.style.opacity = b.done ? 0 : b.age > APPROACH + 0.1 ? Math.max(0, 1 - (b.age - APPROACH - 0.1) / 0.2) : 1;
        if (!b.done && b.age > APPROACH + 0.25) { b.done = true; steamLvl = Math.max(0, steamLvl - 0.08); K.big(tr('Missed'), 0.5); }
        if (b.age > APPROACH + 0.45) { b.e.remove(); return false; }
        return true;
      });
    }
    function tapBeat() {
      let pick = null, best = 9;
      beats.forEach((b) => { const d = Math.abs(b.age - APPROACH); if (!b.done && d < 0.35 && d < best) { best = d; pick = b; } });
      if (!pick) { steamLvl = Math.max(0, steamLvl - 0.04); A.play('nope', 0.5); return; }
      pick.done = true; pick.e.classList.add('hit');
      if (best < 0.11) { hits += 2; ladleThrow(0.22); K.big(tr('Perfect!'), 0.5); A.play('match'); }
      else if (best < 0.25) { hits += 1; ladleThrow(0.12); K.big(tr('Good'), 0.5); A.play('tap'); }
      else { steamLvl = Math.max(0, steamLvl - 0.03); K.big(tr(pick.age < APPROACH ? 'Early' : 'Late'), 0.5); A.play('nope', 0.5); }
    }

    function clearLayer() { while (layer.firstChild) layer.removeChild(layer.firstChild); beads = []; patches = []; beats = []; meterFill = null; padBtn = null; }
    function begin(k) {
      if (!view) build();
      kind = k;
      cast(view, 0.62, true); actor.g.position.set(-0.5, 0, -0.75); face(0.25);
      steam.clear(); clearLayer(); layer.hidden = false;
      live = false; time = LEN; score = 0; steamLvl = k === 'beat' ? 0.5 : 0; spawn = 0.5; throwT = 0; cool = 0; zoneT = 0; hits = 0; nextBeat = 1; beatN = 0; touching = false; last = null; rectT = 0;
      lens(view); view.camera.lookAt(-0.5, -0.15, 0); actor.update(0.001, clock, null); measure();
      vihta = html('div', 'lab-vihta');
      vihta.innerHTML = '<svg viewBox="0 0 60 100" aria-hidden="true"><rect x="25" y="56" width="10" height="42" rx="5" fill="#8a5a32"/><g fill="#4f9a3d" stroke="#2f6a26" stroke-width="2"><ellipse cx="30" cy="22" rx="11" ry="20"/><ellipse cx="16" cy="34" rx="10" ry="19" transform="rotate(-24 16 34)"/><ellipse cx="44" cy="34" rx="10" ry="19" transform="rotate(24 44 34)"/><ellipse cx="22" cy="46" rx="9" ry="14" transform="rotate(-40 22 46)"/><ellipse cx="38" cy="46" rx="9" ry="14" transform="rotate(40 38 46)"/></g></svg>';
      if (k === 'scrub') {
        const cells = [];
        for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) cells.push([r, c]);
        cells.sort(() => rnd() - 0.5);
        const w = (body.x1 - body.x0) / 3, h = (body.y1 - body.y0) / 3, rad = U.clamp(h * 0.42, 26, 54);
        cells.slice(0, 7).forEach(([r, c]) => {
          const e = html('i', 'lab-dirt'), x = body.x0 + w * (c + 0.5) + rs(w * 0.18), y = body.y0 + h * (r + 0.5) + rs(h * 0.18);
          e.style.width = e.style.height = rad * 2 + 'px'; e.style.left = x + 'px'; e.style.top = y + 'px';
          patches.push({ e, x, y, r: rad, dirt: 1 });
        });
      }
      if (k === 'beat') meter(ZONE[0], ZONE[1]);
      if (k === 'steam') {
        meter(STEAMY, 1);
        padBtn = html('button', 'sg-pad'); padBtn.type = 'button'; padBtn.textContent = tr('Löyly');
        padBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (live && cool <= 0) { ladleThrow(0.26); cool = 0.35; } });
      }
      if (k === 'beat') { const t = html('i', 'lab-target'); t.style.left = stone.x + 'px'; t.style.top = stone.y + 'px'; }
      K.time(LEN);
      document.getElementById('gScore').textContent = '0';
    }
    function make(k, hint) {
      return {
        label: k === 'scrub' ? 'Patches' : 'Score', label2: 'Time', hint,
        view: () => view,
        start() { begin(k); },
        stop() { live = false; if (layer) { clearLayer(); layer.hidden = true; } },
        go() { live = true; },
        key() {},
        pointer(type, x, y) {
          if (!live) return;
          if (k === 'scrub') { if (type === 'down') { touching = true; last = null; scrubTo(x, y); } else if (type === 'move' && touching) scrubTo(x, y); else if (type === 'up') { touching = false; last = null; vihta.classList.remove('on'); } return; }
          if (type !== 'down') return;
          if (k === 'beat') { tapBeat(); return; }
          whack(x, y);
        },
        update(dt, playing) {
          clock += dt;
          lens(view); view.camera.lookAt(-0.5, -0.15, 0);
          actor.update(dt, clock, null);
          steam.update(dt, 0, 0);
          stones.emissiveIntensity = 0.6 + steamLvl * 1.6 + (k === 'scrub' ? 0.6 : 0);
          rectT -= dt; if (rectT <= 0) { rectT = 0.5; measure(); }
          if (throwT > 0) { throwT = Math.max(0, throwT - dt); ladle.rotation.z = Math.sin((1 - throwT / 0.35) * PI) * 0.95; } else ladle.rotation.z = 0;
          if (meterFill) meterFill.style.height = steamLvl * 100 + '%';
          if (padBtn) padBtn.classList.toggle('on', cool > 0);
          if (!playing || !live) return;
          cool -= dt;
          time -= dt; K.time(Math.max(0, Math.ceil(time)));
          if (k === 'whack' || k === 'steam') { if (k === 'steam') steamLvl = Math.max(0, steamLvl - 0.1 * dt); tickBeads(dt); }
          if (k === 'beat') tickBeat(dt);
          if (time <= 0) { live = false; K.over(tr('Time!')); A.play('go'); }
        },
      };
    }
    return {
      whack: make('whack', 'Tap the sweat beads to whack them with the vihta. Leave the clear drops alone.'),
      scrub: make('scrub', 'Rub the vihta over the dirty patches until they are gone.'),
      beat: make('beat', 'Tap when the ring closes on the stones. Keep the steam in the green.'),
      steam: make('steam', 'Whack the beads. Tap Löyly for steam: swollen beads pay double.'),
    };
  })();


  /* Lab 5 (developer mode only): pull her out of the sauna. A heat bar fills up the side with a gold line on it, like the swing bar in a golf game.
     Hold her by the head and drag her out through the door when the bar is on the line; the bar stops the moment she is out. Dunk her in the tub to start the next round.
     She is a rag doll: held by the head she hangs from it like a pendulum (the pull of the drag swings her), let go and she falls, lands and flops flat.
     The physics runs in a flat plane (x across, y up) and she moves toward the camera as she goes through the door. Five rounds, up to 3 points each. */
  const pullOut = (() => {
    const ROUNDS = 5, HINT = 'Hold her by the head. When the bar is on the gold line, drag her down out of the sauna and into the ice hole.';
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
      if (!tutRound) { score += pts; K.score(score); }
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
      if (round >= ROUNDS) { held = false; live = false; K.over(tr('All done!')); return; }
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
      label: 'Points', hint: HINT,
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
        live = false; round = 0; score = 0; rippleT = 0; ptr = null; steam.clear(); splash.clear(); sparks.clear();
        tutRound = K.tutoring(); tutHold = false;   // the first time, round one is a guided practice that does not count
        layer.hidden = false; toRest();
        document.getElementById('gScore').textContent = '0';
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

  G.ext.swim = swim; G.ext.stack = stack; G.ext.puff = puff; G.ext.piano = piano; G.ext.toss = toss; G.ext.curl = curl; G.ext.sled = sled; G.ext.bj = bj; G.ext.sauna = sauna;
  G.ext.labwhack = lab.whack; G.ext.labscrub = lab.scrub; G.ext.labbeat = lab.beat; G.ext.labsteam = lab.steam; G.ext.labpull = pullOut;
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
      hit: geo(new T.BoxGeometry(0.96, 0.10, 1.10)),
      marker: geo(new T.TorusGeometry(0.38, 0.035, 8, 28)),
      arrow: geo(new T.ConeGeometry(0.30, 0.55, 16)),
    };
    materials = {
      paint: mat(0xf3bc42), trim: mat(0x28568a), cream: mat(0xf4eee0), floor: mat(0xe9d7b5),
      seat: mat(0x6b9bdd), cushion: mat(0xffffff), frame: mat(0x315584), tire: mat(0x334453), hub: mat(0xb6cbd0),
      glass: mat(0xa8def1, { roughness: 0.18, transparent: true, opacity: 0.20, depthWrite: false }), light: mat(0xffe4a2, { emissive: 0xffd388, emissiveIntensity: 0.35 }),
      red: mat(0xdc807b), road: mat(0x7f919d), line: mat(0xeaf1e8), snow: mat(0xe6f1ed),
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
        ball(scenery, materials.green, sign * (half + 3.3), -0.30, -11 + i * 5, 0.65, 0.5, 0.65);
      }
    });
    // Chassis, exposed floor, low cutaway walls and separate window panels.
    box(bus, materials.trim, busWidth, 0.95, 11.8 + busExtra, 0, 0.12, -0.1);
    box(bus, materials.floor, busWidth - 0.25, 0.14, 11.25 + busExtra, 0, 0.68, 0.02);
    [-1, 1].forEach(sign => {
      const x = sign * (half - 0.10);
      box(bus, materials.paint, 0.18, 0.53, 10.9 + busExtra, x, 0.86, -0.05);
      box(bus, materials.cream, 0.20, 0.10, 10.9 + busExtra, x, 1.14, -0.05);
      for (let i = 0; i < rows; i++) box(bus, materials.glass, 0.10, 0.25, 0.89, x, 1.31, seats[i * Math.ceil(round / 4) * 2].z);
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
    populateSeats(seats, round);
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
  }
  function choose(i) {
    if (phase !== 'choose') return;
    if (performance.now() >= deadline) i = -1;
    if (i >= 0 && seats[i].occupied) return;
    if (tutStep === 1 && i >= 0 && seats[i].distance < best - 1e-7) return;   // the first bus only takes the best seat
    chosen = i;
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
      round = 0; total = 0; clock = 0; tutStep = PN.Games.tutorial.seen('shuffle') ? 0 : 1; next();
    },
    go() { K.score(0, true); },
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
        if (elapsed >= ARRIVE) { phase = 'choose'; deadline = tutStep ? Infinity : performance.now() + 1100; elapsed = 0; }
      } else if (phase === 'choose') {
        if (!tutStep) bus.position.z -= CRAWL * dt;   // the tutorial buses wait where they stopped
        if (performance.now() >= deadline) choose(-1);
      } else if (phase === 'reveal') {
        if (!tutStep) bus.position.z -= CRAWL * dt;
        if (elapsed >= REVEAL + hold) { phase = 'depart'; departFrom = bus.position.z; elapsed = 0; }
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

