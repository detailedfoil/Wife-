/* Pikku Norppa: the game itself.
   Ties the seal, the shore, the rules and the screen together: what a tap does,
   what the seal gets up to on its own, and what happened while you were away. */
(function (PN) {
  'use strict';
  const T = THREE, U = PN.U, W = PN.World, S = PN.Sim, D = PN.DATA, UI = PN.UI, FX = PN.FX, A = PN.Audio, tr = PN.L;
  const $ = (id) => document.getElementById(id);
  const G = PN.Game = { state: null, seal: null, busy: false, ready: false };
  const Q = new URLSearchParams(location.search);

  const v1 = new T.Vector3(), v2 = new T.Vector3(), v3 = new T.Vector3(), anchor = new T.Vector3();
  const scr = { x: 0, y: 0, behind: false };
  const rs = (k) => (Math.random() - 0.5) * 2 * k;
  const MIN = 60e3;
  let state, seal, t = 0, last = 0, started = false, noSave = false;
  let bedBusy = false;
  const pups = {};                       // pup id -> its Seal

  const nm = () => '<b>' + UI.esc(state.name) + '</b>';
  const plain = () => UI.esc(state.name);
  const chip = (inner) => '<span class="chip">' + inner + '</span>';
  const coinChip = (n) => chip(UI.ic('coin') + '+' + n);
  const itemChip = (id, n) => chip('<img src="' + PN.Thumbs.get(id) + '" alt="">' + (n > 1 ? n + ' × ' : '') + UI.esc(PN.items[id].fi));
  const buzz = (ms) => { if (state.settings.haptics && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) { /* not allowed here */ } } };
  const head = (out) => seal.topA.getWorldPosition(out || v1);
  const blocked = () => G.busy || !!PN.Games.active || !G.ready;

  /* ---------- little timed moves, driven by the frame loop so they pause with it ---------- */
  const tweens = [];
  const tween = (dur, fn) => new Promise((res) => { tweens.push({ t: 0, dur, fn, res }); });
  const wait = (sec) => tween(sec, null);
  function runTweens(dt) {
    for (let i = tweens.length - 1; i >= 0; i--) {
      const w = tweens[i];
      w.t += dt;
      const k = Math.min(1, w.t / w.dur);
      if (w.fn) w.fn(k);
      if (k >= 1) { tweens.splice(tweens.indexOf(w), 1); w.res(); }
    }
  }
  const ease = (k) => k * k * (3 - 2 * k);

  /* ---------- start-up ---------- */
  function boot() {
    PN.Thumbs.build(128);
    W.init($('gl'));
    PN.Astro.startLive();
    UI.init();
    const saved = S.load();
    const isNew = !saved || !saved.name;
    state = G.state = saved || S.newState(Date.now());
    // Pick once per page load; settings changes keep this session's choice.
    state.settings.instrument = A.instruments[Math.floor(Math.random() * A.instruments.length)].id;
    PN.setLang(state.settings.lang || PN.guessLang());
    let sum = null;
    if (!isNew) sum = S.advance(state, Date.now(), { away: true });
    S.drain();                            // the welcome-back note covers what happened; no flood of messages
    if (Q.get('t')) W.debugDate = new Date(Q.get('t'));
    applySettings();

    seal = G.seal = new PN.Seal({ stage: state.stage });
    W.scene.add(seal.g); W.pickables.push(seal.g);
    W.fitHome(seal.size);
    const d = W.DEN;
    if (isNew) seal.place(d.inside.x, W.groundY(d.inside.x, d.inside.z), d.inside.z, d.heading);
    else if (state.asleep) { seal.place(d.sleep.x, W.groundY(d.sleep.x, d.sleep.z), d.sleep.z, bedHeading()); seal.asleep = true; }
    else seal.place(W.HOME.x, W.groundY(W.HOME.x, W.HOME.z), W.HOME.z, W.HOME_HEADING);
    anchor.copy(seal.g.position);
    syncLook();
    syncPups();
    resetBall();

    W.setCamMode('intro');
    W.cam.size = seal.size;
    W.cam.focus.copy(seal.g.position);
    W.update(0, 0); W.snapCamera();
    bindInput();
    last = performance.now();
    requestAnimationFrame(loop);
    const go = () => begin(isNew, sum);
    if (!isNew) go.note = () => tr(state.asleep ? '{0} is asleep in the den.' : '{0} is waiting for you.', state.name);
    UI.title.ready(isNew, go);
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => { /* offline play is a bonus */ });
  }

  function applySettings() {
    A.setSound(state.settings.sound);
    A.setMusic(state.settings.music);
    A.setInstrument(state.settings.instrument);
    W.skyMode = Q.get('sky') || state.settings.sky;
  }

  /* Make the seal and the shore match the save. */
  function syncLook() {
    seal.setStage(state.stage);
    seal.cosy = !!state.placed.peitto;
    W.fitHome(seal.size);
    ['head', 'neck', 'face', 'back'].forEach((slot) => seal.setWear(slot, state.wearing[slot]));
    syncDirt();
    W.setDecor(state.placed);
    if (seal.asleep && !bedBusy && !PN.Games.active) {
      const p = W.DEN.sleep; seal.place(p.x, W.groundY(p.x, p.z), p.z, bedHeading());
    }
    W.syncPoops(state.poops);
    poopN = state.poops.length;
  }
  function syncDirt() { seal.setDirt(U.smooth(72, 12, state.stats.clean)); }

  async function begin(isNew, sum) {
    UI.title.hide();
    W.setCamMode('home');
    started = true;
    if (isNew) await intro();
    else {
      UI.showHud(true); UI.refresh();
      await wait(0.8);
      await welcomeBack(sum);
    }
    await pupNews();
    await dailyGift();
    G.ready = true;
    S.save(state);
  }

  /* The very first minute: a pup wriggles out of the den and gets a name. */
  async function intro() {
    G.busy = true;
    state.lastSeen = Date.now();
    await wait(1.5);
    A.play('squeak');
    await seal.moveTo(W.DEN.sleep.x, W.DEN.sleep.z, { speed: 1.1 });
    seal.gesture('surprise'); A.play('chirp');
    await wait(1.0);
    await seal.moveTo(W.HOME.x, W.HOME.z, { speed: 1.7, face: W.HOME_HEADING });
    seal.gesture('wave'); A.play('chirp');
    await wait(1.2);
    const name = await UI.askName({ title: tr('A little kuutti!'), text: tr('A ringed seal pup has wriggled out of the snow den. What will you call it?'), ok: tr('That is the one') });
    state.name = name;
    state.settings.lang = PN.lang;
    state.lastSeen = Date.now();
    S.learn(state, 'norppa'); S.learn(state, 'kuutti');
    S.save(state);
    UI.showHud(true); UI.refresh();
    seal.gesture('happy'); A.play('chirp'); FX.hearts(head(), 3);
    UI.toast(tr('Say hello to {0}. Stroke with a finger.', nm()), 'heart', '', 5200);
    state.tut = 1;
    G.busy = false;
  }

  /* ---------- coming back ---------- */
  function span(ms) {
    const m = Math.round(ms / MIN);
    if (m < 90) return tr(m === 1 ? '{0} minute' : '{0} minutes', m);
    const h = Math.round(m / 60);
    if (h < 36) return tr('{0} hours', h);
    return tr('{0} days', Math.round(h / 24));
  }
  function welcomeBack(sum) {
    if (!sum || sum.ms < 20 * MIN) return Promise.resolve();
    const hour = new Date().getHours(), lines = [];
    const add = (icon, text, cls) => lines.push('<div class="' + (cls || '') + '">' + UI.ic(icon) + '<span>' + text + '</span></div>');
    const one = (n, a, b) => tr(Math.round(n) === 1 ? a : b, Math.round(n));
    let bad = false;
    if (sum.sleptH >= 1) add('zzz', one(sum.sleptH, 'Slept for about {0} hour.', 'Slept for about {0} hours.'));
    if (sum.pupLost.length) { bad = true; sum.pupLost.forEach((n) => add('heart', tr('<b>{0}</b> went too long without milk and did not make it.', UI.esc(n)), 'bad')); }
    if (sum.sick && state.sick) { bad = true; add('med', tr('{0} has fallen poorly. Cloudberry juice or steady care will mend it.', plain()), 'bad'); }
    if (sum.pupSick.length) { bad = true; sum.pupSick.forEach((n) => { if (state.pups.some((p) => p.name === n && p.sick)) add('med', tr('<b>{0}</b> is poorly from hunger. Feed {1} so she can nurse.', UI.esc(n), plain()), 'bad'); }); }
    if (sum.neglectH >= 1) { bad = true; add('clock', one(sum.neglectH, 'Was left hungry or grubby for {0} hour.', 'Was left hungry or grubby for {0} hours.') + (state.stage < 2 ? ' ' + tr('Her growing slipped back.') : ''), 'bad'); }
    else if (state.stats.food < 25 && !state.asleep) add('fish', tr('Got hungry waiting for you.'));
    if (sum.xpLost > 0) add('heart', one(sum.xpLost, 'Friendship slipped by {0} point.', 'Friendship slipped by {0} points.'), 'bad');
    if (state.medLate) { bad = true; add('anxi', tr('{0} is Anxi. She needs her medicine.', plain()), 'bad'); }
    else if (state.grudge > 0) { bad = true; add('grump', tr('{0} is Angy. Food and gentle strokes will win it round.', plain()), 'bad'); }
    if (sum.cured) add('check', tr('Got over being poorly.'), 'good');
    sum.pupWell.forEach((n) => add('check', tr('<b>{0}</b> is feeling better.', UI.esc(n)), 'good'));
    if (sum.poops > 0) add('poo', sum.poops === 1 ? tr('Left a little present on the shore.') : tr('Left {0} little presents on the shore.', sum.poops));
    if (!bad) add('heart', state.asleep ? tr('All is well.') : tr('All is well, and {0} is glad to see you.', plain()), 'good');
    if (sum.pupLost.length) A.play('lost'); else if (bad) A.play('sad'); else A.play('chirp');
    syncPups();
    const morning = hour >= 5 && hour < 11;
    const title = bad ? tr('While you were away') : morning ? 'Hyvää huomenta!' : tr('Welcome back');
    return UI.modal({ title, html: '<p>' + tr('You were gone for {0}.', span(sum.ms)) + '</p><div class="away">' + lines.join('') + '</div>',
      actions: [{ label: bad ? tr('I am here now') : 'Hei, ' + plain() + '!', value: 1 }] }).then(() => { if (!bad && morning) S.learn(state, 'huomenta'); });
  }

  /* Told when the game opens again after she was ready: she met a special someone, and the pup is due in nine hours. */
  async function pupNews() {
    const n = S.pupNews(state, Date.now());
    if (!n) return;
    S.save(state);
    A.play('sparkle'); seal.gesture('happy');
    await UI.modal({ title: tr('A special someone'), html: tr('<p>{0} met a special someone while you were away.</p><p>Come back in {1} hours. That is when the pup will be born and appear.</p>', plain(), Math.round(n.ms / S.H)),
      actions: [{ label: tr('How exciting!'), value: 1 }] });
  }

  async function dailyGift() {
    const gift = S.dailyGift(state, Date.now());
    if (!gift) return;
    if (gift.withheld) { UI.toast(tr('No gift today. {0} is still cross with you.', nm()), 'grump', 'bad', 4500); return; }
    const it = PN.items[gift.fish];
    A.play('sparkle');
    await UI.modal({ art: PN.Thumbs.get(gift.fish), title: tr('A gift for today'),
      html: '<p>' + (gift.streak > 1 ? tr('Day <b>{0}</b> in a row. ', gift.streak) : '') + tr('The village fisherman left something on the ice.') + '</p><div class="loot">' + coinChip(gift.coins) + itemChip(gift.fish, gift.n) + '</div>'
        + (gift.isNew ? '<p>' + tr('{0} is new for the album.', UI.esc(it.fi)) + '</p>' : ''),
      actions: [{ label: 'Kiitos!', value: 1 }] });
    S.save(state);
  }

  /* ---------- every frame ---------- */
  function loop(ts) {
    requestAnimationFrame(loop);
    const raw = (ts - last) / 1000 || 0.016;
    last = ts;
    const dt = Math.min(0.05, Math.max(0.001, raw));
    t += dt;
    perf(raw);
    runTweens(dt);
    if (started && state.name) simTick(dt);
    if (PN.Games.active) PN.Games.update(dt);
    else behave(dt);
    moveBall(dt);
    seal.update(dt, t, W.groundY);
    updatePups(dt);
    FX.update(dt);
    const p = seal.g.position;
    W.cam.focus.set(p.x, W.groundY(p.x, p.z), p.z);
    W.cam.size = U.damp(W.cam.size, seal.size, 3, dt);
    W.update(dt, t);
    W.render();
    hud(dt);
    window.__frames = (window.__frames || 0) + 1;
  }

  /* Slow phones get a softer picture instead of a slow one. */
  const pf = { n: 0, acc: 0, skip: 2, lock: Q.get('pr') };
  function perf(raw) {
    if (pf.lock) { if (pf.lock !== 'set') { W.setPixelRatio(+pf.lock || 1); pf.lock = 'set'; } return; }
    if (raw > 0.5) return;                // the tab was hidden
    pf.n++; pf.acc += raw;
    if (pf.acc < 2.5) return;
    const fps = pf.n / pf.acc;
    pf.n = 0; pf.acc = 0;
    if (pf.skip > 0) { pf.skip--; return; }
    if (fps < 40 && W.pixelRatio > 0.8) W.setPixelRatio(Math.max(0.8, W.pixelRatio - 0.25));
  }

  /* ---------- the rules, once a second ---------- */
  let simT = 0, saveT = 0, envT = 6, poopN = 0, tutT = 0;
  function simTick(dt) {
    simT += dt; saveT += dt; envT -= dt;
    drainEvents();
    if (simT < 1) return;
    simT = 0;
    const now = Date.now(), gap = now - state.lastSeen;
    if (gap > 3 * MIN) {                  // the phone slept or the tab was hidden
      const sum = S.advance(state, now, { away: true });
      S.drain();
      syncLook(); syncPups();
      if (gap > 30 * MIN && !PN.Games.active) welcomeBack(sum).then(pupNews).then(dailyGift);
    } else S.advance(state, now);

    if (state.poops.length !== poopN) {
      if (state.poops.length > poopN && !state.asleep) A.play('pop', 2);
      poopN = state.poops.length;
      W.syncPoops(state.poops);
    }
    syncDirt();
    syncPups();
    tickVisits(now);
    if (saveT > 10) { saveT = 0; save(); }
    if (envT <= 0) { envT = 22; noticeSky(); }
    const free = G.ready && !G.busy && !PN.Games.active && !UI.modalOpen && !UI.sheetName && !bedBusy;
    if (free) {
      if (S.canEvolve(state)) evolve();
      else if (S.pupBirthDue(state, now)) birth();
      else if (S.pupDue(state, now)) { state.pupMet = 'ready'; S.save(state); }   // ready, but she waits for the game to be closed
      else {
        tutT += 1;
        if (tutT > 3) tutorial();
        if (state.gift.last !== S.dayKey(now)) dailyGift();      // midnight came round while playing
      }
    }
    UI.refresh();
  }
  function save() { if (!noSave) S.save(state); }

  function drainEvents() {
    const list = S.drain();
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e.type === 'word') {
        const w = D.words[e.id];
        UI.toast(tr('<em>{0}</em> means {1}.', UI.esc(w.fi), UI.esc(w.en)), 'book', 'word', 3600);
        A.play('word', 0.4);
      } else if (e.type === 'level') {
        UI.toast(tr('Friendship level <b>{0}</b>. +{1} coins', e.level, e.coins), 'heart', '', 4000);
        A.play('level');
        if (!seal.asleep) { seal.gesture('happy'); FX.hearts(head(), 5); }
      } else if (e.type === 'award') {
        const a = D.awards[e.id];
        UI.toast(tr('Award: <b>{0}</b>. +{1} coins', UI.esc(PN.awardTitle(a)), a.c), 'star', '', 4200);
        A.play('award', 0.6);
      } else if (e.type === 'medlate') {
        UI.toast(tr('{0} has not had her medicine and is Anxi.', nm()), 'anxi', '', 4200);
      } else if (e.type === 'forgiven') {
        UI.toast(tr('{0} has forgiven you.', nm()), 'heart', '', 3800);
        seal.sulk = false; seal.heading = W.HOME_HEADING;
        seal.gesture('happy', true); A.play('chirp'); FX.hearts(head(), 6);
      } else if (e.type === 'sick') {
        UI.toast(tr('{0} has fallen poorly. Cloudberry juice from the shop will help.', nm()), 'med', 'bad', 5200);
        A.play('sneeze'); seal.gesture('sneeze');
      } else if (e.type === 'cured') {
        UI.toast(tr('{0} is feeling better.', nm()), 'check', '', 3800);
        A.play('sparkle'); FX.sparkle(head(), 10);
      } else if (e.type === 'pupSick') {
        UI.toast(tr('<b>{0}</b> is poorly from hunger. Feed {1} so she can nurse.', UI.esc(e.name), plain()), 'med', 'bad', 5600);
        A.play('sad');
      } else if (e.type === 'pupLost') {
        A.play('lost');
        syncPups();
        UI.modal({ title: tr('Goodbye, {0}', UI.esc(e.name)),
          html: tr('<p>{0} went too long without milk and did not make it.</p><p>{1} will be sad for a while. Keep her tummy full and it need not happen again.</p>', UI.esc(e.name), plain()),
          actions: [{ label: tr('I am sorry'), value: 1 }] });
      }
    }
  }

  /* Words and awards that come from the sky, the season and the hour. One at a time. */
  function noticeSky() {
    const e = W.env, h = new Date().getHours(), live = W.skyMode === 'live', seen = state.seen;
    if (live) {
      if (e.aurora > 0.3) seen.aurora = 1;
      if (e.polarNight) seen.kaamos = 1;
      if (e.midnightSun) seen.midnightSun = 1;
    }
    if (h >= 1 && h < 4) seen.owl = 1;
    if (h >= 5 && h < 7) seen.early = 1;
    S.check(state);
    if (!G.ready || UI.modalOpen) return;
    const words = [[e.season, true], ['lumi', e.snowing], ['pakkanen', e.temp <= -12], ['revontulet', e.aurora > 0.3], ['kaamos', e.polarNight],
      ['yoton_yo', e.midnightSun], ['sininen_hetki', e.blue && live], ['kuu', e.moonUp], ['tahti', e.starry], ['aurinko', e.sunUp],
      ['nalka', state.stats.food < 25], ['uni', state.asleep]];
    for (let i = 0; i < words.length; i++) if (words[i][1] && S.learn(state, words[i][0])) break;
  }

  function tutorial() {
    const c = state.counters, hint = (text, icon) => { tutT = -6; UI.toast(text, icon, '', 5600); };
    if (state.tut === 1 && c.pets >= 4) { state.tut = 2; hint(tr('When the tummy bar runs low, tap <b>Feed</b>.'), 'fish'); }
    else if (state.tut === 2 && c.feeds >= 1) { state.tut = 3; hint(tr('Tap the hole in the ice to send {0} diving for finds.', nm()), 'dive'); }
    else if (state.tut === 3 && c.dives >= 1) { state.tut = 4; hint(tr('Games in <b>Play</b> earn coins for the shop.'), 'ball'); }
    else if (state.tut === 4 && c.games >= 1) { state.tut = 5; hint(tr('Drag the sky to look around. It shows the real daylight and weather in Lapland right now.'), 'sun'); }
    else if (state.tut === 5 && state.poops.length) { state.tut = 6; hint(tr('Tap a poo to clear it away.'), 'poo'); }
  }

  /* ---------- what the seal does by itself ---------- */
  let idleT = 5, lookT = 0, lookCam = true, zT = 1, breathT = 2, sheetT = 0;
  function behave(dt) {
    if (!started) return;
    if (!G.busy && !bedBusy) {
      if (state.asleep && !seal.asleep) goToBed();
      else if (!state.asleep && seal.asleep) getUp();
    }
    const awake = !seal.asleep;
    seal.setMood(S.mood(state));
    seal.scared = state.medLate && awake && !bedBusy;
    // the snuggle blanket: over her while she sleeps in the den, folded by the door the rest of the time
    seal.cosy = !!state.placed.peitto;
    const folded = W.decorOf('peitto');
    if (folded) folded.setOut(!(seal.blanket && seal.blanket.visible));
    const sulk = state.grudge > 0 && !state.medLate && awake && !bedBusy;
    if (sulk !== seal.sulk && !G.busy) {
      seal.sulk = sulk;
      seal.heading = W.HOME_HEADING + (sulk ? 2.2 : 0);
    }

    // where the eyes go
    lookT -= dt;
    if (lookT <= 0) { lookT = 2.5 + Math.random() * 5; lookCam = Math.random() < 0.72; }
    if (ball.lookT > 0) { ball.lookT -= dt; seal.look = W.ball.position; }
    else seal.look = lookCam || drag ? W.camera.position : null;

    if (seal.asleep) {
      zT -= dt;
      if (zT <= 0) { zT = 2.3; head(v1); v1.x += 0.25 * seal.size; FX.zzz(v1); }
    } else if (W.env.temp < -2 && seal.g.visible && !seal.freeY) {
      breathT -= dt;
      if (breathT <= 0) {
        breathT = 2.4 + Math.random() * 1.6;
        seal.mouthA.getWorldPosition(v1);
        FX.breath(v1, Math.sin(seal.g.rotation.y), Math.cos(seal.g.rotation.y));
      }
    }

    if (awake && G.ready && !G.busy && !bedBusy && !drag && !UI.sheetName && !UI.modalOpen && !seal.move) {
      idleT -= dt;
      if (idleT <= 0) { idleT = 6 + Math.random() * 8; idleAct(); }
    }
  }

  function idleAct() {
    const mood = S.mood(state), r = Math.random();
    if (mood === 'sick') { if (r < 0.6) { seal.gesture('sneeze'); A.play('sneeze'); } }
    else if (mood === 'sulk' && state.medLate) { if (r < 0.6) { seal.gesture('surprise'); A.play('sad'); } }
    else if (mood === 'sulk') { if (r < 0.5) { seal.gesture('no'); A.play('hmph'); head(v1); FX.huff(v1, 1); } }
    else if (mood === 'hungry') { if (r < 0.6) { seal.gesture('sad'); A.play('sad'); } }
    else if (mood === 'tired') { seal.gesture('yawn'); A.play('yawn'); }
    else if (mood === 'dirty' || mood === 'sad') { if (r < 0.5) { seal.gesture('sad'); A.play('sad'); } }
    else if (r < 0.38 && !state.pups.length) {              // a mother stays put so her pups can find her
      const x = U.clamp(W.HOME.x + rs(1.0), -0.75, 0.9), z = U.clamp(W.HOME.z + rs(0.6), -0.2, 0.9);
      seal.moveTo(x, z, { speed: 1.3, face: W.HOME_HEADING + rs(0.45) });
    } else if (r < 0.55) { seal.gesture('wiggle'); A.play('squeak'); }
    else if (r < 0.68 && mood === 'happy') { seal.gesture('clap'); A.play('chirp'); }
    else if (r < 0.8 && mood === 'happy') { seal.gesture('wave'); A.play('chirp'); head(v1); FX.notes(v1); }
    else if (r < 0.88) { seal.gesture('yawn'); A.play('yawn'); }
  }

  /* On a hide or under her blanket she curls up sideways across the doorway, so you can see her all snug. */
  function bedHeading() { return W.DEN.heading + (state.placed.peitto || state.placed.talja ? 0.95 : 0); }
  async function goToBed() {
    bedBusy = true;
    const d = W.DEN;
    seal.sulk = false;
    await seal.moveTo(d.sleep.x, d.sleep.z, { speed: 1.9, face: bedHeading() });
    if (state.asleep) {
      seal.heading = bedHeading();
      seal.gesture('yawn', true); A.play('yawn');
      await wait(1.6);
      if (state.asleep) { seal.asleep = true; zT = 0.6; }
    }
    bedBusy = false;
  }
  async function getUp() {
    bedBusy = true;
    seal.asleep = false;
    seal.gesture('yawn', true); A.play('yawn');
    await wait(1.5);
    if (!state.asleep) await seal.moveTo(W.HOME.x, W.HOME.z, { speed: 1.6, face: W.HOME_HEADING });
    bedBusy = false;
  }

  /* ---------- pups ---------- */
  /* Where each pup sits: by mother's flipper on the shore, in front of her nose at the den.
     Both spots are in plain view, clear of her head and of anything put out on the shore. */
  function pupSlot(i, out) {
    const k = i % 4, odd = k % 2, far = k > 1;            // the first two spots are for her own pups, the others for visitors
    if (seal.asleep || state.asleep) {
      out.set(anchor.x + (odd ? -0.25 : 1.05) + (far ? 0.85 : 0), 0, anchor.z + (odd ? 1.45 : 0.5) + (far ? 0.75 : 0));
      out.h = W.DEN.heading + (odd ? -0.2 : 0.25);
    } else {
      out.set(anchor.x + (odd ? -1.5 : -0.65) + (far ? -0.95 : 0), 0, anchor.z + (odd ? 0 : 0.75) + (far ? 1.05 : 0));
      out.h = odd ? 0.9 : 0.55;
    }
    return out;
  }
  function syncPups() {
    const have = {};
    state.pups.forEach((p, i) => {
      have[p.id] = 1;
      if (pups[p.id]) return;
      const ps = pups[p.id] = new PN.Seal({ pup: true, stage: 0 });
      Object.keys(p.wear || {}).forEach((slot) => ps.setWear(slot, p.wear[slot]));
      const s = pupSlot(i, v3);
      ps.place(s.x, W.groundY(s.x, s.z), s.z, s.h);
      ps.asleep = seal.asleep;
      W.scene.add(ps.g); W.pickables.push(ps.g);
    });
    Object.keys(pups).forEach((id) => { if (!have[id] && !pups[id].leaving) removePup(id); });
  }
  function removePup(id) {
    const ps = pups[id];
    if (!ps) return;
    W.scene.remove(ps.g);
    const k = W.pickables.indexOf(ps.g);
    if (k >= 0) W.pickables.splice(k, 1);
    delete pups[id];
  }
  function pupIndexOf(ps) {
    for (let i = 0; i < state.pups.length; i++) if (pups[state.pups[i].id] === ps) return i;
    return -1;
  }
  let pupZ = 2;
  function updatePups(dt) {
    if (!G.busy && !seal.freeY) anchor.copy(seal.g.position);
    const inGame = !!PN.Games.active;
    pupZ -= dt;
    state.pups.forEach((p, i) => {
      const ps = pups[p.id];
      if (!ps || ps.leaving) return;
      ps.g.visible = !inGame;
      const s = pupSlot(i, v3), far = Math.hypot(s.x - ps.g.position.x, s.z - ps.g.position.z);
      if (far > 0.55 && !ps.move && !inGame) { ps.asleep = false; ps.moveTo(s.x, s.z, { speed: 2.1, face: s.h }); }
      if (!ps.move) ps.asleep = seal.asleep;
      ps.setMood(p.sick ? 'sick' : p.food < 20 ? 'hungry' : p.joy > 55 ? 'happy' : 'ok');
      ps.look = ps.asleep ? null : (i % 2 ? W.camera.position : seal.g.position);
      if (ps.asleep && pupZ <= 0 && Math.random() < 0.5) { ps.topA.getWorldPosition(v1); FX.zzz(v1); }
    });
    if (pupZ <= 0) pupZ = 3.1;
    Object.keys(pups).forEach((id) => pups[id].update(dt, t, W.groundY));
    updateVisitors(dt);
  }

  /* ---------- visiting pups ----------
     A grown pup that has been called home from the Family album. It climbs out of the ice hole, hangs about on the shore,
     and swims back when sent away or when its eight hours are up. */
  const visitors = {};                                   // family number -> the visiting seal
  function visitorList() { return Object.keys(visitors).sort((a, b) => a - b); }
  function spawnVisitor(i, arriving) {
    const f = state.family[i];
    if (!f || visitors[i]) return;
    const ps = visitors[i] = new PN.Seal({ pup: true, stage: 0 });
    ps.visit = i;
    Object.keys(f.wear || {}).forEach((slot) => ps.setWear(slot, f.wear[slot]));
    ps.asleep = seal.asleep;
    W.scene.add(ps.g); W.pickables.push(ps.g);
    const s = pupSlot(state.pups.length + visitorList().indexOf(String(i)), v3);
    if (arriving) {
      const e = holeEdge(ps, v2);
      ps.place(e.x, W.groundY(e.x, e.z), e.z, 0);
      ps.asleep = false;
      ps.moveTo(s.x, s.z, { speed: 2.2, face: s.h });
      ps.gesture('happy', true);
    } else ps.place(s.x, W.groundY(s.x, s.z), s.z, s.h);
  }
  async function visitorLeaves(i, animate) {
    const ps = visitors[i];
    if (!ps || ps.leaving) return;
    ps.leaving = true; ps.asleep = false;
    if (animate && ps.g.visible) {
      ps.gesture('wave', true); A.play('chirp');
      await wait(1.2);
      const e = holeEdge(ps, v2).clone();
      await ps.moveTo(e.x, e.z, { speed: 2.4 });
      await plunge(ps);
    }
    W.scene.remove(ps.g);
    const k = W.pickables.indexOf(ps.g);
    if (k >= 0) W.pickables.splice(k, 1);
    delete visitors[i];
  }
  function updateVisitors(dt) {
    const inGame = !!PN.Games.active, ids = visitorList();
    ids.forEach((id, k) => {
      const ps = visitors[id];
      if (!ps || ps.leaving) return;
      ps.g.visible = !inGame;
      const s = pupSlot(state.pups.length + k, v3), far = Math.hypot(s.x - ps.g.position.x, s.z - ps.g.position.z);
      if (far > 0.55 && !ps.move && !inGame) { ps.asleep = false; ps.moveTo(s.x, s.z, { speed: 2.1, face: s.h }); }
      if (!ps.move) ps.asleep = seal.asleep;
      ps.setMood('happy');
      ps.look = ps.asleep ? null : (k % 2 ? seal.g.position : W.camera.position);
    });
    ids.forEach((id) => visitors[id].update(dt, t, W.groundY));
  }
  /* Called every second or so, and when the game opens: pay the ones who have arrived, and see the others off. */
  function tickVisits(now) {
    const r = S.visitTick(state, now);
    r.arrived.forEach((i) => {
      const f = state.family[i], here = S.visitStatus(f, now) === 'here';
      if (f.coins) UI.toast(here ? tr('<b>{0}</b> is back for a visit! +{1} coins', UI.esc(f.name), f.coins) : tr('<b>{0}</b> came to visit while you were away. +{1} coins', UI.esc(f.name), f.coins), 'coin', '', 5200);
      else UI.toast(here ? tr('<b>{0}</b> is back for a visit!', UI.esc(f.name)) : tr('<b>{0}</b> came to visit while you were away.', UI.esc(f.name)), 'heart', '', 5200);
      A.play('award');
      if (here) { spawnVisitor(i, true); FX.hearts(head(), 4); if (!seal.asleep && !G.busy) seal.gesture('happy'); }
    });
    r.left.forEach((i) => { visitorLeaves(i, true); });
    state.family.forEach((f, i) => { if (S.visitStatus(f, now) === 'here' && !visitors[i]) spawnVisitor(i, false); });
    visitorList().forEach((id) => { const ps = visitors[id]; if (!ps.leaving && S.visitStatus(state.family[id], now) !== 'here') visitorLeaves(id, false); });
    if (r.arrived.length || r.left.length) { S.save(state); UI.refresh(); if (UI.sheetName) UI.renderSheet(); }
  }
  G.callPup = async function (i) {
    const f = state.family[i];
    if (!f || f.fate !== 'grown' || UI.modalOpen) return;
    const now = Date.now(), stat = S.visitStatus(f, now), name = UI.esc(f.name), close = [{ label: tr('Close'), value: 0 }];
    A.play('tap');
    if (stat === 'here') { G.visitInfo(i); return; }
    if (stat === 'coming') { await UI.modal({ title: name, html: '<p>' + tr('{0} is on the way, and will be here in {1}.', name, UI.mins(f.arriveAt - now)) + '</p>', actions: close }); return; }
    const wait = S.callWait(state, i, now);
    if (wait > 0) { await UI.modal({ title: name, html: '<p>' + tr('{0} is busy being a seal. You can call {0} again in {1}.', name, UI.mins(wait)) + '</p>', actions: close }); return; }
    if (S.visiting(state, now) >= S.T.maxVisitors) { await UI.modal({ title: name, html: '<p>' + tr('The shore is full. Two visitors at a time is the most.') + '</p>', actions: close }); return; }
    const v = await UI.modal({ title: tr('Call {0} home?', name), html: '<p>' + (S.presentsLeft(state, now) > 0 ? tr('{0} will arrive in an hour, bring {1} coins as a present, and can stay for up to 8 hours. You can send {0} home sooner.', name, S.T.visitCoins) : tr('Two visits a day bring presents. {0} will still come and stay, but today\'s presents have been given.', name)) + '</p>',
      actions: [{ label: tr('Call {0}', name), value: 1 }, { label: tr('Not now'), value: 0 }] });
    if (v !== 1) return;
    const r = S.callPup(state, i, Date.now());
    if (!r.ok) { A.play('nope'); return; }
    A.play('chirp'); S.save(state);
    UI.toast(tr('You called {0}. {0} will be here in an hour.', name), 'heart', '', 4200);
    UI.renderSheet(); UI.refresh();
  };
  G.visitInfo = async function (i) {
    const f = state.family[i];
    if (!f || UI.modalOpen || S.visitStatus(f, Date.now()) !== 'here') return;
    const name = UI.esc(f.name);
    A.play('tap');
    const v = await UI.modal({ title: name, html: '<p>' + tr('{0} is visiting. {0} will head home in {1}.', name, UI.mins(f.leaveAt - Date.now())) + '</p>',
      actions: [{ label: tr('Cuddle'), value: 'cuddle' }, { label: tr('Send home'), value: 'home' }, { label: tr('Close'), value: 0 }] });
    const ps = visitors[i];
    if (v === 'cuddle' && ps && !ps.leaving) {
      if (!ps.asleep) { ps.gesture('happy', true); ps.petting = 0.8; ps.topA.getWorldPosition(v1); FX.hearts(v1, 2); }
      A.play('squeak'); buzz(8);
    } else if (v === 'home') {
      if (!S.sendHome(state, i, Date.now()).ok) return;
      S.save(state); visitorLeaves(i, true);
      UI.toast(tr('{0} waves goodbye and swims home.', name), 'heart', '', 3800);
      UI.refresh(); if (UI.sheetName) UI.renderSheet();
    }
  };

  async function birth() {
    G.busy = true;
    UI.closeSheet();
    A.play('sparkle');
    seal.gesture('surprise');
    await UI.modal({ title: tr('A surprise in the den'), html: tr('<p>{0} has had a pup of her own: a tiny white kuutti.</p><p>Pups feed from their mother, so keep her tummy above a third. A hungry mother means a hungry pup.</p>', plain()),
      actions: [{ label: tr('Oh my!'), value: 1 }] });
    const name = await UI.askName({ title: tr('Name the pup'), text: tr('What will the little one be called?'), ok: tr('Welcome, little one') });
    const p = S.addPup(state, Date.now(), name);
    let twin = null;
    if (Math.random() < T.twinChance) {   // now and then there are two
      await UI.modal({ title: tr('Twins!'), html: tr('<p>There is a second kuutti curled up beside the first.</p>'), actions: [{ label: tr('Twice the fluff'), value: 1 }] });
      const name2 = await UI.askName({ title: tr('Name the twin'), text: tr('What will the twin be called?'), ok: tr('Welcome, little one') });
      twin = S.addPup(state, Date.now(), name2);
    }
    syncPups();
    const ps = pups[p.id];
    const pt = twin && pups[twin.id];
    if (pt) { const d = W.DEN; pt.place(d.sleep.x + 0.6, W.groundY(d.sleep.x + 0.6, d.sleep.z), d.sleep.z, d.heading); pt.gesture('happy'); }
    if (ps) {
      const d = W.DEN;
      ps.place(d.sleep.x, W.groundY(d.sleep.x, d.sleep.z), d.sleep.z, d.heading);
      ps.gesture('happy');
    }
    A.play('grow'); seal.gesture('happy'); FX.hearts(head(), 6);
    S.save(state); UI.refresh();
    G.busy = false;
  }

  G.pupInfo = async function (i) {
    const p = state.pups[i];
    if (!p || UI.modalOpen) return;
    A.play('tap');
    const left = Math.max(0, S.T.pupGrow - p.grownMs);
    const how = p.sick ? tr('Poorly from hunger. Feed {0} well so she can nurse, and give cloudberry juice.', plain())
      : p.ready ? tr('Big and strong, and ready to swim off into the lake.')
        : p.food < 20 ? tr('Hungry. Pups feed from their mother whenever her tummy is above a third.')
          : tr('Growing well. About {0} of good care to go.', span(left));
    const acts = [{ label: tr('Cuddle'), value: 'cuddle' }];
    if (p.ready) acts.unshift({ label: tr('Wave goodbye'), value: 'go' });
    acts.push({ label: tr('Close'), value: 0 });
    const v = await UI.modal({ title: UI.esc(p.name), html: '<p>' + how + '</p><p>' + tr('Tummy <b>{0}%</b>, happiness <b>{1}%</b>.', Math.round(p.food), Math.round(p.joy)) + '</p>', actions: acts });
    const idx = state.pups.indexOf(p);
    if (v === 'cuddle' && idx >= 0) cuddle(idx);
    else if (v === 'go' && idx >= 0) graduate(idx);
  };
  function cuddle(i) {
    const p = state.pups[i], ps = p && pups[p.id];
    if (!ps) return;
    S.cuddlePup(state, i, Date.now());
    if (ps.asleep) return;
    ps.gesture('happy', true); ps.petting = 0.8;
    ps.topA.getWorldPosition(v1); FX.hearts(v1, 2);
    A.play('squeak'); buzz(8);
  }
  async function graduate(i) {
    const p = state.pups[i], ps = p && pups[p.id];
    if (!ps || blocked()) return;
    const r = S.graduatePup(state, i, Date.now());
    if (!r.ok) return;
    G.busy = true;
    ps.leaving = true; ps.asleep = false;
    ps.gesture('wave', true); A.play('chirp');
    seal.gesture('wave');
    await wait(1.4);
    const e = holeEdge(ps, v2).clone();
    await ps.moveTo(e.x, e.z, { speed: 2.4 });
    await plunge(ps);
    const id = Object.keys(pups).find((k) => pups[k] === ps);
    if (id) removePup(id);
    UI.toast(tr('<b>{0}</b> swims off into the lake. Hei hei! +{1} coins', UI.esc(r.name), r.coins), 'star', '', 5200);
    A.play('award');
    S.save(state); UI.refresh();
    G.busy = false;
  }

  /* ---------- the ice hole ---------- */
  function holeEdge(s, out) {
    const dx = W.HOME.x - W.HOLE.x, dz = W.HOME.z - W.HOLE.z, d = Math.hypot(dx, dz), far = (W.holeRadius || 0.82) + 0.13 + 0.85 * s.size;
    return out.set(W.HOLE.x + dx / d * far, 0, W.HOLE.z + dz / d * far);
  }
  async function plunge(s) {
    const p0 = s.g.position.clone(), c = W.HOLE;
    s.g.rotation.order = 'YXZ';                      // turn first, then tip, so the nose goes down the hole
    s.heading = Math.atan2(c.x - p0.x, c.z - p0.z);
    await wait(0.35);
    s.freeY = true; s.shadow.visible = false;
    s.gesture('hop', true); A.play('whoosh');
    await tween(0.55, (k) => {
      s.g.position.set(U.lerp(p0.x, c.x, k), p0.y + (Math.sin(k * Math.PI) * 0.95 - k * k * 1.5) * s.size, U.lerp(p0.z, c.z, k));
      s.g.rotation.x = k * 1.3;
    });
    s.g.visible = false;
    FX.splash(v1.set(c.x, 0.1, c.z), 16); A.play('splash');
  }
  async function surface(s, edge) {
    const c = W.HOLE;
    s.g.visible = true;
    s.g.rotation.order = 'YXZ';
    s.g.rotation.x = -1.1;
    s.g.position.set(c.x, -1.7 * s.size, c.z);
    FX.splash(v1.set(c.x, 0.1, c.z), 12); A.play('splash');
    await tween(0.4, (k) => { s.g.position.y = U.lerp(-1.7, -0.72, ease(k)) * s.size; });
    await tween(1.0, (k) => { s.g.position.y = (-0.72 + 0.05 * Math.sin(k * Math.PI * 3)) * s.size; });
    A.play('whoosh');
    await tween(0.5, (k) => {
      s.g.position.set(U.lerp(c.x, edge.x, k), -0.72 * s.size * (1 - k) + Math.sin(k * Math.PI) * 0.75 * s.size, U.lerp(c.z, edge.z, k));
      s.g.rotation.x = -1.1 * (1 - k);
    });
    s.g.rotation.x = 0; s.freeY = false; s.shadow.visible = true;
    FX.puff(v1.copy(s.g.position), 5, 0xffffff, 0.4);
  }

  G.dive = async function () {
    if (blocked()) return;
    const now = Date.now(), can = S.canDive(state, now);
    if (!can.ok) {
      if (can.why === 'wait') { A.play('nope'); UI.toast(tr('{0} is catching a breath. Ready in {1}.', nm(), UI.mins(state.dive.readyAt - now)), 'clock'); }
      else refuse(can.why);
      return;
    }
    UI.closeSheet();
    G.busy = true; UI.setBusy(true);
    seal.sulk = false;
    const e = holeEdge(seal, v2).clone();
    await seal.moveTo(e.x, e.z, { speed: 2.3 });
    await plunge(seal);
    const loot = S.diveResult(state, now);
    syncDirt();
    for (let i = 0; i < 5; i++) {
      await wait(0.42);
      FX.bubbles(v1.set(W.HOLE.x + rs(0.3), 0.1, W.HOLE.z + rs(0.3)), 2); A.play('bubble');
    }
    let carried = null;
    if (loot.kind === 'fish' || loot.kind === 'trinket') {
      carried = PN.Props.item(loot.id);
      carried.scale.multiplyScalar(loot.kind === 'fish' ? 0.8 : 1);
      seal.mouthA.add(carried);
    }
    seal.heading = Math.atan2(e.x - W.HOLE.x, e.z - W.HOLE.z);
    seal.g.rotation.y = seal.heading;
    await surface(seal, e);
    seal.gesture('shake', true);
    FX.splash(head(), 6);
    await wait(0.9);
    await showLoot(loot);
    if (carried) seal.mouthA.remove(carried);
    if (loot.sulked) { seal.sulk = true; seal.gesture('no'); A.play('hmph'); UI.toast(tr(['{0} got nipped by a crab and came up Angy.', '{0} got bitten down there and is Angy.', '{0} got her flippers tangled in weed and came up Angy.', '{0} was spooked by a big shadow under the ice and is Angy.', '{0} swallowed a mouthful of icy water and is Angy.', '{0} got stuck in the ice hole on the way out and is Angy.'][Math.floor(Math.random() * 6)], nm()), 'grump'); }
    else { seal.gesture('happy'); A.play('chirp'); }
    await seal.moveTo(W.HOME.x, W.HOME.z, { speed: 2.0, face: W.HOME_HEADING });
    G.busy = false; UI.setBusy(false);
    S.save(state); UI.refresh();
  };

  const RARE = ['', 'common', 'uncommon', 'rare', 'very rare', 'legendary'];
  function showLoot(loot) {
    if (loot.kind === 'none') {
      A.play('bubble');
      return UI.modal({ title: tr('Nothing this time'), html: '<p>' + tr('Just a nose full of cold water. The lake keeps its secrets for now.') + '</p>', actions: [{ label: tr('Next time'), value: 1 }] });
    }
    if (loot.kind === 'coins') {
      A.play('coin'); FX.coins(head(), 6);
      return UI.modal({ title: tr('Sunken coins'), html: '<div class="bigscore">+' + loot.n + '</div><p>' + tr('{0} came up with a flipperful of coins.', plain()) + '</p>', actions: [{ label: 'Kiitos!', value: 1 }] });
    }
    const it = PN.items[loot.id], rare = tr(RARE[it.rarity]);
    A.play(loot.isNew ? 'award' : 'sparkle');
    if (loot.isNew) FX.sparkle(head(), 12);
    const what = PN.isFi() ? rare.charAt(0).toUpperCase() + rare.slice(1) + (loot.n > 1 ? ', ' + loot.n + ' kpl' : '') + '.'
      : '<b>' + UI.esc(it.en) + '</b>' + (loot.n > 1 ? ' × ' + loot.n : '') + ', ' + rare + '.';
    let html = '<p>' + what + (loot.isNew ? tr(' New for the album!') : '') + '</p><p>' + UI.esc(PN.itemNote(it)) + '</p>';
    if (loot.coins) html += '<div class="loot">' + coinChip(loot.coins) + '</div><p>' + tr('{0} found some coins too.', plain()) + '</p>';
    return UI.modal({ art: PN.Thumbs.get(loot.id), title: UI.esc(it.fi), html, actions: [{ label: tr(loot.kind === 'fish' ? 'Into the larder' : 'Into the album'), value: 1 }] });
  }

  /* ---------- looking after the seal ---------- */
  const WHY = { asleep: '{0} is fast asleep.', sick: '{0} is poorly and needs rest.', sulk: '{0} is Angy and will not play.', tired: '{0} is too tired for that.', wait: 'Not just yet.' };
  const whyText = (why) => tr(WHY[why] || WHY.wait, nm());
  function refuse(why) {
    A.play('nope');
    if (!seal.asleep && why !== 'asleep') seal.gesture('no');
    if (why === 'sulk' && state.medLate) { UI.toast(tr('{0} is Anxi and will not play. She needs her medicine.', nm()), 'anxi'); return; }
    UI.toast(whyText(why), why === 'asleep' ? 'zzz' : why === 'sick' ? 'med' : why === 'sulk' ? 'grump' : 'clock');
  }

  /* Food flies in from the bottom of the screen and lands in the mouth. */
  function toss(id, then) {
    const m = PN.Props.item(id);
    seal.mouthA.getWorldPosition(v2);
    const from = W.camera.position.clone().lerp(v2, 0.72);
    from.y -= 1.1 + 0.5 * seal.size;
    const s0 = m.scale.x;
    m.position.copy(from);
    W.scene.add(m);
    tween(0.42, (k) => {
      seal.mouthA.getWorldPosition(v2);
      m.position.lerpVectors(from, v2, k);
      m.position.y += Math.sin(k * Math.PI) * 0.45;
      m.rotation.z = k * 5;
      m.scale.setScalar(s0 * (1 - 0.35 * k));
    }).then(() => { W.scene.remove(m); then(); });
  }

  G.feed = function (id) {
    if (G.busy || PN.Games.active) return;
    const r = S.feed(state, id), it = PN.items[id];
    if (!r.ok) {
      A.play('nope');
      if (r.why === 'asleep' && it && it.full) UI.toast(tr('{0} is fast asleep. Coffee is for when she is awake.', nm()), 'zzz');
      else if (r.why === 'asleep') UI.toast(whyText('asleep') + tr(' Wake first, or wait for morning.'), 'zzz');
      else if (r.why === 'notsick') UI.toast(tr('Nobody is poorly. Save the juice for a rainy day.'), 'med');
      return;
    }
    A.play('pop');
    seal.sulk = state.grudge > 0 && !state.medLate; seal.scared = !!state.medLate;
    toss(id, () => {
      if (r.med) {
        seal.gesture('gulp', true); A.play('gulp'); FX.sparkle(head(), 10, 0xffc04a);
        return;
      }
      const awake = !seal.asleep;
      if (it.full) { seal.gesture('gulp', true); A.play('gulp'); A.play('chirp'); FX.sparkle(head(), 14, 0xffc04a); FX.hearts(head(), 3); seal.gesture('happy'); }
      else if (it.energy) { if (awake) seal.gesture('gulp', true); A.play('gulp'); A.play('squeak', 0.4); FX.sparkle(head(), 6, 0xffc04a); }
      else { if (awake) seal.gesture('chomp', true); A.play('munch'); }
      if (r.fav) { FX.hearts(head(), 4); A.play('chirp'); if (awake) seal.gesture('happy'); }
      else if (it.kind === 'food' && !it.full) FX.hearts(head(), 1);
      if (!awake) FX.zzz(head());
      buzz(10);
    });
    if (r.treat) UI.toast(tr('{0} wanted that one.', nm()), 'heart');
    if (r.med) UI.toast(tr('Cloudberry juice works wonders.'), 'med');
    else if (r.fav && state.counters.feeds < 400 && Math.random() < 0.35) UI.toast(tr('{0}, the favourite!', UI.esc(it.fi)), 'heart');
    UI.renderSheet(); UI.refresh();
  };

  G.borrow = function () {
    const r = S.borrow(state, Date.now());
    if (!r.ok) { A.play('nope'); return; }
    A.play('sparkle');
    UI.toast(r.n && r.juice ? tr('The neighbours left {0} vendace and a bottle of cloudberry juice on the ice. Kiitos!', r.n)
      : r.juice ? tr('The neighbours left a bottle of cloudberry juice on the ice. Kiitos!') : tr('The neighbours left {0} vendace on the ice. Kiitos!', r.n), r.juice ? 'med' : 'fish', '', 4200);
    UI.renderSheet(); UI.refresh(); save();
  };

  G.sleepToggle = function () {
    if (blocked() || bedBusy) return;
    const now = Date.now(), h = new Date().getHours();
    if (state.asleep) {
      const r = S.wake(state);
      if (!r.ok) return;
      if (r.grumpy) UI.toast(tr('{0} was not done sleeping.', nm()), 'grump');
      else if (h >= 5 && h < 11) { UI.toast('Hyvää huomenta, ' + plain() + '!', 'sun'); S.learn(state, 'huomenta'); }
    } else {
      const r = S.tuck(state, now);
      if (!r.ok) { A.play('nope'); seal.gesture('no'); UI.toast(tr('{0} is not sleepy yet.', nm()), 'zzz'); return; }
      UI.toast(r.night ? 'Hyvää yötä, ' + plain() + '.' : tr('Time for a nap.'), 'moon');
    }
    UI.closeSheet(); UI.refresh();
  };

  /* The sauna is how she gets clean: the Löyly game, free, for as many rounds as it takes to finish the job. */
  G.sauna = function () {
    if (blocked() || bedBusy || PN.Games.active) return;
    const c = S.canSauna(state);
    if (!c.ok) {
      if (c.why === 'clean') { A.play('nope'); seal.gesture('happy'); UI.toast(tr('{0} is already squeaky clean.', nm()), 'bubbles'); }
      else refuse(c.why);
      return;
    }
    seal.halt();
    PN.Games.opts = { need: S.saunaNeed(state) };
    PN.Games.start('sauna');
  };

  /* ---------- the ball ---------- */
  const ball = { v: new T.Vector3(), rest: true, lookT: 0, hitAt: 0 };
  const BALL_R = 0.24;
  function resetBall() {
    const m = W.ball;
    m.visible = true; m.scale.setScalar(1);
    m.position.set(W.BALL.x, W.groundY(W.BALL.x, W.BALL.z) + BALL_R, W.BALL.z);
    ball.v.set(0, 0, 0); ball.rest = true; ball.lookT = 0;
  }
  function kick(vx, vy, vz) { ball.v.set(vx, vy, vz); ball.rest = false; ball.lookT = 2.6; }
  function moveBall(dt) {
    if (ball.rest || PN.Games.active) return;
    const m = W.ball, p = m.position;
    ball.v.y -= 9.5 * dt;
    p.addScaledVector(ball.v, dt);
    if (p.x < -2.3) { p.x = -2.3; ball.v.x = Math.abs(ball.v.x) * 0.6; } else if (p.x > 2.5) { p.x = 2.5; ball.v.x = -Math.abs(ball.v.x) * 0.6; }
    const zMin = -1.5 + 0.42 * p.x + 0.9;
    if (p.z < zMin) { p.z = zMin; ball.v.z = Math.abs(ball.v.z) * 0.6; } else if (p.z > 2.1) { p.z = 2.1; ball.v.z = -Math.abs(ball.v.z) * 0.6; }
    // off the seal's back, like a beach ball
    const sp = seal.g.position, rad = 0.78 * seal.size + BALL_R;
    v1.set(p.x - sp.x, p.y - (sp.y + 0.45 * seal.size), p.z - sp.z);
    const dist = v1.length();
    if (dist < rad && dist > 0.001 && seal.g.visible) {
      v1.multiplyScalar(1 / dist);
      p.addScaledVector(v1, rad - dist);
      const vn = ball.v.dot(v1);
      if (vn < 0) ball.v.addScaledVector(v1, -1.6 * vn);
      if (t - ball.hitAt > 0.4) { ball.hitAt = t; A.play('boing', 0.2); if (!seal.asleep) seal.gesture('boop'); }
    }
    const gy = W.groundY(p.x, p.z) + BALL_R;
    if (p.y <= gy) {
      p.y = gy;
      if (ball.v.y < -1.4) { ball.v.y *= -0.55; A.play('tap', 0.08); }
      else ball.v.y = 0;
      const f = Math.exp(-2.4 * dt);
      ball.v.x *= f; ball.v.z *= f;
      if (ball.v.lengthSq() < 0.012) { ball.rest = true; ball.v.set(0, 0, 0); }
    }
    m.rotation.z -= ball.v.x * dt / BALL_R; m.rotation.x += ball.v.z * dt / BALL_R;
  }

  G.playBall = async function (tapped) {
    if (blocked() || bedBusy) return;
    const r = S.playBall(state, Date.now());
    if (!r.ok) { refuse(r.why); return; }
    if (tapped === true) {
      kick(rs(1.5), 4.3 + Math.random() * 1.2, rs(0.9));
      A.play('boing');
      seal.gesture(Math.random() < 0.5 ? 'hop' : 'clap'); A.play('chirp', 0.8);
    } else {
      G.busy = true;
      const b = W.ball.position, sp = seal.g.position;
      let dx = sp.x - b.x, dz = sp.z - b.z;
      const d = Math.hypot(dx, dz) || 1, gap = 0.95 * seal.size + 0.45;
      dx /= d; dz /= d;
      await seal.moveTo(b.x + dx * gap, b.z + dz * gap, { speed: 2.4 });
      seal.heading = Math.atan2(-dx, -dz);
      await wait(0.3);
      seal.gesture('boop', true); A.play('boing');
      kick(-dx * 1.3 + rs(0.6), 5.0, -dz * 0.6 + rs(0.5));
      await wait(0.7);
      seal.gesture('happy'); A.play('chirp');
      G.busy = false;
    }
    UI.refresh();
  };

  /* ---------- mini-games ---------- */
  G.unlockGame = async function (id) {
    const g = PN.GAMES[id], title = tr(g.title), cost = S.price(state, g.price);
    if (state.coins < cost) { A.play('nope'); UI.toast(tr('Not enough coins yet. Games and dives earn more.'), 'coin', 'bad'); return; }
    const v = await UI.modal({ title, html: '<p>' + tr('Unlock {0} for {1} coins?', title, cost) + '</p>', actions: [{ label: tr('Unlock'), value: 1 }, { label: tr('Not now'), value: 0 }] });
    if (v !== 1) return;
    const r = S.unlockGame(state, id);
    if (!r.ok) { A.play('nope'); return; }
    A.play('award'); FX.sparkle(head(), 10); save();
    W.setDecor(state.placed);
    UI.toast(tr('{0} unlocked!', title), 'coin');
    UI.renderSheet(); UI.refresh();
  };
  G.skipGame = function (id) {
    const on = state.skip.indexOf(id) < 0, r = S.setSkip(state, id, on, Date.now());
    if (!r.ok) { A.play('nope'); if (r.why === 'full') UI.toast(tr('Only {0} games can be left out. Put one back first.', S.T.skipMax), 'play', 'bad'); return; }
    A.play('tap'); save();
    UI.renderSheet();
  };
  G.startGame = function (id) {
    if (blocked() || bedBusy) return;
    if (!S.gameOwned(state, id)) return;
    const c = S.canPlay(state);
    if (!c.ok) { refuse(c.why); return; }
    seal.halt();
    PN.Games.start(id);
  };
  G.endGame = async function (id, score, r) {
    W.stage(false); W.setCamMode('home');
    UI.showHud(true);
    resetBall();
    seal.look = null;
    seal.moveTo(W.HOME.x, W.HOME.z, { speed: 2.2, face: W.HOME_HEADING });
    UI.refresh();
    if (!r) return;
    if (id === 'sauna') { await saunaResult(r); return; }
    const gm = PN.GAMES[id], lost = gm.low && !score;      // a timed game: the score is the seconds it took, and none means it was lost
    seal.gesture(lost ? 'sad' : r.best ? 'happy' : 'clap'); A.play(lost ? 'sad' : r.best ? 'award' : 'coin');
    const title = tr(gm.title);
    const unit = tr(gm.unit || (id === 'catch' ? 'fish caught' : (score === 1 ? 'bounce' : 'bounces')));
    let html = lost ? '<p>' + tr('You woke a pufferfish. No coins this time.') + '</p>'
      : '<div class="bigscore">' + (gm.low ? PN.mmss(score) : score) + '</div><p>' + unit + (r.best ? tr('. <b>A new best!</b>') : '.') + '</p><div class="loot">' + coinChip(r.coins)
      + r.fish.map((f) => itemChip(f.id, f.n)).join('') + '</div>';
    // why the coins are what they are: her taste for this game, and muck
    // why the coins are what they are: how happy she was, and muck; then what this game did to her happiness
    if (!lost && r.happy > 0) html += '<p class="note up">' + UI.ic('smile') + tr('Happy seal: +{0}% coins.', r.happy) + '</p>';
    if (r.joy > 0) html += '<p class="note up">' + UI.ic('up') + tr('{0} loved that: happiness +{1}.', UI.esc(state.name), r.joy) + '</p>';
    else if (r.joy < 0) html += '<p class="note down">' + UI.ic('down') + tr('{0} is tired of this one: happiness −{1}.', UI.esc(state.name), -r.joy) + '</p>';
    if (!lost && r.muck > 0) html += '<p class="note down">' + tr('She is mucky: −{0}% coins. Time for a sauna.', r.muck) + '</p>';
    const fresh = r.fish.filter((f) => f.isNew).map((f) => UI.esc(PN.items[f.id].fi));
    if (fresh.length) html += '<p>' + tr('New for the album: {0}.', fresh.join(', ')) + '</p>';
    else if (r.fish.length) html += '<p>' + tr('The catch goes in the larder.') + '</p>';
    const again = S.canPlay(state).ok;
    const v = await UI.modal({ title, html, actions: (again ? [{ label: tr('Play again'), value: 1 }] : []).concat([{ label: tr(again ? 'Enough for now' : 'Lovely'), value: 0 }]) });
    save();
    if (v === 1) G.startGame(id);
  };

  async function saunaResult(r) {
    seal.gesture(r.rounds ? 'happy' : 'sad'); A.play(r.rounds ? (r.full ? 'award' : 'coin') : 'sad');
    if (r.rounds) { for (let i = 0; i < 7; i++) { v1.copy(seal.g.position); v1.y += 0.5 * seal.size; FX.steam(v1); } syncDirt(); }
    let html = '<div class="bigscore">' + r.clean + '%</div><p>' + tr('Cleanliness') + '.</p>' + (r.coins > 0 ? '<div class="loot">' + coinChip(r.coins) + '</div>' : '');
    html += '<p class="note ' + (r.rounds ? 'up' : 'down') + '">' + (r.full ? tr('Ahh. Warm, clean and happy.') : r.rounds ? tr('Cleaner, but not spotless. Another go will finish the job.') : tr('The heat got away before a single round. No clean this time.')) + '</p>';
    const again = !r.full && S.canSauna(state).ok;
    const v = await UI.modal({ title: tr('Löyly'), html, actions: (again ? [{ label: tr('Another go'), value: 1 }] : []).concat([{ label: tr(again ? 'Enough for now' : 'Lovely'), value: 0 }]) });
    save();
    if (v === 1) G.sauna();
  }

  /* ---------- shop ---------- */
  let choosingCosmetic = false;
  G.cosmetic = async function (id) {
    if (choosingCosmetic) return;
    const it = PN.items[id];
    if (!it || it.kind !== 'wear') return;
    choosingCosmetic = true;
    try {
      const seals = [{ id: null, name: state.name, owned: state.owned, wear: state.wearing }]
        .concat(state.pups.map((p) => ({ id: p.id, name: p.name, owned: p.owned || {}, wear: p.wear || {} })));
      const actions = seals.map((p) => {
        const own = p.owned[id] || Object.values(p.wear).includes(id);
        const label = own ? tr(p.wear[it.slot] === id ? 'Take off' : 'tag|Wear') : tr('Buy for {0} coins', S.price(state, it.price));
        return { label: UI.esc(p.name) + ' — ' + label, value: p.id };
      });
      actions.push({ label: tr('Cancel'), value: 'cancel' });
      const target = await UI.modal({ title: tr('Who is this for?'), art: PN.Thumbs.get(id), actions });
      if (target === 'cancel') return;
      const p = seals.find((p) => p.id === target);
      if (!p || (target != null && !state.pups.some((q) => q.id === target))) return;
      if (p.owned[id] || Object.values(p.wear).includes(id)) G.wear(id, target);
      else G.buy(id, target);
    } finally { choosingCosmetic = false; }
  };
  G.buy = function (id, target) {
    if (PN.items[id] && PN.items[id].kind === 'wear' && target === undefined && state.pups.length) return G.cosmetic(id);
    const r = S.buy(state, id, target), it = PN.items[id];
    if (!r.ok) {
      A.play('nope');
      UI.toast(tr(r.why === 'coins' ? 'Not enough coins yet. Games and dives earn more.' : 'That one is already yours.'), 'coin', 'bad');
      return;
    }
    A.play('coin');
    if (it.kind === 'wear') {
      if (target != null) { const p = state.pups.find((p) => p.id === target); if (p) dressPup(p); }
      else seal.setWear(it.slot, state.wearing[it.slot]);
      if (!seal.asleep) { seal.gesture('happy'); A.play('chirp'); }
      FX.sparkle(head(), 10);
    } else if (it.kind === 'decor') {
      W.setDecor(state.placed);
      W.decorAt(id, v1); v1.y += 0.6;
      FX.sparkle(v1, 12);
      UI.toast(tr('{0} is out on the shore.', UI.esc(it.fi)) + (r.away ? ' ' + tr('{0} is tidied away to make room.', UI.esc(PN.items[r.away].fi)) : ''), 'home');
    }
    UI.renderSheet(); UI.refresh(); save();
  };
  G.wear = function (id, target) {
    if (target === undefined && state.pups.length) return G.cosmetic(id);
    const r = S.wear(state, id, target), it = PN.items[id];
    if (!r.ok) return;
    A.play('pop');
    if (target != null) { const p = state.pups.find((p) => p.id === target); if (p) dressPup(p); }
    else seal.setWear(it.slot, state.wearing[it.slot]);
    if (r.on) FX.sparkle(head(), 6);
    UI.renderSheet(); save();
  };
  G.place = function (id) {
    const r = S.place(state, id);
    if (!r.ok) return;
    A.play('pop');
    W.setDecor(state.placed);
    if (r.on) { W.decorAt(id, v1); v1.y += 0.6; FX.sparkle(v1, 8); }
    if (r.away) UI.toast(tr('{0} is tidied away to make room.', UI.esc(PN.items[r.away].fi)), 'home');
    UI.renderSheet(); save();
  };

  /* ---------- settings ---------- */
  G.setSetting = function (k, val) {
    state.settings[k] = val;
    if (k === 'lang') UI.setLang(val);
    applySettings();
    A.play('tap');
    UI.renderSheet(); save();
  };
  /* From the first screen, before there is anything to save. */
  G.setLang = function (lang) {
    state.settings.lang = lang;
    UI.setLang(lang);
  };
  G.rename = async function () {
    const name = await UI.askName({ title: tr('A new name'), text: tr('What should {0} be called now?', plain()), initial: state.name, ok: tr('Save name'), cancel: tr('Keep {0}', plain()) });
    if (!name) return;
    state.name = name;
    UI.renderSheet(); UI.refresh(); save();
  };
  G.exportSave = async function () {
    save();
    const code = S.exportCode(state);
    const v = await UI.modal({ title: tr('Your save code'), html: '<p>' + tr('Copy this somewhere safe. On another phone or browser, open Settings and choose Use a save code.') + '</p><textarea class="field" id="codeOut" readonly style="margin-top:12px">' + code + '</textarea>',
      actions: [{ label: tr('Copy the code'), value: 'copy' }, { label: tr('Close'), value: 0 }],
      result(val, card) {
        if (val !== 'copy') return val;
        const ta = card.querySelector('#codeOut');
        ta.select();
        let ok = false;
        try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).catch(() => { /* the old way above usually worked */ });
        return ok || navigator.clipboard ? 'copied' : 'failed';
      } });
    if (v === 'copied') UI.toast(tr('Save code copied.'), 'check');
    else if (v === 'failed') UI.toast(tr('Could not copy here. Press and hold the code to copy it.'), 'book', 'bad', 4500);
  };
  G.importSave = async function () {
    const code = await UI.modal({ title: tr('Use a save code'), html: '<p>' + tr('Paste a code from another device. It replaces the seal on this one.') + '</p><textarea class="field" id="codeIn" placeholder="PN1..." autocomplete="off" spellcheck="false" style="margin-top:12px"></textarea>',
      actions: [{ label: tr('Bring this seal over'), value: 'ok' }, { label: tr('Cancel'), value: 0 }],
      result(val, card) { return val === 'ok' ? card.querySelector('#codeIn').value : null; } });
    if (code == null) return;
    const loaded = S.importCode(code);
    if (!loaded) { A.play('nope'); UI.toast(tr('That code did not work. Check that all of it was copied.'), 'book', 'bad', 4500); return; }
    noSave = true;
    S.save(loaded);
    location.reload();
  };
  /* Look for a newer copy of the game on the web. If there is one, fetch the files fresh, clear the old copies and reload.
     The seal is saved first and nothing in the save changes. */
  let updating = false;
  G.checkUpdate = async function () {
    if (updating) return;
    updating = true;
    const btn = $('titleUpdate'), onTitle = !$('title').hidden;
    const say = (text) => { if (onTitle) { btn.textContent = text; } else UI.toast(text, 'refresh'); };
    if (onTitle) btn.disabled = true;
    say(tr('Checking...'));
    const done = (text, wait) => { say(text); setTimeout(() => { updating = false; if (onTitle) { btn.disabled = false; btn.textContent = tr('Check for updates'); } }, wait || 2600); };
    try {
      const res = await fetch('js/data.js?check=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) throw new Error('status ' + res.status);
      const m = /PN\.UPDATED = '([^']*)'/.exec(await res.text());
      if (!m) throw new Error('no stamp');
      if (!(m[1] > PN.UPDATED)) { done(tr('You have the latest version.')); return; }
      say(tr('Updating...'));
      if (state && !noSave) S.save(state);
      const files = ['./'].concat(Array.prototype.map.call(document.querySelectorAll('script[src], link[rel="stylesheet"]'), (el) => el.getAttribute('src') || el.getAttribute('href')));
      if (window.caches) { const keys = await caches.keys(); await Promise.all(keys.map((k) => caches.delete(k))); }
      if (navigator.serviceWorker) { const regs = await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.map((r) => r.unregister())); }
      await Promise.all(files.map((f) => fetch(f, { cache: 'reload' }).catch(() => null)));
      noSave = true;
      location.reload();
    } catch (e) { done(tr('Could not check. Are you online?'), 3400); }
  };

  /* Developer mode: tap the small print seven times in Settings to find it. */
  let devTaps = 0, devAt = 0;
  G.devTap = function () {
    const now = Date.now();
    devTaps = now - devAt < 2500 ? devTaps + 1 : 1; devAt = now;
    if (devTaps < 7) return;
    devTaps = 0;
    try { localStorage.setItem('pikkunorppa.devshown', '1'); } catch (e) { /* nothing to do */ }
    A.play('award'); UI.toast(tr('Developer mode found.'), 'bolt');
    UI.renderSheet();
  };
  G.devToggle = async function () {
    if (!state.dev) {
      const v = await UI.modal({ title: tr('Developer mode'), html: '<p>' + tr('Everything becomes free. Your save as it is right now is kept safe, and Reset puts it back.') + '</p>',
        actions: [{ label: tr('Turn on'), value: 1 }, { label: tr('Not now'), value: 0 }] });
      if (v !== 1) return;
      if (!S.devOn(state)) { A.play('nope'); UI.toast(tr('Could not keep a copy of the save, so developer mode stays off.'), 'bolt', 'bad', 4500); return; }
      A.play('award');
    } else {
      const v = await UI.modal({ title: tr('Turn off developer mode?'), html: '<p>' + tr('Prices come back. What you have now stays, and the old save is let go.') + '</p>',
        actions: [{ label: tr('Turn off'), value: 1 }, { label: tr('Keep it on'), value: 0 }] });
      if (v !== 1) return;
      S.devOff(state); A.play('tap');
    }
    save(); UI.renderSheet(); UI.refresh();
  };
  /* ---------- her daily medicine ---------- */
  let medBusy = false, medFound = false;
  const medEl = (id) => document.getElementById(id);
  G.openMed = function () {
    const info = S.medInfo(state, Date.now()), box = medEl('medCam');
    if (info.taken) return;
    box.hidden = false; medBusy = false; medFound = false;
    medEl('medPic').hidden = true;
    medEl('medTitle').textContent = tr('Medicine time');
    medEl('medShoot').textContent = tr('Take photo'); medEl('medShoot').disabled = false;
    medEl('medSkip').textContent = tr('I took it'); medEl('medSkip').hidden = info.taken;
    medEl('medMsg').textContent = tr('Take a photo of the pill on a plain surface for {0} bonus coins. Tapping I took it skips the bonus for today.', S.T.medBonus);
  };
  G.closeMed = function () { medEl('medCam').hidden = true; medBusy = false; medFound = false; };
  G.medPhoto = function () { if (!medBusy) { const f = medEl('medFile'); f.value = ''; f.click(); } };   // opens the phone's own camera
  /* the photo, with a ring round the spot where she thinks the pill is */
  function medShow(res) {
    const pic = medEl('medPic'), src = res.canvas;
    if (!src) { pic.hidden = true; return; }
    pic.width = src.width; pic.height = src.height;
    const c = pic.getContext('2d'); c.drawImage(src, 0, 0);
    if (res.ok) {
      const x = res.x * src.width, y = res.y * src.width, r = Math.max(14, res.r * src.width * 1.5), lw = Math.max(3, src.width / 120);
      c.lineWidth = lw + 3; c.strokeStyle = 'rgba(0,0,0,.45)'; c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.stroke();
      c.lineWidth = lw; c.strokeStyle = '#3ddc84'; c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.stroke();
    }
    pic.hidden = false;
  }
  G.medFile = async function (file) {
    if (!file || medBusy) return;
    medBusy = true; medEl('medShoot').disabled = true;
    medEl('medMsg').textContent = tr('Looking at the photo...');
    let res = { ok: false };
    try { res = await PN.Pill.fromFile(file); } catch (err) { res = { ok: false }; }
    medBusy = false; medEl('medShoot').disabled = false;
    if (medEl('medCam').hidden) return;
    medFound = !!res.ok; medShow(res);
    medEl('medShoot').textContent = tr('Retake');
    const info = S.medInfo(state, Date.now());
    if (res.ok) {
      A.play('chirp');
      medEl('medMsg').textContent = tr('Is this the pill? The green ring shows where I found it.');
      medEl('medSkip').textContent = tr('Yes, that is it'); medEl('medSkip').hidden = info.photo;
    } else {
      A.play('nope');
      medEl('medMsg').textContent = tr('I cannot see the pill. Put it on its own on a plain, darker surface, get close, and try again.');
      medEl('medSkip').textContent = tr('I took it'); medEl('medSkip').hidden = info.taken;
    }
  };
  G.medSkip = function () { G.medTaken(medFound); };
  G.medTaken = function (photo) {
    const r = S.takeMed(state, Date.now(), !!photo);
    G.closeMed();
    if (!r.ok) return;
    A.play(r.coins ? 'award' : 'chirp'); FX.sparkle(head(), 10, 0x7fe0a8);
    if (!seal.asleep) seal.gesture('happy', true);
    UI.toast(r.coins ? tr('{0} took her medicine. +{1} coins for the photo!', nm(), r.coins) : tr('{0} took her medicine.', nm()), r.coins ? 'coin' : 'check', '', 3800);
    UI.refresh(); save();
  };
  G.devMed = function () {
    if (!state.dev) return;
    state.med.day = ''; state.med.photoDay = ''; state.med.since = '2000-01-01';
    state.medLate = false; S.medSync(state, new Date().setHours(12, 30));
    A.play('tap'); UI.closeSheet(); UI.refresh(); save();
  };
  G.devEnergy = function () {
    if (!state.dev) return;
    state.stats.energy = 100;
    A.play('sparkle'); FX.sparkle(head(), 8, 0xffc04a);
    UI.refresh(); UI.renderSheet(); save();
  };
  /* Developer pup tools: the whole baby cycle on demand, so it can be seen without waiting days. */
  function dressPup(p) {
    const ps = pups[p.id];
    if (ps) ['head', 'neck', 'face', 'back'].forEach((slot) => ps.setWear(slot, (p.wear || {})[slot] || null));
  }
  G.devPup = async function (what) {
    if (!state.dev || blocked()) return;
    const P = state.pups, T = S.T;
    if (what === 'visit') {
      const now = Date.now(), i = state.family.findIndex((f) => f.fate === 'grown' && S.visitStatus(f, now) === 'home');
      if (i < 0) { A.play('nope'); UI.toast(tr('No grown-up pups to call yet. Try Say farewell now first.'), 'bolt', 'bad', 4200); return; }
      const f = state.family[i]; f.callAt = now; f.arriveAt = now; f.leaveAt = now + S.T.visitStay; f.paid = false;
      tickVisits(now);
      UI.renderSheet(); save();
      return;
    }
    if (what === 'new') {
      if (P.length >= T.maxPups) { A.play('nope'); UI.toast(tr('Two pups is the most.'), 'bolt', 'bad'); return; }
      if (state.stage < 2) { state.stage = 2; state.ageMs = Math.max(state.ageMs, T.stageAge[1]); }
      state.xp = Math.max(state.xp, S.xpFor(T.pupLevel)); state.pupProg = Math.max(state.pupProg, S.xpFor(T.pupLevel)); state.maxLevel = Math.max(state.maxLevel, T.pupLevel);
      if (state.asleep) S.wake(state);
      syncLook(); UI.closeSheet();
      await birth();
      return;
    }
    if (!P.length) { A.play('nope'); UI.toast(tr('There are no pups yet.'), 'bolt', 'bad'); return; }
    if (what === 'ready') {
      P.forEach((p) => { p.grownMs = Math.max(p.grownMs, T.pupGrow); p.ready = true; p.sick = false; p.starveMs = 0; });
      A.play('sparkle');
    } else if (what === 'bye') {
      const i = Math.max(0, P.findIndex((p) => p.ready));
      P[i].grownMs = Math.max(P[i].grownMs, T.pupGrow); P[i].ready = true; P[i].sick = false; P[i].starveMs = 0;
      UI.closeSheet();
      await graduate(i);
      return;
    } else if (what === 'dress') {
      P.forEach((p) => { p.wear = null; });
      P.forEach((p) => { p.wear = S.pupLook(state); dressPup(p); });
      A.play('sparkle');
    } else if (what === 'sick') {
      P.forEach((p) => { p.food = 0; p.sick = true; p.starveMs = Math.max(p.starveMs, T.pupStarveToSick + 1); });
      A.play('nope');
    } else if (what === 'heal') {
      P.forEach((p) => { p.food = 100; p.joy = 100; p.sick = false; p.starveMs = 0; });
      A.play('chirp');
    }
    UI.refresh(); UI.renderSheet(); save();
  };
  G.devReset = async function () {
    const v = await UI.modal({ title: tr('Reset to before developer mode?'), html: '<p>' + tr('Everything goes back to how it was just before developer mode was turned on, and developer mode switches off.') + '</p>',
      actions: [{ label: tr('Reset'), value: 1 }, { label: tr('Cancel'), value: 0 }] });
    if (v !== 1) return;
    noSave = true;
    if (!S.devRestore()) { noSave = false; A.play('nope'); UI.toast(tr('There is no earlier save to go back to.'), 'bolt', 'bad', 4500); return; }
    location.reload();
  };
  /* Every game's best score back to zero; coins, the shop and the album are left alone. */
  G.resetScores = async function () {
    const v = await UI.modal({ title: tr('Reset high scores?'), html: '<p>' + tr('Every game\'s best score goes back to zero. Your coins and everything else stay.') + '</p>',
      actions: [{ label: tr('Keep scores'), value: 0 }, { label: tr('Reset'), value: 1 }] });
    if (v !== 1) return;
    const c = state.counters;
    c.bestCatch = 0; c.bestBall = 0; c.bestPairs = 0;
    Object.keys(PN.GAMES).forEach((id) => { const k = PN.GAMES[id].best; if (k) c[k] = 0; });
    A.play('tap'); save(); UI.renderSheet(); UI.refresh();
    UI.toast(tr('High scores reset.'), 'check');
  };
  G.resetGame = async function () {
    const v = await UI.modal({ title: tr('Start over?'), html: '<p>' + tr('This says goodbye to {0} for good, along with the coins, the album and everything on the shore.', plain()) + '</p>',
      actions: [{ label: tr('Keep {0}', plain()), value: 0 }, { label: tr('Start over'), value: 1 }] });
    if (v !== 1) return;
    noSave = true;
    S.wipe();
    location.reload();
  };

  /* ---------- growing up ---------- */
  async function evolve() {
    G.busy = true;
    UI.closeSheet();
    const before = D.STAGES[state.stage];
    seal.gesture('surprise', true); A.play('grow');
    await tween(1.3, (k) => {
      seal.grow = 1 + 0.16 * Math.abs(Math.sin(k * Math.PI * 4)) * k;
      seal.applyScale();
      if (Math.random() < 0.25) FX.sparkle(head(), 1);
    });
    await UI.fade(true);
    S.evolve(state, Date.now());
    seal.grow = 1; seal.setStage(state.stage); seal.applyScale(); syncLook();
    await UI.fade(false);
    const now = D.STAGES[state.stage];
    seal.gesture('happy', true); A.play('level'); FX.sparkle(head(), 14); FX.hearts(head(), 4);
    await UI.modal({ title: tr('{0} has grown!', plain()), html: tr('<p>No longer a {0}. {1} is now a <b>{2}</b>, a {3}.</p>', before.fi, plain(), now.fi, now.en) + '<div class="loot">' + coinChip(S.T.growCoins) + '</div>'
      + (state.stage === 2 ? tr('<p>A happy, well-fed grown seal may one day have a pup of her own.</p>') : ''), actions: [{ label: 'Onnea!', value: 1 }] });
    S.save(state); UI.refresh();
    G.busy = false;
  }

  /* ---------- fingers ---------- */
  const ptrs = new Map();
  let drag = null, pinch = null, lastTapAt = 0, strokeAcc = 0, strokeN = 0;

  /* Small things are hard to hit with a thumb, so a near miss still counts. */
  function pickNear(x, y) {
    const extra = [W.holeWater];
    let hit = W.pick(x, y, extra);
    if (hit) return hit;
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2;
      hit = W.pick(x + Math.cos(a) * 18, y + Math.sin(a) * 18, extra);
      if (hit && (hit.pick.type === 'poop' || hit.pick.type === 'ball')) return hit;
    }
    return null;
  }

  function onDown(e) {
    if (!started || !state.name) return;
    A.unlock();
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { $('gl').setPointerCapture(e.pointerId); } catch (err) { /* fine without */ }
    if (PN.Games.active) { PN.Games.pointer('down', e.clientX, e.clientY); return; }
    if (ptrs.size === 2) {
      const p = Array.from(ptrs.values());
      pinch = { d: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) };
      drag = null;
      return;
    }
    if (UI.sheetName) { UI.closeSheet(); drag = { mode: 'none', moved: 0 }; return; }
    const hit = G.busy ? null : pickNear(e.clientX, e.clientY);
    const onSeal = hit && hit.pick.type === 'seal';
    drag = { mode: onSeal ? (hit.pick.seal.isPup ? 'pup' : 'seal') : 'look', hit, moved: 0, at: performance.now(), x: e.clientX, y: e.clientY };
    strokeAcc = 0;
  }
  function onMove(e) {
    const p = ptrs.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y, d = Math.hypot(dx, dy);
    p.x = e.clientX; p.y = e.clientY;
    if (PN.Games.active) { PN.Games.pointer('move', e.clientX, e.clientY); return; }
    if (pinch && ptrs.size === 2) {
      const q = Array.from(ptrs.values()), nd = Math.hypot(q[0].x - q[1].x, q[0].y - q[1].y);
      if (nd > 10) { W.zoomBy(pinch.d / nd); pinch.d = nd; }
      return;
    }
    if (!drag) return;
    drag.moved += d;
    if (drag.moved < 9) return;
    if (drag.mode === 'seal') stroke(d, e.clientX, e.clientY);
    else if (drag.mode === 'pup') { strokeAcc += d; if (strokeAcc > 70) { strokeAcc = 0; const i = pupIndexOf(drag.hit.pick.seal); if (i >= 0) cuddle(i); } }
    else if (drag.mode === 'look') W.orbit(dx, dy);
  }
  function onUp(e) {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.delete(e.pointerId);
    if (PN.Games.active) { PN.Games.pointer('up', e.clientX, e.clientY); return; }
    if (ptrs.size < 2) pinch = null;
    const dr = drag;
    drag = null;
    if (!dr || ptrs.size) return;
    if (dr.moved < 9 && performance.now() - dr.at < 500 && e.type !== 'pointercancel') tap(dr.hit, dr.x, dr.y);
  }

  function stroke(d, x, y) {
    seal.petting = 0.6;
    strokeAcc += d;
    if (strokeAcc < 58) return;
    strokeAcc = 0; strokeN++;
    const r = S.pet(state, Date.now());
    head(v1); v1.x += rs(0.3) * seal.size; v1.y -= 0.1 * seal.size;
    if (r.asleep) { if (strokeN % 4 === 0) FX.hearts(v1, 1); return; }
    if (r.sulking) {
      if (r.pat) { UI.refresh(); if (UI.sheetName === 'feed') UI.renderSheet(); A.play('tap', 0.2); }
      if (strokeN % 3 === 0) { FX.huff(v1, 1); A.play('hmph', 1.4); }
      return;
    }
    FX.hearts(v1, 1);
    A.play('heart', 0.24);
    buzz(6);
    if (strokeN % 9 === 0) A.play('chirp', 1.5);
  }

  function tap(hit, x, y) {
    if (G.busy) return;
    const type = hit && hit.pick.type, now = performance.now();
    if (!type) {
      if (now - lastTapAt < 380) { W.resetView(); A.play('tap'); }
      lastTapAt = now;
      return;
    }
    if (type === 'seal') {
      const s = hit.pick.seal;
      if (s.visit != null) { G.visitInfo(s.visit); return; }
      if (s.isPup) { const i = pupIndexOf(s); if (i >= 0) { if (state.pups[i].ready) G.pupInfo(i); else cuddle(i); } return; }
      if (seal.asleep) { head(v1); FX.zzz(v1); return; }
      const r = S.pet(state, Date.now());
      if (r.sulking && state.medLate) { seal.gesture('surprise'); A.play('sad'); return; }
      if (r.sulking) { seal.gesture('no'); A.play('hmph'); head(v1); FX.huff(v1, 1); if (r.pat) { UI.refresh(); if (UI.sheetName === 'feed') UI.renderSheet(); } return; }
      seal.gesture('boop', true); A.play('squeak'); FX.hearts(head(), 1); buzz(10);
    } else if (type === 'poop') {
      const i = hit.pick.index;
      W.poopSpot(state.poops[i], v1);
      const r = S.cleanPoop(state, i);
      if (!r.ok) return;
      FX.puff(v1, 6, 0xffffff, 0.3); v1.y += 0.2; FX.sparkle(v1, 5);
      A.play('pop'); A.play('coin', 0.3);
      UI.float('+1', x, y - 20, '#ffd45c');
      poopN = state.poops.length; W.syncPoops(state.poops);
      buzz(8); UI.refresh();
    } else if (type === 'ball') G.playBall(true);
    else if (type === 'hole') G.dive();
    else if (type === 'decor') tapDecor(hit.pick.id);
  }

  function tapDecor(id) {
    W.decorAt(id, v1); v1.y += 0.55;
    if (id === 'lantern') {
      W.lampOverride = !W.env.lamp;
      A.play('tap'); S.learn(state, 'lyhty');
    } else if (id === 'sauna') G.sauna();
    else if (id === 'campfire') { for (let i = 0; i < 8; i++) FX.spark(v1); A.play('whoosh'); }
    else if (id === 'snowman') { FX.puff(v1, 5, 0xffffff, 0.3); A.play('pop'); }
    else if (id === 'feeder') { A.play('chirp'); FX.notes(v1); }
    else if (id === 'xmastree' || id === 'lights') { A.play('jingle'); FX.sparkle(v1, 8, 0xffe08a); }
    else if (id === 'iceheart') { A.play('heart'); FX.hearts(v1, 3); }
    else if (id === 'flag' || id === 'teltta') A.play('whoosh');
    else if (id === 'sled') A.play('jingle');
    else if (id === 'lumilyhty' || id === 'jaalyhty' || id === 'kurpitsa' || id === 'tahti' || id === 'ulkotulet') { A.play('sparkle'); FX.sparkle(v1, 6, 0xffe08a); }
    else if (id === 'lahjat' || id === 'viirit') { A.play('jingle'); FX.sparkle(v1, 6); }
    else if (id === 'ilmapallot') A.play('boing');
    else if (id === 'poro') { A.play('jingle'); FX.hearts(v1, 2); }
    else if (id === 'joutsen') { A.play('chirp'); FX.notes(v1); }
    else if (id === 'palju') A.play('splash');
    else if (id === 'pilkki') A.play('bubble');
    else if (id === 'luminorppa' || id === 'lumilinna') { FX.puff(v1, 5, 0xffffff, 0.3); A.play('pop'); }
    else A.play('tap');
  }

  function bindInput() {
    const c = $('gl');
    c.addEventListener('pointerdown', onDown);
    c.addEventListener('pointermove', onMove);
    c.addEventListener('pointerup', onUp);
    c.addEventListener('pointercancel', onUp);
    c.addEventListener('wheel', (e) => { e.preventDefault(); if (!PN.Games.active) W.zoomBy(e.deltaY > 0 ? 1.08 : 0.93); }, { passive: false });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('resize', () => W.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => W.resize(), 250));
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') UI.closeSheet(); });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { save(); A.pause(); }
      else { A.resume(); last = performance.now(); simT = 1; }
    });
    window.addEventListener('pagehide', save);
    document.addEventListener('gesturestart', (e) => e.preventDefault());
  }

  /* ---------- the bits of screen that follow the scene ---------- */
  let hudT = 0;
  function hud(dt) {
    let b = null;
    if (G.ready && !G.busy && !PN.Games.active && !state.asleep && !seal.asleep && !bedBusy) {
      const s = state.stats;
      if (state.sick) b = 'med';
      else if (state.medLate) b = 'anxi';
      else if (state.grudge > 0) b = 'grump';
      else if (s.food < 25) b = 'fish';
      else if (s.energy < 20) b = 'zzz';
      else if (s.clean < 25) b = 'drop';
      else if (s.joy < 30) b = 'heart';
      else if (S.isNight(Date.now()) && s.energy < 60) b = 'moon';
    }
    UI.setBubble(b);
    if (b) {
      head(v1); v1.y += 0.2 * seal.size;
      W.screen(v1, scr);
      UI.moveBubble(scr.x, Math.max(150, scr.y));
    }
    hudT -= dt;
    if (hudT > 0) return;
    hudT = 0.2;
    W.cam.sheet = UI.sheetName ? Math.min(0.62, $('sheet').offsetHeight / window.innerHeight) : 0;
    A.setWind(W.env.wind * (0.5 + 0.5 * W.env.precip));
  }

  G.debug = { tween, wait, pups, ball, evolve, birth, welcomeBack, dailyGift, syncLook, syncPups };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 30));
  else setTimeout(boot, 30);
})(window.PN = window.PN || {});
