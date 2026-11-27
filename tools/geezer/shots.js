// Screenshots of the geezer home prototype. Serve the repo root first:  python3 -m http.server 8123 --bind 127.0.0.1
// then:  node tools/geezer/shots.js [WxH] [en|fi]
const { launch, enter } = require('../shore-layout/harness');
const OUT = (process.env.OUT || '/tmp/shots') + '/';
const [W, H] = (process.argv[2] || '390x844').split('x').map(Number);
const LANG = process.argv[3] || 'en';
const tag = (W > H ? 'land_' : 'port_') + LANG;
const wait = (p, ms) => p.waitForTimeout(ms);
(async () => {
  const save = { stage: 2, ageMs: 30 * 864e5, xp: 5000, maxLevel: 18, lookChosen: 1, dev: true, coins: 1234,
    stats: { food: 70, joy: 85, energy: 40, clean: 20 },
    settings: { sound: false, music: false, instrument: 'original', sky: 'day', haptics: false, lang: LANG } };
  const { browser, page, errors } = await launch({ width: W, height: H, save, dpr: 2, query: '?pr=1' });
  await page.evaluate(() => localStorage.setItem('pikkunorppa.geezer', '1'));
  await enter(page);
  await page.evaluate(() => { PN.Game.state.dev = true; });
  await wait(page, 1500);
  await page.screenshot({ path: OUT + 'geezer_home_' + tag + '.png' });
  await page.mouse.click(W / 2, H * (W > H ? 0.4 : 0.42));
  await wait(page, 500);
  await page.screenshot({ path: OUT + 'geezer_talk_' + tag + '.png' });
  await page.click('[data-gz="feed"]'); await wait(page, 500);
  await page.screenshot({ path: OUT + 'geezer_scran_' + tag + '.png' });
  await page.click('[data-gz="eat"]'); await wait(page, 750);
  await page.screenshot({ path: OUT + 'geezer_eat_' + tag + '.png' });
  await page.click('[data-gz="shop"]'); await wait(page, 500);
  await page.screenshot({ path: OUT + 'geezer_shop_' + tag + '.png' });
  await page.evaluate(() => { PN.UI.openSheet('settings'); }); await wait(page, 900);
  await page.evaluate(() => { const r = document.querySelector('[data-do="geezer"]'); if (r) r.scrollIntoView({ block: 'center' }); }); await wait(page, 400);
  await page.screenshot({ path: OUT + 'geezer_settings_' + tag + '.png' });
  console.log(errors.length ? 'ERRORS: ' + errors.join('\n') : 'no page errors');
  await browser.close();
})();
