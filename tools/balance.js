#!/usr/bin/env node
/*
  Auto-balance. Reads stats/latest.json (saved every morning by the stats job) and nudges every game towards the same
  coins a minute and the same happiness a minute for the average player.

    node tools/balance.js            show what it would change (changes nothing)
    node tools/balance.js --apply    change norppa/js/data.js, tools/balance-state.json, norppa/sw.js and write stats/balance-report.md

  What it changes, per game (Sauna is left out, it works differently):
    pay    the first number of  pay: [a, b]  (coins = a x points^b), so a game that pays too little pays a bit more
    joyMul a happiness multiplier (default 1) so a game that gives too little happiness a minute gives a bit more
    len    how many seconds a usual play lasts, which only feeds the "per minute" figure in the Play menu

  Safety: a game needs enough players and plays before it is touched; each run moves a number by at most 5%, never more than 30% away
  from where it started (tools/balance-state.json remembers the start); a game within 4% of its aim is left alone; and the stats are
  all-time averages, so after a change a game must collect fresh plays first and the fresh plays are what get judged (the old ones
  are subtracted using the figures saved at the time of the change). Mum Mode plays are not in the stats, so they cannot skew anything.
  Mum Mode still pays the same as normal play, so it moves with the normal numbers.
*/
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'norppa/js/data.js');
const SW = path.join(ROOT, 'norppa/sw.js');
const STATE = path.join(__dirname, 'balance-state.json');
const SNAP = path.join(ROOT, 'stats/latest.json');
const REPORT = path.join(ROOT, 'stats/balance-report.md');

const AIM = {
  coinsPerMin: 30,    // what every game should pay for a minute of play (the average player)
  joyPerMin: 12,      // happiness a minute; 12 is where the players' mix is now, so overall pace stays the same
};
const RULE = {
  step: 0.05,         // most a number may move in one run
  drift: 0.30,        // most a number may end up from where it started
  deadband: 0.04,     // inside 4% of the aim: leave it
  minPlayers: 10,     // players with finished plays of the game
  minPlays: 40,       // plays of the game
  minNew: 40,         // fresh plays since the last change before it is judged again
  maxAgeDays: 3,      // do nothing on stale stats
  skip: ['sauna'],
};

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const snapPath = (args.find((a) => a.startsWith('--stats=')) || '').slice(8) || SNAP;
const dataPath = (args.find((a) => a.startsWith('--data=')) || '').slice(7) || DATA;
const statePath = (args.find((a) => a.startsWith('--state=')) || '').slice(8) || STATE;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const sig = (v) => Number(v.toPrecision(3));

function loadGames(file) {
  const win = { PN: {} };
  new Function('window', 'localStorage', 'document', 'navigator', fs.readFileSync(file, 'utf8'))(win, {}, {}, {});
  return win.PN.GAMES;
}

/* The stats are averages over everything so far. A game's recent rate is what is left once the plays from before the last change
   (count n0, rate m0 at that time) are taken out of the all-time figure (count n, rate m). */
function recent(m, n, mem) {
  const n0 = mem ? mem.n0 : 0, m0 = mem ? mem.m0 : 0;
  const fresh = n - n0;
  if (fresh < RULE.minNew && n0 > 0) return { fresh, value: null };
  if (n0 === 0) return { fresh: n, value: m };
  return { fresh, value: (m * n - m0 * n0) / fresh };
}

function main() {
  const snap = JSON.parse(fs.readFileSync(snapPath, 'utf8'));
  const age = (Date.now() - new Date(snap.generated).getTime()) / 864e5;
  const notes = [];
  if (!(age <= RULE.maxAgeDays)) {
    console.log('Stats are ' + (isFinite(age) ? age.toFixed(1) + ' days old' : 'undated') + ', nothing changed.');
    return { changed: false };
  }
  const games = loadGames(dataPath);
  const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8')) : { base: {}, games: {}, runs: 0 };
  const rows = [];
  const edits = {};   // id -> { a, joyMul, len }

  (snap.per_game || []).forEach((g) => {
    const def = games[g.game];
    if (!def || !def.pay || RULE.skip.indexOf(g.game) >= 0) return;
    const row = { id: g.game, title: def.title, players: g.players, plays: g.plays, notes: [] };
    rows.push(row);
    if (g.players < RULE.minPlayers || g.plays < RULE.minPlays) { row.notes.push('not enough plays yet (' + g.players + ' players, ' + g.plays + ' plays)'); return; }

    const base = (state.base[g.game] = state.base[g.game] || { a: def.pay[0], joyMul: def.joyMul || 1 });
    const mem = (state.games[g.game] = state.games[g.game] || { pay: { n0: 0, m0: 0 }, joy: { n0: 0, m0: 0 } });
    const cur = { a: def.pay[0], joyMul: def.joyMul || 1, len: def.len };
    const next = {};

    // coins a minute
    row.cpm = g.coins_per_min;
    const rc = recent(g.coins_per_min, g.plays, mem.pay);
    if (rc.value == null) row.notes.push('waiting for fresh plays after the last pay change (' + rc.fresh + ' of ' + RULE.minNew + ')');
    else if (rc.value > 0) {
      row.cpmRecent = rc.value;
      const gap = AIM.coinsPerMin / rc.value - 1;
      if (Math.abs(gap) > RULE.deadband) {
        const a = sig(clamp(cur.a * (1 + clamp(gap, -RULE.step, RULE.step)), base.a * (1 - RULE.drift), base.a * (1 + RULE.drift)));
        if (a !== cur.a) { next.a = a; mem.pay = { n0: g.plays, m0: g.coins_per_min }; }
        else row.notes.push('pay is at its 30% limit from the start');
      }
    }

    // happiness a minute
    if (g.joy_per_min != null) {
      row.joy = g.joy_per_min;
      const rj = recent(g.joy_per_min, g.plays, mem.joy);
      if (rj.value == null) row.notes.push('waiting for fresh plays after the last happiness change (' + rj.fresh + ' of ' + RULE.minNew + ')');
      else if (rj.value > 0) {
        row.joyRecent = rj.value;
        const gap = AIM.joyPerMin / rj.value - 1;
        if (Math.abs(gap) > RULE.deadband) {
          const m = sig(clamp(cur.joyMul * (1 + clamp(gap, -RULE.step, RULE.step)), base.joyMul * (1 - RULE.drift), base.joyMul * (1 + RULE.drift)));
          if (m !== cur.joyMul) { next.joyMul = m; mem.joy = { n0: g.plays, m0: g.joy_per_min }; }
          else row.notes.push('happiness is at its 30% limit from the start');
        }
      } else row.notes.push('happiness is not positive for the average player, left alone');
    }

    // usual length, for the Play menu
    if (g.avg_secs > 0) {
      const len = clamp(Math.round(g.avg_secs / 5) * 5, 20, 150);
      if (len !== cur.len) next.len = len;
    }

    row.cur = cur; row.next = next;
    if (Object.keys(next).length) edits[g.game] = next;
  });

  // ---- report
  const f = (v, d = 1) => (v == null ? '-' : Number(v).toFixed(d));
  const lines = [];
  lines.push('# Balance run (' + String(snap.generated).slice(0, 10) + ')', '');
  lines.push('Aim: ' + AIM.coinsPerMin + ' coins a minute and ' + AIM.joyPerMin + ' happiness a minute in every game, for the average player. Each number moves at most ' + RULE.step * 100 + '% a run and never more than ' + RULE.drift * 100 + '% from where it started. Mum Mode plays are not counted.', '');
  lines.push('| Game | Players | Plays | Coins/min now | Aim | Pay a | Happiness/min now | Aim | Happiness x | Usual length |');
  lines.push('| --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | --- | --- |');
  rows.forEach((r) => {
    const n = r.next || {}, c = r.cur || {};
    const ch = (k, d) => (c[k] == null ? '-' : n[k] != null && n[k] !== c[k] ? c[k] + ' → ' + n[k] : String(c[k]));
    lines.push('| ' + [r.title, r.players, r.plays, f(r.cpm), AIM.coinsPerMin, ch('a'), f(r.joy), AIM.joyPerMin, ch('joyMul'), ch('len')].join(' | ') + ' |');
  });
  const idle = rows.filter((r) => r.notes.length || !Object.keys(r.next || {}).length);
  lines.push('');
  idle.forEach((r) => lines.push('- ' + r.title + ': ' + (r.notes.length ? r.notes.join('; ') : 'already on target')));
  const text = lines.join('\n') + '\n';

  console.log(text);
  const n = Object.keys(edits).length;
  if (!n) { console.log('Nothing to change.'); return { changed: false }; }
  if (!apply) { console.log(n + ' game(s) would change. Run with --apply to do it.'); return { changed: false }; }

  // ---- write the changes
  let src = fs.readFileSync(dataPath, 'utf8');
  Object.keys(edits).forEach((id) => {
    const e = edits[id];
    const re = new RegExp('^(    ' + id + ': \\{.*)$', 'm');
    let line = (src.match(re) || [])[1];
    if (!line) throw new Error('cannot find the ' + id + ' line in data.js');
    const orig = line;
    // the object ends at the first "}," so notes after it are left alone
    const end = line.indexOf('},');
    let body = line.slice(0, end), tail = line.slice(end);
    if (e.a != null) body = body.replace(/pay: \[[^,\]]+,/, 'pay: [' + e.a + ',');
    if (e.len != null) body = body.replace(/len: \d+/, 'len: ' + e.len);
    if (e.joyMul != null) body = /joyMul: [\d.]+/.test(body) ? body.replace(/joyMul: [\d.]+/, 'joyMul: ' + e.joyMul) : body.replace(/(len: \d+,)/, '$1 joyMul: ' + e.joyMul + ',');
    line = body + tail;
    if (line === orig) throw new Error('no change made for ' + id);
    src = src.replace(orig, () => line);
  });
  fs.writeFileSync(dataPath, src);
  state.runs = (state.runs || 0) + 1;
  state.last = String(snap.generated).slice(0, 10);
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n');

  if (dataPath === DATA) {
    const stamp = new Date().toLocaleString('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).replace(',', ',');
    src = fs.readFileSync(DATA, 'utf8').replace(/PN\.UPDATED = '[^']*'/, "PN.UPDATED = '" + stamp + "'");
    fs.writeFileSync(DATA, src);
    const sw = fs.readFileSync(SW, 'utf8').replace(/pikku-norppa-v(\d+)-[a-z0-9-]+/, (m, v) => 'pikku-norppa-v' + (Number(v) + 1) + '-balance');
    fs.writeFileSync(SW, sw);
    fs.writeFileSync(REPORT, text);
  }
  console.log('Changed ' + n + ' game(s).');
  return { changed: true, count: n };
}

if (require.main === module) {
  const r = main();
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, 'changed=' + (r.changed ? 'true' : 'false') + '\n');
}
module.exports = { AIM, RULE, main };
