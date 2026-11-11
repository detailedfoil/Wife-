/* Pikku Norppa: where the sun and moon are, what season it is and what the weather is doing.
   The lake sits by Inari in Finnish Lapland, at about 69 degrees north, so midwinter
   has a polar night and midsummer has a sun that never sets. The sky is worked out for
   that spot at this very moment, wherever the player is, and the weather is fetched
   live from Open-Meteo (with a made-up forecast to fall back on when there is no signal). */
(function (PN) {
  'use strict';

  const RAD = Math.PI / 180, DAY = 864e5, HOUR = 36e5;
  const LAT = 68.906, LON = 27.028, PLACE = 'Inari';
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  function dayOfYear(d) {
    return (d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 0)) / DAY;
  }
  /* How far round the year we are, as an angle (Spencer's formulas below use it). */
  const yearAngle = (d) => 2 * Math.PI / 365 * (dayOfYear(d) - 1.5);
  /* Sun time at the lake: hours since the sun was last due north, worked out from the
     real moment, the lake's longitude and the small yearly wobble of the sundial. */
  function clockHours(d) {
    const g = yearAngle(d);
    const wobble = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));   // minutes
    const utc = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
    return ((utc + LON / 15 + wobble / 60) % 24 + 24) % 24;
  }
  /* What the clocks on the wall say in Lapland, as "14:05". */
  let fmt = null;
  function wallClock(d) {
    try {
      if (!fmt) fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Helsinki', hour: '2-digit', minute: '2-digit', hour12: false });
      return fmt.format(d);
    } catch (e) {
      const t = new Date(d.getTime() + 2 * HOUR), p = (n) => (n < 10 ? '0' : '') + n;
      return p(t.getUTCHours()) + ':' + p(t.getUTCMinutes());
    }
  }

  /* Height above the horizon and compass bearing, in degrees, for a body at a given
     declination and hour angle. Bearing runs clockwise from north. */
  function altAz(decl, hourAngle) {
    const sl = Math.sin(LAT * RAD), cl = Math.cos(LAT * RAD);
    const sd = Math.sin(decl * RAD), cd = Math.cos(decl * RAD);
    const hr = hourAngle * RAD;
    const el = Math.asin(sl * sd + cl * cd * Math.cos(hr)) / RAD;
    const az = (Math.atan2(Math.sin(hr), Math.cos(hr) * sl - Math.tan(decl * RAD) * cl) / RAD + 540) % 360;
    return { el, az };
  }

  function sunDecl(d) {
    const g = yearAngle(d);
    return (0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g)
      - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g)) / RAD;
  }

  function sun(d) {
    const decl = sunDecl(d), hours = clockHours(d);
    const p = altAz(decl, (hours - 12) * 15);
    return { el: p.el, az: p.az, decl, hours, noonEl: 90 - LAT + decl, midnightEl: decl - (90 - LAT) };
  }

  function moon(d) {
    const syn = 29.530588853;
    const days = (d.getTime() - Date.UTC(2000, 0, 6, 18, 14)) / DAY;
    const phase = ((days / syn) % 1 + 1) % 1;                       // 0 new, 0.5 full
    const decl = -sunDecl(d) * Math.cos(2 * Math.PI * (phase - 0.5)) * 0.9;   // the full moon rides high in winter
    const p = altAz(decl, (clockHours(d) - 12) * 15 - phase * 360);
    return { el: p.el, az: p.az, phase, lit: (1 - Math.cos(2 * Math.PI * phase)) / 2 };
  }

  function season(d) {
    const doy = dayOfYear(d), s = sun(d);
    const snow = doy < 120 ? 1 : doy < 150 ? 1 - smooth(120, 150, doy) : doy < 283 ? 0 : smooth(283, 304, doy);
    const ice = doy < 128 ? 1 : doy < 152 ? 1 - smooth(128, 152, doy) : doy < 298 ? 0 : smooth(298, 316, doy);
    const name = doy >= 335 || doy < 91 ? 'talvi' : doy < 152 ? 'kevat' : doy < 244 ? 'kesa' : 'syksy';
    return { snow, ice, name, polarNight: s.noonEl < -0.8, midnightSun: s.midnightEl > -0.8, doy };
  }

  /* Smooth noise over time, so weather drifts instead of flickering and is the
     same for everyone at the same moment. */
  function h1(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  function vnoise(x) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return h1(i) * (1 - u) + h1(i + 1) * u; }

  function madeUp(d) {
    const th = d.getTime() / HOUR, se = season(d), s = sun(d);
    const raw = 0.55 * vnoise(th / 7.3 + 3.7) + 0.3 * vnoise(th / 2.9 + 51.2) + 0.15 * vnoise(th / 1.1 + 8.4);
    const cloud = smooth(0.36, 0.7, raw);
    const precip = smooth(0.6, 0.84, raw);
    const wind = 0.15 + 0.85 * vnoise(th / 4.1 + 91);
    const temp = Math.round(0.5 - 13.5 * Math.cos(2 * Math.PI * (se.doy - 20) / 365.24)
      + 7 * (2 * vnoise(th / 37 + 5.5) - 1) + 2.5 * Math.cos((s.hours - 15) * 15 * RAD) * smooth(-2, 12, s.noonEl)
      - 3 * (1 - cloud) * (se.snow));
    const frozen = temp <= 1;
    let kind = 'clear';
    if (precip > 0.55) kind = frozen ? 'heavysnow' : 'rain';
    else if (precip > 0.04) kind = frozen ? 'snow' : 'drizzle';
    else if (cloud > 0.62) kind = 'cloudy';
    else if (cloud > 0.25) kind = 'partly';
    const act = 0.6 * vnoise(th / 3.1 + 40.7) + 0.4 * vnoise(th / 0.6 + 8.8);
    return { cloud, precip, wind, temp, kind, frozen, aurora: smooth(0.46, 0.76, act), live: false };
  }

  /* ---------- the real weather over the lake ---------- */
  const WX_KEY = 'pikkunorppa.wx', WX_URL = 'https://api.open-meteo.com/v1/forecast?latitude=' + LAT + '&longitude=' + LON
    + '&wind_speed_unit=ms&current=temperature_2m,precipitation,wind_speed_10m,weather_code';
  const FRESH = 3 * HOUR;               // after this long without news, go back to the made-up forecast
  const live = { now: null, prev: null, at: 0, changed: 0, busy: false, tried: 0 };
  /* How hard it is coming down, 0 to 1, for each of the weather service's codes. */
  const FALL = { 51: 0.15, 53: 0.25, 55: 0.4, 56: 0.2, 57: 0.4, 61: 0.3, 63: 0.6, 65: 0.9, 66: 0.3, 67: 0.7, 71: 0.25, 73: 0.6, 75: 0.95, 77: 0.2,
    80: 0.3, 81: 0.6, 82: 0.9, 85: 0.4, 86: 0.85, 95: 0.8, 96: 0.9, 99: 1 };
  function fromService(c) {
    if (!c || typeof c.temperature_2m !== 'number' || !isFinite(c.temperature_2m)) return null;
    const code = c.weather_code | 0, t = c.temperature_2m;
    const snowy = (code >= 71 && code <= 77) || code === 85 || code === 86;
    let precip = FALL[code] || 0;
    if (!precip && c.precipitation > 0.1) precip = 0.15;
    let cloud = typeof c.cloud_cover === 'number' ? clamp(c.cloud_cover / 100, 0, 1) : code === 0 ? 0.05 : code === 1 ? 0.2 : code === 2 ? 0.5 : 0.95;
    if (precip > 0 || code === 45 || code === 48) cloud = Math.max(cloud, 0.85);
    const frozen = snowy || (precip > 0 ? t <= 0.5 : t <= 1);
    let kind = 'clear';
    if (precip > 0.55) kind = frozen ? 'heavysnow' : 'rain';
    else if (precip > 0.04) kind = frozen ? 'snow' : 'drizzle';
    else if (cloud > 0.62) kind = 'cloudy';
    else if (cloud > 0.25) kind = 'partly';
    return { cloud, precip, wind: clamp((c.wind_speed_10m || 0) / 12, 0.05, 1), temp: Math.round(t), kind, frozen };
  }
  function take(obs, at) {
    if (!obs) return false;
    live.prev = live.now && Date.now() - live.at < FRESH ? current(Date.now()) : null;
    live.now = obs; live.at = at; live.changed = Date.now();
    return true;
  }
  /* The live weather, eased in over a few seconds so the sky never jumps. */
  function current(nowMs) {
    const n = live.now, p = live.prev;
    if (!p) return n;
    const k = smooth(0, 20000, nowMs - live.changed);
    if (k >= 1) return n;
    const mix = (a, b) => a + (b - a) * k;
    return { cloud: mix(p.cloud, n.cloud), precip: mix(p.precip, n.precip), wind: mix(p.wind, n.wind), temp: Math.round(mix(p.temp, n.temp)),
      kind: k > 0.5 ? n.kind : p.kind, frozen: k > 0.5 ? n.frozen : p.frozen };
  }
  function refresh() {
    if (live.busy || typeof fetch !== 'function') return Promise.resolve(false);
    live.busy = true; live.tried = Date.now();
    const ask = (url) => {
      const ctl = typeof AbortController === 'function' ? new AbortController() : null;
      const timer = setTimeout(() => { if (ctl) ctl.abort(); }, 9000);
      return fetch(url, { cache: 'no-store', signal: ctl ? ctl.signal : undefined })
        .then((r) => { clearTimeout(timer); if (!r.ok) throw new Error('weather ' + r.status); return r.json(); }, (e) => { clearTimeout(timer); throw e; });
    };
    return ask(WX_URL + ',cloud_cover').catch(() => ask(WX_URL)).then((j) => {
      const obs = fromService(j && j.current);
      if (!take(obs, Date.now())) return false;
      try { localStorage.setItem(WX_KEY, JSON.stringify({ at: live.at, obs })); } catch (e) { /* no room: never mind */ }
      return true;
    }).catch(() => false).then((ok) => { live.busy = false; return ok; });
  }
  /* Start listening for the weather: once now, then every quarter of an hour while the game is on screen. */
  function startLive() {
    try {
      const kept = JSON.parse(localStorage.getItem(WX_KEY) || 'null');
      if (kept && kept.obs && typeof kept.obs.temp === 'number' && Date.now() - kept.at < FRESH && kept.at <= Date.now()) { live.now = kept.obs; live.at = kept.at; }
    } catch (e) { /* a broken note is no weather at all */ }
    const due = () => { if (Date.now() - live.tried > 15 * 60e3 && (typeof document === 'undefined' || !document.hidden)) refresh(); };
    due();
    setInterval(due, 60e3);
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', due);
  }
  const isLive = (d) => !!live.now && Date.now() - live.at < FRESH && Math.abs(d.getTime() - Date.now()) < 10 * 60e3;

  function weather(d) {
    const w = madeUp(d);
    if (!isLive(d)) return w;
    const c = current(Date.now());
    w.cloud = c.cloud; w.precip = c.precip; w.wind = c.wind; w.temp = c.temp; w.kind = c.kind; w.frozen = c.frozen; w.live = true;
    return w;
  }

  PN.Astro = { LAT, LON, PLACE, sun, moon, season, weather, madeUp, dayOfYear, smooth, wallClock, startLive, refresh, isLive, fromService, live };
})(window.PN = window.PN || {});
