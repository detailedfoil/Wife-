/* Pikku Norppa: playing with a friend online (the Online trial in Settings, a first prototype).
   One player makes a room and reads out its four-letter code; the other types it in. Both seals then stand on each other's shore,
   and either player can ask the other to race at a game. Both play the same game on their own screen, with the same random seed so the
   same things fall in the same order, and each sends its score a few times a second so the other sees it live in a corner.

   No server of our own: messages go through Supabase Realtime broadcast (the same project as the play stats), over a plain websocket
   speaking the Phoenix channel protocol, so no library is needed. On localhost two tabs talk through a BroadcastChannel instead,
   so the whole flow can be tried on one computer without the network.

   Message kinds (all carry `from`, the sender's random id for this visit):
     hello {p}           I am here; p is my seal (name, stage, look, what she wears). Answered once with a hello back.
     ping                still here (every 4 s). Nothing heard for 15 s means the friend has gone.
     bye                 I left the room.
     full                this room already has two seals (sent to a third).
     invite {game,seed,k} will you race me? k names this invite.
     answer {k,yes,why}  the reply to an invite.
     go {k}              the inviter has started; start now.
     score {k,s,t}       my score s and seconds left t during race k.
     end {k,s,quit}      my final score (quit: I gave up).
   A new game for racing needs: a seeded random in its spawns (Games.rnd), a fixed length, and a score. List it in RACE_GAMES. */
(function (PN) {
  'use strict';
  const tr = PN.L, $ = (id) => document.getElementById(id);
  const URL = 'wss://kmkmtkjjlebqdmhsfewx.supabase.co/realtime/v1/websocket';
  const KEY = 'sb_publishable_55XiQN6TSodc2KOTab49Yg_g96sKZeC';
  /* Room codes are Finnish four-letter words, plain a to z (no ä, ö or å, so anyone can type them). */
  const WORDS = ('aika aita auto hame hiha hiki ilta jalo jano joki juna kala kana kapu kari kasa katu kota koti kuha kuka kuva laji lama lapa loma luku lumi lupa maja mato mela meri muna noki oksa onni '
    + 'paja pata peli pesa pipo poro puku pulu puro raha rata reki ruis saha sana sata savi soma sopu sora susi taka talo tuli tupa uuni vene vesi yksi').split(' ').filter((w) => /^[a-z]{4}$/.test(w)).map((w) => w.toUpperCase());
  /* The games that can be raced: they end with a score where more is better, and what makes each one hard (where things fall, the wind, the tune) comes from the shared seed.
     Live picture in the corner (drawn from a few small numbers, not video): all of them except Seat Shuffle, which shows both players on one shared bus instead.
     Not raced (by choice): Puffer Sweeper, Blackjack and Coffee Memory. Seat Shuffle is raced on one shared bus, with a seat conflict rule (see arcade.js). */
  const RACE_IDS = ['catch', 'ball', 'swim', 'stack', 'toss', 'curl', 'sled', 'piano', 'shuffle'];
  const gameTitle = (id) => (PN.GAMES[id] ? tr(PN.GAMES[id].title) : id);
  const iOwn = (id) => { try { return PN.Sim.gameOwned(PN.Game.state, id); } catch (e) { return false; } };
  const RACE_GAMES = {}; RACE_IDS.forEach((id) => { RACE_GAMES[id] = id; });
  const local = /^(localhost|127\.\d+\.\d+\.\d+|\[::1\])$/.test(location.hostname) || /[?&]mp=local\b/.test(location.search);

  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const me = uid();                                   // this visit
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private browsing: nothing is kept */ } },
  };
  let oid = store.get('pikkunorppa.oid');             // this seal, for good: so a friend met twice is the same friend
  if (!oid) { oid = uid(); store.set('pikkunorppa.oid', oid); }

  /* Seals met online are kept on this device (name, look, what she wears), newest first, so they are not lost when the room closes. */
  const FRIENDS = 'pikkunorppa.friends', MAXF = 12;
  function savedFriends() { try { const l = JSON.parse(store.get(FRIENDS) || '[]'); return Array.isArray(l) ? l : []; } catch (e) { return []; } }
  function saveFriend(p) {
    if (!p || !p.oid || p.oid === oid) return;
    const list = savedFriends().filter((f) => f.oid !== p.oid);
    list.unshift({ oid: p.oid, name: p.name, stage: p.stage, appearance: p.appearance, wearing: p.wearing, met: Date.now() });
    store.set(FRIENDS, JSON.stringify(list.slice(0, MAXF)));
  }

  /* A shared link looks like  .../norppa/?room=ABCD  and is picked up here, before anything else can lose it. */
  let pending = null;
  try {
    const q = new URLSearchParams(location.search).get('room');
    if (q && /^[A-Za-z]{4}$/.test(q)) {
      pending = q.toUpperCase();
      const u = new window.URL(location.href); u.searchParams.delete('room');
      history.replaceState(null, '', u.pathname + (u.search || '') + u.hash);   // so a reload does not join again
    }
  } catch (e) { /* an old browser: no link joining */ }
  const linkFor = (code) => location.origin + location.pathname + '?room=' + code;

  /* ---------- the wire ---------- */
  /* Both transports: open(room, onMsg, onState) -> { send(obj), close() }. onState('ok' | 'fail' | 'lost'). */
  function openLocal(room, onMsg, onState) {
    if (typeof BroadcastChannel !== 'function') { setTimeout(() => onState('fail'), 0); return { send() {}, close() {} }; }
    const bc = new BroadcastChannel('pikkunorppa.room.' + room);
    bc.onmessage = (e) => onMsg(e.data);
    setTimeout(() => onState('ok'), 50);
    return { send(o) { bc.postMessage(o); }, close() { bc.close(); } };
  }

  function openRealtime(room, onMsg, onState) {
    const topic = 'realtime:pikkunorppa-' + room;
    let ws, ref = 0, joinRef = null, beat = null, joined = false, closed = false;
    const next = () => String(++ref);
    const put = (o) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); };
    try { ws = new WebSocket(URL + '?apikey=' + encodeURIComponent(KEY) + '&vsn=1.0.0'); } catch (e) { setTimeout(() => onState('fail'), 0); return { send() {}, close() {} }; }
    const giveUp = setTimeout(() => { if (!joined && !closed) { closed = true; try { ws.close(); } catch (e) { /* already shut */ } onState('fail'); } }, 10000);
    ws.onopen = () => {
      joinRef = next();
      put({ topic, event: 'phx_join', ref: joinRef, join_ref: joinRef,
        payload: { config: { broadcast: { self: false, ack: false }, presence: { key: '', enabled: false }, postgres_changes: [], private: false } } });
      beat = setInterval(() => put({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: next() }), 25000);
    };
    ws.onmessage = (e) => {
      let m; try { m = JSON.parse(e.data); } catch (err) { return; }
      if (m.topic !== topic) return;
      if (m.event === 'phx_reply' && m.ref === joinRef) {
        clearTimeout(giveUp);
        if (m.payload && m.payload.status === 'ok') { joined = true; onState('ok'); } else { closed = true; try { ws.close(); } catch (err) { /* already shut */ } onState('fail'); }
      } else if (m.event === 'broadcast' && m.payload && m.payload.event === 'pn') onMsg(m.payload.payload);
      else if (m.event === 'phx_error' || m.event === 'phx_close') { if (!closed) { closed = true; onState(joined ? 'lost' : 'fail'); } }
    };
    ws.onclose = () => { clearInterval(beat); clearTimeout(giveUp); if (!closed) { closed = true; onState(joined ? 'lost' : 'fail'); } };
    ws.onerror = () => { /* onclose follows */ };
    return {
      send(o) { if (joined) put({ topic, event: 'broadcast', ref: next(), join_ref: joinRef, payload: { type: 'broadcast', event: 'pn', payload: o } }); },
      close() {
        if (closed) return; closed = true;
        clearInterval(beat); clearTimeout(giveUp);
        try { put({ topic, event: 'phx_leave', payload: {}, ref: next(), join_ref: joinRef }); ws.close(); } catch (e) { /* already shut */ }
      },
    };
  }

  /* ---------- the room ---------- */
  let wire = null, room = null, friend = null, heardAt = 0, pinger = null, chip = null;
  let race = null;        // { k, game, seed, me: {s, t, done, quit}, them: {s, t, done, quit}, state: 'asked'|'wait'|'on'|'over' }
  let askedK = null;      // an invite I sent and am waiting on

  const profile = () => {
    const st = PN.Game.state;
    return { oid, name: String(st.name || '').slice(0, 24), stage: st.stage, appearance: st.appearance, wearing: st.wearing, games: RACE_IDS.filter(iOwn) };
  };
  const send = (kind, extra) => { if (wire) wire.send(Object.assign({ kind, from: me }, extra || {})); };
  const fname = () => UI().esc(friend ? friend.p.name || tr('Your friend') : tr('Your friend'));
  const UI = () => PN.UI;

  function onMsg(m) {
    if (!m || m.from === me || !wire) return;
    if (friend && m.from !== friend.id) {
      // the same seal back from a minimised app or a reload has a new visit id: it is the friend, not a third player
      if (m.kind === 'hello' && m.p && m.p.oid && friend.p && friend.p.oid === m.p.oid) friend.id = m.from;
      else { if (m.kind === 'hello') send('full', { to: m.from }); return; }
    }
    if (m.kind === 'full') { if (m.to === me && !friend) { PN.Audio.play('nope'); UI().toast(tr('That room already has two seals.'), 'seal', 'bad', 4200); leave(true); } return; }
    if (m.kind === 'hello' && m.p) {
      const first = !friend;
      friend = { id: m.from, p: m.p };
      heardAt = Date.now();
      if (first) saveFriend(m.p);
      if (!m.ack) send('hello', { p: profile(), ack: true });      // answer a hello once (an answer is not answered, so there is no echo)
      if (first) {
        PN.Audio.play('chirp');
        UI().toast(tr('<b>{0}</b> joined your room!', fname()), 'seal', '', 4200);
        if (PN.Game.friendCome) PN.Game.friendCome(friend.p);
      }
      paint();
      return;
    }
    if (!friend) return;
    heardAt = Date.now();
    if (m.kind === 'bye') { friendGone(tr('<b>{0}</b> left the room.', fname())); return; }
    if (m.kind === 'invite') return gotInvite(m);
    if (m.kind === 'answer') return gotAnswer(m);
    if (m.kind === 'go') { if (race && race.k === m.k && race.state === 'wait') startRace(); return; }
    if (m.kind === 'seat') { if (race && race.k === m.k && PN.Games.netIn) PN.Games.netIn(m); return; }   // Seat Shuffle: where the other player sat
    if (m.kind === 'score' || m.kind === 'end') {
      if (!race || race.k !== m.k) return;
      race.them.s = m.s | 0; race.them.t = m.t;
      if (m.n) { race.them.snap = m.n; race.them.snapAt = performance.now(); }
      if (m.kind === 'end') { race.them.done = true; race.them.quit = !!m.quit; }
      paintRace();
      if (race.waiter) race.waiter();
    }
  }

  /* The connection can drop when the phone is put away, so the room stays open and the game reconnects by itself, for a few minutes. */
  const LOSS_LIMIT = 5 * 60 * 1000, FRIEND_QUIET = 25000;
  let wireGen = 0, everUp = false, lostAt = 0, retryN = 0, retryT = null;
  const ROOM_KEY = 'pikkunorppa.room';
  const remember = (code) => { if (code) store.set(ROOM_KEY, JSON.stringify({ code, at: Date.now() })); else store.set(ROOM_KEY, ''); };

  function connect() {
    if (!room) return;
    clearTimeout(retryT);
    if (wire) { try { wire.close(); } catch (e) { /* already shut */ } wire = null; }
    const gen = ++wireGen;
    wire = (local ? openLocal : openRealtime)(room, (m) => { if (gen === wireGen) onMsg(m); }, (st) => { if (gen === wireGen) onWire(st); });
  }
  function retryLater() {
    if (!room) return;
    wire = null;
    if (!lostAt) lostAt = Date.now();
    if (Date.now() - lostAt > LOSS_LIMIT) { PN.Audio.play('nope'); UI().toast(tr('The connection dropped, so you left the room.'), 'seal', 'bad', 4200); leave(true); return; }
    clearTimeout(retryT);
    retryT = setTimeout(connect, Math.min(8000, 1000 * Math.pow(2, retryN++)));
  }
  function onWire(state) {
    if (state === 'ok') {
      everUp = true; lostAt = 0; retryN = 0;
      if (friend) heardAt = Date.now();
      paint();
      send('hello', { p: profile() });
      if (!pinger) pinger = setInterval(() => {
        send('ping');
        if (friend && Date.now() - heardAt > FRIEND_QUIET) friendGone(tr('Lost touch with <b>{0}</b>.', fname()));
      }, 4000);
    } else if (state === 'fail' && !everUp) {
      PN.Audio.play('nope'); UI().toast(tr('Could not reach the room. Are you online?'), 'seal', 'bad', 4200); leave(true);
    } else retryLater();           // 'lost', or a failed try while reconnecting
  }
  /* Back from another app: reconnect at once if the line went, and say hello again so a friend who has gone quiet is found. */
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !room) return;
    if (friend) heardAt = Date.now();             // a pause while both were away is not a lost friend
    if (!wire) { retryN = 0; connect(); } else send('hello', { p: profile() });
  });

  function friendGone(msg) {
    if (!friend) return;
    friend = null;
    if (race) { race.them.gone = true; if (race.waiter) race.waiter(); }
    if (PN.Game.friendGo) PN.Game.friendGo();
    UI().toast(msg, 'seal', '', 4200);
    paint();
  }

  function join(code) {
    leave(true);
    room = code; everUp = false; lostAt = 0; retryN = 0;
    remember(code);
    connect();
    paint();
  }
  function leave(quiet) {
    if (wire) { send('bye'); wire.close(); }
    wireGen++; clearTimeout(retryT); stopPip(); PN.Games.net = null;
    wire = null; room = null; remember('');
    clearInterval(pinger); pinger = null;
    if (friend && PN.Game.friendGo) PN.Game.friendGo();
    friend = null; askedK = null;
    if (race && race.waiter) { race.them.gone = true; race.waiter(); }
    if (!quiet) PN.Audio.play('tap');
    paint();
  }
  // No goodbye when the page goes away: putting the app down is not leaving. A friend who really has gone is dropped after a quiet spell.

  /* ---------- the chip on the shore ---------- */
  function paint() {
    if (!chip) {
      chip = document.createElement('button');
      chip.className = 'online-chip pebble'; chip.id = 'onlineChip'; chip.hidden = true;
      chip.addEventListener('click', () => { PN.Audio.play('tap'); Online.open(); });
      const row = document.querySelector('#hud .under'); if (!row) return;
      row.appendChild(chip);                       // in the row under the meters, so it never sits on top of anything
    }
    chip.hidden = !room;
    if (!room) return;
    chip.innerHTML = UI().ic('seal') + '<span>' + tr('Room {0}', room) + '</span><span class="oc-who">' + (friend ? fname() : tr('waiting...')) + '</span>';
    chip.classList.toggle('on', !!friend);
  }

  /* ---------- racing ---------- */
  const canRace = () => PN.Game.raceReady && PN.Game.raceReady();

  async function invite(game) {
    if (!friend || race) return;
    const why = canRace();
    if (why !== true) return;
    const k = uid(), seed = (Math.random() * 4294967296) >>> 0;
    askedK = k;
    race = { k, game, seed, me: { s: 0 }, them: { s: 0 }, state: 'asked', mine: true };
    send('invite', { game, seed, k });
    UI().toast(tr('Asked <b>{0}</b> to race at {1}...', fname(), gameTitle(game)), 'globe', '', 4000);
    setTimeout(() => { if (race && race.k === k && race.state === 'asked') { race = null; askedK = null; UI().toast(tr('<b>{0}</b> did not answer.', fname()), 'globe', 'bad', 3600); } }, 30000);
  }

  async function gotInvite(m) {
    if (!RACE_GAMES[m.game]) { send('answer', { k: m.k, yes: false, why: 'game' }); return; }
    if (!iOwn(m.game)) { send('answer', { k: m.k, yes: false, why: 'own' }); return; }
    if (race || PN.Games.active || UI().modalOpen) { send('answer', { k: m.k, yes: false, why: 'busy' }); return; }
    const title = gameTitle(m.game);
    PN.Audio.play('chirp');
    const v = await UI().modal({ title: tr('A race!'), html: '<p>' + tr('<b>{0}</b> wants to race you at {1}.', fname(), title) + '</p>',
      actions: [{ label: tr('Race'), value: 1 }, { label: tr('Not now'), value: 0 }] });
    if (!friend) return;
    if (v !== 1) { send('answer', { k: m.k, yes: false, why: 'no' }); return; }
    const why = canRace();
    if (why !== true) { send('answer', { k: m.k, yes: false, why: 'cannot' }); return; }
    race = { k: m.k, game: m.game, seed: m.seed >>> 0, me: { s: 0 }, them: { s: 0 }, state: 'wait' };
    send('answer', { k: m.k, yes: true });
    const k = m.k;
    setTimeout(() => { if (race && race.k === k && race.state === 'wait') { race = null; UI().toast(tr('The race was called off.'), 'globe', 'bad', 3600); } }, 8000);
  }

  function gotAnswer(m) {
    if (!race || race.k !== m.k || race.state !== 'asked') return;
    askedK = null;
    if (!m.yes) {
      race = null;
      const msg = m.why === 'busy' ? tr('<b>{0}</b> is busy right now.', fname()) : m.why === 'cannot' ? tr('<b>{0}</b> cannot play right now.', fname()) : m.why === 'own' ? tr('<b>{0}</b> has not unlocked that game yet.', fname()) : tr('<b>{0}</b> said not now.', fname());
      UI().toast(msg, 'globe', 'bad', 3600);
      return;
    }
    if (canRace() !== true || PN.Games.active || UI().modalOpen) { race = null; return; }   // something came up here: the friend's 8 seconds run out and they are told
    send('go', { k: race.k });
    startRace();
  }

  let sender = null;
  function startRace() {
    race.state = 'on';
    if (friend) race.name = friend.p.name;     // kept with the race, in case they leave before it is over
    const ok = PN.Game.raceStart(race.game, { seed: race.seed, name: friend ? friend.p.name : '' });
    if (!ok) { send('end', { k: race.k, s: 0, quit: true }); race = null; return; }
    PN.Games.net = { send: (kind, data) => send(kind, Object.assign({ k: race && race.k }, data)), tie: () => !!(friend && friend.p && String(oid) < String(friend.p.oid)) };
    paintRace();
    let lastS = -1, lastAt = 0;
    clearInterval(sender);
    sender = setInterval(() => {
      if (!race || race.state !== 'on') { clearInterval(sender); return; }
      const live = PN.Games.live && PN.Games.live();
      if (!live) return;
      race.me.s = live.score;
      const now = Date.now();
      // with a live picture: 5 a second, small numbers only. Without: when the score changes, and once a second
      if (live.snap || live.score !== lastS || now - lastAt > 1000) { lastS = live.score; lastAt = now; send('score', { k: race.k, s: live.score, t: live.time == null ? null : Math.ceil(live.time), n: live.snap || undefined }); }
      paintRace();
    }, 200);
    startPip();
  }

  /* ---------- the picture in the corner ---------- */
  let pip = null, pipRaf = 0;
  const GREEN = '#3f7d5a', ICE = '#dff1fb';
  function startPip() {
    stopPip();
    const box = document.createElement('div');
    box.className = 'vs-pip'; box.id = 'vsPip';
    box.innerHTML = '<canvas></canvas><div class="vs-pip-name"></div>';
    $('gamehud').appendChild(box);
    pip = { box, cv: box.querySelector('canvas'), name: box.querySelector('.vs-pip-name') };
    pip.name.textContent = race && race.name ? race.name : '';
    const loop = () => { if (!pip) return; drawPip(); pipRaf = requestAnimationFrame(loop); };
    pipRaf = requestAnimationFrame(loop);
  }
  function stopPip() {
    cancelAnimationFrame(pipRaf);
    if (pip) { pip.box.remove(); pip = null; }
  }
  let pipT = 0;
  /* A number that glides towards where the last snapshot said it is, so five updates a second look like smooth video. */
  function glide(key, target, rate) {
    const th = race.them, sm = th.sm || (th.sm = {});
    if (sm[key] === undefined || !isFinite(sm[key])) sm[key] = target;
    else sm[key] += (target - sm[key]) * (1 - Math.exp(-(rate || 14) * pip.dt));
    return sm[key];
  }
  function drawPip() {
    if (!pip || !race) return;
    const nowT = performance.now(); pip.dt = Math.min(0.1, (nowT - (pipT || nowT)) / 1000); pipT = nowT;
    const wide = window.innerWidth > window.innerHeight, w = wide ? 132 : 96, h = wide ? 88 : 128, dpr = Math.min(2, window.devicePixelRatio || 1);
    const cv = pip.cv;
    if (cv.width !== w * dpr) { cv.width = w * dpr; cv.height = h * dpr; cv.style.width = w + 'px'; cv.style.height = h + 'px'; }
    const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
    const th = race.them, n = th.snap, dt = th.snapAt ? Math.min(0.6, (performance.now() - th.snapAt) / 1000) : 0, id = race.game;
    const stale = th.snapAt && performance.now() - th.snapAt > 2000;
    c.globalAlpha = stale || th.done ? 0.55 : 1;
    const sky = c.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#a9d3ef'); sky.addColorStop(1, '#eaf5fb');
    const seal = (x, y, r) => { c.fillStyle = '#c9ced6'; c.beginPath(); c.ellipse(x, y, r * 1.5, r, 0, 0, 6.3); c.fill(); c.fillStyle = '#eef0f4'; c.beginPath(); c.arc(x + r * 0.9, y - r * 0.25, r * 0.62, 0, 6.3); c.fill(); c.fillStyle = '#2b3140'; c.beginPath(); c.arc(x + r * 1.1, y - r * 0.4, r * 0.12, 0, 6.3); c.fill(); };
    const dot = (x, y, r, col) => { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, 6.3); c.fill(); };
    if (n && id === 'catch') {
      c.fillStyle = sky; c.fillRect(0, 0, w, h); c.fillStyle = '#f5fbff'; c.fillRect(0, h - 14, w, 14);
      (n.it || []).forEach((it) => { const y = Math.max(0, it[1] - (n.v || 0.4) * dt); const px = 8 + it[0] * (w - 16), py = (1 - y) * (h - 24) + 4; dot(px, py, it[2] === 2 ? 5 : 3.5, it[2] === 2 ? '#ffffff' : it[2] === 1 ? '#ffc94a' : '#ee8a5a'); if (it[2] === 2) { c.strokeStyle = '#9db8cc'; c.lineWidth = 1; c.stroke(); } });
      seal(8 + n.x * (w - 16) - 6, h - 12, 6);
    } else if (n && id === 'ball') {
      c.fillStyle = sky; c.fillRect(0, 0, w, h); c.fillStyle = '#f5fbff'; c.fillRect(0, h - 14, w, 14);
      seal(8 + n.x * (w - 16) - 6, h - 12, 6);
      if (n.b) dot(8 + n.b[0] * (w - 16), (1 - n.b[1]) * (h - 24) + 4, 5, '#e97559');
    } else if (n && id === 'swim') {
      const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#5aa6cf'); g.addColorStop(1, '#1d5a86'); c.fillStyle = g; c.fillRect(0, 0, w, h);
      const px = (v) => v * w, py = (v) => (1 - v) * h;
      (n.o || []).forEach((o) => { const x = px(o[0] - (n.v || 0) * dt); c.fillStyle = ICE; c.fillRect(x - 4, 0, 8, py(o[1])); c.fillStyle = GREEN; c.fillRect(x - 4, py(o[2]), 8, h - py(o[2])); });
      seal(px(n.s), py(n.y), 5);
      if (n.d) { c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(0, 0, w, h); }
    } else if (n && id === 'sled') {
      c.fillStyle = '#f4f9ff'; c.fillRect(0, 0, w, h); c.fillStyle = '#e1ecf7'; c.fillRect(w * 0.1, 0, w * 0.8, h);
      const lane = (x) => w / 2 + x * w * 0.36, zy = (z) => ((z + 24) / 28) * (h - 10) + 2;
      (n.it || []).forEach((it) => { const px = lane(it[1]), py = zy(it[2] + (n.v || 0) * dt); if (py > h + 6) return; if (it[0] === 0) { c.fillStyle = '#2f6b52'; c.beginPath(); c.moveTo(px, py - 7); c.lineTo(px - 5, py + 3); c.lineTo(px + 5, py + 3); c.fill(); } else if (it[0] === 1) dot(px, py, 4, '#7d8793'); else if (it[0] === 2) dot(px, py, 3, '#ee8a5a'); else { c.fillStyle = '#b98b5a'; c.fillRect(px - 5, py - 2, 10, 4); } });
      c.fillStyle = '#c9ced6'; c.beginPath(); c.ellipse(lane(n.x), zy(0), 4, 6, 0, 0, 6.3); c.fill();
      if (n.d) { c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(0, 0, w, h); }
    } else if (n && id === 'stack') {
      c.fillStyle = '#cfe7f3'; c.fillRect(0, 0, w, h);
      const k = Math.min(w, h - 22) / 7, ox = w / 2, oy = (h - 14) / 2 + 2;
      const rect = (x, z, ww, dd, col, line) => { c.fillStyle = col; c.fillRect(ox + (x - ww / 2) * k, oy + (z - dd / 2) * k, ww * k, dd * k); if (line) { c.strokeStyle = line; c.lineWidth = 1; c.strokeRect(ox + (x - ww / 2) * k, oy + (z - dd / 2) * k, ww * k, dd * k); } };
      rect(n.t[0], n.t[1], n.t[2], n.t[3], '#ffe3a9', '#d9b46c');
      if (n.c) rect(glide('cx', n.c[0], 18), glide('cz', n.c[1], 18), n.c[2], n.c[3], 'rgba(237,176,189,.88)', '#c9788c');
      c.fillStyle = '#26456b'; c.font = '800 11px sans-serif'; c.textAlign = 'center'; c.fillText(String(n.n), w / 2, h - 4);
    } else if (n && id === 'toss') {
      c.fillStyle = sky; c.fillRect(0, 0, w, h); c.fillStyle = '#f5fbff'; c.fillRect(0, 12, w, h - 24);
      const X = (x) => w / 2 + x * (w / 6), Z = (z) => 18 + (z + 2.4) / 6.2 * (h - 44);
      c.fillStyle = '#5c9ba3'; c.beginPath(); c.arc(X(n.k[0]), Z(n.k[1]), 9, 0, 6.3); c.fill(); c.fillStyle = '#2d5c64'; c.beginPath(); c.arc(X(n.k[0]), Z(n.k[1]), 6, 0, 6.3); c.fill();
      if (n.b) { const bx = glide('bx', n.b[0], 22), bz = glide('bz', n.b[1], 22); dot(X(bx), Z(bz) - n.b[2] * 4, 4 + n.b[2] * 0.8, '#ffffff'); c.strokeStyle = '#9db8cc'; c.lineWidth = 1; c.beginPath(); c.arc(X(bx), Z(bz) - n.b[2] * 4, 4 + n.b[2] * 0.8, 0, 6.3); c.stroke(); }
      c.fillStyle = '#26456b'; c.font = '800 10px sans-serif'; c.textAlign = 'center'; c.fillText((n.w < 0 ? '← ' : n.w > 0 ? '→ ' : '') + Math.abs(n.w), w / 2, 22);
      for (let i = 0; i < n.l; i++) dot(w / 2 + (i - (n.l - 1) / 2) * 11, h - 8, 3.5, i < n.t ? '#b3412f' : '#4d8f64');
    } else if (n && id === 'curl') {
      c.fillStyle = '#e8f3fa'; c.fillRect(0, 0, w, h);
      const X = (x) => w / 2 + x * (w / 7), Z = (z) => 14 + (3.4 - z) / 17.5 * (h - 24);
      const gx = X(n.g[0]), gz = Z(n.g[1]);
      [['#3f7fb3', 22], ['#ffffff', 15], ['#d9604c', 9], ['#ffffff', 4]].forEach((r) => { c.fillStyle = r[0]; c.beginPath(); c.arc(gx, gz, r[1] * (wide ? 0.7 : 0.55), 0, 6.3); c.fill(); });
      (n.bl || []).forEach((b) => { c.fillStyle = '#8fb6d4'; c.fillRect(X(glide('bl' + b[1], b[0], 14)) - 6, Z(b[1]) - 3, 12, 6); });
      const sx = glide('sx', n.p[0], 20), sz = glide('sz', n.p[1], 20);
      dot(X(sx), Z(sz), 4.5, '#dfe3ea'); c.strokeStyle = '#6b7380'; c.lineWidth = 1; c.beginPath(); c.arc(X(sx), Z(sz), 4.5, 0, 6.3); c.stroke();
      c.fillStyle = '#26456b'; c.font = '800 10px sans-serif'; c.textAlign = 'center'; c.fillText(n.n + ' / 8', w / 2, h - 3);
    } else if (n && id === 'piano') {
      c.fillStyle = '#2a1d2a'; c.fillRect(0, 0, w, h);
      const L = n.l || 4, lw = w / L, line = h * 0.82;
      for (let i = 1; i < L; i++) { c.fillStyle = 'rgba(255,226,171,.18)'; c.fillRect(i * lw - 0.5, 0, 1, h); }
      c.fillStyle = 'rgba(255,226,171,.35)'; c.fillRect(0, line, w, 1);
      n.t.forEach((t, i) => { const d = t[1] - (n.v || 0) * dt, y = line - d * h * 1.1 - h * 0.2; if (y > h || y < -h * 0.3) return; c.fillStyle = i === 1 || (i === 0 && n.t.length < 8) ? '#ffd15c' : '#f4ead6'; c.fillRect(t[0] * lw + 2, y, lw - 4, h * 0.2); });
      if (n.m) { c.fillStyle = 'rgba(179,65,47,.35)'; c.fillRect(0, 0, w, h); }
    } else {
      // no live picture for this game: a score card
      c.fillStyle = '#26456b'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#9fc2e6'; c.font = '800 11px sans-serif'; c.textAlign = 'center'; c.fillText(gameTitle(id), w / 2, 28, w - 8);
      c.fillStyle = '#ffffff'; c.font = '600 ' + (wide ? 34 : 40) + 'px sans-serif'; c.fillText(String(th.s), w / 2, h / 2 + 12);
      c.fillStyle = '#9fc2e6'; c.font = '800 10px sans-serif'; c.fillText(th.done ? tr('Done') : tr('Playing...'), w / 2, h - 10);
    }
    c.globalAlpha = 1;
    if (th.done) { c.fillStyle = 'rgba(20,40,70,.55)'; c.font = '800 12px sans-serif'; c.textAlign = 'center'; c.fillText(tr('Done'), w / 2, h / 2); }
  }

  /* the friend's score in the game's top bar */
  function paintRace() {
    let el = $('gVs');
    if (!race || race.state !== 'on') { if (el) el.hidden = true; return; }
    if (!pip) startPip();
    if (!el) {
      el = document.createElement('div');
      el.className = 'g-pill pebble g-vs'; el.id = 'gVs';
      const top = document.querySelector('#gamehud .g-top'), quit = $('gQuit');
      top.insertBefore(el, quit);
    }
    el.hidden = false;
    const them = race.them.s, mine = race.me.s, lead = mine > them ? 'ahead' : mine < them ? 'behind' : 'level';
    el.className = 'g-pill pebble g-vs ' + lead;
    el.innerHTML = '<span class="vs-name">' + UI().esc(race.name || (friend ? friend.p.name : '')) + '</span> <b>' + them + '</b>' + (race.them.done ? '<span class="vs-done">' + UI().ic('check') + '</span>' : '');
  }

  /* My game ended (finished or given up). */
  function myEnd(score, quit) {
    if (!race || race.state !== 'on') return;
    race.state = 'over';
    race.me.s = score; race.me.done = true; race.me.quit = !!quit;
    clearInterval(sender);
    send('end', { k: race.k, s: score, quit: !!quit });
    paintRace();
  }

  /* After my game: wait a little for the friend's final score, then say who won. Returns at once if there was no race. */
  async function verdict() {
    if (!race || race.state !== 'over') return;
    const r = race;
    if (!r.them.done && !r.them.gone) {
      // my game is over but theirs is still going: wait here, with their score as it climbs, until they finish (or I stop waiting)
      const nm = UI().esc(r.name || tr('Your friend'));
      const text = () => tr('{0} is still playing. Score so far: <b>{1}</b>.', nm, r.them.s);
      let closer = null;
      const ping = () => { if ((r.them.done || r.them.gone) && closer) closer(); };
      r.waiter = () => { const el = document.getElementById('vsWait'); if (el) el.innerHTML = text(); ping(); };
      await UI().modal({ title: tr('Your game is over'), html: '<p id="vsWait">' + text() + '</p><p class="note">' + tr('Your score: {0}', r.me.s) + '</p>',
        actions: [{ label: tr('Stop waiting'), value: 0, cls: 'ghost' }],
        onOpen(card) {
          const t0 = performance.now();
          closer = () => setTimeout(() => { const b = card.querySelector('.actions .btn'); if (b) b.click(); }, Math.max(0, UI().modalDelay + 60 - (performance.now() - t0)));
          setTimeout(() => { if (closer) closer(); }, 5 * 60 * 1000);   // never wait for ever
          ping();
        } });
      r.waiter = null;
    }
    race = null; stopPip(); PN.Games.net = null;
    const name = UI().esc(r.name || tr('Your friend')), a = r.me.s, b = r.them.s;
    let head, line, cls;
    if (r.me.quit && !r.them.quit) { head = tr('{0} wins', name); line = tr('You stopped the game, so the race goes to {0}.', name); cls = 'sad'; }
    else if (r.them.quit && !r.me.quit) { head = tr('You win!'); line = tr('{0} stopped the game early.', name); cls = 'award'; }
    else if (!r.them.done) { head = a > b ? tr('You win!') : a < b ? tr('{0} wins', name) : tr('A draw!'); line = tr('{0} did not send a final score, so this uses the last one heard.', name); cls = a >= b ? 'award' : 'sad'; }
    else if (a > b) { head = tr('You win!'); line = tr('You beat {0}.', name); cls = 'award'; }
    else if (a < b) { head = tr('{0} wins', name); line = tr('So close. Ask for a rematch!'); cls = 'sad'; }
    else { head = tr('A draw!'); line = tr('Exactly the same score.'); cls = 'coin'; }
    PN.Audio.play(cls);
    const html = '<div class="vs-board"><div><span>' + tr('You') + '</span><b>' + a + '</b></div><div><span>' + name + '</span><b>' + b + '</b></div></div><p>' + line + '</p>';
    await UI().modal({ title: head, html, actions: [{ label: tr('OK'), value: 1 }] });
  }

  async function share() {
    const url = linkFor(room), text = tr('Come and play with my seal! Open this link to join my room.');
    if (navigator.share) {
      try { await navigator.share({ title: 'Pikku Norppa', text, url }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    let ok = false;
    try { if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(url); ok = true; } } catch (e) { ok = false; }
    if (ok) UI().toast(tr('Link copied. Send it to your friend.'), 'check');
    else await UI().modal({ title: tr('Your invite link'), html: '<p>' + tr('Press and hold the link to copy it.') + '</p><textarea class="field" readonly style="margin-top:12px">' + url + '</textarea>', actions: [{ label: tr('Close'), value: 0 }] });
  }

  /* ---------- the menu ---------- */
  const Online = PN.Online = {
    get room() { return room; },
    get friend() { return friend ? friend.p : null; },
    racing: () => !!(race && (race.state === 'on' || race.state === 'over')),
    myEnd, verdict,
    /* Called once the game is up: if the page was opened from a shared link, go into that room. */
    joinPending() {
      if (room) return;
      if (pending) {
        const code = pending; pending = null;
        join(code);
        UI().toast(tr('Joining room <b>{0}</b>...', code), 'globe', '', 3600);
        return;
      }
      try {                                          // the app was closed or reloaded a moment ago: go back into the room
        const r = JSON.parse(store.get(ROOM_KEY) || 'null');
        if (r && /^[A-Z]{4}$/.test(r.code) && Date.now() - r.at < 20 * 60 * 1000) {
          join(r.code);
          UI().toast(tr('Back in room <b>{0}</b>.', r.code), 'globe', '', 3200);
        }
      } catch (e) { /* nothing saved */ }
    },
    friends: savedFriends,
    join: (code) => join(String(code || '').toUpperCase()),
    leave,
    async open() {
      if (!PN.Game.state) return;
      if (!room) {
        const v = await UI().modal({ title: tr('Play online'), html: '<p>' + tr('Make a room and tell a friend its code, or type in the code a friend gave you.') + '</p>' + (local ? '<p class="note">' + tr('Test mode: rooms only reach other tabs in this browser.') + '</p>' : ''),
          actions: [{ label: tr('Make a room'), value: 'make' }, { label: tr('Join a room'), value: 'join', cls: 'ghost' }, { label: tr('Not now'), value: 0 }] });
        if (v === 'make') {
          const code = WORDS[Math.floor(Math.random() * WORDS.length)];
          join(code);
          UI().toast(tr('Your room code is <b>{0}</b>. Tell your friend!', code), 'seal', '', 6000);
        } else if (v === 'join') {
          const code = await UI().modal({ title: tr('Join a room'), html: '<p>' + tr('Type the four-letter word your friend sees.') + '</p><input class="field" id="roomIn" maxlength="4" autocomplete="off" autocapitalize="characters" spellcheck="false" style="margin-top:12px;text-transform:uppercase;letter-spacing:.3em;text-align:center;font-size:22px">',
            actions: [{ label: tr('Join'), value: 1 }, { label: tr('Cancel'), value: 0 }],
            onOpen(card) { const i = card.querySelector('#roomIn'); if (i) setTimeout(() => i.focus(), 250); },
            result(val, card) { return val ? String(card.querySelector('#roomIn').value || '').toUpperCase().replace(/[^A-Z]/g, '') : ''; } });
          if (code && code.length === 4) join(code);
          else if (code) { PN.Audio.play('nope'); UI().toast(tr('A room code is four letters.'), 'seal', 'bad'); }
        }
        return;
      }
      const theirs = friend && friend.p.games ? friend.p.games : ['catch'];
      const games = RACE_IDS.filter((id) => iOwn(id) && theirs.indexOf(id) >= 0);
      const acts = friend && !race && games.length ? [{ label: tr('Race a game'), value: 'pick' }] : [];
      acts.push({ label: tr('Share invite link'), value: 'share', cls: friend ? 'ghost' : '' });
      const met = savedFriends().filter((f) => !friend || f.oid !== (friend.p && friend.p.oid)).slice(0, 5).map((f) => UI().esc(f.name)).join(', ');
      const text = (friend ? tr('<b>{0}</b> is on your shore.', fname()) : tr('Waiting for a friend. Your room code is <b>{0}</b>.', room))
        + (met ? '</p><p class="note">' + tr('Seals you have met: {0}.', met) : '');
      const v = await UI().modal({ title: tr('Room {0}', room), html: '<p>' + text + '</p>', actions: acts.concat([{ label: tr('Leave the room'), value: 'leave', cls: 'ghost' }, { label: tr('Close'), value: 0 }]) });
      if (v === 'leave') leave();
      else if (v === 'share') share();
      else if (v === 'pick') {
        const pick = await UI().modal({ title: tr('Race a game'), html: '<p>' + tr('Both of you play the same game at the same time, and see how the other is doing in a corner of the screen.') + '</p>',
          actions: games.map((id) => ({ label: gameTitle(id), value: id, cls: 'ghost' })).concat([{ label: tr('Not now'), value: 0 }]) });
        if (!pick || !friend) return;
        const why = canRace();
        if (why !== true) { PN.Game.raceRefuse(why); return; }
        invite(pick);
      }
    },
  };
})(window.PN = window.PN || {});
