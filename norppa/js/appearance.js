/* Natural traits and Plastic Sturgeon purchases. No rendering or storage side effects here. */
(function (PN) {
  'use strict';
  const A = PN.Appearance = {};
  A.colors = {
    original: ['Age coat', 'Ikäturkki', '#8795a5'],
    silver: ['Silver', 'Hopea', '#a5afb9'], grey: ['Pebble', 'Kivenharmaa', '#7d8790'],
    charcoal: ['Charcoal', 'Hiilenharmaa', '#51565e'], brown: ['Cocoa', 'Kaakao', '#8a7567'],
    sand: ['Sand', 'Hiekka', '#b5a18a'], cream: ['Cream', 'Kerma', '#ddd3bc'],
    ivory: ['Ivory', 'Norsunluu', '#f7f1e3'], pearl: ['Pearl', 'Helmi', '#dde5ea'],
    pink: ['Pastel pink', 'Pastelliroosa', '#efa9c6', true], blue: ['Baby blue', 'Vaaleansininen', '#a0cdea', true],
    lavender: ['Lavender', 'Laventeli', '#c3afe7', true], mint: ['Mint', 'Minttu', '#a6dbbf', true],
    peach: ['Peach', 'Persikka', '#f1bd9f', true],
    dark: ['Dark', 'Tumma', '#241b19'], hazel: ['Hazel', 'Pähkinä', '#725234'],
    ocean: ['Ocean blue', 'Merensininen', '#457eae', true], rose: ['Rose', 'Roosa', '#b56e7d', true]
  };
  A.palettes = {
    coat: ['original', 'silver', 'grey', 'charcoal', 'brown', 'sand', 'cream', 'pink', 'blue', 'lavender', 'mint', 'peach'],
    belly: ['original', 'ivory', 'pearl', 'cream', 'sand', 'pink', 'blue', 'lavender', 'mint', 'peach'],
    marking: ['original', 'pearl', 'ivory', 'grey', 'charcoal', 'brown', 'pink', 'blue', 'lavender', 'mint', 'peach'],
    eye: ['dark', 'brown', 'hazel', 'ocean', 'mint', 'lavender'], nose: ['dark', 'brown', 'charcoal', 'rose']
  };
  A.patterns = { original: ['Age markings', 'Ikäkuvio'], ring: ['Rings', 'Renkaat'], spots: ['Spots', 'Pilkut'],
    freckles: ['Freckles', 'Pisamat'], mottled: ['Mottled', 'Laikukas'], plain: ['Plain', 'Yksivärinen'] };
  A.ranges = { patternSize: [0.6, 1.5], patternOpacity: [0.2, 1], eyeSize: [0.85, 1.2], eyeSpacing: [0.85, 1.15],
    noseSize: [0.8, 1.3], size: [0.8, 1.25], headSize: [0.85, 1.2], bodyWidth: [0.85, 1.2], bodyLength: [0.85, 1.2] };
  A.defaults = { coat: 'original', belly: 'original', marking: 'original', pattern: 'original', eye: 'dark', nose: 'dark',
    patternSize: 1, patternOpacity: 0.8, eyeSize: 1, eyeSpacing: 1, noseSize: 1, size: 1, headSize: 1, bodyWidth: 1, bodyLength: 1, seed: 31 };
  const copy = (v) => Object.assign({}, v);
  const rng = (seed) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return (seed >>> 0) / 4294967296; };
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  A.normalize = function (input) {
    const a = copy(A.defaults), src = input || {};
    Object.keys(A.palettes).forEach((k) => { if (A.palettes[k].includes(src[k])) a[k] = src[k]; });
    if (Object.hasOwn(A.patterns, src.pattern)) a.pattern = src.pattern;
    Object.keys(A.ranges).forEach((k) => { if (typeof src[k] === 'number' && Number.isFinite(src[k])) a[k] = Math.round(clamp(src[k], ...A.ranges[k]) * 100) / 100; });
    if (Number.isFinite(src.seed)) a.seed = src.seed | 0;
    return a;
  };
  A.equal = (a, b) => Object.keys(A.defaults).every((k) => a[k] === b[k]);
  A.special = (id) => !!(A.colors[id] && A.colors[id][3]);
  // A procedure is priced by its destination, measured against this seal's own
  // birth proportions. Repeated small purchases cannot bypass the premium.
  A.shapeCost = function (next, birth, keys, base) {
    const distance = Math.max(...keys.map((k) => {
      const [lo, hi] = A.ranges[k], delta = next[k] - birth[k];
      return Math.abs(delta) / Math.max(0.01, delta < 0 ? birth[k] - lo : hi - birth[k]);
    }));
    return Math.round(base * (0.35 + 1.65 * Math.pow(Math.min(1, distance), 1.5)) / 50) * 50;
  };
  A.natural = function (seed, parent) {
    const r = rng(seed), a = copy(A.defaults), p = A.normalize(parent);
    const choose = (k, values, fallback) => {
      const inherited = values.includes(p[k]) ? p[k] : fallback;
      return parent && r() < 0.65 ? inherited : values[Math.floor(r() * values.length)];
    };
    a.seed = seed | 0;
    a.coat = choose('coat', ['silver', 'grey', 'charcoal', 'brown', 'sand', 'cream'], 'silver');
    a.belly = choose('belly', ['ivory', 'pearl', 'cream'], 'ivory');
    a.marking = choose('marking', ['pearl', 'ivory', 'grey', 'charcoal', 'brown'], 'pearl');
    a.pattern = choose('pattern', ['ring', 'ring', 'spots', 'freckles', 'mottled', 'plain'], 'ring');
    a.eye = choose('eye', ['dark', 'brown'], 'dark'); a.nose = choose('nose', ['dark', 'brown'], 'dark');
    const limits = { size: [0.94, 1.06], headSize: [0.96, 1.05], bodyWidth: [0.94, 1.08], bodyLength: [0.94, 1.06],
      eyeSize: [0.97, 1.04], eyeSpacing: [0.97, 1.03], noseSize: [0.96, 1.04], patternSize: [0.75, 1.2], patternOpacity: [0.45, 0.85] };
    Object.keys(limits).forEach((k) => { const [lo, hi] = limits[k], n = lo + r() * (hi - lo);
      a[k] = Math.round((parent ? n * 0.5 + clamp(p[k], lo, hi) * 0.5 : n) * 100) / 100; });
    return a;
  };
  // Called before filling legacy saves: their familiar age-based appearance stays intact.
  A.ensure = function (seal) {
    seal.birthAppearance = A.normalize(seal.birthAppearance);
    seal.appearance = A.normalize(seal.appearance || seal.birthAppearance);
    seal.appearance.seed = seal.birthAppearance.seed;
  };
  A.born = function (seal, seed, parent) {
    seal.birthAppearance = A.natural(seed, parent);
    seal.appearance = copy(seal.birthAppearance);
  };
  A.target = function (state, id, now) {
    if (id == null || id === 'main') return state;
    if (/^family:\d+$/.test(String(id))) {
      const p = state.family[+String(id).slice(7)];
      return p && p.fate === 'grown' && PN.Sim.visitStatus(p, now) === 'here' ? p : null;
    }
    return state.pups.find((p) => String(p.id) === String(id)) || null;
  };
  A.quote = function (seal, input) {
    const before = A.normalize(seal.appearance), birth = A.normalize(seal.birthAppearance), next = A.normalize(input);
    next.seed = birth.seed;
    const lines = [], changed = (...keys) => keys.some((k) => before[k] !== next[k]);
    const add = (label, cost) => lines.push({ label, cost });
    const restoring = A.equal(next, birth);
    if (!A.equal(before, next)) {
      // Returning to birth traits is still another paid procedure.
      if (changed('coat')) add('Coat colour', A.special(next.coat) ? 10000 : 2500);
      if (changed('belly')) add('Belly colour', A.special(next.belly) ? 6000 : 2500);
      if (changed('marking')) add('Marking colour', A.special(next.marking) ? 6000 : 2500);
      if (changed('pattern', 'patternSize', 'patternOpacity')) add('Back pattern', 3500);
      if (changed('eye', 'eyeSize', 'eyeSpacing')) add('Eyes', (changed('eye') ? 1500 : 0) + (changed('eyeSize', 'eyeSpacing') ? A.shapeCost(next, birth, ['eyeSize', 'eyeSpacing'], 1500) : 0));
      if (changed('nose', 'noseSize')) add('Nose', (changed('nose') ? 1500 : 0) + (changed('noseSize') ? A.shapeCost(next, birth, ['noseSize'], 1500) : 0));
      if (changed('headSize')) add('Head size', A.shapeCost(next, birth, ['headSize'], 4000));
      if (changed('bodyWidth', 'bodyLength')) add('Body shape', A.shapeCost(next, birth, ['bodyWidth', 'bodyLength'], 4000));
      if (changed('size')) add('Overall size', A.shapeCost(next, birth, ['size'], 5000));
    }
    return { next, lines, total: lines.reduce((n, l) => n + l.cost, 0), changed: lines.length > 0, restoring };
  };
  A.purchase = function (state, id, input, now) {
    if (!state.dev && Math.max(state.maxLevel || 1, PN.Sim.level(state).level) < 30) return { ok: false, why: 'locked' };
    const target = A.target(state, id, now);
    if (!target) return { ok: false, why: 'away' };
    const q = A.quote(target, input);
    if (!q.changed) return { ok: false, why: 'unchanged' };
    if (!state.dev && (!Number.isFinite(state.coins) || state.coins < q.total)) return { ok: false, why: 'coins' };
    const cost = state.dev ? 0 : q.total;
    state.coins -= cost;
    target.appearance = q.next; // birthAppearance is never touched by surgery.
    return { ok: true, cost };
  };
})(window.PN = window.PN || {});
