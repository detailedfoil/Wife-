/* Pikku Norppa: sound.
   Every sound is made on the spot with the Web Audio API, so there are no sound files.
   The music is a few plucked notes on a kantele, the Finnish lap harp. */
(function (PN) {
  'use strict';
  const A = PN.Audio = { sound: true, music: true };
  let ctx = null, master, sfx, musicBus, windGain, windFilter, noiseBuf, strings = [], started = false, musicTimer = 0, lastAt = {};

  function ensure() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try { ctx = new AC(); } catch (e) { return false; }
    master = ctx.createGain(); master.gain.value = A.sound ? 0.9 : 0;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp); comp.connect(ctx.destination);
    sfx = ctx.createGain(); sfx.gain.value = 0.85; sfx.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.22; musicBus.connect(master);
    const delay = ctx.createDelay(1); delay.delayTime.value = 0.36;
    const fb = ctx.createGain(); fb.gain.value = 0.28;
    musicBus.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(master);
    const n = ctx.sampleRate * 2;
    noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }

  /* A plucked string (Karplus-Strong): a burst of noise going round a short loop, losing a little each lap. */
  function pluckBuffer(freq) {
    const sr = ctx.sampleRate, len = Math.floor(sr * 2.6), N = Math.max(2, Math.round(sr / freq));
    const buf = ctx.createBuffer(1, len, sr), out = buf.getChannelData(0), ring = new Float32Array(N);
    let prev = 0;
    for (let i = 0; i < N; i++) { prev = prev * 0.55 + (Math.random() * 2 - 1) * 0.45; ring[i] = prev; }
    let k = 0;
    for (let i = 0; i < len; i++) {
      const a = ring[k], b = ring[(k + 1) % N];
      ring[k] = (a + b) * 0.5 * 0.9968;
      out[i] = a * Math.min(1, (len - i) / 4000);
      k = (k + 1) % N;
    }
    return buf;
  }

  function tone(freq, dur, o) {
    if (!ctx || !A.sound) return;
    o = o || {};
    const t = ctx.currentTime + (o.at || 0), osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    const v = o.vol == null ? 0.2 : o.vol;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + (o.attack || 0.008));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(sfx);
    osc.start(t); osc.stop(t + dur + 0.03);
  }
  function noise(dur, o) {
    if (!ctx || !A.sound) return;
    o = o || {};
    const t = ctx.currentTime + (o.at || 0), src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf; src.loop = true;
    f.type = o.type || 'bandpass'; f.Q.value = o.q || 1;
    f.frequency.setValueAtTime(o.freq || 1000, t);
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    const v = o.vol == null ? 0.2 : o.vol;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + (o.attack || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(sfx);
    src.start(t, Math.random()); src.stop(t + dur + 0.03);
  }
  const bell = (f, at, vol) => { tone(f, 0.32, { at, vol: vol || 0.16 }); tone(f * 2.01, 0.2, { at, vol: (vol || 0.16) * 0.35 }); };

  const S = {
    tap() { tone(420, 0.05, { type: 'triangle', vol: 0.12 }); },
    pop() { tone(520, 0.08, { to: 880, vol: 0.2 }); },
    open() { tone(440, 0.09, { to: 660, vol: 0.12 }); },
    close() { tone(620, 0.08, { to: 420, vol: 0.1 }); },
    nope() { tone(220, 0.09, { type: 'triangle', vol: 0.16 }); tone(175, 0.12, { type: 'triangle', vol: 0.16, at: 0.1 }); },
    chirp() { const b = 560 + Math.random() * 160; tone(b, 0.09, { to: b * 1.55, type: 'triangle', vol: 0.2 }); tone(b * 1.25, 0.11, { to: b * 1.9, type: 'triangle', vol: 0.16, at: 0.1 }); },
    squeak() { const b = 760 + Math.random() * 240; tone(b, 0.08, { to: b * 1.4, type: 'triangle', vol: 0.15 }); },
    sad() { tone(520, 0.3, { to: 330, type: 'triangle', vol: 0.15 }); tone(390, 0.36, { to: 250, type: 'triangle', vol: 0.13, at: 0.28 }); },
    hmph() { noise(0.13, { freq: 520, type: 'lowpass', vol: 0.22 }); tone(230, 0.13, { to: 160, type: 'triangle', vol: 0.14 }); },
    yawn() { tone(480, 0.55, { to: 250, type: 'triangle', vol: 0.11, attack: 0.15 }); },
    sneeze() { noise(0.14, { freq: 3200, type: 'highpass', vol: 0.2 }); tone(700, 0.1, { to: 300, type: 'triangle', vol: 0.12 }); },
    munch() { [0, 0.12, 0.24].forEach((at) => noise(0.06, { freq: 1300 + Math.random() * 400, q: 2, vol: 0.3, at })); },
    gulp() { tone(320, 0.13, { to: 170, vol: 0.2 }); },
    splash() { noise(0.5, { freq: 2600, to: 420, type: 'lowpass', vol: 0.4 }); tone(150, 0.22, { to: 70, vol: 0.25 }); },
    bubble() { const b = 480 + Math.random() * 500; tone(b, 0.08, { to: b * 1.7, vol: 0.09 }); },
    scrub() { noise(0.07, { freq: 2800 + Math.random() * 1200, q: 1.5, vol: 0.07 }); },
    heart() { bell(1318.5, 0, 0.1); bell(1975.5, 0.06, 0.06); },
    coin() { bell(1568, 0, 0.13); bell(2093, 0.07, 0.13); },
    sparkle() { [0, 0.06, 0.12, 0.18].forEach((at, i) => bell(1760 * Math.pow(1.122, [0, 4, 7, 12][i]), at, 0.07)); },
    level() { [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => bell(f, i * 0.09, 0.15)); },
    award() { [783.99, 1046.5, 1318.5, 1568].forEach((f, i) => bell(f, i * 0.11, 0.15)); bell(2093, 0.5, 0.12); },
    word() { bell(880, 0, 0.1); bell(1174.7, 0.1, 0.1); },
    boing() { tone(240, 0.16, { to: 520, vol: 0.2 }); tone(520, 0.1, { to: 360, vol: 0.12, at: 0.14 }); },
    whoosh() { noise(0.28, { freq: 420, to: 2000, q: 1.2, vol: 0.16, attack: 0.08 }); },
    thud() { tone(120, 0.14, { to: 60, vol: 0.28 }); noise(0.08, { freq: 300, type: 'lowpass', vol: 0.2 }); },
    jingle() { bell(2637, 0, 0.07); bell(3136, 0.05, 0.06); },
    steam() { noise(1.4, { freq: 5200, type: 'highpass', vol: 0.12, attack: 0.3 }); },
    flip() { tone(700, 0.04, { type: 'triangle', vol: 0.1 }); },
    match() { bell(1046.5, 0, 0.12); bell(1568, 0.09, 0.12); },
    tick() { tone(900, 0.03, { type: 'square', vol: 0.05 }); },
    go() { bell(1046.5, 0, 0.16); bell(1568, 0.02, 0.1); },
    grow() { for (let i = 0; i < 8; i++) bell(440 * Math.pow(2, i / 6), i * 0.07, 0.11); },
    lost() { tone(392, 0.5, { to: 370, type: 'triangle', vol: 0.14, attack: 0.05 }); tone(311, 0.6, { to: 294, type: 'triangle', vol: 0.14, at: 0.45, attack: 0.05 }); tone(247, 0.9, { type: 'triangle', vol: 0.14, at: 1.0, attack: 0.05 }); },
  };

  /* Play a named sound. gap: least seconds between two plays of the same sound. */
  A.play = function (name, gap) {
    if (!ctx || !A.sound || !S[name]) return;
    const now = ctx.currentTime;
    if (gap && lastAt[name] && now - lastAt[name] < gap) return;
    lastAt[name] = now;
    try { S[name](); } catch (e) { /* a missed sound is never worth a crash */ }
  };

  function pluck(i, vol, at) {
    if (!ctx || !strings[i]) return;
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = strings[i]; g.gain.value = vol;
    src.connect(g); g.connect(musicBus);
    src.start(ctx.currentTime + (at || 0));
  }
  A.pluck = (i, vol) => { if (A.sound) pluck(i, vol == null ? 0.5 : vol); };

  /* A slow wandering tune: a short phrase, then a long breath. */
  let step = 2;
  function phrase() {
    clearTimeout(musicTimer);
    if (!ctx || !A.music || !A.sound || document.hidden) { musicTimer = setTimeout(phrase, 4000); return; }
    const n = 3 + Math.floor(Math.random() * 4);
    let at = 0;
    for (let i = 0; i < n; i++) {
      step = Math.max(0, Math.min(strings.length - 1, step + [-2, -1, -1, 1, 1, 2][Math.floor(Math.random() * 6)]));
      pluck(step, 0.34 + Math.random() * 0.2, at);
      if (Math.random() < 0.22) pluck(Math.max(0, step - 2), 0.2, at + 0.02);
      at += [0.42, 0.42, 0.63, 0.84][Math.floor(Math.random() * 4)];
    }
    musicTimer = setTimeout(phrase, (at + 3.5 + Math.random() * 6) * 1000);
  }

  function startWind() {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf; src.loop = true;
    windFilter = ctx.createBiquadFilter(); windFilter.type = 'bandpass'; windFilter.frequency.value = 420; windFilter.Q.value = 0.7;
    windGain = ctx.createGain(); windGain.gain.value = 0;
    const lfo = ctx.createOscillator(), lg = ctx.createGain();
    lfo.frequency.value = 0.09; lg.gain.value = 190;
    lfo.connect(lg); lg.connect(windFilter.frequency);
    src.connect(windFilter); windFilter.connect(windGain); windGain.connect(master);
    src.start(); lfo.start();
  }
  A.setWind = function (v) {
    if (!windGain) return;
    windGain.gain.setTargetAtTime(0.012 + 0.06 * v, ctx.currentTime, 1.5);
  };

  /* Browsers only allow sound after a tap, so this is called on the first one. */
  A.unlock = function () {
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume();
    if (started) return;
    started = true;
    // kantele strings: D E F# G A B D E
    [293.66, 329.63, 369.99, 392.0, 440.0, 493.88, 587.33, 659.25].forEach((f) => strings.push(pluckBuffer(f)));
    startWind();
    musicTimer = setTimeout(phrase, 2500);
  };
  A.setSound = function (on) { A.sound = on; if (master) master.gain.setTargetAtTime(on ? 0.9 : 0, ctx.currentTime, 0.05); };
  A.setMusic = function (on) { A.music = on; };
  A.pause = function () { if (ctx && ctx.state === 'running') ctx.suspend(); };
  A.resume = function () { if (ctx && started && ctx.state === 'suspended') ctx.resume(); };
})(window.PN = window.PN || {});
