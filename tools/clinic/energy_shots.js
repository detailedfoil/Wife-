// Screenshots of the out-of-energy card: asleep with cans, asleep with no cans but coins, no cans and no coins, awake and low.
// Serve the repo root first: python3 -m http.server 8123 --bind 127.0.0.1   then: node tools/clinic/energy_shots.js [WxH] [en|fi]
const { launch, enter } = require('../shore-layout/harness');
const OUT = (process.env.OUT || '/tmp/shots') + '/';
const [W, H] = (process.argv[2] || '390x844').split('x').map(Number);
const LANG = process.argv[3] || 'en';
const wait = (p, ms) => p.waitForTimeout(ms);
const mk = (extra) => Object.assign({
  stage: 2, ageMs: 30 * 864e5, xp: 500, maxLevel: 8, lookChosen: 1, coins: 500,
  stats: { food: 90, joy: 80, energy: 90, clean: 95 }, pantry: {},
  settings: { sound: false, music: false, instrument: 'original', sky: 'day', haptics: false, lang: LANG },
}, extra);
async function scene(name, extra, act) {
  const { browser, page, errors } = await launch({ width: W, height: H, save: mk(extra) });
  await enter(page); await wait(page, 1500);
  await act(page);
  await wait(page, 900);
  await page.screenshot({ path: OUT + 'energy_' + name + '_' + LANG + (W > H ? '_land' : '') + '.png' });
  const info = await page.evaluate(() => ({ asleep: PN.Game.state.asleep, e: Math.round(PN.Game.state.stats.energy), open: !document.getElementById('modal').hidden, cans: JSON.stringify(PN.Game.state.pantry) }));
  console.log(name, JSON.stringify(info), errors.length ? errors.join('|') : '');
  await browser.close();
}
(async () => {
  const tired = (e) => (p) => p.evaluate((e) => { const s = PN.Game.state; s.stats.energy = e; }, e);
  // 1. exhausted at 3 energy with cans: she dozes off, the card comes by itself
  await scene('asleep_cans', { coins: 40, pantry: { redseal: 2, sealsius: 1 } }, async (p) => { await tired(3)(p); await wait(p, 7000); });
  // 2. asleep, no cans, coins to spare: buy and drink
  await scene('asleep_buy', { coins: 80 }, async (p) => { await tired(3)(p); await wait(p, 7000); });
  // 3. asleep, no cans, no coins: timer only
  await scene('asleep_none', { coins: 3 }, async (p) => { await tired(3)(p); await wait(p, 7000); });
  // 4. awake and low, tries to play from the Play menu
  await scene('play_blocked', { coins: 40, pantry: { redseal: 1 } }, async (p) => { await tired(12)(p); await p.evaluate(() => PN.UI.openSheet('play')); await wait(p, 900); });
  // 5. blocked at the game itself
  await scene('start_blocked', { coins: 40, pantry: { kraken: 1 } }, async (p) => { await tired(3)(p); await wait(p, 7000); await p.evaluate(() => document.querySelector('#modalCard button.ghost') && [...document.querySelectorAll('#modalCard button')].pop().click()); await wait(p, 700); await p.evaluate(() => PN.Game.startGame(PN.GAME_ORDER[0])); });
  // 6. tap the can: she wakes and the card does not come back
  await scene('drunk', { coins: 40, pantry: { sealsius: 1 } }, async (p) => { await tired(3)(p); await wait(p, 7000); await p.click('#modalCard .actions .btn'); await wait(p, 3500); });
})();
