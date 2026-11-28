/* Pikku Norppa: the look studio. One overlay with a live 3D preview, used two ways:
   - the creator, when a new kuutti arrives (free, natural traits only, with a pup and a grown-up preview), and
   - Plastic Sturgeon, the level-30 clinic (every option, quoted line by line and paid for in one go).
   Nothing is changed until the player confirms. The preview has its own renderer and is thrown away on close. */
(function (PN) {
  'use strict';
  const A = PN.Appearance, UI = PN.UI, tr = PN.L, esc = UI.esc;
  const C = PN.Clinic = { active: false };
  const label = (v) => v[PN.isFi() ? 1 : 0];
  const num = (n) => n.toLocaleString(PN.isFi() ? 'fi-FI' : 'en-GB');

  /* ---------- what each tab holds ---------- */
  const sw = (key, title, note, when) => ({ type: 'swatch', key, title, note, when });
  const sl = (key, title, when) => ({ type: 'slider', key, title, when });
  const ch = (key, title, note, when) => ({ type: 'choice', key, title, note, when });
  const hint = (text) => ({ type: 'hint', text });
  const hasDecal = (d) => d.decal !== 'none';
  const TABS = {
    create: [
      ['Coat', [sw('coat', 'Coat colour'), sw('belly', 'Belly colour'), hint('A pup starts out pale and fluffy. The colours and markings grow in as the pup grows up.')]],
      ['Markings', [ch('pattern', 'Back pattern'), sl('patternSize', 'Pattern size'), sl('patternOpacity', 'Pattern intensity'), sw('marking', 'Marking colour')]],
      ['Face', [sw('eye', 'Eye colour'), sl('eyeSize', 'Eye size'), sl('eyeSpacing', 'Eye spacing'), sw('nose', 'Nose colour'), sl('noseSize', 'Nose size')]],
      ['Shape', [sl('headSize', 'Head size'), sl('bodyWidth', 'Body width'), sl('bodyLength', 'Body length'), hint('Growing happens by itself. Bigger changes, and overall size, are for Plastic Sturgeon later on.')]],
    ],
    clinic: [
      ['Coat', [sw('coat', 'Coat colour', 'Natural coats: 2,500. Dream colours: 10,000.'), sw('belly', 'Belly colour', 'Natural colours: 2,500. Dream colours: 6,000.'),
        ch('finish', 'Coat finish', 'Pearlescent or shimmer: 12,000. Aurora sheen: 20,000.')]],
      ['Markings', [ch('pattern', 'Back pattern', 'Pattern changes: 3,500.'), sl('patternSize', 'Pattern size'), sl('patternOpacity', 'Pattern intensity'),
        sw('marking', 'Marking colour', 'Natural colours: 2,500. Dream colours: 6,000.'),
        ch('decal', 'Special marking', 'A new special marking: 7,500. Colour, size or layout changes: 2,500.'),
        ch('decalLayout', 'Layout', null, hasDecal), sw('decalColor', 'Special marking colour', null, hasDecal),
        sl('decalSize', 'Special marking size', hasDecal), sl('decalOpacity', 'Special marking intensity', hasDecal)]],
      ['Designs', [hint('Each design: 4,000. Taking one off: 1,500.'), sw('gradient', 'Head to tail fade'), sw('mask', 'Face mask'), sw('flippers', 'Flipper tips'), sw('tail', 'Dipped tail')]],
      ['Face', [hint('Small tweaks cost less. Bigger changes from your natural proportions cost more.'),
        sw('eye', 'Eye colour', 'Natural colours: 1,500. Dream colours: 3,000.'), sw('eyeRight', 'Second eye colour', 'Odd eyes: 3,000.'), ch('eyeStar', 'Eye sparkle', 'Star sparkle: 3,000.'),
        sl('eyeSize', 'Eye size'), sl('eyeSpacing', 'Eye spacing'), sw('nose', 'Nose colour', 'Colour change: 1,500.'), sl('noseSize', 'Nose size'),
        ch('cheeks', 'Cheeks', 'Rosy cheeks: 2,000.'), ch('freckles', 'Freckles', 'Cheek freckles: 2,000.'),
        sw('whiskerColor', 'Whisker colour', 'Whiskers: 2,000.'), sl('whiskerLength', 'Whisker length')]],
      ['Shape', [hint('Small tweaks cost less. Bigger changes from your natural proportions cost more.'), sl('size', 'Overall size'), sl('headSize', 'Head size'),
        sl('bodyWidth', 'Body width'), sl('bodyLength', 'Body length'), hint('The mark shows your natural proportions.')]],
    ],
  };

  /* Little pictures for the choice buttons. */
  const FINISH_ART = { none: '#c9d3de', pearl: 'linear-gradient(135deg,#fff 10%,#f6e3ff 45%,#dff2ff 80%)',
    shimmer: 'radial-gradient(#fff 1px,transparent 1.6px) 0 0/7px 7px,#b9c6d4', aurora: 'linear-gradient(135deg,#67e0b8,#7fb4ff 50%,#c39bf2)' };
  function choiceArt(key, v) {
    if (key === 'pattern') return '<i class="pattern-' + v + '" aria-hidden="true"></i>';
    if (key === 'decal') return v === 'none' ? '<i class="decal-none" aria-hidden="true"></i>' : '<img src="' + PN.Seal.stampIcon(v) + '" alt="">';
    if (key === 'finish') return '<i class="finish-art" style="background:' + FINISH_ART[v] + '" aria-hidden="true"></i>';
    return '';
  }

  C.storefront = (locked) => '<div class="clinic-invite"><span aria-hidden="true">✦</span><h3>' + tr('A little nip. A little tuck. A whole new you.') + '</h3><p>' + tr('Preview for free. Pay only when you love it.') + '</p><p class="note">' + tr('Pups inherit your natural traits, never your makeovers.') + '</p>' + (locked ? '' : '<button class="btn" data-do="clinic">' + tr('Step into the clinic') + '</button>') + '</div>';

  /* Plastic Sturgeon, from the shop. */
  C.open = function () {
    const state = PN.Game.state;
    if (C.active || !A.unlocked(state)) return Promise.resolve(null);
    return studio({ mode: 'clinic' });
  };
  /* The creator. opts.legacy: an existing seal choosing once, who may keep her old look.
     opts.mock: a developer test run that starts from a random kuutti and saves nothing. Resolves to true if a look was chosen. */
  C.create = function (opts) {
    if (C.active) return Promise.resolve(false);
    return studio(Object.assign({ mode: 'create' }, opts));
  };

  function studio(opts) {
    const creating = opts.mode === 'create', game = PN.Game, state = game.state;
    C.active = true;
    let finish;
    const done = new Promise((resolve) => { finish = resolve; });
    const oldBusy = game.busy; game.busy = true;
    const focusBefore = document.activeElement, inert = Array.from(document.body.children).filter((el) => !['SCRIPT', 'STYLE'].includes(el.tagName)).map((el) => [el, el.inert]);
    inert.forEach(([el]) => { el.inert = true; });

    const views = creating ? [['pup', 'Pup'], ['grown', 'Grown up']] : [['draft', 'New look'], ['current', 'Current'], ['birth', 'Natural']];
    const tabs = TABS[opts.mode];
    const root = document.createElement('div'); root.className = 'clinic-overlay' + (creating ? ' creating' : '');
    root.innerHTML = '<section class="clinic" role="dialog" aria-modal="true" aria-labelledby="clinic-title">'
      + '<header class="clinic-header"><div><span class="clinic-eyebrow">✦ ' + tr(opts.mock ? 'Developer test: nothing here is saved.' : creating ? 'Choose a natural look. Pups can take after it.' : 'Preview for free. Pay only when you love it.') + '</span><h2 id="clinic-title">' + (creating ? tr(opts.legacy ? 'Natural look' : 'Your kuutti') : 'Plastic Sturgeon') + '</h2></div>'
      + (creating && !opts.legacy && !opts.mock ? '' : '<button class="round" data-c="close" aria-label="' + tr(opts.mock ? 'Close' : creating ? 'Keep it as it is' : 'Close clinic') + '">' + UI.ic('close') + '</button>') + '</header>'
      + '<div class="clinic-preview">' + (creating ? '' : '<div class="clinic-target"><label for="clinic-seal">' + tr('Choose seal') + '</label><select id="clinic-seal"></select><label class="clinic-outfit"><input type="checkbox" id="clinic-outfit">' + tr('Outfit') + '</label></div>')
      + '<div class="clinic-stage" aria-label="' + tr('Drag to turn') + '"></div><div class="clinic-turn"><span>' + tr('Drag to turn, pinch to zoom') + '</span><button data-c="zoomout" aria-label="' + tr('Zoom out') + '">−</button><button data-c="zoomin" aria-label="' + tr('Zoom in') + '">+</button><button data-c="turn" aria-label="' + tr('Turn your seal') + '">↻</button></div>'
      + '<div class="clinic-compare">' + views.map(([v, t], i) => '<button data-view="' + v + '" aria-pressed="' + !i + '">' + tr(t) + '</button>').join('') + '</div></div>'
      + '<div class="clinic-editor"><nav class="clinic-tabs" aria-label="' + tr(creating ? 'Your kuutti' : 'Plastic Sturgeon') + '">' + tabs.map(([t], i) => '<button data-tab="' + t + '" aria-pressed="' + !i + '">' + tr(t) + '</button>').join('') + '</nav><div class="clinic-controls"></div></div>'
      + '<footer class="clinic-footer">' + (creating
        ? '<div class="clinic-actions"><button class="btn ghost small" data-c="surprise">' + tr('Surprise me') + '</button><button class="btn" data-c="done">' + tr('That is the one') + '</button></div>' + (opts.legacy ? '<button class="clinic-keep" data-c="close">' + tr('Keep it as it is') + '</button>' : '')
        : '<div class="clinic-bill"></div><div class="clinic-actions"><button class="btn ghost small" data-c="reset">' + tr('Reset preview') + '</button><button class="btn" data-c="buy"></button></div>')
      + '<p class="clinic-message" role="status" aria-live="polite"></p></footer></section>';
    document.body.append(root);

    const $ = (s) => root.querySelector(s), controls = $('.clinic-controls'), stage = $('.clinic-stage'), select = $('#clinic-seal');
    const targets = creating ? [{ id: 'main', seal: state }] : [{ id: 'main', seal: state }].concat(state.pups.map((seal) => ({ id: String(seal.id), seal })),
      state.family.flatMap((seal, i) => PN.Sim.visitStatus(seal, Date.now()) === 'here' ? [{ id: 'family:' + i, seal }] : []));
    if (select) select.innerHTML = targets.map((p) => '<option value="' + p.id + '">' + esc(p.seal.name || 'Norppa') + '</option>').join('');
    let id = 'main', target = state, current = A.normalize(target.appearance), birth = A.normalize(target.birthAppearance);
    let draft = opts.mock ? A.surprise() : creating ? A.naturalOnly(birth) : A.normalize(current);
    let tab = tabs[0][0], view = views[0][0], preview, renderer, scene, camera, raf, ro, yaw = 0, zoom = 1, alive = true, last = 0, ready = false;
    const drafts = {}, ranges = creating ? A.naturalRanges : A.ranges;
    const setZoom = (z) => { zoom = Math.min(2.8, Math.max(0.8, z)); };
    const message = (s) => { $('.clinic-message').textContent = s; };
    const idle = () => message(tr(opts.mock ? 'Developer test: nothing here is saved.' : creating ? 'Free now. Any change later is made at Plastic Sturgeon.' : 'Nothing is spent until you confirm.'));

    /* ---------- the 3D preview ---------- */
    const shown = () => (view === 'birth' ? birth : view === 'current' ? current : draft);
    const shownStage = () => (creating ? (view === 'grown' ? 2 : 0) : target === state ? state.stage : 0);
    function renderPreview() {
      if (!preview) return;
      preview.setStage(shownStage());
      preview.setAppearance(shown());
      preview.grow = 1 / preview.baseScale; preview.applyScale();
      root.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.view === view));
    }
    function outfit() {
      if (!preview) return;
      const wear = target === state ? state.wearing : target.wear, on = !creating && $('#clinic-outfit').checked;
      ['head', 'neck', 'face', 'back'].forEach((slot) => preview.setWear(slot, on && wear ? wear[slot] : null));
    }
    function makePreview() {
      if (preview) { scene.remove(preview.g); preview.dispose(); }
      preview = new PN.Seal({ stage: shownStage(), appearance: shown() });
      preview.setMood('ok'); preview.idleT = 1e6; preview.peekT = 1e6;
      scene.add(preview.g); renderPreview(); outfit();
    }

    /* ---------- the bill (clinic only) ---------- */
    function bill() {
      if (creating) return;
      const q = A.quote(target, draft), available = !!A.target(state, id, Date.now()), short = !state.dev && q.total > state.coins;
      $('.clinic-bill').innerHTML = '<details><summary><span>' + tr('Your makeover') + ' <b>' + num(q.total) + ' ' + tr('coins') + '</b></span><span>' + tr('You have {0} coins', num(Math.floor(state.coins))) + '</span></summary><div class="clinic-receipt">'
        + (q.lines.length ? q.lines.map((l) => '<div><span>' + tr(l.label) + '</span><b>' + num(l.cost) + '</b></div>').join('') : tr('No changes yet')) + '</div></details>';
      const buy = $('[data-c="buy"]');
      buy.disabled = !ready || !q.changed || short || !available;
      buy.textContent = !available ? tr('Choose seal') : !q.changed ? tr('No changes yet') : short ? tr('Need {0} more coins', num(Math.ceil(q.total - state.coins)))
        : tr(q.restoring ? 'Restore natural look' : 'Make me fabulous') + ' · ' + num(q.total) + (state.dev ? ' · ' + tr('Developer mode: free') : '');
    }

    /* ---------- the controls ---------- */
    function swatches(c) {
      const list = creating ? A.naturalPalette(c.key) : A.palettes[c.key];
      return '<fieldset><legend>' + tr(c.title) + '</legend><div class="clinic-swatches">' + list.map((v) => {
        const dream = A.dream(v), blank = v === 'none' || v === 'same';
        return '<button class="clinic-swatch' + (dream ? ' special' : '') + (blank ? ' blank' : '') + '" data-field="' + c.key + '" data-value="' + v + '" aria-pressed="' + (draft[c.key] === v) + '" title="' + esc(label(A.colors[v])) + '"><i style="--swatch:' + A.colors[v][2] + '" aria-hidden="true"></i><span>' + esc(label(A.colors[v])) + '</span>' + (dream ? '<small aria-hidden="true">✦</small>' : '') + '</button>';
      }).join('') + '</div>' + (c.note ? '<p class="clinic-hint">' + tr(c.note) + '</p>' : '') + '</fieldset>';
    }
    function choices(c) {
      const opts = A.choices[c.key], art = c.key === 'pattern' || c.key === 'decal' || c.key === 'finish';
      return '<fieldset><legend>' + tr(c.title) + '</legend><div class="' + (art ? 'clinic-patterns' : 'clinic-chips') + '">' + Object.keys(opts).map((v) =>
        '<button data-field="' + c.key + '" data-value="' + v + '" aria-pressed="' + (draft[c.key] === v) + '">' + choiceArt(c.key, v) + esc(label(opts[v])) + '</button>').join('') + '</div>' + (c.note ? '<p class="clinic-hint">' + tr(c.note) + '</p>' : '') + '</fieldset>';
    }
    const pct = (key) => Math.round(draft[key] * 100) + '%';
    function slider(c) {
      const [lo, hi] = ranges[c.key], step = 0.01;
      const mark = creating ? '' : '<span style="left:' + ((birth[c.key] - lo) / (hi - lo) * 100) + '%" title="' + tr('Natural') + '"></span>';
      const back = creating ? '<span></span>' : '<button data-natural="' + c.key + '">' + tr('Natural') + ' ' + Math.round(birth[c.key] * 100) + '% ↶</button>';
      return '<div class="clinic-slider"><label for="clinic-' + c.key + '">' + tr(c.title) + '<output id="value-' + c.key + '">' + pct(c.key) + '</output></label><div class="clinic-track">' + mark
        + '<input id="clinic-' + c.key + '" type="range" min="' + lo + '" max="' + hi + '" step="' + step + '" value="' + draft[c.key] + '" data-range="' + c.key + '"></div><div class="clinic-range-labels"><span>' + Math.round(lo * 100) + '%</span>' + back + '<span>' + Math.round(hi * 100) + '%</span></div></div>';
    }
    function renderControls() {
      const keep = controls.scrollTop, list = tabs.find(([t]) => t === tab)[1];
      let html = list.filter((c) => !c.when || c.when(draft)).map((c) => c.type === 'swatch' ? swatches(c) : c.type === 'choice' ? choices(c) : c.type === 'slider' ? slider(c) : '<p class="clinic-hint">' + tr(c.text) + '</p>').join('');
      if (!creating) html += '<div class="clinic-natural"><button class="btn ghost small" data-c="natural">' + tr('Preview natural look') + '</button><p>' + tr('Returning to your natural look is a paid makeover too.') + '</p><p>' + tr('Pups inherit your natural traits, never your makeovers.') + '</p></div>';
      controls.innerHTML = html; controls.scrollTop = keep;
    }
    function changed() {
      if (!creating) view = 'draft';
      renderPreview(); bill(); idle();
    }

    /* ---------- closing ---------- */
    function close(result) {
      if (!alive) return;
      alive = false; cancelAnimationFrame(raf); if (ro) ro.disconnect();
      if (preview) preview.dispose(); if (renderer) { renderer.dispose(); renderer.forceContextLoss(); }
      root.remove(); inert.forEach(([el, value]) => { el.inert = value; });
      C.active = false; game.busy = oldBusy; C.close = null;
      if (!creating) { UI.renderSheet(); UI.refresh(); }
      if (focusBefore && focusBefore.isConnected) focusBefore.focus();
      finish(result);
    }
    C.close = () => close(creating ? false : null);
    function keep() { if (creating && !opts.mock) state.lookChosen = true; close(false); }

    root.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && (!creating || opts.legacy || opts.mock)) { e.stopPropagation(); keep(); }
      if (e.key === 'Tab') {
        const nodes = Array.from(root.querySelectorAll('button:not(:disabled),input,select,summary')).filter((el) => el.getClientRects().length);
        const first = nodes[0], end = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); end.focus(); }
        else if (!e.shiftKey && document.activeElement === end) { e.preventDefault(); first.focus(); }
      }
    });
    root.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.tab) { tab = b.dataset.tab; root.querySelectorAll('[data-tab]').forEach((v) => v.setAttribute('aria-pressed', v === b)); controls.scrollTop = 0; renderControls(); }
      if (b.dataset.view) { view = b.dataset.view; renderPreview(); }
      if (b.dataset.field) {
        const key = b.dataset.field, refresh = key === 'decal' && (draft.decal === 'none') !== (b.dataset.value === 'none');
        draft[key] = b.dataset.value;
        if (refresh) renderControls();
        else controls.querySelectorAll('[data-field="' + key + '"]').forEach((v) => v.setAttribute('aria-pressed', v === b));
        changed();
      }
      if (b.dataset.natural) {
        const key = b.dataset.natural; draft[key] = birth[key];
        $('#clinic-' + key).value = draft[key]; $('#value-' + key).textContent = pct(key); changed();
      }
      const action = b.dataset.c;
      if (action === 'close') { if (creating) keep(); else close(null); }
      if (action === 'turn') yaw += Math.PI / 2;
      if (action === 'zoomin') setZoom(zoom * 1.35);
      if (action === 'zoomout') setZoom(zoom / 1.35);
      if (action === 'surprise') { draft = A.surprise(); draft.seed = birth.seed; renderControls(); changed(); PN.Audio.play('sparkle'); }
      if (action === 'done') {
        if (opts.mock) { close(false); UI.toast(tr('Test only: nothing was saved.'), 'check'); return; }
        A.create(state, draft); game.refreshAppearance(); PN.Audio.play('chirp'); close(true);
      }
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
      draft[key] = +e.target.value; $('#value-' + key).textContent = pct(key); changed();
    });
    if (select) select.addEventListener('change', () => {
      drafts[id] = A.normalize(draft); id = select.value;
      target = targets.find((t) => t.id === id).seal;
      current = A.normalize(target.appearance); birth = A.normalize(target.birthAppearance); draft = A.normalize(drafts[id] || current); view = 'draft';
      if (ready) makePreview(); renderControls(); bill(); idle();
    });
    if (!creating) $('#clinic-outfit').addEventListener('change', outfit);
    renderControls(); idle();

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
      // The camera looks down at her from the front; zooming in moves it closer and drifts the aim toward her face.
      const DIR = new T.Vector3(0.52, 0.46, 0.7).normalize(), BODY = new T.Vector3(0, 0.65, -0.45), aimAt = new T.Vector3(), headAt = new T.Vector3();
      let baseDist = 8;
      const resize = () => {
        const w = stage.clientWidth, h = stage.clientHeight;
        renderer.setSize(w, h, false); camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix();
        baseDist = Math.max(7.6, 6 / camera.aspect);
      };
      const placeCamera = () => {
        const k = Math.min(1, Math.max(0, (zoom - 1) / 1.6));
        preview.headP.getWorldPosition(headAt);
        aimAt.copy(BODY).lerp(headAt, k * 0.85);
        camera.position.copy(aimAt).addScaledVector(DIR, baseDist / zoom); camera.lookAt(aimAt);
      };
      ro = new ResizeObserver(resize); ro.observe(stage); resize();
      // one finger turns her, two fingers pinch to zoom; the mouse wheel zooms too
      const touches = new Map();
      let pinch = 0;
      const spread = () => { const [a, b] = Array.from(touches.values()); return Math.hypot(a.x - b.x, a.y - b.y); };
      stage.addEventListener('pointerdown', (e) => { touches.set(e.pointerId, { x: e.clientX, y: e.clientY }); try { stage.setPointerCapture(e.pointerId); } catch (err) { /* fine */ } if (touches.size === 2) pinch = spread(); });
      stage.addEventListener('pointermove', (e) => {
        const t = touches.get(e.pointerId); if (!t) return;
        if (touches.size === 1) yaw += (e.clientX - t.x) * 0.012;
        t.x = e.clientX; t.y = e.clientY;
        if (touches.size === 2) { const d = spread(); if (pinch > 0) setZoom(zoom * d / pinch); pinch = d; }
      });
      const lift = (e) => { touches.delete(e.pointerId); pinch = 0; };
      stage.addEventListener('pointerup', lift); stage.addEventListener('pointercancel', lift);
      stage.addEventListener('wheel', (e) => { e.preventDefault(); setZoom(zoom * Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
      renderer.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); ready = false; bill(); message(tr('The preview could not load. Close the clinic and try again.')); });
      renderer.domElement.addEventListener('webglcontextrestored', () => { PN.U.repaint(); ready = true; bill(); });
      const frame = (ts) => {
        if (!alive) return; raf = requestAnimationFrame(frame);
        if (ts - last < 33 || document.hidden) return;
        const dt = Math.min(0.05, (ts - last) / 1000); last = ts;
        preview.heading = yaw; preview.g.rotation.y = yaw; preview.update(dt, ts / 1000, () => 0);
        placeCamera();
        renderer.render(scene, camera);
      };
      raf = requestAnimationFrame(frame);
    } catch (e) { message(tr('The preview could not load. Close the clinic and try again.')); }
    bill();
    const first = $('[data-c="close"]') || $('[data-c="done"]'); if (first) first.focus();
    return done;
  }
})(window.PN = window.PN || {});
