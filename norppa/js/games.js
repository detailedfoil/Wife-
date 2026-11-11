/* Pikku Norppa: the three mini-games.
   Fish Rain: slide the seal about to catch falling fish.
   Nose Ball: keep the ball in the air.
   Fish Pairs: a memory game that teaches the fish their Finnish names. */
(function (PN) {
  'use strict';
  const T = THREE, U = PN.U, W = PN.World, S = PN.Sim, D = PN.DATA, UI = PN.UI, FX = PN.FX, A = PN.Audio;
  const $ = (id) => document.getElementById(id);
  const Games = PN.Games = { active: null };

  const LANE_Z = 0.6;          // the seal slides along this line, facing the camera
  const HALF = 2.5;            // how far it can go either way
  const GAME_LEN = 40;         // seconds of Fish Rain
  const FISH_W = [0, 60, 24, 10, 4, 1.2];
  const v1 = new T.Vector3(), look = new T.Vector3();
  const rs = (k) => (Math.random() - 0.5) * 2 * k;
  let g = null;                // the game in play
  let bound = false;

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const x = a[i]; a[i] = a[j]; a[j] = x; }
    return a;
  }
  function big(text) {
    const el = $('gBig');
    el.textContent = text;
    el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
  }
  function setScore(n) {
    const el = $('gScore');
    el.textContent = n;
    el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
  }

  /* One model of each fish is built once, then copied for every fish that falls. */
  const fishModels = {};
  function fishCopy(id) {
    if (!fishModels[id]) fishModels[id] = PN.Props.fish(PN.items[id].look);
    return fishModels[id].clone();
  }
  let snowGeo = null;
  function snowball() {
    if (!snowGeo) snowGeo = new T.SphereGeometry(0.27, 14, 10);
    const m = new T.Mesh(snowGeo, U.mat(0xffffff, { roughness: 1 }));
    m.castShadow = true;
    return m;
  }
  function pickFish() {
    const list = D.FISH;
    let total = 0;
    list.forEach((f) => { total += FISH_W[f.rarity]; });
    let r = Math.random() * total;
    for (let i = 0; i < list.length; i++) { r -= FISH_W[list[i].rarity]; if (r <= 0) return list[i]; }
    return list[0];
  }

  function bind() {
    if (bound) return;
    bound = true;
    $('gQuit').addEventListener('click', () => { A.play('tap'); if (g && g.id !== 'pairs') finish(true); });
    $('pairsQuit').addEventListener('click', () => { A.play('tap'); if (g && g.id === 'pairs') finish(true); });
    $('pairsGrid').addEventListener('click', onCard);
    window.addEventListener('keydown', (e) => {
      if (!g || g.id === 'pairs') return;
      if (e.key === 'ArrowLeft' || e.key === 'a') g.keyL = 1;
      else if (e.key === 'ArrowRight' || e.key === 'd') g.keyR = 1;
    });
    window.addEventListener('keyup', (e) => {
      if (!g) return;
      if (e.key === 'ArrowLeft' || e.key === 'a') g.keyL = 0;
      else if (e.key === 'ArrowRight' || e.key === 'd') g.keyR = 0;
    });
  }

  Games.start = function (id) {
    if (Games.active) return;
    bind();
    Games.active = id;
    UI.closeSheet();
    UI.setBubble(null);
    if (id === 'pairs') { startPairs(); return; }
    const seal = PN.Game.seal;
    UI.showHud(false);
    $('gamehud').hidden = false;
    $('gScoreLabel').textContent = id === 'catch' ? 'Fish' : 'Bounces';
    $('gTimeWrap').hidden = id !== 'catch';
    $('gScore').textContent = '0';
    $('gTime').textContent = GAME_LEN;
    $('gBig').textContent = '';
    $('gHint').textContent = id === 'catch' ? 'Slide left and right to catch the fish. Mind the snowballs.' : 'Slide to get under the ball. Keep it off the snow.';
    W.setCamMode('game');
    W.stage(true);
    W.ball.visible = false;
    seal.sulk = false; seal.petting = 0;
    seal.moveTo(0, LANE_Z, { speed: 3.2, face: 0 });
    g = { id, seal, phase: 'count', clock: 0, said: -1, tx: 0, vx: 0, score: 0, time: GAME_LEN, items: [], caught: {}, spawn: 0.5, stun: 0,
      keyL: 0, keyR: 0, z: LANE_Z, lastTick: 99, b: null };
  };

  /* A finger on the screen says where the seal should go. */
  Games.pointer = function (type, x, y) {
    if (!g || g.id === 'pairs' || type === 'up') return;
    const ray = W.rayAt(x, y);
    const k = (LANE_Z - ray.origin.z) / ray.direction.z;
    g.tx = U.clamp(ray.origin.x + ray.direction.x * k, -HALF, HALF);
  };

  Games.update = function (dt) {
    if (!g || g.id === 'pairs') return;
    const s = g.seal;
    g.clock += dt;
    if (g.phase === 'count') {
      const n = Math.floor(g.clock / 0.75);
      if (n !== g.said && n < 4) {
        g.said = n;
        if (n < 3) { big(String(3 - n)); A.play('tick'); }
        else {
          big('Go!'); A.play('go');
          g.phase = 'play'; g.clock = 0;
          s.halt(); s.g.position.z = LANE_Z; s.heading = 0;
          g.tx = s.g.position.x;
          s.mouthA.getWorldPosition(v1); g.z = v1.z;
          if (g.id === 'ball') {
            g.b = { x: s.g.position.x, y: Math.min(7.5, skyTop() - 1.5), vx: 0, vy: 0 };
            W.ball.visible = true; W.ball.scale.setScalar(1.5);
          }
        }
      }
      s.look = W.camera.position;
      return;
    }
    if (g.phase === 'play') {
      if (g.clock > 0.8 && $('gBig').textContent) $('gBig').textContent = '';
      if (g.clock > 6 && $('gHint').textContent) $('gHint').textContent = '';
      steer(dt);
      if (g.id === 'catch') updateCatch(dt); else updateBall(dt);
    } else if (g.phase === 'over') {
      if (g.id === 'catch') fall(dt, true);
      if (g.clock > 1.15) finish(false);
    }
  };

  function steer(dt) {
    const s = g.seal;
    const key = g.keyR - g.keyL;
    if (key) g.tx = U.clamp(g.tx + key * 7 * dt, -HALF, HALF);
    if (g.stun > 0) { g.stun -= dt; g.vx = 0; }
    else {
      const px = s.g.position.x, want = U.damp(px, g.tx, 16, dt);
      const step = U.clamp(want - px, -10 * dt, 10 * dt);
      s.g.position.x = px + step;
      g.vx = step / Math.max(dt, 0.001);
    }
    s.g.position.z = LANE_Z;
    s.heading = U.clamp(g.vx * 0.08, -0.55, 0.55);
  }

  /* ---------- Fish Rain ---------- */
  function spawnCatch(prog) {
    const isBall = g.clock > 7 && Math.random() < 0.13;
    const holder = new T.Group();
    let it;
    if (isBall) {
      holder.add(snowball());
      it = { m: holder, ball: true, v: 4.2 + prog * 1.6, spin: 0 };
    } else {
      const f = pickFish(), model = fishCopy(f.id);
      holder.add(model);
      holder.rotation.z = -Math.PI / 2 + rs(0.35);          // nose down
      holder.scale.setScalar(1.75);
      it = { m: holder, id: f.id, gold: f.rarity === 5, v: 2.9 + prog * 2.3 + Math.random() * 0.9, spin: rs(5), inner: model };
    }
    const x = U.clamp(g.seal.g.position.x + rs(3.4), -HALF, HALF);
    holder.position.set(x, skyTop(), g.z);
    W.scene.add(holder);
    g.items.push(it);
  }
  /* Just above the top edge of the screen, whatever shape the screen is. */
  const skyTop = () => W.cam.ty + Math.tan(W.camera.fov * Math.PI / 360) * W.cam.dist + 0.7;
  function drop(i) {
    W.scene.remove(g.items[i].m);
    g.items.splice(i, 1);
  }
  /* Everything in the air keeps falling. quiet: the game is over, so nothing can be caught. */
  function fall(dt, quiet) {
    const s = g.seal, size = s.size;
    s.mouthA.getWorldPosition(v1);
    const mx = v1.x, my = v1.y;
    let lowest = null;
    for (let i = g.items.length - 1; i >= 0; i--) {
      const it = g.items[i], p = it.m.position;
      p.y -= it.v * dt;
      if (it.inner) it.inner.rotation.x += it.spin * dt;
      const reach = it.ball ? 0.42 * size + 0.3 : 0.5 * size + 0.34;
      if (!quiet && g.stun <= 0 && p.y < my + 0.5 && p.y > my - 0.45 * size - 0.25 && Math.abs(p.x - mx) < reach) {
        if (it.ball) {
          g.stun = 0.9;
          s.gesture('shake', true); A.play('thud'); A.play('sneeze');
          FX.puff(p, 8, 0xffffff, 0.45);
          big('Bonk!');
          g.bigAt = g.clock;
        } else {
          g.score += it.gold ? 3 : 1;
          g.caught[it.id] = (g.caught[it.id] || 0) + 1;
          setScore(g.score);
          s.gesture('gulp', true);
          A.play(it.gold ? 'sparkle' : 'gulp'); A.play('squeak', 0.5);
          FX.sparkle(p, it.gold ? 14 : 4, it.gold ? 0xffd45c : undefined);
        }
        drop(i);
        continue;
      }
      const floor = W.groundY(p.x, LANE_Z) + 0.12;
      if (p.y < floor) {
        FX.puff(v1.set(p.x, floor, p.z), 3, 0xffffff, 0.28);
        drop(i);
        s.mouthA.getWorldPosition(v1);
        continue;
      }
      if (!it.ball && p.y > my && (!lowest || p.y < lowest.y)) lowest = p;
    }
    if (lowest) s.look = look.set(lowest.x, lowest.y, g.z + 2.5);
    else s.look = W.camera.position;
  }
  function updateCatch(dt) {
    g.time -= dt;
    const left = Math.max(0, g.time), prog = 1 - left / GAME_LEN;
    const whole = Math.ceil(left);
    if (whole !== g.lastTick) {
      g.lastTick = whole;
      $('gTime').textContent = whole;
      if (whole <= 5 && whole > 0) A.play('tick');
    }
    if (g.bigAt != null && g.clock - g.bigAt > 0.7) { $('gBig').textContent = ''; g.bigAt = null; }
    g.spawn -= dt;
    if (g.spawn <= 0 && g.time > 1.2) {
      g.spawn = U.lerp(0.9, 0.46, prog) * (0.75 + Math.random() * 0.5);
      spawnCatch(prog);
    }
    fall(dt, false);
    if (g.time <= 0) { g.phase = 'over'; g.clock = 0; big('Time!'); A.play('go'); }
  }

  /* ---------- Nose Ball ---------- */
  function updateBall(dt) {
    const s = g.seal, b = g.b, R = 0.36;
    b.vy -= 7.2 * dt;
    b.x += b.vx * dt; b.y += b.vy * dt;
    const wall = HALF + 0.35;
    if (b.x > wall) { b.x = wall; b.vx = -Math.abs(b.vx); A.play('tap', 0.1); }
    else if (b.x < -wall) { b.x = -wall; b.vx = Math.abs(b.vx); A.play('tap', 0.1); }
    s.noseA.getWorldPosition(v1);
    const top = v1.y + 0.1 * s.size, nx = v1.x, nz = v1.z;
    if (b.vy < 0 && b.y - R < top && b.y - R > top - 0.6 && Math.abs(b.x - nx) < 0.45 * s.size + 0.42) {
      g.score++;
      setScore(g.score);
      b.y = top + R;
      b.vy = 6.5 + Math.random() * 0.9;
      b.vx = U.clamp((b.x - nx) * 3.3 + g.vx * 0.28 + rs(0.5 + Math.min(1.7, g.score * 0.06)), -3.7, 3.7);
      s.gesture('boop', true);
      A.play('boing');
      FX.sparkle(v1.set(b.x, b.y - R, nz), 3);
      if (g.score % 10 === 0) { A.play('chirp'); big(String(g.score) + '!'); g.bigAt = g.clock; }
    }
    if (g.bigAt != null && g.clock - g.bigAt > 0.7) { $('gBig').textContent = ''; g.bigAt = null; }
    const floor = W.groundY(b.x, LANE_Z) + R;
    const m = W.ball;
    m.position.set(b.x, Math.max(b.y, floor), nz);
    m.rotation.z -= b.vx * dt * 1.6; m.rotation.x += dt * 1.3;
    s.look = look.set(b.x, b.y, nz + 2.5);
    if (b.y <= floor) {
      A.play('thud');
      FX.puff(v1.set(b.x, floor - R + 0.05, nz), 6, 0xffffff, 0.4);
      s.gesture('surprise', true);
      g.phase = 'over'; g.clock = 0;
      big(g.score >= 10 ? 'Wow!' : 'Oops!');
    }
  }

  /* ---------- Fish Pairs ---------- */
  function startPairs() {
    const st = PN.Game.state;
    const pool = shuffle(D.FISH.filter((f) => st.fish[f.id] || f.rarity <= 2).map((f) => f.id)).slice(0, 8);
    const cards = shuffle(pool.concat(pool));
    g = { id: 'pairs', score: 0, open: [], found: 0, lock: false, caught: {} };
    $('pairsGrid').innerHTML = cards.map((id, i) => '<button class="pcard" data-id="' + id + '" aria-label="Card ' + (i + 1) + '"><span class="back"></span><span class="front"><img src="'
      + PN.Thumbs.get(id) + '" alt=""></span></button>').join('');
    $('pairsTurns').textContent = '0 turns';
    $('pairsWord').textContent = 'Find two of the same fish.';
    $('pairs').hidden = false;
  }
  function onCard(e) {
    const c = e.target.closest('.pcard');
    if (!c || !g || g.id !== 'pairs' || g.lock || c.classList.contains('up')) return;
    c.classList.add('up');
    A.play('flip');
    g.open.push(c);
    if (g.open.length < 2) return;
    const a = g.open[0], b = g.open[1];
    g.open = [];
    g.score++;
    $('pairsTurns').textContent = g.score + (g.score === 1 ? ' turn' : ' turns');
    if (a.dataset.id === b.dataset.id) {
      const it = PN.items[a.dataset.id];
      a.classList.add('done'); b.classList.add('done');
      g.found++;
      A.play('match');
      $('pairsWord').innerHTML = '<b>' + UI.esc(it.fi) + '</b> is ' + UI.esc(it.en.toLowerCase()) + '.';
      if (g.found === 8) { g.lock = true; setTimeout(() => { if (g && g.id === 'pairs') finish(false); }, 950); }
    } else {
      g.lock = true;
      setTimeout(() => { a.classList.remove('up'); b.classList.remove('up'); if (g) g.lock = false; }, 820);
    }
  }

  /* ---------- the end of any game ---------- */
  function finish(quit) {
    const id = g.id, score = g.score, caught = g.caught;
    (g.items || []).forEach((it) => W.scene.remove(it.m));
    g = null;
    Games.active = null;
    $('gamehud').hidden = true;
    $('pairs').hidden = true;
    let reward = null;
    const counts = id === 'pairs' ? !quit : !(quit && score === 0);
    if (counts) reward = S.gameReward(PN.Game.state, id, score, caught);
    PN.Game.endGame(id, score, reward);
  }
})(window.PN = window.PN || {});
