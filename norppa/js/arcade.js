/* Pikku Norppa: the arcade. Four mini-games, each on a little stage of its own.
   Swimmy Seal: tap to swim up, slip between the ice and the kelp.
   Snowball Toss: pull back, aim, let go. Knock over the snowmen.
   Curling Seal: slide across the ice and stop on the rings.
   Sled Run: steer down the hill between the trees.
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

  /* A cheap little spruce: three meshes, so a whole hillside of them stays quick. */
  let treeBits = null;
  function tree(k) {
    if (!treeBits) {
      treeBits = { trunk: new T.CylinderGeometry(0.07, 0.1, 0.5, 6), green: new T.ConeGeometry(0.55, 1.5, 8), cap: new T.ConeGeometry(0.37, 0.85, 8) };
    }
    const g = new T.Group();
    g.add(U.mesh(treeBits.trunk, U.mat(PN.COL.woodDark), 0, 0.25, 0), U.mesh(treeBits.green, U.mat(PN.COL.spruce, { roughness: 1 }), 0, 1.1, 0),
      U.mesh(treeBits.cap, U.mat(PN.COL.snow, { roughness: 1 }), 0, 1.52, 0));
    g.scale.setScalar(k || 1);
    return g;
  }

  /* ================= Swimmy Seal ================= */
  const swim = (() => {
    const H = 4.6, CEIL = 3.9, FLOOR = -3.9, R = 0.27, N = 5;
    let view = null, obs = [], bubbles = null, rays = [], drift = [];
    let halfW = 2.2, sx = -1, y = 0, vy = 0, dead = false, lastGapY = 0, score = 0, live = false;

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
    function die() {
      dead = true;
      A.play('thud');
      actor.gesture('surprise', true);
      bubbles.emit(sx, y, 0.3, 12, 1.6, 0.09, 1.1, -2.6);
      K.over(tr(score >= 10 ? 'Wow!' : 'Bonk!'));
    }
    return {
      label: 'Gaps', hint: 'Tap to swim up.',
      view: () => view,
      start() {
        if (!view) build();
        cast(view, 0.37, false);
        actor.g.position.set(0, -0.46, 0);
        face(PI / 2);
        y = 0.3; vy = 0; dead = false; live = false; score = 0; lastGapY = 0;
        bubbles.clear();
        halfW = H * W.aspect;
        obs.forEach((o, i) => place(o, halfW + 3.2 + i * 3.5));
      },
      go() { live = true; flap(); },
      pointer(type) { if (type === 'down') flap(); },
      key(k) { if (k === ' ' || k === 'ArrowUp' || k === 'w') flap(); },
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
            score++; K.score(score); A.play('gulp');
            bubbles.emit(o.x, o.mid, 0.2, 5, 0.9, 0.06, 0.7, -2);
          }
          if (!o.passed && o.x + 0.5 < sx - R) { o.passed = true; score++; K.score(score); A.play('pop'); K.hint(''); }
        });
        bubbles.update(dt, -dx, 0);
        if (live && !dead && rnd() < dt * 2) bubbles.emit(sx + 0.5, y + 0.1, 0.2, 1, 0.2, 0.05, 1, -2.2);
        actor.update(dt, clock, null);
      },
    };
  })();

  /* ================= Snowball Toss ================= */
  const toss = (() => {
    const GRAV = 12, ELEV = 36 * PI / 180, SX = 0, SY = 0.9, SZ = 1.5, CAM_Z = 7.6, AMMO = 12;
    let view = null, targets = [], ball = null, dots = [], puffs = null;
    let ammo = 0, wind = 0, combo = 0, aim = null, flying = false, thrown = 0, score = 0, endT = 0, hh = 0.25;
    const bv = new T.Vector3();

    function build() {
      view = stage('#8cc4f3', '#fff0de', { ground: 0xdde8ff, hemi: 2.2, key: 1.5 });
      const sc = view.scene;
      sc.fog = new T.Fog(0xeef3fa, 22, 62);
      const ground = new T.Mesh(new T.PlaneGeometry(140, 140), U.mat(0xf6f9ff, { roughness: 1 }));
      ground.rotation.x = -PI / 2;
      sc.add(ground);
      for (let i = 0; i < 30; i++) {
        const t = tree(1.6 + rnd() * 1.6);
        const side = i < 20 ? 0 : i % 2 ? 1 : -1;
        if (!side) t.position.set(-19 + i * 2 + rs(0.8), 0, -17 - rnd() * 8);
        else t.position.set(side * (8 + rnd() * 6), 0, -14 + rnd() * 14);
        sc.add(t);
      }
      for (let i = 0; i < 4; i++) {
        const g = PN.Props.decor('snowman').g;
        g.visible = false;
        sc.add(g);
        targets.push({ g, state: 'gone', t: 0.2 + i * 0.25, x: 0, x0: 0, z: 0, moving: false, ph: 0 });
      }
      ball = new T.Mesh(new T.SphereGeometry(0.16, 12, 10), U.mat(0xffffff, { roughness: 1 }));
      ball.visible = false;
      sc.add(ball);
      const dotM = U.glow(0x2f63c9, { transparent: true, opacity: 0.75 });
      for (let i = 0; i < 7; i++) {
        const d = new T.Mesh(new T.SphereGeometry(0.07 - i * 0.004, 8, 6), dotM);
        d.visible = false;
        sc.add(d); dots.push(d);
      }
      puffs = Puffs(sc, 40, 0xffffff, 1);
    }
    function spawn(tg) {
      for (let tries = 0; tries < 10; tries++) {
        const z = -3 - rnd() * 8, maxX = Math.tan(hh) * (CAM_Z - z) * 0.7, x = rs(maxX);
        if (targets.some((o) => o !== tg && o.state !== 'gone' && Math.hypot(o.x0 - x, o.z - z) < 1.7)) continue;
        tg.x0 = tg.x = x; tg.z = z;
        tg.moving = score >= 3 && rnd() < 0.35;
        tg.amp = Math.min(1.2, Math.max(0.3, maxX - Math.abs(x)));
        break;
      }
      tg.ph = rnd() * 6; tg.state = 'in'; tg.t = 0;
      tg.g.visible = true; tg.g.rotation.set(0, 0, 0); tg.g.scale.setScalar(0.01);
      tg.g.position.set(tg.x, 0, tg.z);
    }
    function newWind() {
      if (thrown < 3) wind = 0;
      else { wind = (0.9 + rnd() * 1.9) * (rnd() < 0.5 ? -1 : 1); if (rnd() < 0.15) wind = 0; }
      const n = Math.round(Math.abs(wind) / 0.95);
      K.hint(n ? tr('Wind') + ' ' + (wind > 0 ? '→' : '←').repeat(n) : tr('No wind'));
    }
    function launch() {
      const v = 7.5 + 7 * aim.p, ch = Math.cos(ELEV) * v;
      bv.set(Math.sin(aim.yaw) * ch, Math.sin(ELEV) * v, -Math.cos(aim.yaw) * ch);
      ball.position.set(SX, SY, SZ); ball.visible = true;
      flying = true; ammo--; K.time(ammo);
      A.play('whoosh');
      actor.gesture('boop', true);
    }
    function landed() {
      flying = false; ball.visible = false; thrown++;
      if (thrown % 3 === 0 && ammo > 0) newWind();
      if (ammo <= 0) endT = 0.7;
    }
    return {
      label: 'Points', label2: 'Snowballs', hint: 'Pull back and let go to throw.',
      view: () => view,
      start() {
        if (!view) build();
        cast(view, 0.55, true);
        view.rig.position.set(0, 0, 2.2);
        face(PI);
        ammo = AMMO; wind = 0; combo = 0; aim = null; flying = false; thrown = 0; score = 0; endT = 0;
        K.time(ammo);
        ball.visible = false; puffs.clear();
        dots.forEach((d) => { d.visible = false; });
        targets.forEach((tg, i) => { tg.state = 'gone'; tg.g.visible = false; tg.t = i < 3 ? 0.15 + i * 0.3 : 1e9; tg.x0 = 99; });
      },
      go() { newWind(); },
      pointer(type, x, y) {
        if (type === 'down') { if (!flying && ammo > 0) aim = pull(null, 'down', x, y); return; }
        if (!aim) return;
        pull(aim, type, x, y, 0.6);
        if (type === 'up') { if (aim.p > 0.08) launch(); aim = null; }
      },
      update(dt, playing) {
        clock += dt;
        hh = lens(view);
        view.camera.position.set(0, 3.6, CAM_Z); view.camera.lookAt(0, 1.0, -6);
        // the aim: only the first stretch of the arc is shown, and never the wind
        const show = !!aim && aim.p > 0.03 && playing;
        if (show) {
          const v = 7.5 + 7 * aim.p, ch = Math.cos(ELEV) * v, vy = Math.sin(ELEV) * v;
          dots.forEach((d, i) => {
            const t = (i + 1) * 0.075;
            d.position.set(SX + Math.sin(aim.yaw) * ch * t, SY + vy * t - GRAV * t * t / 2, SZ - Math.cos(aim.yaw) * ch * t);
            d.visible = true;
          });
          face(PI - aim.yaw);
        } else dots.forEach((d) => { d.visible = false; });
        // snowmen come and go
        targets.forEach((tg) => {
          tg.t += dt;
          if (tg.state === 'gone') { if (tg.t > 0.6 && playing && tg.t < 1e8) spawn(tg); return; }
          if (tg.moving && tg.state !== 'down') { tg.x = tg.x0 + Math.sin(clock * 1.7 + tg.ph) * tg.amp; tg.g.position.x = tg.x; }
          if (tg.state === 'in') { tg.g.scale.setScalar(Math.min(1, tg.t / 0.3)); if (tg.t > 0.3) tg.state = 'up'; }
          else if (tg.state === 'down') {
            tg.g.rotation.x = -Math.min(1.45, tg.t * 4.2); tg.g.position.y = -Math.max(0, tg.t - 0.3) * 2.2;
            if (tg.t > 0.75) { tg.state = 'gone'; tg.t = 0; tg.g.visible = false; tg.x0 = 99; }
          }
        });
        // the snowball
        if (flying) {
          const steps = 2, h = dt / steps;
          for (let s = 0; s < steps && flying; s++) {
            bv.x += wind * h; bv.y -= GRAV * h;
            ball.position.addScaledVector(bv, h);
            const p = ball.position;
            for (let i = 0; i < targets.length; i++) {
              const tg = targets[i];
              if (tg.state !== 'up' && tg.state !== 'in') continue;
              if (p.y < 1.75 && Math.hypot(p.x - tg.x, p.z - tg.z) < 0.5) {
                const d = SZ - tg.z, pts = (d > 10.5 ? 3 : d > 7.5 ? 2 : 1) + (tg.moving ? 2 : 0) + Math.min(3, combo);
                combo++; score += pts;
                K.score(score); K.big('+' + pts);
                A.play('match'); A.play('thud');
                puffs.emit(p.x, p.y, p.z, 12, 2.2, 0.13, 0.6, 6);
                tg.state = 'down'; tg.t = 0;
                if (combo > 1) actor.gesture('happy');
                landed();
                break;
              }
            }
            if (flying && p.y < 0.16) {
              puffs.emit(p.x, 0.15, p.z, 6, 1.2, 0.1, 0.45, 5);
              A.play('tap');
              combo = 0;
              landed();
            }
          }
        }
        if (endT > 0 && playing) { endT -= dt; if (endT <= 0) K.over(tr(score >= 12 ? 'Wow!' : 'Time!')); }
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
    let view = null, gtex = null, board = null, puffs = null;
    const pool = { tree: [], rock: [], fish: [], ramp: [] };
    let live = [], track = 2.1, x = 0, tx = 0, vx = 0, dist = 0, bonus = 0, rowAt = 0, free = 2, air = 0, dead = false, going = false, shown = -1, rows = 0, spray = 0;

    function build() {
      view = stage('#84bcf0', '#f7fbff', { ground: 0xdde8ff, hemi: 2.2, key: 1.5 });
      const sc = view.scene;
      sc.fog = new T.Fog(0xf1f6fd, 24, 54);
      gtex = U.tex(256, 256, (c, w, h) => {
        c.fillStyle = '#f7faff'; c.fillRect(0, 0, w, h);
        for (let i = 0; i < 90; i++) {
          c.fillStyle = 'rgba(150,185,230,' + (0.1 + rnd() * 0.22) + ')';
          c.beginPath(); c.ellipse(rnd() * w, rnd() * h, 2 + rnd() * 5, 6 + rnd() * 16, 0, 0, PI * 2); c.fill();
        }
      });
      gtex.wrapS = gtex.wrapT = T.RepeatWrapping; gtex.repeat.set(9, REP);
      const ground = new T.Mesh(new T.PlaneGeometry(60, LEN), new T.MeshStandardMaterial({ map: gtex, roughness: 1 }));
      ground.rotation.x = -PI / 2; ground.position.z = -LEN / 2 + 12;
      sc.add(ground);
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

  G.ext.swim = swim; G.ext.toss = toss; G.ext.curl = curl; G.ext.sled = sled;
})(window.PN = window.PN || {});
