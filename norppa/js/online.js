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
  const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';           // no I or O, so a code read aloud cannot be mistaken
  const RACE_GAMES = { catch: 'Fish Rain' };
  const local = /^(localhost|127\.\d+\.\d+\.\d+|\[::1\])$/.test(location.hostname) || /[?&]mp=local\b/.test(location.search);

  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const me = uid();

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
    return { name: String(st.name || '').slice(0, 24), stage: st.stage, appearance: st.appearance, wearing: st.wearing };
  };
  const send = (kind, extra) => { if (wire) wire.send(Object.assign({ kind, from: me }, extra || {})); };
  const fname = () => UI().esc(friend ? friend.p.name || tr('Your friend') : tr('Your friend'));
  const UI = () => PN.UI;

  function onMsg(m) {
    if (!m || m.from === me || !wire) return;
    if (friend && m.from !== friend.id) { if (m.kind === 'hello') send('full', { to: m.from }); return; }
    if (m.kind === 'full') { if (m.to === me && !friend) { PN.Audio.play('nope'); UI().toast(tr('That room already has two seals.'), 'seal', 'bad', 4200); leave(true); } return; }
    if (m.kind === 'hello' && m.p) {
      const first = !friend;
      friend = { id: m.from, p: m.p };
      heardAt = Date.now();
      if (first) {
        send('hello', { p: profile() });
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
    if (m.kind === 'score' || m.kind === 'end') {
      if (!race || race.k !== m.k) return;
      race.them.s = m.s | 0; race.them.t = m.t;
      if (m.kind === 'end') { race.them.done = true; race.them.quit = !!m.quit; }
      paintRace();
      if (race.waiter) race.waiter();
    }
  }

  function onWire(state) {
    if (state === 'ok') {
      paint();
      send('hello', { p: profile() });
      pinger = setInterval(() => {
        send('ping');
        if (friend && Date.now() - heardAt > 15000) friendGone(tr('Lost touch with <b>{0}</b>.', fname()));
      }, 4000);
    } else if (state === 'fail') {
      PN.Audio.play('nope'); UI().toast(tr('Could not reach the room. Are you online?'), 'seal', 'bad', 4200); leave(true);
    } else if (state === 'lost') {
      PN.Audio.play('nope'); UI().toast(tr('The connection dropped, so you left the room.'), 'seal', 'bad', 4200); leave(true);
    }
  }

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
    room = code;
    wire = (local ? openLocal : openRealtime)(code, onMsg, onWire);
    paint();
  }
  function leave(quiet) {
    if (wire) { send('bye'); wire.close(); }
    wire = null; room = null;
    clearInterval(pinger); pinger = null;
    if (friend && PN.Game.friendGo) PN.Game.friendGo();
    friend = null; askedK = null;
    if (race && race.waiter) { race.them.gone = true; race.waiter(); }
    if (!quiet) PN.Audio.play('tap');
    paint();
  }
  window.addEventListener('pagehide', () => { if (wire) send('bye'); });

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
    UI().toast(tr('Asked <b>{0}</b> to race at {1}...', fname(), tr(RACE_GAMES[game])), 'globe', '', 4000);
    setTimeout(() => { if (race && race.k === k && race.state === 'asked') { race = null; askedK = null; UI().toast(tr('<b>{0}</b> did not answer.', fname()), 'globe', 'bad', 3600); } }, 30000);
  }

  async function gotInvite(m) {
    if (!RACE_GAMES[m.game]) { send('answer', { k: m.k, yes: false, why: 'game' }); return; }
    if (race || PN.Games.active || UI().modalOpen) { send('answer', { k: m.k, yes: false, why: 'busy' }); return; }
    const title = tr(RACE_GAMES[m.game]);
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
      const msg = m.why === 'busy' ? tr('<b>{0}</b> is busy right now.', fname()) : m.why === 'cannot' ? tr('<b>{0}</b> cannot play right now.', fname()) : tr('<b>{0}</b> said not now.', fname());
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
    paintRace();
    let lastS = -1, lastAt = 0;
    clearInterval(sender);
    sender = setInterval(() => {
      if (!race || race.state !== 'on') { clearInterval(sender); return; }
      const live = PN.Games.live && PN.Games.live();
      if (!live) return;
      race.me.s = live.score;
      const now = Date.now();
      if (live.score !== lastS || now - lastAt > 1000) { lastS = live.score; lastAt = now; send('score', { k: race.k, s: live.score, t: Math.ceil(live.time) }); }
      paintRace();
    }, 250);
  }

  /* the friend's score in the game's top bar */
  function paintRace() {
    let el = $('gVs');
    if (!race || race.state !== 'on') { if (el) el.hidden = true; return; }
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
      await new Promise((res) => {
        const t = setTimeout(res, 15000);   // a slow phone, or one that was put away for a moment, can be a few seconds behind
        r.waiter = () => { if (r.them.done || r.them.gone) { clearTimeout(t); res(); } };
        UI().toast(tr('Waiting for <b>{0}</b> to finish...', UI().esc(r.name || '')), 'clock', '', 3000);
      });
    }
    race = null;
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

  /* ---------- the menu ---------- */
  const Online = PN.Online = {
    get room() { return room; },
    get friend() { return friend ? friend.p : null; },
    racing: () => !!(race && (race.state === 'on' || race.state === 'over')),
    myEnd, verdict,
    join: (code) => join(String(code || '').toUpperCase()),
    leave,
    async open() {
      if (!PN.Game.state) return;
      if (!room) {
        const v = await UI().modal({ title: tr('Play online'), html: '<p>' + tr('Make a room and tell a friend its code, or type in the code a friend gave you.') + '</p>' + (local ? '<p class="note">' + tr('Test mode: rooms only reach other tabs in this browser.') + '</p>' : ''),
          actions: [{ label: tr('Make a room'), value: 'make' }, { label: tr('Join a room'), value: 'join', cls: 'ghost' }, { label: tr('Not now'), value: 0 }] });
        if (v === 'make') {
          let code = ''; for (let i = 0; i < 4; i++) code += LETTERS[Math.floor(Math.random() * LETTERS.length)];
          join(code);
          UI().toast(tr('Your room code is <b>{0}</b>. Tell your friend!', code), 'seal', '', 6000);
        } else if (v === 'join') {
          const code = await UI().modal({ title: tr('Join a room'), html: '<p>' + tr('Type the four letters your friend sees.') + '</p><input class="field" id="roomIn" maxlength="4" autocomplete="off" autocapitalize="characters" spellcheck="false" style="margin-top:12px;text-transform:uppercase;letter-spacing:.3em;text-align:center;font-size:22px">',
            actions: [{ label: tr('Join'), value: 1 }, { label: tr('Cancel'), value: 0 }],
            onOpen(card) { const i = card.querySelector('#roomIn'); if (i) setTimeout(() => i.focus(), 250); },
            result(val, card) { return val ? String(card.querySelector('#roomIn').value || '').toUpperCase().replace(/[^A-Z]/g, '') : ''; } });
          if (code && code.length === 4) join(code);
          else if (code) { PN.Audio.play('nope'); UI().toast(tr('A room code is four letters.'), 'seal', 'bad'); }
        }
        return;
      }
      const games = Object.keys(RACE_GAMES);
      const acts = friend && !race ? games.map((id) => ({ label: tr('Race at {0}', tr(RACE_GAMES[id])), value: 'race:' + id })) : [];
      const text = friend ? tr('<b>{0}</b> is on your shore.', fname()) : tr('Waiting for a friend. Your room code is <b>{0}</b>.', room);
      const v = await UI().modal({ title: tr('Room {0}', room), html: '<p>' + text + '</p>', actions: acts.concat([{ label: tr('Leave the room'), value: 'leave', cls: 'ghost' }, { label: tr('Close'), value: 0 }]) });
      if (v === 'leave') leave();
      else if (typeof v === 'string' && v.indexOf('race:') === 0) {
        const why = canRace();
        if (why !== true) { PN.Game.raceRefuse(why); return; }
        invite(v.slice(5));
      }
    },
  };
})(window.PN = window.PN || {});
