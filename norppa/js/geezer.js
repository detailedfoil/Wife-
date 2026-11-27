/* Pikku Norppa: "geezer" home prototype (developer mode only, 27 Nov 2026).
   A look-only test of a different main character: a big British bloke in his
   lounge instead of the seal on the shore. It lays its own home screen over the
   normal one; nothing in the save, the sim, the games or the shop changes.
   Turn it on in Settings (developer mode) > Geezer home. The art is in geezer-art.js. */
(function (PN) {
  'use strict';

  const KEY = 'pikkunorppa.geezer';
  const tr = (s, a) => PN.L(s, a);

  Object.assign(PN.LANG.FI, {
    'Geezer home (prototype)': 'Äijäkoti (prototyyppi)',
    'Swap the seal and the shore for a big bloke in his lounge, to see how it looks. Only the look changes.': 'Vaihda norppa ja ranta isoon äijään olohuoneessaan, jotta näet miltä se näyttää. Vain ulkoasu muuttuu.',
    'Big Dave': 'Iso Dave',
    'Proper geezer': 'Aito äijä',
    'Prototype. Back to the seal': 'Prototyyppi. Takaisin norppaan',
    'Belly': 'Maha', 'Mood': 'Fiilis', 'Oomph': 'Puhti', 'Fresh': 'Raikas',
    'Scran': 'Safka', 'Telly': 'Telkkari', 'Bath': 'Kylpy', 'Corner shop': 'Kioski',
    'What are you having?': 'Mitä otat?',
    'Bacon butty': 'Pekonisämpylä', 'Pie and mash': 'Piiras ja muusi', 'Full English': 'Englantilainen aamiainen',
    'Chippy tea': 'Fish and chips', 'Cuppa': 'Kuppi teetä', 'Gaffer fizzy pop': 'Gaffer-limu',
    'Comfy slippers': 'Mukavat tohvelit', 'Bigger telly': 'Isompi telkkari', 'Footy shirt': 'Futispaita',
    'Air fryer': 'Airfryer', 'Lava lamp': 'Laavalamppu', 'Dartboard': 'Tikkataulu',
    'Just a look for now: nothing to buy yet.': 'Vain esikatselu: mitään ei voi vielä ostaa.',
    'Alright, mate?': 'Moro, kaveri!',
    'Pass us the remote.': 'Ojenna se kaukosäädin.',
    'I\'m not lazy, I\'m on energy saving mode.': 'En ole laiska, olen virransäästötilassa.',
    'Kettle on, is it?': 'Laitetaanko vesipannu päälle?',
    'Mind the pizza box.': 'Varo pizzalaatikkoa.',
    'Get in! What a goal!': 'Jes! Mikä maali!',
    'Oi, ref! You need glasses!': 'Hei tuomari! Hanki lasit!',
    'Just one more episode.': 'Vielä yksi jakso.',
    'Snooker\'s on. Shh.': 'Snookeria tulee. Hys.',
    'A bath? I had one last month.': 'Kylpy? Kävin viime kuussa.',
    'Go on then. Lots of bubbles, mind.': 'No okei. Paljon kuplia sitten.',
    'Lovely jubbly!': 'Herkkua!',
    'That hits the spot.': 'Tätä mä tarvitsin.',
    'Proper scran, that.': 'Kunnon safkaa.',
    'Close': 'Sulje',
  });

  let root = null, svgBox = null, bubbleT = 0, tray = null;
  const on = () => { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } };
  const $ = (id) => document.getElementById(id);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  const FOOD = [['Bacon butty', '🥓'], ['Pie and mash', '🥧'], ['Full English', '🍳'], ['Chippy tea', '🐟'], ['Cuppa', '☕'], ['Gaffer fizzy pop', '🥤']];
  const SHOP = [['Comfy slippers', '🥿', 80], ['Bigger telly', '📺', 900], ['Footy shirt', '👕', 150], ['Air fryer', '🍟', 300], ['Lava lamp', '🪔', 120], ['Dartboard', '🎯', 200]];
  const IDLE = ['Alright, mate?', 'Pass us the remote.', 'I\'m not lazy, I\'m on energy saving mode.', 'Kettle on, is it?', 'Mind the pizza box.'];
  const TELLY = ['Get in! What a goal!', 'Oi, ref! You need glasses!', 'Just one more episode.', 'Snooker\'s on. Shh.'];
  const YUM = ['Lovely jubbly!', 'That hits the spot.', 'Proper scran, that.'];

  function build() {
    root = document.createElement('div');
    root.className = 'gz';
    root.hidden = true;
    root.innerHTML = '<div class="gz-scene" id="gzScene">' + PN.GeezerArt.svg() + '</div>'
      + '<div class="gz-top"><div class="gz-plate"><b data-l="Big Dave">' + tr('Big Dave') + '</b><span data-l="Proper geezer">' + tr('Proper geezer') + '</span></div>'
      + '<div class="gz-top-r"><div class="gz-coins"><i></i><b id="gzCoins">0</b></div><button class="gz-round" id="gzSettings" aria-label="Settings" data-la="Settings">⚙</button></div></div>'
      + '<div class="gz-meters">' + [['food', 'Belly', '🥧'], ['joy', 'Mood', '🙂'], ['energy', 'Oomph', '⚡'], ['clean', 'Fresh', '🧼']]
        .map((m) => '<div class="gz-meter" data-stat="' + m[0] + '"><span class="gz-mi">' + m[2] + '</span><span class="gz-ml" data-l="' + m[1] + '">' + tr(m[1]) + '</span><span class="gz-bar"><i></i></span></div>').join('') + '</div>'
      + '<button class="gz-back" id="gzBack" data-l="Prototype. Back to the seal">' + tr('Prototype. Back to the seal') + '</button>'
      + '<div class="gz-bubble" id="gzBubble" hidden></div>'
      + '<div class="gz-tray" id="gzTray" hidden></div>'
      + '<nav class="gz-dock">' + [['feed', 'Scran', '🍔'], ['telly', 'Telly', '📺'], ['bath', 'Bath', '🛁'], ['shop', 'Corner shop', '🏪']]
        .map((d) => '<button data-gz="' + d[0] + '"><span class="gz-di">' + d[2] + '</span><span data-l="' + d[1] + '">' + tr(d[1]) + '</span></button>').join('') + '</nav>';
    const hud = $('hud');
    hud.parentNode.insertBefore(root, hud.nextSibling);
    svgBox = root.querySelector('.gz-svg');
    tray = $('gzTray');
    root.addEventListener('click', onClick);
    window.addEventListener('resize', frame);
    frame();
  }

  /* Keep the bloke and his chair in view: tall screens see the middle of the room,
     wide screens see more of it from side to side. */
  function frame() {
    if (!svgBox) return;
    const w = innerWidth, h = innerHeight;
    svgBox.setAttribute('viewBox', h >= w ? '150 -200 720 1500' : '-150 -170 1320 1290');
  }

  function say(text) {
    const b = $('gzBubble');
    b.textContent = tr(text); b.hidden = false;
    b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
    clearTimeout(bubbleT); bubbleT = setTimeout(() => { b.hidden = true; }, 2600);
  }
  function act(cls, ms) {
    root.classList.add(cls);
    setTimeout(() => root.classList.remove(cls), ms);
  }
  function tap() { if (PN.Audio) PN.Audio.play('tap'); }

  function openTray(kind) {
    const isShop = kind === 'shop';
    const list = isShop ? SHOP : FOOD;
    tray.innerHTML = '<div class="gz-tray-h"><b>' + tr(isShop ? 'Corner shop' : 'What are you having?') + '</b><button data-gz="close" aria-label="' + tr('Close') + '">✕</button></div>'
      + (isShop ? '<p class="gz-note">' + tr('Just a look for now: nothing to buy yet.') + '</p>' : '')
      + '<div class="gz-grid">' + list.map((it, i) => '<button data-gz="' + (isShop ? 'buy' : 'eat') + '" data-i="' + i + '"><span class="gz-ti">' + it[1] + '</span><span>' + tr(it[0]) + '</span>' + (isShop ? '<small>' + it[2] + '</small>' : '') + '</button>').join('') + '</div>';
    tray.hidden = false;
  }

  function onClick(e) {
    const b = e.target.closest('[data-gz], #gzSettings, #gzBack, .gz-man');
    if (!b) { if (!tray.hidden && !e.target.closest('.gz-tray')) tray.hidden = true; return; }
    if (b.id === 'gzSettings') { tap(); PN.UI.openSheet('settings'); return; }
    if (b.id === 'gzBack') { tap(); set(false); return; }
    if (b.classList.contains('gz-man')) { tap(); say(pick(IDLE)); act('nod', 700); return; }
    const k = b.dataset.gz;
    tap();
    if (k === 'feed' || k === 'shop') openTray(k);
    else if (k === 'close') tray.hidden = true;
    else if (k === 'eat') { tray.hidden = true; act('sip', 1300); setTimeout(() => say(pick(YUM)), 600); }
    else if (k === 'buy') say('Just a look for now: nothing to buy yet.');
    else if (k === 'telly') { tray.hidden = true; act('telly', 2400); say(pick(TELLY)); }
    else if (k === 'bath') { tray.hidden = true; say(Math.random() < 0.7 ? 'A bath? I had one last month.' : 'Go on then. Lots of bubbles, mind.'); act('nod', 700); }
  }

  /* Show it only on the home screen, only in developer mode. */
  function tick() {
    const G = PN.Game;
    if (!G || !G.state) return;
    const show = on() && !!G.state.dev && !$('hud').hidden && $('gamehud').hidden;
    if (show && !root) build();
    if (!root) return;
    if (root.hidden === show) { root.hidden = !show; if (show) PN.setLang(PN.lang); }
    if (!show) return;
    $('gzCoins').textContent = Math.floor(G.state.coins).toLocaleString();
    root.querySelectorAll('.gz-meter').forEach((m) => {
      const v = Math.max(0, Math.min(100, G.state.stats[m.dataset.stat] || 0));
      m.querySelector('i').style.width = v + '%';
      m.classList.toggle('low', v < 25);
    });
  }

  function set(v) {
    try { if (v) localStorage.setItem(KEY, '1'); else localStorage.removeItem(KEY); } catch (e) { /* private browsing: stays as it was */ }
    tick();
  }

  PN.Geezer = { on, set, toggle() { set(!on()); if (PN.UI && PN.UI.sheetName) PN.UI.renderSheet(); } };
  setInterval(tick, 500);
})(window.PN = window.PN || {});
