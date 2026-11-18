/* Pikku Norppa: how a seal looks.
   Two layers. Natural traits are chosen when she is born (or picked in the creator at the start), are what
   her pups inherit, and are never changed by surgery. Plastic Sturgeon makeovers change only `appearance`,
   which can also carry clinic-only extras: dream colours, special markings, coat designs, face details,
   eye styles, coat finishes and overall size. No drawing or saving happens here. */
(function (PN) {
  'use strict';
  const A = PN.Appearance = {};

  /* id: [English, Finnish, hex, dream]. Dream colours are never natural: only the clinic sells them. */
  A.colors = {
    original: ['Classic', 'Klassinen', 'linear-gradient(135deg,#f6f3ec 50%,#788492 50%)'],
    silver: ['Silver', 'Hopea', '#a5afb9'], grey: ['Pebble', 'Kivenharmaa', '#7d8790'],
    charcoal: ['Charcoal', 'Hiilenharmaa', '#51565e'], brown: ['Cocoa', 'Kaakao', '#8a7567'],
    sand: ['Sand', 'Hiekka', '#b5a18a'], cream: ['Cream', 'Kerma', '#ddd3bc'],
    ivory: ['Ivory', 'Norsunluu', '#f7f1e3'], pearl: ['Pearl', 'Helmi', '#dde5ea'], snow: ['Snow', 'Lumi', '#fbfbf8'],
    dark: ['Dark', 'Tumma', '#241b19'], hazel: ['Hazel', 'Pähkinä', '#725234'],
    pink: ['Pastel pink', 'Pastelliroosa', '#efa9c6', 1], blue: ['Baby blue', 'Vaaleansininen', '#a0cdea', 1],
    lavender: ['Lavender', 'Laventeli', '#c3afe7', 1], mint: ['Mint', 'Minttu', '#a6dbbf', 1],
    peach: ['Peach', 'Persikka', '#f1bd9f', 1], coral: ['Coral', 'Koralli', '#f07f86', 1],
    gold: ['Gold', 'Kulta', '#efc459', 1], amber: ['Cloudberry', 'Lakka', '#f29a38', 1],
    teal: ['Aurora green', 'Revontuli', '#3fbfa0', 1], ocean: ['Ocean blue', 'Merensininen', '#457eae', 1],
    rose: ['Rose', 'Roosa', '#b56e7d', 1], none: ['None', 'Ei mitään', 'transparent'],
    same: ['Same', 'Sama', 'transparent'],
  };
  A.dream = (id) => !!(A.colors[id] && A.colors[id][3]);
  A.special = A.dream;   // older name, still used by the renderer

  /* Every colour a part can take in the clinic. The creator shows only the ones that are not dream colours. */
  const DESIGN_COLOURS = ['none', 'snow', 'ivory', 'cream', 'sand', 'brown', 'charcoal', 'grey', 'pink', 'coral', 'peach', 'gold', 'amber', 'blue', 'lavender', 'mint', 'teal'];
  A.palettes = {
    coat: ['original', 'silver', 'grey', 'charcoal', 'brown', 'sand', 'cream', 'pink', 'blue', 'lavender', 'mint', 'peach'],
    belly: ['original', 'ivory', 'pearl', 'cream', 'sand', 'pink', 'blue', 'lavender', 'mint', 'peach'],
    marking: ['original', 'pearl', 'ivory', 'grey', 'charcoal', 'brown', 'pink', 'blue', 'lavender', 'mint', 'peach'],
    eye: ['dark', 'brown', 'hazel', 'ocean', 'mint', 'lavender', 'gold'],
    eyeRight: ['same', 'dark', 'brown', 'hazel', 'ocean', 'mint', 'lavender', 'gold'],
    nose: ['dark', 'brown', 'charcoal', 'rose', 'pink'],
    decalColor: ['snow', 'pearl', 'charcoal', 'pink', 'coral', 'gold', 'amber', 'blue', 'lavender', 'mint', 'teal'],
    gradient: DESIGN_COLOURS, mask: DESIGN_COLOURS, flippers: DESIGN_COLOURS, tail: DESIGN_COLOURS,
    whiskerColor: ['snow', 'cream', 'charcoal', 'pink', 'blue', 'lavender', 'gold', 'mint'],
  };

  /* Choices that are not colours. */
  A.patterns = { original: ['Classic', 'Klassinen'], ring: ['Rings', 'Renkaat'], spots: ['Spots', 'Pilkut'],
    freckles: ['Freckles', 'Pisamat'], mottled: ['Mottled', 'Laikukas'], plain: ['Plain', 'Yksivärinen'] };
  A.decals = {
    none: ['None', 'Ei mitään'], hearts: ['Hearts', 'Sydämet'], stars: ['Stars', 'Tähdet'], moons: ['Crescent moons', 'Kuunsirpit'],
    flowers: ['Flowers', 'Kukat'], paws: ['Paw prints', 'Tassunjäljet'], snowflakes: ['Snowflakes', 'Lumihiutaleet'],
    leaves: ['Birch leaves', 'Koivunlehdet'], cloudberries: ['Cloudberries', 'Lakat'], aurora: ['Northern lights', 'Revontulet'],
    constellation: ['Constellation', 'Tähdistö'], sparkles: ['Sparkles', 'Kimallus'], butterflies: ['Butterflies', 'Perhoset'],
  };
  A.layouts = { many: ['Lots of little ones', 'Monta pientä'], one: ['One big one', 'Yksi iso'] };
  A.finishes = { none: ['Soft fur', 'Pehmeä turkki'], pearl: ['Pearlescent', 'Helmiäinen'], shimmer: ['Shimmer', 'Kimallus'], aurora: ['Aurora sheen', 'Revontulihohde'] };
  A.cheeks = { none: ['None', 'Ei mitään'], rosy: ['Rosy cheeks', 'Punaiset posket'] };
  A.freckles = { none: ['None', 'Ei mitään'], cheeks: ['Cheek freckles', 'Poskipisamat'] };
  A.eyeStars = { none: ['Round sparkle', 'Pyöreä kiilto'], star: ['Star sparkle', 'Tähtikiilto'] };
  const CHOICES = { pattern: A.patterns, decal: A.decals, decalLayout: A.layouts, finish: A.finishes, cheeks: A.cheeks, freckles: A.freckles, eyeStar: A.eyeStars };
  A.choices = CHOICES;

  /* Sliders: the clinic's full reach, and the gentler range the creator allows for a natural seal. */
  A.ranges = { patternSize: [0.6, 1.5], patternOpacity: [0.2, 1], eyeSize: [0.85, 1.2], eyeSpacing: [0.85, 1.15],
    noseSize: [0.8, 1.3], size: [0.8, 1.25], headSize: [0.85, 1.2], bodyWidth: [0.85, 1.2], bodyLength: [0.85, 1.2],
    decalSize: [0.6, 1.6], decalOpacity: [0.3, 1], whiskerLength: [0.6, 1.5] };
  A.naturalRanges = { patternSize: [0.7, 1.3], patternOpacity: [0.35, 0.95], eyeSize: [0.94, 1.08], eyeSpacing: [0.95, 1.05],
    noseSize: [0.92, 1.1], headSize: [0.95, 1.06], bodyWidth: [0.94, 1.08], bodyLength: [0.94, 1.06] };

  A.defaults = { coat: 'original', belly: 'original', marking: 'original', pattern: 'original', eye: 'dark', nose: 'dark',
    patternSize: 1, patternOpacity: 0.8, eyeSize: 1, eyeSpacing: 1, noseSize: 1, size: 1, headSize: 1, bodyWidth: 1, bodyLength: 1, seed: 31,
    // clinic only, never inherited
    eyeRight: 'same', eyeStar: 'none', cheeks: 'none', freckles: 'none', whiskerColor: 'snow', whiskerLength: 1,
    decal: 'none', decalColor: 'snow', decalSize: 1, decalOpacity: 0.9, decalLayout: 'many',
    gradient: 'none', mask: 'none', flippers: 'none', tail: 'none', finish: 'none' };
  A.NATURAL_KEYS = ['coat', 'belly', 'marking', 'pattern', 'eye', 'nose', 'patternSize', 'patternOpacity', 'eyeSize', 'eyeSpacing', 'noseSize', 'headSize', 'bodyWidth', 'bodyLength'];

  const copy = (v) => Object.assign({}, v);
  const rng = (seed) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return (seed >>> 0) / 4294967296; };
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  const round2 = (n) => Math.round(n * 100) / 100;
  /* A colour the creator may offer: in the part's palette and not a dream colour. */
  A.naturalPalette = (key) => (A.palettes[key] || []).filter((id) => !A.dream(id));

  A.normalize = function (input) {
    const a = copy(A.defaults), src = input || {};
    Object.keys(A.palettes).forEach((k) => { if (A.palettes[k].includes(src[k])) a[k] = src[k]; });
    Object.keys(CHOICES).forEach((k) => { if (Object.prototype.hasOwnProperty.call(CHOICES[k], src[k])) a[k] = src[k]; });
    Object.keys(A.ranges).forEach((k) => { if (typeof src[k] === 'number' && Number.isFinite(src[k])) a[k] = round2(clamp(src[k], A.ranges[k][0], A.ranges[k][1])); });
    if (Number.isFinite(src.seed)) a.seed = src.seed | 0;
    return a;
  };
  A.equal = (a, b) => Object.keys(A.defaults).every((k) => a[k] === b[k]);

  /* Force a look back inside what a natural seal can be: natural colours, gentle proportions, no clinic extras. */
  A.naturalOnly = function (input) {
    const src = A.normalize(input), a = copy(A.defaults);
    a.seed = src.seed;
    ['coat', 'belly', 'marking', 'eye', 'nose'].forEach((k) => { if (!A.dream(src[k])) a[k] = src[k]; });
    a.pattern = src.pattern;
    Object.keys(A.naturalRanges).forEach((k) => { const [lo, hi] = A.naturalRanges[k]; a[k] = round2(clamp(src[k], lo, hi)); });
    return a;
  };

  /* A natural seal: random, or taking after a parent (her natural traits only, never her makeovers). */
  A.natural = function (seed, parent) {
    const r = rng(seed), a = copy(A.defaults), p = parent ? A.normalize(parent) : null;
    const choose = (k, values, fallback) => {
      if (p && r() < 0.65) return values.includes(p[k]) ? p[k] : fallback;
      return values[Math.floor(r() * values.length)];
    };
    a.seed = seed | 0;
    a.coat = choose('coat', ['silver', 'grey', 'charcoal', 'brown', 'sand', 'cream', 'original'], 'silver');
    a.belly = choose('belly', ['ivory', 'pearl', 'cream', 'original'], 'ivory');
    a.marking = choose('marking', ['pearl', 'ivory', 'grey', 'charcoal', 'brown', 'original'], 'pearl');
    a.pattern = choose('pattern', ['ring', 'ring', 'spots', 'freckles', 'mottled', 'plain', 'original'], 'ring');
    a.eye = choose('eye', ['dark', 'dark', 'brown', 'hazel'], 'dark');
    a.nose = choose('nose', ['dark', 'dark', 'brown', 'charcoal'], 'dark');
    Object.keys(A.naturalRanges).forEach((k) => {
      const [lo, hi] = A.naturalRanges[k], mid = (lo + hi) / 2, n = lo + r() * (hi - lo);
      // Keep fresh rolls nearer the middle; a pup lands halfway between a roll and her mother.
      const fresh = mid + (n - mid) * 0.7;
      a[k] = round2(p ? fresh * 0.5 + clamp(p[k], lo, hi) * 0.5 : fresh);
    });
    return a;
  };
  A.surprise = (seed) => A.natural(seed == null ? (Math.random() * 2147483647) | 0 : seed);

  /* Saves from before appearances keep their familiar age-based look. */
  A.ensure = function (seal) {
    if (!seal) return;
    seal.birthAppearance = A.naturalOnly(seal.birthAppearance);
    seal.appearance = A.normalize(seal.appearance || seal.birthAppearance);
    seal.appearance.seed = seal.birthAppearance.seed;
  };
  A.born = function (seal, seed, parent) {
    seal.birthAppearance = A.natural(seed, parent);
    seal.appearance = copy(seal.birthAppearance);
  };
  /* The creator at the start: free, natural traits only. Sets both layers. */
  A.create = function (seal, input) {
    const a = A.naturalOnly(input);
    a.seed = A.normalize(seal.birthAppearance).seed;
    seal.birthAppearance = a; seal.appearance = copy(a);
    seal.lookChosen = true;
    return a;
  };
  /* A seal born before the creator existed is offered it once, free. */
  A.canChooseFree = (state) => !state.lookChosen;

  A.target = function (state, id, now) {
    if (id == null || id === 'main') return state;
    if (/^family:\d+$/.test(String(id))) {
      const p = state.family[+String(id).slice(7)];
      return p && p.fate === 'grown' && PN.Sim.visitStatus(p, now) === 'here' ? p : null;
    }
    return state.pups.find((p) => String(p.id) === String(id)) || null;
  };

  /* Shape work is priced by where it ends up, measured against this seal's own birth proportions,
     so many small purchases cost the same as one big one. */
  A.shapeCost = function (next, birth, keys, base) {
    const distance = Math.max(...keys.map((k) => {
      const [lo, hi] = A.ranges[k], delta = next[k] - birth[k];
      return Math.abs(delta) / Math.max(0.01, delta < 0 ? birth[k] - lo : hi - birth[k]);
    }));
    return Math.round(base * (0.35 + 1.65 * Math.pow(Math.min(1, distance), 1.5)) / 50) * 50;
  };

  /* The clinic's price list. Each line: label, the keys it covers, and its cost given (next, before, birth).
     Returning to the natural look is a procedure too, and costs the same as any other change. */
  const colourCost = (k, natural, dream) => (n) => (A.dream(n[k]) ? dream : natural);
  const extra = (k, add, remove) => (n) => (n[k] === 'none' || n[k] === 'same' ? remove : add);
  const PROCEDURES = [
    { label: 'Coat colour', keys: ['coat'], cost: colourCost('coat', 2500, 10000) },
    { label: 'Belly colour', keys: ['belly'], cost: colourCost('belly', 2500, 6000) },
    { label: 'Coat finish', keys: ['finish'], cost: (n) => ({ none: 1500, pearl: 12000, shimmer: 12000, aurora: 20000 })[n.finish] },
    { label: 'Back pattern', keys: ['pattern', 'patternSize', 'patternOpacity'], cost: () => 3500 },
    { label: 'Marking colour', keys: ['marking'], cost: colourCost('marking', 2500, 6000) },
    { label: 'Special marking', keys: ['decal', 'decalColor', 'decalSize', 'decalOpacity', 'decalLayout'],
      cost: (n, b) => (n.decal === 'none' ? 2500 : n.decal !== b.decal ? 7500 : 2500) },
    { label: 'Head to tail fade', keys: ['gradient'], cost: extra('gradient', 4000, 1500) },
    { label: 'Face mask', keys: ['mask'], cost: extra('mask', 4000, 1500) },
    { label: 'Flipper tips', keys: ['flippers'], cost: extra('flippers', 4000, 1500) },
    { label: 'Dipped tail', keys: ['tail'], cost: extra('tail', 4000, 1500) },
    { label: 'Eyes', keys: ['eye', 'eyeSize', 'eyeSpacing'], cost: (n, b, birth, changed) => (changed('eye') ? (A.dream(n.eye) ? 3000 : 1500) : 0) + (changed('eyeSize', 'eyeSpacing') ? A.shapeCost(n, birth, ['eyeSize', 'eyeSpacing'], 1500) : 0) },
    { label: 'Odd eyes', keys: ['eyeRight'], cost: extra('eyeRight', 3000, 1500) },
    { label: 'Star sparkle', keys: ['eyeStar'], cost: extra('eyeStar', 3000, 1500) },
    { label: 'Nose', keys: ['nose', 'noseSize'], cost: (n, b, birth, changed) => (changed('nose') ? 1500 : 0) + (changed('noseSize') ? A.shapeCost(n, birth, ['noseSize'], 1500) : 0) },
    { label: 'Rosy cheeks', keys: ['cheeks'], cost: extra('cheeks', 2000, 1000) },
    { label: 'Cheek freckles', keys: ['freckles'], cost: extra('freckles', 2000, 1000) },
    { label: 'Whiskers', keys: ['whiskerColor', 'whiskerLength'], cost: () => 2000 },
    { label: 'Head size', keys: ['headSize'], cost: (n, b, birth) => A.shapeCost(n, birth, ['headSize'], 4000) },
    { label: 'Body shape', keys: ['bodyWidth', 'bodyLength'], cost: (n, b, birth) => A.shapeCost(n, birth, ['bodyWidth', 'bodyLength'], 4000) },
    { label: 'Overall size', keys: ['size'], cost: (n, b, birth) => A.shapeCost(n, birth, ['size'], 5000) },
  ];
  A.PROCEDURES = PROCEDURES;

  A.quote = function (seal, input) {
    const before = A.normalize(seal.appearance), birth = A.normalize(seal.birthAppearance), next = A.normalize(input);
    next.seed = birth.seed;
    const changed = (...keys) => keys.some((k) => before[k] !== next[k]);
    const lines = PROCEDURES.filter((p) => changed(...p.keys)).map((p) => ({ label: p.label, cost: p.cost(next, before, birth, changed) }));
    return { next, lines, total: lines.reduce((n, l) => n + l.cost, 0), changed: lines.length > 0, restoring: lines.length > 0 && A.equal(next, birth) };
  };
  A.unlocked = (state) => !!state.dev || Math.max(state.maxLevel || 1, PN.Sim.level(state).level) >= 30;
  A.purchase = function (state, id, input, now) {
    if (!A.unlocked(state)) return { ok: false, why: 'locked' };
    const target = A.target(state, id, now);
    if (!target) return { ok: false, why: 'away' };
    const q = A.quote(target, input);
    if (!q.changed) return { ok: false, why: 'unchanged' };
    if (!state.dev && (!Number.isFinite(state.coins) || state.coins < q.total)) return { ok: false, why: 'coins' };
    const cost = state.dev ? 0 : q.total;
    state.coins -= cost;
    target.appearance = q.next;   // birthAppearance is never touched by surgery
    return { ok: true, cost };
  };
})(window.PN = window.PN || {});
