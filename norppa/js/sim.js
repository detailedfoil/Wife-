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
    food: 12.6,                          // the same asleep, awake or with the game closed: a quarter left after about 6 hours
    joyAwake: 27, joyAsleep: 6.1,
    energyAwake: 8.25, energyAsleep: 25,
    clean: 16.9, cleanPerPoop: 3.4,
    poopEvery: 5 / 3, maxPoops: 6,        // a poo every 100 minutes awake
    careGood: 50, careLow: 25,            // growing slows once her lowest need drops below careGood and stops at careLow
    sleepGrace: 20,                       // asleep for the night, her tummy counts this much fuller
    neglectLine: 25,                      // below this she sulks, friendship slips and growing goes backwards
    setback: 1,                           // hours of growing lost per hour spent below neglectLine
    diveSulkChance: 0.15, diveSulk: 100,
    grudgePerH: 12, xpLossPerH: 12, xpRate: 1,
    sulkGrow: 0.5, sulkBlock: 20,         // a sulk halves growing; sulking harder than sulkBlock, she will not play
    medHour: 6, medBonus: 100,             // she is Anxi from 6am until she has had it; a photo of the pill earns a bonus
    sulkTreats: 3, sulkPats: 3,           // she picks three different treats and wants three head pats and a bath
    sulkSleepH: 4, sulkTreatCut: 1 / 5, sulkPatCut: 1 / 5, sulkBathCut: 1 / 5,   // a full sulk naps off in 4 h; each of the three treats takes a fifth off it, the three pats together a fifth, and the sauna a fifth
    starveToSick: 6 * H, filthToSick: 10 * H, wellToCure: 4 * H,
    nurseMin: 35, nurseGain: 15, nurseCost: 2.25,
    pupFood: 9, pupJoy: 6,
    pupStarveToSick: 18 * H, pupStarveToLost: 42 * H,
    pupGrow: 4 * DAY, pupGap: 2.5 * DAY, firstPupDelay: 18 * H, maxPups: 2,
    farewellCoins: 200, visitWait: H, visitStay: 8 * H, visitCooldown: 12 * H, visitCoins: 100, maxVisitors: 2,   // a grown pup can be called home: arrives in an hour, stays up to 8, can be called again 12 hours after the call
    stageAge: [2 * DAY, 6 * DAY], stageLevel: [6, 10], pupLevel: 12,
    diveCooldown: 25 * 60e3,
    // The sauna is how she gets clean: a round of Löyly scrubs a seventh of the dirt away, so saunaRounds in a go is a full clean. It is free, costs no
    // energy, and pays a bonus in proportion to how much of a clean it did. She will not take one when she is already cleaner than saunaClean.
    ballJoy: 1, ballJoyGoes: 6,   // a bounce on the nose lifts happiness by a point (a quarter of that if it is quick after the last), and only the first six an hour
    petJoy: 0.2, petJoyPats: 10,   // a pat lifts happiness by only a fifth of a point, and only the first ten an hour
    saunaRounds: 7, saunaBonus: 12, saunaClean: 95, saunaJoy: 6,
    gameEnergy: 6, gameMax: 150, gameBoost: 1.075,   // gameBoost: every mini-game pays 7.5% over its balanced curve, cap included
    catchKeepChance: 0.1,
    playEnergy: 0.14, playEnergyMin: 2, playEnergyMax: 20, playEnergyNeed: 6,   // a game tires her by how long it lasted: 6 for a 43 second round of Fish Rain (halved, by request)
    // Care and games. Every game leaves her muckier (GAMES[id].muck, cleanliness points a minute, 1 to muckMost a game), and under
    // muckLine clean she earns less, down to muckCut less when filthy. And she has tastes: every game she has (bar the ones left
    // out, at most skipMax) carries a taste from -tasteMax to +tasteMax, which is the percent more or less it pays. Playing a
    // game takes tasteDrop off it and shares that among the others; tastes drift tasteDrift points an hour towards a mix that is
    // dealt afresh every tasteRoll. A game gives gameJoy happiness, more if she likes it (joyUp a point of taste) and less if not
    // (joyDown a point), so from about -9 down it makes her glummer.
    muckLine: 70, muckCut: 0.25, muckMost: 15,
    tasteMax: 15, tasteDrop: 5, tasteDrift: 2.5, tasteRoll: 8 * H, skipMax: 2,
    gameJoy: 14, joyUp: 0.4, joyDown: 1.6, gameCalm: 5,   // games never take joy or cleanliness below neglectLine + gameCalm
    handoutGap: 4 * H, handoutFish: 3, handoutFill: 60, juiceGap: DAY,
    maxCatchUp: 14 * DAY,
  };

  /* Things that just happened, for the interface to show. */
  let events = [];
  const emit = (type, data) => { events.push(Object.assign({ type }, data)); };
  const drain = () => { const e = events; events = []; return e; };

  const localHour = (t) => { const d = new Date(t); return d.getHours() + d.getMinutes() / 60; };
  const isNight = (t) => { const h = localHour(t); return h >= 21.5 || h < 7; };
  const isBedtime = (t) => { const h = localHour(t); return h >= 19 || h < 7; };   // tucked in from 19:00, she sleeps the night through
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
      med: { day: '', photoDay: '', since: dayKey(now), n: 0 }, medLate: false,   // her daily medicine: the day it was last taken, and the day the routine began
      poops: [], poopT: 1.5,
      coins: 40, coinCarry: 0,
      pantry: { muikku: 5, ahven: 2 },
      owned: { lantern: true, sauna: true }, placed: { lantern: true, sauna: true },
      wearing: { head: null, neck: null, face: null, back: null },
      fish: { muikku: 5, ahven: 2 },
      trinkets: {}, words: {}, awards: {}, seen: {},
      pups: [], family: [], nextPupAt: 0, pupSeq: 0,
      fav: 'muikku', favKnown: false,
      gift: { last: dayKey(now), streak: 1 },
      dive: { readyAt: 0 }, saunaAt: 0, ballAt: 0, handoutAt: 0, juiceAt: 0,
      petWin: { t0: 0, n: 0 }, ballWin: { t0: 0, n: 0 },
      taste: {}, tasteGoal: {}, tasteAt: now, tasteRollAt: 0, tasteKey: '', skip: [],
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
    if (obj && !obj.med) obj.med = { day: '', photoDay: '', since: dayKey(Date.now()), n: 0 };   // for an old save the medicine routine starts tomorrow
    if (obj && !obj.angyCleared) { obj.grudge = 0; obj.sulkWant = null; obj.angyCleared = 1; }   // one time only: the Angy rules changed, so everyone starts clean
    fill(obj, base);
    if (obj.pups && obj.pups.length) obj.pups.forEach((q) => { if (!q.wear) q.wear = pupLook(obj); });   // pups born before outfits get one now
    if (obj.family && obj.family.length) obj.family.forEach((q) => { if (!q.wear) q.wear = pupLook(obj); });   // and so do the ones who have already left
    if (obj.counters && obj.counters.bestCatch > 0) obj.owned['game_catch'] = true;
    if (obj.owned && !obj.owned.sauna) { obj.owned.sauna = true; if (obj.placed) obj.placed.sauna = true; }   // the sauna is on everyone's shore now: it is how she gets clean
    return obj;
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
    state.xp += n * T.xpRate;
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

  /* What a sulking seal wants before she will forgive you: three different treats of her own choosing, three head pats and a sauna.
     She chooses when the sulk starts (or the first time anyone looks), from treats the shop sells at a fair price. */
  function sulkNeeds(state) {
    if (!(state.grudge > 0)) { state.sulkWant = null; return null; }
    if (!state.sulkWant) {
      const pool = Object.keys(PN.items).filter((id) => {
        const it = PN.items[id];
        return (it.kind === 'fish' || it.kind === 'food') && it.price > 0 && it.price <= 50 && !it.energy;
      });
      for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rnd(state) * (i + 1)); const x = pool[i]; pool[i] = pool[j]; pool[j] = x; }
      state.sulkWant = { treats: pool.slice(0, T.sulkTreats), got: [], pats: 0, bath: false };
    }
    return state.sulkWant;
  }
  /* Forgiven once every wished-for treat has been given and the pats are done. */
  function sulkCheck(state) {
    const w = state.sulkWant;
    if (!w) return;
    if (state.medLate) { state.grudge = 100; return; }   // nothing but her medicine ends this one
    if (state.grudge > 1e-6) return;
    state.grudge = 0; state.sulkWant = null;
    state.counters.forgiven++;
    learn(state, 'anteeksi');
    emit('forgiven', {});
  }

  function fallAsleep(state, t, kind, wakeAt) {
    state.asleep = true; state.sleepKind = kind; state.wakeAt = wakeAt;
  }

  function addPoop(state) {
    state.poops.push({ a: rnd(state), r: rnd(state) });
  }

  /* How well she is growing right now, from 0 (not at all) to 1 (full speed).
     Her lowest need decides it, and a sulk slows it. Asleep for the night, a hungry tummy matters a bit less. */
  const lowNeed = (state) => { const s = state.stats; return Math.min(s.food + (state.asleep && state.sleepKind === 'night' ? T.sleepGrace : 0), s.joy, s.clean); };
  function care(state) {
    if (state.sick) return 0;
    const low = lowNeed(state);
    return clamp((low - T.careLow) / (T.careGood - T.careLow), 0, 1) * (state.grudge > 0 ? T.sulkGrow : 1);
  }

  /* A word for how growing is going right now, for the profile. */
  function growth(state) {
    if (state.sick) return 'sick';
    if (lowNeed(state) < T.neglectLine) return 'back';
    const c = care(state);
    return c >= 0.95 ? 'well' : c > 0.02 ? 'slow' : 'none';
  }

  /* One slice of time. away = the game was closed for this stretch. Needs run at the same pace either way. */
  function step(state, t, dt, away, sum) {
    const h = dt / H, s = state.stats;
    const night = isNight(t + dt);

    // Dozing off and waking without help.
    if (!state.asleep) {
      if (s.energy <= 6) fallAsleep(state, t, night ? 'night' : 'nap', night ? 100 : 60);
      else if (away && night && s.energy < 70) fallAsleep(state, t, 'night', 100);
    } else if (state.sleepKind === 'night' ? (s.energy >= 99.5 && !isBedtime(t + dt)) : s.energy >= state.wakeAt) {
      state.asleep = false; state.sleepKind = null;
    }
    const asleep = state.asleep;
    if (asleep) sum.sleptH += h;

    // Pups feed from their mother, as long as she has enough herself.
    const nursing = state.pups.length > 0 && s.food > T.nurseMin && !state.sick;

    let foodRate = T.food;
    if (nursing) foodRate += T.nurseCost * state.pups.length;
    let joyRate = asleep ? T.joyAsleep : T.joyAwake;
    if (s.food < 25) joyRate *= 1.5;
    if (s.clean < 25) joyRate *= 1.4;
    if (state.sick) joyRate *= 1.5;

    const wasFed = s.food > 20;
    s.food = pct(s.food - foodRate * h);
    s.joy = pct(s.joy - joyRate * h);
    s.energy = pct(s.energy + (asleep ? T.energyAsleep * (state.sick ? 0.6 : 1) * h : -T.energyAwake * h));
    s.clean = pct(s.clean - (T.clean + T.cleanPerPoop * state.poops.length) * (asleep ? 0.5 : 1) * h);
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

    // What being left to go without costs.
    const neglected = lowNeed(state) < T.neglectLine;
    if (neglected) {
      state.neglectMs += dt;
      sum.neglectH += h;
      const g0 = state.grudge;
      state.grudge = Math.min(100, state.grudge + T.grudgePerH * h);
      if (g0 <= 0 && state.grudge > 0) sum.sulk = true;
      const lose = Math.max(0, Math.min(state.xp - xpFloor(state), T.xpLossPerH * h));
      state.xp -= lose; sum.xpLost += lose;
      // and sets her growing back, though never below where her current stage began
      const floor = state.stage > 0 ? T.stageAge[Math.min(state.stage, 2) - 1] : 0;
      if (state.ageMs > floor) state.ageMs = Math.max(floor, state.ageMs - dt * T.setback);
    }
    // A good nap sulks it off: a full sulk is gone after four hours of sleep.
    if (asleep && state.grudge > 0) { state.grudge = Math.max(0, state.grudge - (100 / T.sulkSleepH) * h); sulkCheck(state); }
    const c = care(state);
    state.ageMs += dt * c;                 // growing only counts while she is cared for

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
      p.food = pct(p.food - T.pupFood * h);
      p.joy = pct(p.joy - T.pupJoy * h);
      if (p.food <= 0.01) p.starveMs += dt;
      else if (p.food > 25) p.starveMs = Math.max(0, p.starveMs - 3 * dt);
      if (!p.sick && p.starveMs > T.pupStarveToSick) {
        p.sick = true; sum.pupSick.push(p.name);
        if (!away) emit('pupSick', { name: p.name });
      }
      if (p.sick && p.starveMs > T.pupStarveToLost) {
        state.pups.splice(i, 1);
        state.family.push({ name: p.name, bornAt: p.bornAt, endAt: t + dt, fate: 'lost', wear: p.wear || null });
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
  /* Her daily medicine. From 6am she is Anxi until she has had it.
     The day starts afresh at midnight, and the routine begins the day after it first appears. */
  function medInfo(state, now) {
    const today = dayKey(now), m = state.med;
    const taken = m.day === today;
    return { taken, photo: m.photoDay === today, late: !taken && today > m.since && localHour(now) >= T.medHour };
  }
  function medSync(state, now) {
    const late = medInfo(state, now).late;
    if (late && !state.medLate) emit('medlate');
    if (!late && state.medLate) { state.grudge = 0; state.sulkWant = null; }   // a new day wipes yesterday's slate
    state.medLate = late;
    if (late) state.grudge = 100;
  }
  function takeMed(state, now, photo) {
    const today = dayKey(now), m = state.med, first = m.day !== today;
    let coins = 0;
    if (first) { m.day = today; m.n = (m.n || 0) + 1; }
    if (photo && first && m.photoDay !== today) {   // the bonus is for the photo that takes the pill; tapping I took it first forfeits it
      m.photoDay = today; coins = T.medBonus; state.coins += coins; }
    if (state.medLate) { state.medLate = false; state.grudge = 0; state.sulkWant = null; emit('forgiven'); }
    return { ok: first || coins > 0, first, coins };
  }
  function advance(state, now, opts) {
    const away = !!(opts && opts.away);
    const sum = { ms: 0, sleptH: 0, poops: 0, neglectH: 0, xpLost: 0, hungry: false, sulk: false,
      sick: false, cured: false, pupSick: [], pupLost: [], pupWell: [] };
    if (!(now > state.lastSeen)) { state.lastSeen = now; medSync(state, now); return sum; }   // clock went backwards: just carry on
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
    medSync(state, now);
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
    const before = s.food, fav = id === state.fav;   // she can be fed in her sleep
    state.pantry[id]--;
    s.food = pct(s.food + it.food);
    if (it.energy) s.energy = pct(s.energy + it.energy);
    s.joy = pct(s.joy + (it.joy || 2) + (fav ? 8 : 0));
    if (fav && !state.favKnown) { state.favKnown = true; learn(state, 'herkku'); }
    state.counters.feeds++;
    const want = sulkNeeds(state);
    let treat = false;
    if (want && want.treats.indexOf(id) >= 0 && want.got.indexOf(id) < 0) { want.got.push(id); treat = true; state.grudge = Math.max(0, state.grudge - 100 * T.sulkTreatCut); sulkCheck(state); }
    addXp(state, before < 85 ? 4 : 1);
    learn(state, 'kala');
    check(state);
    return ok({ fav, treat });
  }

  function pet(state, now) {
    const s = state.stats;
    if (state.asleep) { s.joy = pct(s.joy + 0.2); return ok({ asleep: true }); }
    const sulking = state.grudge > 0;
    if (now - state.petWin.t0 > H) state.petWin = { t0: now, n: 0 };
    if (state.petWin.n < T.petJoyPats) s.joy = pct(s.joy + (sulking ? T.petJoy / 3 : T.petJoy));   // a pat is only a little cheer, and only the first few an hour: games she fancies are what lift her
    state.counters.pets++;
    const want = sulkNeeds(state);
    let pat = false;
    if (want && want.pats < T.sulkPats) { want.pats++; pat = true; state.grudge = Math.max(0, state.grudge - 100 * T.sulkPatCut / T.sulkPats); sulkCheck(state); }
    if (state.petWin.n < 10) { state.petWin.n++; addXp(state, 1); }
    check(state);
    return ok({ sulking, pat });
  }

  function tuck(state, now) {
    const s = state.stats;
    if (state.asleep) return no('asleep');
    if (s.energy > 88) return no('awake');
    const night = isBedtime(now);
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
    if (state.grudge > T.sulkBlock) return no('sulk');
    if (s.energy < 6) return no('tired');
    const fresh = now - state.ballAt > 20e3;
    state.ballAt = now;
    if (now - state.ballWin.t0 > H) state.ballWin = { t0: now, n: 0 };
    if (state.ballWin.n < T.ballJoyGoes) s.joy = pct(s.joy + (fresh ? T.ballJoy : T.ballJoy / 4));   // only a little cheer, and only the first few an hour
    s.energy = pct(s.energy - 2);
    state.counters.balls++;
    if (fresh && state.ballWin.n < 6) { state.ballWin.n++; addXp(state, 3); }   // fun any time, friendship points a few times an hour
    learn(state, 'pallo');
    check(state);
    return ok({});
  }

  /* What something costs right now. Developer mode makes everything free. */
  const price = (state, p) => (state.dev ? 0 : p);

  /* Mini-games are bought once with coins. */
  const gameOwned = (state, id) => !PN.GAMES[id] || PN.GAMES[id].price === 0 || !!state.owned['game_' + id];
  function unlockGame(state, id) {
    const g = PN.GAMES[id];
    if (!g) return no('none');
    if (gameOwned(state, id)) return no('owned');
    const cost = price(state, g.price);
    if (state.coins < cost) return no('coins');
    state.coins -= cost; state.owned['game_' + id] = true;
    if (id === 'sauna') { state.owned.sauna = true; state.placed.sauna = true; }   // the sauna itself comes with the game
    return ok({ price: cost });
  }

  function canPlay(state) {
    if (state.asleep) return no('asleep');
    if (state.sick) return no('sick');
    if (state.grudge > T.sulkBlock) return no('sulk');
    if (state.stats.energy < T.playEnergyNeed) return no('tired');
    return ok({});
  }

  function canDive(state, now) {
    const c = canPlay(state);
    if (!c.ok) return c;
    if (now < state.dive.readyAt) return no('wait');
    return ok({});
  }

  const FISH_W = [0, 64, 20, 7, 2, 0.45];
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
    // Every dive that finds anything pays 20 to 150 coins, and now and then a fish or a treasure comes up with them.
    let r = rnd(state), loot;
    const early = state.counters.dives <= 2;
    if (!early && r < 0.05) loot = { kind: 'none' };
    else {
      const coins = earn(state, (20 + Math.floor(rnd(state) * 131)) / T.earnRate);
      let b = rnd(state);
      if (state.counters.dives === 1) b = 0.1;          // first dive: fish for certain
      else if (state.counters.dives === 2) b = 0.7;     // second dive: a first treasure
      if (b < 0.5) {
        const id = state.counters.dives === 1 ? 'muikku' : pickFish(state);
        const n = PN.items[id].rarity === 1 ? 1 + Math.floor(rnd(state) * 2) : 1;
        const isNew = giveFish(state, id, n);
        loot = { kind: 'fish', id, n, isNew, coins };
      } else if (b < 0.8) {
        const id = pickTrinket(state);
        const isNew = !state.trinkets[id];
        state.trinkets[id] = (state.trinkets[id] || 0) + 1;
        learn(state, 'aarre');
        loot = { kind: 'trinket', id, n: 1, isNew, coins };
      } else loot = { kind: 'coins', n: coins, coins };
    }
    // Cold water and no say in it: now and then she comes up in a huff.
    if (rnd(state) < T.diveSulkChance) {
      if (state.grudge <= 0) state.grudge = T.diveSulk;
      loot.sulked = true;
    }
    check(state);
    return loot;
  }

  /* Rewards after a mini-game. fishMap: fish caught in Fish Rain. secs: how long the game lasted, which sets the energy it costs.
     Every game pays a * score^b coins (PN.GAMES[game].pay), tuned so a minute of play earns about the same in each game. */
  /* ---------- her taste in games, and muck ---------- */
  /* The games her tastes are dealt among: the ones she has, less the ones left out. */
  const roster = (state) => PN.GAME_ORDER.filter((id) => gameOwned(state, id) && state.skip.indexOf(id) < 0);
  /* Deal a fresh mix to drift towards: evenly spread from least to most liked, in a random order, so there is always
     something she fancies and something she is off. With few games the spread is narrower. Games left out sit at 0. */
  function tasteDeal(state, now) {
    const ids = roster(state), n = ids.length, amp = T.tasteMax * Math.min(1, (n - 1) / 3);
    const vals = ids.map((_, i) => (n > 1 ? -amp + 2 * amp * i / (n - 1) : 0));
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd(state) * (i + 1)), t = vals[i]; vals[i] = vals[j]; vals[j] = t; }
    state.tasteGoal = {};
    ids.forEach((id, i) => { state.tasteGoal[id] = vals[i]; });
    state.skip.forEach((id) => { state.tasteGoal[id] = 0; });
    state.tasteRollAt = now + T.tasteRoll;
  }
  function tasteDrift(state, ms) {
    const step = T.tasteDrift * ms / H;
    Object.keys(state.taste).forEach((id) => {
      const goal = state.tasteGoal[id] || 0, v = state.taste[id];
      state.taste[id] = Math.abs(goal - v) <= step ? goal : v + Math.sign(goal - v) * step;
    });
  }
  /* Bring her tastes up to now: a new game or a change to what is left out deals a new mix, and time lets them drift. */
  function tasteSync(state, now) {
    const key = roster(state).join(',') + '|' + state.skip.join(',');
    if (key !== state.tasteKey) {
      const first = !state.tasteKey;
      state.tasteKey = key;
      tasteDeal(state, now);
      PN.GAME_ORDER.forEach((id) => {
        if (!gameOwned(state, id)) return;
        if (state.taste[id] == null || first) state.taste[id] = state.tasteGoal[id];          // a new game starts where the deal put it
        if (state.skip.indexOf(id) >= 0) state.taste[id] = Math.min(0, state.taste[id]);
      });
      state.tasteAt = now;
    }
    for (let i = 0; i < 4 && now >= state.tasteRollAt; i++) {
      const at = Math.max(state.tasteAt, state.tasteRollAt);
      tasteDrift(state, at - state.tasteAt); state.tasteAt = at;
      tasteDeal(state, at);
    }
    if (now >= state.tasteRollAt) state.tasteRollAt = now + T.tasteRoll;
    if (now > state.tasteAt) { tasteDrift(state, now - state.tasteAt); state.tasteAt = now; }
  }
  const tasteOf = (state, id) => state.taste[id] || 0;
  /* Playing a game wears it out a little and makes the others look better. */
  function tastePlayed(state, id) {
    if (state.taste[id] == null) return;
    const others = roster(state).filter((x) => x !== id);
    state.taste[id] = Math.max(-T.tasteMax, state.taste[id] - T.tasteDrop);
    others.forEach((x) => { state.taste[x] = Math.min(T.tasteMax, (state.taste[x] || 0) + T.tasteDrop / others.length); });
  }
  /* How much less a mucky seal earns: nothing above muckLine, muckCut when filthy. */
  const muckLoss = (state) => (state.stats.clean >= T.muckLine ? 0 : T.muckCut * (T.muckLine - state.stats.clean) / T.muckLine);
  /* What a game's coins are multiplied by right now. */
  const gameMult = (state, id) => (1 + tasteOf(state, id) / 100) * (1 - muckLoss(state));
  const gameJoy = (taste) => T.gameJoy + taste * (taste >= 0 ? T.joyUp : T.joyDown);
  /* What the Play menu shows: each game's taste, whether it is left out, and the muck loss, all in whole percent. */
  function gameMoods(state, now) {
    tasteSync(state, now);
    const out = { muck: Math.round(muckLoss(state) * 100), games: {}, skips: state.skip.length, skipMax: T.skipMax };
    PN.GAME_ORDER.forEach((id) => { if (gameOwned(state, id)) out.games[id] = { taste: Math.round(tasteOf(state, id)), skip: state.skip.indexOf(id) >= 0 }; });
    return out;
  }
  /* Leave a game out of her tastes, or put it back. A game left out never pays over the odds, but still wears out if played. */
  function setSkip(state, id, on, now) {
    if (!PN.GAMES[id] || !gameOwned(state, id)) return no('none');
    tasteSync(state, now);
    const at = state.skip.indexOf(id);
    if (on && at < 0) { if (state.skip.length >= T.skipMax) return no('full'); state.skip.push(id); }
    else if (!on && at >= 0) state.skip.splice(at, 1);
    tasteSync(state, now);
    return ok({});
  }

  function gamePay(game, score) {
    const gm = PN.GAMES[game];
    if (!gm || !gm.pay || !(score > 0)) return 0;
    return Math.min(T.gameMax, gm.pay[0] * Math.pow(Math.max(score, gm.quick || 0), gm.pay[1])) * T.gameBoost;
  }
  function gameReward(state, game, score, fishMap, found, secs, now) {
    const s = state.stats, c = state.counters, gm = PN.GAMES[game];
    let coins = 0, best = false;
    const got = [];
    tasteSync(state, now || state.tasteAt);
    const taste = tasteOf(state, game), muck = muckLoss(state);
    coins = gamePay(game, score) * gameMult(state, game);
    const key = gm && gm.best;
    // In a timed game (low) the score is the seconds it took, so the best is the smallest, and 0 means it was lost.
    if (key && (gm.low ? score > 0 && (!c[key] || score < c[key]) : score > (c[key] || 0))) { c[key] = score; best = score > 0; }
    if (game === 'catch') {
      // Only now and then does the seal get to keep a fish from the round.
      const caught = [];
      Object.keys(fishMap || {}).forEach((id) => { for (let i = 0; i < fishMap[id]; i++) caught.push(id); });
      if (caught.length && rnd(state) < T.catchKeepChance) {
        const id = caught[Math.floor(rnd(state) * caught.length)];
        got.push({ id, n: 1, isNew: giveFish(state, id, 1) });
      }
    }
    coins = earn(state, coins / T.earnRate);
    const tired = secs > 0 ? clamp(Math.round(secs * T.playEnergy), T.playEnergyMin, T.playEnergyMax) : T.gameEnergy;
    s.energy = pct(s.energy - tired);
    const joy = gameJoy(taste);
    // Games never push her over the edge: a disliked game or a muddy romp stops at the sulk line, so only neglect can make her Angy.
    const calm = T.neglectLine + T.gameCalm;
    s.joy = pct(joy < 0 ? Math.max(s.joy + joy, Math.min(s.joy, calm)) : s.joy + joy);
    const dirt = gm && gm.muck ? clamp(Math.round((secs > 0 ? secs : 45) / 60 * gm.muck), 1, T.muckMost) : 0;
    s.clean = pct(Math.max(s.clean - dirt, Math.min(s.clean, calm)));
    tastePlayed(state, game);
    c.games++;
    addXp(state, 8);
    learn(state, 'leikki');
    check(state);
    return { coins, best, fish: got, tired, taste: Math.round(taste), muck: Math.round(muck * 100), joy, dirt };
  }

  function buy(state, id) {
    const it = PN.items[id];
    if (!it || it.price == null) return no('nosale');
    if ((it.kind === 'wear' || it.kind === 'decor') && state.owned[id]) return no('owned');
    const cost = price(state, it.price);
    if (state.coins < cost) return no('coins');
    state.coins -= cost;
    let away = null;
    if (it.kind === 'wear') {
      state.owned[id] = true; state.wearing[it.slot] = id;
      if (id.indexOf('pipo') === 0) learn(state, 'pipo');
      if (id.indexOf('scarf') === 0) learn(state, 'kaulaliina');
    } else if (it.kind === 'decor') {
      state.owned[id] = true; state.placed[id] = true;
      away = makeRoom(state, id);
    } else if (it.kind === 'fish') giveFish(state, id, 1);
    else state.pantry[id] = (state.pantry[id] || 0) + 1;
    learn(state, 'kauppa');
    check(state);
    return ok({ away });
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
    return ok({ on: state.placed[id], away: state.placed[id] ? makeRoom(state, id) : null });
  }
  /* Two things that share one place cannot both be out. Returns the one that was tidied away, if any. */
  function makeRoom(state, id) {
    const it = PN.items[id];
    let away = null;
    if (it && it.swap) PN.DATA.DECOR.forEach((d) => { if (d.id !== id && d.swap === it.swap && state.placed[d.id]) { state.placed[d.id] = false; away = d.id; } });
    return away;
  }

  /* The sauna: how she gets clean. A go is a run of rounds of the Löyly game; each scrubs a seventh of the dirt away, so seven rounds in one go
     is a full clean from filthy and fewer rounds take more goes. A go asks for just as many rounds as it takes to finish her. */
  const saunaNeed = (state) => Math.max(1, Math.ceil((100 - state.stats.clean) * T.saunaRounds / 100 - 1e-9));
  function canSauna(state) {
    if (state.asleep) return no('asleep');
    if (state.stats.clean >= T.saunaClean) return no('clean');
    return ok({});
  }
  /* The end of a go: rounds of the need she got through. Whatever she managed counts, and the bonus is in proportion. */
  function saunaDone(state, rounds, need) {
    const s = state.stats, c = state.counters;
    rounds = clamp(Math.floor(rounds) || 0, 0, need);
    if (!(rounds > 0)) return { rounds: 0, need, coins: 0, clean: Math.round(s.clean), full: false };
    const frac = rounds / need, was = s.clean;
    s.clean = rounds >= need ? 100 : pct(s.clean + rounds * 100 / T.saunaRounds);
    s.joy = pct(s.joy + T.saunaJoy * frac);
    if (s.clean >= 60) state.filthMs = 0;
    const coins = earn(state, T.saunaBonus * frac / T.earnRate);
    c.saunas++; c.washes++;
    addXp(state, was < 60 ? 6 : 2);
    if (state.sick && rounds >= need) state.wellMs += H;
    const want = sulkNeeds(state);
    if (want && !want.bath && s.clean >= 60) { want.bath = true; state.grudge = Math.max(0, state.grudge - 100 * T.sulkBathCut); sulkCheck(state); }
    learn(state, 'kylpy'); learn(state, 'sauna'); learn(state, 'loyly');
    check(state);
    return { rounds, need, coins, clean: Math.round(s.clean), full: rounds >= need };
  }

  /* Nothing to eat and no coins to buy any: the neighbours will spare a few fish, now and then.
     And if she is poorly and the juice costs more than you have, they can spare a bottle once a day. */
  const hasFood = (state) => Object.keys(state.pantry).some((id) => state.pantry[id] > 0 && PN.items[id] && PN.items[id].kind !== 'med');
  const fishSpare = (state, now) => !hasFood(state) && state.coins < PN.items.muikku.price && now >= state.handoutAt;
  const juiceSpare = (state, now) => (state.sick || state.pups.some((p) => p.sick)) && !(state.pantry.lakkamehu > 0)
    && state.coins < PN.items.lakkamehu.price && now >= state.juiceAt;
  function canBorrow(state, now) { return fishSpare(state, now) || juiceSpare(state, now); }
  const spare = (state, now) => ({ fish: fishSpare(state, now), juice: juiceSpare(state, now) });
  function borrow(state, now) {
    if (!canBorrow(state, now)) return no('notyet');
    let n = 0, juice = false;
    if (fishSpare(state, now)) {
      // enough for a proper meal: her tummy to about 60%, never fewer than handoutFish
      n = clamp(Math.ceil((T.handoutFill - state.stats.food) / PN.items.muikku.food), T.handoutFish, 8);
      state.handoutAt = now + T.handoutGap; giveFish(state, 'muikku', n);
    }
    if (juiceSpare(state, now)) { state.juiceAt = now + T.juiceGap; juice = true; state.pantry.lakkamehu = 1; }
    learn(state, 'kiitos');
    return ok({ id: 'muikku', n, juice });
  }

  /* First visit of the day. */
  function dailyGift(state, now) {
    const today = dayKey(now);
    if (state.gift.last === today) return null;
    const kept = state.gift.last === dayKey(now - DAY);
    state.gift.last = today;
    if (state.grudge > T.sulkBlock) { state.gift.streak = 0; return { withheld: true }; }
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

  /* Every pup is born with one little thing to wear, and one in ten gets a second, so the family can be told apart. They are picked from a cute list
     (not the shop's silliest), from different places on the body, and avoid what a brother or sister already has on. */
  const PUP_WEAR = {
    head: ['pipo_red', 'pipo_blue', 'pipo_yellow', 'pipo_pink', 'pipo_green', 'earmuffs', 'bow', 'kukka', 'kissa', 'pupu', 'wreath', 'sieni', 'juhlahattu', 'baskeri', 'olkihattu', 'tonttu'],
    neck: ['scarf_red', 'scarf_green', 'scarf_blue', 'scarf_rainbow', 'huivi', 'solmuke', 'bell', 'kukkakaulus'],
    face: ['punanena', 'glasses', 'shades', 'sydanlasit'],
    back: ['ilmapallo', 'ankka', 'reppu', 'viitta', 'perhonen'],
  };
  function pupLook(state) {
    const taken = {};
    (state.pups || []).forEach((q) => { Object.keys(q.wear || {}).forEach((k) => { taken[q.wear[k]] = 1; }); });
    const slots = ['head', 'neck', 'face', 'back'], pick = (list) => list[Math.floor(rnd(state) * list.length)];
    const first = rnd(state) < 0.75 ? (rnd(state) < 0.6 ? 'head' : 'neck') : slots[Math.floor(rnd(state) * 4)];
    const chosen = [first];
    if (rnd(state) < 0.1) { const rest = slots.filter((k) => k !== first); chosen.push(rest[Math.floor(rnd(state) * rest.length)]); }
    const wear = {};
    chosen.forEach((slot) => {
      const free = PUP_WEAR[slot].filter((id) => !taken[id]);
      wear[slot] = pick(free.length ? free : PUP_WEAR[slot]);
    });
    return wear;
  }

  function addPup(state, now, name) {
    const p = { id: ++state.pupSeq, name, bornAt: now, food: 85, joy: 75, sick: false, starveMs: 0, grownMs: 0, ready: false, wear: pupLook(state) };
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
    state.family.push({ name: p.name, bornAt: p.bornAt, endAt: now, fate: 'grown', wear: p.wear || pupLook(state) });
    state.counters.pupsGrown++;
    const farewell = earn(state, T.farewellCoins / T.earnRate);   // exactly 200 coins
    state.nextPupAt = Math.max(state.nextPupAt, now + DAY);
    addXp(state, 40);
    learn(state, 'heihei');
    check(state);
    return ok({ name: p.name, coins: farewell });
  }

  /* ---------- Calling a grown pup home ----------
     A pup that has grown up and swum off can be called from the Family album. It arrives an hour later (and pays 100 coins for
     the visit), hangs about on the shore, and goes home when sent away or after 8 hours. Each pup can be called once every
     12 hours, counted from the call, and two visitors at a time is the most. Stored on the family entry:
     callAt (when it was called), arriveAt, leaveAt, paid. */
  function visitStatus(f, now) {
    if (!f || !f.arriveAt) return 'home';
    if (now < f.arriveAt) return 'coming';
    if (now < f.leaveAt) return 'here';
    return 'home';
  }
  const visiting = (state, now) => state.family.filter((f) => visitStatus(f, now) !== 'home').length;
  function callWait(state, i, now) {            // how long until this pup may be called again, 0 if it may
    const f = state.family[i];
    if (!f || state.dev) return 0;
    return Math.max(0, (f.callAt || 0) + T.visitCooldown - now);
  }
  function callPup(state, i, now) {
    const f = state.family[i];
    if (!f || f.fate !== 'grown') return no('none');
    if (visitStatus(f, now) !== 'home') return no('busy');
    if (callWait(state, i, now) > 0) return no('wait');
    if (visiting(state, now) >= T.maxVisitors) return no('full');
    f.callAt = now; f.arriveAt = now + T.visitWait; f.leaveAt = f.arriveAt + T.visitStay; f.paid = false;
    return ok({ name: f.name });
  }
  /* Time moves on: pups who have arrived pay their 100 coins (even if the game was closed for the whole visit), and pups whose
     time is up go home. Returns the family numbers of each. */
  function visitTick(state, now) {
    const out = { arrived: [], left: [] };
    state.family.forEach((f, i) => {
      if (!f.arriveAt) return;
      if (now >= f.arriveAt && !f.paid) { f.paid = true; f.coins = earn(state, T.visitCoins / T.earnRate); out.arrived.push(i); addXp(state, 5); }
      if (now >= f.leaveAt) { f.arriveAt = 0; f.leaveAt = 0; out.left.push(i); }
    });
    return out;
  }
  function sendHome(state, i, now) {
    const f = state.family[i];
    if (!f || visitStatus(f, now) !== 'here') return no('none');
    f.arriveAt = 0; f.leaveAt = 0;
    return ok({ name: f.name });
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
  /* Developer mode: everything is free. The save from just before it began is kept apart, so it can come back. */
  const DEV_KEY = KEY + '.beforedev';
  function devOn(state) {
    try { if (!localStorage.getItem(DEV_KEY)) localStorage.setItem(DEV_KEY, JSON.stringify(Object.assign({}, state, { dev: false }))); }
    catch (e) { return false; }
    state.dev = true;
    return true;
  }
  function devHasBackup() { try { return !!localStorage.getItem(DEV_KEY); } catch (e) { return false; } }
  function devRestore() {
    try {
      const raw = localStorage.getItem(DEV_KEY);
      if (!raw) return null;
      const obj = migrate(JSON.parse(raw));
      obj.dev = false; obj.lastSeen = Date.now();          // no time passes while developer mode was on
      localStorage.setItem(KEY, JSON.stringify(obj));
      localStorage.removeItem(DEV_KEY);
      return obj;
    } catch (e) { return null; }
  }
  function devOff(state) { state.dev = false; try { localStorage.removeItem(DEV_KEY); } catch (e) { /* nothing to do */ } }
  function wipe() { try { localStorage.removeItem(DEV_KEY); localStorage.removeItem(KEY); } catch (e) { /* nothing to do */ } }

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

  PN.Sim = { T, H, DAY, care, growth, newState, migrate, advance, level, xpFor, mood, check, learn, addXp, drain, emit,
    feed, pet, tuck, wake, cleanPoop, playBall, canPlay, gameOwned, unlockGame, canDive, diveResult, gameReward, gamePay, gameMult, gameMoods, setSkip, tasteSync,
    buy, wear, place, saunaNeed, canSauna, saunaDone, dailyGift, canEvolve, evolve, pupDue, addPup, pupLook, visitStatus, callWait, callPup, visitTick, sendHome, visiting, cuddlePup, graduatePup,
    sulkNeeds, medInfo, medSync, takeMed, price, devOn, devOff, devRestore, devHasBackup, giveFish, canBorrow, spare, borrow, save, load, wipe, exportCode, importCode, isNight, dayKey, localHour };
})(window.PN = window.PN || {});
