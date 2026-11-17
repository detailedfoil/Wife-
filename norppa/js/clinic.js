/* Plastic Sturgeon: a disposable preview scene and an atomic, quoted makeover. */
(function (PN) {
  'use strict';
  const A = PN.Appearance, UI = PN.UI, tr = PN.L, esc = UI.esc;
  const C = PN.Clinic = { active: false };
  Object.assign(PN.LANG.FI, {
    'A little nip. A little tuck. A whole new you.': 'Pieni muutos, uusi ilme.',
    'Step into the clinic': 'Astu klinikalle', 'Preview for free. Pay only when you love it.': 'Kokeile ilmaiseksi. Maksa vasta, kun ihastut.',
    'Pups inherit your natural traits, never your makeovers.': 'Kuuttisi perivät luontaisia piirteitäsi, eivät muodonmuutoksiasi.',
    'Coat': 'Turkki', 'Patterns': 'Kuviot', 'Face': 'Kasvot', 'Shape': 'Muoto',
    'Coat colour': 'Turkin väri', 'Belly colour': 'Vatsan väri', 'Marking colour': 'Kuvioiden väri',
    'Back pattern': 'Selän kuvio', 'Pattern size': 'Kuvion koko', 'Pattern intensity': 'Kuvion voimakkuus',
    'Eyes': 'Silmät', 'Eye colour': 'Silmien väri', 'Eye size': 'Silmien koko', 'Eye spacing': 'Silmien etäisyys',
    'Nose': 'Nenä', 'Nose colour': 'Nenän väri', 'Nose size': 'Nenän koko',
    'Head size': 'Pään koko', 'Body shape': 'Vartalon muoto', 'Body width': 'Vartalon leveys', 'Body length': 'Vartalon pituus',
    'Overall size': 'Kokonaiskoko', 'Natural look': 'Luontainen ulkonäkö', 'Natural': 'Luontainen',
    'New look': 'Uusi ilme', 'Current': 'Nykyinen', 'Outfit': 'Asu', 'Turn your seal': 'Käännä norppaa',
    'Drag to turn': 'Käännä vetämällä', 'Close clinic': 'Sulje klinikka', 'Choose seal': 'Valitse norppa',
    'Natural shades': 'Luonnolliset sävyt', 'Dream colours': 'Unelmavärit', 'coins': 'kolikkoa',
    'Natural coats: 2,500. Dream colours: 10,000.': 'Luonnolliset turkit: 2 500. Unelmavärit: 10 000.',
    'Natural colours: 2,500. Dream colours: 6,000.': 'Luonnolliset värit: 2 500. Unelmavärit: 6 000.',
    'Pattern changes: 3,500.': 'Kuvion muutokset: 3 500.', 'Colour change: 1,500.': 'Värin vaihto: 1 500.',
    'Small tweaks cost less. Bigger changes from your natural proportions cost more.': 'Pienet muutokset maksavat vähemmän. Mitä kauemmas luontaisista mittasuhteista mennään, sitä kalliimpaa on.',
    'The mark shows your natural proportions.': 'Merkki näyttää luontaisen mittasuhteesi.',
    'Make me fabulous': 'Tee minusta upea', 'Restore natural look': 'Palauta luontainen ulkonäkö',
    'Reset preview': 'Nollaa esikatselu', 'Preview natural look': 'Kokeile luontaista ulkonäköä',
    'Free': 'Ilmainen', 'Developer mode: free': 'Kehittäjätila: ilmainen', 'Your makeover': 'Muodonmuutoksesi', 'No changes yet': 'Ei vielä muutoksia',
    'Total': 'Yhteensä', 'You have {0} coins': 'Sinulla on {0} kolikkoa', 'Need {0} more coins': 'Tarvitset vielä {0} kolikkoa',
    'Looking fabulous!': 'Näytät upealta!', 'Your natural look is back.': 'Luontainen ulkonäkösi on palautettu.',
    'This seal has gone home. Choose another seal.': 'Tämä norppa lähti kotiin. Valitse toinen norppa.',
    'The preview could not load. Close the clinic and try again.': 'Esikatselu ei latautunut. Sulje klinikka ja yritä uudelleen.',
    'Nothing is spent until you confirm.': 'Kolikoita käytetään vasta vahvistuksen jälkeen.',
    'Returning to your natural look is a paid makeover too.': 'Myös luontaisen ulkonäön palauttaminen maksaa.'
  });
  const label = (v) => v[PN.isFi() ? 1 : 0];
  const num = (n) => n.toLocaleString(PN.isFi() ? 'fi-FI' : 'en-GB');
  C.storefront = (locked) => '<div class="clinic-invite"><span aria-hidden="true">✦</span><h3>' + tr('A little nip. A little tuck. A whole new you.') + '</h3><p>' + tr('Preview for free. Pay only when you love it.') + '</p><p class="note">' + tr('Pups inherit your natural traits, never your makeovers.') + '</p>' + (locked ? '' : '<button class="btn" data-do="clinic">' + tr('Step into the clinic') + '</button>') + '</div>';

  C.open = function () {
    const game = PN.Game, state = game.state;
    if (C.active || (!state.dev && Math.max(state.maxLevel || 1, PN.Sim.level(state).level) < 30)) return;
    C.active = true;
    const oldBusy = game.busy; game.busy = true;
    const focusBefore = document.activeElement, inert = Array.from(document.body.children).filter((el) => !['SCRIPT', 'STYLE'].includes(el.tagName)).map((el) => [el, el.inert]);
    inert.forEach(([el]) => { el.inert = true; });
    const root = document.createElement('div'); root.className = 'clinic-overlay';
    root.innerHTML = '<section class="clinic" role="dialog" aria-modal="true" aria-labelledby="clinic-title">'
      + '<header class="clinic-header"><div><span class="clinic-eyebrow">✦ ' + tr('Preview for free. Pay only when you love it.') + '</span><h2 id="clinic-title">Plastic Sturgeon</h2></div><button class="round" data-c="close" aria-label="' + tr('Close clinic') + '">' + UI.ic('close') + '</button></header>'
      + '<div class="clinic-preview"><div class="clinic-target"><label for="clinic-seal">' + tr('Choose seal') + '</label><select id="clinic-seal" aria-label="' + tr('Choose seal') + '"></select><label class="clinic-outfit"><input type="checkbox" id="clinic-outfit">' + tr('Outfit') + '</label></div>'
      + '<div class="clinic-stage" aria-label="' + tr('Drag to turn') + '"></div><div class="clinic-turn"><span>' + tr('Drag to turn') + '</span><button data-c="turn" aria-label="' + tr('Turn your seal') + '">↻</button></div>'
      + '<div class="clinic-compare" aria-label="' + tr('Preview for free. Pay only when you love it.') + '">' + [['draft', 'New look'], ['current', 'Current'], ['birth', 'Natural']].map(([v, t]) => '<button data-view="' + v + '" aria-pressed="' + (v === 'draft') + '">' + tr(t) + '</button>').join('') + '</div></div>'
      + '<div class="clinic-editor"><nav class="clinic-tabs" aria-label="Plastic Sturgeon">' + ['Coat', 'Patterns', 'Face', 'Shape'].map((t, i) => '<button data-tab="' + t + '" aria-pressed="' + !i + '">' + tr(t) + '</button>').join('') + '</nav><div class="clinic-controls"></div></div>'
      + '<footer class="clinic-footer"><div class="clinic-bill"></div><div class="clinic-actions"><button class="btn ghost small" data-c="reset">' + tr('Reset preview') + '</button><button class="btn" data-c="buy"></button></div><p class="clinic-message" role="status" aria-live="polite"></p></footer></section>';
    document.body.append(root);
    const $ = (s) => root.querySelector(s), select = $('#clinic-seal'), controls = $('.clinic-controls'), stage = $('.clinic-stage');
    const targets = [{ id: 'main', seal: state }].concat(state.pups.map((seal) => ({ id: String(seal.id), seal })), state.family.flatMap((seal, i) => PN.Sim.visitStatus(seal, Date.now()) === 'here' ? [{ id: 'family:' + i, seal }] : []));
    select.innerHTML = targets.map((p) => '<option value="' + p.id + '">' + esc(p.seal.name || 'Norppa') + '</option>').join('');
    let id = 'main', target = state, current = A.normalize(target.appearance), draft = A.normalize(current), birth = A.normalize(target.birthAppearance);
    let tab = 'Coat', view = 'draft', preview, renderer, scene, camera, raf, ro, yaw = 0, alive = true, last = 0, ready = false;
    const drafts = {};
    const message = (s) => { $('.clinic-message').textContent = s; };
    function renderPreview() {
      if (!preview) return;
      preview.setAppearance(view === 'birth' ? birth : view === 'current' ? current : draft);
      preview.grow = 1 / preview.baseScale; preview.applyScale();
      root.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.view === view));
    }
    function outfit() {
      if (!preview) return;
      const wear = target === state ? state.wearing : target.wear;
      ['head', 'neck', 'face', 'back'].forEach((slot) => preview.setWear(slot, $('#clinic-outfit').checked && wear ? wear[slot] : null));
    }
    function makePreview() {
      if (preview) { scene.remove(preview.g); preview.dispose(); }
      preview = new PN.Seal({ stage: target === state ? state.stage : 0, appearance: draft });
      preview.setMood('ok'); preview.idleT = 1e6; preview.peekT = 1e6;
      scene.add(preview.g); renderPreview(); outfit();
    }
    function bill() {
      const q = A.quote(target, draft), available = !!A.target(state, id, Date.now());
      $('.clinic-bill').innerHTML = '<details><summary><span>' + tr('Your makeover') + ' <b>' + num(q.total) + ' ' + tr('coins') + '</b></span><span>' + tr('You have {0} coins', num(Math.floor(state.coins))) + '</span></summary><div class="clinic-receipt">'
        + (q.lines.length ? q.lines.map((l) => '<div><span>' + tr(l.label) + '</span><b>' + (l.cost ? num(l.cost) : tr('Free')) + '</b></div>').join('') : tr('No changes yet')) + '</div></details>';
      const buy = $('[data-c="buy"]');
      buy.disabled = !ready || !q.changed || (!state.dev && q.total > state.coins) || !available;
      buy.textContent = !available ? tr('Choose seal') : !q.changed ? tr('No changes yet') : !state.dev && q.total > state.coins ? tr('Need {0} more coins', num(Math.ceil(q.total - state.coins))) : tr(q.restoring ? 'Restore natural look' : 'Make me fabulous') + ' · ' + num(q.total) + (state.dev ? ' · ' + tr('Developer mode: free') : '');
    }
    function swatches(key, title, note) {
      return '<fieldset><legend>' + tr(title) + '</legend><div class="clinic-swatches">' + A.palettes[key].map((v) => '<button class="clinic-swatch' + (A.special(v) ? ' special' : '') + '" data-field="' + key + '" data-value="' + v + '" aria-pressed="' + (draft[key] === v) + '" title="' + esc(label(A.colors[v])) + '"><i style="--swatch:' + A.colors[v][2] + '" aria-hidden="true"></i><span>' + esc(label(A.colors[v])) + '</span>' + (A.special(v) ? '<small aria-hidden="true">✦</small>' : '') + '</button>').join('') + '</div>' + (note ? '<p class="clinic-hint">' + tr(note) + '</p>' : '') + '</fieldset>';
    }
    const sliderValue = (key) => Math.round(draft[key] * 100) + '%';
    function slider(key, title) {
      const [lo, hi] = A.ranges[key], at = (birth[key] - lo) / (hi - lo) * 100;
      return '<div class="clinic-slider"><label for="clinic-' + key + '">' + tr(title) + '<output id="value-' + key + '">' + sliderValue(key) + '</output></label><div class="clinic-track"><span style="left:' + at + '%" title="' + tr('Natural') + '"></span><input id="clinic-' + key + '" type="range" min="' + lo + '" max="' + hi + '" step="0.01" value="' + draft[key] + '" data-range="' + key + '"></div><div class="clinic-range-labels"><span>' + Math.round(lo * 100) + '%</span><button data-natural="' + key + '">' + tr('Natural') + ' ' + Math.round(birth[key] * 100) + '% ↶</button><span>' + Math.round(hi * 100) + '%</span></div></div>';
    }
    function renderControls() {
      let html = '';
      if (tab === 'Coat') html = swatches('coat', 'Coat colour', 'Natural coats: 2,500. Dream colours: 10,000.') + swatches('belly', 'Belly colour', 'Natural colours: 2,500. Dream colours: 6,000.');
      if (tab === 'Patterns') html = '<fieldset><legend>' + tr('Back pattern') + '</legend><div class="clinic-patterns">' + Object.keys(A.patterns).map((v) => '<button data-field="pattern" data-value="' + v + '" aria-pressed="' + (draft.pattern === v) + '"><i class="pattern-' + v + '" aria-hidden="true"></i>' + esc(label(A.patterns[v])) + '</button>').join('') + '</div><p class="clinic-hint">' + tr('Pattern changes: 3,500.') + '</p></fieldset>' + slider('patternSize', 'Pattern size') + slider('patternOpacity', 'Pattern intensity') + swatches('marking', 'Marking colour', 'Natural colours: 2,500. Dream colours: 6,000.');
      if (tab === 'Face') html = '<p class="clinic-hint">' + tr('Small tweaks cost less. Bigger changes from your natural proportions cost more.') + '</p>' + swatches('eye', 'Eye colour', 'Colour change: 1,500.') + slider('eyeSize', 'Eye size') + slider('eyeSpacing', 'Eye spacing') + swatches('nose', 'Nose colour', 'Colour change: 1,500.') + slider('noseSize', 'Nose size');
      if (tab === 'Shape') html = '<p class="clinic-hint">' + tr('Small tweaks cost less. Bigger changes from your natural proportions cost more.') + '</p>' + slider('size', 'Overall size') + slider('headSize', 'Head size') + slider('bodyWidth', 'Body width') + slider('bodyLength', 'Body length') + '<p class="clinic-hint">' + tr('The mark shows your natural proportions.') + '</p>';
      controls.innerHTML = html + '<div class="clinic-natural"><button class="btn ghost small" data-c="natural">' + tr('Preview natural look') + '</button><p>' + tr('Returning to your natural look is a paid makeover too.') + '</p><p>' + tr('Pups inherit your natural traits, never your makeovers.') + '</p></div>';
    }
    function changed() { view = 'draft'; renderPreview(); bill(); message(tr('Nothing is spent until you confirm.')); }
    function close() {
      if (!alive) return;
      alive = false; cancelAnimationFrame(raf); if (ro) ro.disconnect();
      if (preview) preview.dispose(); if (renderer) { renderer.dispose(); renderer.forceContextLoss(); }
      root.remove(); inert.forEach(([el, value]) => { el.inert = value; });
      C.active = false; game.busy = oldBusy;
      UI.renderSheet(); UI.refresh(); if (focusBefore && focusBefore.isConnected) focusBefore.focus();
    }
    C.close = close;
    root.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); close(); }
      if (e.key === 'Tab') {
        const nodes = Array.from(root.querySelectorAll('button:not(:disabled),input,select,summary')).filter((el) => el.getClientRects().length);
        const first = nodes[0], end = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); end.focus(); }
        else if (!e.shiftKey && document.activeElement === end) { e.preventDefault(); first.focus(); }
      }
    });
    root.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.tab) { tab = b.dataset.tab; root.querySelectorAll('[data-tab]').forEach((v) => v.setAttribute('aria-pressed', v === b)); renderControls(); controls.scrollTop = 0; }
      if (b.dataset.view) { view = b.dataset.view; renderPreview(); }
      if (b.dataset.field) {
        draft[b.dataset.field] = b.dataset.value;
        controls.querySelectorAll('[data-field="' + b.dataset.field + '"]').forEach((v) => v.setAttribute('aria-pressed', v === b));
        changed();
      }
      if (b.dataset.natural) {
        const key = b.dataset.natural; draft[key] = birth[key];
        $('#clinic-' + key).value = draft[key]; $('#value-' + key).textContent = sliderValue(key); changed();
      }
      const action = b.dataset.c;
      if (action === 'close') close();
      if (action === 'turn') yaw += Math.PI / 2;
      if (action === 'reset' || action === 'natural') { draft = A.normalize(action === 'natural' ? birth : current); renderControls(); changed(); }
      if (action === 'buy') {
        const q = A.quote(target, draft), result = A.purchase(state, id, draft, Date.now());
        if (!result.ok) { bill(); message(tr(result.why === 'away' ? 'This seal has gone home. Choose another seal.' : 'Nothing is spent until you confirm.')); return; }
        current = A.normalize(target.appearance); draft = A.normalize(current); delete drafts[id];
        game.refreshAppearance(); changed(); PN.Audio.play('buy');
        message(tr(q.restoring ? 'Your natural look is back.' : 'Looking fabulous!'));
      }
    });
    controls.addEventListener('input', (e) => {
      const key = e.target.dataset.range; if (!key) return;
      draft[key] = +e.target.value; $('#value-' + key).textContent = sliderValue(key); changed();
    });
    select.addEventListener('change', () => {
      drafts[id] = A.normalize(draft); id = select.value;
      target = targets.find((t) => t.id === id).seal;
      current = A.normalize(target.appearance); birth = A.normalize(target.birthAppearance); draft = A.normalize(drafts[id] || current); view = 'draft';
      if (ready) makePreview(); renderControls(); bill(); message(tr('Nothing is spent until you confirm.'));
    });
    $('#clinic-outfit').addEventListener('change', outfit);
    renderControls(); message(tr('Nothing is spent until you confirm.'));
    try {
      const T = THREE;
      renderer = new T.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
      stage.append(renderer.domElement);
      scene = new T.Scene(); scene.add(new T.HemisphereLight(0xffffff, 0xa4b5c9, 2.2));
      const light = new T.DirectionalLight(0xfff4e4, 2.5); light.position.set(3, 5, 4); scene.add(light);
      const fill = new T.DirectionalLight(0xcbdcff, 1.2); fill.position.set(-3, 2, -3); scene.add(fill);
      camera = new T.PerspectiveCamera(32, 1, 0.1, 60);
      makePreview(); ready = true;
      function resize() {
        const w = stage.clientWidth, h = stage.clientHeight;
        renderer.setSize(w, h, false); camera.aspect = w / Math.max(1, h);
        const distance = Math.max(6.6, 5.2 / camera.aspect);
        camera.position.set(0.54 * distance, 0.32 * distance, 0.75 * distance);
        camera.lookAt(0, 0.65, -0.45); camera.updateProjectionMatrix();
      }
      ro = new ResizeObserver(resize); ro.observe(stage); resize();
      let dragX = null;
      stage.addEventListener('pointerdown', (e) => { dragX = e.clientX; stage.setPointerCapture(e.pointerId); });
      stage.addEventListener('pointermove', (e) => { if (dragX == null) return; yaw += (e.clientX - dragX) * 0.012; dragX = e.clientX; });
      stage.addEventListener('pointerup', () => { dragX = null; }); stage.addEventListener('pointercancel', () => { dragX = null; });
      renderer.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); ready = false; bill(); message(tr('The preview could not load. Close the clinic and try again.')); });
      renderer.domElement.addEventListener('webglcontextrestored', () => { PN.U.repaint(); ready = true; bill(); });
      function frame(ts) {
        if (!alive) return; raf = requestAnimationFrame(frame);
        if (ts - last < 33 || document.hidden) return;
        const dt = Math.min(0.05, (ts - last) / 1000); last = ts;
        preview.heading = yaw; preview.update(dt, ts / 1000, () => 0);
        renderer.render(scene, camera);
      }
      raf = requestAnimationFrame(frame);
    } catch (e) { message(tr('The preview could not load. Close the clinic and try again.')); }
    bill(); $('[data-c="close"]').focus();
  };
})(window.PN = window.PN || {});
