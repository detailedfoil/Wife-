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
    refresh: '<path d="M19.5 12a7.5 7.5 0 11-2.2-5.3"/><path d="M19.5 4.5v4h-4"/>',
    back: '<path d="M14.5 5.5L8 12l6.5 6.5"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 16.9 6.6 19.8l1.1-6.1L3.2 9.4l6.1-.8z"/>',
    zzz: '<path d="M5 6h7l-7 8h7M14 12h5l-5 6h5"/>',
    cloud: '<path d="M7 18a4 4 0 0 1-.6-8 5.5 5.5 0 0 1 10.7-1.2A4.6 4.6 0 0 1 17.4 18H7z"/>',
    snow: '<path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9"/><path d="M9.5 4.5L12 6.5l2.5-2M9.5 19.5l2.5-2 2.5 2"/>',
    aurora: '<path d="M3 9c3-4 6 4 9 0s6 4 9 0M3 14c3-4 6 4 9 0s6 4 9 0M5 19c2.5-3 4.5 3 7 0s4.5 3 7 0"/>',
    med: '<rect x="4" y="4" width="16" height="16" rx="5"/><path d="M12 8v8M8 12h8"/>',
    anxi: '<path d="M4.5 10l5-2M19.5 10l-5-2M7.5 17.5q1.1-1.6 2.25 0t2.25 0 2.25 0 2.25 0"/>',
    grump: '<path d="M4.5 8.5l5 2M19.5 8.5l-5 2M8 17.5c2.5-2.5 5.5-2.5 8 0"/>',
    dive: '<path d="M12 3v10M8 9.5l4 4 4-4M3 18c2-2 4 2 6 0s4 2 6 0 4 2 6 0"/>',
    steam: '<path d="M6 20h12M8 15.5c-2-3 2-4 0-7.5M12 15.5c-2-3 2-4 0-7.5M16 15.5c-2-3 2-4 0-7.5"/>',
    dice: '<rect x="4" y="4" width="16" height="16" rx="4"/><circle class="f" cx="9" cy="9" r="1.3"/><circle class="f" cx="15" cy="15" r="1.3"/><circle class="f" cx="15" cy="9" r="1.3"/><circle class="f" cx="9" cy="15" r="1.3"/>',
    cards: '<rect x="3" y="7" width="10" height="13" rx="2.5"/><path d="M9.5 7V5.6a2 2 0 0 1 2.3-2l6.6 1.2A2 2 0 0 1 20 7.1l-1.5 8.6a2 2 0 0 1-2.3 1.6L13 16.8"/>',
    gift: '<rect x="4" y="10" width="16" height="10" rx="2"/><path d="M3 7h18v3H3zM12 7v13M12 7c-1.5-4-6-3-4 0M12 7c1.5-4 6-3 4 0"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2.5"/><path d="M8 11V8a4 4 0 018 0v3"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5l5 5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
    poo: '<path d="M8 19.5c-3.2 0-4-3.2-2-5-1-2 .2-4 3-4-.4-2 1.2-3.8 3.6-4-.4 2 2 2.2 2 4 2.6 0 4 2 3 4 2 1.8 1.2 5-2 5H8z"/>',
    keys: '<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><circle class="f" cx="6.5" cy="10" r="1"/><circle class="f" cx="10.2" cy="10" r="1"/><circle class="f" cx="13.8" cy="10" r="1"/><circle class="f" cx="17.5" cy="10" r="1"/><path d="M7 14.5h10"/>',
    piano: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M9.2 4.5v15M14.8 4.5v15"/><path class="f" d="M7.6 4.5h3.2v8H7.6zM13.2 4.5h3.2v8h-3.2z"/>',
    puff: '<circle cx="11" cy="12" r="5.6"/><path d="M11 3.2v1.9M11 18.9v1.9M2.2 12h1.9M4.8 5.8l1.3 1.3M4.8 18.2l1.3-1.3M15.6 6.6l1-1M15.6 17.4l1 1M16.6 12l4.6-2.6v5.2z"/><circle class="f" cx="9" cy="10.8" r="1"/>',
    stack: '<rect x="7" y="4" width="9" height="4.5" rx="1.5"/><rect x="5" y="9.75" width="12" height="4.5" rx="1.5"/><rect x="4" y="15.5" width="16" height="4.5" rx="1.5"/>',
    up: '<path d="M12 19V6M6 11l6-6 6 6"/>',
    heartfull: '<path class="f" d="M12 21s-8.5-5.2-8.5-11.4A4.7 4.7 0 0 1 12 6.6a4.7 4.7 0 0 1 8.5 3C20.5 15.8 12 21 12 21z"/>',
    heartup: '<path class="f" d="M12 21s-8.5-5.2-8.5-11.4A4.7 4.7 0 0 1 12 6.6a4.7 4.7 0 0 1 8.5 3C20.5 15.8 12 21 12 21z"/><path d="M12 17v-6.5M8.9 13.2L12 10l3.1 3.2" stroke="#fff" stroke-width="2.6"/>',
    heartdown: '<path class="f" d="M12 21s-8.5-5.2-8.5-11.4A4.7 4.7 0 0 1 12 6.6a4.7 4.7 0 0 1 8.5 3C20.5 15.8 12 21 12 21z"/><path d="M12 9.5V16M8.9 13.2L12 16.4l3.1-3.2" stroke="#fff" stroke-width="2.7"/>',
    heartflat: '<path class="f" d="M12 21s-8.5-5.2-8.5-11.4A4.7 4.7 0 0 1 12 6.6a4.7 4.7 0 0 1 8.5 3C20.5 15.8 12 21 12 21z"/><path d="M8.6 13h6.8" stroke="#fff" stroke-width="2.7"/>',
    down: '<path d="M12 5v13M6 13l6 6 6-6"/>',
    smile: '<circle cx="12" cy="12" r="9"/><circle class="f" cx="9" cy="10" r="1.2"/><circle class="f" cx="15" cy="10" r="1.2"/><path d="M8.2 14.2q3.8 3.6 7.6 0"/>',
    frown: '<circle cx="12" cy="12" r="9"/><circle class="f" cx="9" cy="10" r="1.2"/><circle class="f" cx="15" cy="10" r="1.2"/><path d="M8.2 16.6q3.8-3.4 7.6 0"/>',
    meh: '<circle cx="12" cy="12" r="9"/><circle class="f" cx="9" cy="10" r="1.2"/><circle class="f" cx="15" cy="10" r="1.2"/><path d="M8.5 15.3h7"/>',
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
      if (act === 'shopfront') { UI.shopId = id || null; UI.renderSheet(); $('sheetBody').scrollTop = 0; }
    else if (act === 'feed') UI.openSheet('feed');
      else if (act === 'play') UI.openSheet('play');
      else if (act === 'shop') UI.openSheet('shop');
      else if (act === 'sauna') G().sauna();
      else if (act === 'sleep') G().sleepToggle();
    });
    $('meters').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      const st = G().state, k = b.dataset.stat, v = Math.round(st.stats[k]);
      const words = { food: ['Tummy', 'fish'], joy: ['Happiness', 'heart'], energy: ['Energy', 'bolt'], clean: ['Cleanliness', 'steam'] }[k];
      const tip = { food: 'Feed to fill it.', joy: 'Games she fancies lift it. A few strokes help a little.', energy: 'Sleep brings it back, or an energy drink fills it at once.', clean: 'A sauna or a dive sorts it.' }[k];
      UI.toast('<b>' + tr(words[0]) + ' ' + v + pc() + '</b> ' + tr(v < 60 ? tip : 'Doing fine.'), words[1]);
    });
    $('plate').addEventListener('click', () => { PN.Audio.play('tap'); UI.openSheet('profile'); });
    $('bAlbum').addEventListener('click', () => { PN.Audio.play('tap'); UI.openSheet('album'); });
    $('bSettings').addEventListener('click', () => { PN.Audio.play('tap'); UI.openSheet('settings'); });
    $('skyChip').addEventListener('click', () => UI.skyInfo());
    $('sulkChip').addEventListener('click', () => { PN.Audio.play('tap'); if (G().state.medLate) G().openMed(); else UI.openSheet('feed'); });
    $('medChip').addEventListener('click', () => { PN.Audio.play('tap'); G().openMed(); });
    $('medClose').addEventListener('click', () => G().closeMed());
    $('medCam').addEventListener('click', (e) => { if (e.target === e.currentTarget) G().closeMed(); });   // tap outside the card to close
    $('medShoot').addEventListener('click', () => G().medPhoto());
    $('medFile').addEventListener('change', (e) => G().medFile(e.target.files && e.target.files[0]));
    $('medSkip').addEventListener('click', () => G().medSkip());
    $('sheetClose').addEventListener('click', () => UI.closeSheet());
    $('sheetTabs').addEventListener('click', (e) => { const b = e.target.closest('.tab'); if (b) { PN.Audio.play('tap'); UI.tab = b.dataset.tab; UI.renderSheet(); } });
    $('sheetBody').addEventListener('click', onSheetClick);
    $('sheetBody').addEventListener('input', (e) => { if (e.target.classList.contains('dev-search')) { UI.devQuery = e.target.value; filterDev(); } });
    $('family').addEventListener('click', (e) => {
      if (e.target.closest('.fam-chip')) { PN.Audio.play('tap'); UI.openSheet('album', 'family'); return; }
      const c = e.target.closest('.pup-chip'); if (c) G().pupInfo(+c.dataset.i);
    });
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
    const sn = S.sulkNeeds(st), chip = $('sulkChip');
    chip.hidden = !sn;
    if (sn) chip.textContent = st.medLate ? tr('Anxiety: needs her medicine') : tr('Angry: {0} of sleep left', mins(napMs(st)));
    const mi = S.medInfo(st, Date.now()), mc = $('medChip');
    mc.hidden = !st.name || !mi.late;
    if (!mc.hidden) mc.textContent = mi.taken ? tr('Pill photo +{0}', S.T.medBonus) : tr('Medicine');
    $('sleepLabel').textContent = tr(st.asleep ? 'Wake' : 'Sleep');
    const need = { feed: st.stats.food < 25 || st.sick || st.pups.some((p) => p.sick) || (st.stats.energy < 20 && S.energyCans(st).some((c) => c.have > 0)), play: st.stats.joy < 30 && !st.asleep, sauna: st.stats.clean < 25, sleep: st.stats.energy < 20 && !st.asleep };
    document.querySelectorAll('#dock button').forEach((b) => {
      b.classList.toggle('need', !!need[b.dataset.act]);
      if (b.dataset.act === 'sleep') b.classList.toggle('on', st.asleep);
    });
    // A Family button for as long as there is a family (pups at home, grown pups or lost ones). A dot says someone needs you: a pup ready to set off or with skill points to spend, or a grown pup newly here to visit (it rests once the Family tab has been opened during her visit).
    const here = st.family.some((f) => f.fate === 'grown' && S.visitStatus(f, Date.now()) === 'here' && f.seenAt !== f.arriveAt), ready = st.pups.some((p) => p.ready || S.pupFree(p) > 0), hasFam = st.pups.length + st.family.length > 0;
    const key = (hasFam ? 'f' : '') + (here ? 'v' : '') + (ready ? 'g' : '') + '|' + st.pups.map((p) => p.name + Math.round(p.food / 4) + (p.sick ? 's' : '') + (p.ready ? 'r' : '') + S.pupFree(p)).join('|');
    if (key !== famKey) {
      famKey = key;
      $('family').innerHTML = (hasFam ? '<button class="fam-chip pebble" data-open="family">' + ic('heart') + '<span>' + tr('Family') + '</span>' + (here || ready ? '<i class="dot" aria-hidden="true"></i>' : '') + '</button>' : '') + st.pups.map((p, i) => '<button class="pup-chip pebble' + (p.sick || p.food < 12 ? ' bad' : '') + '" data-i="' + i + '"><span class="face"></span>' + esc(p.name)
        + '<span class="bar"><i style="width:' + Math.max(4, p.food) + '%"></i></span>' + (S.pupFree(p) > 0 ? '<i class="dot" aria-hidden="true"></i>' : '') + '</button>').join('');
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
    const where = env.live ? ' ' + tr('Live weather from Tampere, where it is {0}.', PN.Astro.wallClock(PN.World.now())) : '';
    UI.toast(tr('<b>{0}C</b> and {1} at the lake.', temp(env.temp), tr(c.text)) + where + (extra ? tr(extra) : ''), c.icon, '', env.live ? 6000 : 4200);
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

  UI.setBusy = (b) => $('hud').classList.toggle('busy', !!b);
  UI.showHud = (on) => { $('hud').hidden = !on; };

  /* ---------- sheets ---------- */
  UI.sheetName = null; UI.tab = null;
  UI.openSheet = function (name, tab) {
    const sh = $('sheet');
    UI.sheetName = name;
    UI.tab = tab || { shop: 'shops', album: 'fish' }[name] || null;
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
  /* The pup stats page: how the family is doing, how many of each skill there are, and every pup's skill points, newest first. */
  function pupStatsPage(st) {
    const now = Date.now(), c = st.counters || {};
    const grown = st.family.filter((f) => f.fate === 'grown'), lost = st.family.filter((f) => f.fate !== 'grown');
    const fam = S.familyBonus(st), line = (a, b) => '<div class="statline"><span>' + a + '</span><b>' + b + '</b></div>';
    const visiting = grown.filter((f) => S.visitStatus(f, now) === 'here');
    const day = (t) => new Date(t).toLocaleDateString(PN.isFi() ? 'fi-FI' : 'en-GB', { day: 'numeric', month: 'short' });
    if (!st.pups.length && !st.family.length) return '<p class="lead">' + tr('No pups yet.') + '</p>';
    PN.Thumbs.pups(st.pups.concat(st.family));
    let h = '<div class="shelf">' + tr('The family') + '<span>' + tr('{0} in all', st.pups.length + st.family.length) + '</span></div>'
      + line(tr('Pups at home'), st.pups.length) + line(tr('Raised to grown-up'), grown.length) + line(tr('Did not make it'), lost.length || c.pupsLost || 0)
      + line(tr('Visits so far'), c.pupVisits || 0)
      + line(tr('Visiting now'), visiting.length ? visiting.map((f) => esc(f.name)).join(', ') : tr('nobody'))
      + line(tr('Family bonus'), '+' + fam + '%' + (fam >= S.T.famBonusMax ? ' ' + tr('(top)') : ' ' + tr('(next pup: +{0}%)', S.T.famBonusEach)));
    h += '<div class="shelf">' + tr('Grown pups by skill') + '<span>' + tr('{0} grown', grown.length) + '</span></div>';
    PN.SKILL_ORDER.concat(['all']).forEach((k) => {
      const n = grown.filter((f) => { const top = S.topSkills(f.pts); return k === 'all' ? top.length !== 1 && top.length !== 2 : top.indexOf(k) >= 0 && top.length <= 2; }).length;
      h += line(UI.specName(k) + (k === 'all' ? '' : ' · ' + UI.skillName(k)), n);
    });
    h += '<p class="note">' + tr('Each point a grown pup has gives +{0}% coins in the games of that skill while she visits, and each Care point makes her happiness drop {1}% slower while you are away (visiting or not; only the best Care pup in the family counts).', S.T.pointBonus, S.T.carePoint) + '</p>';
    h += '<div class="shelf">' + tr('Every pup') + '<span>' + tr('newest first') + '</span></div><div class="rows">';
    const one = (p, home, i) => {
      const spec = home ? (S.pupSpent(p) ? UI.specLabel(p) : null) : UI.specLabel(p);
      const bits = [home ? tr('At home, born {0}', day(p.bornAt)) : tr('Grown up {0}', day(p.endAt)), home ? tr('Level {0} of {1}', S.pupLevel(p), S.T.pupMaxPoints) : '',
        home && S.pupFree(p) ? tr('Skill points to spend: {0}', S.pupFree(p)) : '', p.pts ? UI.pointsLine(p.pts) : ''].filter(Boolean);
      return row({ icon: 'seal', img: PN.Thumbs.pup(p), tint: home ? 'leaf' : '', cls: home ? '' : 'done', title: esc(p.name) + (spec ? ' · ' + (home ? tr('heading for {0}', spec) : spec) : ''),
        text: bits.join('. ') + '.' + (!home ? ' ' + UI.perkText(p, esc(p.name)) : '') + (p.pts ? UI.radar(p.pts, 96, true) : ''), act: home ? 'pupinfo' : (p.fate === 'grown' ? 'callpup' : ''), id: i });
    };
    st.pups.forEach((p, i) => { h += one(p, true, i); });
    grown.map((f) => [f, st.family.indexOf(f)]).reverse().forEach(([f, i]) => { h += one(f, false, i); });
    lost.slice().reverse().forEach((f) => { h += row({ icon: 'heart', img: PN.Thumbs.pup(f), title: esc(f.name), text: tr('Did not make it. Remembered always.'), side: day(f.endAt) }); });
    return h + '</div>';
  }
  const TABS = { shop: [['food', 'Food'], ['shops', 'Shops'], ['wear', 'Wardrobe'], ['home', 'For the shore']], album: [['fish', 'tab|Fish'], ['finds', 'Finds'], ['words', 'Words'], ['awards', 'Awards'], ['family', 'Family'], ['pupstats', 'Pup stats']] };
  UI.renderSheet = function (soft) {
    const name = UI.sheetName, st = G().state;
    if (!name) return;
    const body = $('sheetBody'), keep = body.scrollTop;
    $('sheetTitle').textContent = name === 'feed' ? tr('Feed {0}', st.name) : name === 'profile' ? st.name : tr(TITLES[name]);
    const tabs = TABS[name];
    $('sheetTabs').hidden = !tabs;
    if (tabs) {
      $('sheetTabs').innerHTML = tabs.map((t) => '<button class="tab' + (t[0] === UI.tab ? ' on' : '') + '" data-tab="' + t[0] + '">' + tr(t[1]) + '</button>').join('');
      const on = $('sheetTabs').querySelector('.tab.on');
      if (on) $('sheetTabs').scrollLeft = Math.max(0, on.offsetLeft - ($('sheetTabs').clientWidth - on.offsetWidth) / 2);   // a tab off the edge (Family, Pup stats) is scrolled into view
    }
    const html = VIEWS[name](st);
    if (soft && html === body._last) return;
    body._last = html; body.innerHTML = html;
    filterDev();
    body.scrollTop = keep;
  };
  /* Developer options: a search box narrows the list as you type. The words typed survive a redraw. */
  UI.devQuery = '';
  function filterDev() {
    const box = $('sheetBody').querySelector('.dev-search');
    if (!box) return;
    if (box.value !== UI.devQuery) box.value = UI.devQuery;
    const q = UI.devQuery.trim().toLowerCase();
    let shown = 0;
    $('sheetBody').querySelectorAll('.dev-row').forEach((r) => { const on = !q || r.textContent.toLowerCase().includes(q); r.hidden = !on; shown += on; });
    const none = $('sheetBody').querySelector('.dev-none'); if (none) none.hidden = shown > 0;
  }

  const cell = (id, inner, cls, act) => '<button class="cell ' + (cls || '') + '" data-do="' + act + '" data-id="' + id + '">' + inner + '</button>';
  /* The colour of a tile in the shop and the larder: orange for food, yellow for energy drinks, and coffee brown for the coffee, which is a special thing of its own. */
  const tint = (raw) => { const it = PN.items[raw.id] || raw; return it.full ? 'k-coffee' : it.energy ? 'k-drink' : it.kind === 'fish' || it.kind === 'food' || it.kind === 'med' ? 'k-food' : ''; };
  /* What a thing to eat or drink does, shown under its Finnish name in the shop and the pantry. */
  const gain = (icon, n, tip) => '<span class="gain" title="' + esc(tip) + '">' + ic(icon) + '+' + n + '</span>';
  const effect = (it) => it.full ? tr('Fills tummy, happiness and energy') : it.kind === 'med' || it.med ? tr('Cures a poorly seal') : it.energy ? gain('bolt', it.energy, tr('Energy')) + gain('fish', it.food, tr('Tummy')) : gain('fish', it.food, tr('Tummy'));
  const eats = (it) => '<b lang="fi">' + esc(it.fi) + '</b><small>' + effect(it) + '</small>';
  const names = (it) => it.id === 'cookie'
    ? '<b>Cookie</b><small>' + (PN.isFi() ? 'hölmö' : 'stupid') + '</small>'
    : '<b lang="fi">' + esc(it.fi) + '</b>' + (PN.isFi() ? '' : '<small>' + esc(it.en) + '</small>');
  const row = (o) => '<' + (o.act ? 'button' : 'div') + ' class="row ' + (o.cls || '') + '"' + (o.act ? ' data-do="' + o.act + '" data-id="' + (o.id || '') + '"' : '') + '><span class="ic-wrap ' + (o.tint || '') + (o.img ? ' pic' : '') + '">' + (o.img ? '<img src="' + o.img + '" alt="">' : ic(o.icon)) + '</span><span class="txt"><b>'
    + o.title + '</b><span class="d">' + o.text + '</span></span>' + (o.side ? '<span class="side">' + o.side + '</span>' : '') + '</' + (o.act ? 'button' : 'div') + '>';
  const mins = (ms) => { const m = Math.ceil(ms / 60000); return m >= 60 ? Math.floor(m / 60) + ' h ' + (m % 60) + ' min' : m + ' min'; };
  const napMs = (st) => Math.max(0, st.grudge) / (100 / S.T.sulkSleepH) * 3600e3;   // sleep it would take to sulk it off
  const WHY = { asleep: 'asleep', sick: 'poorly', sulk: 'angry', tired: 'too tired', wait: 'resting' };

  const VIEWS = {
    feed(st) {
      const need = S.sulkNeeds(st);
      const sulkBanner = st.medLate ? '<div class="sulk-card"><b>' + tr('{0} has anxiety.', esc(st.name)) + '</b> ' + tr('She needs her medicine. Nothing else will calm her down today.') + '<p style="margin:10px 0 0"><button class="btn small" data-do="med">' + tr('Medicine') + '</button></p></div>' : need ? '<div class="sulk-card"><b>' + tr('{0} is angry.', esc(st.name)) + '</b> ' + '<div class="sulk-timer">' + tr('Angry timer: {0} of sleep left', mins(napMs(st))) + '</div>' + tr('Sleeping counts the timer down. Each treat below cuts {0} off it. All the head pats together and the sauna cut {0} each.', mins(S.T.sulkTreatCut * S.T.sulkSleepH * 3600e3)) + '<div class="sulk-want">'
        + need.treats.map((id) => '<span class="' + (need.got.indexOf(id) >= 0 ? 'done' : '') + '"><img src="' + PN.Thumbs.get(id) + '" alt="">' + esc(PN.items[id].fi) + (need.got.indexOf(id) >= 0 ? ' \u2713' : ' \u2212' + mins(S.T.sulkTreatCut * S.T.sulkSleepH * 3600e3)) + '</span>').join('')
        + '<span class="' + (need.pats >= S.T.sulkPats ? 'done' : '') + '">' + ic('heart') + tr('Head pats') + ' ' + Math.min(need.pats, S.T.sulkPats) + '/' + S.T.sulkPats + (need.pats >= S.T.sulkPats ? ' \u2713' : ' \u2212' + mins(S.T.sulkPatCut * S.T.sulkSleepH * 3600e3)) + '</span>'
        + '<span class="' + (need.bath ? 'done' : '') + '">' + ic('steam') + tr('Sauna') + (need.bath ? ' \u2713' : ' \u2212' + mins(S.T.sulkBathCut * S.T.sulkSleepH * 3600e3)) + '</span>'
        + '</div></div>' : '';
      const ids = Object.keys(st.pantry).filter((id) => st.pantry[id] > 0 && PN.items[id]);
      const order = { fish: 0, food: 1, med: 2 };
      ids.sort((a, b) => order[PN.items[a].kind] - order[PN.items[b].kind] || (PN.items[a].food || 0) - (PN.items[b].food || 0));
      const lowE = G().energyLow();
      if (lowE) ids.sort((a, b) => !!PN.items[b].energy - !!PN.items[a].energy);   // short of energy: the cans come first
      const energyBanner = lowE && ids.some((id) => PN.items[id].energy) ? '<div class="sulk-card"><b>' + tr('{0} is low on energy.', esc(st.name)) + '</b> ' + tr('Tap an energy drink to give her a can right now.') + '</div>' : '';
      const fav = st.favKnown ? tr('Favourite: <b>{0}</b>.', PN.items[st.fav].fi.toLowerCase()) : tr('There is one fish {0} loves best. Try them all to find it.', esc(st.name));
      const spare = S.spare(st, Date.now());
      const juice = spare.juice ? '<div class="rows">' + row({ icon: 'med', tint: 'rose', title: tr('Ask the neighbours'), act: 'borrow',
        text: tr('{0} is poorly and the juice costs more than you have. The neighbours can spare a bottle.', esc(st.name)) }) + '</div>' : '';
      if (!ids.length) {
        return sulkBanner + '<p class="lead">' + tr('The larder is empty. Catch fish in Fish Rain, send {0} diving, or buy some.', esc(st.name))
          + (spare.fish ? tr(' With no coins either, the neighbours will spare a few fish.') : '') + '</p>' + (spare.fish ? '' : juice) + '<div class="btn-row">'
          + (spare.fish ? '<button class="btn small" data-do="borrow">' + tr('Ask the neighbours') + '</button>' : '<button class="btn small" data-do="goto" data-id="play">' + tr('Play') + '</button>')
          + '<button class="btn small ghost" data-do="goto" data-id="shop">' + tr('Shop') + '</button></div>';
      }
      return sulkBanner + energyBanner + '<p class="lead">' + tr('Tummy {0}%. ', Math.round(st.stats.food)) + fav + '</p>' + juice + '<div class="grid">' + ids.map((id) => {
        const it = PN.items[id];
        return cell(id, thumb(id) + eats(it) + '<span class="count">' + st.pantry[id] + '</span>' + (it.kind === 'med' ? '<span class="tag">' + tr('medicine') + '</span>' : ''), (tint(it) + (st.favKnown && id === st.fav ? ' fav' : '')).trim(), 'feed');
      }).join('') + '</div>';
    },
    play(st) {
      const now = Date.now(), can = S.canPlay(st), dive = S.canDive(st, now);
      const off = (c) => (c.ok ? '' : ' off');
      const why = (c) => tr(WHY[c.why]);
      const moods = S.gameMoods(st, now), owned = PN.GAME_ORDER.filter((id) => S.gameOwned(st, id) && !PN.GAMES[id].dev);
      // what she makes of each game right now: the percent more or less it pays
      // what a game does to her happiness: a heart with an arrow up (green) or down (red), and the points it moves it by
      const heart = (j) => (j > 0 ? 'heartup' : j < 0 ? 'heartdown' : 'heartflat');
      // the figure is per minute of play (a game's happiness for a usual play, scaled to a minute), so a long game cannot look better just by being long
      const mood = (id) => { const m = moods.games[id], j = Math.round(m.joy * 60 / PN.GAMES[id].len), cls = j > 0 ? 'up' : j < 0 ? 'down' : ''; return '<span class="mood ' + cls + '" aria-label="' + tr('Happiness {0} per minute', (j > 0 ? '+' : '') + j) + '">' + ic(heart(j)).replace('class="ic"', 'class="ic hrt"') + (j > 0 ? '+' : j < 0 ? '\u2212' : '') + (m.skip && !j ? '' : Math.abs(j)) + '<small>' + tr('Per minute') + '</small></span>'; };
      const hb = moods.happy, happyCard = '<div class="happy-card ' + (hb > 0 ? 'up' : '') + '">' + ic(hb > 0 ? 'heartfull' : 'heartflat') + '<div><b>' + (hb > 0 ? tr('{0} is happy: +{1}% on every game.', esc(st.name), hb) : tr('{0} is content: no bonus yet.', esc(st.name))) + '</b> ' + tr('Happiness {0}%. A heart with an arrow up lifts it, and the bonus with it, up to +{1}%. A heart with an arrow down brings it down.', Math.round(st.stats.joy), S.T.happyMax) + '</div></div>';
      const onl = PN.Online, inRoom = onl && onl.room, fr = onl && onl.friend;
      const onlineCard = onl ? '<button class="row online-row online-card" data-do="online"><span class="ic-wrap">' + ic('globe') + '</span><span class="txt"><b>' + tr('Play with a friend') + ' <span class="beta-tag">' + tr('Online beta') + '</span></b><span class="d">' + (inRoom ? (fr ? tr('Playing with {0} in room {1}', esc(fr.name || ''), inRoom) : tr('In room {0}. Waiting for a friend.', inRoom)) : tr('Make or join a room: both seals on the shore, and head to head races.')) + '</span></span></button>' : '';
      const tiredBanner = G().energyLow() ? '<div class="sulk-card"><b>' + tr('{0} is out of energy.', esc(st.name)) + '</b> ' + tr('No need to wait for sleep. An energy drink fills her up right now.') + '<p style="margin:10px 0 0"><button class="btn small" data-do="tiredcard">' + ic('bolt') + tr('Energy drinks') + '</button></p></div>' : '';
      let h = onlineCard + tiredBanner + (moods.muck > 0 ? '<div class="sulk-card"><b>' + tr('{0} is mucky.', esc(st.name)) + '</b> ' + tr('Every game pays {0}% less until she has had a sauna.', moods.muck) + '</div>' : '')
        + happyCard + '<p class="lead">' + tr('The heart by a game shows whether it lifts her happiness (arrow up) or lowers it (arrow down), and by how much for every minute you play it. Each play wears a game out a little and makes the others more fun.') + '</p>';
      h += '<div class="rows">';
      h += row({ icon: 'dive', tint: 'sea', title: tr('Dive'), text: tr('Send {0} down the ice hole and see what comes back up.', esc(st.name)) + '<em class="risk">' + tr('High risk, high reward. She might come back angry.') + '</em>', act: 'dive', cls: off(dive), side: dive.ok ? tr('ready') : dive.why === 'wait' ? mins(st.dive.readyAt - now) : why(dive) });
      PN.GAME_ORDER.forEach((id) => {
        const gm = PN.GAMES[id], best = st.counters[gm.best];
        if (gm.dev && !st.dev) return;                       // developer-mode games are not shown otherwise
        const text = tr((st.settings.mumMode && PN.MUM_GAME_TEXT?.[id]) || gm.text);
        if (!S.gameOwned(st, id)) h += row({ icon: 'lock', tint: gm.tint, title: tr(gm.title), text, act: 'unlock', id, cls: st.coins >= S.price(st, gm.price) ? '' : ' off', side: tr('Unlock {0}', gm.price) + (st.dev ? ' · ' + tr('Free') : '') });
        else h += row({ icon: gm.icon, tint: gm.tint, title: tr(gm.title), text, act: 'game', id, cls: off(can), side: can.ok ? mood(id) + (best ? '<small>' + tr('best {0}', gm.low ? PN.mmss(best) : best) + '</small>' : '') : why(can) });
      });
      h += '</div>';
      if (owned.length >= 4) {   // with only the three free games there is nothing worth leaving out yet
        h += '<div class="shelf">' + tr('Leave out') + '<span>' + tr('{0} of {1}', moods.skips, moods.skipMax) + '</span></div><p class="lead">' + tr('Not keen on a game? Leave out up to {0}. A game left out is never one of her favourites, and still wears out if you play it.', moods.skipMax) + '</p><div class="chips wrap">'
          + owned.map((id) => '<button class="chip-btn' + (moods.games[id].skip ? ' on' : '') + '" data-do="skip" data-id="' + id + '" aria-pressed="' + moods.games[id].skip + '">' + tr(PN.GAMES[id].title) + '</button>').join('') + '</div>';
      }
      return h;
    },
    shop(st) {
      let h = '';
      const price = (it) => coinTag(it.price + (st.dev ? ' · ' + tr('Free') : ''), st.coins >= S.price(st, it.price) ? 'buy' : 'cant');
      if (UI.tab === 'food') {
        const list = D.FISH.filter((f) => f.price).concat(D.FOODS);
        h = '<p class="lead">' + tr('Fresh from the village. Tap to buy one.') + '</p><div class="grid">' + list.map((it) => cell(it.id, thumb(it.id) + eats(it) + price(it) + (st.pantry[it.id] ? '<span class="count">' + st.pantry[it.id] + '</span>' : ''), tint(it), 'buy')).join('') + '</div>';
      } else if (UI.tab === 'shops') {
        const level = st.dev ? Infinity : Math.max(st.maxLevel || 1, S.level(st).level), shop = PN.SHOPS.find((x) => x.id === UI.shopId);
        const title = (x) => esc(PN.isFi() ? x.fi : x.en);
        if (!shop) {
          h = '<p class="lead">' + tr('Little shops for your seal and shore. New doors open as your friendship grows.') + '</p><div class="shop-fronts">'
            + PN.SHOPS.map((x) => '<button class="shop-front' + (level < x.level ? ' locked' : '') + '" data-do="shopfront" data-id="' + x.id + '"><span class="shop-art" aria-hidden="true">' + x.icon + '</span><b>' + title(x) + '</b><span>' + (level < x.level ? tr('Opens at level {0}', x.level) : tr('Open for browsing')) + '</span></button>').join('') + '</div>';
        } else {
          const locked = level < shop.level;
          h = '<button class="chip-btn" data-do="shopfront">' + tr('Back to shops') + '</button><h3 class="shelf">' + shop.icon + ' ' + title(shop) + '</h3>';
          if (shop.id === 'sturgeon') h += PN.Clinic.storefront(locked);
          if (locked) h += '<p class="lead">' + tr('Opens at level {0}', shop.level) + '</p>';
          h += '<div class="grid">' + shop.items.map((id) => {
            const it = PN.items[id], wear = it.kind === 'wear', own = st.owned[id];
            const on = wear ? st.wearing[it.slot] === id : st.placed[id];
            return cell(id, thumb(id) + names(it) + (own ? '<span class="tag">' + tr(wear ? 'Choose seal' : on ? 'Out' : 'Put out') + '</span>' : locked ? '<span class="tag">' + tr('Opens at level {0}', shop.level) + '</span>' : price(it)), locked && !own ? 'locked' : '', own ? wear ? 'wear' : 'place' : locked ? 'none' : 'buy');
          }).join('') + '</div>';
        }
      } else {
        // one shelf for each kind of thing, with a row of shortcuts at the top
        const wear = UI.tab === 'wear', cats = wear ? D.WEAR_CATS : D.DECOR_CATS, list = (wear ? D.WEAR : D.DECOR).filter((it) => !it.hidden && (st.owned[it.id] || (wear && st.pups.concat(st.family.filter((f) => S.visitStatus(f, Date.now()) === 'here')).some((p) => (p.owned && p.owned[it.id]) || Object.values(p.wear || {}).includes(it.id)))));
        const one = (it) => {
          const own = true, on = wear ? st.wearing[it.slot] === it.id : st.placed[it.id];
          return cell(it.id, thumb(it.id) + names(it) + (own ? '<span class="tag' + (on ? ' on' : '') + '">' + tr(wear ? ((st.pups.length || st.family.some((f) => f.fate === 'grown' && S.visitStatus(f, Date.now()) === 'here')) ? 'Choose seal' : on ? 'Wearing' : 'tag|Wear') : (on ? 'Out' : 'Put out')) + '</span>' : price(it)), '', own ? (wear ? 'wear' : 'place') : 'buy');
        };
        h = '<p class="lead">' + tr(wear ? 'Tap something you own to put it on or take it off.' : 'Things for the shore. Tap one you own to put it out or tidy it away.') + '</p>'
          + '<div class="chips">' + cats.map((c) => '<button class="chip-btn" data-do="jump" data-id="cat-' + c.id + '">' + tr(c.t) + '</button>').join('') + '</div>'
          + cats.map((c) => {
            const items = list.filter((it) => it.cat === c.id);
            return '<h3 class="shelf" id="cat-' + c.id + '">' + tr(c.t) + '<span>' + items.filter((it) => st.owned[it.id]).length + ' / ' + items.length + '</span></h3><div class="grid">' + items.map(one).join('') + '</div>';
          }).join('');
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
      // then and now: her natural look as a pup beside how she looks today
      const pic = (src, cap) => '<figure>' + (src ? '<img src="' + src + '" alt="">' : '<span class="ic-wrap">' + ic('seal') + '</span>') + '<figcaption>' + cap + '</figcaption></figure>';
      let h = '<div class="then-now" aria-label="' + tr('{0}, then and now', esc(st.name)) + '">' + pic(PN.Thumbs.seal(st.birthAppearance, 0), tr('{0} as a kuutti', esc(st.name))) + pic(PN.Thumbs.seal(st.appearance, st.stage), tr('album|Now')) + '</div>';
      if (t === 'pupstats') return pupStatsPage(st);
      if (!st.pups.length && !st.family.length) {
        return h + '<p class="lead">' + tr('No pups yet.') + '</p><div class="rows">' + row({ icon: 'seal', title: tr('One day, perhaps'), text: tr('A grown seal who is happy, well fed and at friendship level {0} may have a pup of her own.', S.T.pupLevel) }) + '</div>';
      }
      PN.Thumbs.pups(st.pups.concat(st.family));      // little portraits, drawn once for each outfit
      const face = (w) => PN.Thumbs.pup(w);
      h += '<div class="rows">';
      const fam = S.familyBonus(st), raised = st.family.filter((f) => f.fate === 'grown').length;
      h += row({ icon: 'star', tint: fam ? 'leaf' : '', cls: fam ? 'done' : '', title: tr('Family bonus'),
        text: tr('+{0}% coins in every game. Each pup raised adds {1}%, up to {2}%.', fam, S.T.famBonusEach, S.T.famBonusMax) + (raised ? '' : ' ' + tr('Raise your first pup to start it.')),
        side: '+' + fam + '%' });
      st.pups.forEach((p, i) => {
        const left = Math.max(0, S.T.pupGrow - p.grownMs);
        h += row({ icon: 'seal', img: face(p), tint: p.sick ? 'rose' : 'leaf', title: esc(p.name), text: (p.sick ? tr('Poorly. Feed {0} so she can nurse, and give cloudberry juice.', esc(st.name)) : p.ready ? tr('Ready to set off into the lake.')
          : p.food < 20 ? tr('Hungry. Pups feed from their mother, so keep {0} well fed.', esc(st.name)) : tr('Growing well. About {0} of good care to go.', mins(left).replace(/ \d+ min$/, '')))
          + ' ' + tr('Level {0}.', S.pupLevel(p)) + (S.pupFree(p) ? ' ' + tr('Skill points to spend: {0}.', S.pupFree(p)) : '') + ' ' + tr('Heading for: {0}.', UI.headingFor(p)),
          side: tr('born {0}', day(p.bornAt)), act: 'pupinfo', id: i });
      });
      const now = Date.now();
      st.family.forEach((f) => { if (f.fate === 'grown' && S.visitStatus(f, now) === 'here') f.seenAt = f.arriveAt; });   // she has been noticed: the Family dot rests until the next visit
      st.family.map((f, i) => [f, i]).reverse().forEach(([f, i]) => {
        const stat = S.visitStatus(f, now), wait = S.callWait(st, i, now);
        let text = tr('Did not make it. Remembered always.');
        if (f.fate === 'grown') {
          text = stat === 'coming' ? tr('On the way! Arrives in {0}.', mins(f.arriveAt - now))
            : stat === 'here' ? tr('Visiting now. Goes home in {0}.', mins(f.leaveAt - now))
              : wait > 0 ? tr('Grew up and swims the lake. Can be called again in {0}.', mins(wait))
                : tr('Grew up and swims the lake. Tap to call {0} home.', esc(f.name));
        }
        h += row({ icon: f.fate === 'grown' ? 'star' : 'heart', img: face(f), tint: stat !== 'home' ? 'leaf' : '', cls: f.fate === 'grown' ? 'done' : '', title: esc(f.name) + (f.fate === 'grown' && f.pts ? ' · ' + UI.specLabel(f) : ''), text: text + (f.fate === 'grown' && f.pts ? UI.radar(f.pts, 96, true) : ''),
          side: tr('{0} to {1}', day(f.bornAt), day(f.endAt)), act: f.fate === 'grown' ? 'callpup' : '', id: i });
      });
      return h + '</div><p class="note">' + tr('Pups earn xp from everything the family does while they are at home, and every {0} xp is a skill point, up to {1}. Spend them on the pup card. A grown pup gives +{2}% coins per point in the games of that skill when she visits, and each Care point makes her happiness drop {3}% slower while you are away (visiting or not; only the best Care pup in the family counts).', S.T.pupXpStep, S.T.pupMaxPoints, S.T.pointBonus, S.T.carePoint) + '</p>'
        + '<p class="note">' + tr('Pups feed from their mother whenever her tummy is above a third. If she goes hungry for long, so do they.') + '</p>';
    },
    profile(st) {
      const lv = S.level(st), days = Math.floor((Date.now() - st.createdAt) / S.DAY), fi = PN.isFi();
      const moods = { sleep: 'fast asleep', sick: 'mood|poorly', sulk: 'mood|angry', hungry: 'hungry', tired: 'sleepy', dirty: 'in need of a sauna', sad: 'a bit glum', happy: 'very happy', ok: 'content' };
      const line = (a, b) => '<div class="statline"><span>' + tr(a) + '</span><b>' + b + '</b></div>';
      const stage = D.STAGES[st.stage], favIt = PN.items[st.fav];
      let next;
      if (st.stage < 2) {
        const nx = D.STAGES[st.stage + 1];
        next = tr('Becomes a {0} at friendship level {1}.', fi ? nx.fi : nx.en, S.T.stageLevel[st.stage]);
      } else next = st.pupMet === 'waiting' ? tr('Expecting! The pup is due in about {0} hours.', Math.max(1, Math.ceil((st.pupBirthAt - Date.now()) / S.H))) : st.pupMet === 'ready' ? tr('Fully grown, and something is in the air. Close the game and come back to see.') : st.pups.length ? tr('Fully grown. The friendship points for the next pup start counting once her pup has swum off.') : tr('Fully grown. A pup may arrive after {0} more friendship points, if she is happy and well fed.', Math.max(0, Math.ceil(S.xpFor(S.T.pupLevel) - st.pupProg)));
      return line('Kind', stage.fi + (fi ? '' : ' (' + stage.en + ')')) + line('Age', days < 1 ? tr('less than a day') : tr(days === 1 ? '{0} day' : '{0} days', days))
        + line('Friendship', tr('level {0} ({1} of {2})', lv.level, Math.floor(lv.into), lv.need)) + line('Mood', st.medLate && S.mood(st) === 'sulk' ? tr('mood|anxiety') : tr(moods[S.mood(st)]))
        + line('Favourite food', st.favKnown ? favIt.fi + (fi ? '' : ' (' + favIt.en.toLowerCase() + ')') : tr('not found yet'))
        + line('Strokes', st.counters.pets) + line('Meals', st.counters.feeds) + line('Dives', st.counters.dives) + line('Games played', st.counters.games)
        + (st.counters.pupsGrown + st.counters.pupsLost ? line('Pups raised', st.counters.pupsGrown) + line('Pups lost', st.counters.pupsLost) : '')
        + '<p class="note">' + next + '</p><div class="btn-row"><button class="btn small ghost" data-do="rename">' + tr('Change name') + '</button></div>';
    },
    settings(st) {
      const updatedText = () => { try { return new Date(PN.UPDATED).toLocaleString(PN.lang === 'fi' ? 'fi-FI' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch (e) { return PN.UPDATED; } };
      const devShown = (s) => s.dev || (() => { try { return !!localStorage.getItem('pikkunorppa.devshown'); } catch (e) { return false; } })();
      const tog = (k, label, icon, text) => '<button class="row" data-do="toggle" data-id="' + k + '" role="switch" aria-checked="' + !!st.settings[k] + '"><span class="ic-wrap">' + ic(icon) + '</span><span class="txt"><b>' + tr(label) + '</b><span class="d">' + tr(text) + '</span></span><span class="toggle' + (st.settings[k] ? ' on' : '') + '"></span></button>';
      const seg = ['live', 'day', 'night'].map((m) => '<button class="' + (st.settings.sky === m ? 'on' : '') + '" data-do="sky" data-id="' + m + '">' + tr({ live: 'Real time', day: 'Day', night: 'Night' }[m]) + '</button>').join('');
      const lang = ['en', 'fi'].map((m) => '<button class="' + (PN.lang === m ? 'on' : '') + '" data-do="lang" data-id="' + m + '">' + { en: 'English', fi: 'Suomi' }[m] + '</button>').join('');
      return '<div class="rows">' + tog('sound', 'Sound', 'sound', 'Squeaks, splashes and chimes.') + tog('music', 'Music', 'music', 'Gentle little melodies, with room for quiet.')
        + tog('mumMode', 'Mum Mode', 'heart', 'Slower minigames, fewer obstacles and more room for mistakes.')
        + '<div class="row"><span class="ic-wrap">' + ic('music') + '</span><span class="txt"><b>' + tr('Background instrument') + '</b><span class="d">' + tr('A random instrument each time you open the game. Change it here anytime.') + '</span><span class="music-choices">' + PN.Audio.instruments.map((i) => '<button class="music-choice' + (PN.Audio.instrument === i.id ? ' on' : '') + '" data-do="instrument" data-id="' + i.id + '" aria-pressed="' + (PN.Audio.instrument === i.id) + '"><b>' + tr(i.name) + '</b><span class="d">' + tr(i.description) + '</span></button>').join('') + '</span></span></div>'
        + (navigator.vibrate ? tog('haptics', 'Buzz', 'bolt', 'A little buzz under your finger when you stroke and tap.') : '')
        + tog('medicine', 'Daily medicine', 'med', 'Off to begin with. Switch it on and she needs her medicine every day from 5am, starting today, or she gets anxiety until she has had it.')
        + tog('stats', 'Share play stats', 'globe', 'Sends anonymous numbers (which games, how long, coins, progress, how the game runs) to the maker. No name or personal details.')
        + '<div class="row"><span class="ic-wrap">' + ic('globe') + '</span><span class="txt"><b>' + tr('Language') + '</b><span class="d">' + tr('Play in English or in Finnish.') + '</span><span class="seg" style="margin-top:8px;display:inline-flex">' + lang + '</span></span></div>'
        + '<div class="row"><span class="ic-wrap">' + ic('sun') + '</span><span class="txt"><b>' + tr('Sky') + '</b><span class="d">' + tr('Real time shows the daylight over Inari in Lapland and the weather in Tampere as they are right now.') + '</span><span class="seg" style="margin-top:8px;display:inline-flex">' + seg + '</span></span></div>'
        + '<div class="row"><span class="ic-wrap">' + ic('book') + '</span><span class="txt"><b>' + tr('Move to another device') + '</b><span class="d">' + tr('Your seal is saved on this device only. A save code lets you carry it to another one.') + '</span><span class="btn-row"><button class="btn small ghost" data-do="export">' + tr('Get save code') + '</button><button class="btn small ghost" data-do="import">' + tr('Use a save code') + '</button></span></span></div>'
        + '<div class="row"><span class="ic-wrap">' + ic('refresh') + '</span><span class="txt"><b>' + tr('Reset high scores') + '</b><span class="d">' + tr('Set the best score of every game back to zero. Coins and everything else stay.') + '</span><span class="btn-row"><button class="btn small ghost" data-do="resetscores">' + tr('Reset high scores') + '</button></span></span></div>'
        + '<div class="row"><span class="ic-wrap rose">' + ic('close') + '</span><span class="txt"><b>' + tr('Start over') + '</b><span class="d">' + tr('Say goodbye to {0} and begin again with a new pup.', esc(st.name)) + '</span><span class="btn-row"><button class="btn small ghost" data-do="reset">' + tr('Start over') + '</button></span></span></div>'
        + '<a class="row" href="privacy.html" target="_blank" rel="noopener"><span class="ic-wrap">' + ic('book') + '</span><span class="txt"><b>' + tr('Privacy and credits') + '</b><span class="d">' + tr('What the game stores and sends, and who made the pieces it is built from.') + '</span></span></a>'
        + '<button class="row" data-do="update"><span class="ic-wrap">' + ic('refresh') + '</span><span class="txt"><b>' + tr('Check for updates') + '</b><span class="d">' + tr('Look for a newer version of the game and load it. Your seal stays as she is.') + '</span></span></button>'
        + '<button class="row online-row" data-do="online"><span class="ic-wrap">' + ic('globe') + '</span><span class="txt"><b>' + tr('Online trial') + '</b><span class="d">' + tr('Make or join a room with a friend: both seals on the shore, and a Fish Rain race. Still being tried out.') + '</span></span></button>'
        + (devShown(st) ? '<div class="row" data-do="devtoggle" role="button" tabindex="0"><span class="ic-wrap">' + ic('bolt') + '</span><span class="txt"><b>' + tr('Developer mode') + '</b><span class="d">' + tr('Everything in the shop and the games is free. Your save from before is kept, and Reset brings it back.') + '</span></span><span class="toggle' + (st.dev ? ' on' : '') + '"></span></div>' : '')
        + (st.dev ? '<label class="dev-find"><span class="ic-wrap">' + ic('search') + '</span><input type="search" class="dev-search" placeholder="' + tr('Search developer options') + '" aria-label="' + tr('Search developer options') + '"></label><p class="note dev-none" hidden>' + tr('No developer options match.') + '</p>'
          + '<button class="row dev-row" data-do="devcreate"><span class="ic-wrap">' + ic('seal') + '</span><span class="txt"><b>' + tr('Try the seal creator') + '</b><span class="d">' + tr('Open the new-seal creator with a random kuutti, just to test it. Nothing is saved and your seal stays as she is.') + '</span></span></button>' : '')
        + (st.dev && st.settings.medicine ? '<button class="row dev-row" data-do="devmed"><span class="ic-wrap">' + ic('med') + '</span><span class="txt"><b>' + tr('Medicine is due now') + '</b><span class="d">' + tr('Forget the medicine for today and make it overdue, for testing.') + '</span></span></button>' : '')
        + (st.dev ? '<button class="row dev-row" data-do="online"><span class="ic-wrap">' + ic('globe') + '</span><span class="txt"><b>' + tr('Play online (test)') + '</b><span class="d">' + tr('Make or join a room with a friend: both seals on the shore, and a Fish Rain race. Still a prototype.') + '</span></span></button>' : '')
        + (st.dev ? '<button class="row dev-row" data-do="devenergy"><span class="ic-wrap">' + ic('bolt') + '</span><span class="txt"><b>' + tr('Fill energy') + '</b><span class="d">' + tr('Top up the energy bar whenever you like.') + '</span></span></button>' : '')
        + (st.dev ? '<button class="row dev-row" data-do="devdirty"><span class="ic-wrap">' + ic('drop') + '</span><span class="txt"><b>' + tr('Make her dirty') + '</b><span class="d">' + tr('Drop her cleanliness to zero, to test the sauna.') + '</span></span></button>' : '')
        + (st.dev ? '<button class="row dev-row" data-do="devtut"><span class="ic-wrap">' + ic('refresh') + '</span><span class="txt"><b>' + tr('Reset tutorials') + '</b><span class="d">' + tr('Show the first-time game tutorials again, for testing.') + '</span></span></button>' : '')
        + (st.dev ? [
          ['new', 'New pup now', 'Welcome a pup straight away, with the naming. If she is not a grown seal yet she becomes one first. Two pups is the most.', 'seal'],
          ['visit', 'Call a pup home now', 'Call the first grown-up pup back and skip the hour of waiting, to see the visit and the 100 coins. Dev mode also ignores the 12 hour wait between calls.', 'seal'],
          ['ready', 'Pups are ready to leave', 'Skip the two days of growing. Tap a pup, then Wave goodbye, to see it go.', 'star'],
          ['bye', 'Say farewell now', 'Send the first pup off into the lake straight away, with the wave, the coins and the splash.', 'heart'],
          ['dress', 'New outfits for the pups', 'Give every pup new random things to wear, different from each other.', 'star'],
          ['sick', 'Make the pups poorly', 'The pups go hungry and fall poorly, to see how they look and how they get better.', 'drop'],
          ['heal', 'Feed and cheer the pups', 'Full tummies, full happiness, and no longer poorly.', 'fish'],
          ['train', 'Level up the pups', 'Every pup at home goes up exactly one level, and gets one skill point to spend.', 'star'],
          ['lvl-', 'Pups: one level less', 'Every pup at home goes down a level. If she has spent more points than her new level allows, one is taken back from her biggest skill.', 'star'],
          ['lvlmax', 'Pups: top level', 'Every pup at home goes straight to the top level, with all her points to spend.', 'star'],
          ['refund', 'Pups: take points back', 'Every pup at home gets her spent points back to spend again.', 'star'],
          ['g+', 'Grown pups: one more point', 'Every grown-up pup gets a point in a random skill, up to the most points.', 'star'],
          ['g-', 'Grown pups: one point less', 'Every grown-up pup loses a point from her biggest skill.', 'star'],
          ['spec', 'New points for grown pups', 'Give every grown-up pup 10 points spread at random over the skills, to test the visit bonuses.', 'star'],
        ].map((r) => '<button class="row dev-row" data-do="devpup" data-id="' + r[0] + '"><span class="ic-wrap">' + ic(r[3]) + '</span><span class="txt"><b>' + tr(r[1]) + '</b><span class="d">' + tr(r[2]) + '</span></span></button>').join('') : '')
        + (st.dev ? '<button class="row dev-row" data-do="devreset"><span class="ic-wrap rose">' + ic('close') + '</span><span class="txt"><b>' + tr('Reset to before developer mode') + '</b><span class="d">' + tr('Put back the save from just before developer mode was turned on.') + '</span></span></button>' : '')
        + '</div><p class="note" data-do="devtap">' + tr('Pikku Norppa, version 1. Drawn with three.js. Lettering: DynaPuff and Nunito.') + ' ' + tr('Last updated {0}.', updatedText()) + ' ' + tr('Weather data by Open-Meteo.com.').replace('Open-Meteo.com', '<a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo.com</a>') + '</p>';
    },
  };

  function onSheetClick(e) {
    const b = e.target.closest('[data-do]'); if (!b) return;
    const act = b.dataset.do, id = b.dataset.id, game = G();
    if (act === 'shopfront') {
      PN.Audio.play('tap');
      UI.shopId = id || null;
      UI.renderSheet();
      $('sheetBody').scrollTop = 0;
    }
    else if (act === 'clinic') PN.Clinic.open();
    else if (act === 'feed') game.feed(id);
    else if (act === 'buy') game.buy(id);
    else if (act === 'wear') game.wear(id);
    else if (act === 'place') game.place(id);
    else if (act === 'info') UI.itemInfo(id);
    else if (act === 'jump') { const el = document.getElementById(id); if (el) { PN.Audio.play('tap'); const box = $('sheetBody'); box.scrollTo({ top: el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - 4, behavior: 'smooth' }); } }
    else if (act === 'goto') UI.openSheet(id);
    else if (act === 'borrow') game.borrow();
    else if (act === 'game') game.startGame(id);
    else if (act === 'unlock') game.unlockGame(id);
    else if (act === 'skip') game.skipGame(id);
    else if (act === 'dive') game.dive();
    else if (act === 'instrument') game.setSetting('instrument', id);
    else if (act === 'toggle') game.setSetting(id, !game.state.settings[id]);
    else if (act === 'sky') game.setSetting('sky', id);
    else if (act === 'lang') game.setSetting('lang', id);
    else if (act === 'rename') game.rename();
    else if (act === 'update') game.checkUpdate();
    else if (act === 'devtap') game.devTap();
    else if (act === 'devtoggle') game.devToggle();
    else if (act === 'devreset') game.devReset();
    else if (act === 'online') { UI.closeSheet(); if (PN.Online) PN.Online.open(); }
    else if (act === 'devenergy') game.devEnergy();
    else if (act === 'tiredcard') { UI.closeSheet(); game.tiredCard('sheet'); }
    else if (act === 'devdirty') game.devDirty();
    else if (act === 'devtut') game.devTutorials();
    else if (act === 'devcreate') PN.Clinic.create({ mock: true });
    else if (act === 'devmed') game.devMed();
    else if (act === 'devpup') game.devPup(id);
    else if (act === 'callpup') game.callPup(+id);
    else if (act === 'pupinfo') game.pupInfo(+id);
    else if (act === 'med') { UI.closeSheet(); game.openMed(); }
    else if (act === 'export') game.exportSave();
    else if (act === 'import') game.importSave();
    else if (act === 'reset') game.resetGame();
    else if (act === 'resetscores') game.resetScores();
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
  UI.modalDelay = 500;          // ms after a pop-up opens in which its buttons ignore taps, so the second tap of a double tap cannot choose Close
  UI.modal = function (o) {
    const run = () => new Promise((resolve) => {
      const m = $('modal'), card = $('modalCard');
      card.classList.toggle('game-result', o.layout === 'game-result'); card.classList.toggle('spend', o.layout === 'spend'); card.classList.toggle('energy', o.layout === 'energy');
      m.classList.toggle('over', !!o.over);   // over: true lifts it above the first screen, which comes later in the page
      card.innerHTML = (o.art ? '<img class="art" src="' + o.art + '" alt="">' : '') + '<h3>' + o.title + '</h3>' + (o.html || '')
        + '<div class="actions">' + (o.actions || [{ label: 'OK', value: 1 }]).map((a, i) => '<button class="btn ' + (a.cls || (i ? 'ghost' : '')) + '" data-i="' + i + '">' + a.label + '</button>').join('') + '</div>';
      m.hidden = false; UI.modalOpen = true;
      const openedAt = performance.now();
      requestAnimationFrame(() => requestAnimationFrame(() => m.classList.add('open')));
      if (o.onOpen) o.onOpen(card);
      const done = (v) => {
        m.removeEventListener('click', onClick);
        m.classList.remove('open');
        setTimeout(() => { m.hidden = true; UI.modalOpen = false; resolve(v); }, 220);
      };
      function onClick(e) {
        const b = e.target.closest('.actions .btn');
        if (!b && !o.tapAway) return;
        if (performance.now() - openedAt < UI.modalDelay) return;
        if (!b) { done(o.tapAway); return; }   // tapAway: a tap anywhere else closes the card with this value
        PN.Audio.play('tap');
        const a = (o.actions || [{ value: 1 }])[+b.dataset.i];
        done(o.result ? o.result(a.value, card) : a.value);
      }
      m.addEventListener('click', onClick);
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
      go.hidden = false; $('titleFoot').hidden = !isNew; $('titleLang').hidden = false; $('titleUpdate').hidden = false;
      $('titleSub').removeAttribute('data-l');
      UI.title.label();
      go.addEventListener('click', () => { PN.Audio.unlock(); PN.Audio.play('pop'); onGo(); }, { once: true });
      $('titleUpdate').addEventListener('click', () => G().checkUpdate());
      const inst = $('titleInstall');          // Add to Home Screen: there until the game is installed
      if (PN.Install && inst) {
        const sync = () => { inst.hidden = !PN.Install.visible(); };
        sync(); PN.Install.onChange(sync);
        inst.addEventListener('click', () => { PN.Audio.unlock(); PN.Audio.play('tap'); PN.Install.start(); });
      }
      $('titleLang').addEventListener('click', () => { PN.Audio.unlock(); PN.Audio.play('tap'); G().setLang(PN.lang === 'fi' ? 'en' : 'fi'); });
    },
    label() {
      if (!titleInfo) return;
      $('titleSub').textContent = titleInfo.isNew ? tr('A little seal is waiting under the snow.') : (titleInfo.note ? titleInfo.note() : '');
      $('titleGo').textContent = tr(titleInfo.isNew ? 'Meet your seal' : 'title|Play');
      if (!$('titleUpdate').disabled) $('titleUpdate').textContent = tr('Check for updates');
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
  /* Pup skills: what a skill and a grown pup are called, and what a grown pup does for the family when she visits. */
  UI.skillName = (k) => tr(PN.SKILLS[k] ? PN.SKILLS[k].name : 'All-rounder');
  UI.specName = (k) => tr(PN.SKILLS[k] ? PN.SKILLS[k].spec : 'All-rounder');
  /* What a grown pup's points do for the family while she visits. */
  UI.perkText = (f, name) => {
    const pts = (f && f.pts) || {}, parts = [];
    PN.SKILL_ORDER.forEach((k) => {
      const n = pts[k] || 0;
      if (!n) return;
      if (k === 'care') return;
      const games = PN.SKILLS[k].games.map((g) => tr(PN.GAMES[g].title));
      parts.push(tr('+{0}% coins in {1}', n * S.T.pointBonus, games.length > 1 ? tr('{0} and {1}', games.slice(0, -1).join(', '), games[games.length - 1]) : games[0]));
      if (k === 'water') parts.push(tr('on dives +{0}% coins and a {1}% smaller chance of coming up angry', n * S.T.pointBonus, n * S.T.diveSulkCut));
    });
    const care = pts.care ? ' ' + tr('Care: happiness drops {0}% slower while you are away (only the best Care pup in the family counts).', pts.care * S.T.carePoint) : '';
    return parts.length ? tr('When {0} visits: {1}.', name, parts.join('; ')) + care : care ? care.trim() : tr('{0} has no skill points, so she gives no visiting bonus.', name);
  };
  /* A pup's points as one line: Swimming 3 · Sports 0 · Brains 1 · Care 6. */
  /* Radar chart of a pup's points: one spoke per skill, rings at 2, 4 and 6 points, the most a skill can have. */
  UI.radar = (pts, size, mini) => {
    const W = size || 220, c = W / 2, R = mini ? W / 2 - 6 : W / 2 - 52, keys = PN.SKILL_ORDER, max = S.T.pupSkillMax;
    const at = (i, v) => { const a = -Math.PI / 2 + i * 2 * Math.PI / keys.length; return [c + Math.cos(a) * R * v / max, c + Math.sin(a) * R * v / max]; };
    const poly = (v) => keys.map((k, i) => at(i, typeof v === 'function' ? v(k) : v).map((n) => n.toFixed(1)).join(',')).join(' ');
    let g = [2, 4, 6].map((r) => '<polygon points="' + poly(r) + '" fill="none" stroke="var(--ice)" stroke-width="' + (r === max ? 2 : 1) + '"/>').join('');
    g += keys.map((k, i) => { const e = at(i, max); return '<line x1="' + c + '" y1="' + c + '" x2="' + e[0].toFixed(1) + '" y2="' + e[1].toFixed(1) + '" stroke="var(--ice)"/>'; }).join('');
    g += '<polygon points="' + poly((k) => (pts && pts[k]) || 0) + '" fill="var(--berry)" fill-opacity=".28" stroke="var(--berry)" stroke-width="2.5" stroke-linejoin="round"/>';
    g += keys.map((k, i) => { const p = at(i, (pts && pts[k]) || 0); return '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="3.5" fill="var(--berry)"/>'; }).join('');
    if (!mini) g += keys.map((k, i) => { const l = at(i, max * 1.34), n = (pts && pts[k]) || 0; return '<text x="' + l[0].toFixed(1) + '" y="' + l[1].toFixed(1) + '" text-anchor="middle" dominant-baseline="middle" font-size="12" font-weight="700" fill="var(--ink)">' + esc(UI.skillName(k)) + ' ' + n + '</text>'; }).join('');
    const label = esc(UI.pointsLine(pts));
    return '<svg class="radar' + (mini ? ' mini' : '') + '" viewBox="0 0 ' + W + ' ' + W + '" width="' + W + '" height="' + W + '" role="img" aria-label="' + label + '">' + g + '</svg>';
  };
  UI.pointsLine = (pts) => PN.SKILL_ORDER.map((k) => UI.skillName(k) + ' ' + ((pts && pts[k]) || 0)).join(' · ');
  /* What a pup is heading for, or a grown pup is: her one best skill, All-rounder for a tie, or nothing yet. */
  UI.headingFor = (p) => (S.pupSpent(p) || (p && p.fate === 'grown' && p.pts) ? UI.specLabel(p) : tr('no skill yet'));
  /* What a pup is good at, from her points: one skill, two that tie ("Swimmer and Sporty"), or All-rounder for three or more. */
  UI.specLabel = (o) => { const top = S.topSkills(o && o.pts); return top.length === 1 ? UI.specName(top[0]) : top.length === 2 ? tr('{0} and {1}', UI.specName(top[0]), UI.specName(top[1])) : tr('All-rounder'); };
})(window.PN = window.PN || {});

