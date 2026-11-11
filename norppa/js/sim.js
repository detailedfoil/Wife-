/* Pikku Norppa: the pet brain.
   Pure logic with no drawing: needs, real-time catch-up while the game is closed,
   what neglect costs, growing up, pups, rewards and saving. */
(function (PN) {
  'use strict';

  const H = 3600e3, DAY = 24 * H;
  const KEY = 'pikkunorppa.save.v1';
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const pct = (v) => clamp(v, 0, 100);

  /* Tuning. Rates are points per hour on a 0 to 100 scale. */
  const T = {
    earnRate: PN.ECON.earn,
    foodAwake: 7, foodAsleep: 3,
    joyAwake: 5, joyAsleep: 1.5,
    energyAwake: 6, energyAsleep: 14,
    clean: 3.5, cleanPerPoop: 1.5,
    poopEvery: 3.5, maxPoops: 6,
    awayMercy: 0.6,                       // needs fall slower while the game is closed
    grudgePerH: 4, xpLossPerH: 6,         // what an hour at rock bottom costs
    starveToSick: 16 * H, filthToSick: 20 * H, wellToCure: 3 * H,
    nurseMin: 35, nurseGain: 10, nurseCost: 1.5,
    pupFood: 6, pupJoy: 4,
    pupStarveToSick: 18 * H, pupStarveToLost: 42 * H,
    pupGrow: 3 * DAY, pupGap: 2.5 * DAY, firstPupDelay: 18 * H, maxPups: 2,
    stageAge: [1.5 * DAY, 4 * DAY], stageLevel: [4, 7], pupLevel: 8,
    diveCooldown: 15 * 60e3, saunaCooldown: 30 * 60e3,
    maxCatchUp: 14 * DAY,
  };

  /* Things that just happened, for the interface to show. */
  let events = [];
  const emit = (type, data) => { events.push(Object.assign({ type }, data)); };
  const drain = () => { const e = events; events = []; return e; };

  const localHour = (t) => { const d = new Date(t); return d.getHours() + d.getMinutes() / 60; };
  const isNight = (t) => { const h = localHour(t); return h >= 21.5 || h < 7; };
  const dayKey = (t) => {
    const d = new Date(t), p = (n) => (n < 10 ? '0' : '') + n;
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  };

  /* Small seeded random, kept in the save so catch-up is repeatable. */
  function rnd(state) {
    state.seed = (state.seed + 0x6D2B79F5) | 0;
    let a = state.seed;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  }

  function newState(now) {
    const s = {
      v: 1, createdAt: now, lastSeen: now, seed: (now % 2147483647) | 0,
      name: '', stage: 0, ageMs: 0, xp: 0, maxLevel: 1,
      stats: { food: 62, joy: 70, energy: 88, clean: 90 },
      asleep: false, sleepKind: null, wakeAt: 100,
      sick: false, wellMs: 0, starveMs: 0, filthMs: 0,
      grudge: 0, griefUntil: 0, neglectMs: 0,
      poops: [], poopT: 1.5,
      coins: 40, coinCarry: 0,
      pantry: { muikku: 5, ahven: 2 },
      owned: { lantern: true }, placed: { lantern: true },
      wearing: { head: null, neck: null, face: null },
      fish: { muikku: 5, ahven: 2 },
      trinkets: {}, words: {}, awards: {}, seen: {},
      pups: [], family: [], nextPupAt: 0, pupSeq: 0,
      fav: 'muikku', favKnown: false,
      gift: { last: dayKey(now), streak: 1 },
      dive: { readyAt: 0 }, saunaAt: 0, ballAt: 0, handoutAt: 0,
      petWin: { t0: 0, n: 0 }, ballWin: { t0: 0, n: 0 },
      counters: { pets: 0, feeds: 0, washes: 0, tucks: 0, poops: 0, dives: 0, games: 0, balls: 0,
        bestCatch: 0, bestBall: 0, bestPairs: 0, saunas: 0, forgiven: 0, pupsLost: 0, pupsGrown: 0 },
      settings: { sound: true, music: true, sky: 'live', haptics: true },
      tut: 0,
    };
    s.fav = ['muikku', 'kuore', 'ahven', 'sarki', 'siika'][Math.floor(rnd(s) * 5)];
    return s;
  }

  /* Fill in anything an older save is missing. */
  function migrate(obj) {
    const base = newState(obj && obj.createdAt ? obj.createdAt : Date.now());
    const fill = (dst, src) => {
      Object.keys(src).forEach((k) => {
        const v = src[k];
        if (dst[k] === undefined || dst[k] === null && v !== null && typeof v === 'object') dst[k] = v;
        else if (v && typeof v === 'object' && !Array.isArray(v) && typeof dst[k] === 'object' && !Array.isArray(dst[k])
          && ['stats', 'counters', 'settings', 'wearing', 'gift', 'dive', 'petWin', 'ballWin'].indexOf(k) >= 0) fill(dst[k], v);
      });
      return dst;
    };
    return fill(obj, base);
  }

  /* Friendship level from points. */
  const xpFor = (L) => Math.round(30 * Math.pow(Math.max(0, L - 1), 1.6));
  function level(state) {
    let L = 1;
    while (L < 40 && state.xp >= xpFor(L + 1)) L++;
    const a = xpFor(L), b = xpFor(L + 1);
    return { level: L, into: state.xp - a, need: b - a, frac: clamp((state.xp - a) / (b - a), 0, 1) };
  }

  /* Neglect can cost up to two friendship levels, never the whole friendship. */
  const xpFloor = (state) => xpFor(Math.max(1, state.maxLevel - 2));

  function learn(state, id) {
    if (state.words[id] || !PN.DATA.words[id]) return false;
    state.words[id] = 1;
    emit('word', { id });
    return true;
  }

  /* Everything earned goes through here, so the whole economy can be tuned in one place.
     Fractions carry over, so small rewards (like a poo) still pay out now and then. */
  function earn(state, n) {
    const raw = n * T.earnRate + (state.coinCarry || 0);
    const got = Math.floor(raw + 1e-9);
    state.coinCarry = raw - got;
    state.coins += got;
    return got;
  }

  function addXp(state, n) {
    state.xp += n;
    const L = level(state).level;
    while (state.maxLevel < L) {
      state.maxLevel++;
      const coins = earn(state, 10 * state.maxLevel);
      emit('level', { level: state.maxLevel, coins });
    }
    if (L >= 3) learn(state, 'ystava');
    if (L >= 8) learn(state, 'rakas');
  }

  function check(state) {
    PN.DATA.AWARDS.forEach((a) => {
      if (!state.awards[a.id] && a.test(state)) {
        state.awards[a.id] = Date.now();
        state.coins += a.c; /* already scaled in data.js */
        emit('award', { id: a.id });
      }
    });
  }

  /* Calm a sulk. */
  function soothe(state, n) {
    if (state.grudge <= 0) return;
    state.grudge = Math.max(0, state.grudge - n);
    if (state.grudge === 0) {
      state.counters.forgiven++;
      learn(state, 'anteeksi');
      emit('forgiven', {});
    }
  }

  function fallAsleep(state, t, kind, wakeAt) {
    state.asleep = true; state.sleepKind = kind; state.wakeAt = wakeAt;
  }

  function addPoop(state) {
    state.poops.push({ a: rnd(state), r: rnd(state) });
  }

  /* One slice of time. away = the game was closed for this stretch. */
  function step(state, t, dt, away, sum) {
    const h = dt / H, s = state.stats, m = away ? T.awayMercy : 1;
    const night = isNight(t + dt);

    // Dozing off and waking without help.
    if (!state.asleep) {
      if (s.energy <= 6) fallAsleep(state, t, night ? 'night' : 'nap', night ? 100 : 60);
      else if (away && night && s.energy < 70) fallAsleep(state, t, 'night', 100);
    } else if (state.sleepKind === 'night' ? (s.energy >= 99.5 && !night) : s.energy >= state.wakeAt) {
      state.asleep = false; state.sleepKind = null;
    }
    const asleep = state.asleep;
    if (asleep) sum.sleptH += h;

    // Pups feed from their mother, as long as she has enough herself.
    const nursing = state.pups.length > 0 && s.food > T.nurseMin && !state.sick;

    let foodRate = asleep ? T.foodAsleep : T.foodAwake;
    if (nursing) foodRate += T.nurseCost * state.pups.length;
    let joyRate = asleep ? T.joyAsleep : T.joyAwake;
    if (s.food < 20) joyRate *= 1.5;
    if (s.clean < 25) joyRate *= 1.4;
    if (state.sick) joyRate *= 1.5;

    const wasFed = s.food > 20;
    s.food = pct(s.food - foodRate * h * m);
    s.joy = pct(s.joy - joyRate * h * m);
    s.energy = pct(s.energy + (asleep ? T.energyAsleep * (state.sick ? 0.6 : 1) * h : -T.energyAwake * h * m));
    s.clean = pct(s.clean - (T.clean + T.cleanPerPoop * state.poops.length) * (asleep ? 0.5 : 1) * h * m);
    if (wasFed && s.food <= 20) sum.hungry = true;
    if (state.griefUntil > t) s.joy = Math.min(s.joy, 50);
    if (state.sick) s.joy = Math.min(s.joy, 60);

    // Poo arrives on schedule.
    if (!asleep && s.food > 5) {
      state.poopT += h;
      if (state.poopT >= T.poopEvery && state.poops.length < T.maxPoops) {
        state.poopT = 0; addPoop(state); sum.poops++;
      }
    }

    // What being left at rock bottom costs.
    const neglected = s.food <= 0.01 || s.clean <= 0.01 || s.joy <= 0.01;
    if (neglected) {
      state.neglectMs += dt;
      sum.neglectH += h;
      const g0 = state.grudge;
      state.grudge = Math.min(100, state.grudge + T.grudgePerH * h);
      if (g0 <= 0 && state.grudge > 0) sum.sulk = true;
      const lose = Math.max(0, Math.min(state.xp - xpFloor(state), T.xpLossPerH * h));
      state.xp -= lose; sum.xpLost += lose;
    } else if (!state.sick) {
      state.ageMs += dt;                 // growing only counts while cared for
    }

    if (s.food <= 0.01) state.starveMs += dt; else if (s.food > 15) state.starveMs = 0;
    if (s.clean <= 0.01) state.filthMs += dt; else if (s.clean > 15) state.filthMs = 0;
    if (!state.sick && (state.starveMs > T.starveToSick || state.filthMs > T.filthToSick)) {
      state.sick = true; state.wellMs = 0; sum.sick = true;
      if (!away) emit('sick', {});
    }
    if (state.sick) {
      if (s.food > 55 && s.clean > 55) {
        state.wellMs += dt;
        if (state.wellMs >= T.wellToCure) { cure(state); sum.cured = true; }
      } else state.wellMs = 0;
    }

    // Pups.
    for (let i = state.pups.length - 1; i >= 0; i--) {
      const p = state.pups[i];
      if (nursing) p.food = pct(p.food + T.nurseGain * h);
      p.food = pct(p.food - T.pupFood * h * m);
      p.joy = pct(p.joy - T.pupJoy * h * m);
      if (p.food <= 0.01) p.starveMs += dt;
      else if (p.food > 25) p.starveMs = Math.max(0, p.starveMs - 3 * dt);
      if (!p.sick && p.starveMs > T.pupStarveToSick) {
        p.sick = true; sum.pupSick.push(p.name);
        if (!away) emit('pupSick', { name: p.name });
      }
      if (p.sick && p.starveMs > T.pupStarveToLost) {
        state.pups.splice(i, 1);
        state.family.push({ name: p.name, bornAt: p.bornAt, endAt: t + dt, fate: 'lost' });
        state.counters.pupsLost++;
        state.griefUntil = t + dt + DAY;
        const lose = Math.max(0, Math.min(state.xp - xpFloor(state), 60));
        state.xp -= lose; sum.xpLost += lose;
        sum.pupLost.push(p.name);
        if (!away) emit('pupLost', { name: p.name });
        continue;
      }
      if (p.sick && p.food >= 50 && p.starveMs <= 0) { p.sick = false; sum.pupWell.push(p.name); }
      if (!p.sick && p.food > 30) p.grownMs += dt * (1 + 0.25 * p.joy / 100);
      if (!p.ready && p.grownMs >= T.pupGrow) p.ready = true;
    }
  }

  function cure(state) {
    state.sick = false; state.wellMs = 0; state.starveMs = 0; state.filthMs = 0;
    learn(state, 'sisu');
    emit('cured', {});
  }

  /* Move the world forward to now. Returns what happened in between. */
  function advance(state, now, opts) {
    const away = !!(opts && opts.away);
    const sum = { ms: 0, sleptH: 0, poops: 0, neglectH: 0, xpLost: 0, hungry: false, sulk: false,
      sick: false, cured: false, pupSick: [], pupLost: [], pupWell: [] };
    if (!(now > state.lastSeen)) { state.lastSeen = now; return sum; }   // clock went backwards: just carry on
    const span = Math.min(now - state.lastSeen, T.maxCatchUp);
    sum.ms = now - state.lastSeen;
    let t = now - span;
    const stepMs = away ? 5 * 60e3 : 60e3;
    while (t < now) {
      const dt = Math.min(stepMs, now - t);
      step(state, t, dt, away, sum);
      t += dt;
    }
    state.lastSeen = now;
    sum.xpLost = Math.round(sum.xpLost);
    return sum;
  }

  /* ---------- Things the player does ---------- */

  const ok = (extra) => Object.assign({ ok: true }, extra);
  const no = (why) => ({ ok: false, why });

  function giveFish(state, id, n) {
    state.pantry[id] = (state.pantry[id] || 0) + n;
    const isNew = !state.fish[id];
    state.fish[id] = (state.fish[id] || 0) + n;
    return isNew;
  }

  function feed(state, id) {
    const it = PN.items[id], s = state.stats;
    if (!it || !(state.pantry[id] > 0)) return no('none');
    if (it.kind === 'med') {
      if (!state.sick && !state.pups.some((p) => p.sick)) return no('notsick');
      state.pantry[id]--;
      if (state.sick) cure(state);
      state.pups.forEach((p) => {
        if (p.sick) { p.sick = false; p.starveMs = Math.min(p.starveMs, 6 * H); p.food = Math.max(p.food, 45); }
      });
      addXp(state, 3); check(state);
      return ok({ med: true });
    }
    if (state.asleep) return no('asleep');
    if (s.food >= 97) return no('full');
    const before = s.food, fav = id === state.fav;
    state.pantry[id]--;
    s.food = pct(s.food + it.food);
    s.joy = pct(s.joy + (it.joy || 2) + (fav ? 8 : 0));
    if (fav && !state.favKnown) { state.favKnown = true; learn(state, 'herkku'); }
    state.counters.feeds++;
    soothe(state, fav ? 25 : 12);
    addXp(state, before < 85 ? 4 : 1);
    learn(state, 'kala');
    check(state);
    return ok({ fav });
  }

  function pet(state, now) {
    const s = state.stats;
    if (state.asleep) { s.joy = pct(s.joy + 0.2); return ok({ asleep: true }); }
    const sulking = state.grudge > 0;
    s.joy = pct(s.joy + (sulking ? 0.5 : 1.5));
    state.counters.pets++;
    soothe(state, 3);
    if (now - state.petWin.t0 > H) state.petWin = { t0: now, n: 0 };
    if (state.petWin.n < 10) { state.petWin.n++; addXp(state, 1); }
    check(state);
    return ok({ sulking });
  }

  function wash(state) {
    const s = state.stats;
    if (state.asleep) return no('asleep');
    const before = s.clean;
    s.clean = 100; s.joy = pct(s.joy + 4);
    state.filthMs = 0;
    state.counters.washes++;
    soothe(state, 10);
    addXp(state, before < 60 ? 6 : 2);
    learn(state, 'kylpy');
    check(state);
    return ok({});
  }

  function tuck(state, now) {
    const s = state.stats;
    if (state.asleep) return no('asleep');
    if (s.energy > 88) return no('awake');
    const night = isNight(now);
    fallAsleep(state, now, night ? 'night' : 'nap', night ? 100 : 95);
    state.counters.tucks++;
    addXp(state, s.energy < 50 ? 5 : 2);
    learn(state, 'hyvaa_yota'); learn(state, 'pesa');
    check(state);
    return ok({ night });
  }

  function wake(state) {
    const s = state.stats;
    if (!state.asleep) return no('awake');
    state.asleep = false; state.sleepKind = null;
    if (s.energy < 45) { s.joy = pct(s.joy - 6); return ok({ grumpy: true }); }
    return ok({ grumpy: false });
  }

  function cleanPoop(state, i) {
    if (i < 0 || i >= state.poops.length) return no('none');
    state.poops.splice(i, 1);
    state.stats.clean = pct(state.stats.clean + 5);
    earn(state, 1);
    state.counters.poops++;
    addXp(state, 2);
    learn(state, 'kakka');
    check(state);
    return ok({});
  }

  function playBall(state, now) {
    const s = state.stats;
    if (state.asleep) return no('asleep');
    if (state.grudge > 20) return no('sulk');
    if (s.energy < 6) return no('tired');
    const fresh = now - state.ballAt > 20e3;
    state.ballAt = now;
    s.joy = pct(s.joy + (fresh ? 8 : 2));
    s.energy = pct(s.energy - 2);
    state.counters.balls++;
    if (now - state.ballWin.t0 > H) state.ballWin = { t0: now, n: 0 };
    if (fresh && state.ballWin.n < 6) { state.ballWin.n++; addXp(state, 3); }   // fun any time, friendship points a few times an hour
    learn(state, 'pallo');
    check(state);
    return ok({});
  }

  function canPlay(state) {
    if (state.asleep) return no('asleep');
    if (state.sick) return no('sick');
    if (state.grudge > 20) return no('sulk');
    if (state.stats.energy < 12) return no('tired');
    return ok({});
  }

  function canDive(state, now) {
    const c = canPlay(state);
    if (!c.ok) return c;
    if (now < state.dive.readyAt) return no('wait');
    return ok({});
  }

  const FISH_W = [0, 60, 22, 9, 3, 0.7];
  function pickFish(state, maxRarity) {
    const list = PN.DATA.FISH.filter((f) => f.rarity <= (maxRarity || 5));
    let total = 0;
    list.forEach((f) => { total += FISH_W[f.rarity]; });
    let r = rnd(state) * total;
    for (let i = 0; i < list.length; i++) { r -= FISH_W[list[i].rarity]; if (r <= 0) return list[i].id; }
    return list[0].id;
  }

  const TRINKET_W = [0, 50, 26, 12, 5];
  function pickTrinket(state) {
    const list = PN.DATA.TRINKETS;
    const w = list.map((x) => TRINKET_W[x.rarity] * (state.trinkets[x.id] ? 1 : 2.5));
    let r = rnd(state) * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < list.length; i++) { r -= w[i]; if (r <= 0) return list[i].id; }
    return list[0].id;
  }

  /* The seal comes back up from the ice hole. What did it find? */
  function diveResult(state, now) {
    const s = state.stats;
    s.energy = pct(s.energy - 8); s.clean = pct(s.clean + 20); s.joy = pct(s.joy + 6);
    state.dive.readyAt = now + T.diveCooldown;
    state.counters.dives++;
    addXp(state, 4);
    learn(state, 'avanto');
    let r = rnd(state), loot;
    if (state.counters.dives === 1) r = 0.1;          // first dive: fish for certain
    else if (state.counters.dives === 2) r = 0.7;     // second dive: a first treasure
    if (r < 0.56) {
      const id = state.counters.dives === 1 ? 'muikku' : pickFish(state);
      const n = PN.items[id].rarity === 1 ? 1 + Math.floor(rnd(state) * 3) : 1;
      const isNew = giveFish(state, id, n);
      loot = { kind: 'fish', id, n, isNew };
    } else if (r < 0.84) {
      const id = pickTrinket(state);
      const isNew = !state.trinkets[id];
      state.trinkets[id] = (state.trinkets[id] || 0) + 1;
      let coins = 0;
      if (!isNew) coins = earn(state, 4 + 4 * PN.items[id].rarity);
      learn(state, 'aarre');
      loot = { kind: 'trinket', id, n: 1, isNew, coins };
    } else if (r < 0.95) {
      const n = earn(state, 5 + Math.floor(rnd(state) * 16));
      loot = { kind: 'coins', n };
    } else loot = { kind: 'none' };
    check(state);
    return loot;
  }

  /* Rewards after a mini-game. fishMap: fish caught in Fish Rain. */
  function gameReward(state, game, score, fishMap) {
    const s = state.stats, c = state.counters;
    let coins = 0, best = false;
    const got = [];
    if (game === 'catch') {
      coins = Math.min(60, Math.round(score * 1.2));
      if (score > c.bestCatch) { c.bestCatch = score; best = score > 0; }
      let left = 8;
      Object.keys(fishMap || {}).forEach((id) => {
        const n = Math.min(left, fishMap[id]);
        if (n > 0) { left -= n; got.push({ id, n, isNew: giveFish(state, id, n) }); }
      });
    } else if (game === 'ball') {
      coins = Math.min(60, Math.round(score * 1.5));
      if (score > c.bestBall) { c.bestBall = score; best = score > 0; }
    } else if (game === 'pairs') {
      coins = clamp(34 - score, 8, 26);
      if (!c.bestPairs || score < c.bestPairs) { c.bestPairs = score; best = true; }
    }
    coins = earn(state, coins);
    s.energy = pct(s.energy - 8);
    s.joy = pct(s.joy + 14);
    c.games++;
    addXp(state, 8);
    learn(state, 'leikki');
    check(state);
    return { coins, best, fish: got };
  }

  function buy(state, id) {
    const it = PN.items[id];
    if (!it || it.price == null) return no('nosale');
    if ((it.kind === 'wear' || it.kind === 'decor') && state.owned[id]) return no('owned');
    if (state.coins < it.price) return no('coins');
    state.coins -= it.price;
    if (it.kind === 'wear') {
      state.owned[id] = true; state.wearing[it.slot] = id;
      if (id.indexOf('pipo') === 0) learn(state, 'pipo');
      if (id.indexOf('scarf') === 0) learn(state, 'kaulaliina');
    } else if (it.kind === 'decor') {
      state.owned[id] = true; state.placed[id] = true;
    } else if (it.kind === 'fish') giveFish(state, id, 1);
    else state.pantry[id] = (state.pantry[id] || 0) + 1;
    learn(state, 'kauppa');
    check(state);
    return ok({});
  }

  function wear(state, id) {
    const it = PN.items[id];
    if (!it || !state.owned[id]) return no('none');
    state.wearing[it.slot] = state.wearing[it.slot] === id ? null : id;
    return ok({ on: state.wearing[it.slot] === id });
  }

  function place(state, id) {
    if (!state.owned[id]) return no('none');
    state.placed[id] = !state.placed[id];
    return ok({ on: state.placed[id] });
  }

  function sauna(state, now) {
    const s = state.stats;
    if (!state.owned.sauna) return no('none');
    const c = canPlay(state);
    if (!c.ok && c.why !== 'sick') return c;
    if (now < state.saunaAt) return no('wait');
    state.saunaAt = now + T.saunaCooldown;
    s.clean = 100; s.joy = pct(s.joy + 18); s.energy = pct(s.energy - 4);
    state.filthMs = 0;
    if (state.sick) state.wellMs += H;
    state.counters.saunas++;
    soothe(state, 15);
    addXp(state, 6);
    learn(state, 'sauna'); learn(state, 'loyly');
    check(state);
    return ok({});
  }

  /* Nothing to eat and no coins to buy any: the neighbours will spare a few fish, now and then. */
  function canBorrow(state, now) {
    const hasFood = Object.keys(state.pantry).some((id) => state.pantry[id] > 0 && PN.items[id] && PN.items[id].kind !== 'med');
    return !hasFood && state.coins < 6 && now >= state.handoutAt;
  }
  function borrow(state, now) {
    if (!canBorrow(state, now)) return no('notyet');
    state.handoutAt = now + 4 * H;
    giveFish(state, 'muikku', 3);
    learn(state, 'kiitos');
    return ok({ id: 'muikku', n: 3 });
  }

  /* First visit of the day. */
  function dailyGift(state, now) {
    const today = dayKey(now);
    if (state.gift.last === today) return null;
    const kept = state.gift.last === dayKey(now - DAY);
    state.gift.last = today;
    if (state.grudge > 0) { state.gift.streak = 0; return { withheld: true }; }
    state.gift.streak = kept ? state.gift.streak + 1 : 1;
    const coins = earn(state, 15 + 5 * Math.min(state.gift.streak, 7));
    const id = pickFish(state, 2);
    const isNew = giveFish(state, id, 2);
    addXp(state, 10);
    learn(state, 'kiitos');
    check(state);
    return { coins, streak: state.gift.streak, fish: id, n: 2, isNew };
  }

  /* ---------- Growing up and family ---------- */

  function canEvolve(state) {
    if (state.stage >= 2 || state.asleep || state.sick) return false;
    return state.ageMs >= T.stageAge[state.stage] && level(state).level >= T.stageLevel[state.stage];
  }

  function evolve(state, now) {
    if (!canEvolve(state)) return no('notyet');
    state.stage++;
    if (state.stage === 2) state.nextPupAt = now + T.firstPupDelay;
    earn(state, 50);
    learn(state, 'onnea');
    check(state);
    return ok({ stage: state.stage });
  }

  function pupDue(state, now) {
    const s = state.stats;
    return state.stage === 2 && state.pups.length < T.maxPups && now >= state.nextPupAt
      && level(state).level >= T.pupLevel && !state.asleep && !state.sick && state.grudge <= 0
      && s.food > 50 && s.joy > 50 && state.griefUntil < now;
  }

  function addPup(state, now, name) {
    const p = { id: ++state.pupSeq, name, bornAt: now, food: 85, joy: 75, sick: false, starveMs: 0, grownMs: 0, ready: false };
    state.pups.push(p);
    state.nextPupAt = now + T.pupGap;
    addXp(state, 20);
    learn(state, 'perhe');
    check(state);
    return p;
  }

  function cuddlePup(state, i, now) {
    const p = state.pups[i];
    if (!p) return no('none');
    p.joy = pct(p.joy + 6);
    state.stats.joy = pct(state.stats.joy + 0.5);
    if (now - state.petWin.t0 > H) state.petWin = { t0: now, n: 0 };
    if (state.petWin.n < 10) { state.petWin.n++; addXp(state, 1); }
    return ok({});
  }

  function graduatePup(state, i, now) {
    const p = state.pups[i];
    if (!p || !p.ready) return no('notyet');
    state.pups.splice(i, 1);
    state.family.push({ name: p.name, bornAt: p.bornAt, endAt: now, fate: 'grown' });
    state.counters.pupsGrown++;
    const farewell = earn(state, 100);
    state.nextPupAt = Math.max(state.nextPupAt, now + DAY);
    addXp(state, 40);
    learn(state, 'heihei');
    check(state);
    return ok({ name: p.name, coins: farewell });
  }

  /* One word for how the seal feels right now. */
  function mood(state) {
    const s = state.stats;
    if (state.asleep) return 'sleep';
    if (state.sick) return 'sick';
    if (state.grudge > 0) return 'sulk';
    if (s.food < 25) return 'hungry';
    if (s.energy < 20) return 'tired';
    if (s.clean < 25) return 'dirty';
    if (s.joy < 30) return 'sad';
    if (s.joy > 72 && s.food > 45) return 'happy';
    return 'ok';
  }

  /* ---------- Saving ---------- */

  function save(state) {
    try { localStorage.setItem(KEY, JSON.stringify(state)); return true; } catch (e) { return false; }
  }
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (!obj || typeof obj !== 'object' || !obj.stats) return null;
      return migrate(obj);
    } catch (e) { return null; }
  }
  function wipe() { try { localStorage.removeItem(KEY); } catch (e) { /* nothing to do */ } }

  function exportCode(state) {
    return 'PN1.' + btoa(unescape(encodeURIComponent(JSON.stringify(state))));
  }
  function importCode(code) {
    try {
      const str = String(code).trim();
      if (str.indexOf('PN1.') !== 0) return null;
      const obj = JSON.parse(decodeURIComponent(escape(atob(str.slice(4)))));
      if (!obj || typeof obj !== 'object' || !obj.stats || typeof obj.name !== 'string') return null;
      return migrate(obj);
    } catch (e) { return null; }
  }

  PN.Sim = { T, H, DAY, newState, migrate, advance, level, xpFor, mood, check, learn, addXp, drain, emit,
    feed, pet, wash, tuck, wake, cleanPoop, playBall, canPlay, canDive, diveResult, gameReward,
    buy, wear, place, sauna, dailyGift, canEvolve, evolve, pupDue, addPup, cuddlePup, graduatePup,
    giveFish, canBorrow, borrow, save, load, wipe, exportCode, importCode, isNight, dayKey, localHour };
})(window.PN = window.PN || {});
