// Screenshots of the look studio: the creator on a new game, the offer to an old save, and the clinic with extras.
// Serve the repo root first:  python3 -m http.server 8123 --bind 127.0.0.1      then: node tools/clinic/shots.js [WxH]
const { launch, enter } = require('../shore-layout/harness');
const OUT = (process.env.OUT || '/tmp/shots') + '/';
const [W, H] = (process.argv[2] || '390x844').split('x').map(Number);
const wait = (p, ms) => p.waitForTimeout(ms);
(async () => {
  // 1. a brand new game: the creator comes up during the intro
  {
    const { browser, page, errors } = await launch({ width: W, height: H, init: () => { window.__noSave = true; } });
    await page.click('#titleGo');
    await page.waitForSelector('.clinic-overlay.creating', { timeout: 120000 });
    await wait(page, 1500);
    await page.screenshot({ path: OUT + 'create_pup.png' });
    await page.click('[data-view="grown"]'); await wait(page, 900);
    await page.screenshot({ path: OUT + 'create_grown.png' });
    await page.click('[data-tab="Markings"]'); await page.click('[data-c="surprise"]'); await wait(page, 900);
    await page.screenshot({ path: OUT + 'create_markings.png' });
    await page.click('[data-c="done"]');
    await page.waitForSelector('#modal:not([hidden])', { timeout: 10000 }); await wait(page, 600);
    await page.screenshot({ path: OUT + 'create_name.png' });
    console.log('new game errors:', errors);
    await browser.close();
  }
  // 2. an old save is offered the creator once
  {
    const { browser, page, errors } = await launch({ width: W, height: H, save: { stage: 2, maxLevel: 31, xp: 9000 } });
    await page.click('#titleGo');
    for (let i = 0; i < 40; i++) {
      const t = await page.evaluate(() => !document.getElementById('modal').hidden && document.querySelector('#modalCard h3').textContent);
      if (t && /choose her look/i.test(t)) break;
      if (t) await page.evaluate(() => document.querySelector('#modalCard button').click());
      await wait(page, 500);
    }
    await wait(page, 700);
    await page.screenshot({ path: OUT + 'offer.png' });
    console.log('offer errors:', errors);
    await browser.close();
  }
  // 3. the clinic, with every kind of extra
  {
    const { browser, page, errors } = await launch({ width: W, height: H, save: { stage: 2, maxLevel: 31, xp: 9000, coins: 900000, lookChosen: true } });
    await enter(page);
    await page.evaluate(() => { PN.Clinic.open(); });
    await page.waitForSelector('.clinic-overlay'); await wait(page, 1200);
    await page.screenshot({ path: OUT + 'clinic_open.png' });
    const looks = {
      hearts_one: { coat: 'silver', decal: 'hearts', decalLayout: 'one', decalColor: 'coral' },
      stars_many: { coat: 'charcoal', pattern: 'plain', decal: 'stars', decalColor: 'gold' },
      snow_many: { coat: 'grey', decal: 'snowflakes', decalColor: 'snow' },
      aurora: { coat: 'charcoal', pattern: 'plain', decal: 'aurora', decalColor: 'teal', finish: 'aurora' },
      constellation: { coat: 'charcoal', pattern: 'plain', decal: 'constellation', decalColor: 'gold', decalLayout: 'one' },
      butterflies: { coat: 'cream', belly: 'ivory', decal: 'butterflies', decalColor: 'lavender', cheeks: 'rosy' },
      designs: { coat: 'silver', gradient: 'lavender', mask: 'charcoal', flippers: 'pink', tail: 'teal' },
      face: { coat: 'sand', eye: 'ocean', eyeRight: 'gold', eyeStar: 'star', cheeks: 'rosy', freckles: 'cheeks', whiskerColor: 'pink', whiskerLength: 1.5 },
      pearl: { coat: 'pink', belly: 'ivory', finish: 'pearl', decal: 'cloudberries', decalColor: 'amber' },
      shimmer: { coat: 'blue', finish: 'shimmer', decal: 'paws', decalColor: 'snow' },
    };
    for (const [name, look] of Object.entries(looks)) {
      await page.evaluate((look) => {
        const s = PN.Game.state; s.appearance = PN.Appearance.normalize(Object.assign({}, s.birthAppearance, look));
        PN.Clinic.close(); PN.Clinic.open();
      }, look);
      await wait(page, 1300);
      await page.locator('.clinic-preview').screenshot({ path: OUT + 'look_' + name + '.png' });
      if (name === 'face') {   // a close look at the face
        await page.evaluate(() => { const c = document.querySelector('.clinic-stage canvas'); c.dispatchEvent(new PointerEvent('pointerdown', { clientX: 0, pointerId: 1 })); c.dispatchEvent(new PointerEvent('pointermove', { clientX: -40, pointerId: 1 })); c.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 })); });
      }
    }
    for (const tab of ['Markings', 'Designs', 'Face']) { await page.click('[data-tab="' + tab + '"]'); await wait(page, 300); await page.screenshot({ path: OUT + 'clinic_' + tab + '.png' }); }
    console.log('clinic errors:', errors);
    await browser.close();
  }
})();
