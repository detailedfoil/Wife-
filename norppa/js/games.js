/* Pikku Norppa: the mini-games.
   Fish Rain: slide the seal about to catch falling fish.
   Nose Ball: keep the ball in the air.
   The rest live in arcade.js and plug in through Games.ext. */
(function (PN) {
  'use strict';
  const T = THREE, U = PN.U, W = PN.World, S = PN.Sim, D = PN.DATA, UI = PN.UI, FX = PN.FX, A = PN.Audio, tr = PN.L;
  const $ = (id) => document.getElementById(id);
  const Games = PN.Games = { active: null, ext: {} };

  const LANE_Z = 0.6;          // the seal slides along this line, facing the camera
  const HALF = 2.5;            // how far it can go either way
  const GAME_LEN = 40;         // seconds of Fish Rain
  const FISH_W = [0, 64, 22, 8, 2.5, 0.7];
  const v1 = new T.Vector3(), look = new T.Vector3();
  const rs = (k) => (Math.random() - 0.5) * 2 * k;
  let g = null;                // the game in play
  let bound = false;

  function big(text) {
    const el = $('gBig');
    if (g) g.bigAt = g.clock;
    el.textContent = text;
    el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
  }
  function setScore(n) {
    const el = $('gScore');
    el.textContent = n;
    el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
  }

  /* What the arcade games use to talk to the screen. */
  Games.kit = {
    big,
    score(n, quiet) { if (!g) return; g.score = n; if (quiet) $('gScore').textContent = n; else setScore(n); },
    time(v) { $('gTime').textContent = v; },
    hint(text) { $('gHint').textContent = text; },
    over(text) { if (g && g.phase === 'play') { g.phase = 'over'; g.clock = 0; big(text); } },
    keys: () => (g ? g.keyR - g.keyL : 0),
    shown(n) { setScore(n); },                       // change the number on screen, not the result
    result(n) { if (g) g.score = n; },              // what the game will pay out for
  };

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
    $('gQuit').addEventListener('click', () => { A.play('tap'); if (g) finish(true); });
    window.addEventListener('keydown', (e) => {
      if (!g) return;
      if (g.ext && g.ext.key && g.phase === 'play' && !e.repeat) g.ext.key(e.key);
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
    const seal = PN.Game.seal, ext = Games.ext[id];
    UI.showHud(false);
    $('gamehud').hidden = false;
    $('gScoreLabel').textContent = ext ? tr(ext.label) : tr(id === 'catch' ? 'label|Fish' : 'Bounces');
    $('gTimeWrap').hidden = ext ? !ext.label2 : id !== 'catch';
    $('gTimeLabel').textContent = tr((ext && ext.label2) || 'Time');
    $('gScore').textContent = '0';
    const quit = $('gQuit');
    if (ext && ext.back) { quit.classList.add('back'); quit.innerHTML = UI.ic('back') + tr(ext.backLabel || 'Back'); quit.setAttribute('aria-label', tr(ext.backLabel || 'Back')); }
    else if (quit.classList.contains('back')) { quit.classList.remove('back'); quit.innerHTML = UI.ic('close'); quit.setAttribute('aria-label', tr('Stop the game')); }
    $('gTime').textContent = GAME_LEN;
    $('gBig').textContent = '';
    $('gHint').textContent = ext ? tr(ext.hint) : tr(id === 'catch' ? 'Slide left and right to catch the fish. Mind the snowballs.' : 'Slide to get under the ball. Keep it off the snow.');
    if (ext) {
      g = { id, ext, seal, phase: 'count', clock: 0, said: -1, score: 0, items: [], caught: {}, keyL: 0, keyR: 0, secs: 0 };
      ext.start();
      W.override = ext.view();
      return;
    }
    W.setCamMode('game');
    W.stage(true);
    W.ball.visible = false;
    seal.sulk = false; seal.petting = 0;
    seal.moveTo(0, LANE_Z, { speed: 3.2, face: 0 });
    g = { id, seal, phase: 'count', clock: 0, said: -1, tx: 0, vx: 0, score: 0, time: GAME_LEN, items: [], caught: {}, spawn: 0.5, stun: 0,
      keyL: 0, keyR: 0, z: LANE_Z, lastTick: 99, b: null, secs: 0 };
  };

  /* A finger on the screen says where the seal should go. */
  Games.pointer = function (type, x, y) {
    if (!g) return;
    if (g.ext) { if (g.phase === 'play') g.ext.pointer(type, x, y); return; }
    if (type === 'up') return;
    const ray = W.rayAt(x, y);
    const k = (LANE_Z - ray.origin.z) / ray.direction.z;
    g.tx = U.clamp(ray.origin.x + ray.direction.x * k, -HALF, HALF);
  };

  Games.update = function (dt) {
    if (!g) return;
    const s = g.seal;
    g.clock += dt; g.secs += dt;          // how long the game has lasted: what it costs in energy
    if (g.ext) { updateExt(dt); return; }
    if (g.phase === 'count') {
      const n = Math.floor(g.clock / 0.75);
      if (n !== g.said && n < 4) {
        g.said = n;
        if (n < 3) { big(String(3 - n)); A.play('tick'); }
        else {
          big(tr('Go!')); A.play('go');
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

  /* An arcade game: the same count-in and ending, the game itself runs its own stage. */
  function updateExt(dt) {
    if (g.phase === 'count' && g.ext.nocount) { g.phase = 'play'; g.clock = 0; g.ext.go(); }
    if (g.phase === 'count') {
      const n = Math.floor(g.clock / 0.75);
      if (n !== g.said && n < 4) {
        g.said = n;
        if (n < 3) { big(String(3 - n)); A.play('tick'); }
        else { big(tr('Go!')); A.play('go'); g.phase = 'play'; g.clock = 0; g.ext.go(); }
      }
    }
    if (g.bigAt != null && g.phase === 'play' && g.clock - g.bigAt > 0.8) { $('gBig').textContent = ''; g.bigAt = null; }
    g.ext.update(dt, g.phase === 'play');
    if (g.phase === 'over' && g.clock > 1.4) finish(false);
  }

  function steer(dt) {
    const s = g.seal;
    const key = g.keyR - g.keyL;
    if (key) g.tx = U.clamp(g.tx + key * 7 * dt, -HALF, HALF);
    if (g.stun > 0) { g.stun -= dt; g.vx = 0; }
    else {
      const px = s.g.position.x, want = U.damp(px, g.tx, 12, dt);
      const step = U.clamp(want - px, -7.5 * dt, 7.5 * dt);
      s.g.position.x = px + step;
      g.vx = step / Math.max(dt, 0.001);
    }
    s.g.position.z = LANE_Z;
    s.heading = U.clamp(g.vx * 0.08, -0.55, 0.55);
  }

  /* ---------- Fish Rain ---------- */
  function spawnCatch(prog) {
    const isBall = g.clock > 3 && Math.random() < 0.17 + 0.2 * prog;
    const holder = new T.Group();
    let it;
    if (isBall) {
      holder.add(snowball());
      it = { m: holder, ball: true, v: 5.4 + prog * 2.6, spin: 0 };
    } else {
      const f = pickFish(), model = fishCopy(f.id);
      holder.add(model);
      holder.rotation.z = -Math.PI / 2 + rs(0.35);          // nose down
      holder.scale.setScalar(1.75);
      it = { m: holder, id: f.id, gold: f.rarity === 5, v: 3.9 + prog * 3.5 + Math.random() * 1.2, spin: rs(5), inner: model };
      // Later on, some fish wriggle from side to side on the way down.
      if (prog > 0.2 && Math.random() < 0.35 + 0.55 * prog) { it.sway = 0.4 + Math.random() * 0.7 * prog; it.swayF = 2 + Math.random() * 2.2; it.swayP = Math.random() * 6.3; }
    }
    const x = U.clamp(g.seal.g.position.x + rs(3.4), -HALF, HALF);
    it.x0 = x;
    holder.position.set(x, skyTop(), g.z);
    W.scene.add(holder);
    g.items.push(it);
  }
  /* A snowball knocks the last fish caught back out of the score. */
  function dropOne() {
    if (g.score <= 0) return false;
    g.score--;
    const ids = Object.keys(g.caught).filter((k) => g.caught[k] > 0 && PN.items[k].rarity < 5);
    if (ids.length) { const k = ids[Math.floor(Math.random() * ids.length)]; g.caught[k]--; if (!g.caught[k]) delete g.caught[k]; }
    return true;
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
      if (it.sway) p.x = U.clamp(it.x0 + Math.sin(g.clock * it.swayF + it.swayP) * it.sway, -HALF - 0.2, HALF + 0.2);
      if (it.inner) it.inner.rotation.x += it.spin * dt;
      const reach = it.ball ? 0.44 * size + 0.32 : 0.38 * size + 0.25;
      if (!quiet && g.stun <= 0 && p.y < my + 0.5 && p.y > my - 0.45 * size - 0.25 && Math.abs(p.x - mx) < reach) {
        if (it.ball) {
          g.stun = 1.2;
          s.gesture('shake', true); A.play('thud'); A.play('sneeze');
          FX.puff(p, 8, 0xffffff, 0.45);
          const lost = dropOne();
          big(tr('Bonk!') + (lost ? ' \u22121' : ''));
          if (lost) setScore(g.score);
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
    const left = Math.max(0, g.time), prog = 1;   // as hard as the final seconds, from the start
    const whole = Math.ceil(left);
    if (whole !== g.lastTick) {
      g.lastTick = whole;
      $('gTime').textContent = whole;
      if (whole <= 5 && whole > 0) A.play('tick');
    }
    if (g.bigAt != null && g.clock - g.bigAt > 0.7) { $('gBig').textContent = ''; g.bigAt = null; }
    g.spawn -= dt;
    if (g.spawn <= 0 && g.time > 1.2) {
      g.spawn = U.lerp(0.85, 0.4, prog) * (0.75 + Math.random() * 0.5);
      spawnCatch(prog);
    }
    fall(dt, false);
    if (g.time <= 0) { g.phase = 'over'; g.clock = 0; big(tr('Time!')); A.play('go'); }
  }

  /* ---------- Nose Ball ---------- */
  function updateBall(dt) {
    const s = g.seal, b = g.b, R = 0.36;
    const grav = 8.6 + Math.min(5.8, g.score * 0.2);    // the ball comes down faster with every bounce
    b.vy -= grav * dt;
    b.x += b.vx * dt; b.y += b.vy * dt;
    const wall = HALF + 0.35;
    if (b.x > wall) { b.x = wall; b.vx = -Math.abs(b.vx); A.play('tap', 0.1); }
    else if (b.x < -wall) { b.x = -wall; b.vx = Math.abs(b.vx); A.play('tap', 0.1); }
    s.noseA.getWorldPosition(v1);
    const top = v1.y + 0.1 * s.size, nx = v1.x, nz = v1.z;
    if (b.vy < 0 && b.y - R < top && b.y - R > top - 0.6 && Math.abs(b.x - nx) < 0.36 * s.size + 0.3) {
      g.score++;
      setScore(g.score);
      b.y = top + R;
      const g2 = 8.6 + Math.min(5.8, g.score * 0.2);
      b.vy = Math.sqrt(2 * g2 * (2.75 + Math.random() * 0.6));   // about the same height, less time to get there
      b.vx = U.clamp((b.x - nx) * 5.2 + g.vx * 0.4 + rs(2.2 + Math.min(4.4, g.score * 0.2)), -8.5, 8.5);   // it can fly off sideways, fast
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
      big(tr(g.score >= 10 ? 'Wow!' : 'Oops!'));
    }
  }

  /* ---------- the end of any game ---------- */
  function finish(quit) {
    const id = g.id, score = g.score, caught = g.caught, secs = g.secs;
    (g.items || []).forEach((it) => W.scene.remove(it.m));
    if (g.ext && g.ext.stop) g.ext.stop();
    g = null;
    Games.active = null;
    W.override = null;
    $('gamehud').hidden = true;
    let reward = null;
    if (!(quit && score === 0)) reward = S.gameReward(PN.Game.state, id, score, caught, null, secs);
    PN.Game.endGame(id, score, reward);
  }
})(window.PN = window.PN || {});
