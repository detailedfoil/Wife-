// Measures every shore item's footprint in its own frame (min x, max x, min z, max z, height) into feet.json.
// Run after adding new cosmetics:  node measure.js
const fs = require('fs');
const { launch, enter, speed } = require('./harness');
(async () => {
  const { browser, page } = await launch({ width: 390, height: 844, save: {}, mobile: true, query: '?pr=0.3' });
  await enter(page); await speed(page, 8);
  const r = await page.evaluate(() => {
    const T = THREE, out = {};
    PN.DATA.DECOR.forEach((d) => {
      let o; try { o = d.id === 'lights' || d.id === 'viirit' ? PN.Props.decor(d.id, PN.World.DEN.arch) : PN.Props.decor(d.id); } catch (e) { return; }
      if (!o || !o.g) return;
      o.g.position.set(0, 0, 0); o.g.rotation.set(0, 0, 0); o.g.updateMatrixWorld(true);
      const b = new T.Box3().setFromObject(o.g);
      out[d.id] = [b.min.x, b.max.x, b.min.z, b.max.z, b.max.y].map((v) => Math.round(v * 100) / 100);
    });
    return out;
  });
  fs.writeFileSync(__dirname + '/feet.json', JSON.stringify(r));
  console.log(JSON.stringify(r));
  await browser.close();
})();
