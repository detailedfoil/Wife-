/* Pikku Norppa: the arcade. Nine mini-games, each on a little stage of its own.
   Swimmy Seal: tap to swim up, slip between the ice and the kelp. Three goes, the best counts.
   Snowball Toss: flick the snowball into a bucket, Paper Toss style. Mind the wind.
   Curling Seal: slide across the ice and stop on the rings.
   Sled Run: steer down the hill between the trees.
   Blackjack: beat the dealer for sardines. Löyly: keep the sauna heat just right.
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
    const H = 4.6, CEIL = 3.9, FLOOR = -3.9, R = 0.27, N = 5, GOES = 3;   // three goes; the best one is what pays
    let view = null, obs = [], bubbles = null, rays = [], drift = [];
    let halfW = 2.2, sx = -1, y = 0, vy = 0, dead = false, lastGapY = 0, score = 0, live = false, go = 1, best = 0, wait = 0;

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
      const gap = 2.45 - Math.min(0.55, score * 0.025);
      const mid = U.clamp(lastGapY + rs(2.4), -2.2, 2.2);
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
    function point() {
      score++; K.shown(score);
      if (score > best) { best = score; K.result(best); }
    }
    function die() {
      dead = true;
      A.play('thud');
      actor.gesture('surprise', true);
      bubbles.emit(sx, y, 0.3, 12, 1.6, 0.09, 1.1, -2.6);
      if (go < GOES) { K.big(tr(score >= 10 ? 'Wow!' : 'Bonk!')); wait = 0.9; }
      else K.over(tr(best >= 10 ? 'Wow!' : 'Bonk!'));
    }
    /* a fresh stretch of water for the next go */
    function reset() {
      y = 0.3; vy = 0; dead = false; live = false; score = 0; lastGapY = 0;
      bubbles.clear();
      halfW = H * W.aspect;
      obs.forEach((o, i) => place(o, halfW + 3.2 + i * 3.5));
    }
    function nextGo() {
      go++; reset();
      K.time(go + '/' + GOES); K.shown(0); K.hint(''); K.big('');
      live = true; flap();
    }
    const tap = () => { if (dead) { if (go < GOES && wait <= 0) nextGo(); } else flap(); };
    return {
      label: 'Gaps', label2: 'Go', hint: 'Tap to swim up. Three goes, and the best one counts.',
      view: () => view,
      start() {
        if (!view) build();
        cast(view, 0.37, false);
        actor.g.position.set(0, -0.46, 0);
        face(PI / 2);
        go = 1; best = 0; wait = 0;
        reset();
        K.time(go + '/' + GOES);
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
        const speed = dead ? 0 : live ? 2.7 + Math.min(1.5, score * 0.06) : 1.2;
        const dx = speed * dt;
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
          vy = Math.max(-6, vy - 11 * dt);
          y += vy * dt;
          if (y + R > CEIL) { y = CEIL - R; vy = Math.min(vy, 0); }
          if (y - R < FLOOR) { y = FLOOR + R; if (!dead) die(); }
        }
        view.rig.position.set(sx, y, 0);
        view.rig.rotation.z = U.damp(view.rig.rotation.z, live ? U.clamp(vy * 0.11, -0.75, 0.5) : 0, 10, dt);
        // ice above, kelp below
        let far = -99;
        obs.forEach((o) => { if (o.x > far) far = o.x; });
        obs.forEach((o) => {
          if (live) o.x -= dx;
          if (o.x < -halfW - 1.6) { place(o, far + 3.3 + rnd() * 0.5); far = o.x; }
          o.g.position.x = o.x;
          o.fronds.forEach((f) => f.joints.forEach((j, i) => { j.rotation.z = Math.sin(clock * 1.5 + i * 0.6 + f.ph) * 0.03; }));
          if (o.hasFish) { o.fish.position.y = o.mid + Math.sin(clock * 3 + o.x) * 0.12; o.fish.rotation.z = Math.sin(clock * 5 + o.x) * 0.15; }
          if (!playing || dead) return;
          const ax = Math.abs(o.x - sx);
          if (ax < 0.44 + R * 0.8 && (y + R > o.top || y - R < o.bot)) { die(); return; }
          if (o.hasFish && ax < 0.55 && Math.abs(o.fish.position.y - y) < 0.6) {
            o.hasFish = false; o.fish.visible = false;
            point(); A.play('gulp');
            bubbles.emit(o.x, o.mid, 0.2, 5, 0.9, 0.06, 0.7, -2);
          }
          if (!o.passed && o.x + 0.5 < sx - R) { o.passed = true; point(); A.play('pop'); K.hint(''); }
        });
        bubbles.update(dt, -dx, 0);
        if (live && !dead && rnd() < dt * 2) bubbles.emit(sx + 0.5, y + 0.1, 0.2, 1, 0.2, 0.05, 1, -2.2);
        if (dead && go < GOES && wait > 0 && playing) { wait -= dt; if (wait <= 0) K.hint(tr('Best so far: {0}. Tap for go {1} of {2}.', best, go + 1, GOES)); }
        actor.update(dt, clock, null);
      },
    };
  })();

  /* ================= Snowball Toss =================
     Like the old Paper Toss: flick the snowball at a bucket. The wind is shown, the arc is not.
     New wind every throw; the bucket stays where it is. Keep throwing until the third miss. Every basket counts. */
  const toss = (() => {
    const GRAV = 12, ELEV = 50 * PI / 180, SY = 0.8, SZ = 3.2, ZB = 0.4, RANGE = 5.253, BR = 0.14, RIM = 0.65, HIT = 0.85, RIM_Y = 0.62, WINDK = 0.855;   // HIT: the scoring circle is 30% wider than the bucket looks
    let view = null, ball = null, bucket = null, flag = null, cloth = null, puffs = null, sealSpot = null;
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
    const LIVES = 3;   // tries counts the misses: three and the game is over, like Swimmy Seal's three goes
    const throwsLeft = () => tr(LIVES - tries === 1 ? 'One miss left' : 'Misses left: {0}', LIVES - tries);
    /* New wind, ready for the next throw. */
    function setUp() {
      dist = 5;   // the bucket never moves back
      wind = Math.round(10 * Math.pow(rnd(), 1.2) * 10) / 10 * (rnd() < 0.5 ? -1 : 1);   // anywhere from 0 to 10, but strong winds come up much less often than gentle ones
      bk.set(0, 0, SZ - dist);
      bucket.position.copy(bk);
      flag.position.set(0.95, 0, bk.z - 0.2);
      view.rig.position.set(-1.05, 0, bk.z + 0.15);
      K.time(wind ? Math.abs(wind).toFixed(1) + (wind > 0 ? ' →' : ' ←') : '0.0');
      ball.position.set(0, SY, SZ + ZB); ball.visible = true; ball.scale.setScalar(1);
      mode = 'ready'; rimHit = false;
      K.hint(throwsLeft());
    }
    /* The throwing guide: shown each time the game opens, with the lean each wind strength needs. */
    let guideEl = null;
    function guide() {
      if (guideEl) guideEl.remove();
      const rows = [[0, 0], [2.5, 16], [5, 28], [7.5, 37], [10, 45]];
      const OX = 150, OY = 262, LEN = 215, col = ['#ffffff', '#bfe3ff', '#ffe08a', '#ffb066', '#ff7a6b'];
      let svg = '<svg viewBox="-40 0 380 290" aria-hidden="true">';
      rows.forEach((r, i) => {
        [-1, 1].forEach((side) => {
          if (!r[1] && side > 0) return;
          const a = r[1] * PI / 180, x = OX + side * Math.sin(a) * LEN, y = OY - Math.cos(a) * LEN;
          svg += '<line x1="' + OX + '" y1="' + OY + '" x2="' + x.toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke="' + col[i] + '" stroke-width="4" stroke-linecap="round" stroke-dasharray="1 10"/>';
          const lx = OX + side * Math.sin(a) * (LEN + 16), ly = OY - Math.cos(a) * (LEN + 16) + 5;
          svg += '<text x="' + lx.toFixed(1) + '" y="' + ly.toFixed(1) + '" text-anchor="middle" fill="' + col[i] + '">' + (r[0] ? String(r[0]) : '0') + '</text>';
        });
      });
      svg += '<circle cx="' + OX + '" cy="' + (OY + 8) + '" r="16" fill="#fff"/></svg>';
      guideEl = document.createElement('div');
      guideEl.className = 'tg';
      guideEl.innerHTML = '<div class="tg-card"><b>' + tr('Aim into the wind') + '</b>' + svg
        + '<p>' + tr('Swipe up the screen along the line for the wind. The numbers are the wind, and wind 10 needs a 45 degree lean. If the flag blows right, swipe left.') + '</p>'
        + '<button class="btn" type="button">' + tr('Start throwing') + '</button></div>';
      guideEl.querySelector('button').addEventListener('click', () => { A.play('tap'); guideEl.remove(); guideEl = null; mode = 'ready'; K.hint(throwsLeft()); });
      document.getElementById('gamehud').appendChild(guideEl);
      mode = 'guide'; K.hint('');
    }
    function launch(yaw) {
      const v = Math.sqrt(GRAV * RANGE / Math.sin(2 * ELEV)), ch = Math.cos(ELEV) * v;
      bv.set(Math.tan(yaw) * ch, Math.sin(ELEV) * v, -ch);   // a sideways shot keeps its full reach, so leaning into the wind never falls short
      mode = 'fly'; prevY = SY; spin = 8;
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
      label: 'Baskets', label2: 'Wind', back: true, nocount: true, hint: 'Flick the snowball into the bucket. Three misses and it is over.',
      view: () => view,
      start() {
        if (!view) build();
        cast(view, 0.42, true);
        face(0);
        score = 0; top = 0; tries = 0; puffs.clear();
        setUp();
        guide();
      },
      stop() { if (guideEl) { guideEl.remove(); guideEl = null; } },
      go() {},
      pointer(type, x, y) {
        if (mode !== 'ready') return;
        if (type === 'down') { drag = { x, y, t: performance.now() }; return; }
        if (!drag || type !== 'up') return;
        const dx = x - drag.x, dy = y - drag.y;
        drag = null;
        if (dy > -30 || Math.hypot(dx, dy) < 40) return;           // a flick has to go up the screen
        // like Paper Toss: the swipe's own angle is the throw's angle, one to one. A swipe within about 4 degrees of
        // straight goes dead straight. Wind 10 needs a lean of about 45 degrees, and each point is roughly 4.5 degrees.
        const ang = Math.atan2(dx, -dy);
        launch(U.clamp(Math.sign(ang) * Math.max(0, Math.abs(ang) - 0.07), -1.25, 1.25));
      },
      update(dt, playing) {
        clock += dt;
        lens(view);
        view.camera.position.set(0, 2.1, SZ + 2.6); view.camera.lookAt(0, 0.55, SZ - Math.min(dist, 8.5));
        // the flag streams out with the wind
        const w = Math.abs(wind) / 10;
        cloth.rotation.y = wind >= 0 ? 0 : PI;
        cloth.rotation.z = -1.3 * (1 - Math.min(1, w * 1.6));
        cloth.userData.mesh.rotation.y = Math.sin(clock * (4 + 8 * w)) * (0.1 + 0.35 * w);
        if (mode === 'ready') ball.position.y = SY + Math.sin(clock * 3) * 0.02;
        if (mode === 'fly' || mode === 'out' && ball.visible && bv.lengthSq() > 0.01) {
          const steps = 3, h = dt / steps;
          for (let i = 0; i < steps; i++) {
            bv.x += wind * WINDK * h   /* a point of wind pushes the snowball about a quarter of a metre off line; 10 is a hard but possible shove */; bv.y -= GRAV * h;
            ball.position.addScaledVector(bv, h);
            const p = ball.position, d = Math.hypot(p.x - bk.x, p.z - bk.z);
            ball.rotation.x -= spin * h;
            if (mode === 'fly' && prevY >= RIM_Y && p.y < RIM_Y) {
              if (d < HIT - BR * 0.5) { p.set(bk.x + (p.x - bk.x) * 0.5, RIM_Y - 0.25, bk.z + (p.z - bk.z) * 0.5); bv.set(0, 0, 0); basket(); break; }
              if (d < HIT + BR) {                                      // clang off the rim
                A.play('tap'); A.play('thud', 0.1);
                const ox = (p.x - bk.x) / (d || 1), oz = (p.z - bk.z) / (d || 1);
                bv.set(ox * 2.2, Math.abs(bv.y) * 0.4, oz * 2.2);
                p.y = RIM_Y + 0.01; rimHit = true;
                miss(tr('So close!'));
              }
            }
            if (mode === 'fly' && p.y < RIM_Y && d < HIT + BR && d > HIT - BR) { bv.x *= -0.4; bv.z *= -0.4; miss(tr('So close!')); }
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
            if (tries >= LIVES) { mode = 'done'; K.over(tr(score >= 15 ? 'Wow!' : score >= 5 ? 'Nice!' : 'Done!')); }
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
      target.x = n === 1 ? 0 : rs(1.5); target.z = n === 1 ? -6.5 : -(5 + rnd() * 5);
      rings.position.set(target.x, 0.012, target.z);
      pos.x = 0; pos.z = START_Z; vel.x = vel.z = 0;
      mode = 'aim'; aim = null;
      const count = n >= 6 ? 2 : n >= 3 ? 1 : 0;
      blocks.forEach((b, i) => {
        b.on = i < count; b.g.visible = b.on;
        b.z = U.lerp(START_Z, target.z, i ? 0.72 : 0.42); b.ph = rnd() * 6; b.sp = 1.3 + rnd() * 0.9;
      });
      face(PI);
    }
    function stop(text, pts, sad) {
      mode = 'rest'; rest = 1.15; vel.x = vel.z = 0;
      score += pts;
      if (pts) K.score(score);
      K.big(text);
      if (sad) { A.play('thud'); actor.gesture('shake', true); puffs.emit(pos.x, 0.3, pos.z, 8, 1.6, 0.12, 0.5, 5); }
      else if (pts) { A.play(pts === 5 ? 'award' : 'match'); actor.gesture('happy', true); }
      else { A.play('nope'); actor.gesture('sad', true); }
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
        view.camera.position.set(0, 6.4, 9.8); view.camera.lookAt(0, 0, -5.2);
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
          const sp = Math.hypot(vel.x, vel.z), dec = MU * dt;
          if (sp <= dec) {
            const d = Math.hypot(pos.x - target.x, pos.z - target.z);
            const pts = d < 0.55 ? 5 : d < 1.2 ? 3 : d < 2.0 ? 1 : 0;
            stop(pts === 5 ? tr('Bullseye!') : pts ? '+' + pts : tr('Miss'), pts, false);
          } else {
            const k = (sp - dec) / sp;
            vel.x *= k; vel.z *= k;
            pos.x += vel.x * dt; pos.z += vel.z * dt;
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
      const count = 1 + (rnd() < 0.6 ? 1 : 0) + (dist > 150 && rnd() < 0.35 ? 1 : 0);
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
        x = tx = vx = 0; dist = 0; bonus = 0; free = 2; air = 0; dead = false; going = false; shown = -1; rows = 0;
        track = U.clamp(Math.tan(lens(view)) * 10 * 0.78, 1.5, 3.0);
        for (let z = -6; z > SPAWN; z -= 6) row(z);
        rowAt = 0;
      },
      go() { going = true; A.play('whoosh'); },
      pointer(type, px) {
        if (type === 'up') return;
        tx = U.clamp((px / window.innerWidth * 2 - 1) * track * 1.15, -track, track);
      },
      update(dt, playing) {
        clock += dt;
        const hh = lens(view);
        view.camera.position.set(0, 4.6, 9); view.camera.lookAt(0, 0.5, -7);
        track = U.clamp(Math.tan(hh) * 10 * 0.78, 1.5, 3.0);
        const speed = dead ? 0 : going ? 9 + Math.min(9, dist / 60) : 3;
        const dz = speed * dt;
        gtex.offset.y += dz * REP / LEN;
        piste.scale.x = track * 2 + 1.4;
        banks.forEach((bank) => { bank.position.x = bank.userData.side * (track + 0.55); });
        if (going && !dead) {
          dist += dz;
          const key = K.keys();
          if (key) tx = U.clamp(tx + key * 8 * dt, -track, track);
          const want = U.damp(x, tx, 12, dt), step = U.clamp(want - x, -9 * dt, 9 * dt);
          x += step; vx = step / dt;
          if (air > 0) air -= dt;
          rowAt -= dz;
          if (rowAt <= 0) { rowAt += Math.max(4.8, 6.5 - dist / 250); row(SPAWN); }
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
          if (Math.abs(it.z + 0.2) < 0.55 && Math.abs(it.x - x) < it.r + 0.3) {
            if (it.kind === 'fish') {
              it.live = false; it.m.visible = false; live.splice(i, 1);
              bonus += 10; K.big('+10'); A.play('gulp');
              K.score(Math.floor(dist) + bonus);
            } else if (it.kind === 'ramp') {
              it.r = 0; air = 0.9; bonus += 20;
              K.big(tr('Jump!')); A.play('boing');
              K.score(Math.floor(dist) + bonus);
            } else crash();
          }
        }
        const y = air > 0 ? Math.sin((1 - air / 0.9) * PI) * 1.3 : 0;
        view.rig.position.set(x, y + 0.08, 0);
        view.rig.rotation.z = U.damp(view.rig.rotation.z, -vx * 0.045, 10, dt);
        face(PI - U.clamp(vx * 0.04, -0.4, 0.4));
        board.position.set(x, y, 0); board.rotation.z = view.rig.rotation.z; board.rotation.y = -U.clamp(vx * 0.04, -0.4, 0.4);
        puffs.update(dt, 0, dz);
        actor.update(dt, clock, null);
      },
    };
  })();

  /* ---------- Blackjack ----------
     Bet from 5 sardines up to all in, hit or stand, beat the dealer without going over 21. A win pays back 3.5 times the bet
     (your bet plus 2.5 times more). You sit down with ten sardines and play until you cash out, they are all gone, or the house
     runs out at 50 sardines of winnings. Only the winnings turn into coins, 0.7 a sardine (data.js), so at most 35 a visit.
     Tuned by simulating thousands of visits with the hit-under-16, stand-on-16 rule: small, steady bets make about 27 coins
     a minute, like the other games, and bolder betting pays about the same on average but far more often ends with nothing.
     The dealer is quick and the next bet is ready the moment a hand is over, so a hand takes about four seconds. */
  const bj = (() => {
    const START = 10, MIN = 5, PAY = 3.5, CAP = 50;    // the house can pay out 50 sardines of winnings (35 coins), then the table closes
    const SUITS = ['♠', '♥', '♦', '♣'], RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    let view = null, el = null, deck = [], you = [], house = [], stack = START, bet = 0, frac = 0, mode = 'bet', wait = 0, msg = '', hide = true, lock = 0;
    const total = (h) => {
      let t = 0, aces = 0;
      h.forEach((c) => { const r = c % 13; if (r === 0) { aces++; t += 11; } else t += Math.min(10, r + 1); });
      while (t > 21 && aces) { t -= 10; aces--; }
      return t;
    };
    const draw = () => deck.pop();
    function shuffle() {
      deck = [];
      for (let i = 0; i < 52; i++) deck.push(i);
      for (let i = 51; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const x = deck[i]; deck[i] = deck[j]; deck[j] = x; }
    }
    const card = (c, down) => down ? '<span class="bj-card down"></span>'
      : '<span class="bj-card' + (Math.floor(c / 13) === 1 || Math.floor(c / 13) === 2 ? ' red' : '') + '"><span>' + RANKS[c % 13] + '<i>' + SUITS[Math.floor(c / 13)] + '</i></span></span>';
    function paint() {
      const btn = (act, label, cls, off) => '<button data-bj="' + act + '" class="' + (cls || '') + '"' + (off ? ' disabled' : '') + '>' + label + '</button>';
      let btns = '';
      if (mode === 'bet') btns = '<div class="bj-slide"><input type="range" id="bjRange" min="0" max="100" step="1" value="' + Math.round(frac * 100) + '" aria-label="' + tr('How much to bet') + '">'
        + '<span class="bj-ticks"><i></i><i></i><i></i></span><span class="bj-ends"><span>' + MIN + '</span><span>' + tr('All in') + '</span></span></div>' + btn('bet', betLabel(), 'go', stack < MIN);
      else btns = btn('hit', tr('Hit'), '', mode !== 'play') + btn('stand', tr('Stand'), 'go', mode !== 'play');
      el.innerHTML = '<div class="bj-row"><div class="bj-who">' + tr('Dealer') + '<b>' + (house.length ? (hide ? '?' : total(house)) : '') + '</b></div><div class="bj-cards">'
        + house.map((c, i) => card(c, hide && i === 1)).join('') + '</div></div>'
        + '<div class="bj-row"><div class="bj-who">' + tr('You') + '<b>' + (you.length ? total(you) : '') + '</b></div><div class="bj-cards">' + you.map((c) => card(c)).join('') + '</div></div>'
        + '<div class="bj-msg">' + msg + '</div><div class="bj-btns">' + btns + '</div>';
    }
    // How much the bar says: nothing is 5, the top is everything, and in between is that share of what you have now.
    const betNow = () => Math.min(stack, Math.max(MIN, Math.round(frac * stack)));
    const betLabel = () => tr(frac >= 1 ? 'All in {0}' : 'Bet {0}', betNow());
    function money() { K.shown(stack); K.result(Math.min(CAP, Math.max(0, stack - START))); }
    function deal(b) {
      if (mode !== 'bet' || stack < MIN || b < 1) return;
      bet = b; stack -= b; money();
      shuffle(); you = [draw(), draw()]; house = [draw(), draw()]; hide = true; msg = '';
      A.play('pop');
      if (total(you) === 21) { mode = 'house'; wait = 0.5; } else mode = 'play';
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
      if (stack < MIN || stack - START >= CAP) { mode = 'done'; wait = 1.1; } else { mode = 'bet'; lock = 0.35; }
      paint();
    }
    function act(a) {
      if (a === 'bet') { if (lock <= 0) deal(betNow()); return; }
      if (mode !== 'play') return;
      if (a === 'hit') {
        you.push(draw()); A.play('pop');
        if (total(you) > 21) { hide = false; settle(); }
        else if (total(you) === 21) { mode = 'house'; wait = 0.4; paint(); }
        else paint();
      } else if (a === 'stand') { A.play('tap'); mode = 'house'; wait = 0.3; paint(); }
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
      });
    }
    return {
      label: 'Sardines', back: true, backLabel: 'Cash out', nocount: true, hint: '',
      view: () => view,
      start() {
        if (!view) build();
        cast(view, 0.62, true);
        face(0);
        stack = START; bet = 0; frac = 0; you = []; house = []; mode = 'bet'; hide = true; lock = 0;
        msg = tr('You have {0} sardines. Place a bet.', START);
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
        view.camera.lookAt(0, -0.75, 0);
        actor.update(dt, clock, null);
        if (lock > 0) lock -= dt;
        if (!playing || wait <= 0) return;
        wait -= dt;
        if (wait > 0) return;
        if (mode === 'house') {
          if (hide) { hide = false; A.play('pop'); wait = 0.4; paint(); }
          else if (total(house) < 17) { house.push(draw()); A.play('pop'); wait = 0.4; paint(); }
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
    let view = null, steam = null, stones = null, el = null, zoneEl = null, pinEl = null, calmEl = null;
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
      sc.add(U.box(1.0, 0.95, 0.9, U.mat(0x33363d, { roughness: 0.6, metalness: 0.4 }), 0.62, -0.62, 1.0));   // the stove
      stones = new T.MeshStandardMaterial({ color: 0x6a3a24, emissive: 0xff5a1a, roughness: 1 });
      for (let i = 0; i < 9; i++) sc.add(U.ball(0.17 + rnd() * 0.06, i % 3 ? U.mat(0x55524f, { roughness: 1 }) : stones, 0.62 + rs(0.3), -0.1 + rnd() * 0.08, 1.0 + rs(0.26), 1, 0.8, 1, 8, 6));
      const lamp = new T.PointLight(0xffa85a, 6, 9); lamp.position.set(0.62, 0.5, 1.7); sc.add(lamp);
      steam = Puffs(sc, 50, 0xffffff, 0.5);
      view.camera.position.set(0, 0.9, 5.6);
      el = document.getElementById('saunaGauge'); zoneEl = document.getElementById('sgZone'); pinEl = document.getElementById('sgPin'); calmEl = document.getElementById('sgCalm');
    }
    function newRound() {
      lvl = round * 4 / 7;                       // round 7 is as hard as round 4 used to be
      size = Math.max(0.15, 0.31 - lvl * 0.022);
      band = 0.2; bandV = 0; pin = 0.3; pinT = 0.4; pinV = 0; hop = 0.6; calm = 0.35; rest = 0;
    }
    function paint() {
      zoneEl.style.height = (size * 100) + '%'; zoneEl.style.bottom = (band * 100) + '%';
      pinEl.style.top = ((1 - pin) * 100) + '%';
      calmEl.style.height = (calm * 100) + '%';
      zoneEl.classList.toggle('out', !(pin >= band && pin <= band + size));
    }
    return {
      label: 'Rounds', hint: 'Hold to throw water. Keep the needle in the green. Each round gets her cleaner.',
      view: () => view,
      start() {
        if (!view) build();
        cast(view, 0.62, true);
        actor.g.position.set(-0.5, 0, -0.75);
        face(0.25);
        goal = (PN.Games.opts && PN.Games.opts.need) || 7;
        round = 0; live = false; hold = false; steam.clear();
        newRound();
        el.hidden = false; paint();
        document.getElementById('gScore').textContent = '0/' + goal;
      },
      stop() { el.hidden = true; },
      go() { live = true; },
      pointer(type) { if (type === 'down') hold = true; else if (type === 'up') hold = false; },
      key() {},
      update(dt, playing) {
        clock += dt;
        lens(view);
        view.camera.lookAt(0, -0.15, 0);
        actor.update(dt, clock, null);
        steam.update(dt, 0, 0);
        stones.emissiveIntensity = 0.6 + pin * 1.6;
        if (!playing || !live) return;
        if (rest > 0) { rest -= dt; if (rest <= 0) newRound(); paint(); return; }
        const pressing = hold || K.keys() !== 0;
        // the green band: water lifts it, and it sinks back on its own, with a small bounce off the bottom
        bandV += (pressing ? 2.6 : -2.1) * dt;
        bandV = U.clamp(bandV, -1.3, 1.3);
        band += bandV * dt;
        if (band < 0) { band = 0; bandV = Math.abs(bandV) * 0.35; }
        if (band > 1 - size) { band = 1 - size; bandV = 0; }
        if (pressing) { splash -= dt; if (splash <= 0) { splash = 0.16; steam.emit(0.62, 0.2, 1.0, 2, 0.5, 0.16, 1.3, -1.6); if (rnd() < 0.25) A.play('bubble', 0.25); } }
        // the needle: wanders towards a spot, then picks another; the later the round, the jumpier
        const k = 1 + lvl * 0.22;
        hop -= dt;
        if (hop <= 0) { hop = (0.5 + rnd() * 1.5) / Math.sqrt(k); pinT = rnd() < 0.3 ? rnd() : U.clamp(pin + rs(0.3 + 0.04 * lvl), 0.03, 0.97); }
        pinV += ((pinT - pin) * 9 * k - pinV * 4.5) * dt;
        pin = U.clamp(pin + pinV * dt, 0, 1);
        const inside = pin >= band && pin <= band + size;
        calm = U.clamp(calm + (inside ? 0.125 : -0.15) * dt, 0, 1);
        paint();
        if (calm >= 1) {
          round++; K.score(round, true); document.getElementById('gScore').textContent = round + '/' + goal;
          A.play(round >= goal ? 'award' : 'match'); actor.gesture('happy', true);
          steam.emit(0.62, 0.25, 1.0, 14, 1.1, 0.2, 1.6, -1.4);
          if (round >= goal) { el.hidden = true; K.over(tr('Squeaky clean!')); return; }
          K.big(tr('Lovely!'));
          rest = 1.3;
        } else if (calm <= 0) {
          A.play('nope'); actor.gesture(pin > band ? 'shake' : 'no', true);
          el.hidden = true;
          K.over(tr(pin > band + size ? 'Too hot!' : 'Too cold!'));
        }
      },
    };
  })();

  /* ================= Ice Stack ================= */
  /* Stack, on ice: a floe slides across, tap to set it down. Whatever hangs over the edge breaks off, so the tower narrows.
     Miss the tower altogether and the game is over. */
  const stack = (() => {
    const S0 = 2, BH = 0.42, SNOW = 0.08, R = 3, TOL = 0.09, GROW = 0.12, LIVES = 1, HOP = 0.28, KEEP = 46;
    const speedAt = (n) => Math.min(6, 2.6 + 0.085 * n);
    let view = null, bodyGeo = null, snowGeo = null, puffs = null;
    let blocks = [], cuts = [], cur = null, top = null;
    let score = 0, misses = 0, streak = 0, turn = 0, mode = 'idle', wait = 0, camY = 0, hopT = 1;
    const at = new T.Vector3(), from = new T.Vector3(), to = new T.Vector3();

    function floe(w, d, n) {
      const g = new T.Group(), col = new T.Color().setHSL((0.56 + (n % 60) / 60) % 1, 0.7, 0.6);
      g.add(new T.Mesh(bodyGeo, U.mat(col.getHex(), { roughness: 0.45 })), new T.Mesh(snowGeo, U.mat(0xffffff, { roughness: 1 })));
      g.scale.set(w, 1, d);
      view.scene.add(g);
      return g;
    }
    function build() {
      view = stage('#7fb6ee', '#e9f4ff', { ground: 0xcfe2ff, hemi: 2.1, key: 1.6 });
      bodyGeo = new T.BoxGeometry(1, BH - SNOW, 1); bodyGeo.translate(0, (BH - SNOW) / 2, 0);
      snowGeo = new T.BoxGeometry(1.03, SNOW, 1.03); snowGeo.translate(0, BH - SNOW / 2, 0);
      const sc = view.scene;
      // the iceberg it all stands on, and the lake far below
      const berg = U.mesh(new T.BoxGeometry(S0, 14, S0), U.mat(0x9fd0f2, { roughness: 0.45 }), 0, -7 - SNOW, 0);
      const cap = U.mesh(new T.BoxGeometry(S0 * 1.03, SNOW, S0 * 1.03), U.mat(0xffffff, { roughness: 1 }), 0, -SNOW / 2, 0);
      const lake = U.mesh(new T.CircleGeometry(120, 40), U.mat(0x3f86c9, { roughness: 0.35 }), 0, -11, 0);
      lake.rotation.x = -PI / 2;
      sc.add(berg, cap, lake);
      for (let i = 0; i < 22; i++) {
        const a = rnd() * PI * 2, r = 4 + rnd() * 30, s = 0.8 + rnd() * 1.8;
        const f = U.mesh(new T.CylinderGeometry(s, s * 0.9, 0.25, 7), U.mat(0xffffff, { roughness: 1 }), Math.cos(a) * r, -10.9, Math.sin(a) * r);
        f.rotation.y = rnd() * 3; sc.add(f);
      }
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
        K.big(tr('Perfect!')); A.play('match');
        puffs.emit(top.x, top.y + 0.1, top.z, 10, 1.6, 0.1, 0.5, 4);
      } else {
        streak = 0; keep = size - ad; mid = c + delta / 2;
        const off = floe(x ? ad : top.w, x ? top.d : ad, score + 1), oc = c + delta + sgn * (size - ad) / 2;
        off.position.set(x ? oc : top.x, top.y, x ? top.z : oc);
        fall(off, x ? sgn : 0, x ? 0 : sgn);
        A.play('pop');
      }
      top = { x: x ? mid : top.x, z: x ? top.z : mid, w: x ? keep : top.w, d: x ? top.d : keep, y: top.y + BH };
      cur.g.scale.set(top.w, 1, top.d); cur.g.position.set(top.x, top.y - BH, top.z);
      blocks.push(cur.g); cur = null;
      if (blocks.length > KEEP) view.scene.remove(blocks.shift());
      score++; K.score(score); K.hint('');
      if (score % 10 === 0) { A.play('award'); actor.gesture('happy', true); }
      mode = 'rest'; wait = 0.16;
    }
    return {
      label: 'Floes', hint: 'Tap to set the floe down on the one below.',
      view: () => view,
      peek: () => (cur && mode === 'slide' ? cur.p : null),
      start() {
        if (!view) build();
        blocks.concat(cuts.map((c) => c.g)).forEach((g) => view.scene.remove(g));
        if (cur) view.scene.remove(cur.g);
        blocks = []; cuts = []; cur = null; puffs.clear();
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
        const half = lens(view), d = (R * 0.707 + S0 * 0.75) / Math.tan(half), k = d * 0.577;
        camY = U.damp(camY, top.y, 4, dt);
        view.camera.position.set(k, camY + 1.2 + k, k);
        view.camera.lookAt(0, camY + 1.2, 0);
        if (cur && mode === 'slide' && playing) {
          cur.p += cur.v * dt;
          if (cur.p > R) { cur.p = 2 * R - cur.p; cur.v = -cur.v; } else if (cur.p < -R) { cur.p = -2 * R - cur.p; cur.v = -cur.v; }
          if (cur.axis === 'x') cur.g.position.x = top.x + cur.p; else cur.g.position.z = top.z + cur.p;
        }
        if (mode === 'rest' && playing) {
          wait -= dt;
          if (wait <= 0) {
            if (misses >= LIVES) { mode = 'done'; K.over(tr(score >= 25 ? 'Wow!' : score >= 8 ? 'Nice!' : 'Done!')); }
            else spawn();
          }
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
    const BW = 9, BH = 9, N = 10, CELLS = BW * BH, HOLD = 140, Sw = PN.Sweep;
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
      let h = '<div class="pf-tip" id="pfTip"></div><div class="pf-grid">';
      for (let i = 0; i < CELLS; i++) h += '<button class="pf-c" data-i="' + i + '" tabindex="-1"></button>';
      h += '</div><div class="pf-bar"><span class="pf-prize" id="pfPrize"></span><span class="pf-mode" id="pfMode" role="group"><button data-pf="dig"></button><button data-pf="flag"></button></span></div>';
      el.innerHTML = h;
      cells = Array.prototype.slice.call(el.querySelectorAll('.pf-c'));
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
      paint(i); A.play('tick'); K.shown(N - flags);
    }
    /* A long press flags a shut tile. False: there was nothing to flag, so the press counts as a plain tap. */
    function hold(i) {
      if (mode !== 'play' || open[i]) return false;
      const st = PN.Game.state;
      if (st.settings.haptics && navigator.vibrate) { try { navigator.vibrate(14); } catch (e) { /* not allowed here */ } }
      setFlag(i);
      return true;
    }
    /* Open a tile and whatever comes with it. False: there was a pufferfish under it. */
    function dig(i) {
      if (mines[i]) { boom(i); return false; }
      const got = Sw.flood(BW, BH, mines, num, open, i);
      got.forEach((j) => { if (mark[j]) { mark[j] = 0; flags--; } paint(j); if (j !== i || got.length > 1) cells[j].classList.add('fresh'); });
      left -= got.length;
      return true;
    }
    function tap(i) {
      const first = mode === 'ready';                           // the first tap always opens, whichever way the switch is set
      if (first) {
        mines = Sw.make(BW, BH, N, i); num = Sw.counts(BW, BH, mines);
        mode = 'play'; tipEl.textContent = '';
      }
      if (mode !== 'play') return;
      if (open[i]) {
        if (!num[i]) return;
        const nb = Sw.hood(BW, BH)[i];
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
      K.shown(N - flags);
      if (left === 0) win();
    }
    function win() {
      mode = 'won';
      for (let i = 0; i < CELLS; i++) if (!open[i] && !mark[i]) { mark[i] = 1; paint(i); }
      flags = N; K.shown(0);
      K.result(Math.max(1, Math.ceil(t)));
      A.play('award'); actor.gesture('happy', true);
      K.over(tr('All clear!'));
    }
    function boom(i) {
      mode = 'boom'; wait = 1.1;
      for (let j = 0; j < CELLS; j++) {
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
        mines = null; num = new Uint8Array(CELLS); open = new Uint8Array(CELLS); mark = new Uint8Array(CELLS);
        left = CELLS - N; flags = 0; t = 0; mode = 'ready'; flagging = false; wait = 0; press = null; shownT = shownP = -1;
        fish.forEach((f) => { f.big = 1; f.g.scale.setScalar(1); });
        for (let i = 0; i < CELLS; i++) paint(i);
        bar(); clockNow();
        tipEl.textContent = tr('Tap any tile to start. Hold a tile to flag it.');
        el.hidden = false;
      },
      stop() { if (press) { clearTimeout(press.timer); press = null; } el.hidden = true; },
      go() { K.shown(N); },
      pointer() {},
      key() {},
      update(dt, playing) {
        clock += dt;
        lens(view);
        view.camera.lookAt(0, -2.0, 0);
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
    const tile = (i) => chart[i % chart.length];
    const startOf = (i) => Math.floor(i / chart.length) * total + tile(i).at;
    const bpm = (p) => Math.min(MAX, START + RISE * Math.floor(p / (total / 2)));     // a step up at every half loop
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
      const lw = W / LANES, u = H / SPAN, line = H * LINE;
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
        else { const gr = g2.createLinearGradient(0, y, 0, y + hh); gr.addColorStop(0, '#fafdff'); gr.addColorStop(1, '#bfe0fa'); g2.fillStyle = gr; }
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
      else if (lane !== t.lane || (startOf(next) - pos) * (H / SPAN) > H * LINE) {
        if (lane === lastLane && clock - lastAt < BOUNCE) return;        // the same finger landing twice
        fail(lane, -1, tr('Wrong tile!'));
        return;
      }
      A.note(t.f, Math.max(0.2, t.d * 15 / bpm(pos) * 1.15));
      lastLane = lane; lastAt = clock; bop = 1;
      next++; n++; K.score(n);
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
      view: () => view,
      peek: () => ({ pos, next, n, mode, lane: chart.length ? tile(next).lane : -1, bpm: bpm(pos), total, count: chart.length }),
      read, tap,
      start() {
        if (!view) build();
        cast(view, 0.85, true);
        face(0);
        song = PN.SONGS.ievan;
        const c = read(song); chart = c.tiles; total = c.len;
        pos = 0; next = 0; n = 0; mode = 'ready'; wait = 0; bad = -1; badTile = -1; lastLane = -1; lastAt = 0; bop = 0;
        el.hidden = false;
        size(); draw();
        A.hush(true);
      },
      stop() { el.hidden = true; A.hush(false); if (view) view.rig.position.y = 0; },
      go() { K.score(0, true); },
      pointer() {},
      key() {},
      update(dt, playing) {
        clock += dt;
        lens(view);
        view.camera.lookAt(0, -2.0, 0);
        bop = Math.max(0, bop - dt * 7);
        view.rig.position.y = Math.sin(bop * PI) * 0.07;
        actor.update(dt, clock, null);
        if (!W) size();
        if (playing && mode === 'play') {
          pos += dt * bpm(pos) / 15;
          const t = tile(next), u = H / SPAN;
          if (H * LINE - (startOf(next) - pos) * u - t.d * u > H) fail(t.lane, next, tr('Missed one!'));
        } else if (playing && mode === 'fail') { wait -= dt; if (wait <= 0) { mode = 'done'; K.over(why); } }
        draw();
      },
    };
  })();

  G.ext.swim = swim; G.ext.stack = stack; G.ext.puff = puff; G.ext.piano = piano; G.ext.toss = toss; G.ext.curl = curl; G.ext.sled = sled; G.ext.bj = bj; G.ext.sauna = sauna;
})(window.PN = window.PN || {});
