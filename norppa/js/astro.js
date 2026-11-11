/* Pikku Norppa: where the sun and moon are, what season it is and what the weather is doing.
   The lake sits at about 69 degrees north, in Finnish Lapland, so midwinter has a
   polar night and midsummer has a sun that never sets. Your own clock is used as
   local time there. */
(function (PN) {
  'use strict';

  const RAD = Math.PI / 180, DAY = 864e5, HOUR = 36e5;
  const LAT = 68.9;
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  function dayOfYear(d) {
    return (d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / DAY;
  }
  function clockHours(d) {
    return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
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
    return -23.44 * Math.cos(2 * Math.PI * (dayOfYear(d) + 10) / 365.24);
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

  function weather(d) {
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
    return { cloud, precip, wind, temp, kind, frozen, aurora: smooth(0.46, 0.76, act) };
  }

  PN.Astro = { LAT, sun, moon, season, weather, dayOfYear, smooth };
})(window.PN = window.PN || {});
