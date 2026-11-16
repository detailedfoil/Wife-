// Puts every shore item out and screenshots the default (auto-framed) view at each size, plus an overhead shot.
// node shots.js 390x844,844x390,768x1024     env: FEW=id,id (just those)  NONE=1 (nothing extra)
// Put every shore item out, then: default views, an overhead map, and each item's footprint.
// args: sizes (WxH,...)  env: TAG (output prefix), NONE=1 (nothing extra out), FEW=id,id
const fs = require('fs');
const { launch, enter, speed, snap } = require('./harness');
const sizes = (process.argv[2] || '390x844,844x390').split(',').map((s) => s.split('x').map(Number));
const TAG = process.env.TAG || 'now';
const OUT = (process.env.OUT || __dirname + '/shots') + '/'; fs.mkdirSync(OUT, { recursive: true });
(async () => {
  let wroteMap = false;
  for (const [w, h] of sizes) {
    const { browser, page, errors } = await launch({ width: w, height: h, save: {}, mobile: w < 1100, query: '?pr=0.6' });
    await enter(page); await speed(page, 8);
    await page.evaluate((env) => {
      const st = PN.Game.state;
      const ids = env.FEW ? env.FEW.split(',').concat(['sauna', 'lantern']) : env.NONE ? ['sauna', 'lantern'] : PN.DATA.DECOR.map((d) => d.id);
      PN.DATA.DECOR.forEach((d) => { st.owned[d.id] = true; st.placed[d.id] = false; });
      ids.forEach((id) => { st.placed[id] = true; });
      if (!env.FEW && !env.NONE) st.placed.lights = false;   // shares a place with the bunting
      st.stats.energy = 100; st.asleep = false;
      PN.World.setDecor(st.placed); PN.UI.refresh();
      if (PN.World.resetView) PN.World.resetView();
    }, { FEW: process.env.FEW || '', NONE: process.env.NONE || '' });
    await page.waitForTimeout(2500);
    await snap(page, OUT + TAG + '_' + w + 'x' + h + '.png', { wait: 600, every: 8 });
    if (!wroteMap) {
      wroteMap = true;
      const info = await page.evaluate(() => {
        const T = THREE, W = PN.World, out = {};
        PN.DATA.DECOR.forEach((d) => {
          const o = W.decorOf(d.id); if (!o) return;
          o.g.updateMatrixWorld(true);
          const b = new T.Box3().setFromObject(o.g);
          if (!isFinite(b.min.x)) return;
          out[d.id] = { min: [b.min.x, b.min.z], max: [b.max.x, b.max.z], h: b.max.y - b.min.y, y: b.min.y, land: W.isLand((b.min.x + b.max.x) / 2, (b.min.z + b.max.z) / 2) };
        });
        const seal = PN.Game.seal.g.position;
        return { items: out, seal: [seal.x, seal.z], home: [W.HOME.x, W.HOME.z], hole: [W.HOLE.x, W.HOLE.z], den: [W.DEN.x, W.DEN.z], ball: [W.BALL.x, W.BALL.z] };
      });
      fs.writeFileSync(OUT + TAG + '_map.json', JSON.stringify(info));
      // overhead picture
      await page.evaluate(() => {
        const T = THREE, W = PN.World;
        const c = new T.OrthographicCamera(-11, 11, 7, -18, 0.1, 200);
        c.position.set(0, 60, 0); c.up.set(0, 0, -1); c.lookAt(0, 0, 0);
        c.left = -12; c.right = 12; c.top = 18; c.bottom = -7;   // with up = -z, top of the picture is far (-z)
        c.updateProjectionMatrix();
        W.override = { scene: W.scene, camera: c };
      });
      await page.setViewportSize({ width: 960, height: 1000 });
      await page.waitForTimeout(800);
      await page.screenshot({ path: OUT + TAG + '_top.png' });
      await page.evaluate(() => { PN.World.override = null; });
    }
    console.log(w + 'x' + h, errors.filter((e) => !/TUNNEL/.test(e)).slice(0, 3));
    await browser.close();
  }
})();
