/* Pikku Norppa: the "geezer" home prototype in 3D (developer mode only).
   Big Dave in his armchair in a messy lounge, built from simple three.js shapes in
   the same soft style as the shore. Original art inspired by the owner's reference
   picture; every brand on it is made up and the cans are fizzy pop.
   geezer.js shows it by handing this scene to the game's own renderer (World.override),
   so no second 3D canvas is made. Kept in its own file so other art work does not collide. */
(function (PN) {
  'use strict';
  const T = THREE, U = PN.U, TAU = Math.PI * 2;

  const SKIN = 0xf0b08a, SKIN_DARK = 0xd9906c, TRACKIES = 0x7f8189, VEST = 0xf1eee6, CHAIR = 0x7b3f2e, CHAIR_DARK = 0x5e2c1f;
  const mat = (c, o) => U.mat(c, o);

  /* Painted textures (canvas, restored with the rest of the game's textures). */
  const tex = {};
  function textures() {
    if (tex.paper) return tex;
    tex.paper = U.tex(128, 128, (g, w, h) => {
      g.fillStyle = '#d2b994'; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(160,125,90,.35)';
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { g.beginPath(); g.ellipse(32 + i * 64, 32 + j * 64 + (i ? 32 : 0) - (i && j ? 64 : 0), 7, 13, 0, 0, TAU); g.fill(); }
      g.fillStyle = 'rgba(90,60,40,.06)'; g.fillRect(0, 0, 3, h);
    });
    tex.paper.wrapS = tex.paper.wrapT = T.RepeatWrapping; tex.paper.repeat.set(9, 4);
    tex.rug = U.tex(256, 256, (g, w, h) => {
      g.fillStyle = '#7a2e3c'; g.fillRect(0, 0, w, h);
      for (let x = 0; x < 8; x++) for (let y = 0; y < 8; y++) {
        const cx = x * 32 + 16, cy = y * 32 + 16;
        g.fillStyle = (x + y) % 2 ? '#933a48' : '#6a2533'; g.beginPath(); g.moveTo(cx, cy - 14); g.lineTo(cx + 14, cy); g.lineTo(cx, cy + 14); g.lineTo(cx - 14, cy); g.fill();
        g.fillStyle = '#d9b58a'; g.beginPath(); g.arc(cx, cy, 3, 0, TAU); g.fill();
      }
      g.strokeStyle = '#d9b58a'; g.lineWidth = 8; g.beginPath(); g.arc(128, 128, 118, 0, TAU); g.stroke();
      g.setLineDash([10, 8]); g.lineWidth = 3; g.beginPath(); g.arc(128, 128, 104, 0, TAU); g.stroke();
    });
    tex.flag = U.tex(256, 154, (g, w, h) => {
      g.fillStyle = '#1f3c88'; g.fillRect(0, 0, w, h);
      g.lineCap = 'butt';
      const X = (lw, c) => { g.strokeStyle = c; g.lineWidth = lw; g.beginPath(); g.moveTo(0, 0); g.lineTo(w, h); g.moveTo(w, 0); g.lineTo(0, h); g.stroke(); };
      X(30, '#fff'); X(10, '#c8202e');
      const P = (lw, c) => { g.strokeStyle = c; g.lineWidth = lw; g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke(); };
      P(50, '#fff'); P(28, '#c8202e');
    });
    tex.picture = U.tex(160, 120, (g, w, h) => {
      g.fillStyle = '#9cc3e8'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#c8a46a'; g.fillRect(104, 20, 20, 80); g.fillStyle = '#7a5a32'; g.beginPath(); g.moveTo(104, 20); g.lineTo(114, 4); g.lineTo(124, 20); g.fill();
      g.fillStyle = '#f4ecd0'; g.beginPath(); g.arc(114, 36, 7, 0, TAU); g.fill();
      g.fillStyle = '#8a8a8a'; g.fillRect(0, 98, w, 22);
      g.fillStyle = '#d42a2a'; g.fillRect(16, 52, 72, 48); g.fillStyle = '#e9f2ff'; g.fillRect(22, 58, 60, 10); g.fillRect(22, 74, 60, 10);
      g.fillStyle = '#222'; g.beginPath(); g.arc(30, 100, 6, 0, TAU); g.arc(74, 100, 6, 0, TAU); g.fill();
    });
    tex.view = U.tex(256, 200, (g, w, h) => {
      const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#6f94c4'); sky.addColorStop(1, '#bcd2ea');
      g.fillStyle = sky; g.fillRect(0, 0, w, h);
      g.fillStyle = '#8a5446';
      g.beginPath(); g.moveTo(0, 120); [[40, 80], [80, 120], [110, 90], [150, 120], [190, 76], [230, 120], [256, 100], [256, 200], [0, 200]].forEach((p) => g.lineTo(p[0], p[1])); g.fill();
      g.fillStyle = '#efe2b8'; [[20, 140], [64, 136], [124, 142], [172, 132], [214, 140]].forEach((p) => g.fillRect(p[0], p[1], 16, 16));
      g.fillStyle = '#5a3a30'; g.fillRect(60, 60, 8, 30); g.fillRect(200, 56, 8, 30);
    });
    tex.curtain = U.tex(64, 64, (g, w, h) => {
      g.fillStyle = '#e9e1cf'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#6f8fb8'; g.beginPath(); g.ellipse(32, 22, 7, 13, 0, 0, TAU); g.fill(); g.beginPath(); g.ellipse(0, 54, 6, 10, 0, 0, TAU); g.ellipse(64, 54, 6, 10, 0, 0, TAU); g.fill();
    });
    tex.curtain.wrapS = tex.curtain.wrapT = T.RepeatWrapping; tex.curtain.repeat.set(2, 5);
    tex.vest = U.tex(128, 128, (g, w, h) => {
      g.fillStyle = '#f1eee6'; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(190,140,50,.55)';
      [[30, 80, 9], [42, 88, 4], [70, 70, 6], [96, 92, 7], [20, 100, 4], [60, 104, 5]].forEach((s) => { g.beginPath(); g.ellipse(s[0], s[1], s[2] * 1.4, s[2], 0, 0, TAU); g.fill(); });
    });
    tex.trackies = U.tex(64, 64, (g, w, h) => {
      g.fillStyle = '#7f8189'; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(255,255,255,.05)'; for (let i = 0; i < 64; i += 4) g.fillRect(0, i, w, 1);
      g.fillStyle = 'rgba(170,120,40,.5)'; g.beginPath(); g.ellipse(20, 30, 6, 4, 0, 0, TAU); g.fill();
    });
    tex.chair = U.tex(128, 128, (g, w, h) => {
      g.fillStyle = '#7b3f2e'; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(0,0,0,.08)'; for (let i = 0; i < 600; i++) g.fillRect((i * 37) % w, (i * 91) % h, 2, 2);
      g.fillStyle = 'rgba(230,195,140,.6)'; g.beginPath(); g.ellipse(30, 40, 10, 16, .4, 0, TAU); g.fill();
    });
    tex.pizza = U.tex(128, 128, (g, w, h) => {
      g.fillStyle = '#e7cf9e'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#a3402c'; g.font = '900 30px Arial Black, Arial, sans-serif'; g.textAlign = 'center'; g.fillText('PIZZA', 64, 74);
      g.fillStyle = 'rgba(160,100,40,.35)'; g.beginPath(); g.arc(30, 30, 10, 0, TAU); g.fill();
    });
    tex.bag = U.tex(128, 128, (g, w, h) => {
      g.fillStyle = '#c79a5a'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#7a3e12'; g.font = '900 22px Arial Black, Arial, sans-serif'; g.textAlign = 'center'; g.fillText('CHIPPY', 64, 72);
    });
    return tex;
  }

  /* Made-up fizzy pop: blue "Gaffer" or red "Bulldog". */
  const canTex = {};
  function canLabel(kind) {
    if (canTex[kind]) return canTex[kind];
    const body = kind === 'red' ? '#c8282e' : '#1f4fa8', band = kind === 'red' ? '#f3d9a0' : '#f2c230', word = kind === 'red' ? 'BULLDOG' : 'GAFFER';
    return (canTex[kind] = U.tex(256, 128, (g, w, h) => {
      g.fillStyle = body; g.fillRect(0, 0, w, h);
      for (let k = 0; k < 2; k++) {
        const x = 64 + k * 128;
        g.fillStyle = band; g.beginPath(); g.arc(x, 50, 26, 0, TAU); g.fill();
        g.fillStyle = body; g.font = '900 32px Arial Black, Arial, sans-serif'; g.textAlign = 'center'; g.fillText(word[0], x, 62);
        g.fillStyle = '#fff'; g.font = '900 17px Arial Black, Arial, sans-serif'; g.fillText(word, x, 106);
      }
    }));
  }
  function can(kind, s) {
    s = s || 1;
    const side = new T.MeshStandardMaterial({ map: canLabel(kind), roughness: 0.35, metalness: 0.2 });
    const top = mat(0xc9cdd4, { roughness: 0.3, metalness: 0.5 });
    const m = new T.Mesh(new T.CylinderGeometry(0.045 * s, 0.045 * s, 0.13 * s, 20), [side, top, top]);
    return m;
  }

  /* A capsule from point a to point b. */
  function limb(a, b, r, material) {
    const A = new T.Vector3().fromArray(a), B = new T.Vector3().fromArray(b), d = B.clone().sub(A), len = d.length();
    const m = new T.Mesh(new T.CapsuleGeometry(r, Math.max(0.001, len), 6, 14), material);
    m.position.copy(A).add(B).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize());
    return m;
  }
  const ball = (r, m, x, y, z, sx, sy, sz) => U.ball(r, m, x, y, z, sx, sy, sz, 24);

  const G = {};

  function room(scene, t) {
    const wall = new T.MeshStandardMaterial({ map: t.paper, roughness: 1 });
    const back = U.mesh(new T.PlaneGeometry(12, 4.2), wall, 0, 2.1, -2.6); back.receiveShadow = true;
    const left = U.mesh(new T.PlaneGeometry(8, 4.2), wall, -4.2, 2.1, 1.4); left.rotation.y = Math.PI / 2; left.receiveShadow = true;
    const right = U.mesh(new T.PlaneGeometry(8, 4.2), wall, 4.2, 2.1, 1.4); right.rotation.y = -Math.PI / 2; right.receiveShadow = true;
    const floor = U.mesh(new T.PlaneGeometry(12, 10), new T.MeshStandardMaterial({ color: 0x5e4a3c, roughness: 0.9, map: U.surfaceTex('wood') }), 0, 0, 1.6); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
    const rug = U.mesh(new T.CircleGeometry(1, 48), new T.MeshStandardMaterial({ map: t.rug, roughness: 1 }), 0, 0.005, -0.4);
    rug.rotation.x = -Math.PI / 2; rug.scale.set(3.1, 2.1, 1); rug.receiveShadow = true;
    const skirt = mat(0xefe6d6);
    scene.add(back, left, right, floor, rug, U.box(12, 0.14, 0.04, skirt, 0, 0.07, -2.58), U.box(0.04, 0.14, 8, skirt, -4.18, 0.07, 1.4), U.box(0.04, 0.14, 8, skirt, 4.18, 0.07, 1.4));

    // flag pinned on the wall, the bus picture, a shelf of mugs and a duck
    const flag = U.mesh(new T.PlaneGeometry(1.5, 0.9), new T.MeshStandardMaterial({ map: t.flag, roughness: 1 }), -0.75, 2.35, -2.58); flag.rotation.z = -0.03;
    const frame = U.box(0.8, 0.62, 0.05, mat(0x6b4226), 0.85, 2.4, -2.57);
    const pic = U.mesh(new T.PlaneGeometry(0.68, 0.5), new T.MeshStandardMaterial({ map: t.picture, roughness: 1 }), 0.85, 2.4, -2.54);
    scene.add(flag, frame, pic);
    const wood = new T.MeshStandardMaterial({ color: 0x8a5a34, roughness: 0.9, map: U.surfaceTex('wood') });
    const shelf = U.group(U.box(1.1, 0.05, 0.3, wood, 0, 0, 0), U.box(1.1, 0.05, 0.3, wood, 0, -0.6, 0), U.box(0.05, 1.6, 0.3, wood, -0.53, -0.5, 0), U.box(0.05, 1.6, 0.3, wood, 0.53, -0.5, 0));
    [[-0.38, 0xf4f1ea], [-0.16, 0xc8282e], [0.06, 0xf4f1ea]].forEach((m) => {
      shelf.add(U.cyl(0.06, 0.06, 0.13, mat(m[1]), m[0], 0.09, 0), U.torus(0.04, 0.012, mat(m[1]), m[0] + 0.07, 0.09, 0));
    });
    const duck = U.group(ball(0.09, mat(0xf4cf2a), 0, 0.08, 0, 1.2, 0.9, 1), ball(0.06, mat(0xf4cf2a), 0.05, 0.19, 0), U.cone(0.025, 0.06, mat(0xf08a1a), 0.12, 0.19, 0));
    duck.children[2].rotation.z = -Math.PI / 2; duck.position.set(0.32, 0.02, 0); shelf.add(duck);
    const c1 = can('blue'), c2 = can('red'); c1.position.set(-0.3, -0.5, 0); c2.position.set(-0.18, -0.5, 0.02); shelf.add(c1, c2, U.cyl(0.06, 0.06, 0.13, mat(0x2d6bb5), 0.2, -0.51, 0));
    shelf.position.set(-2.6, 1.95, -2.42);
    scene.add(U.shadows(shelf, true, true));

    // window with a street of houses, curtains, a radiator with socks under it
    const win = U.group();
    const sill = mat(0xf2efe8);
    win.add(U.mesh(new T.PlaneGeometry(1.5, 1.2), new T.MeshBasicMaterial({ map: t.view, toneMapped: false }), 0, 0, 0));
    win.add(U.box(1.62, 0.07, 0.08, sill, 0, 0.62, 0.02), U.box(1.62, 0.07, 0.08, sill, 0, -0.62, 0.02), U.box(0.07, 1.3, 0.08, sill, -0.78, 0, 0.02), U.box(0.07, 1.3, 0.08, sill, 0.78, 0, 0.02));
    win.add(U.box(0.05, 1.2, 0.06, sill, 0, 0, 0.02), U.box(1.5, 0.05, 0.06, sill, 0, 0.2, 0.02), U.box(1.8, 0.06, 0.2, sill, 0, -0.67, 0.08));
    const cur = new T.MeshStandardMaterial({ map: t.curtain, roughness: 1 });
    [-1, 1].forEach((s) => { const c = U.cyl(0.16, 0.24, 1.55, cur, s * 0.92, -0.05, 0.12, 14); c.scale.z = 0.45; win.add(c); });
    win.add(U.rot(U.cyl(0.03, 0.03, 2.3, mat(0x7a5a32), 0, 0.78, 0.14), 0, 0, Math.PI / 2));
    win.position.set(2.5, 2.05, -2.58);
    scene.add(U.shadows(win, true, false));
    const rad = U.group(U.box(1.3, 0.65, 0.08, mat(0xf1efe9), 0, 0, 0));
    for (let i = 0; i < 9; i++) rad.add(U.box(0.06, 0.62, 0.12, mat(0xe2ded5), -0.56 + i * 0.14, 0, 0.02));
    const sock = (x, c) => U.group(U.box(0.11, 0.34, 0.03, mat(c), x, 0.15, 0.09), U.box(0.18, 0.09, 0.03, mat(c), x - 0.04, -0.03, 0.09));
    rad.add(sock(-0.3, 0x4a4a52), sock(0.32, 0x5b5e6b));
    rad.position.set(2.5, 0.65, -2.5);
    scene.add(U.shadows(rad, true, true));

    // laundry basket with a heap of clothes, chippy bag, lampshade
    const basket = U.group(U.box(0.85, 0.6, 0.55, mat(0xf2f2f0), 0, 0.3, 0));
    for (let i = 0; i < 4; i++) basket.add(U.box(0.04, 0.5, 0.57, mat(0xc9ccd2), -0.3 + i * 0.2, 0.3, 0));
    [[0x2f3550, -0.2, 0.62, 0], [0xe8e3d6, 0.1, 0.66, 0.05], [0xa8232f, 0.25, 0.63, -0.05], [0x3d4466, 0, 0.72, -0.02], [0x6f8fb8, -0.25, 0.68, 0.1]].forEach((c) => basket.add(ball(0.2, mat(c[0]), c[1], c[2], c[3], 1.2, 0.6, 1)));
    basket.add(ball(0.22, mat(0x3d4466), 0.6, 0.06, 0.3, 1.4, 0.3, 1));
    basket.position.set(1.45, 0, -2.0); basket.rotation.y = -0.2;
    scene.add(U.shadows(basket, true, true));
    const bag = U.group(U.box(0.34, 0.42, 0.2, new T.MeshStandardMaterial({ map: t.bag, roughness: 1 }), 0, 0.21, 0), U.rot(U.torus(0.08, 0.012, mat(0x9a7340), 0, 0.42, 0, Math.PI), 0, 0, 0));
    bag.position.set(2.35, 0, -1.6); bag.rotation.y = -0.5;
    scene.add(U.shadows(bag, true, true));
    const lamp = U.group(U.cyl(0.006, 0.006, 1.2, mat(0x2a1a14), 0, 0.6, 0), U.cyl(0.12, 0.28, 0.26, mat(0xd98c3a, { side: T.DoubleSide }), 0, 0, 0, 20), ball(0.06, U.glow(0xfff3c4), 0, -0.06, 0));
    lamp.position.set(-0.2, 3.55, -0.9);
    scene.add(lamp);
  }

  function chair(scene, t) {
    const cloth = new T.MeshStandardMaterial({ map: t.chair, roughness: 1 }), dark = mat(CHAIR_DARK);
    const c = U.group(
      U.box(1.5, 0.4, 1.05, cloth, 0, 0.3, -1.15),           // seat base
      U.box(1.15, 0.16, 0.95, cloth, 0, 0.55, -1.1),          // cushion
      U.box(1.5, 1.25, 0.32, cloth, 0, 1.05, -1.7),           // back
      U.rot(U.cyl(0.18, 0.18, 1.5, cloth, 0, 1.68, -1.68, 18), 0, 0, Math.PI / 2),
      U.box(0.3, 0.55, 1.05, cloth, -0.66, 0.6, -1.15), U.box(0.3, 0.55, 1.05, cloth, 0.66, 0.6, -1.15),
      U.rot(U.cyl(0.17, 0.17, 1.05, cloth, -0.66, 0.88, -1.15, 18), Math.PI / 2, 0, 0), U.rot(U.cyl(0.17, 0.17, 1.05, cloth, 0.66, 0.88, -1.15, 18), Math.PI / 2, 0, 0),
      U.box(0.1, 0.1, 0.1, dark, -0.65, 0.05, -0.68), U.box(0.1, 0.1, 0.1, dark, 0.65, 0.05, -0.68),
      U.rot(U.box(0.5, 0.04, 0.42, mat(0xece3cf), 0.38, 1.72, -1.6), 0.2, 0.3, -0.2)   // a throw over the back
    );
    c.position.y = -0.22; c.scale.x = 1.25;   // lower and wider, to fit the Meshy Dave
    scene.add(U.shadows(c, true, true));
  }

  function dave(scene, t) {
    const skin = mat(SKIN, { roughness: 0.75 }), skinD = mat(SKIN_DARK, { roughness: 0.8 });
    const track = new T.MeshStandardMaterial({ map: t.trackies, roughness: 1 });
    const vest = new T.MeshStandardMaterial({ map: t.vest, roughness: 1 });
    const sockW = mat(0xf2f2ef), sockD = mat(0x34363f), ink = mat(0x2a1a14, { roughness: 0.4 });
    const man = G.man = new T.Group();

    // legs in trackies, knees apart, feet out on the rug
    man.add(limb([-0.24, 0.72, -1.1], [-0.36, 0.7, -0.5], 0.19, track), limb([0.24, 0.72, -1.1], [0.4, 0.68, -0.52], 0.19, track));
    man.add(limb([-0.36, 0.68, -0.48], [-0.46, 0.16, -0.32], 0.13, track), limb([0.4, 0.66, -0.5], [0.58, 0.16, -0.3], 0.13, track));
    man.add(U.cyl(0.115, 0.115, 0.12, sockW, -0.46, 0.17, -0.32), U.cyl(0.115, 0.115, 0.12, sockW, 0.58, 0.17, -0.3));
    man.add(ball(0.12, sockD, -0.5, 0.07, -0.2, 1, 0.65, 1.7), ball(0.12, sockD, 0.62, 0.07, -0.18, 1, 0.65, 1.7));
    man.add(U.rot(U.torus(0.36, 0.06, track, 0, 0.74, -1.02, TAU, 28), Math.PI / 2, 0, 0));   // waistband
    man.add(limb([-0.03, 0.74, -0.66], [-0.05, 0.6, -0.62], 0.012, sockW), limb([0.03, 0.74, -0.66], [0.06, 0.6, -0.62], 0.012, sockW));

    // the belly, under the vest and spilling out below it
    const belly = G.belly = U.group(ball(0.43, skin, 0, 0, 0, 1.05, 0.88, 1));
    belly.add(ball(0.025, skinD, 0, -0.08, 0.425, 1, 1, 0.5));    // belly button
    belly.position.set(0, 0.92, -0.98);
    man.add(belly);
    // chest in the vest
    const chest = G.chest = U.group();
    const vestM = new T.Mesh(new T.SphereGeometry(0.47, 28, 20, 0, TAU, 0, Math.PI * 0.7), vest);
    vestM.scale.set(1.08, 1, 0.92);
    chest.add(vestM, ball(0.2, skin, 0, 0.36, 0.2, 1.2, 0.8, 0.7));   // skin at the neckline
    chest.position.set(0, 1.12, -1.12);
    man.add(chest);

    // arms: a pivot at each shoulder so they can move
    const armL = G.armL = new T.Group(); armL.position.set(0.44, 1.28, -1.15);
    armL.add(ball(0.14, skin, 0, -0.02, 0), limb([0, 0, 0], [0.18, -0.4, 0.05], 0.15, skin), limb([0.18, -0.4, 0.05], [0.2, -0.46, 0.5], 0.12, skin), ball(0.09, skin, 0.2, -0.46, 0.55));
    const remote = U.box(0.07, 0.04, 0.2, ink, 0.2, -0.42, 0.62); armL.add(remote, ball(0.012, U.glow(0xd43030), 0.2, -0.395, 0.68));
    const armR = G.armR = new T.Group(); armR.position.set(-0.44, 1.28, -1.15);
    const elbowR = G.elbowR = new T.Group(); elbowR.position.set(-0.18, -0.4, 0.05);
    elbowR.add(limb([0, 0, 0], [-0.02, -0.06, 0.42], 0.12, skin), ball(0.09, skin, -0.02, -0.04, 0.47));
    const drink = can('blue', 1.2); drink.position.set(-0.02, 0.04, 0.47); elbowR.add(drink);
    armR.add(ball(0.14, skin, 0, -0.02, 0), limb([0, 0, 0], [-0.18, -0.4, 0.05], 0.15, skin), elbowR);
    man.add(armL, armR);

    // head
    const head = G.head = new T.Group(); head.position.set(0, 1.62, -1.08); head.scale.setScalar(1.15);
    head.add(U.cyl(0.12, 0.15, 0.16, skinD, 0, -0.18, -0.02));
    head.add(ball(0.25, skin, 0, 0.04, 0, 0.94, 1.05, 0.95));
    const stubble = new T.Mesh(new T.SphereGeometry(0.252, 28, 16, 0, TAU, Math.PI * 0.56, Math.PI * 0.44), mat(0xd8a07f, { roughness: 1 }));
    stubble.scale.set(0.94, 1.05, 0.95); stubble.position.y = 0.04; stubble.rotation.x = 0.15; head.add(stubble);
    head.add(ball(0.06, skin, -0.24, 0.03, -0.01, 0.6, 1, 0.8), ball(0.06, skin, 0.24, 0.03, -0.01, 0.6, 1, 0.8));
    const eyeW = mat(0xffffff, { roughness: 0.3 }), pupil = mat(0x1a1210, { roughness: 0.1 });
    [-1, 1].forEach((s) => {
      head.add(ball(0.045, eyeW, s * 0.085, 0.07, 0.205, 1, 0.8, 0.6), ball(0.02, pupil, s * 0.085, 0.065, 0.235));
      head.add(U.rot(U.box(0.09, 0.022, 0.03, mat(0x5a3a2a), s * 0.09, 0.14, 0.215), 0, 0, s * -0.12));
    });
    // heavy lids: half-closed, blink by dropping them
    const lids = G.lids = U.group();
    [-1, 1].forEach((s) => { const l = new T.Mesh(new T.SphereGeometry(0.049, 16, 10, 0, TAU, 0, Math.PI * 0.5), skinD); l.position.set(s * 0.085, 0.07, 0.205); l.scale.set(1, 0.8, 0.65); lids.add(l); });
    lids.rotation.x = 0; head.add(lids);
    head.add(ball(0.055, mat(0xee9a82, { roughness: 0.7 }), 0, 0.0, 0.25, 1, 0.9, 1));
    const smile = U.torus(0.06, 0.012, mat(0x7a3a2a), 0, -0.07, 0.25, Math.PI * 0.8); smile.rotation.z = Math.PI * 1.1; head.add(smile);
    head.add(ball(0.035, mat(0xe8806a, { roughness: 1, transparent: true, opacity: 0.5 }), -0.15, -0.02, 0.19), ball(0.035, mat(0xe8806a, { roughness: 1, transparent: true, opacity: 0.5 }), 0.15, -0.02, 0.19));
    man.add(head);
    man.visible = false;   // the drawn-from-shapes Dave: only shown if the model file cannot load
    scene.add(U.shadows(man, true, false));
  }

  function front(scene, t) {
    // coffee table with a pizza box, cans and a game pad
    const wood = new T.MeshStandardMaterial({ color: 0x9a6a3c, roughness: 0.9, map: U.surfaceTex('wood') });
    const table = U.group(U.box(1.1, 0.06, 0.6, wood, 0, 0.42, 0));
    [[-0.48, -0.24], [0.48, -0.24], [-0.48, 0.24], [0.48, 0.24]].forEach((p) => table.add(U.box(0.06, 0.42, 0.06, mat(0x7a4e28), p[0], 0.21, p[1])));
    const pz = new T.MeshStandardMaterial({ map: t.pizza, roughness: 1 });
    table.add(U.box(0.5, 0.05, 0.5, mat(0xe7cf9e), -0.22, 0.475, 0.02));
    const lid = U.box(0.5, 0.02, 0.5, pz, -0.22, 0.5, -0.23); lid.geometry.translate(0, 0, -0.25); lid.position.set(-0.22, 0.5, -0.23); lid.rotation.x = -1.1; table.add(lid);
    table.add(U.mesh(new T.CylinderGeometry(0.2, 0.2, 0.012, 3, 1, false, 0, 0.8), mat(0xe8a33a), -0.2, 0.505, 0.05));
    const a = can('blue'), b = can('red'); a.position.set(0.18, 0.515, -0.05); b.position.set(0.3, 0.515, 0.08); table.add(a, b);
    const pad = U.group(U.box(0.16, 0.035, 0.08, mat(0x2b2d33), 0, 0, 0), ball(0.045, mat(0x2b2d33), -0.08, 0, 0.02, 1, 0.5, 1), ball(0.045, mat(0x2b2d33), 0.08, 0, 0.02, 1, 0.5, 1), ball(0.012, U.glow(0x4caf50), 0.06, 0.02, -0.01));
    pad.position.set(0.32, 0.47, -0.14); pad.rotation.y = 0.4; table.add(pad);
    table.position.set(-1.25, 0, 0.25); table.rotation.y = 0.25;
    scene.add(U.shadows(table, true, true));
    // cans knocked over on the rug
    [['blue', 0.95, -0.15, 1.2], ['red', -0.4, 0.55, 0.3], ['blue', -2.0, 1.0, 2.2]].forEach((c) => { const m = can(c[0]); m.position.set(c[1], 0.045, c[2]); m.rotation.set(0, c[3], Math.PI / 2); scene.add(U.shadows(m, true, false)); });

    // the telly, front right, turned towards Dave, with a stand
    const tv = G.tv = U.group();
    tv.add(U.box(1.3, 0.55, 0.5, new T.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.9, map: U.surfaceTex('wood') }), 0, 0.28, 0));
    tv.add(U.box(1.15, 0.7, 0.08, mat(0x22252c, { roughness: 0.5 }), 0, 0.95, 0), U.box(0.5, 0.4, 0.14, mat(0x1b1d22, { roughness: 0.6 }), 0, 0.95, 0.1));
    const screen = G.screen = U.mesh(new T.PlaneGeometry(1.08, 0.62), new T.MeshBasicMaterial({ color: 0x8fc4ff, toneMapped: false }), 0, 0.95, -0.045);
    screen.rotation.y = Math.PI; tv.add(screen);
    tv.position.set(1.45, 0, 0.7); tv.rotation.y = Math.atan2(1.45, 0.7 + 1.1);   // facing the chair
    scene.add(U.shadows(tv, true, true));
  }

  G.build = function () {
    if (G.scene) return G;
    const t = textures();
    const scene = G.scene = new T.Scene();
    scene.background = new T.Color(0x3a2a22);
    const camera = G.camera = new T.PerspectiveCamera(42, 1, 0.1, 40);
    const hemi = new T.HemisphereLight(0xfff1dc, 0x6b4a3a, 1.7);
    const sun = new T.DirectionalLight(0xfff0d6, 1.6);
    sun.position.set(3, 5, 3); sun.target.position.set(0, 0.6, -1);
    sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
    const sc = sun.shadow.camera; sc.left = -4; sc.right = 4; sc.top = 4; sc.bottom = -4; sc.near = 1; sc.far = 14;
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
    const lampLight = new T.PointLight(0xffc27a, 1.4, 6, 1.6); lampLight.position.set(-0.2, 3.3, -0.9);
    const telly = G.tellyLight = new T.PointLight(0x8fc4ff, 1.2, 5, 1.4); telly.position.set(1.6, 1.0, 0.4);
    scene.add(hemi, sun, sun.target, lampLight, telly);
    room(scene, t); chair(scene, t); dave(scene, t); front(scene, t);
    loadModel(scene);
    G.view = { scene, camera };
    return G;
  };

  /* Big Dave (art/geezer/dave.glb) is built from scratch by tools/geezer/build-dave.mjs: smooth blended
     shapes made into a mesh, with his own Mixamo-style skeleton. He stands in an A-pose in the file; here he
     is sat in the chair by turning his bones, and every move is a blend of poses. */
  const SEAT = new T.Vector3(0, -0.36, -0.92), MS = 1.42;
  const SIT = [['LeftUpLeg', [1, 0, 0], -1.25], ['RightUpLeg', [1, 0, 0], -1.25], ['LeftUpLeg', [0, 1, 0], 0.3], ['RightUpLeg', [0, 1, 0], -0.3],
    ['LeftLeg', [1, 0, 0], 1.05], ['RightLeg', [1, 0, 0], 1.05], ['Spine', [1, 0, 0], -0.12],
    ['LeftArm', [0, 0, 1], -0.55], ['RightArm', [0, 0, 1], 0.55], ['LeftForeArm', [1, 0, 0], -1.4], ['RightForeArm', [1, 0, 0], -1.4]];
  const SIP = [['RightArm', [1, 0, 0], -0.6], ['RightForeArm', [0, 1, 0], 1.2], ['RightForeArm', [1, 0, 0], -0.8], ['Head', [1, 0, 0], -0.25]];
  const CHEER = [['LeftArm', [0, 0, 1], 2.3], ['RightArm', [0, 0, 1], -2.3]];
  const qa = new T.Quaternion(), qb = new T.Quaternion(), va = new T.Vector3();
  function turn(name, axis, ang) {
    const b = G.bones['mixamorig:' + name]; if (!b || !ang) return;
    b.parent.updateMatrixWorld(true); b.parent.getWorldQuaternion(qa);
    va.fromArray(axis).applyQuaternion(qa.invert()).normalize();
    b.quaternion.premultiply(qb.setFromAxisAngle(va, ang)); b.updateMatrixWorld(true);
  }
  function pose(list, k) { if (k) for (const p of list) turn(p[0], p[1], p[2] * k); }

  /* Sparse, soft forearm hairs follow the skin as the rig moves. */
  const PAINT = `
    vec3 davePaint(vec3 p) {
      vec3 skin = pow(vec3(.97,.68,.50),vec3(2.2));
      float forearm = smoothstep(.36,.47,abs(p.x));
      vec2 uv = vec2(abs(p.x)*48.,(p.y+.45*p.z)*55.);
      vec2 cell = floor(uv);
      float seed = fract(sin(dot(cell,vec2(23.17,54.23)))*4375.5);
      vec2 d = fract(uv)-.5;
      d.x += .15*sin(seed*31.)-.38*d.y;
      float distanceToHair = length(vec2(d.x*2.8,d.y));
      float aa = max(.035,fwidth(distanceToHair));
      float hair = (1.-smoothstep(.11-aa,.11+aa,distanceToHair))*step(.68,seed);
      return skin*(1.-.24*hair*forearm);
    }`;
  function paintDave(m) {
    m.material.onBeforeCompile = (sh) => {
      sh.vertexShader = 'varying vec3 vBind;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvBind = position;');
      sh.fragmentShader = 'varying vec3 vBind;\n' + sh.fragmentShader
        .replace('void main() {', PAINT + '\nvoid main() {')
        .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = davePaint(vBind);');
    };
    m.material.needsUpdate = true;
  }
  // Build each grip around its actual prop in seated wrist space, then let the hand bone carry both.
  function grip(side, drink) {
    const hand = new T.Group(), skin = mat(0xf7ad80, { roughness: 0.86 });
    const palm = ball(1, skin, side * 0.024, -0.012, 0.038, 0.069, 0.080, 0.087);
    hand.add(palm);
    const cord = (points, radius) => {
      const path = new T.CatmullRomCurve3(points.map(([x,y,z]) => new T.Vector3(side*x,y,z)));
      hand.add(new T.Mesh(new T.TubeGeometry(path, 14, radius, 10, false), skin));
      const tip = path.getPoint(1);
      hand.add(ball(radius, skin, tip.x, tip.y, tip.z));
    };
    for (let i = 0; i < 4; i++) {
      const y = 0.032 - i * 0.032, r = 0.019 - i * 0.0012;
      if (drink) cord([[0.05,y,0.043],[0.079,y,0.089],[0.061,y-0.004,0.143],[0.016+i*0.006,y-0.008,0.167-i*0.004]],r);
      else cord([[0.043,y,0.038],[0.052,y-0.01,0.08],[0.031,y-0.018,0.11],[-0.008,y-0.013,0.117]],r);
    }
    cord(drink ? [[0.015,0.038,0.045],[-0.032,0.065,0.058],[-0.065,0.064,0.108]]
               : [[0.025,0.046,0.043],[0.002,0.059,0.080],[-0.023,0.049,0.123]], 0.024);
    return hand;
  }

  function loadModel(scene) {
    if (!PN.loadGLB) { G.man.visible = true; return; }
    PN.loadGLB('art/geezer/dave.glb').then((g) => {
      G.bones = g.bones; G.rest = {};
      for (const k in g.bones) G.rest[k] = g.bones[k].quaternion.clone();
      g.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = true;
        o.receiveShadow = false;
        if (o.isSkinnedMesh && o.parent.name === 'Dave') paintDave(o);
        else if (!o.isSkinnedMesh && o.material.map) {
          // The portrait already contains soft shading under the cheeks and nose.
          o.material.onBeforeCompile = (shader) => {
            shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>',
              'outgoingLight = mix(outgoingLight, diffuseColor.rgb, 0.60);\n#include <opaque_fragment>');
          };
        }
      });
      g.scale.setScalar(MS);
      const pivot = G.model = new T.Group(); pivot.position.copy(SEAT); pivot.add(g);
      scene.add(pivot);
      // a can in his right hand and the remote in his left, fixed to the hand bones
      G.pose(0, 0, 0, 0);
      pivot.updateMatrixWorld(true);
      const hold = (bone, obj, fwd, up) => {
        const h = g.bones['mixamorig:' + bone]; if (!h) return;
        const want = new T.Object3D(); h.getWorldPosition(want.position);
        want.position.z += fwd; want.position.y += up; want.updateMatrixWorld(true);
        scene.add(want);
        const m = new T.Matrix4().copy(h.matrixWorld).invert().multiply(want.matrixWorld);
        scene.remove(want);
        m.decompose(obj.position, obj.quaternion, obj.scale);
        h.add(obj);
      };
      hold('RightHand', grip(-1, true), 0, 0);
      hold('LeftHand', grip(1, false), 0, 0);
      const drink = can('blue', 1.7); drink.castShadow = true; hold('RightHand', drink, 0.092, 0.022);
      const remote = U.box(0.07, 0.04, 0.2, mat(0x2b2d33, { roughness: 0.55 }), 0, 0, 0);
      remote.add(ball(0.011, mat(0xdc6957), -0.016, 0.020, 0.075, 1, 0.45, 1));
      for (const z of [0.024, 0.046]) {
        remote.add(U.box(0.038, 0.006, 0.009, mat(0x8c9195), 0, 0.020, z));
      }
      remote.castShadow = true; hold('LeftHand', remote, 0.126, 0.018); remote.rotateY(0.18);
    }).catch((e) => { console.warn('dave.glb', e); G.man.visible = true; });
  }
  /* Put every bone back to the A-pose, sit him down, then add the moves. */
  G.pose = function (sip, cheer, nod, look) {
    if (!G.bones) return;
    for (const k in G.bones) G.bones[k].quaternion.copy(G.rest[k]);
    pose(SIT, 1); pose(SIP, sip); pose(CHEER, cheer);
    turn('Head', [1, 0, 0], nod * 0.25); turn('Head', [0, 1, 0], look);
  };

  /* Fit the camera: tall screens keep the chair's width, wide screens keep Dave's height. */
  const target = new T.Vector3(0, 1.05, -0.85), dir = new T.Vector3(0, 0.24, 1).normalize();
  G.frame = function (w, h) {
    const c = G.camera, a = w / h, tan = Math.tan(c.fov * Math.PI / 360);
    const d = a < 1 ? Math.max(1.25 / tan, 1.10 / (tan * a)) + 0.4 : 1.7 / tan + 0.4;
    c.aspect = a;
    c.position.copy(target).addScaledVector(dir, d);
    c.position.y += a < 1 ? 0.12 : 0.05;
    c.lookAt(target.x, target.y + (a < 1 ? 0.08 : 0.05), target.z);
    c.updateProjectionMatrix();
  };

  /* Idle life and the little acts the dock buttons trigger. */
  let act = null, actT = 0, blinkT = 2, blinkOn = 0;
  G.act = function (name) { act = name; actT = 0; };
  G.update = function (dt, time) {
    if (!G.scene) return;
    const br = Math.sin(time * 1.7);
    G.belly.scale.set(1 + br * 0.018, 1 + br * 0.026, 1 + br * 0.02);
    G.chest.position.y = 1.12 + br * 0.008;
    G.head.position.y = 1.64 + br * 0.01;
    blinkT -= dt;
    if (blinkT < 0) { blinkOn = 0.14; blinkT = 2.5 + Math.random() * 3.5; }
    blinkOn = Math.max(0, blinkOn - dt);
    G.lids.scale.y = blinkOn > 0 ? 1.9 : 1;
    G.lids.position.y = blinkOn > 0 ? -0.03 : 0;
    actT += dt;
    let sip = 0, nod = 0, cheer = 0;
    if (act === 'sip') { sip = actT < 1.6 ? Math.sin(Math.min(1, actT / 1.6) * Math.PI) : 0; if (actT > 1.6) act = null; }
    else if (act === 'nod') { nod = actT < 0.8 ? Math.sin(actT / 0.8 * TAU) : 0; if (actT > 0.8) act = null; }
    else if (act === 'telly') { cheer = actT < 2.4 ? Math.sin(Math.min(1, actT / 2.4) * Math.PI) : 0; if (actT > 2.4) act = null; }
    G.armR.rotation.set(-sip * 1.2 - cheer * 2.2, 0, sip * 0.45 - cheer * 0.3);
    G.elbowR.rotation.set(-sip * 1.1, sip * 0.6, 0);
    G.armL.rotation.set(-cheer * 2.0, 0, cheer * 0.3);
    G.head.rotation.set(sip * -0.35 + nod * 0.12, Math.sin(time * 0.31) * 0.08 + cheer * 0.3, 0);
    if (G.model) {
      G.model.position.y = SEAT.y + cheer * 0.04 * Math.abs(Math.sin(actT * 9));
      G.model.scale.set(1 + br * 0.006, 1 + br * 0.01, 1 + br * 0.008);
      const pump = cheer * (0.85 + 0.15 * Math.sin(actT * 12));
      G.pose(sip, pump, nod, Math.sin(time * 0.31) * 0.12 + cheer * 0.25);
    }
    const flick = act === 'telly' ? 0.6 + Math.random() * 1.6 : 0.95 + 0.35 * Math.sin(time * 5.3) * Math.sin(time * 1.9);
    G.tellyLight.intensity = flick;
    G.screen.material.color.setHSL(0.58 + 0.05 * Math.sin(time * 2.2), 0.7, 0.62 + 0.1 * Math.sin(time * 3.1));
  };

  /* Did a tap land on Dave? */
  const ray = new T.Raycaster(), ndc = new T.Vector2();
  G.hitDave = function (x, y, w, h) {
    if (!G.man) return false;
    ndc.set(x / w * 2 - 1, -(y / h) * 2 + 1);
    ray.setFromCamera(ndc, G.camera);
    return ray.intersectObject(G.model && G.model.visible ? G.model : G.man, true).length > 0;
  };

  PN.Geezer3D = G;
})(window.PN = window.PN || {});
