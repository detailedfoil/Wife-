// Screenshots of the pup skills update: the Family album with the family bonus, a pup's skill card, a game result with
// the bonus notes, and the grow-up reveal. Serve the repo root first:  python3 -m http.server 8123 --bind 127.0.0.1
// then:  node tools/clinic/pup_shots.js [WxH] [en|fi]
const { launch, enter } = require('../shore-layout/harness');
const OUT = (process.env.OUT || '/tmp/shots') + '/';
const [W, H] = (process.argv[2] || '390x844').split('x').map(Number);
const LANG = process.argv[3] || 'en';
const wait = (p, ms) => p.waitForTimeout(ms);
const H1 = 3600e3, DAY = 864e5;
(async () => {
  const now = Date.now();
  const grown = (name, spec, extra) => Object.assign({ name, bornAt: now - 9 * DAY, endAt: now - 6 * DAY, fate: 'grown', spec, wear: { head: 'pipo_red' } }, extra || {});
  const save = {
    stage: 2, ageMs: 30 * DAY, xp: 5000, maxLevel: 18, pupSeq: 6, nextPupAt: now + DAY, lookChosen: 1,
    stats: { food: 90, joy: 80, energy: 95, clean: 95 },
    settings: { sound: false, music: false, instrument: 'original', sky: 'day', haptics: false, lang: LANG },
    pups: [{ id: 6, name: 'Aino', bornAt: now - DAY, food: 80, joy: 80, sick: false, starveMs: 0, grownMs: DAY, ready: false, wear: { neck: 'scarf_blue' },
      lean: 'water', skill: { water: 6.5, sport: 3, brain: 1, care: 1.25 } }],
    family: [
      grown('Eero', 'water', { callAt: now - 2 * H1, arriveAt: now - H1, leaveAt: now + 6 * H1, paid: true }),
      grown('Helmi', 'care'), grown('Otso', 'all'), grown('Ilona', 'brain'),
      { name: 'Pikku', bornAt: now - 20 * DAY, endAt: now - 19 * DAY, fate: 'lost', wear: { head: 'tonttu' } },
    ],
  };
  const { browser, page, errors } = await launch({ width: W, height: H, save });
  await enter(page);
  // 0. the main screen with the Family button
  await wait(page, 1200);
  await page.screenshot({ path: OUT + 'pups_home_' + LANG + '.png' });
  await page.click('.fam-chip');
  await wait(page, 1500);
  await page.screenshot({ path: OUT + 'pups_chip_open_' + LANG + '.png' });
  await page.evaluate(() => PN.UI.openSheet('album', 'pupstats'));
  await wait(page, 1200);
  await page.screenshot({ path: OUT + 'pups_stats_' + LANG + '.png' });
  await page.evaluate(() => { const b = document.getElementById('sheetBody'); b.scrollTop = b.scrollHeight; });
  await wait(page, 500);
  await page.screenshot({ path: OUT + 'pups_stats2_' + LANG + '.png' });
  await page.evaluate(() => PN.UI.closeSheet());
  await wait(page, 600);
  // 1. the Family album
  await page.evaluate(() => PN.UI.openSheet('album', 'family'));
  await wait(page, 1500);
  await page.screenshot({ path: OUT + 'pups_album_' + LANG + '.png' });
  await page.evaluate(() => { const r = [...document.querySelectorAll('.row')].pop(); if (r) r.scrollIntoView({ block: 'end' }); });
  await wait(page, 600);
  await page.screenshot({ path: OUT + 'pups_album2_' + LANG + '.png' });
  await page.evaluate(() => PN.UI.closeSheet());
  await wait(page, 600);
  // 2. the pup card with her skills
  page.evaluate(() => PN.Game.pupInfo(0));
  await page.waitForSelector('#modal:not([hidden])'); await wait(page, 700);
  await page.screenshot({ path: OUT + 'pups_card_' + LANG + '.png' });
  await page.evaluate(() => { const b = [...document.querySelectorAll('#modalCard button')].pop(); b.click(); });
  await wait(page, 700);
  // 3. a game result: Fish Rain with Eero the Swimmer visiting and Aino at home learning
  page.evaluate(() => { const G = PN.Game, r = PN.Sim.gameReward(G.state, 'catch', 24, {}, null, 45, Date.now(), 1); G.endGame('catch', 24, r); });
  await page.waitForSelector('#modal:not([hidden])'); await wait(page, 900);
  await page.screenshot({ path: OUT + 'pups_result_' + LANG + '.png' });
  await page.evaluate(() => { const b = [...document.querySelectorAll('#modalCard button')].pop(); b.click(); });
  await wait(page, 900);
  // 4. Aino grows up: wave goodbye, then the reveal
  await page.evaluate(() => { const p = PN.Game.state.pups[0]; p.grownMs = PN.Sim.T.pupGrow; p.ready = true; });
  page.evaluate(() => PN.Game.pupInfo(0));
  await page.waitForSelector('#modal:not([hidden])'); await wait(page, 500);
  await page.evaluate(() => { document.querySelector('#modalCard button').click(); });   // Wave goodbye is first
  for (let i = 0; i < 180; i++) {   // the swim to the ice hole is slow on a software renderer
    await wait(page, 500);
    const t = await page.evaluate(() => !document.getElementById('modal').hidden && document.querySelector('#modalCard h3') && document.querySelector('#modalCard h3').textContent);
    if (t && /grown up|aikuinen/.test(t)) break;
  }
  await wait(page, 600);
  await page.screenshot({ path: OUT + 'pups_reveal_' + LANG + '.png' });
  console.log('errors:', errors);
  await browser.close();
})();
