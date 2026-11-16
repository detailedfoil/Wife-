// Test harness for Pikku Norppa: loads the game with a crafted save and screenshots it.
// Needs Playwright and Chrome. Serve the repo root first:  python3 -m http.server 8123 --bind 127.0.0.1
const { chromium } = require(process.env.PLAYWRIGHT || '/opt/npm-tools/node_modules/playwright');
const URL = process.env.NORPPA_URL || 'http://127.0.0.1:8123/norppa/index.html';

async function launch(opts = {}) {
  const { width = 390, height = 844, dpr = 1, save = {}, query = '?pr=0.4', mobile = true, init = null } = opts;
  const browser = await chromium.launch({
    executablePath: process.env.CHROME || '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
  });
  const context = await browser.newContext({
    viewport: { width, height }, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile, serviceWorkers: 'block',
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  if (init) await page.addInitScript(init);
  await page.addInitScript((save) => {
    try {
      if (!localStorage.getItem('pikkunorppa.save.v1') && !window.__noSave) {
        const now = Date.now();
        const s = Object.assign({
          name: 'Pip', createdAt: now - 20 * 864e5, lastSeen: now, stage: 1, ageMs: 7 * 864e5, xp: 300, maxLevel: 6,
          stats: { food: 90, joy: 80, energy: 95, clean: 95 }, coins: 5000, tut: 9,
          owned: { lantern: true, sauna: true, game_swim: true, game_stack: true, game_puff: true, game_piano: true, game_toss: true, game_coffee: true, game_curl: true, game_sled: true, game_bj: true },
          settings: { sound: false, music: false, instrument: 'original', sky: 'day', haptics: false, lang: 'en' },
        }, save);
        localStorage.setItem('pikkunorppa.save.v1', JSON.stringify(s));
      }
    } catch (e) {}
  }, save);
  await page.goto(URL + query);
  await page.waitForSelector('#titleGo:not([hidden])', { timeout: 30000 });
  return { browser, context, page, errors };
}

async function enter(page) {
  await page.click('#titleGo');
  // wait for the game to be ready, clicking through any welcome-back modals
  for (let i = 0; i < 60; i++) {
    const st = await page.evaluate(() => ({ ready: PN.Game.ready === true, modal: !document.getElementById('modal').hidden }));
    if (st.ready && !st.modal) break;
    if (st.modal) await page.evaluate(() => { const b = document.querySelector('#modalCard button'); if (b) b.click(); });
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(400);
}

module.exports = { launch, enter, URL };

/* Skip most 3D draws so game logic runs near real time; snap() draws a few frames for a screenshot. */
async function speed(page, every = 12) {
  await page.evaluate((every) => {
    const W = PN.World; if (!W.__render) W.__render = W.render;
    let n = 0; window.__every = every;
    W.render = function () { if (window.__every === 1 || ++n % window.__every === 0) return W.__render.apply(this, arguments); };
  }, every);
}
async function snap(page, path, opts = {}) {
  await page.evaluate(() => { window.__every = 1; });
  await page.waitForTimeout(opts.wait || 1500);
  await page.screenshot(Object.assign({ path }, opts.clip ? { clip: opts.clip } : {}));
  await page.evaluate((e) => { window.__every = e; }, opts.every || 12);
}
module.exports.speed = speed; module.exports.snap = snap;
