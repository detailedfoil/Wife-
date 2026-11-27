/* Pikku Norppa: anonymous play stats.
   Sends small events (a game ended, a visit started or ended, a game unlocked, something bought, a play that was blocked, an error) to a
   Supabase table so the owner can see which games are played, for how long, what they pay, and how the game is paced. Each device gets a random id; there is no name, email or anything personal. It can be switched off in Settings
   (state.settings.stats), never runs in developer mode or on localhost, and if the phone is offline the events wait and go later. */
(function (PN) {
  'use strict';
  const URL = 'https://kmkmtkjjlebqdmhsfewx.supabase.co';
  const KEY = 'sb_publishable_55XiQN6TSodc2KOTab49Yg_g96sKZeC';      // the publishable key is meant to be public; the table only lets it add rows
  const PID = 'pikkunorppa.pid', QUEUE = 'pikkunorppa.q', MAXQ = 150;

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private browsing: nothing is kept */ } },
  };
  const uid = () => {
    try { if (window.crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (e) { /* older browser */ }
    return 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
  };

  let getState = null, visibleSince = null, flushing = false;
  const session = uid();
  let player = store.get(PID);
  if (!player) { player = uid(); store.set(PID, player); }

  const local = /^(localhost|127\.\d+\.\d+\.\d+|\[::1\]|)$/.test(location.hostname);
  const on = () => {
    if (local || !getState) return false;
    const st = getState();
    return !!st && !st.dev && st.settings.stats !== false;
  };
  const readQueue = () => { try { const q = JSON.parse(store.get(QUEUE) || '[]'); return Array.isArray(q) ? q : []; } catch (e) { return []; } };
  const writeQueue = (q) => store.set(QUEUE, JSON.stringify(q.slice(-MAXQ)));
  const int = (n) => (isFinite(n) ? Math.max(0, Math.round(n)) : null);

  const S = () => PN.Sim;
  const state = () => (getState ? getState() : null);
  const levelOf = () => { try { const st = state(); return st ? S().level(st).level : null; } catch (e) { return null; } };
  const ageDays = () => { try { const st = state(); return st && st.createdAt ? Math.floor((Date.now() - st.createdAt) / 864e5) : null; } catch (e) { return null; } };

  function add(event, extra) {
    if (!on()) return;
    const row = Object.assign({ player_id: player, session_id: session, event, lang: PN.lang === 'fi' ? 'fi' : 'en' }, extra || {});
    const q = readQueue(); q.push(row); writeQueue(q);
    flush();
  }

  function flush() {
    if (flushing || local || !on() || typeof fetch !== 'function') return;
    const batch = readQueue();
    if (!batch.length) return;
    flushing = true;
    fetch(URL + '/rest/v1/events', {
      method: 'POST',
      headers: { apikey: KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(batch),
      keepalive: JSON.stringify(batch).length < 60000,
    }).then((res) => {
      // sent, or refused for good (a 4xx other than "slow down"): either way these rows leave the queue; network trouble keeps them
      if (res.ok || (res.status >= 400 && res.status < 500 && res.status !== 429)) writeQueue(readQueue().slice(batch.length));
    }).catch(() => { /* offline: try again next time */ }).then(() => { flushing = false; });
  }

  function seen() {            // visible seconds since the last time the page came into view
    if (visibleSince == null) return;
    const secs = (Date.now() - visibleSince) / 1000;
    visibleSince = null;
    if (secs >= 1) add('session_end', { duration_sec: int(Math.min(secs, 6 * 3600)), coins: int(getState().coins), level: levelOf() });
  }

  PN.Track = {
    /* Called once the game is up. getter returns the saved state. */
    start(getter) {
      getState = getter;
      visibleSince = document.visibilityState === 'hidden' ? null : Date.now();
      const st = getState(), sx = st.stats || {};
      let installed = 0, screen = null;
      try { installed = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone ? 1 : 0; } catch (e) { /* unknown */ }
      try { screen = (Math.round(innerWidth / 10) * 10) + 'x' + (Math.round(innerHeight / 10) * 10); } catch (e) { /* unknown */ }
      add('session_start', { coins: int(st.coins), level: levelOf(), age_days: ageDays(), n_food: int(sx.food), n_joy: int(sx.joy), n_energy: int(sx.energy), n_clean: int(sx.clean), installed, screen });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') seen();
        else if (visibleSince == null) { visibleSince = Date.now(); flush(); }
      });
      window.addEventListener('pagehide', seen);
      window.addEventListener('online', flush);
    },
    /* A game finished (or was given up): how long it was played, the score, and what it did: coins paid, happiness change, energy used,
       her taste for the game, the happy bonus and the muck penalty (percent). Those last ones are for balancing the games. */
    game(id, gaveUp, secs, score, r, fps, info, mum) {
      if (mum) return;   // Mum Mode plays are not tracked at all
      if (gaveUp && !(secs >= 1)) return;
      r = r || {};
      const whole = (n) => (isFinite(n) ? Math.round(n) : null);
      add(gaveUp ? 'game_quit' : 'game_end', {
        game: String(id).slice(0, 32), duration_sec: int(secs), score: int(score), coins: int(r.coins),
        joy: whole(r.joy), energy: int(r.tired), taste: whole(r.taste), bonus: int(r.happy), muck: int(r.muck),
        level: levelOf(), fps: int(fps), info: info ? String(info).slice(0, 32) : null, mum: mum ? 1 : 0,
      });
    },
    /* A game was bought. */
    unlock(id, cost) { add('unlock', { game: String(id).slice(0, 32), coins: int(cost), level: levelOf(), age_days: ageDays() }); },
    /* Something was bought in the shop: what, what kind (wear, decor, food...) and the price. */
    buy(id, kind, cost) { add('purchase', { info: String(id).slice(0, 32), game: String(kind || '').slice(0, 32), coins: int(cost), level: levelOf(), age_days: ageDays() }); },
    /* She could not play (asleep, poorly, sulking, too tired). */
    blocked(id, why) { add('blocked', { game: String(id).slice(0, 32), info: String(why || '').slice(0, 32), level: levelOf() }); },
    /* A script error, at most a few a visit. */
    error(msg) { if (errors++ < 5) add('error', { info: String(msg || '').slice(0, 64) }); },
  };
  let errors = 0;
  const where = (f) => String(f || '').split('/').pop().split('?')[0];
  window.addEventListener('error', (e) => PN.Track.error((e.message || 'error') + ' ' + where(e.filename) + ':' + (e.lineno || 0)));
  window.addEventListener('unhandledrejection', (e) => PN.Track.error('promise ' + String((e.reason && e.reason.message) || e.reason || '')));
})(window.PN = window.PN || {});
