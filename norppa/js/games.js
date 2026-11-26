/* Pikku Norppa: the mini-games.
   Fish Rain: slide the seal about to catch falling fish.
   Nose Ball: keep the ball in the air.
   The rest live in arcade.js and plug in through Games.ext. */
(function (PN) {
  'use strict';
  const T = THREE, U = PN.U, W = PN.World, S = PN.Sim, D = PN.DATA, UI = PN.UI, FX = PN.FX, A = PN.Audio, tr = PN.L;
  const $ = (id) => document.getElementById(id);
  const Games = PN.Games = { active: null, ext: {} };

  /* First-time tutorials: each game remembers on this device that its tutorial has been seen. Developer mode can clear them all. */
  const TUT = 'pikkunorppa.tut.';
  Games.tutorial = {
    seen(id) { try { return !!localStorage.getItem(TUT + id + (Games.mumMode ? '.mum' : '')); } catch (e) { return false; } },
    mark(id) { try { localStorage.setItem(TUT + id + (Games.mumMode ? '.mum' : ''), '1'); } catch (e) { /* private browsing: it simply shows again next time */ } },
    reset() {
      try { Object.keys(localStorage).filter((k) => k.indexOf(TUT) === 0).forEach((k) => localStorage.removeItem(k)); } catch (e) { /* nothing to do */ }
    },
  };

  /* What each game teaches the first time it is played, a step at a time.
     A step with `do` stops the game and waits for the player to actually do it (tap, swipe, drag, flick), the way the bus tutorial waits for a seat.
     The move that finishes the step goes through to the game, so it counts. `target` limits it to one thing on screen (a button, the board) and lights it up;
     a game can also point at a spot on its canvas through ext.tutSpot(step). A step without `do` is a tip: it shows for a few seconds while play goes on.
     'start' runs when play begins (after the 3-2-1); the rest when the game calls K.beat(name) at that moment.
     demo: the little hand in the card (swipe, tap, drag, flick); at: top or bottom, so the card does not cover the action.
     Seal Seat Shuffle has its own two-bus tutorial in arcade.js, and Löyly has its how-to sheet. */
  const TUTORIALS = {
    ball: {
      start: { do: 'swipe', demo: 'swipe', at: 'top', lines: ['Slide your finger left or right to move the seal.', 'Get under the ball and keep it bouncing on her nose!'] },
      bounce: { at: 'top', lines: ["Nice bounce! That's a point.", 'Hit it off-centre to send it sideways. It falls faster the longer you go.'] },
    },
    catch: {
      start: { do: 'swipe', demo: 'swipe', at: 'top', lines: ['Slide your finger to move the seal under the falling fish.', 'Every fish is a point. Gold ones are worth 3!'] },
      caught: { at: 'top', lines: ['Got one! Now and then a catch is yours to keep.'] },
      snowball: { do: 'swipe', demo: 'swipe', at: 'top', lines: ['Snowball coming! Slide out of the way.', 'A hit knocks off a point and stuns you for a second.'] },
    },
    swim: {
      start: { do: 'tap', demo: 'tap', at: 'bottom', lines: ['Tap to swim up. Stop tapping and you sink.', 'Slip through the gaps between the ice and the kelp.'] },
      fish: { at: 'bottom', lines: ['Yum! A fish in a gap is a bonus point.'] },
      again: { do: 'tap', demo: 'tap', at: 'bottom', lines: ['Bonk! You get three goes, and the average counts.', 'Tap to start your next go.'] },
    },
    stack: {
      now: { do: 'tap', demo: 'tap', at: 'bottom', lines: ['Tap now to drop the scoop!', 'It is right over the tower, so it lands perfectly.'] },
      cut: { at: 'bottom', lines: ['Anything hanging over the edge breaks off, so the tower gets narrower.', 'Line the scoops up to keep your width.'] },
      perfect: { at: 'bottom', lines: ['Perfect! Nothing breaks off.', 'Three perfect scoops in a row even win some width back.'] },
    },
    puff: {
      start: { do: 'tap', target: '#puffBoard .pf-c', glow: '#puffBoard', demo: 'tap', at: 'bottom', lines: ['Tap any tile to open it. The first tap is always safe.', 'Open every tile without waking a pufferfish. The quicker you clear it, the more coins.'] },
      open: { at: 'bottom', lines: ['A number counts the pufferfish touching that tile.', 'Hold a tile, or switch to Flag, to mark one you have found.'] },
    },
    piano: {
      start: { do: 'tap', at: 'top', lines: ['Tap the Start tile to begin.', 'Then tap every tile in order as it slides down. Miss one and it is over.'] },
      go: { at: 'top', lines: ['The tune has started! Keep tapping each tile as it slides down.', 'It gets faster as the tune goes on.'] },
    },
    toss: {
      start: { do: 'flick', demo: 'flick', at: 'top', lines: ['Flick the snowball up the screen along the dotted line.', 'For your first three throws, the line leans into the wind for you.'] },
      solo: { at: 'top', lines: ["That's the guide done. From now on you're on your own.", 'Check the flag and the wind number before every throw, and lean your flick into the wind. Three misses and it is over.'] },
    },
    curl: {
      start: { do: 'drag', demo: 'drag', at: 'top', lines: ['Drag down and let go to slide the seal.', 'Drag further to go faster, and a little sideways to aim the other way.'] },
      stopped: { at: 'top', lines: ['Closer to the middle scores more. A bullseye is 5 points, and you get 8 slides.'] },
      blocks: { at: 'top', lines: ['Watch out! Blocks now slide across the ice. Hit one and you score nothing.'] },
    },
    sled: {
      start: { do: 'swipe', demo: 'swipe', at: 'top', lines: ['Slide your finger left and right to steer down the hill.', 'Dodge the trees and rocks. One crash ends the run.'] },
      fish: { at: 'top', lines: ['Grabbed a fish! That is +10 metres.'] },
      ramp: { at: 'top', lines: ['A ramp! You jump for +20 metres, and nothing can hit you while you are in the air.'] },
    },
    bj: {
      start: { do: 'tap', target: '[data-bj="bet"]', demo: 'tap', at: 'top', lines: ['Your first bet is 5 tokens. Tap the bet button to deal.', 'Beat the dealer by getting closer to 21 without going over.'] },
      play: { do: 'tap', target: '[data-bj="hit"], [data-bj="stand"]', at: 'top', lines: ['Your turn! Hit takes another card. Stand keeps what you have.', 'Face cards count 10, and an Ace is 1 or 11.'] },
      settled: { at: 'top', lines: ['Win and you get your bet back and more. Lose and it is gone.', 'Tap Cash out whenever you like to take your tokens home.'] },
      slide: { do: 'tap', target: '.bj-slide', demo: 'swipe', at: 'top', lines: ['You can bet more now! Slide to choose how much to bet.', 'The most you can bet is a third of your tokens.'] },
    },
    labpull: {
      start: { at: 'top', lines: ['Welcome to the sauna! Watch the heat bar fill up on the right.', 'She cooks as it rises. Get her out when the bar is on the gold line.'] },
      gold: { do: 'drag', demo: 'drag', at: 'bottom', lines: ['Perfect temperature! The bar stops the moment she leaves the sauna.', 'Hold her by the head and drag her down out of it.'] },
      out: { at: 'top', lines: ['Well done!', 'Now dunk her in the ice water to cool her down and reset the bar.'] },
      cool: { at: 'top', lines: ['Lovely and cool! Drag her back up into the sauna for the next round.'] },
      solo: { at: 'top', lines: ["That's the guide done. From now on you're on your own.", 'Pull her out on the gold line, dunk her to reset, and go again. Five rounds, up to 3 points each.'] },
    },
    coffee: {
      start: { at: 'top', lines: ['Customers leave their order on a receipt.', 'Remember it, then make the drink from memory.'] },
      read: { do: 'tap', at: 'top', lines: ['Read the order, then tap the receipt.', 'Once you tap, it goes away, so take your time.'] },
      step: { do: 'tap', at: 'top', lines: ['Now tap the right option for each step.', 'Size first, then base, temperature, milk, syrups and extras.'] },
      served: { at: 'top', lines: ['Perfect! Every two drinks add one more thing to remember.', 'One wrong drink ends the game.'] },
    },
  };
  let tutCard = null, tutSpotEl = null, tipTimer = 0, glowing = [];
  const MUM_TUTORIAL_LINES = {
    piano: {
      start: ['Tap the Start tile to begin.', 'Tap the green tiles in order before they slide off the bottom.'],
      go: ['The tune has started! Keep tapping each green tile to play the next note.'],
    },
    toss: { start: ['Flick the snowball up the screen along the dotted line.', 'The guide shows where to aim on every throw.'] },
    sled: { start: ['Slide your finger left and right to steer down the hill.', 'Dodge the trees and rocks. You can brush off the first two bumps.'] },
  };

  function tutDom() {
    if (tutCard) return;
    tutCard = document.createElement('div'); tutCard.className = 'g-tut'; tutCard.hidden = true; tutCard.setAttribute('role', 'status');
    $('gamehud').appendChild(tutCard);
  }
  function unglow() { glowing.forEach((el) => el.classList.remove('tut-glow')); glowing = []; }
  function tutHide() {
    clearTimeout(tipTimer); unglow();
    if (tutSpotEl) { tutSpotEl.remove(); tutSpotEl = null; }
    if (tutCard) { tutCard.hidden = true; tutCard.textContent = ''; }
  }
  /* A pointing hand, drawn once and used by the card demos, the spot marker and Snowball Toss's aim line (inside an svg, tip at 16,2). */
  Games.fingerShapes = '<g fill="#fff" stroke="#1b2a55" stroke-width="2.2" stroke-linejoin="round"><rect x="4" y="22" width="24" height="20" rx="9"/><rect x="12" y="2" width="8" height="28" rx="4"/><rect x="13.1" y="21" width="5.8" height="10" stroke="none"/></g>';
  function tutDemo(kind) {
    const d = document.createElement('div');
    d.className = 'tut-demo ' + kind; d.setAttribute('aria-hidden', 'true');
    d.innerHTML = (kind === 'tap' ? '<span class="rip"></span>' : '<span class="arr a1"></span>' + (kind === 'swipe' ? '<span class="arr a2"></span>' : ''))
      + '<svg viewBox="0 0 32 44">' + Games.fingerShapes + '</svg>';
    return d;
  }
  function tutShow(b, tip) {
    tutHide(); tutDom();
    tutCard.className = 'g-tut ' + (b.at === 'bottom' ? 'at-bottom' : 'at-top') + (tip ? ' tip' : ' ask');
    if (b.demo) tutCard.appendChild(tutDemo(b.demo));
    b.lines.forEach((line) => { const p = document.createElement('p'); p.textContent = tr(line); tutCard.appendChild(p); });
    tutCard.hidden = false;
  }
  /* A tip shows while the game carries on, for about as long as it takes to read. */
  function tutTip(b) {
    tutShow(b, true);
    const words = b.lines.join(' ').split(' ').length, ms = Math.max(3500, 1400 + words * 260);
    tutCard.style.setProperty('--tip-out', (ms - 400) / 1000 + 's');   // fades out just before it goes
    tipTimer = setTimeout(tutHide, ms);
  }
  /* A step: the game stops until the player makes the move. */
  function tutAsk(b, opts) {
    if (g.ext && g.ext.tutSpot) opts = Object.assign(g.ext.tutSpot(b.key) || {}, opts);
    tutShow(b, false);
    g.paused = true; g.drawn = false;
    g.gate = { do: b.do, target: b.target, where: opts && opts.where, sx: null };
    if (b.glow || b.target) document.querySelectorAll(b.glow || b.target).forEach((el) => { el.classList.add('tut-glow'); glowing.push(el); });
    if (opts && opts.spot) {   // a hand tapping the very spot to touch
      tutSpotEl = tutDemo('tap'); tutSpotEl.classList.add('tut-spot');
      tutSpotEl.style.left = opts.spot.x + 'px'; tutSpotEl.style.top = opts.spot.y + 'px';
      $('gamehud').appendChild(tutSpotEl);
    }
  }
  function gateDone() { if (!g || !g.gate) return; g.gate = null; g.paused = false; tutHide(); }
  /* While a step waits, the move that matches it finishes the step and carries on to the game; anything else is held back so a stray tap
     cannot play a wrong move. The top bar (quit, cash out) always works. */
  const inTop = (e) => e.target && e.target.closest && e.target.closest('.g-top');
  const matches = (e) => {
    const gt = g.gate;
    if (gt.target) return !!(e.target && e.target.closest && e.target.closest(gt.target));
    return gt.where ? gt.where(e.clientX, e.clientY) : true;
  };
  window.addEventListener('pointerdown', (e) => {
    if (!g || !g.gate || inTop(e)) return;
    if (!matches(e)) { e.stopPropagation(); return; }
    if (g.gate.do === 'swipe') { g.gate.sx = e.clientX; e.stopPropagation(); return; }   // a swipe counts once the finger has moved
    gateDone();
  }, true);
  window.addEventListener('pointermove', (e) => {
    if (!g || !g.gate) return;
    if (g.gate.do === 'swipe' && g.gate.sx != null && Math.abs(e.clientX - g.gate.sx) >= 28) { gateDone(); Games.pointer('down', e.clientX, e.clientY); return; }
    e.stopPropagation();
  }, true);
  ['pointerup', 'click'].forEach((type) => window.addEventListener(type, (e) => {
    if (!g || !g.gate || inTop(e)) return;
    if (g.gate.do === 'swipe') g.gate.sx = null;
    e.stopPropagation();
  }, true));
  /* A game calls this when something worth explaining has just happened. Once per game per step, and only while the tutorial is on. */
  function beat(key, opts) {
    if (!g || !g.tut || g.paused || g.phase === 'over') return false;
    const src = (TUTORIALS[g.id] || {})[key];
    if (!src || g.tut.shown[key]) return false;
    const b = Object.assign({ key }, src);
    const lines = g.mumMode && MUM_TUTORIAL_LINES[g.id];
    if (lines && lines[key]) b.lines = lines[key];
    g.tut.shown[key] = 1; g.tut.count++;
    if (b.do) tutAsk(b, opts); else tutTip(b);
    return true;
  }

  const LANE_Z = 0.6;          // the seal slides along this line, facing the camera
  const HALF = 2.5;            // how far it can go either way
  const GAME_LEN = 40;         // seconds of Fish Rain
  const FISH_W = [0, 64, 22, 8, 2.5, 0.7];
  const v1 = new T.Vector3(), look = new T.Vector3();
  const rs = (k) => (Math.random() - 0.5) * 2 * k;
  let g = null;                // the game in play
  let bound = false;
  Object.defineProperty(Games, 'mumMode', { get: () => !!(g && g.mumMode) });

  function big(text, hold, cls) {   // hold: seconds it stays up (0.8 if not given); cls: an extra style, such as 'too-slow'
    const el = $('gBig');
    if (g) { g.bigAt = g.clock; g.bigHold = hold || 0.8; }
    el.className = 'g-big' + (cls ? ' ' + cls : '');
    el.textContent = text;
    void el.offsetWidth; el.classList.add('pop');
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
    beat,                                            // the first-time tutorial: pause with a card, once
    tutoring: () => !!(g && g.tut),                  // true while the first-time tutorial is running for this game
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
      if (g && g.gate) gateDone();   // a key press counts as making the move
      if (!g || g.paused) return;
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
    const mumMode = PN.Game.state.settings.mumMode === true && id !== 'coffee' && id !== 'shuffle' && id !== 'stack';
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
    const hint = ext ? ext.hint : id === 'catch' ? 'Slide left and right to catch the fish. Mind the snowballs.' : 'Slide to get under the ball. Keep it off the snow.';
    $('gHint').textContent = tr(mumMode ? PN.MUM_GAME_TEXT?.[id] || hint : hint);
    if (ext) {
      g = { id, ext, seal, mumMode, phase: 'count', clock: 0, said: -1, score: 0, items: [], caught: {}, keyL: 0, keyR: 0, secs: 0 };
      if (TUTORIALS[id] && !Games.tutorial.seen(id)) g.tut = { shown: {}, count: 0 };
      ext.start();
      W.override = ext.view();
      return;
    }
    W.setCamMode('game');
    W.stage(true);
    W.ball.visible = false;
    seal.sulk = false; seal.petting = 0;
    seal.moveTo(0, LANE_Z, { speed: 3.2, face: 0 });
    g = { id, seal, mumMode, saves: mumMode ? 2 : 0, phase: 'count', clock: 0, said: -1, tx: 0, vx: 0, score: 0, time: GAME_LEN, items: [], caught: {}, spawn: 0.5, stun: 0,
      keyL: 0, keyR: 0, z: LANE_Z, lastTick: 99, b: null, secs: 0 };
    if (TUTORIALS[id] && !Games.tutorial.seen(id)) g.tut = { shown: {}, count: 0 };
  };

  /* A finger on the screen says where the seal should go. */
  Games.pointer = function (type, x, y) {
    if (!g || g.paused) return;
    if (g.ext) { if (g.phase === 'play') g.ext.pointer(type, x, y); return; }
    if (type === 'up') return;
    const ray = W.rayAt(x, y);
    const k = (LANE_Z - ray.origin.z) / ray.direction.z;
    g.tx = U.clamp(ray.origin.x + ray.direction.x * k, -HALF, HALF);
  };

  Games.update = function (dt) {
    if (!g) return;
    const s = g.seal;
    if (g.paused) {   // a tutorial card is up: nothing moves and no time passes (what is on screen is redrawn once, and again if the screen is turned)
      if (g.ext && (!g.drawn || g.pw !== window.innerWidth || g.ph !== window.innerHeight)) { g.drawn = true; g.pw = window.innerWidth; g.ph = window.innerHeight; g.ext.update(0.001, false); }
      return;
    }
    g.clock += dt; g.secs += dt; g.frames = (g.frames || 0) + 1;          // how long the game has lasted: what it costs in energy (frames: for the stats, a measure of how smoothly it ran)
    if (g.ext) { updateExt(dt); return; }
    if (g.phase === 'count') {
      const n = Math.floor(g.clock / 0.75);
      if (n !== g.said && n < 4) {
        g.said = n;
        if (n < 3) { big(String(3 - n)); A.play('tick'); }
        else {
          big(tr('Go!')); A.play('go');
          g.phase = 'play'; g.clock = 0;
          if (beat('start') && g.paused) $('gBig').textContent = '';
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
    if (g.phase === 'count' && g.ext.nocount) { g.phase = 'play'; g.clock = 0; g.ext.go(); beat('start'); }
    if (g.phase === 'count') {
      const n = Math.floor(g.clock / 0.75);
      if (n !== g.said && n < 4) {
        g.said = n;
        if (n < 3) { big(String(3 - n)); A.play('tick'); }
        else { big(tr('Go!')); A.play('go'); g.phase = 'play'; g.clock = 0; g.ext.go(); if (beat('start') && g.paused) $('gBig').textContent = ''; }
      }
    }
    if (g.bigAt != null && g.phase === 'play' && g.clock - g.bigAt > (g.bigHold || 0.8)) { $('gBig').textContent = ''; g.bigAt = null; }
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
    const snowballChance = (0.17 + 0.2 * prog) * (g.mumMode ? 0.3 : 1);
    const isBall = g.clock > 3 && Math.random() < snowballChance;
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
      if (it.ball && !quiet && !g.sawBall && p.y < skyTop() - 1.2) { g.sawBall = true; beat('snowball'); }   // the first snowball to come into view
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
          beat('caught');
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
    if (b.vy < 0 && b.y - R < top && b.y - R > top - 0.6 && Math.abs(b.x - nx) < 0.36 * s.size + (g.mumMode ? 0.64 : 0.3)) {
      g.score++;
      setScore(g.score);
      b.y = top + R;
      const g2 = 8.6 + Math.min(5.8, g.score * 0.2);
      b.vy = Math.sqrt(2 * g2 * (2.75 + Math.random() * 0.6));   // about the same height, less time to get there
      b.vx = U.clamp((b.x - nx) * 5.2 + g.vx * 0.4 + rs(2.2 + Math.min(4.4, g.score * 0.2)), -8.5, 8.5);   // it can fly off sideways, fast
      s.gesture('boop', true);
      beat('bounce');
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
      if (g.saves > 0) {
        g.saves--;
        b.x = nx; b.y = Math.min(7.5, skyTop() - 1.5); b.vx = 0; b.vy = 0;
        big(tr('Try that bounce again!'));
        g.bigAt = g.clock;
        return;
      }
      s.gesture('surprise', true);
      g.phase = 'over'; g.clock = 0;
      big(tr(g.score >= 10 ? 'Wow!' : 'Oops!'));
    }
  }

  /* ---------- the end of any game ---------- */
  function finish(quit) {
    const id = g.id, score = g.score, caught = g.caught, secs = g.secs, frames = g.frames || 0, info = Games.lastInfo || null, mum = !!g.mumMode;
    if (g.tut && (!quit || g.tut.count > 1)) Games.tutorial.mark(id);   // leaving straight away from the first card does not count as having seen it
    tutHide(); g.gate = null;
    Games.lastInfo = null;
    (g.items || []).forEach((it) => W.scene.remove(it.m));
    if (g.ext && g.ext.stop) g.ext.stop();
    g = null;
    Games.active = null;
    W.override = null;
    $('gamehud').hidden = true;
    let reward = null;
    if (id === 'sauna') { if (!(quit && score === 0)) reward = S.saunaDone(PN.Game.state, score, (Games.opts && Games.opts.need) || 7); Games.opts = null; }
    else if (PN.GAMES[id] && PN.GAMES[id].lab) Games.opts = null;      // Sauna lab prototypes: no coins, no tiredness, nothing saved
    else if (!(quit && score === 0)) { reward = S.gameReward(PN.Game.state, id, score, caught, null, secs, Date.now(), id === 'piano' && Games.opts ? Games.opts.pay : 1); Games.opts = null; }
    else Games.opts = null;
    const lab = PN.GAMES[id] && PN.GAMES[id].lab;
    if (PN.Track && !lab) PN.Track.game(id, !!quit && !score, secs, score, reward, secs > 2 ? frames / secs : null, info, mum);   // 'gave up' = stopped with nothing; leaving after a finished game is a normal play
    PN.Game.endGame(id, score, reward);
    if (lab && !(quit && !score)) {
      UI.modal({ title: tr(PN.GAMES[id].title), layout: 'game-result', html: '<div class="result-body"><div class="result-summary"><div class="bigscore">' + score + '</div><p>' + tr(PN.GAMES[id].unit) + '.</p><p class="note">' + tr('A rough prototype. Nothing was paid and nothing was saved.') + '</p></div></div>',
        actions: [{ label: tr('Play again'), value: 1 }, { label: tr('Done'), value: 0 }] }).then((v) => { if (v === 1) PN.Game.startGame(id); });
    }
  }
})(window.PN = window.PN || {});
