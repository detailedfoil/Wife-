/* Pikku Norppa: little floating things. Hearts, sparkles, bubbles, snoozes, splashes, smoke. */
(function (PN) {
  'use strict';
  const T = THREE, U = PN.U, TAU = Math.PI * 2;
  const tex = {};

  function shapes() {
    const mk = (name, draw) => { tex[name] = U.tex(64, 64, draw); };
    mk('heart', (g) => {
      g.fillStyle = '#ff5f8a';
      g.beginPath(); g.moveTo(32, 55); g.bezierCurveTo(2, 34, 7, 9, 21, 9); g.bezierCurveTo(27, 9, 32, 14, 32, 20);
      g.bezierCurveTo(32, 14, 37, 9, 43, 9); g.bezierCurveTo(57, 9, 62, 34, 32, 55); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.ellipse(21, 20, 5, 3.4, -0.6, 0, TAU); g.fill();
    });
    mk('star', (g) => {
      g.fillStyle = '#fff3b0'; g.beginPath();
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, r = i % 2 ? 8 : 29; g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); }
      g.closePath(); g.fill();
    });
    mk('zzz', (g) => {
      g.lineCap = 'round'; g.lineJoin = 'round';
      g.strokeStyle = 'rgba(20,35,80,0.55)'; g.lineWidth = 15; g.beginPath(); g.moveTo(17, 17); g.lineTo(47, 17); g.lineTo(17, 47); g.lineTo(47, 47); g.stroke();
      g.strokeStyle = '#eaf3ff'; g.lineWidth = 9; g.stroke();
    });
    mk('bubble', (g) => {
      g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 3; g.beginPath(); g.arc(32, 32, 26, 0, TAU); g.stroke();
      g.fillStyle = 'rgba(200,235,255,0.22)'; g.fill();
      g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.ellipse(22, 21, 6, 4, -0.7, 0, TAU); g.fill();
    });
    mk('puff', (g) => {
      const r = g.createRadialGradient(32, 32, 0, 32, 32, 30);
      r.addColorStop(0, 'rgba(255,255,255,0.95)'); r.addColorStop(0.55, 'rgba(255,255,255,0.5)'); r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r; g.fillRect(0, 0, 64, 64);
    });
    mk('drop', (g) => {
      g.fillStyle = '#9fdcff'; g.beginPath(); g.moveTo(32, 6); g.bezierCurveTo(50, 30, 52, 44, 32, 56); g.bezierCurveTo(12, 44, 14, 30, 32, 6); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.ellipse(26, 38, 4, 7, 0.3, 0, TAU); g.fill();
    });
    mk('note', (g) => {
      g.fillStyle = '#ffd86b'; g.beginPath(); g.ellipse(24, 46, 11, 8, -0.4, 0, TAU); g.fill();
      g.fillRect(31, 12, 5, 34); g.beginPath(); g.moveTo(36, 12); g.quadraticCurveTo(52, 16, 50, 32); g.quadraticCurveTo(46, 22, 36, 22); g.fill();
    });
    mk('huff', (g) => {
      g.strokeStyle = '#eaf3ff'; g.lineWidth = 6; g.lineCap = 'round';
      [[14, 20, 30, 14], [12, 34, 32, 34], [14, 48, 30, 54]].forEach((l) => { g.beginPath(); g.moveTo(l[0], l[1]); g.lineTo(l[2], l[3]); g.stroke(); });
    });
    mk('coin', (g) => {
      g.fillStyle = '#f2b01e'; g.beginPath(); g.arc(32, 32, 26, 0, TAU); g.fill();
      g.fillStyle = '#ffd95c'; g.beginPath(); g.arc(32, 32, 20, 0, TAU); g.fill();
      g.fillStyle = '#f2b01e'; g.beginPath(); g.moveTo(32, 18); g.lineTo(36, 28); g.lineTo(46, 32); g.lineTo(36, 36); g.lineTo(32, 46); g.lineTo(28, 36); g.lineTo(18, 32); g.lineTo(28, 28); g.closePath(); g.fill();
    });
  }

  const pool = [];
  const FX = PN.FX = {
    init(scene) {
      shapes();
      for (let i = 0; i < 110; i++) {
        const s = new T.Sprite(new T.SpriteMaterial({ transparent: true, depthWrite: false, toneMapped: false, fog: false }));
        s.visible = false; s.renderOrder = 5;
        scene.add(s);
        pool.push({ s, on: false, v: new T.Vector3() });
      }
    },
    /* type, where (Vector3), options: v [x,y,z], life, size, end, g (gravity), drag, spin, fade ('out' or 'io'), color, add */
    spawn(type, pos, o) {
      o = o || {};
      let p = null;
      for (let i = 0; i < pool.length; i++) if (!pool[i].on) { p = pool[i]; break; }
      if (!p) return;
      const m = p.s.material;
      m.map = tex[type]; m.color.setHex(o.color == null ? 0xffffff : o.color);
      m.blending = o.add ? T.AdditiveBlending : T.NormalBlending;
      m.rotation = o.rot || 0; m.needsUpdate = true;
      p.on = true; p.age = 0; p.life = o.life || 1.2; p.size = o.size || 0.3; p.end = o.end == null ? p.size : o.end;
      p.g = o.g || 0; p.drag = o.drag || 0; p.spin = o.spin || 0; p.fade = o.fade || 'out'; p.alpha = o.alpha == null ? 1 : o.alpha;
      p.wob = o.wob || 0; p.ph = Math.random() * TAU;
      p.s.position.copy(pos);
      const v = o.v || [0, 0, 0];
      p.v.set(v[0], v[1], v[2]);
      p.s.visible = true; p.s.scale.setScalar(0.001);
    },
    update(dt) {
      for (let i = 0; i < pool.length; i++) {
        const p = pool[i];
        if (!p.on) continue;
        p.age += dt;
        const k = p.age / p.life;
        if (k >= 1) { p.on = false; p.s.visible = false; continue; }
        p.v.y += p.g * dt;
        if (p.drag) p.v.multiplyScalar(Math.exp(-p.drag * dt));
        p.s.position.addScaledVector(p.v, dt);
        if (p.wob) p.s.position.x += Math.sin(p.age * 3 + p.ph) * p.wob * dt;
        const pop = Math.min(1, k * 8);
        p.s.scale.setScalar(U.lerp(p.size, p.end, k) * pop);
        p.s.material.opacity = p.alpha * (p.fade === 'io' ? Math.sin(k * Math.PI) : 1 - k * k * k);
        p.s.material.rotation += p.spin * dt;
      }
    },
    clear() { pool.forEach((p) => { p.on = false; p.s.visible = false; }); },

    /* ready-made bursts */
    hearts(pos, n) {
      for (let i = 0; i < (n || 1); i++) FX.spawn('heart', pos.clone().add(rv(0.35, 0.15, 0.2)), { v: [rs(0.35), 0.75 + Math.random() * 0.5, rs(0.1)], life: 1.3 + Math.random() * 0.5, size: 0.24 + Math.random() * 0.14, end: 0.34, wob: 0.6, rot: rs(0.4) });
    },
    sparkle(pos, n, color) {
      for (let i = 0; i < (n || 6); i++) FX.spawn('star', pos.clone().add(rv(0.5, 0.4, 0.3)), { v: [rs(1.2), 0.6 + Math.random() * 1.3, rs(0.6)], g: -1.2, life: 0.7 + Math.random() * 0.6, size: 0.14 + Math.random() * 0.16, end: 0.02, spin: rs(5), color, add: true });
    },
    zzz(pos) { FX.spawn('zzz', pos, { v: [0.22, 0.42, 0], life: 2.6, size: 0.18, end: 0.42, fade: 'io', wob: 0.5, rot: -0.2 }); },
    bubbles(pos, n) {
      for (let i = 0; i < (n || 3); i++) FX.spawn('bubble', pos.clone().add(rv(0.3, 0.2, 0.2)), { v: [rs(0.4), 0.5 + Math.random() * 0.7, rs(0.2)], life: 1 + Math.random() * 0.8, size: 0.1 + Math.random() * 0.2, end: 0.32, wob: 0.8, fade: 'io' });
    },
    puff(pos, n, color, size) {
      for (let i = 0; i < (n || 5); i++) FX.spawn('puff', pos.clone().add(rv(0.2, 0.08, 0.2)), { v: [rs(1.1), 0.3 + Math.random() * 0.7, rs(1.1)], drag: 2.5, life: 0.7 + Math.random() * 0.5, size: (size || 0.35) * (0.7 + Math.random() * 0.6), end: (size || 0.35) * 1.8, color, alpha: 0.8 });
    },
    splash(pos, n) {
      for (let i = 0; i < (n || 12); i++) { const a = Math.random() * TAU, sp = 0.6 + Math.random() * 1.4; FX.spawn('drop', pos.clone(), { v: [Math.cos(a) * sp, 2.2 + Math.random() * 2, Math.sin(a) * sp], g: -8, life: 0.7 + Math.random() * 0.3, size: 0.1 + Math.random() * 0.1, end: 0.05 }); }
      FX.puff(pos, 4, 0xdff3ff, 0.5);
    },
    smoke(pos, color) { FX.spawn('puff', pos.clone().add(rv(0.06, 0, 0.06)), { v: [0.12 + rs(0.08), 0.5, rs(0.06)], life: 3.2, size: 0.22, end: 0.95, color: color == null ? 0xd9dee8 : color, alpha: 0.5, fade: 'io' }); },
    steam(pos) { FX.spawn('puff', pos.clone().add(rv(0.3, 0.1, 0.3)), { v: [rs(0.2), 0.6 + Math.random() * 0.4, rs(0.2)], life: 1.8, size: 0.25, end: 0.8, alpha: 0.55, fade: 'io' }); },
    notes(pos) { FX.spawn('note', pos.clone().add(rv(0.3, 0.1, 0.1)), { v: [rs(0.4), 0.7, 0], life: 1.6, size: 0.26, end: 0.3, wob: 0.9, rot: rs(0.3) }); },
    huff(pos, dir) { FX.spawn('huff', pos, { v: [0.5 * (dir || 1), 0.25, 0], life: 0.9, size: 0.3, end: 0.42, rot: dir < 0 ? Math.PI : 0 }); },
    coins(pos, n) {
      for (let i = 0; i < (n || 4); i++) FX.spawn('coin', pos.clone().add(rv(0.2, 0.1, 0.1)), { v: [rs(1.4), 2.2 + Math.random() * 1.4, rs(0.5)], g: -6.5, life: 0.9 + Math.random() * 0.3, size: 0.2, end: 0.16 });
    },
    spark(pos) { FX.spawn('puff', pos.clone().add(rv(0.12, 0, 0.12)), { v: [rs(0.4), 1.2 + Math.random() * 0.8, rs(0.4)], life: 0.9 + Math.random() * 0.5, size: 0.07, end: 0.02, color: 0xffa040, add: true }); },
    breath(pos, dirx, dirz) { FX.spawn('puff', pos, { v: [dirx * 0.35, 0.12, dirz * 0.35], life: 1.3, size: 0.1, end: 0.42, alpha: 0.4, fade: 'io' }); },
  };
  const rs = (k) => (Math.random() - 0.5) * 2 * k;
  const rv = (x, y, z) => new T.Vector3(rs(x), rs(y), rs(z));
})(window.PN = window.PN || {});
