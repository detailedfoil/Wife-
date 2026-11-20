/* Pikku Norppa stats: the plain-text report (the same one the stats page copies), shared by the page and the daily snapshot script. */
(function (root) {
  'use strict';
  var NAMES = { ball: 'Nose Ball', shuffle: 'Seal Seat Shuffle', catch: 'Fish Rain', swim: 'Swimmy Seal', stack: 'Ice Cream Stack', puff: 'Puffer Sweeper', toss: 'Snowball Toss', piano: 'Kantele Tiles', coffee: 'Coffee Memory', curl: 'Curling Seal', sled: 'Sled Run', bj: 'Blackjack', sauna: 'Sauna (Löyly)' };
  var name = function (id) { return NAMES[id] || id; };

  var last = null, OPEN = {};                // which game cards are open (kept when the page refreshes)
  var DRAIN = 27 / 60;                      // happiness lost a minute while awake (T.joyAwake in sim.js is 27 an hour)
  /* Minutes of play to go from 0 to 100 happiness at a given rate, and the energy that takes. null minutes = it never gets there. */
  function fillOf(joyPerMin, energyPerMin) {
    if (joyPerMin == null) return null;
    var net = joyPerMin - DRAIN;
    if (net <= 0) return { mins: null, net: net };
    var m = 100 / net;
    return { mins: m, net: net, energy: energyPerMin == null ? null : m * energyPerMin };
  }
  /* The mix: each player's own overall rate (all their games together), averaged across players. */
  function mixRates(d) { return d && d.mix && d.mix.joy_per_min != null ? { joy: d.mix.joy_per_min, energy: d.mix.energy_per_min } : null; }
  var minsText = function (f) { return !f ? '-' : f.mins == null ? 'never' : (f.mins < 10 ? f.mins.toFixed(1) : Math.round(f.mins)) + ' min'; };

  /* One block of text to paste into a chat: the headline numbers, a line per game, and the raw per-game numbers. */
  function summary(d) {
    var v = function (x, suf) { return x == null ? '-' : x + (suf || ''); };
    var sg = function (x) { return x == null ? '-' : (x > 0 ? '+' : '') + x; };
    var L = ['PIKKU NORPPA PLAY STATS (' + d.generated + ')',
      'Players: ' + d.players + ' total, ' + d.players_24h + ' in 24h, ' + d.players_7d + ' in 7 days, ' + d.returning_players + ' came back on another day. Visits: ' + d.sessions + '. Average visit ' + v(d.avg_session_secs, 's') + '. Game time per player ' + v(d.avg_play_secs_per_player, 's') + '.',
      'Coins: ' + v(d.avg_earned_per_player) + ' earned in games per player on average. Purse now: average ' + v(d.coins && d.coins.avg) + ', median ' + v(d.coins && d.coins.median) + ', top ' + v(d.coins && d.coins.max) + '. All games together: ' + v(d.coins_per_min_all) + ' coins a minute.',
      'Design aim: about 16 (beginner) to 37 (expert) coins a minute. Averages count each player once, rates use finished plays only; coins include the happy bonus and muck penalty.',
      '', 'PER GAME (most players first; every player counts once in the averages):'];
    (d.per_game || []).forEach(function (x) {
      L.push('- ' + name(x.game) + ': ' + x.plays + ' plays (' + x.completed + ' finished, ' + v(x.quit_pct, '%') + ' given up with nothing per player), ' + x.players + ' players' + (x.players < 5 ? ' (SMALL SAMPLE)' : '') + ' | length middle player ' + v(x.median_secs, 's') + ' (10-90%: ' + v(x.p10_secs, 's') + ' to ' + v(x.p90_secs, 's') + ', avg ' + v(x.avg_secs, 's') + ') | ' + v(x.coins_per_min) + ' coins/min, ' + v(x.avg_coins) + ' coins/play | happiness ' + sg(x.avg_joy) + '/play (' + sg(x.joy_per_min) + '/min) | energy ' + v(x.avg_energy) + '/play (' + v(x.energy_per_min) + '/min) | score avg ' + v(x.avg_score) + ', best ' + v(x.best_score) + ' | taste avg ' + sg(x.avg_taste) + ' | happy bonus ' + v(x.avg_bonus, '%') + ', muck ' + v(x.avg_muck, '%'));
    });
    var mx = mixRates(d), mfl = mx ? fillOf(mx.joy, mx.energy) : null;
    L.splice(4, 0, 'Minutes of play from empty to full happiness (games only, minus 27/hour awake drain): players\' actual mix ' + (mfl ? minsText(mfl) + (mfl.energy ? ' (about ' + Math.round(mfl.energy) + ' energy)' : '') : '-') + '. Per game: ' + (d.per_game || []).filter(function (x) { return x.game !== 'sauna' && x.joy_per_min != null; }).map(function (x) { var f = fillOf(x.joy_per_min, x.energy_per_min); return name(x.game) + ' ' + minsText(f) + (f && f.energy ? ' (' + Math.round(f.energy) + ' energy)' : ''); }).join(', ') + '.');
    var R = d.retention || {}, N = d.needs || {}, D = d.devices || {}, E = d.errors || {};
    L.push('', 'PROGRESS: back next day ' + v(R.d1) + '/' + v(R.d1_eligible) + ', within a week ' + v(R.d7) + '/' + v(R.d7_eligible) + ' (new players). Visits per active day ' + v(d.visits_per_active_day) + ' (aim 5-6). Levels reached (players, median seal-age in days for new players): ' + (d.levels || []).map(function (x) { return 'L' + x.level + ' ' + x.reached + ' (day ' + v(x.median_age_days) + ')'; }).join(', ') + '. Highest level per player: ' + (d.levels_now || []).map(function (x) { return 'L' + x.level + 'x' + x.players; }).join(', ') + '.');
    L.push('MONEY: games paid out ' + v(d.coins_earned_games) + ' coins in total, ' + v(d.coins_spent) + ' spent. Unlocks: ' + ((d.unlocks || []).map(function (x) { return name(x.game) + ' (' + x.price + ') ' + x.players + ' players, median day ' + v(x.median_age_days); }).join('; ') || 'none') + '. Top shop buys (item, kind, count, coins): ' + ((d.purchases || []).slice(0, 8).map(function (x) { return x.item + '/' + x.kind + ' x' + x.n + ' (' + x.total + ')'; }).join(', ') || 'none') + '.');
    L.push('OPENING THE GAME (' + v(N.visits) + ' visits): average tummy ' + v(N.avg_food, '%') + ', happiness ' + v(N.avg_joy, '%') + ', energy ' + v(N.avg_energy, '%') + ', clean ' + v(N.avg_clean, '%') + '. Started hungry ' + v(N.pct_hungry, '%') + ', glum ' + v(N.pct_sad, '%') + ', mucky ' + v(N.pct_dirty, '%') + ', low energy ' + v(N.pct_low_energy, '%') + ', full happiness ' + v(N.pct_full_joy, '%') + '. Plays blocked: ' + v(d.blocked_total) + ' (' + ((d.blocked || []).map(function (x) { return x.why + ' ' + x.n; }).join(', ') || 'none') + ').');
    L.push('COFFEE MEMORY failures by step (share of each player\'s failures, averaged): ' + ((d.coffee_fails || []).map(function (x) { return x.step + ' ' + x.share + '% (~' + v(x.avg_served) + ' drinks served)'; }).join(', ') || 'none') + '.');
    L.push('DEVICES: installed as app ' + v(D.installed_pct, '%') + ', fps average ' + v(D.fps_avg) + ' (slowest 10% ' + v(D.fps_p10) + '). Screen widths (<360,360-399,400-479,480-767,768+): ' + [1, 2, 3, 4, 5].map(function (b) { var f = (D.screens || []).filter(function (x) { return x.bucket === b; })[0]; return f ? f.players : 0; }).join('/') + '. Errors: ' + v(E.total) + ' (' + v(E.per_100_visits) + ' per 100 visits)' + ((E.top || []).length ? ', top: ' + E.top.slice(0, 3).map(function (x) { return x.msg + ' x' + x.n; }).join(' | ') : '') + '.');
    L.push('', 'RAW per_game JSON:', JSON.stringify(d.per_game || []));
    return L.join('\n');
  }
  var api = { NAMES: NAMES, name: name, DRAIN: DRAIN, fillOf: fillOf, mixRates: mixRates, minsText: minsText, summary: summary };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.NorppaReport = api;
})(typeof window !== 'undefined' ? window : globalThis);
