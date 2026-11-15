/* Pikku Norppa: Coffee Memory. The rules come first (no drawing there, only the order and the checking, so they can be tested on
   their own); the 3D cafe that plays them is the second half of this file, so the two can never be out of step with each other.
   Customers keep coming for as long as every drink is right. An order is shown on a receipt, then turned over, and the drink is built
   step by step from memory. The steps always come in the same order: size, base, temperature, milk, syrup, second syrup, extras, name.
   Every second drink served adds one more thing to remember: the first order is size and base, then temperature, milk and syrup come in, then
   one extra, then the customer's name to write on the cup (the seventh thing, so before the second extra), then the other extras up to
   all four, and last a second syrup (eleven things, and there it stays). The first wrong choice ends the game; the score is the drinks served. There is no clock. */
(function (PN) {
  'use strict';

  /* ================= the rules ================= */
  const SYRUPS = [['vanilla', 'Vanilla'], ['caramel', 'Caramel'], ['hazelnut', 'Hazelnut'], ['mint', 'Mint']];
  /* Every step and what can be chosen at it: [id, English label]. Extras are the one step where several are chosen (it moves on once they are all in); the name is typed. */
  const STEPS = [
    { id: 'size', title: 'Size', ask: 'Choose the cup', opts: [['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']] },
    { id: 'base', title: 'Base', ask: 'Choose the base', opts: [['dark', 'Dark roast'], ['light', 'Light roast'], ['decaf', 'Decaf'], ['matcha', 'Matcha']] },
    { id: 'temp', title: 'Temperature', ask: 'Hot or iced?', opts: [['hot', 'Hot'], ['iced', 'Iced']] },
    { id: 'milk', title: 'Milk', ask: 'Choose the milk', opts: [['black', 'No milk'], ['milk', 'Milk'], ['oat', 'Oat'], ['coconut', 'Coconut'], ['almond', 'Almond']] },
    { id: 'syrup', title: 'Syrup', ask: 'Choose a syrup', opts: [['none', 'No syrup']].concat(SYRUPS) },
    { id: 'syrup2', title: 'Second syrup', ask: 'Choose the second syrup', opts: SYRUPS },
    { id: 'extras', title: 'Extras', ask: 'Add the extras', multi: true, opts: [['shot', 'Extra shot'], ['cinnamon', 'Cinnamon'], ['sprinkles', 'Choc sprinkles'], ['cream', 'Whipped cream']] },
    { id: 'name', title: 'Name', ask: 'Write the name on the cup', text: true, opts: [] },
  ];
  const byId = {}; STEPS.forEach((s) => { byId[s.id] = s; });
  const FIRST = 2, SINGLES = 5, MAX_EXTRAS = byId.extras.opts.length, MAX_ITEMS = SINGLES + MAX_EXTRAS + 2;
  /* Finnish names for the cup (used when the game is in Finnish). None has a letter with dots or a ring on it, so they can be typed on any keyboard. */
  const NAMES = ['Aino', 'Eero', 'Onni', 'Otso', 'Ilmari', 'Tapio', 'Veikko', 'Sanni', 'Kaisa', 'Mikko', 'Jussi', 'Tuuli', 'Helmi', 'Ilona',
    'Venla', 'Aatu', 'Eino', 'Oiva', 'Toivo', 'Kerttu', 'Sini', 'Satu', 'Pekka', 'Matti', 'Liisa', 'Anni', 'Elsa', 'Hilla', 'Lumi', 'Pyry',
    'Taika', 'Kuura', 'Aapo', 'Niilo', 'Vilho', 'Lauri', 'Senja', 'Aava', 'Enni', 'Seela', 'Stephen', 'Alex'];
  /* The same for English: an English game gets English names. */
  const NAMES_EN = ['Alice', 'Ben', 'Chloe', 'Daniel', 'Emma', 'Finn', 'Grace', 'Harry', 'Isla', 'Jack', 'Kate', 'Liam', 'Mia', 'Noah', 'Olivia', 'Oscar',
    'Poppy', 'Ruby', 'Sam', 'Tom', 'Zoe', 'Ella', 'Leo', 'Lily', 'Max', 'Nina', 'Owen', 'Rosie', 'Sophie', 'Theo', 'Amy', 'Jake', 'Maya', 'Ryan',
    'Hannah', 'George', 'Freya', 'Joe', 'Lucy', 'Adam', 'Stephen', 'Alex'];
  const namesNow = () => (PN.lang === 'fi' ? NAMES : NAMES_EN);
  /* Who comes in for a coffee: animals of the Finnish woods. */
  const ANIMALS = ['reindeer', 'bear', 'fox', 'hare', 'owl', 'moose', 'lynx', 'squirrel'];

  const label = (stepId, optId) => { const o = byId[stepId].opts.find((x) => x[0] === optId); return o ? o[1] : optId; };
  /* How many things the next customer's order has, given the drinks served so far: two at the start, one more with every second drink, eleven at most. */
  const itemCount = (served) => Math.min(MAX_ITEMS, FIRST + Math.floor(served / 2));
  /* The name comes in as the seventh thing, so before the second extra; the extras carry on from there (one for the sixth thing, one more
     for the eighth, ninth and tenth), and the second syrup is the eleventh. */
  const NAME_AT = SINGLES + 2;
  const extraCount = (served) => { const n = itemCount(served); return n <= SINGLES ? 0 : Math.min(MAX_EXTRAS, n - SINGLES - (n >= NAME_AT ? 1 : 0)); };
  const hasSecond = (served) => itemCount(served) >= MAX_ITEMS;
  const hasName = (served) => itemCount(served) >= NAME_AT;
  /* The steps of that order, in the order they are made. */
  function stepIds(served) {
    const n = itemCount(served), ids = STEPS.slice(0, Math.min(n, SINGLES)).map((s) => s.id);
    if (hasSecond(served)) ids.push('syrup2');
    if (n > SINGLES) ids.push('extras');
    if (hasName(served)) ids.push('name');
    return ids;
  }
  const stepCount = (served) => stepIds(served).length;

  function pickOne(list, rng) { return list[Math.floor(rng() * list.length) % list.length]; }
  function pickSome(list, n, rng) {
    const pool = list.slice(), out = [];
    while (out.length < n && pool.length) out.push(pool.splice(Math.floor(rng() * pool.length) % pool.length, 1)[0]);
    return out;
  }
  const ids = (stepId) => byId[stepId].opts.map((o) => o[0]);

  /* A fresh order for the next customer, given the drinks served so far (and the order before, so the same animal or name does not come
     twice running). Returns { steps, picks: { stepId: optionId }, extras: [optionIds], name, customer, items }. */
  function makeOrder(served, rng, last) {
    rng = rng || Math.random;
    const steps = stepIds(served), picks = {}, two = steps.indexOf('syrup2') >= 0;
    let extras = [], name = null;
    steps.forEach((id) => {
      if (id === 'extras') { const got = pickSome(ids('extras'), extraCount(served), rng); extras = ids('extras').filter((x) => got.indexOf(x) >= 0); }
      else if (id === 'name') name = pickOne(namesNow().filter((n) => !last || n !== last.name), rng);
      else if (id === 'syrup') picks.syrup = pickOne(two ? ids('syrup2') : ids('syrup'), rng);            // an order for two syrups always has a first one
      else if (id === 'syrup2') picks.syrup2 = pickOne(ids('syrup2').filter((x) => x !== picks.syrup), rng);   // and the second is a different one
      else picks[id] = pickOne(ids(id), rng);
    });
    const customer = pickOne(ANIMALS.filter((a) => !last || a !== last.customer), rng);
    return { steps, picks, extras, name, customer, items: itemCount(served) };
  }

  /* The order as rows for the receipt: [{ step, title, values: [English labels] }]. */
  function lines(order) {
    return order.steps.map((id) => ({ step: id, title: byId[id].title,
      values: id === 'extras' ? order.extras.map((x) => label(id, x)) : id === 'name' ? [order.name] : [label(id, order.picks[id])] }));
  }
  /* A typed name counts whatever its capitals and however many spaces are around it. */
  const tidy = (s) => String(s == null ? '' : s).trim().replace(/\s+/g, ' ').toLowerCase();

  /* One game: customers in turn for as long as every drink is right. The state it is in: 'order' (the receipt is being read), 'build' (making
     the drink), 'served' (that customer is happy), 'over' (a wrong choice: the game has ended). */
  function run(rng) {
    rng = rng || Math.random;
    const r = {
      served: 0, order: null, step: 0, got: {}, extras: [], state: 'order', fail: null,
      /* Deal the next customer's order. False once the game is over. */
      next() {
        if (r.state === 'over') return false;
        r.order = makeOrder(r.served, rng, r.order); r.step = 0; r.got = {}; r.extras = []; r.fail = null; r.state = 'order';
        return true;
      },
      finished() { return r.state === 'over'; },
      /* The receipt has been read: turn it over and begin the drink. */
      begin() { if (r.state === 'order') r.state = 'build'; },
      /* The step being made now, or null when the drink is finished. */
      current() { return r.state === 'build' ? byId[r.order.steps[r.step]] : null; },
      /* Choose an option on a one-choice step. Returns 'right' (go on to the next step), 'served' (that was the last step) or 'wrong'. */
      pick(optId) {
        const st = r.current();
        if (!st || st.multi || st.text) return null;
        if (optId !== r.order.picks[st.id]) return r.slip(st.id, [optId]);
        r.got[st.id] = optId;
        return r.done();
      },
      /* On the extras step, add an extra. One that was not ordered is a wrong drink; once every ordered one is in, the step is done by itself.
         Returns 'more' (there are extras still to add), 'right', 'served' or 'wrong'. */
      add(optId) {
        const st = r.current();
        if (!st || !st.multi) return null;
        if (r.order.extras.indexOf(optId) < 0) return r.slip(st.id, r.extras.concat(optId));
        if (r.extras.indexOf(optId) < 0) r.extras.push(optId);
        if (r.extras.length < r.order.extras.length) return 'more';
        r.got.extras = ids('extras').filter((x) => r.extras.indexOf(x) >= 0);
        return r.done();
      },
      /* The name written on the cup. */
      write(text) {
        const st = r.current();
        if (!st || !st.text) return null;
        if (tidy(text) !== tidy(r.order.name)) return r.slip(st.id, [String(text).trim()]);
        r.got.name = r.order.name;
        return r.done();
      },
      done() { r.step++; if (r.step < r.order.steps.length) return 'right'; r.served++; r.state = 'served'; return 'served'; },
      /* A wrong choice ends the game. What was wanted and what was chosen are kept to show. */
      slip(stepId, chose) {
        r.fail = { step: stepId, want: stepId === 'extras' ? r.order.extras.slice() : stepId === 'name' ? [r.order.name] : [r.order.picks[stepId]], chose: chose.slice() };
        r.state = 'over';
        return 'wrong';
      },
    };
    return r;
  }

  PN.Coffee = { V: 2, STEPS, NAMES, NAMES_EN, ANIMALS, MAX_ITEMS, byId, label, itemCount, stepCount, stepIds, extraCount, makeOrder, lines, tidy, run };

  /* ================= the 3D cafe ================= */
  /* Everything below draws. It is skipped where there is nothing to draw on (the tests run the rules alone). The game is seen through the
     seal's own eyes from behind the counter of a log cafe: a customer comes in, their receipt is read and turned face down, and the things
     to choose from slide along the counter from the right, one step at a time, and away to the left. */
  if (typeof THREE === 'undefined' || typeof document === 'undefined') return;

  function make() {
    const T = THREE, U = PN.U, W = PN.World, A = PN.Audio, tr = PN.L, K = PN.Games.kit;
    const PI = Math.PI, TAU = PI * 2, RAD = PI / 180, mat = U.mat;
    const INK = '#3a2414', PAPER = '#fff8e6', FONT = 'DynaPuff, "Arial Rounded MT Bold", "Trebuchet MS", sans-serif';
    const S = 1.6;            // the things on the counter are drawn this much bigger than life, so their labels can be read on a phone
    const RISE = 0.3;         // the height of the step at the back of the counter, where a second row stands on a tall screen
    const dark = mat(0x2b2f36, { roughness: 0.5 }), steel = mat(0xd5dbe0, { metalness: 0.6, roughness: 0.3 }), white = mat(0xffffff, { roughness: 0.6 });
    const GLASS = mat(0xdff1ff, { transparent: true, opacity: 0.34, roughness: 0.08, depthWrite: false });

    /* ---------- painted labels ---------- */
    /* Every label is painted on a canvas with the words of the language in use, and painted again when the language changes. */
    const painted = [];
    function paintTex(w, h, draw) { const t = U.tex(w, h, draw); painted.push({ t, w, h, draw }); return t; }
    function repaint(p) { const g = p.t.image.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, p.w, p.h); p.draw(g, p.w, p.h); p.t.needsUpdate = true; }
    function round(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
    /* Where a long single word may be broken over two lines on a label (the number of letters on the first line). */
    const BREAK = { 'Hasselpähkinä': 6, 'Keskikokoinen': 5, 'Kofeiiniton': 8, 'Kermavaahto': 5, 'Suklaarouhe': 6, 'Lisäshotti': 4, 'Karamelli': 0, 'Ei siirappia': 0 };
    /* Words centred at a point, as big as fit the width: on one line, or on two when that lets them be bigger. */
    function words(g, text, cx, cy, maxW, size, color, weight) {
      g.fillStyle = color || INK; g.textAlign = 'center'; g.textBaseline = 'middle';
      const font = (s) => { g.font = (weight || '600') + ' ' + s + 'px ' + FONT; };
      const most = (t) => { let s = size; font(s); while (g.measureText(t).width > maxW && s > 8) { s -= 2; font(s); } return s; };
      const one = most(text), cut = text.indexOf(' ') > 0 ? text.indexOf(' ') : BREAK[text] || 0;
      if (cut > 0 && one < size * 0.8) {
        const a = text.slice(0, cut) + (text[cut] === ' ' ? '' : '-'), b = text.slice(cut).trim(), s = Math.min(most(a), most(b), size);
        if (s > one * 1.15) { font(s); g.fillText(a, cx, cy - s * 0.56); g.fillText(b, cx, cy + s * 0.56); return; }
      }
      font(one); g.fillText(text, cx, cy);
    }
    /* The little pictures on the labels, drawn round a point. */
    function pic(g, kind, x, y, r, bg) {
      g.save(); g.translate(x, y); g.lineCap = 'round'; g.lineJoin = 'round';
      const fill = (c) => { g.fillStyle = c; g.fill(); }, line = (c, w) => { g.strokeStyle = c; g.lineWidth = w; g.stroke(); };
      const oval = (cx, cy, rx, ry, rot) => { g.beginPath(); g.ellipse(cx, cy, rx, ry, rot || 0, 0, TAU); };
      const leaf = (c, c2) => { g.beginPath(); g.moveTo(0, -r); g.quadraticCurveTo(r * 0.95, 0, 0, r); g.quadraticCurveTo(-r * 0.95, 0, 0, -r); fill(c); g.beginPath(); g.moveTo(0, -r * 0.7); g.lineTo(0, r * 0.8); line(c2, r * 0.1); };
      if (kind === 'bean' || kind === 'beanLight') {
        g.rotate(-0.5); oval(0, 0, r * 0.66, r); fill(kind === 'bean' ? '#4a2812' : '#b07a42');
        g.beginPath(); g.moveTo(0, -r * 0.8); g.bezierCurveTo(r * 0.4, -r * 0.3, -r * 0.4, r * 0.3, 0, r * 0.8); line(kind === 'bean' ? '#1f0f06' : '#6e4520', r * 0.14);
      } else if (kind === 'moon') {
        g.beginPath(); g.arc(0, 0, r, 0, TAU); fill('#ffd45c'); g.beginPath(); g.arc(r * 0.42, -r * 0.25, r * 0.82, 0, TAU); fill(bg || PAPER);
      } else if (kind === 'leaf') { g.rotate(0.6); leaf('#5aa84a', '#2f6a30'); }
      else if (kind === 'mint') { g.save(); g.rotate(-0.55); g.translate(-r * 0.25, 0); leaf('#4fc08a', '#2a8a5c'); g.restore(); g.rotate(0.6); g.translate(r * 0.25, 0); leaf('#6ad3a0', '#2a8a5c'); }
      else if (kind === 'cow') {
        oval(-r * 0.78, -r * 0.45, r * 0.32, r * 0.2, -0.5); fill('#3a2414'); oval(r * 0.78, -r * 0.45, r * 0.32, r * 0.2, 0.5); fill('#3a2414');
        oval(0, 0, r * 0.75, r * 0.9); fill('#ffffff'); line('#3a2414', r * 0.1);
        oval(-r * 0.36, -r * 0.42, r * 0.3, r * 0.26, 0.4); fill('#3a2414');
        oval(0, r * 0.45, r * 0.52, r * 0.36); fill('#f7b8c4'); line('#3a2414', r * 0.08);
        oval(-r * 0.3, -r * 0.12, r * 0.08, r * 0.1); fill('#17110d'); oval(r * 0.3, -r * 0.12, r * 0.08, r * 0.1); fill('#17110d');
        oval(-r * 0.18, r * 0.45, r * 0.06, r * 0.08); fill('#b0707e'); oval(r * 0.18, r * 0.45, r * 0.06, r * 0.08); fill('#b0707e');
      } else if (kind === 'oat') {
        g.rotate(0.25); g.beginPath(); g.moveTo(0, r); g.lineTo(0, -r * 0.5); line('#b58a3c', r * 0.1);
        for (let i = 0; i < 6; i++) { const s = i % 2 ? 1 : -1, yy = r * 0.5 - i * r * 0.28; oval(s * r * 0.26, yy, r * 0.17, r * 0.3, s * 0.6); fill('#e2b34f'); }
        oval(0, -r * 0.82, r * 0.17, r * 0.3); fill('#e2b34f');
      } else if (kind === 'coconut') {
        g.beginPath(); g.arc(0, 0, r, 0, TAU); fill('#6e4526'); g.beginPath(); g.arc(0, 0, r * 0.76, 0, TAU); fill('#ffffff'); g.beginPath(); g.arc(0, 0, r * 0.4, 0, TAU); fill('#e9f4f7');
      } else if (kind === 'almond') {
        g.rotate(0.5); g.beginPath(); g.moveTo(0, -r); g.bezierCurveTo(r * 0.95, -r * 0.2, r * 0.6, r, 0, r); g.bezierCurveTo(-r * 0.6, r, -r * 0.95, -r * 0.2, 0, -r); fill('#c68a4e'); line('#8a5a2a', r * 0.09);
        [-0.3, 0, 0.3].forEach((d) => { g.beginPath(); g.moveTo(d * r, -r * 0.45); g.lineTo(d * r * 0.8, r * 0.6); line('#9a6a36', r * 0.06); });
      } else if (kind === 'vanilla') {
        for (let i = 0; i < 5; i++) { g.save(); g.rotate(i * TAU / 5); oval(0, -r * 0.55, r * 0.3, r * 0.48); fill('#fff3b8'); line('#d9b84a', r * 0.06); g.restore(); }
        g.beginPath(); g.arc(0, 0, r * 0.24, 0, TAU); fill('#f0b429');
      } else if (kind === 'caramel') {
        g.beginPath(); g.moveTo(-r * 0.5, 0); g.lineTo(-r, -r * 0.42); g.lineTo(-r, r * 0.42); g.closePath(); fill('#e8a23c');
        g.beginPath(); g.moveTo(r * 0.5, 0); g.lineTo(r, -r * 0.42); g.lineTo(r, r * 0.42); g.closePath(); fill('#e8a23c');
        round(g, -r * 0.58, -r * 0.42, r * 1.16, r * 0.84, r * 0.22); fill('#c9781f'); g.beginPath(); g.moveTo(-r * 0.3, -r * 0.18); g.lineTo(r * 0.1, -r * 0.18); line('#f3c370', r * 0.1);
      } else if (kind === 'hazelnut') {
        g.beginPath(); g.moveTo(0, r); g.bezierCurveTo(-r, r * 0.5, -r * 0.9, -r * 0.5, 0, -r * 0.55); g.bezierCurveTo(r * 0.9, -r * 0.5, r, r * 0.5, 0, r); fill('#9a6234'); line('#5e3716', r * 0.08);
        oval(0, -r * 0.5, r * 0.62, r * 0.3); fill('#d9b077'); line('#5e3716', r * 0.08);
      } else if (kind === 'cross') {
        g.beginPath(); g.moveTo(-r * 0.7, -r * 0.7); g.lineTo(r * 0.7, r * 0.7); g.moveTo(r * 0.7, -r * 0.7); g.lineTo(-r * 0.7, r * 0.7); line('#d8382f', r * 0.34);
      } else if (kind === 'snow') {
        for (let i = 0; i < 3; i++) { g.save(); g.rotate(i * PI / 3); g.beginPath(); g.moveTo(0, -r); g.lineTo(0, r); g.moveTo(-r * 0.25, -r * 0.7); g.lineTo(0, -r * 0.45); g.lineTo(r * 0.25, -r * 0.7); g.moveTo(-r * 0.25, r * 0.7); g.lineTo(0, r * 0.45); g.lineTo(r * 0.25, r * 0.7); line('#3b9bd8', r * 0.14); g.restore(); }
      } else if (kind === 'flame') {
        g.beginPath(); g.moveTo(0, -r); g.bezierCurveTo(r * 0.2, -r * 0.3, r * 0.85, -r * 0.1, r * 0.6, r * 0.5); g.bezierCurveTo(r * 0.4, r, -r * 0.4, r, -r * 0.6, r * 0.5); g.bezierCurveTo(-r * 0.85, 0, -r * 0.3, -r * 0.2, 0, -r); fill('#f0612d');
        g.beginPath(); g.moveTo(0, -r * 0.2); g.bezierCurveTo(r * 0.4, r * 0.2, r * 0.35, r * 0.8, 0, r * 0.82); g.bezierCurveTo(-r * 0.35, r * 0.8, -r * 0.4, r * 0.2, 0, -r * 0.2); fill('#ffd45c');
      } else if (kind === 'drop') {
        g.beginPath(); g.moveTo(0, -r); g.bezierCurveTo(r * 0.9, r * 0.1, r * 0.7, r, 0, r); g.bezierCurveTo(-r * 0.7, r, -r * 0.9, r * 0.1, 0, -r); fill('#8fd0f5'); line('#3b9bd8', r * 0.1);
      }
      g.restore();
    }
    /* A label: a picture over a name on a card of paper. */
    function tag(text, icon, o) {
      o = o || {};
      return paintTex(o.w || 256, o.h || 256, (g, w, h) => {
        const bg = o.bg || PAPER;
        g.fillStyle = bg; if (o.square) g.fillRect(0, 0, w, h); else { round(g, 0, 0, w, h, 24); g.fill(); }
        if (o.band) { g.fillStyle = o.band; g.fillRect(0, 0, w, h * 0.09); g.fillRect(0, h * 0.91, w, h * 0.09); }
        if (icon) pic(g, icon, w / 2, h * 0.34, h * 0.2, bg);
        words(g, tr(text), w / 2, h * (icon ? 0.74 : 0.5), w - (o.inset || 26), o.size || 50, o.ink || INK);   // inset: a label wrapped round a bottle keeps its words in the middle, where they face us
      });
    }
    const labelMat = (tex) => new T.MeshStandardMaterial({ map: tex, roughness: 0.85, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.2, transparent: true });
    const plate = (tex, w, h) => new T.Mesh(new T.PlaneGeometry(w, h), labelMat(tex));
    /* A label wrapped round the front of something round (a bottle, a cup). */
    const wrap = (tex, rTop, h, arc, rBottom) => new T.Mesh(new T.CylinderGeometry(rTop, rBottom == null ? rTop : rBottom, h, 20, 1, true, -arc / 2, arc), labelMat(tex));
    /* Squeeze the top of a box: for the pinched top of a coffee bag and the roof of a milk carton. */
    function pinch(geo, fx, fz) { const p = geo.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) { p.setX(i, p.getX(i) * fx); p.setZ(i, p.getZ(i) * fz); } geo.computeVertexNormals(); return geo; }
    /* A little folded card standing in front of something too small to carry its own label. */
    function card(tex, w, h) { const c = plate(tex, w, h); c.position.set(0, 0.034, 0.2); c.rotation.x = -1.02; return c; }

    /* ---------- the things on the counter ---------- */
    const CUP = { small: { rt: 0.1, rb: 0.07, h: 0.21 }, medium: { rt: 0.118, rb: 0.082, h: 0.28 }, large: { rt: 0.136, rb: 0.094, h: 0.35 } };
    /* A paper cup with a card sleeve, open at the top. The sleeve can carry a label. */
    function cupShell(size, sleeveTex) {
      const d = CUP[size], g = new T.Group(), paper = mat(0xfff7ea, { side: T.DoubleSide, roughness: 0.7 });
      const at = (f) => d.rb + (d.rt - d.rb) * f;
      g.add(U.mesh(new T.CylinderGeometry(d.rt, d.rb, d.h, 24, 1, true), paper, 0, d.h / 2, 0));
      g.add(U.cyl(d.rb, d.rb, 0.008, paper, 0, 0.004, 0, 24));
      const rim = U.torus(d.rt, 0.008, white, 0, d.h, 0); rim.rotation.x = PI / 2; g.add(rim);
      const y0 = d.h * 0.24, y1 = d.h * 0.78;
      g.add(U.mesh(new T.CylinderGeometry(at(0.78) + 0.004, at(0.24) + 0.004, y1 - y0, 24, 1, true), mat(0xb98a5a, { roughness: 0.9 }), 0, (y0 + y1) / 2, 0));
      if (sleeveTex) { const l = wrap(sleeveTex, at(0.75) + 0.006, (y1 - y0) * 0.86, 1.9, at(0.27) + 0.006); l.position.y = (y0 + y1) / 2; g.add(l); }
      return g;
    }
    function bag(color, tex) {
      const g = new T.Group(), body = mat(color, { roughness: 0.75 });
      g.add(U.mesh(pinch(new T.BoxGeometry(0.27, 0.32, 0.14), 0.96, 0.2), body, 0, 0.16, 0));
      g.add(U.box(0.26, 0.04, 0.024, body, 0, 0.335, 0));
      const l = plate(tex, 0.23, 0.23); l.position.set(0, 0.155, 0.046); l.rotation.x = -0.172; g.add(l);
      return g;
    }
    function blender(tex) {
      const g = new T.Group();
      g.add(U.cyl(0.092, 0.115, 0.13, dark, 0, 0.065, 0, 20));
      const l = wrap(tex, 0.098, 0.1, 1.9, 0.115); l.position.y = 0.062; g.add(l);
      g.add(U.mesh(new T.CylinderGeometry(0.1, 0.066, 0.25, 16, 1, true), GLASS, 0, 0.255, 0));
      [[0.02, 0.17, 0.01, 0.3], [-0.03, 0.2, 0.02, 1.1], [0.01, 0.23, -0.03, 0.7], [-0.02, 0.27, -0.01, 0.2], [0.04, 0.26, 0.03, 1.6], [0, 0.31, 0.01, 0.9]].forEach((p) => {
        const c = U.box(0.05, 0.05, 0.05, mat(0xe9f7ff, { roughness: 0.15 }), p[0], p[1], p[2]); c.rotation.set(p[3], p[3] * 2, p[3] * 0.5); g.add(c);
      });
      g.add(U.cyl(0.103, 0.103, 0.022, dark, 0, 0.39, 0, 16)); g.add(U.cyl(0.035, 0.035, 0.03, dark, 0, 0.41, 0, 12));
      g.add(U.box(0.022, 0.17, 0.035, dark, 0.118, 0.26, 0));
      return g;
    }
    function machine(tex) {
      const g = new T.Group(), red = mat(0xc23b2e, { roughness: 0.45 });
      g.add(U.box(0.32, 0.04, 0.27, dark, 0, 0.02, 0));
      g.add(U.box(0.32, 0.36, 0.1, red, 0, 0.22, -0.085));
      g.add(U.box(0.32, 0.13, 0.27, red, 0, 0.335, 0));
      g.add(U.box(0.33, 0.012, 0.28, steel, 0, 0.406, 0));
      const l = plate(tex, 0.22, 0.105); l.position.set(0, 0.335, 0.1365); g.add(l);
      [-1, 1].forEach((s) => g.add(U.ball(0.017, steel, s * 0.135, 0.335, 0.138, 1, 1, 0.6, 10)));
      g.add(U.cyl(0.04, 0.04, 0.03, steel, 0, 0.255, 0.05, 14));
      g.add(U.rod([0, 0.245, 0.06], [0.11, 0.225, 0.14], 0.013, dark));
      g.add(U.cyl(0.04, 0.03, 0.055, white, 0, 0.068, 0.05, 14));
      g.add(U.rod([-0.125, 0.27, 0.05], [-0.135, 0.12, 0.09], 0.006, steel));
      return g;
    }
    function carton(body, band, tex) {
      const g = new T.Group(), b = mat(body, { roughness: 0.6 });
      g.add(U.box(0.2, 0.28, 0.19, b, 0, 0.14, 0));
      g.add(U.mesh(pinch(new T.BoxGeometry(0.2, 0.085, 0.19), 1, 0.05), b, 0, 0.3225, 0));
      g.add(U.box(0.2, 0.032, 0.012, b, 0, 0.378, 0));
      g.add(U.box(0.202, 0.045, 0.192, mat(band), 0, 0.0225, 0));
      const l = plate(tex, 0.18, 0.21); l.position.set(0, 0.16, 0.0965); g.add(l);
      return g;
    }
    function jug(tex) {
      const g = new T.Group(), water = mat(0x8fcff2, { transparent: true, opacity: 0.62, roughness: 0.1 });
      g.add(U.cyl(0.09, 0.098, 0.2, water, 0, 0.105, 0, 20));
      g.add(U.mesh(new T.CylinderGeometry(0.1, 0.105, 0.32, 20, 1, true), GLASS, 0, 0.16, 0));
      g.add(U.cyl(0.105, 0.105, 0.012, GLASS, 0, 0.006, 0, 20));
      const rim = U.torus(0.1, 0.006, white, 0, 0.32, 0); rim.rotation.x = PI / 2; g.add(rim);
      const h = U.torus(0.075, 0.013, mat(0xcfe6f5, { transparent: true, opacity: 0.7, roughness: 0.1 }), 0.1, 0.18, 0, PI); h.rotation.z = -PI / 2; g.add(h);
      const l = plate(tex, 0.19, 0.14); l.position.set(0, 0.14, 0.108); g.add(l);
      return g;
    }
    function bottle(color, tex, empty) {
      const g = new T.Group(), body = empty ? GLASS : mat(color, { roughness: 0.25 });
      g.add(U.cyl(0.1, 0.1, 0.25, body, 0, 0.125, 0, 18));
      g.add(U.cyl(0.032, 0.1, 0.06, body, 0, 0.28, 0, 18));
      g.add(U.cyl(0.032, 0.032, 0.035, body, 0, 0.3275, 0, 12));
      g.add(U.cyl(0.038, 0.038, 0.03, dark, 0, 0.36, 0, 12));
      g.add(U.cyl(0.009, 0.009, 0.05, dark, 0, 0.4, 0, 8));
      g.add(U.box(0.014, 0.014, 0.07, dark, 0, 0.425, 0.028));
      const l = wrap(tex, 0.103, 0.2, 1.9); l.position.y = 0.125; g.add(l);
      return g;
    }
    function shotGlass(tex) {
      const g = new T.Group(), k = new T.Group();
      k.add(U.cyl(0.058, 0.044, 0.085, mat(0x3a1f0e, { roughness: 0.3 }), 0, 0.05, 0, 16));
      k.add(U.cyl(0.059, 0.058, 0.014, mat(0xc9995a, { roughness: 0.5 }), 0, 0.098, 0, 16));
      k.add(U.mesh(new T.CylinderGeometry(0.066, 0.05, 0.13, 16, 1, true), GLASS, 0, 0.065, 0));
      k.scale.setScalar(1.5); g.add(k); g.add(card(tex, 0.26, 0.1));
      return g;
    }
    function shaker(fill, lid, tex, sticks) {
      const g = new T.Group(), k = new T.Group();
      k.add(U.cyl(0.058, 0.058, 0.12, mat(fill, { roughness: 0.7 }), 0, 0.064, 0, 16));
      k.add(U.mesh(new T.CylinderGeometry(0.064, 0.064, 0.15, 16, 1, true), GLASS, 0, 0.075, 0));
      k.add(U.cyl(0.066, 0.066, 0.03, lid, 0, 0.165, 0, 16)); k.add(U.ball(0.066, lid, 0, 0.18, 0, 1, 0.45, 1, 14));
      if (sticks) [[-0.105, 0.3], [-0.13, -0.2], [-0.09, 0.9]].forEach((p, i) => { const st = U.cyl(0.013, 0.013, 0.16, mat(0x8a4f24, { roughness: 0.9 }), p[0], 0.013 + i * 0.001, -0.04 + 0.02 * i, 8); st.rotation.set(PI / 2, 0, p[1]); k.add(st); });
      k.scale.setScalar(1.3); g.add(k); g.add(card(tex, 0.26, 0.1));
      return g;
    }
    function canister(tex) {
      const g = new T.Group(), red = mat(0xd8382f, { roughness: 0.4 });
      g.add(U.cyl(0.06, 0.06, 0.2, steel, 0, 0.1, 0, 16));
      g.add(U.ball(0.06, steel, 0, 0.2, 0, 1, 0.7, 1, 14));
      g.add(U.cyl(0.03, 0.04, 0.035, red, 0, 0.25, 0, 12));
      g.add(U.cone(0.022, 0.07, white, 0, 0.3, 0, 10));
      g.add(U.box(0.016, 0.02, 0.09, red, 0, 0.255, 0.05));
      g.add(card(tex, 0.26, 0.1));
      return g;
    }
    /* ---------- the customers: animals of the Finnish woods ---------- */
    const FUR = {
      reindeer: [0xb48d6d, 0xf3e4cf], bear: [0x987254, 0xe2c5a1], fox: [0xe99a62, 0xfff3e2], hare: [0xf3f1ec, 0xffffff],
      owl: [0xae9b88, 0xf5e9d6], moose: [0x92735d, 0xd4b396], lynx: [0xdcb781, 0xffefd8], squirrel: [0xc98961, 0xffedd9],
    };
    function critter(kind) {
      const fur = mat(FUR[kind][0]), pale = mat(FUR[kind][1]), black = mat(0x1d1a1a, { roughness: 0.4 }), bone = mat(0xdccdaa), pink = mat(0xf7b8c4);
      const g = new T.Group(), head = new T.Group(), eyes = [];
      const add = (o) => { head.add(o); return o; };
      const both = (fn) => [-1, 1].forEach(fn);
      g.add(U.ball(1, fur, 0, 0.72, 0, 0.49, 0.70, 0.40, 24));
      g.add(U.ball(1, pale, 0, 0.8, 0.15, 0.34, 0.50, 0.28, 24));
      both((s) => {                                     // arms reaching for the counter, paws resting on it
        g.add(U.rod([s * 0.34, 1.2, 0.1], [s * 0.27, 0.96, 0.5], 0.105, fur, 16));
        g.add(U.ball(0.13, fur, s * 0.27, 0.95, 0.54, 1, 0.72, 1.1, 20));
      });
      head.position.set(0, 1.7, 0.06);
      // Broad plush cheeks and a large forehead, with features low on the face.
      add(U.ball(0.37, fur, 0, 0, 0, 1.12, 1.04, 0.98, 32));
      const eye = (s, y, r, z) => {
        r = r || 0.076; y = y == null ? 0.035 : y; z = z || 0.325;
        // Blink the whole eye, including its glints, so no white dots float over a closed lid.
        const e = new T.Group(); e.position.set(s * 0.157, y, z); add(e); eyes.push(e);
        e.add(U.ball(r, black, 0, 0, 0, 1, 1.16, 0.58, 24));
        e.add(U.ball(r * 0.28, white, -r * 0.24, r * 0.36, r * 0.56, 1, 1, 0.4, 12));
        e.add(U.ball(r * 0.12, white, r * 0.28, -r * 0.22, r * 0.57, 1, 1, 0.4, 10));
      };
      // Rounded ear tips instead of hard cone points, with inset peach centres.
      const ear = (s, x, y, h, w) => {
        const e = new T.Group(); e.position.set(s * x, y, -0.015); e.rotation.z = -s * 0.22;
        e.add(U.ball(1, fur, 0, 0, 0, w, h, 0.085, 24));
        e.add(U.ball(1, pink, 0, 0.01, 0.065, w * 0.55, h * 0.65, 0.025, 20)); add(e);
      };
      const muzzle = (r, y, z, sx, sy, sz, m) => add(U.ball(r, m || pale, 0, y, z, sx, sy, sz, 14));
      const nose = (r, y, z, m) => add(U.ball(r, m || black, 0, y, z, 1.2, 0.85, 0.8, 10));
      let my = -0.18, mz = 0.4;                         // where the mouth sits
      if (kind !== 'owl') both((s) => eye(s));
      if (kind === 'reindeer') {
        muzzle(0.17, -0.1, 0.25, 1, 0.75, 0.9); nose(0.05, -0.06, 0.4, mat(0x4a2f25));
        both((s) => { const e = add(U.ball(0.09, fur, s * 0.37, 0.12, 0, 1.5, 0.6, 0.5, 10)); e.rotation.z = s * 0.4;
          add(U.rod([s * 0.13, 0.3, 0], [s * 0.34, 0.74, -0.02], 0.026, bone)); add(U.rod([s * 0.23, 0.5, 0], [s * 0.44, 0.56, 0], 0.02, bone));
          add(U.rod([s * 0.3, 0.65, 0], [s * 0.2, 0.86, 0], 0.02, bone)); add(U.rod([s * 0.34, 0.74, -0.02], [s * 0.46, 0.88, -0.02], 0.02, bone)); });
      } else if (kind === 'bear') {
        muzzle(0.15, -0.1, 0.26, 1, 0.8, 0.9, mat(0xe2c5a1)); nose(0.055, -0.05, 0.395);
        both((s) => { add(U.ball(0.115, fur, s * 0.27, 0.28, 0)); add(U.ball(0.065, mat(0xe2c5a1), s * 0.27, 0.28, 0.07, 1, 1, 0.5)); });
      } else if (kind === 'fox') {
        both((s) => { add(U.ball(0.19, pale, s * 0.14, -0.13, 0.19, 1, 0.7, 0.8, 12));
          ear(s, 0.25, 0.36, 0.20, 0.11); });
        muzzle(0.11, -0.1, 0.31, 1, 0.75, 1.2); nose(0.045, -0.065, 0.445); mz = 0.415;
      } else if (kind === 'hare') {
        both((s) => { const e = add(U.ball(1, fur, s * 0.13, 0.62, -0.03, 0.08, 0.34, 0.055, 12)); e.rotation.z = -s * 0.14; const i = add(U.ball(1, pink, s * 0.13, 0.62, 0.0, 0.045, 0.27, 0.035, 10)); i.rotation.z = -s * 0.14; });
        muzzle(0.12, -0.1, 0.28, 1.2, 0.75, 0.9); nose(0.035, -0.06, 0.39, pink); add(U.box(0.055, 0.05, 0.012, white, 0, -0.21, 0.365)); my = -0.15; mz = 0.385;
      } else if (kind === 'owl') {
        both((s) => { add(U.ball(0.17, pale, s * 0.14, 0.05, 0.22, 1, 1, 0.45, 14)); add(U.ball(0.115, mat(0xe6bb71, { roughness: 0.4 }), s * 0.14, 0.06, 0.29, 1, 1, 0.45, 12)); eye(s, 0.045, 0.078, 0.335);
          const t = add(U.ball(1, fur, s * 0.25, 0.33, 0, 0.09, 0.14, 0.08, 20)); t.rotation.z = -s * 0.4; });
        const b = add(U.cone(0.05, 0.12, mat(0xe8a13a), 0, -0.07, 0.405, 16)); b.rotation.x = PI * 0.62; my = -0.2; mz = 0.36;
      } else if (kind === 'moose') {
        muzzle(0.2, -0.14, 0.27, 1.12, 0.85, 0.95, pale); both((s) => add(U.ball(0.024, black, s * 0.08, -0.16, 0.455)));

        both((s) => { const e = add(U.ball(0.08, fur, s * 0.37, 0.2, -0.02, 1.4, 0.6, 0.5, 10)); e.rotation.z = s * 0.3;
          add(U.rod([s * 0.15, 0.3, 0], [s * 0.38, 0.48, 0], 0.03, bone)); const p = add(U.ball(1, bone, s * 0.52, 0.56, -0.01, 0.2, 0.1, 0.035, 12)); p.rotation.z = s * 0.45;
          [0, 1, 2].forEach((i) => add(U.rod([s * (0.42 + i * 0.09), 0.56 + i * 0.045, 0], [s * (0.43 + i * 0.1), 0.72 + i * 0.05, 0], 0.02, bone))); });
        my = -0.25; mz = 0.43;
      } else if (kind === 'lynx') {
        both((s) => { ear(s, 0.25, 0.35, 0.16, 0.105); add(U.rod([s * 0.245, 0.46, 0], [s * 0.3, 0.62, 0], 0.012, black));
          add(U.ball(1, pale, s * 0.28, -0.14, 0.17, 0.13, 0.10, 0.11, 24)); });
        muzzle(0.12, -0.1, 0.28, 1.2, 0.75, 0.9); nose(0.04, -0.06, 0.39, mat(0xc98a7a));
        [[-0.1, 0.24], [0.1, 0.24], [0, 0.28], [-0.05, 0.2], [0.05, 0.2]].forEach((p) => add(U.ball(0.022, mat(0x7a5a34), p[0], p[1], 0.3 - Math.abs(p[1] - 0.2) * 0.4, 1, 1, 0.5, 8)));
        my = -0.15; mz = 0.385;
      } else {   // squirrel
        both((s) => { add(U.ball(0.14, pale, s * 0.14, -0.12, 0.21, 1, 0.8, 0.85, 12)); ear(s, 0.23, 0.35, 0.13, 0.09); add(U.rod([s * 0.215, 0.44, 0], [s * 0.24, 0.56, 0], 0.014, fur)); });
        nose(0.035, -0.06, 0.345, mat(0x4a2f25)); add(U.box(0.05, 0.045, 0.012, white, 0, -0.2, 0.31)); my = -0.15; mz = 0.33;
        g.add(U.ball(0.2, fur, 0.44, 1.02, -0.26, 1, 1.5, 0.9, 12)); g.add(U.ball(0.24, fur, 0.52, 1.5, -0.3, 1, 1.3, 0.9, 12)); g.add(U.ball(0.2, fur, 0.44, 1.94, -0.26, 1.1, 1, 0.9, 12));
      }
      both((s) => add(U.ball(0.065, mat(0xeeb0ac), s * 0.265, -0.065, 0.285, 1, 0.55, 0.25, 20)));
      const smile = add(U.torus(0.046, 0.008, black, 0, my + 0.035, mz, PI, 12)); smile.rotation.z = PI;
      const frown = add(U.torus(0.046, 0.008, black, 0, my - 0.03, mz, PI, 12)); frown.visible = false;
      const brows = []; both((s) => { const b = add(U.rod([s * 0.10, 0.18, 0.34], [s * 0.22, 0.15, 0.32], 0.009, black)); b.visible = false; brows.push(b); });
      g.add(head);
      return { g, head, eyes, smile, frown, brows, kind, blink: 2 + Math.random() * 2, mood: 'calm', hop: 0 };
    }

    /* ---------- the room ---------- */
    let view = null, riser = null, tall = true, aspect = 0, lang = null;
    const bulbs = [], decor = {};
    function buildRoom() {
      const scene = new T.Scene(), camera = new T.PerspectiveCamera(40, W.aspect || 1, 0.1, 60);
      scene.background = new T.Color(0x24160d);
      scene.add(new T.HemisphereLight(0xffe9cf, 0x5a3a24, 1.6));
      const key = new T.DirectionalLight(0xfff1dd, 1.5); key.position.set(1.5, 5, 5); scene.add(key);
      const glow = new T.PointLight(0xffb866, 16, 11, 1.5); glow.position.set(0, 2.3, -1.3); scene.add(glow);
      const rnd = U.rng(77);
      const planks = (base, lineCol, rows) => {
        const t = U.tex(256, 256, (g, w, h) => {
          g.fillStyle = base; g.fillRect(0, 0, w, h);
          const r2 = U.rng(5);
          for (let i = 0; i < 90; i++) { g.strokeStyle = 'rgba(70,40,15,' + (0.05 + r2() * 0.1) + ')'; g.lineWidth = 1 + r2() * 2; const y = r2() * h, x = r2() * w; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 40 + r2() * 120, y + (r2() - 0.5) * 4); g.stroke(); }
          g.strokeStyle = lineCol; g.lineWidth = 3; for (let i = 0; i < rows; i++) { g.beginPath(); g.moveTo(0, (i + 0.5) * h / rows); g.lineTo(w, (i + 0.5) * h / rows); g.stroke(); }
        });
        t.wrapS = t.wrapT = T.RepeatWrapping; return t;
      };
      const topTex = planks('#c9a06e', 'rgba(90,55,25,0.55)', 4); topTex.repeat.set(3, 1.5);
      const floorTex = planks('#6b4a30', 'rgba(30,18,8,0.6)', 6); floorTex.repeat.set(4, 3);
      const topMat = new T.MeshStandardMaterial({ map: topTex, roughness: 0.7 });
      scene.add(U.box(9, 0.14, 3.2, topMat, 0, -0.07, 0.65));                                    // the counter top, from the customer's edge to ours
      scene.add(U.box(9, 0.05, 0.08, mat(0x8a5a36), 0, -0.02, -0.96));
      scene.add(U.box(9, 1.1, 0.12, mat(0x7a4f30), 0, -0.6, -0.92));
      riser = U.group(U.box(2.3, RISE, 0.64, new T.MeshStandardMaterial({ map: topTex, roughness: 0.7, color: 0xe2c9a6 }), 0, RISE / 2, -0.33), U.box(2.32, 0.035, 0.03, mat(0x8a5a36), 0, RISE - 0.017, -0.005));
      scene.add(riser);
      scene.add(U.box(14, 0.1, 6, new T.MeshStandardMaterial({ map: floorTex, roughness: 0.9 }), 0, -1.12, -2.4));
      for (let i = 0; i < 12; i++) {                                                             // the log wall
        const log = U.cyl(0.2, 0.2, 14, mat(i % 2 ? 0x8a5a36 : 0x7d5131, { roughness: 0.95 }), 0, -0.95 + i * 0.385, -3.6, 10); log.rotation.z = PI / 2; scene.add(log);
      }
      // a window on the winter night
      const night = U.tex(256, 256, (g, w, h) => {
        const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#0a1230'); sky.addColorStop(1, '#2b4686'); g.fillStyle = sky; g.fillRect(0, 0, w, h);
        for (let i = 0; i < 7; i++) { const x = 20 + i * 34, a = g.createLinearGradient(0, 20, 0, 150); a.addColorStop(0, 'rgba(90,240,170,0)'); a.addColorStop(0.5, 'rgba(90,240,170,0.38)'); a.addColorStop(1, 'rgba(90,240,170,0)'); g.fillStyle = a; g.fillRect(x, 20 + (i % 3) * 10, 22, 130); }
        g.fillStyle = '#e8f1ff'; g.fillRect(0, h - 44, w, 44);
        const r2 = U.rng(9);
        for (let i = 0; i < 6; i++) { const x = 16 + i * 44 + r2() * 10, s = 50 + r2() * 40; g.fillStyle = '#16332c'; g.beginPath(); g.moveTo(x, h - 40 - s); g.lineTo(x + s * 0.34, h - 36); g.lineTo(x - s * 0.34, h - 36); g.closePath(); g.fill(); g.fillStyle = '#e8f1ff'; g.beginPath(); g.moveTo(x, h - 40 - s); g.lineTo(x + s * 0.12, h - 40 - s * 0.66); g.lineTo(x - s * 0.12, h - 40 - s * 0.66); g.closePath(); g.fill(); }
        g.fillStyle = '#ffffff'; for (let i = 0; i < 46; i++) { g.beginPath(); g.arc(r2() * w, r2() * h, 1 + r2() * 1.8, 0, TAU); g.fill(); }
      });
      const frame = mat(0xf2e6cf);
      const win = U.group(U.mesh(new T.PlaneGeometry(1.1, 1.1), new T.MeshBasicMaterial({ map: night })),
        U.box(1.26, 0.09, 0.08, frame, 0, 0.59, 0), U.box(1.26, 0.09, 0.08, frame, 0, -0.59, 0), U.box(0.09, 1.26, 0.08, frame, 0.59, 0, 0), U.box(0.09, 1.26, 0.08, frame, -0.59, 0, 0),
        U.box(0.04, 1.1, 0.05, frame, 0, 0, 0), U.box(1.1, 0.04, 0.05, frame, 0, 0, 0), U.box(1.4, 0.05, 0.2, frame, 0, -0.66, 0.06));
      scene.add(win); decor.win = win;
      // a sign
      const chalk = U.tex(256, 170, (g, w, h) => {
        g.fillStyle = '#26332e'; g.fillRect(0, 0, w, h); g.fillStyle = '#f4f1e6'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.font = '600 46px ' + FONT; g.fillText('Kahvila', w / 2, 52); g.font = '600 36px ' + FONT; g.fillStyle = '#ffd98a'; g.fillText('Norppa', w / 2, 100);
        g.strokeStyle = '#f4f1e6'; g.lineWidth = 3; g.beginPath(); g.moveTo(60, 138); g.quadraticCurveTo(w / 2, 152, w - 60, 138); g.stroke();
      });
      const board = U.group(U.box(1.0, 0.68, 0.04, mat(0x5e3d26)), U.mesh(new T.PlaneGeometry(0.9, 0.58), new T.MeshBasicMaterial({ map: chalk }), 0, 0, 0.022));
      scene.add(board); decor.board = board;
      // a string of lights along the wall, and two lamps over the counter
      let last = null; decor.lights = new T.Group(); decor.lamps = new T.Group(); scene.add(decor.lights); scene.add(decor.lamps);
      for (let i = 0; i <= 16; i++) {
        const t = i / 16, p = [-3.6 + t * 7.2, -Math.sin(t * PI) * 0.22 - Math.abs(Math.sin(t * PI * 4)) * 0.05, -3.34];
        if (last) decor.lights.add(U.rod(last, p, 0.008, dark));
        const col = [0xffd27a, 0xff9a7a, 0xfff1c9, 0xffc46b][i % 4], b = U.ball(0.045, U.glow(col), p[0], p[1] - 0.05, p[2]); decor.lights.add(b);
        const h = U.halo(col, 0.34, 0.5); h.position.set(p[0], p[1] - 0.05, p[2] + 0.03); decor.lights.add(h); bulbs.push({ h, ph: rnd() * TAU });
        last = p;
      }
      [-1, 1].forEach((sx) => {
        const lamp = U.group(U.rod([0, 0.1, 0], [0, 3, 0], 0.012, dark), U.mesh(new T.ConeGeometry(0.3, 0.26, 16, 1, true), mat(0x9c2f26, { side: T.DoubleSide, roughness: 0.6 }), 0, 0, 0), U.ball(0.08, U.glow(0xffe2a8), 0, -0.09, 0));
        const h = U.halo(0xffc878, 1.1, 0.42); h.position.set(0, -0.12, 0); lamp.add(h); lamp.userData.side = sx; decor.lamps.add(lamp);
      });
      view = { scene, camera };
    }

    /* ---------- everything there is to choose from, made once ---------- */
    const sets = {};          // step id → [{ id, obj, h }]
    const SYRUP_COL = { vanilla: 0xf2dc8a, caramel: 0xc77a1e, hazelnut: 0x8a5630, mint: 0x5fc48a };
    const SYRUP_PIC = { vanilla: 'vanilla', caramel: 'caramel', hazelnut: 'hazelnut', mint: 'mint' };
    function buildThings() {
      const mk = (id, obj, h, more) => { obj.scale.setScalar(S); obj.visible = false; view.scene.add(obj); return Object.assign({ id, obj, h: h * S, on: false }, more); };
      const name = (step, id) => label(step, id);
      sets.size = ['small', 'medium', 'large'].map((id) => mk(id, cupShell(id, tag(name('size', id), null, { w: 256, h: 112, size: 60, inset: 56 })), CUP[id].h));
      const bags = { dark: [0x3a2213, 'bean'], light: [0xc49a68, 'beanLight'], decaf: [0x2f63c9, 'moon'], matcha: [0x4f9a4a, 'leaf'] };
      sets.base = Object.keys(bags).map((id) => mk(id, bag(bags[id][0], tag(name('base', id), bags[id][1], { size: 56 })), 0.35));
      sets.temp = [mk('hot', machine(tag('Hot', null, { w: 256, h: 122, size: 78, ink: '#d8382f' })), 0.41), mk('iced', blender(tag('Ice', null, { w: 256, h: 134, size: 82, ink: '#2f7fd0', inset: 70 })), 0.42)];
      const cartons = { milk: [0xffffff, 0x3b82c4, 'cow', '#ffffff'], oat: [0xf0e4c9, 0xb58a3c, 'oat', '#f0e4c9'], coconut: [0xffffff, 0x7a4a2a, 'coconut', '#ffffff'], almond: [0xf4e3c7, 0xa8703a, 'almond', '#f4e3c7'] };
      sets.milk = [mk('black', jug(tag('No milk', null, { w: 256, h: 188, size: 76 })), 0.32)]
        .concat(Object.keys(cartons).map((id) => mk(id, carton(cartons[id][0], cartons[id][1], tag(name('milk', id), cartons[id][2], { w: 220, h: 256, square: true, bg: cartons[id][3], size: 52 })), 0.39)));
      const syrupTex = {}; Object.keys(SYRUP_COL).forEach((id) => { syrupTex[id] = tag(name('syrup', id), SYRUP_PIC[id], { size: 54, inset: 64 }); });
      const syrups = () => Object.keys(SYRUP_COL).map((id) => mk(id, bottle(SYRUP_COL[id], syrupTex[id]), 0.44));
      sets.syrup = [mk('none', bottle(0, tag('No syrup', 'cross', { size: 50, inset: 64 }), true), 0.44)].concat(syrups());
      sets.syrup2 = syrups();
      const small = (text) => tag(text, null, { w: 256, h: 96, size: 44 });
      sets.extras = [mk('shot', shotGlass(small('Extra shot')), 0.24), mk('cinnamon', shaker(0x9a5a2a, steel, small('Cinnamon'), true), 0.27),
        mk('sprinkles', shaker(0x3a2213, steel, small('Choc sprinkles')), 0.27), mk('cream', canister(small('Whipped cream')), 0.34)];
      const pen = U.group(U.cyl(0.02, 0.02, 0.26, dark, 0, 0.02, 0, 10), U.cyl(0.021, 0.021, 0.07, mat(0xd8382f), 0.0, 0.02, 0, 10), U.cone(0.02, 0.05, dark, 0, 0.02, 0, 10));
      pen.children[0].rotation.z = PI / 2; pen.children[1].rotation.z = PI / 2; pen.children[1].position.x = 0.1; pen.children[2].rotation.z = PI / 2; pen.children[2].position.x = -0.155;
      sets.name = [mk('pen', pen, 0.2, { pen: true })];
    }

    /* ---------- the cup being made ---------- */
    const BASE_COL = { dark: 0x2a160b, light: 0x8a5a2e, decaf: 0x55331c, matcha: 0x86a94f };
    const MILK = { black: [0xffffff, 0], milk: [0xffffff, 0.5], oat: [0xe9dcc2, 0.5], coconut: [0xfdf9f1, 0.56], almond: [0xe3caa4, 0.5] };
    let cup = null, cupName = '', nameTex = null;
    function dropCup() {
      if (!cup) return;
      cup.g.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      cup.liquid.dispose(); view.scene.remove(cup.g); cup = null;
    }
    function newCup(size) {
      dropCup(); cupName = ''; repaint(nameP());
      const d = CUP[size], g = cupShell(size, nameTex);
      g.scale.setScalar(S); view.scene.add(g);
      cup = { g, d, level: 0, surf: 0, col: new T.Color(0x2a160b), liquid: new T.MeshStandardMaterial({ color: 0x2a160b, roughness: 0.25 }), body: null, steam: [], ice: [], top: new T.Group(), cream: false, shot: false, xg: null };
      g.add(cup.top);
    }
    const nameP = () => painted.find((p) => p.t === nameTex);
    const rAt = (f) => cup.d.rb + (cup.d.rt - cup.d.rb) * f;
    function fill(level) {
      if (cup.body) { cup.g.remove(cup.body); cup.body.geometry.dispose(); }
      cup.level = level; cup.surf = level * cup.d.h; cup.liquid.color.copy(cup.col);
      cup.body = U.mesh(new T.CylinderGeometry(rAt(level) - 0.004, cup.d.rb - 0.004, cup.surf - 0.008, 24), cup.liquid, 0, 0.008 + (cup.surf - 0.008) / 2, 0);
      cup.g.add(cup.body); cup.top.position.y = cup.surf;
      cup.ice.forEach((c) => { c.position.y = cup.surf - 0.006; });
    }
    /* Put what was just chosen into the cup, so the drink can be seen coming together. */
    function cupAdd(step, val) {
      if (step === 'size') { newCup(val); const s = cupSlot(); cup.g.position.set(s.x, s.y, s.z); cup.g.scale.setScalar(0.01); tween(cup.g.scale, { x: S, y: S, z: S }, 0.35, { ease: 'back' }); return; }
      if (!cup) return;
      const R = () => rAt(cup.level) - 0.006;
      if (step === 'base') { cup.col.setHex(BASE_COL[val]); fill(0.52); }
      else if (step === 'temp') {
        if (!cup.level) fill(0.52);
        if (val === 'hot') for (let i = 0; i < 3; i++) { const p = U.halo(0xffffff, 0.14, 0.4); p.userData.ph = i / 3; cup.g.add(p); cup.steam.push(p); }
        else [[0.4, 0.2], [-0.35, 0.3], [0, -0.42]].forEach((p, i) => { const c = U.box(0.05, 0.05, 0.05, mat(0xe9f7ff, { roughness: 0.15, transparent: true, opacity: 0.88 }), p[0] * R(), cup.surf - 0.006, p[1] * R()); c.rotation.set(0.4 + i, 0.7 * i, 0.3); cup.g.add(c); cup.ice.push(c); });
      } else if (step === 'milk') { const m = MILK[val]; cup.col.lerp(new T.Color(m[0]), m[1]); fill(0.86); }
      else if (step === 'syrup' || step === 'syrup2') {
        if (val !== 'none') { const ring = U.torus(R() * (step === 'syrup' ? 0.66 : 0.36), 0.009, mat(SYRUP_COL[val], { roughness: 0.3 }), 0, 0.003, 0); ring.rotation.x = PI / 2; cup.top.add(ring); }
      } else if (step === 'extras') {                      // rebuilt from everything added so far, so the cream always sits under the rest
        if (cup.xg) { cup.xg.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); cup.top.remove(cup.xg); }
        cup.xg = new T.Group(); cup.top.add(cup.xg);
        const has = (x) => val.indexOf(x) >= 0, dome = R() * 0.86; cup.cream = has('cream');
        const on = (rho) => (cup.cream ? 0.012 + 0.075 * Math.sqrt(Math.max(0, 1 - rho * rho)) : 0.004);
        if (has('shot')) { if (!cup.shot) { cup.shot = true; cup.col.multiplyScalar(0.7); cup.liquid.color.copy(cup.col); } if (!cup.cream) cup.xg.add(U.cyl(R() * 0.3, R() * 0.3, 0.004, mat(0xc9995a), R() * 0.45, 0.002, R() * 0.1, 12)); }
        if (cup.cream) { cup.xg.add(U.ball(dome, white, 0, 0.012, 0, 1, 0.5, 1, 16)); cup.xg.add(U.ball(dome * 0.6, white, 0, 0.05, 0, 1, 0.6, 1, 14)); cup.xg.add(U.cone(dome * 0.28, 0.06, white, 0, 0.1, 0, 10)); }
        const scatter = (n, seed, make) => { const rr = U.rng(seed); for (let i = 0; i < n; i++) { const a = rr() * TAU, rho = 0.15 + rr() * 0.7, o = make(); o.position.set(Math.cos(a) * rho * dome, on(rho) + 0.004, Math.sin(a) * rho * dome); o.rotation.y = rr() * TAU; cup.xg.add(o); } };
        if (has('cinnamon')) scatter(9, 11, () => U.ball(0.012, mat(0x9a5a2a), 0, 0, 0, 1, 0.3, 1, 6));
        if (has('sprinkles')) scatter(11, 23, () => U.box(0.02, 0.007, 0.007, mat(0x2e1a0e)));
      } else if (step === 'name') { cupName = val; repaint(nameP()); }
      stopTweens(cup.g.scale); cup.g.scale.setScalar(S * 1.12); tween(cup.g.scale, { x: S, y: S, z: S }, 0.3, { ease: 'out' });
    }

    /* ---------- the receipt ---------- */
    const SLIP_W = 512, SLIP_TEX = 1024, MONO = '"Courier New", Courier, monospace';
    const slip = { g: null, rows: [], used: 300, usedW: SLIP_W, per: 1, n: 1, pose: 'hidden', review: false };
    function slipRows(order, game) {       // with a game given, the receipt is marked to show where the drink went wrong
      const rows = [], f = game && game.fail, at = f ? order.steps.indexOf(f.step) : -1;
      lines(order).forEach((l, i) => {
        const mark = !f ? null : i < at ? 'ok' : i === at ? 'bad' : 'todo';
        const vals = l.step === 'name' ? l.values : l.values.map((v) => tr(v));
        if (l.step === 'extras') { rows.push({ l: tr(l.title), r: '', mark }); vals.forEach((v) => rows.push({ l: '  + ' + v, r: '', mark: mark === 'todo' ? 'todo' : null, tint: mark })); }
        else rows.push({ l: tr(l.title), r: vals[0], mark });
        if (mark === 'bad') {
          rows.push({ l: tr('You made') + ':', r: '', made: true });
          rows.push({ l: '  ' + (f.chose.length ? f.chose.map((x) => (l.step === 'name' ? x : tr(label(l.step, x)))).join(', ') : tr('nothing')), r: '', made: true });
        }
      });
      return rows;
    }
    function drawSlip(g) {
      const pad = 34, top = 150, pitch = 50, w = slip.usedW;
      g.fillStyle = '#fffdf6'; g.fillRect(0, 0, w, slip.used);
      const dash = (y) => { g.strokeStyle = '#8d8a80'; g.lineWidth = 3; g.setLineDash([10, 8]); g.beginPath(); g.moveTo(pad, y); g.lineTo(w - pad, y); g.stroke(); g.setLineDash([]); };
      const fit = (text, maxW, size, bold) => { let s = size; do { g.font = (bold ? 'bold ' : '') + s + 'px ' + MONO; s -= 1; } while (g.measureText(text).width > maxW && s > 12); };
      g.fillStyle = '#222'; g.textBaseline = 'middle'; g.textAlign = 'center';
      g.font = 'bold 38px ' + MONO; g.fillText('KAHVILA NORPPA', w / 2, 52);
      g.font = '26px ' + MONO; g.fillText(tr('Order {0}', slip.n), w / 2, 96); dash(126);
      slip.rows.forEach((row, i) => {
        const x0 = Math.floor(i / slip.per) * SLIP_W, y = top + 10 + (i % slip.per) * pitch + pitch / 2, grey = row.mark === 'todo', red = row.mark === 'bad' || row.made;
        g.fillStyle = grey ? '#b9b4a8' : red ? '#c8322b' : '#222';
        const room = SLIP_W - pad * 2 - (row.mark === 'ok' || row.mark === 'bad' ? 44 : 0), xr = x0 + SLIP_W - pad;
        g.textAlign = 'left'; fit(row.l + (row.r ? '  ' + row.r : ''), room, 31, !row.made); g.fillText(row.l, x0 + pad, y);
        if (row.r) { g.textAlign = 'right'; g.fillText(row.r, x0 + pad + room, y); }
        if (row.mark === 'ok') { g.strokeStyle = '#2f9e55'; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.moveTo(xr - 30, y); g.lineTo(xr - 20, y + 10); g.lineTo(xr - 2, y - 12); g.stroke(); }
        if (row.mark === 'bad') { g.strokeStyle = '#c8322b'; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.moveTo(xr - 28, y - 12); g.lineTo(xr - 4, y + 12); g.moveTo(xr - 4, y - 12); g.lineTo(xr - 28, y + 12); g.stroke(); }
      });
      const end = top + 10 + slip.per * pitch + 16; dash(end);
      g.fillStyle = '#222'; g.textAlign = 'center'; g.font = 'bold 28px ' + MONO; g.fillText(tr('Thank you!'), w / 2, end + 36);
      for (let x = w / 2 - 180, i = 0; x < w / 2 + 180; i++) { const bw = [3, 6, 2, 5, 3, 8, 2, 4][i % 8]; g.fillRect(x, end + 60, bw, 30); x += bw + [3, 2, 4, 2, 5, 3][i % 6]; }
    }
    let slipTex = null;
    function buildSlip() {
      slipTex = U.tex(SLIP_TEX, SLIP_TEX, (g) => drawSlip(g));
      const front = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: slipTex, toneMapped: false }));
      const back = new T.Mesh(new T.PlaneGeometry(1, 1), mat(0xf1ecdf)); back.rotation.y = PI; back.position.z = -0.002;
      slip.g = U.group(front, back); slip.g.visible = false; view.scene.add(slip.g);
    }
    /* Print the order on the receipt (with a game given, marked to show where the drink went wrong). */
    function printSlip(order, game) {
      slip.review = !!game; slip.rows = slipRows(order, game);
      const cols = !tall && slip.rows.length > 6 ? 2 : 1;
      slip.per = Math.ceil(slip.rows.length / cols); slip.usedW = SLIP_W * cols; slip.used = 150 + 10 + slip.per * 50 + 16 + 100;
      const g = slipTex.image.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, SLIP_TEX, SLIP_TEX); drawSlip(g); slipTex.needsUpdate = true;
      slipTex.repeat.set(slip.usedW / SLIP_TEX, slip.used / SLIP_TEX); slipTex.offset.set(0, 1 - slip.used / SLIP_TEX);
    }
    /* Where the receipt is in each of its places: held up to be read, lying face down by the cup, or just put down by the customer. */
    const tmpP = { pos: new T.Vector3(), quat: new T.Quaternion(), w: 1 };
    function slipPose(which, out) {
      const cam = view.camera, ratio = slip.used / slip.usedW;
      if (which === 'read') {
        const L = 1.5, vH = Math.tan(cam.fov * RAD / 2) * L, hW = vH * cam.aspect;
        out.w = Math.min(hW * 2 * 0.88, vH * 2 * (tall ? 0.74 : 0.68) / ratio);
        out.pos.copy(cam.position).addScaledVector(new T.Vector3(0, 0, -1).applyQuaternion(cam.quaternion), L).addScaledVector(new T.Vector3(0, 1, 0).applyQuaternion(cam.quaternion), vH * (tall ? -0.05 : 0.02));
        out.quat.copy(cam.quaternion);
      } else if (which === 'rest') {
        out.w = Math.min(tall ? 0.44 : slip.usedW > SLIP_W ? 0.58 : 0.4, 0.62 / ratio);
        if (tall) out.pos.set(0.46, 0.006, 1.36); else out.pos.set(1.6, 0.006, 0.56);
        out.quat.setFromEuler(new T.Euler(PI / 2, 0, 0)).premultiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), -0.16));
      } else {
        out.w = 0.26; out.pos.set(0, (tall ? RISE : 0) + 0.008, -0.42); out.quat.setFromEuler(new T.Euler(-PI / 2, 0, 0));
      }
      return out;
    }
    function slipSet(which) { const p = slipPose(which, tmpP); slip.g.position.copy(p.pos); slip.g.quaternion.copy(p.quat); slip.g.scale.set(p.w, p.w * slip.used / slip.usedW, 1); slip.pose = which; }
    function slipTo(which, dur, done) {
      const to = slipPose(which, { pos: new T.Vector3(), quat: new T.Quaternion(), w: 1 }), from = { pos: slip.g.position.clone(), quat: slip.g.quaternion.clone(), w: slip.g.scale.x }, ratio = slip.used / slip.usedW;
      slip.pose = which; stopTweens(slip);
      tweens.push({ key: slip, t: 0, dur, ease: EASE.io, done, apply(e) { slip.g.position.lerpVectors(from.pos, to.pos, e); slip.g.quaternion.slerpQuaternions(from.quat, to.quat, e); const w = from.w + (to.w - from.w) * e; slip.g.scale.set(w, w * ratio, 1); } });
    }

    /* ---------- moving things ---------- */
    const EASE = { out: (t) => 1 - Math.pow(1 - t, 3), in: (t) => t * t, io: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2), back: (t) => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2) };
    const tweens = [], timers = [];
    let time = 0, clock = 0;
    const SPEED = 2; /* every slide, hop and wait runs at this multiple, so a drink is quick to get through */
    function tween(target, to, dur, o) {
      o = o || {}; let from = null;
      tweens.push({ key: target, t: -(o.delay || 0), dur, ease: EASE[o.ease || 'out'], done: o.done, apply(e) { if (!from) { from = {}; for (const k in to) from[k] = target[k]; } for (const k in to) target[k] = from[k] + (to[k] - from[k]) * e; } });
    }
    function stopTweens(key) { for (let i = tweens.length - 1; i >= 0; i--) if (tweens[i].key === key) tweens.splice(i, 1); }
    function runTweens(dt) {
      for (let i = 0; i < tweens.length; i++) {
        const tw = tweens[i]; tw.t += dt;
        if (tw.t < 0) continue;
        const u = Math.min(1, tw.t / tw.dur); tw.apply(tw.ease(u));
        if (u >= 1) { tweens.splice(tweens.indexOf(tw), 1); i--; if (tw.done) tw.done(); }
      }
    }
    const after = (sec, fn) => timers.push({ at: clock + sec, fn });
    function runTimers() { for (let i = 0; i < timers.length; i++) if (clock >= timers[i].at) { const t = timers.splice(i, 1)[0]; i--; t.fn(); } }

    /* ---------- the view, to suit the shape of the screen ---------- */
    /* On a tall screen the counter is seen from higher up and the choices stand in two rows, the back row on a step; on a wide
       one they stand in a single row with the cup and the receipt at either end. The camera backs off until everything fits. */
    function frame() {
      const cam = view.camera; aspect = W.aspect; tall = aspect < 1;
      cam.aspect = aspect; cam.fov = W.camera.fov; cam.updateProjectionMatrix();
      const el = (tall ? 31 : 19) * RAD, dir = new T.Vector3(0, Math.sin(el), Math.cos(el)), zT = tall ? 0 : -0.3;
      const pts = (tall ? [[0.86, 0.3, 0.3], [-0.86, 0.3, 0.3], [0, 1.42, -1.5], [0, 0, 1.64], [0.74, 0, 1.3], [-0.74, 0, 1.3]] : [[1.9, 0.3, 0.5], [-1.9, 0.3, 0.5], [0, 1.22, -1.25], [0, 0, 0.95]]).map((p) => new T.Vector3(p[0], p[1], p[2]));
      const v = new T.Vector3(), fits = (p) => { v.copy(p).project(cam); return Math.abs(v.x) <= 0.97 && v.y <= 0.84 && v.y >= -0.9; };
      let best = null;
      for (let ty = 0.1; ty <= 1.21; ty += 0.05) for (let d = 2; d < 12; d += 0.05) {
        cam.position.set(0, ty, zT).addScaledVector(dir, d); cam.lookAt(0, ty, zT); cam.updateMatrixWorld();
        if (pts.every(fits)) { if (!best || d < best.d - 0.01) best = { d, ty }; break; }
      }
      best = best || { d: 6, ty: 0.5 };
      cam.position.set(0, best.ty, zT).addScaledVector(dir, best.d); cam.lookAt(0, best.ty, zT); cam.updateMatrixWorld();
      riser.visible = tall;
      // hang the window, the sign, the lights and the lamps where this view can see them
      const on = (nx, ny, z) => { v.set(nx, ny, 0.5).unproject(cam).sub(cam.position).normalize(); return cam.position.clone().addScaledVector(v, (z - cam.position.z) / v.z); };
      let p = on(tall ? 0.6 : 0.5, tall ? 0.5 : 0.42, -3.37); decor.win.position.set(p.x, p.y, -3.37);
      p = on(tall ? -0.6 : -0.5, tall ? 0.5 : 0.42, -3.36); decor.board.position.set(p.x, p.y, -3.36);
      decor.lights.position.y = on(0, tall ? 0.8 : 0.9, -3.34).y;
      decor.lamps.children.forEach((l) => { const q = on(l.userData.side * (tall ? 0.52 : 0.6), tall ? 0.97 : 0.93, -1.6); l.position.copy(q); });
    }
    const cupSlot = () => (tall ? { x: -0.5, y: 0, z: 1.3 } : { x: -1.62, y: 0, z: 0.5 });
    /* Where n things stand on the counter. */
    function slots(n, step) {
      const row = (k, y, z, p) => { const out = []; for (let i = 0; i < k; i++) out.push({ x: (i - (k - 1) / 2) * p, y, z }); return out; };
      if (!tall) return row(n, 0, 0.45, 0.52);
      if (step === 'extras') return row(n, 0, 0.28, 0.43);          // the extras are small: all four fit side by side, with their cards clear
      if (n <= 3) return row(n, 0, 0.28, 0.57);
      const back = Math.ceil(n / 2);
      return row(back, RISE, -0.3, 0.57).concat(row(n - back, 0, 0.24, 0.57));
    }

    /* ---------- the customer ---------- */
    const made = {};
    let cust = null;
    const custZ = () => (tall ? -1.5 : -1.25);
    function seat(c) { const s = tall ? 1.16 : 1.0; c.g.scale.setScalar(s); c.g.position.z = custZ(); c.baseY = (tall ? 0.96 : 0.8) - 1.7 * s; }
    function mood(c, m) { c.mood = m; c.smile.visible = m !== 'sad'; c.frown.visible = m === 'sad'; c.brows.forEach((b) => { b.visible = m === 'sad'; }); }
    function bring(kind) {
      if (cust) cust.g.visible = false;
      if (!made[kind]) { made[kind] = critter(kind); view.scene.add(made[kind].g); }
      cust = made[kind]; cust.g.visible = true; mood(cust, 'calm'); seat(cust); cust.hop = 0; cust.walk = 1;
      stopTweens(cust.g.position); cust.g.position.x = -3.4; tween(cust.g.position, { x: 0 }, 0.75, { ease: 'out', done: () => { cust.walk = 0; } });
    }
    function animate(c, dt) {
      const bob = c.walk ? Math.abs(Math.sin(time * 11)) * 0.06 : Math.sin(time * 2.1) * 0.012;
      c.hop = Math.max(0, c.hop - dt);
      c.g.position.y = c.baseY + bob + (c.hop ? Math.abs(Math.sin(c.hop * 9)) * 0.14 : 0);
      c.head.rotation.z = c.mood === 'sad' ? Math.sin(time * 9) * 0.1 * Math.min(1, Math.max(0, 1.6 - (time - failAt))) : Math.sin(time * 1.3) * 0.04;
      c.head.rotation.x = c.mood === 'sad' ? 0.16 : 0;
      c.blink -= dt; const shut = c.blink < 0.12;
      c.eyes.forEach((e) => { e.scale.y = shut ? 0.12 : 1; });
      if (c.blink < 0) c.blink = 2 + Math.random() * 3;
    }

    /* ---------- the game ---------- */
    let r = null, mode = 'idle', active = [], failAt = 0, failReady = false, readAt = 0, box = null, input = null;
    const center = (o) => new T.Vector3(o.obj.position.x, o.obj.position.y + o.h / 2, o.obj.position.z);
    function screenOf(v) { const p = v.clone().project(view.camera); return { x: (p.x * 0.5 + 0.5) * window.innerWidth, y: (-p.y * 0.5 + 0.5) * window.innerHeight }; }
    const pxPerUnit = (v) => window.innerHeight / (2 * Math.tan(view.camera.fov * RAD / 2) * view.camera.position.distanceTo(v));
    function optAt(x, y) {
      let best = null, bd = 1e9;
      active.forEach((o) => { const c = center(o), s = screenOf(c), d = Math.hypot(s.x - x, s.y - y), reach = Math.max(38, pxPerUnit(c) * Math.max(o.h, 0.42) * 0.6); if (d < reach && d < bd) { bd = d; best = o; } });
      return best;
    }
    function hideAll() { Object.keys(sets).forEach((k) => sets[k].forEach((o) => { stopTweens(o.obj.position); o.obj.visible = false; o.on = false; })); active = []; }
    function reset() {
      tweens.length = 0; timers.length = 0; hideAll(); dropCup();
      slip.g.visible = false; slip.pose = 'hidden';
      Object.keys(made).forEach((k) => { made[k].g.visible = false; }); cust = null;
      if (box) { box.hidden = true; input.blur(); }
      mode = 'idle'; failReady = false; r = run();
    }
    /* A new customer walks up and puts their receipt on the counter; it is picked up to be read. */
    function nextCustomer() {
      mode = 'enter'; r.next(); K.hint('');
      dropCup(); bring(r.order.customer);
      slip.n = r.served + 1; printSlip(r.order, null); slip.g.visible = false;
      after(0.7, () => { slip.g.visible = true; slipSet('drop'); A.play('pop'); slipTo('read', 0.55, () => { mode = 'read'; readAt = time; K.hint(tr('Remember the order, then tap the receipt')); }); });
    }
    function beginDrink() { A.play('tap'); r.begin(); mode = 'busy'; slipTo('rest', 0.45); showStep(); }
    /* The things for this step slide along the counter from the right. */
    function showStep() {
      const st = r.current(); K.hint(tr(st.ask));
      active = sets[st.id].slice();
      const at = slots(active.length, st.id);
      active.forEach((o, i) => { o.slot = at[i]; o.on = false; o.obj.visible = true; stopTweens(o.obj.position); o.obj.position.set(at[i].x + 4.2, at[i].y, at[i].z); o.obj.rotation.set(0, 0, 0); tween(o.obj.position, { x: at[i].x }, 0.5, { delay: i * 0.05, ease: 'out' }); });
      A.play('whoosh');
      mode = 'busy'; after(0.42, () => { if (mode === 'busy') mode = st.text ? 'name' : 'choose'; if (st.text) askName(); });
    }
    /* ...and away to the left when the choice is made. */
    function clearStep() {
      active.forEach((o, i) => { stopTweens(o.obj.position); tween(o.obj.position, { x: o.slot.x - 4.2 }, 0.4, { delay: i * 0.03, ease: 'in', done: () => { o.obj.visible = false; } }); });
      active = [];
    }
    function hopUp(o) { stopTweens(o.obj.position); o.obj.position.x = o.slot.x; tween(o.obj.position, { y: o.slot.y + 0.16 }, 0.14, { ease: 'out', done: () => tween(o.obj.position, { y: o.slot.y }, 0.16, { ease: 'in' }) }); }
    function right(res, step, val) {
      A.play('pop'); if (step) cupAdd(step, val); mode = 'busy';
      after(0.36, () => { clearStep(); if (res === 'served') serve(); else showStep(); });
    }
    function choose(o) {
      const st = r.current();
      if (!st) return;
      if (o.pen) { input.focus(); return; }
      if (st.multi) {                                       // each extra goes in as it is tapped; the step ends by itself when they are all in
        if (o.on) return;
        const more = r.add(o.id);
        if (more === 'wrong') { wrong(); return; }
        o.on = true; stopTweens(o.obj.position); o.obj.position.x = o.slot.x; tween(o.obj.position, { y: o.slot.y + 0.17 }, 0.16);
        cupAdd('extras', r.extras.slice());
        if (more === 'more') A.play('pop'); else right(more, null);
        return;
      }
      const res = r.pick(o.id);
      if (res === 'wrong') { wrong(); return; }
      hopUp(o); right(res, st.id, o.id);
    }
    function askName() { box.hidden = false; input.value = ''; input.placeholder = tr('Name'); box.querySelector('button').textContent = tr('OK'); }
    function named(text) {
      const res = r.write(text);
      if (res === 'wrong') { wrong(); return; }
      right(res, 'name', r.order.name);
    }
    /* The drink is right: it goes across the counter, and the customer goes off happy with it. */
    function serve() {
      mode = 'serve'; K.hint(''); K.score(r.served); A.play('coin'); K.big(tr('Perfect!'));
      const c = cust, mine = cup;
      stopTweens(mine.g.position); tween(mine.g.position, { x: 0, y: tall ? RISE : 0, z: tall ? -0.36 : -0.5 }, 0.5, { ease: 'io' });
      after(0.5, () => { mood(c, 'happy'); c.hop = 0.7; A.play('chirp'); });
      after(1.35, () => {
        c.walk = 1; tween(c.g.position, { x: 3.6 }, 0.7, { ease: 'in' }); tween(mine.g.position, { x: 3.6 }, 0.7, { ease: 'in' });
        tween(slip.g.position, { x: slip.g.position.x - 3.5 }, 0.5, { ease: 'in', done: () => { slip.g.visible = false; } });
      });
      after(2.0, nextCustomer);
    }
    /* The drink is wrong: the customer is not pleased, and the receipt comes back up marked with where it went wrong. */
    function wrong() {
      mode = 'fail'; failAt = time; failReady = false; K.hint(''); A.play('nope'); K.big(tr('Wrong drink!'));
      if (box) { box.hidden = true; input.blur(); }
      if (cust) mood(cust, 'sad');
      clearStep();
      after(1.0, () => { printSlip(r.order, r); A.play('sad'); slip.g.visible = true; slipTo('read', 0.5, () => { failReady = true; K.hint(tr('Tap to finish')); }); });
    }
    function finish() { if (mode === 'done') return; mode = 'done'; K.hint(''); K.over(tr('{0} served', r.served)); }
    function tap(x, y) {
      if (mode === 'read') { if (time - readAt > 0.3) beginDrink(); }
      else if (mode === 'choose' || mode === 'name') { const o = optAt(x, y); if (o) choose(o); }
      else if (mode === 'fail' && failReady) finish();
    }
    /* The screen changed shape (the phone was turned, or its keyboard came up): put everything where it belongs now. */
    function relayout() {
      if (cust) seat(cust);
      if (cup && mode !== 'serve') { stopTweens(cup.g.position); const s = cupSlot(); cup.g.position.set(s.x, s.y, s.z); }
      if (active.length) { const at = slots(active.length, r && r.current() ? r.current().id : ''); active.forEach((o, i) => { o.slot = at[i]; stopTweens(o.obj.position); o.obj.position.set(at[i].x, at[i].y + (o.on ? 0.17 : 0), at[i].z); }); }
      if (slip.g.visible && slip.pose !== 'hidden' && r && r.order) { stopTweens(slip); printSlip(r.order, slip.review ? r : null); slipSet(slip.pose); }
    }
    function build() {
      buildRoom();
      nameTex = paintTex(256, 112, (g, w, h) => { if (!cupName) return; g.fillStyle = PAPER; round(g, 6, 6, w - 12, h - 12, 20); g.fill(); words(g, cupName, w / 2, h / 2, w - 70, 58, '#1d2b6b'); });
      buildThings(); buildSlip();
      box = document.createElement('div'); box.className = 'cfn'; box.id = 'coffeeName'; box.hidden = true;
      box.innerHTML = '<input class="field" id="coffeeNameIn" maxlength="12" autocomplete="off" autocapitalize="words" autocorrect="off" spellcheck="false" enterkeyhint="done"><button id="coffeeNameOk" type="button"></button>';
      document.getElementById('gamehud').appendChild(box);
      input = box.querySelector('input');
      const send = () => { if (mode !== 'name' || !input.value.trim()) return; const text = input.value; input.blur(); box.hidden = true; named(text); };
      box.querySelector('button').addEventListener('click', send);
      input.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') send(); });
      lang = PN.lang;
    }
    return {
      label: 'Drinks', nocount: true, hint: '',
      view: () => view,
      start() {
        if (!view) build();
        if (lang !== PN.lang) { painted.forEach(repaint); lang = PN.lang; }
        reset(); frame(); time = 0;
      },
      stop() { reset(); },
      go() { K.score(0, true); nextCustomer(); },
      pointer(type, x, y) { if (type === 'down') tap(x, y); },
      key() {},
      update(dt) {
        time += dt;
        if (W.aspect !== aspect) { frame(); relayout(); }
        clock += dt * SPEED;
        runTimers(); runTweens(dt * SPEED);
        if (cust) animate(cust, dt * SPEED);
        if (cup) cup.steam.forEach((p) => { const u = (time * 0.45 + p.userData.ph) % 1; p.position.set(Math.sin(u * 7 + p.userData.ph * 9) * 0.03, cup.surf + 0.06 + u * 0.3, 0); p.material.opacity = 0.42 * Math.sin(u * PI); p.scale.setScalar(0.1 + u * 0.12); });
        bulbs.forEach((b) => { b.h.material.opacity = 0.38 + 0.16 * Math.sin(time * 1.7 + b.ph); });
        if (mode === 'fail' && failReady && time - failAt > 14) finish();
      },
      /* For the tests: what is on the counter and where on the screen it is. */
      peek() {
        return { mode, tall, game: r, eyes: cust ? cust.eyes[0].scale.y : null, served: r ? r.served : 0, order: r && r.order, step: r && r.current() ? r.current().id : null,
          opts: active.map((o) => { const s = screenOf(center(o)); return { id: o.id, x: s.x, y: s.y, on: o.on }; }),
          slip: slip.g && slip.g.visible ? screenOf(slip.g.position) : null, pose: slip.pose };
      },
    };
  }

  /* The arcade looks for its games in PN.Games.ext. This file is loaded before the arcade, so the game is put there once the whole page
     has been read (and straight away if this file was fetched late, to replace an old copy of it). */
  let game = null;
  function register() {
    if (!PN.Games || !PN.Games.kit || !PN.U || !PN.World) return false;
    if (!game) game = make();
    PN.Games.ext.coffee = game;
    return true;
  }
  PN.Coffee.register = register;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', register); else register();
})(window.PN = window.PN || {});
