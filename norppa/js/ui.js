/* Pikku Norppa: everything on screen that is not the 3D scene.
   The bars, the dock, slide-up sheets (food, play, shop, album, settings), messages and toasts. */
(function (PN) {
  'use strict';
  const S = PN.Sim, D = PN.DATA, tr = PN.L;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const UI = PN.UI = {};
  const G = () => PN.Game;

  /* ---------- icons ---------- */
  const I = {
    fish: '<path d="M3 12c3-5 9-6.5 13-3l4.5-3v12L16 15c-4 3.5-10 2-13-3z"/><circle class="f" cx="8" cy="11" r="1.2"/>',
    ball: '<circle cx="12" cy="12" r="9"/><path d="M12 3c3.5 3.5 3.5 14.5 0 18M12 3c-3.5 3.5-3.5 14.5 0 18"/>',
    bubbles: '<circle cx="9" cy="14" r="5.5"/><circle cx="17.5" cy="7" r="3"/><circle cx="18" cy="17.5" r="1.8"/>',
    moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4 6.6 6.6 0 0 0 20 14.5z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5V5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>',
    bag: '<path d="M5 9h14l-1.2 10.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 9z"/><path d="M9 9V7a3 3 0 0 1 6 0v2"/>',
    book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5v-15z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 21H19M8.5 7.5h6"/>',
    sliders: '<path d="M4 7h9M18 7h2M4 17h2M11 17h9"/><circle cx="15.5" cy="7" r="2.3"/><circle cx="8.5" cy="17" r="2.3"/>',
    coin: '<circle cx="12" cy="12" r="9.5" fill="#f2a71b" stroke="none"/><circle cx="12" cy="12" r="6.6" fill="#ffd45c" stroke="none"/><path d="M12 8l1.2 2.8L16 12l-2.8 1.2L12 16l-1.2-2.8L8 12l2.8-1.2z" fill="#f2a71b" stroke="none"/>',
    heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.3a4.2 4.2 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z"/>',
    bolt: '<path d="M13 2.5L5 14h6l-1 7.5L18 10h-6l1-7.5z"/>',
    drop: '<path d="M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 16.9 6.6 19.8l1.1-6.1L3.2 9.4l6.1-.8z"/>',
    zzz: '<path d="M5 6h7l-7 8h7M14 12h5l-5 6h5"/>',
    cloud: '<path d="M7 18a4 4 0 0 1-.6-8 5.5 5.5 0 0 1 10.7-1.2A4.6 4.6 0 0 1 17.4 18H7z"/>',
    snow: '<path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9"/><path d="M9.5 4.5L12 6.5l2.5-2M9.5 19.5l2.5-2 2.5 2"/>',
    aurora: '<path d="M3 9c3-4 6 4 9 0s6 4 9 0M3 14c3-4 6 4 9 0s6 4 9 0M5 19c2.5-3 4.5 3 7 0s4.5 3 7 0"/>',
    med: '<rect x="4" y="4" width="16" height="16" rx="5"/><path d="M12 8v8M8 12h8"/>',
    grump: '<path d="M4.5 8.5l5 2M19.5 8.5l-5 2M8 17.5c2.5-2.5 5.5-2.5 8 0"/>',
    dive: '<path d="M12 3v10M8 9.5l4 4 4-4M3 18c2-2 4 2 6 0s4 2 6 0 4 2 6 0"/>',
    steam: '<path d="M6 20h12M8 15.5c-2-3 2-4 0-7.5M12 15.5c-2-3 2-4 0-7.5M16 15.5c-2-3 2-4 0-7.5"/>',
    dice: '<rect x="4" y="4" width="16" height="16" rx="4"/><circle class="f" cx="9" cy="9" r="1.3"/><circle class="f" cx="15" cy="15" r="1.3"/><circle class="f" cx="15" cy="9" r="1.3"/><circle class="f" cx="9" cy="15" r="1.3"/>',
    cards: '<rect x="3" y="7" width="10" height="13" rx="2.5"/><path d="M9.5 7V5.6a2 2 0 0 1 2.3-2l6.6 1.2A2 2 0 0 1 20 7.1l-1.5 8.6a2 2 0 0 1-2.3 1.6L13 16.8"/>',
    gift: '<rect x="4" y="10" width="16" height="10" rx="2"/><path d="M3 7h18v3H3zM12 7v13M12 7c-1.5-4-6-3-4 0M12 7c1.5-4 6-3 4 0"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
    poo: '<path d="M8 19.5c-3.2 0-4-3.2-2-5-1-2 .2-4 3-4-.4-2 1.2-3.8 3.6-4-.4 2 2 2.2 2 4 2.6 0 4 2 3 4 2 1.8 1.2 5-2 5H8z"/>',
    up: '<path d="M12 19V6M6 11l6-6 6 6"/>',
    seal: '<path d="M2.5 17c.5-5.5 4.5-9.5 9.5-9.5 4 0 7.2 2.6 8 6.2.4 1.8-.8 3.3-2.6 3.3H2.5z"/><circle class="f" cx="15.5" cy="12" r="1.1"/>',
    thermo: '<path d="M10 13.5V5a2 2 0 0 1 4 0v8.5a4 4 0 1 1-4 0z"/>',
    hat: '<path d="M5 17c0-5 3-9 7-9s7 4 7 9"/><rect x="4" y="16.5" width="16" height="3.5" rx="1.7"/><circle cx="12" cy="5.8" r="2"/>',
    home: '<path d="M4 11.5L12 4l8 7.5V20H4v-8.5z"/><path d="M10 20v-5h4v5"/>',
    sound: '<path d="M4 10v4h3l5 4V6L7 10H4z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/>',
    music: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
    lamp: '<path d="M9 21h6M8 6h8l1.5 9h-11L8 6zM10 6V4h4v2M12 15v3"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18"/>',
  };
  const ic = UI.ic = (n) => '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">' + (I[n] || I.star) + '</svg>';
  const thumb = (id) => '<img src="' + PN.Thumbs.get(id) + '" alt="">';
  const coinTag = (n, cls) => '<span class="tag ' + cls + '">' + ic('coin') + n + '</span>';

  /* ---------- start ---------- */
  UI.init = function () {
    document.querySelectorAll('.ic-slot').forEach((el) => { el.outerHTML = ic(el.dataset.ic); });
    $('dock').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      PN.Audio.play('tap');
      const act = b.dataset.act;
      if (act === 'feed') UI.openSheet('feed');
      else if (act === 'play') UI.openSheet('play');
      else if (act === 'shop') UI.openSheet('shop');
      else if (act === 'wash') G().startWash();
      else if (act === 'sleep') G().sleepToggle();
    });
    $('meters').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      const st = G().state, k = b.dataset.stat, v = Math.round(st.stats[k]);
      const words = { food: ['Tummy', 'fish'], joy: ['Happiness', 'heart'], energy: ['Energy', 'bolt'], clean: ['Cleanliness', 'drop'] }[k];
      const tip = { food: 'Feed to fill it.', joy: 'Stroke, play and treats lift it.', energy: 'Sleep brings it back.', clean: 'A wash or a dive sorts it.' }[k];
      UI.toast('<b>' + tr(words[0]) + ' ' + v + pc() + '</b> ' + tr(v < 60 ? tip : 'Doing fine.'), words[1]);
    });
    $('plate').addEventListener('click', () => { PN.Audio.play('tap'); UI.openSheet('profile'); });
    $('bAlbum').addEventListener('click', () => { PN.Audio.play('tap'); UI.openSheet('album'); });
    $('bSettings').addEventListener('click', () => { PN.Audio.play('tap'); UI.openSheet('settings'); });
    $('skyChip').addEventListener('click', () => UI.skyInfo());
    $('sheetClose').addEventListener('click', () => UI.closeSheet());
    $('scrubDone').addEventListener('click', () => G().endWash(false));
    $('sheetTabs').addEventListener('click', (e) => { const b = e.target.closest('.tab'); if (b) { PN.Audio.play('tap'); UI.tab = b.dataset.tab; UI.renderSheet(); } });
    $('sheetBody').addEventListener('click', onSheetClick);
    $('family').addEventListener('click', (e) => { const c = e.target.closest('.pup-chip'); if (c) G().pupInfo(+c.dataset.i); });
  };

  /* ---------- the bars and badges ---------- */
  let famKey = '', skyKey = '';
  UI.refresh = function () {
    const st = G().state; if (!st) return;
    const L = S.level(st);
    $('pName').textContent = st.name || tr('Little one');
    $('pSub').textContent = tr('Level {0} {1}', L.level, D.STAGES[st.stage].fi);
    $('pXp').style.width = Math.round(L.frac * 100) + '%';
    $('coinN').textContent = st.coins;
    document.querySelectorAll('#meters .meter').forEach((m) => {
      const v = st.stats[m.dataset.stat];
      m.querySelector('i').style.width = Math.max(3, v) + '%';
      m.classList.toggle('low', v < 25);
    });
    $('sleepLabel').textContent = tr(st.asleep ? 'Wake' : 'Sleep');
    const need = { feed: st.stats.food < 25 || st.sick || st.pups.some((p) => p.sick), play: st.stats.joy < 30 && !st.asleep, wash: st.stats.clean < 25, sleep: st.stats.energy < 20 && !st.asleep };
    document.querySelectorAll('#dock button').forEach((b) => {
      b.classList.toggle('need', !!need[b.dataset.act]);
      if (b.dataset.act === 'sleep') b.classList.toggle('on', st.asleep);
    });
    const key = st.pups.map((p) => p.name + Math.round(p.food / 4) + (p.sick ? 's' : '') + (p.ready ? 'r' : '')).join('|');
    if (key !== famKey) {
      famKey = key;
      $('family').innerHTML = st.pups.map((p, i) => '<button class="pup-chip pebble' + (p.sick || p.food < 12 ? ' bad' : '') + '" data-i="' + i + '"><span class="face"></span>' + esc(p.name)
        + '<span class="bar"><i style="width:' + Math.max(4, p.food) + '%"></i></span></button>').join('');
    }
    const env = PN.World.env, cond = skyWord(env);
    const sk = cond.icon + env.temp;
    if (sk !== skyKey) { skyKey = sk; $('skyChip').innerHTML = ic(cond.icon) + temp(env.temp); }
    if (UI.sheetName === 'play') UI.renderSheet(true);
  };
  const temp = (t) => (t < 0 ? '−' + Math.abs(t) : t) + '°';
  const pc = () => (PN.isFi() ? ' %' : '%');
  function skyWord(env) {
    if (env.aurora > 0.3) return { icon: 'aurora', text: 'northern lights' };
    if (env.snowing) return { icon: 'snow', text: env.precip > 0.55 ? 'heavy snow' : 'snow' };
    if (env.precip > 0.04) return { icon: 'drop', text: 'rain' };
    if (env.cloud > 0.62) return { icon: 'cloud', text: 'cloudy' };
    if (env.night > 0.5) return { icon: 'moon', text: env.moonUp ? 'moonlit' : 'clear and dark' };
    return { icon: 'sun', text: env.sunEl < 0 ? 'twilight' : env.cloud > 0.25 ? 'some cloud' : 'clear' };
  }
  UI.skyInfo = function () {
    const env = PN.World.env, c = skyWord(env);
    let extra = '';
    if (env.polarNight) extra = ' It is <em>kaamos</em>, the polar night: the sun stays below the horizon.';
    else if (env.midnightSun) extra = ' It is the time of <em>yötön yö</em>, when the sun does not set.';
    else if (env.blue) extra = ' This is <em>sininen hetki</em>, the blue moment.';
    UI.toast(tr('<b>{0}C</b> and {1} at the lake.', temp(env.temp), tr(c.text)) + (extra ? tr(extra) : ''), c.icon, '', 4200);
  };

  /* ---------- toasts and floating numbers ---------- */
  const queue = [];
  let showing = 0;
  let lastToast = '', lastToastAt = 0;
  UI.toast = function (html, icon, cls, ms) {
    const now = Date.now();
    if (html === lastToast && now - lastToastAt < 2500) return;      // no need to say the same thing twice
    lastToast = html; lastToastAt = now;
    queue.push({ html, icon: icon || 'star', cls: cls || '', ms: ms || 2900 });
    pump();
  };
  function pump() {
    while (showing < 3 && queue.length) {
      const t = queue.shift(), el = document.createElement('div');
      el.className = 'toast ' + t.cls;
      el.innerHTML = ic(t.icon) + '<span>' + t.html + '</span>';
      $('toasts').appendChild(el);
      showing++;
      setTimeout(() => { el.classList.add('out'); setTimeout(() => { el.remove(); showing--; pump(); }, 320); }, t.ms);
    }
  }
  UI.float = function (text, x, y, color) {
    const el = document.createElement('div');
    el.className = 'float'; el.textContent = text;
    el.style.left = x + 'px'; el.style.top = y + 'px';
    if (color) el.style.color = color;
    $('floats').appendChild(el);
    setTimeout(() => el.remove(), 1150);
  };

  /* ---------- the thought bubble over the seal ---------- */
  let bubbleIcon = null;
  UI.setBubble = function (name) {
    if (name === bubbleIcon) return;
    bubbleIcon = name;
    const b = $('bubble');
    if (!name) { b.hidden = true; return; }
    b.innerHTML = ic(name); b.hidden = false;
  };
  UI.moveBubble = function (x, y) { $('bubble').style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)'; };

  /* ---------- wash bar ---------- */
  UI.scrub = function (on, k) {
    $('scrub').hidden = !on;
    $('hud').classList.toggle('scrubbing', !!on);
    if (on) $('scrubBar').style.width = Math.round((k || 0) * 100) + '%';
    document.querySelector('#dock [data-act="wash"]').classList.toggle('on', !!on);
  };
  UI.setBusy = (b) => $('hud').classList.toggle('busy', !!b);
  UI.showHud = (on) => { $('hud').hidden = !on; };

  /* ---------- sheets ---------- */
  UI.sheetName = null; UI.tab = null;
  UI.openSheet = function (name, tab) {
    const sh = $('sheet');
    UI.sheetName = name;
    UI.tab = tab || { shop: 'food', album: 'fish' }[name] || null;
    sh.hidden = false;
    UI.renderSheet();
    $('sheetBody').scrollTop = 0;
    requestAnimationFrame(() => requestAnimationFrame(() => sh.classList.add('open')));
    PN.Audio.play('open');
  };
  UI.closeSheet = function () {
    if (!UI.sheetName) return;
    UI.sheetName = null;
    const sh = $('sheet');
    sh.classList.remove('open');
    setTimeout(() => { if (!UI.sheetName) sh.hidden = true; }, 300);
    PN.Audio.play('close');
  };
  const TITLES = { play: 'sheet|Play', shop: 'Shop', album: 'Album', settings: 'Settings' };
  const TABS = { shop: [['food', 'Food'], ['wear', 'tab|Wear'], ['home', 'For the shore']], album: [['fish', 'tab|Fish'], ['finds', 'Finds'], ['words', 'Words'], ['awards', 'Awards'], ['family', 'Family']] };
  UI.renderSheet = function (soft) {
    const name = UI.sheetName, st = G().state;
    if (!name) return;
    const body = $('sheetBody'), keep = body.scrollTop;
    $('sheetTitle').textContent = name === 'feed' ? tr('Feed {0}', st.name) : name === 'profile' ? st.name : tr(TITLES[name]);
    const tabs = TABS[name];
    $('sheetTabs').hidden = !tabs;
    if (tabs) $('sheetTabs').innerHTML = tabs.map((t) => '<button class="tab' + (t[0] === UI.tab ? ' on' : '') + '" data-tab="' + t[0] + '">' + tr(t[1]) + '</button>').join('');
    const html = VIEWS[name](st);
    if (soft && html === body._last) return;
    body._last = html; body.innerHTML = html;
    body.scrollTop = keep;
  };

  const cell = (id, inner, cls, act) => '<button class="cell ' + (cls || '') + '" data-do="' + act + '" data-id="' + id + '">' + inner + '</button>';
  const names = (it) => '<b>' + esc(it.fi) + '</b>' + (PN.isFi() ? '' : '<small>' + esc(it.en) + '</small>');
  const row = (o) => '<' + (o.act ? 'button' : 'div') + ' class="row ' + (o.cls || '') + '"' + (o.act ? ' data-do="' + o.act + '" data-id="' + (o.id || '') + '"' : '') + '><span class="ic-wrap ' + (o.tint || '') + '">' + ic(o.icon) + '</span><span class="txt"><b>'
    + o.title + '</b><span class="d">' + o.text + '</span></span>' + (o.side ? '<span class="side">' + o.side + '</span>' : '') + '</' + (o.act ? 'button' : 'div') + '>';
  const mins = (ms) => { const m = Math.ceil(ms / 60000); return m >= 60 ? Math.floor(m / 60) + ' h ' + (m % 60) + ' min' : m + ' min'; };
  const WHY = { asleep: 'asleep', sick: 'poorly', sulk: 'sulking', tired: 'too tired', wait: 'resting' };

  const VIEWS = {
    feed(st) {
      const ids = Object.keys(st.pantry).filter((id) => st.pantry[id] > 0 && PN.items[id]);
      const order = { fish: 0, food: 1, med: 2 };
      ids.sort((a, b) => order[PN.items[a].kind] - order[PN.items[b].kind] || (PN.items[a].food || 0) - (PN.items[b].food || 0));
      const fav = st.favKnown ? tr('Favourite: <b>{0}</b>.', PN.items[st.fav].fi.toLowerCase()) : tr('There is one fish {0} loves best. Try them all to find it.', esc(st.name));
      if (!ids.length) {
        const spare = S.canBorrow(st, Date.now());
        return '<p class="lead">' + tr('The larder is empty. Catch fish in Fish Rain, send {0} diving, or buy some.', esc(st.name))
          + (spare ? tr(' With no coins either, the neighbours will spare a few fish.') : '') + '</p><div class="btn-row">'
          + (spare ? '<button class="btn small" data-do="borrow">' + tr('Ask the neighbours') + '</button>' : '<button class="btn small" data-do="goto" data-id="play">' + tr('Play') + '</button>')
          + '<button class="btn small ghost" data-do="goto" data-id="shop">' + tr('Shop') + '</button></div>';
      }
      return '<p class="lead">' + tr('Tummy {0}%. ', Math.round(st.stats.food)) + fav + '</p><div class="grid">' + ids.map((id) => {
        const it = PN.items[id];
        return cell(id, thumb(id) + names(it) + '<span class="count">' + st.pantry[id] + '</span>' + (it.kind === 'med' ? '<span class="tag">' + tr('medicine') + '</span>' : ''), st.favKnown && id === st.fav ? 'fav' : '', 'feed');
      }).join('') + '</div>';
    },
    play(st) {
      const now = Date.now(), can = S.canPlay(st), dive = S.canDive(st, now);
      const off = (c) => (c.ok ? '' : ' off');
      const why = (c) => tr(WHY[c.why]);
      let h = '<div class="rows">';
      h += row({ icon: 'ball', tint: 'rose', title: tr('Ball'), text: tr('A quick bounce on the nose, right here.'), act: 'ball', cls: st.asleep ? 'off' : '', side: st.asleep ? tr('asleep') : '' });
      h += row({ icon: 'fish', tint: 'sea', title: tr('Fish Rain'), text: tr('Slide left and right to catch the fish. Now and then you get to keep one.'), act: 'game', id: 'catch', cls: off(can), side: can.ok ? (st.counters.bestCatch ? tr('best {0}', st.counters.bestCatch) : '') : why(can) });
      h += row({ icon: 'up', tint: 'warm', title: tr('Nose Ball'), text: tr('Keep the ball in the air for as long as you can.'), act: 'game', id: 'ball', cls: off(can), side: can.ok ? (st.counters.bestBall ? tr('best {0}', st.counters.bestBall) : '') : why(can) });
      h += row({ icon: 'cards', tint: 'leaf', title: tr('Fish Pairs'), text: tr('Match every fish within 20 turns and pick up their Finnish names.'), act: 'game', id: 'pairs', cls: off(can), side: can.ok ? (st.counters.bestPairs ? tr('best {0} turns', st.counters.bestPairs) : '') : why(can) });
      h += row({ icon: 'dive', tint: 'sea', title: tr('Dive'), text: tr('Send {0} down the ice hole and see what comes back up.', esc(st.name)), act: 'dive', cls: off(dive), side: dive.ok ? tr('ready') : dive.why === 'wait' ? mins(st.dive.readyAt - now) : why(dive) });
      if (st.owned.sauna) {
        const wait = now < st.saunaAt;
        h += row({ icon: 'steam', tint: 'warm', title: tr('Sauna'), text: tr('Steam away the dirt and the grumps.'), act: 'sauna', cls: wait || st.asleep ? 'off' : '', side: st.asleep ? tr('asleep') : wait ? mins(st.saunaAt - now) : tr('ready') });
      }
      return h + '</div>';
    },
    shop(st) {
      let h = '';
      const price = (it) => coinTag(it.price, st.coins >= it.price ? 'buy' : 'cant');
      if (UI.tab === 'food') {
        const list = D.FISH.filter((f) => f.price).concat(D.FOODS);
        h = '<p class="lead">' + tr('Fresh from the village. Tap to buy one.') + '</p><div class="grid">' + list.map((it) => cell(it.id, thumb(it.id) + names(it) + price(it) + (st.pantry[it.id] ? '<span class="count">' + st.pantry[it.id] + '</span>' : ''), '', 'buy')).join('') + '</div>';
      } else if (UI.tab === 'wear') {
        h = '<p class="lead">' + tr('Tap something you own to put it on or take it off.') + '</p><div class="grid">' + D.WEAR.map((it) => {
          const own = st.owned[it.id], on = st.wearing[it.slot] === it.id;
          return cell(it.id, thumb(it.id) + names(it) + (own ? '<span class="tag' + (on ? ' on' : '') + '">' + tr(on ? 'Wearing' : 'tag|Wear') + '</span>' : price(it)), '', own ? 'wear' : 'buy');
        }).join('') + '</div>';
      } else {
        h = '<p class="lead">' + tr('Things for the shore. Tap one you own to put it out or tidy it away.') + '</p><div class="grid">' + D.DECOR.map((it) => {
          const own = st.owned[it.id], on = st.placed[it.id];
          return cell(it.id, thumb(it.id) + names(it) + (own ? '<span class="tag' + (on ? ' on' : '') + '">' + tr(on ? 'Out' : 'Put out') + '</span>' : price(it)), '', own ? 'place' : 'buy');
        }).join('') + '</div>';
      }
      return h;
    },
    album(st) {
      const t = UI.tab;
      if (t === 'fish' || t === 'finds') {
        const list = t === 'fish' ? D.FISH : D.TRINKETS, have = t === 'fish' ? st.fish : st.trinkets;
        const n = list.filter((x) => have[x.id]).length;
        return '<p class="lead">' + tr(t === 'fish' ? '{0} of {1} fish discovered. Fish Rain, dives and gifts bring new ones.' : '{0} of {1} treasures found. They turn up on dives.', n, list.length) + '</p><div class="grid">'
          + list.map((it) => (have[it.id] ? cell(it.id, thumb(it.id) + names(it) + (t === 'fish' ? '' : have[it.id] > 1 ? '<span class="count">' + have[it.id] + '</span>' : ''), '', 'info')
            : cell(it.id, thumb(it.id) + '<b>?</b><small>' + tr('not found yet') + '</small>', 'locked', 'none'))).join('') + '</div>';
      }
      if (t === 'words') {
        const got = D.WORDS.filter((w) => st.words[w.id]);
        return '<p class="lead">' + tr('{0} of {1} Finnish words learned.', got.length, D.WORDS.length) + '</p><div class="rows">'
          + got.map((w) => { const note = PN.wordNote(w); return '<div class="row"><span class="txt"><span class="word-fi">' + esc(w.fi) + '</span><span class="d"><b style="display:inline;font:inherit;font-weight:800;color:var(--ink)">' + esc(w.en) + '</b>' + (note ? '. ' + esc(note) : '') + '</span></span></div>'; }).join('')
          + (got.length < D.WORDS.length ? '<div class="row locked"><span class="txt"><b>' + tr('{0} more to find', D.WORDS.length - got.length) + '</b><span class="d">' + tr('New words turn up as you play, and as the sky and seasons change.') + '</span></span></div>' : '') + '</div>';
      }
      if (t === 'awards') {
        const n = D.AWARDS.filter((a) => st.awards[a.id]).length;
        return '<p class="lead">' + tr('{0} of {1} awards.', n, D.AWARDS.length) + '</p><div class="rows">' + D.AWARDS.map((a) => row({ icon: 'star', cls: st.awards[a.id] ? 'done' : 'locked',
          title: esc(PN.awardTitle(a)), text: esc(PN.awardText(a)), side: st.awards[a.id] ? tr('done') : '+' + a.c })).join('') + '</div>';
      }
      // family
      const day = (ms) => new Date(ms).toLocaleDateString(PN.isFi() ? 'fi-FI' : undefined, { day: 'numeric', month: 'short' });
      let h = '';
      if (!st.pups.length && !st.family.length) {
        return '<p class="lead">' + tr('No pups yet.') + '</p><div class="rows">' + row({ icon: 'seal', title: tr('One day, perhaps'), text: tr('A grown seal who is happy, well fed and at friendship level {0} may have a pup of her own.', S.T.pupLevel) }) + '</div>';
      }
      h += '<div class="rows">';
      st.pups.forEach((p) => {
        const left = Math.max(0, S.T.pupGrow - p.grownMs);
        h += row({ icon: 'seal', tint: p.sick ? 'rose' : 'leaf', title: esc(p.name), text: p.sick ? tr('Poorly. Feed {0} so she can nurse, and give cloudberry juice.', esc(st.name)) : p.ready ? tr('Ready to set off into the lake.')
          : p.food < 20 ? tr('Hungry. Pups feed from their mother, so keep {0} well fed.', esc(st.name)) : tr('Growing well. About {0} of good care to go.', mins(left).replace(/ \d+ min$/, '')),
          side: tr('born {0}', day(p.bornAt)) });
      });
      st.family.slice().reverse().forEach((f) => {
        h += row({ icon: f.fate === 'grown' ? 'star' : 'heart', cls: f.fate === 'grown' ? 'done' : '', title: esc(f.name), text: tr(f.fate === 'grown' ? 'Grew up and swims the lake.' : 'Did not make it. Remembered always.'), side: tr('{0} to {1}', day(f.bornAt), day(f.endAt)) });
      });
      return h + '</div><p class="note">' + tr('Pups feed from their mother whenever her tummy is above a third. If she goes hungry for long, so do they.') + '</p>';
    },
    profile(st) {
      const lv = S.level(st), days = Math.floor((Date.now() - st.createdAt) / S.DAY), fi = PN.isFi();
      const moods = { sleep: 'fast asleep', sick: 'mood|poorly', sulk: 'mood|sulking', hungry: 'hungry', tired: 'sleepy', dirty: 'in need of a wash', sad: 'a bit glum', happy: 'very happy', ok: 'content' };
      const line = (a, b) => '<div class="statline"><span>' + tr(a) + '</span><b>' + b + '</b></div>';
      const stage = D.STAGES[st.stage], favIt = PN.items[st.fav];
      let next;
      if (st.stage < 2) {
        const nx = D.STAGES[st.stage + 1];
        next = tr('Becomes a {0} at friendship level {1}, given enough days of good care. Time spent hungry, dirty or unhappy does not count.', fi ? nx.fi : nx.en, S.T.stageLevel[st.stage]);
      } else next = tr('Fully grown. With friendship level {0} and a happy, well-fed life, a pup may arrive.', S.T.pupLevel);
      return line('Kind', stage.fi + (fi ? '' : ' (' + stage.en + ')')) + line('Age', days < 1 ? tr('less than a day') : tr(days === 1 ? '{0} day' : '{0} days', days))
        + line('Friendship', tr('level {0} ({1} of {2})', lv.level, Math.floor(lv.into), lv.need)) + line('Mood', tr(moods[S.mood(st)]))
        + line('Favourite food', st.favKnown ? favIt.fi + (fi ? '' : ' (' + favIt.en.toLowerCase() + ')') : tr('not found yet'))
        + line('Strokes', st.counters.pets) + line('Meals', st.counters.feeds) + line('Dives', st.counters.dives) + line('Games played', st.counters.games)
        + (st.counters.pupsGrown + st.counters.pupsLost ? line('Pups raised', st.counters.pupsGrown) + line('Pups lost', st.counters.pupsLost) : '')
        + '<p class="note">' + next + '</p><div class="btn-row"><button class="btn small ghost" data-do="rename">' + tr('Change name') + '</button></div>';
    },
    settings(st) {
      const tog = (k, label, icon, text) => '<button class="row" data-do="toggle" data-id="' + k + '"><span class="ic-wrap">' + ic(icon) + '</span><span class="txt"><b>' + tr(label) + '</b><span class="d">' + tr(text) + '</span></span><span class="toggle' + (st.settings[k] ? ' on' : '') + '"></span></button>';
      const seg = ['live', 'day', 'night'].map((m) => '<button class="' + (st.settings.sky === m ? 'on' : '') + '" data-do="sky" data-id="' + m + '">' + tr({ live: 'Real time', day: 'Day', night: 'Night' }[m]) + '</button>').join('');
      const lang = ['en', 'fi'].map((m) => '<button class="' + (PN.lang === m ? 'on' : '') + '" data-do="lang" data-id="' + m + '">' + { en: 'English', fi: 'Suomi' }[m] + '</button>').join('');
      return '<div class="rows">' + tog('sound', 'Sound', 'sound', 'Squeaks, splashes and chimes.') + tog('music', 'Music', 'music', 'A kantele, the Finnish lap harp, plays now and then.')
        + (navigator.vibrate ? tog('haptics', 'Buzz', 'bolt', 'A little buzz under your finger when you stroke and tap.') : '')
        + '<div class="row"><span class="ic-wrap">' + ic('globe') + '</span><span class="txt"><b>' + tr('Language') + '</b><span class="d">' + tr('Play in English or in Finnish.') + '</span><span class="seg" style="margin-top:8px;display:inline-flex">' + lang + '</span></span></div>'
        + '<div class="row"><span class="ic-wrap">' + ic('sun') + '</span><span class="txt"><b>' + tr('Sky') + '</b><span class="d">' + tr('Real time follows your clock and the calendar, the way it is in Lapland.') + '</span><span class="seg" style="margin-top:8px;display:inline-flex">' + seg + '</span></span></div>'
        + '<div class="row"><span class="ic-wrap">' + ic('book') + '</span><span class="txt"><b>' + tr('Move to another device') + '</b><span class="d">' + tr('Your seal is saved on this device only. A save code lets you carry it to another one.') + '</span><span class="btn-row"><button class="btn small ghost" data-do="export">' + tr('Get save code') + '</button><button class="btn small ghost" data-do="import">' + tr('Use a save code') + '</button></span></span></div>'
        + '<div class="row"><span class="ic-wrap rose">' + ic('close') + '</span><span class="txt"><b>' + tr('Start over') + '</b><span class="d">' + tr('Say goodbye to {0} and begin again with a new pup.', esc(st.name)) + '</span><span class="btn-row"><button class="btn small ghost" data-do="reset">' + tr('Start over') + '</button></span></span></div>'
        + '</div><p class="note">' + tr('Pikku Norppa, version 1. Drawn with three.js. Lettering: DynaPuff and Nunito.') + '</p>';
    },
  };

  function onSheetClick(e) {
    const b = e.target.closest('[data-do]'); if (!b) return;
    const act = b.dataset.do, id = b.dataset.id, game = G();
    if (act === 'feed') game.feed(id);
    else if (act === 'buy') game.buy(id);
    else if (act === 'wear') game.wear(id);
    else if (act === 'place') game.place(id);
    else if (act === 'info') UI.itemInfo(id);
    else if (act === 'goto') UI.openSheet(id);
    else if (act === 'borrow') game.borrow();
    else if (act === 'ball') { UI.closeSheet(); game.playBall(); }
    else if (act === 'game') game.startGame(id);
    else if (act === 'dive') game.dive();
    else if (act === 'sauna') game.sauna();
    else if (act === 'toggle') game.setSetting(id, !game.state.settings[id]);
    else if (act === 'sky') game.setSetting('sky', id);
    else if (act === 'lang') game.setSetting('lang', id);
    else if (act === 'rename') game.rename();
    else if (act === 'export') game.exportSave();
    else if (act === 'import') game.importSave();
    else if (act === 'reset') game.resetGame();
    else if (act === 'none') PN.Audio.play('nope');
  }

  const RARE = ['', 'Common', 'Uncommon', 'Rare', 'Very rare', 'Legendary'];
  UI.itemInfo = function (id) {
    const it = PN.items[id];
    const line = PN.isFi() ? (it.rarity ? tr(RARE[it.rarity]) + '.' : '') : '<b>' + esc(it.en) + '</b>' + (it.rarity ? ', ' + RARE[it.rarity].toLowerCase() : '');
    return UI.modal({ art: PN.Thumbs.get(id), title: esc(it.fi), html: (line ? '<p>' + line + '</p>' : '') + '<p>' + esc(PN.itemNote(it)) + '</p>', actions: [{ label: tr('Lovely'), value: 1 }] });
  };

  /* ---------- messages ---------- */
  /* o: { title, html, art, actions: [{label, value, cls}] }. Resolves with the chosen value. */
  let modalBusy = Promise.resolve();
  UI.modalOpen = false;
  UI.modal = function (o) {
    const run = () => new Promise((resolve) => {
      const m = $('modal'), card = $('modalCard');
      card.innerHTML = (o.art ? '<img class="art" src="' + o.art + '" alt="">' : '') + '<h3>' + o.title + '</h3>' + (o.html || '')
        + '<div class="actions">' + (o.actions || [{ label: 'OK', value: 1 }]).map((a, i) => '<button class="btn ' + (a.cls || (i ? 'ghost' : '')) + '" data-i="' + i + '">' + a.label + '</button>').join('') + '</div>';
      m.hidden = false; UI.modalOpen = true;
      requestAnimationFrame(() => requestAnimationFrame(() => m.classList.add('open')));
      if (o.onOpen) o.onOpen(card);
      const done = (v) => {
        card.removeEventListener('click', onClick);
        m.classList.remove('open');
        setTimeout(() => { m.hidden = true; UI.modalOpen = false; resolve(v); }, 220);
      };
      function onClick(e) {
        const b = e.target.closest('.actions .btn'); if (!b) return;
        PN.Audio.play('tap');
        const a = (o.actions || [{ value: 1 }])[+b.dataset.i];
        done(o.result ? o.result(a.value, card) : a.value);
      }
      card.addEventListener('click', onClick);
    });
    modalBusy = modalBusy.then(run, run);
    return modalBusy;
  };

  /* Ask for a name, with a dice for ideas. Resolves with the name, or null if cancelled. */
  UI.askName = function (o) {
    let idx = Math.floor(Math.random() * D.NAMES.length);
    const html = (o.text ? '<p>' + o.text + '</p>' : '') + '<div class="pick"><input class="field" id="nameIn" maxlength="14" autocomplete="off" autocapitalize="words" spellcheck="false" value="' + esc(o.initial || '') + '" placeholder="' + tr('Name') + '">'
      + '<button class="round" id="nameDice" type="button" aria-label="' + tr('Suggest a name') + '">' + ic('dice') + '</button></div><p class="means" id="nameMeans"></p>';
    return UI.modal({
      title: o.title, html, art: o.art,
      actions: [{ label: o.ok || tr('That is the one'), value: 'ok' }].concat(o.cancel ? [{ label: o.cancel, value: 'no' }] : []),
      onOpen(card) {
        const input = card.querySelector('#nameIn'), means = card.querySelector('#nameMeans');
        const suggest = () => { idx = (idx + 1 + Math.floor(Math.random() * 3)) % D.NAMES.length; input.value = D.NAMES[idx][0]; means.textContent = tr('{0} means {1}.', D.NAMES[idx][0], D.NAMES[idx][1]); PN.Audio.play('pop'); };
        card.querySelector('#nameDice').addEventListener('click', suggest);
        input.addEventListener('input', () => { means.textContent = ''; });
        if (!o.initial) suggest();
      },
      result(v, card) {
        if (v === 'no') return null;
        const name = card.querySelector('#nameIn').value.replace(/\s+/g, ' ').trim().slice(0, 14);
        return name || D.NAMES[idx][0];
      },
    });
  };

  let titleInfo = null;
  UI.title = {
    ready(isNew, onGo) {
      titleInfo = { isNew, note: onGo.note };
      const go = $('titleGo');
      go.hidden = false; $('titleFoot').hidden = !isNew; $('titleLang').hidden = false;
      $('titleSub').removeAttribute('data-l');
      UI.title.label();
      go.addEventListener('click', () => { PN.Audio.unlock(); PN.Audio.play('pop'); onGo(); }, { once: true });
      $('titleLang').addEventListener('click', () => { PN.Audio.unlock(); PN.Audio.play('tap'); G().setLang(PN.lang === 'fi' ? 'en' : 'fi'); });
    },
    label() {
      if (!titleInfo) return;
      $('titleSub').textContent = titleInfo.isNew ? tr('A little seal is waiting under the snow.') : (titleInfo.note ? titleInfo.note() : '');
      $('titleGo').textContent = tr(titleInfo.isNew ? 'Meet your seal' : 'title|Play');
    },
    hide() { const t = $('title'); t.classList.add('gone'); setTimeout(() => { t.hidden = true; }, 750); },
    show() { const t = $('title'); t.hidden = false; t.classList.remove('gone'); },
  };
  /* Change language everywhere at once. */
  UI.setLang = function (lang) {
    PN.setLang(lang);
    UI.title.label();
    if (G() && G().state) { UI.refresh(); if (UI.sheetName) UI.renderSheet(); }
  };
  UI.fade = (on) => new Promise((r) => { $('fade').classList.toggle('on', on); setTimeout(r, 520); });
  UI.esc = esc; UI.thumb = thumb; UI.temp = temp; UI.mins = mins;
})(window.PN = window.PN || {});
