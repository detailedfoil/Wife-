/* Pikku Norppa: the world.
   A snowy shore on a frozen Lapland lake, under a sky that follows the real clock
   and calendar: low winter sun, blue twilight, stars, moon and northern lights. */
(function (PN) {
  'use strict';
  const T = THREE, U = PN.U, A = PN.Astro, TAU = Math.PI * 2, RAD = Math.PI / 180;
  const W = PN.World = {};
  const UP = new T.Vector3(0, 1, 0);

  /* Where things are. The camera looks south across the lake (toward -z). */
  W.HOME = new T.Vector3(0.15, 0, 0.3);
  W.HOME_HEADING = 0.5;
  W.HOLE = new T.Vector3(2.0, 0, -2.9);
  W.DEN = { x: -2.45, z: -3.2, heading: 0.62 };
  W.BALL = new T.Vector3(-0.95, 0, 1.35);
  /* x, z, turn. Chosen so each thing shows on a tall phone screen without hiding behind the seal. */
  const SPOTS = {
    snowman: [-2.1, -0.9, 0.6], flag: [-3.1, -4.7, 0.3], sled: [2.5, -5.0, -0.9],
    campfire: [1.4, 1.3, 0], iceheart: [-0.75, -5.4, 0.15], feeder: [-1.75, 0.55, 0.9], xmastree: [2.3, -0.35, 0], sauna: [3.3, -11.0, -0.35],
    // the front of the shore: small things only, low enough not to hide the seal
    lumilyhty: [-0.95, 2.8, 0.2], kurpitsa: [0.25, 3.35, 0], jaalyhty: [1.35, 2.8, -0.2], lahjat: [1.75, 0.4, -0.4], matto: [0.15, 0.3, 0.5],
    // out on the lake
    luminorppa: [0.9, -4.9, 0.5], lumilinna: [-1.9, -6.9, 0.3], pilkki: [0.5, -6.9, 0.2], teltta: [2.6, -7.1, -0.5],
    vene: [-3.0, -9.0, 0.9], joutsen: [-0.9, -8.9, 0.6], poro: [1.2, -8.8, -0.6],
    // by the den, and over on the sauna island
    tahti: [-3.3, -5.9, 0.4], palju: [1.9, -10.3, 0.2], laituri: [3.05, -9.25, 0.25],
  };
  /* These sit on the den itself: x, y, z in the den's own space. */
  const ON_DEN = { lantern: [0, 1.0, 1.55], lights: [0, 0, 0], viirit: [0, 0, 0], ulkotulet: [0, 0.02, 2.3], ilmapallot: [0.55, 1.2, 0.2],
    // the cosy things at the door, where she sleeps; they settle onto the ground themselves (it drops away to the ice on the right)
    talja: [0, 0, 2.05], ryijy: [-0.3, 0, 3.75], peitto: [-1.3, 0, 2.75], tyynyt: [1.5, 0, 3.0], kynttilat: [0, 0, 0], verho: [0, 0, 0] };
  W.SPOTS = SPOTS;

  /* ---------- the lie of the land ---------- */
  function h2(ix, iz) { const s = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453; return s - Math.floor(s); }
  function n2(x, z) {
    const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
    const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
    return U.lerp(U.lerp(h2(ix, iz), h2(ix + 1, iz), ux), U.lerp(h2(ix, iz + 1), h2(ix + 1, iz + 1), ux), uz);
  }
  const farShore = (x, z) => -z - 72 + 6 * Math.sin(x * 0.06);
  /* More than zero means dry land; less means lake. */
  function landD(x, z) {
    const d1 = (z - (-1.5 + 0.42 * x)) / 1.085;
    const d2 = (1 - Math.hypot((x + 4.6) / 3.3, (z + 4.2) / 3.6)) * 3.3;
    const d3 = (1 - Math.hypot((x - 3.5) / 2.9, (z + 11.2) / 2.4)) * 2.4;
    return Math.max(d1, d2, d3, farShore(x, z));
  }
  function terrainY(x, z) {
    const d = landD(x, z);
    if (d <= 0) return -0.3 * U.smooth(0, 0.8, -d);
    let y = 0.25 * U.smooth(0, 1.1, d);
    const m = U.smooth(3.2, 7.5, Math.hypot(x, z - 0.2));
    y += m * (0.4 * n2(x * 0.3, z * 0.3) + 0.12 * n2(x * 0.9 + 5, z * 0.9));
    const f = farShore(x, z);
    if (f > 0) y += U.smooth(0, 30, f) * (4 + 5 * n2(x * 0.03, 7.7));
    return y;
  }
  W.groundY = (x, z) => Math.max(0, terrainY(x, z));
  W.isLand = (x, z) => landD(x, z) > 0.15;

  U.merge = function (parts) {
    let n = 0;
    const list = parts.map((p) => {
      const g = p.geo.index ? p.geo.toNonIndexed() : p.geo.clone();
      g.applyMatrix4(p.m); n += g.attributes.position.count;
      return { g, c: p.c };
    });
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3), uv = new Float32Array(n * 2);
    let o = 0;
    list.forEach((it) => {
      const cnt = it.g.attributes.position.count;
      pos.set(it.g.attributes.position.array, o * 3); nor.set(it.g.attributes.normal.array, o * 3);
      for (let i = 0; i < cnt; i++) { col[(o + i) * 3] = it.c.r; col[(o + i) * 3 + 1] = it.c.g; col[(o + i) * 3 + 2] = it.c.b; }
      for (let i = 0; i < cnt; i++) { uv[(o + i) * 2] = pos[(o + i) * 3] / 3; uv[(o + i) * 2 + 1] = pos[(o + i) * 3 + 2] / 3; }
      o += cnt;
    });
    const out = new T.BufferGeometry();
    out.setAttribute('position', new T.BufferAttribute(pos, 3));
    out.setAttribute('normal', new T.BufferAttribute(nor, 3));
    out.setAttribute('color', new T.BufferAttribute(col, 3));
    out.setAttribute('uv', new T.BufferAttribute(uv, 2));
    return out;
  };

  /* ---------- sky ---------- */
  const SKY_VERT = `
    varying vec3 vDir;
    void main() {
      vDir = position;
      vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      gl_Position = p.xyww;
    }`;
  const SKY_FRAG = `
    precision highp float;
    varying vec3 vDir;
    uniform vec3 uZenith, uHorizon, uGround, uGlowCol, uSunCol, uMoonCol, uCloudLit, uCloudDark, uAurA, uAurB;
    uniform vec3 uSunDir, uMoonDir;
    uniform float uGlow, uSunDisc, uMoonPhase, uMoonVis, uStars, uCloud, uAurora, uVenus, uTime;

    float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
    }
    float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * noise(p); p = p * 2.03 + vec2(17.1, 3.7); a *= 0.5; } return s; }

    void main() {
      vec3 d = normalize(vDir);
      float h = d.y;
      vec3 col = mix(uHorizon, uZenith, pow(clamp(h, 0.0, 1.0), 0.5));

      // glow that hugs the horizon on the sun's side, and a pink band opposite it at twilight
      vec2 dxz = normalize(d.xz + vec2(1e-5)), sxz = normalize(uSunDir.xz + vec2(1e-5));
      float toward = max(dot(dxz, sxz), 0.0);
      col += uGlowCol * uGlow * exp(-abs(h) * 5.5) * (0.25 + 0.75 * pow(toward, 3.0));
      col += vec3(0.9, 0.42, 0.55) * uVenus * pow(max(-dot(dxz, sxz), 0.0), 1.5) * exp(-pow((h - 0.17) * 6.5, 2.0));

      // stars
      if (uStars > 0.01 && h > 0.0) {
        vec2 sp = d.xz / (h + 0.42) * 40.0;
        vec2 ip = floor(sp), fp = fract(sp);
        float r = hash(ip);
        vec2 c = vec2(hash(ip + 3.1), hash(ip + 7.7)) * 0.7 + 0.15;
        float star = step(0.86, r) * smoothstep(0.07 + 0.07 * hash(ip + 1.3), 0.0, length(fp - c));
        star *= 0.65 + 0.35 * sin(uTime * (1.2 + 3.0 * hash(ip + 9.0)) + r * 40.0);
        col += vec3(0.86, 0.92, 1.0) * star * uStars * smoothstep(0.0, 0.22, h);
      }

      // northern lights: three hanging curtains, each a wavy sheet with a bright lower hem
      if (uAurora > 0.01 && h > 0.02 && d.z < -0.05) {
        vec3 acc = vec3(0.0);
        for (int i = 0; i < 3; i++) {
          float fi = float(i);
          float z0 = -(3.0 + fi * 2.2);
          float s = z0 / d.z;
          for (int k = 0; k < 2; k++) {
            float xx = s * d.x;
            s = (z0 + 0.7 * sin(xx * 0.5 + uTime * 0.04 + fi * 2.1) + 0.3 * sin(xx * 1.3 - uTime * 0.07 + fi)) / d.z;
          }
          float x = s * d.x, up = s * d.y - (0.95 + 0.25 * sin(x * 0.35 + fi * 1.7));
          float body = smoothstep(-0.05, 0.06, up) * exp(-max(up, 0.0) * (1.5 + fi * 0.3));
          float rays = (0.35 + 0.65 * noise(vec2(x * 6.0 + uTime * 0.15 + fi * 9.0, fi))) * (0.7 + 0.3 * noise(vec2(x * 21.0 - uTime * 0.1, fi + 3.0)));
          float along = smoothstep(0.12, 0.55, noise(vec2(x * 0.22 + fi * 5.0, uTime * 0.01 + fi)));
          acc += mix(uAurA, uAurB, clamp(up / 1.3, 0.0, 1.0)) * body * rays * along * (1.0 - fi * 0.22);
        }
        col += acc * uAurora * 1.15 * smoothstep(0.02, 0.14, h);
        col += uAurA * uAurora * 0.06 * exp(-h * 3.5);
      }

      // moon, with the right phase
      float md = dot(d, uMoonDir);
      if (uMoonVis > 0.01 && md > 0.99) {
        vec3 mr = normalize(cross(vec3(0.0, 1.0, 0.0), uMoonDir)), mu = cross(uMoonDir, mr);
        vec2 q = vec2(dot(d, mr), dot(d, mu)) / 0.058;
        float rr = length(q);
        if (rr < 1.0) {
          float z = sqrt(1.0 - rr * rr), a = uMoonPhase * 6.2831853;
          float lit = smoothstep(-0.04, 0.1, dot(vec3(q, z), vec3(sin(a), 0.0, -cos(a))));
          float seas = 0.9 + 0.1 * noise(q * 3.0 + 5.0);
          col = mix(col, uMoonCol * (0.05 + 0.95 * lit) * seas, smoothstep(1.0, 0.92, rr) * uMoonVis);
        }
      }
      col += uMoonCol * (pow(max(md, 0.0), 900.0) * 0.4 + pow(max(md, 0.0), 60.0) * 0.06) * uMoonVis;

      // sun
      float sdot = max(dot(d, uSunDir), 0.0);
      col += uSunCol * (pow(sdot, 90.0) * 0.5 + pow(sdot, 9.0) * 0.16) * uSunDisc;
      col = mix(col, uSunCol * 1.25, smoothstep(0.99935, 0.9997, sdot) * uSunDisc);

      // clouds
      if (uCloud > 0.01 && h > -0.02) {
        vec2 cp = d.xz / (h + 0.24) * 1.25 + vec2(uTime * 0.007, uTime * 0.002);
        float n = fbm(cp);
        float cov = smoothstep(0.82 - uCloud * 0.6, 1.0 - uCloud * 0.52, n + 0.2);
        vec3 cc = mix(uCloudDark, uCloudLit, clamp(fbm(cp * 2.1 + 9.0) * 0.9 + 0.25 * pow(sdot, 3.0), 0.0, 1.0));
        col = mix(col, cc, cov * 0.93 * smoothstep(-0.02, 0.12, h));
      }

      col = mix(col, uGround, smoothstep(0.0, -0.05, h));
      gl_FragColor = vec4(col, 1.0);
      #include <colorspace_fragment>
    }`;

  /* Sky colours by how high the sun is, in degrees. */
  const KEYS = [
    { el: -18, zen: 0x050a1f, hor: 0x121f45, glow: 0x1a2a5c, sun: 0xffffff, sunI: 0, hs: 0x5570c8, hg: 0x243566, hi: 2.3, stars: 1 },
    { el: -10, zen: 0x08112e, hor: 0x1c2c5c, glow: 0x3d4291, sun: 0xffffff, sunI: 0, hs: 0x5a75cc, hg: 0x28396c, hi: 2.35, stars: 0.9 },
    { el: -5, zen: 0x16265e, hor: 0x4d4f93, glow: 0xc06d8d, sun: 0xffb8a0, sunI: 0, hs: 0x7388d6, hg: 0x3c4884, hi: 2.5, stars: 0.35 },
    { el: -1.5, zen: 0x2d4c97, hor: 0xbd8eab, glow: 0xff9a6a, sun: 0xff9a6a, sunI: 0.5, hs: 0x9bade9, hg: 0x626b9d, hi: 2.6, stars: 0.05 },
    { el: 1.5, zen: 0x4071c2, hor: 0xf3b89d, glow: 0xffa35c, sun: 0xff9d5c, sunI: 1.5, hs: 0xb3c8f3, hg: 0x858eb4, hi: 2.5, stars: 0 },
    { el: 6, zen: 0x5091de, hor: 0xf7d8bb, glow: 0xffc080, sun: 0xffc98f, sunI: 2.2, hs: 0xc2dafb, hg: 0x9ba6c4, hi: 2.4, stars: 0 },
    { el: 16, zen: 0x4b98e9, hor: 0xd8eaf9, glow: 0xfff0d0, sun: 0xfff0dc, sunI: 2.6, hs: 0xd0e5ff, hg: 0xacb8ce, hi: 2.3, stars: 0 },
    { el: 45, zen: 0x408fe7, hor: 0xd0e7fb, glow: 0xffffff, sun: 0xffffff, sunI: 2.8, hs: 0xd7eaff, hg: 0xb6c1d2, hi: 2.3, stars: 0 },
  ];
  KEYS.forEach((k) => ['zen', 'hor', 'glow', 'sun', 'hs', 'hg'].forEach((n) => { k[n] = new T.Color(k[n]); }));
  const pal = { zen: new T.Color(), hor: new T.Color(), glow: new T.Color(), sun: new T.Color(), hs: new T.Color(), hg: new T.Color(), sunI: 0, hi: 1, stars: 0 };
  function palette(el) {
    let i = 0;
    while (i < KEYS.length - 2 && el > KEYS[i + 1].el) i++;
    const a = KEYS[i], b = KEYS[i + 1], t = U.clamp((el - a.el) / (b.el - a.el), 0, 1);
    ['zen', 'hor', 'glow', 'sun', 'hs', 'hg'].forEach((n) => pal[n].copy(a[n]).lerp(b[n], t));
    pal.sunI = U.lerp(a.sunI, b.sunI, t); pal.hi = U.lerp(a.hi, b.hi, t); pal.stars = U.lerp(a.stars, b.stars, t);
    return pal;
  }
  const skyDir = (az, el, out) => out.set(-Math.sin(az * RAD) * Math.cos(el * RAD), Math.sin(el * RAD), Math.cos(az * RAD) * Math.cos(el * RAD));

  /* ---------- build ---------- */
  const env = W.env = { night: 0, lamp: 0, wind: 0.3, aurora: 0, precip: 0, snowing: false, temp: -8, kind: 'clear', cloud: 0,
    sunEl: 0, moonUp: false, moonLit: 0, season: 'talvi', snow: 1, ice: 1, polarNight: false, midnightSun: false, blue: false, starry: false };
  W.skyMode = 'live';
  W.auroraBoost = false;
  W.debugDate = null;
  W.now = () => W.debugDate || new Date();
  const decor = {};
  const tmpC = new T.Color(), tmpC2 = new T.Color(), tmpV = new T.Vector3(), sunV = new T.Vector3(), moonV = new T.Vector3(), keyV = new T.Vector3();
  let uniforms, hemi, key, fill, lampLight, fireLight, groundMat, iceMat, snowPts, snowUni, waterUni, treeSnow, denG, poopG, ballMesh, denMat, tunnelMat, rimG;

  W.init = function (canvas) {
    const renderer = W.renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    W.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(W.pixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.toneMapping = T.NoToneMapping;
    // When the phone hands the 3D context back after a spell in the background, paint every canvas texture again first.
    canvas.addEventListener('webglcontextrestored', () => { if (U.repaint) U.repaint(); });

    const scene = W.scene = new T.Scene();
    scene.fog = new T.FogExp2(0x9fb8d8, 0.011);
    const camera = W.camera = new T.PerspectiveCamera(50, 1, 0.3, 700);

    // sky dome
    uniforms = {
      uZenith: { value: new T.Color() }, uHorizon: { value: new T.Color() }, uGround: { value: new T.Color() }, uGlowCol: { value: new T.Color() },
      uSunCol: { value: new T.Color() }, uMoonCol: { value: new T.Color(0xf4f1dc) }, uCloudLit: { value: new T.Color() }, uCloudDark: { value: new T.Color() },
      uAurA: { value: new T.Color(0x2dff8f) }, uAurB: { value: new T.Color(0x9a4dff) },
      uSunDir: { value: new T.Vector3(0, 1, 0) }, uMoonDir: { value: new T.Vector3(0, 1, 0) },
      uGlow: { value: 0 }, uSunDisc: { value: 0 }, uMoonPhase: { value: 0.5 }, uMoonVis: { value: 0 }, uStars: { value: 0 },
      uCloud: { value: 0 }, uAurora: { value: 0 }, uVenus: { value: 0 }, uTime: { value: 0 },
    };
    const sky = W.sky = new T.Mesh(new T.SphereGeometry(300, 32, 16), new T.ShaderMaterial({ uniforms, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG,
      side: T.BackSide, depthWrite: false, depthTest: false, fog: false, toneMapped: false }));
    sky.renderOrder = -10; sky.frustumCulled = false;
    scene.add(sky);

    // lights
    hemi = new T.HemisphereLight(0xffffff, 0xffffff, 2);
    key = new T.DirectionalLight(0xffffff, 2);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    const sc = key.shadow.camera; sc.left = -9; sc.right = 9; sc.top = 9; sc.bottom = -9; sc.near = 1; sc.far = 70;
    key.shadow.bias = -0.0005; key.shadow.normalBias = 0.05;
    key.target.position.set(0, 0, -1);
    fill = new T.DirectionalLight(0xffffff, 0.3);
    lampLight = new T.PointLight(0xffb45a, 0, 11, 1.7);
    fireLight = new T.PointLight(0xff8a3a, 0, 11, 1.7);
    scene.add(hemi, key, key.target, fill, lampLight, fireLight);

    buildLand(scene);
    buildDen(scene);
    buildHole(scene);
    buildSnow(scene);
    poopG = new T.Group(); scene.add(poopG);
    ballMesh = W.ball = PN.Props.ball();
    ballMesh.castShadow = true;
    ballMesh.position.set(W.BALL.x, W.groundY(W.BALL.x, W.BALL.z) + 0.24, W.BALL.z);
    ballMesh.userData.pick = { type: 'ball' };
    scene.add(ballMesh);
    PN.FX.init(scene);
    W.pickables = [ballMesh, poopG];
    W.resize();
  };

  function buildLand(scene) {
    // ground: fine near the shore, coarse far away
    const N = 150, S = 80, a = 3.3, sh = Math.sinh(a);
    const coord = (i) => S * Math.sinh(a * (i / N * 2 - 1)) / sh;
    const pos = new Float32Array((N + 1) * (N + 1) * 3), col = new Float32Array((N + 1) * (N + 1) * 3), idx = [];
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
      const x = coord(i), z = coord(j) - 2, k = (j * (N + 1) + i) * 3;
      pos[k] = x; pos[k + 1] = terrainY(x, z); pos[k + 2] = z;
      const d = landD(x, z), shade = 0.93 + 0.07 * n2(x * 0.7, z * 0.7) - 0.06 * (1 - U.smooth(0, 0.9, d));
      col[k] = 0.80 * shade; col[k + 1] = 0.87 * shade; col[k + 2] = 0.985 * shade;
      if (i < N && j < N) { const p = j * (N + 1) + i; idx.push(p, p + N + 1, p + 1, p + 1, p + N + 1, p + N + 2); }
    }
    const uv = new Float32Array((N + 1) * (N + 1) * 2);
    for (let k = 0; k < uv.length / 2; k++) { uv[k * 2] = pos[k * 3] / 3; uv[k * 2 + 1] = pos[k * 3 + 2] / 3; }
    const g = new T.BufferGeometry();
    g.setAttribute('uv', new T.BufferAttribute(uv, 2));
    g.setAttribute('position', new T.BufferAttribute(pos, 3));
    g.setAttribute('color', new T.BufferAttribute(col, 3));
    g.setIndex(idx); g.computeVertexNormals();
    groundMat = new T.MeshStandardMaterial({ vertexColors: true, roughness: 1, map: U.surfaceTex('snow') });
    const ground = W.ground = new T.Mesh(g, groundMat);
    ground.receiveShadow = true;
    scene.add(ground);

    // lake ice
    const iceTex = U.tex(512, 512, (c, w, h) => {
      const r = U.rng(5);
      c.fillStyle = '#c9dff0'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 46; i++) {                        // wind-blown snow lying on the ice
        c.fillStyle = 'rgba(255,255,255,' + (0.18 + r() * 0.3) + ')';
        c.beginPath(); c.ellipse(r() * w, r() * h, 30 + r() * 80, 8 + r() * 22, r() * 0.5 - 0.25, 0, TAU); c.fill();
      }
      c.strokeStyle = 'rgba(255,255,255,0.28)'; c.lineWidth = 1.2; c.lineJoin = 'round';
      for (let i = 0; i < 9; i++) {                         // cracks
        let x = r() * w, y = r() * h; c.beginPath(); c.moveTo(x, y);
        for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 130; y += (r() - 0.5) * 130; c.lineTo(x, y); }
        c.stroke();
      }
    });
    iceTex.wrapS = iceTex.wrapT = T.RepeatWrapping; iceTex.repeat.set(26, 26);
    iceMat = new T.MeshStandardMaterial({ map: iceTex, color: 0xffffff, roughness: 0.32, metalness: 0, emissive: 0x000000 });
    const ice = W.ice = new T.Mesh(new T.PlaneGeometry(520, 520), iceMat);
    ice.rotation.x = -Math.PI / 2; ice.position.set(0, 0, -60); ice.receiveShadow = true;
    scene.add(ice);

    // trees: all the green in one mesh and all the snow on them in another
    const green = [], white = [], M = new T.Matrix4(), Q = new T.Quaternion(), E = new T.Euler();
    const cGreen = new T.Color(0x2c5648), cDark = new T.Color(0x244a40), cTrunk = new T.Color(0x4d3323), cSnow = new T.Color(0xf2f6ff), cRock = new T.Color(0x7d8794);
    const cone = (r, h) => new T.ConeGeometry(r, h, 9), r = U.rng(2024);
    function tree(x, z, s, far) {
      const y0 = W.groundY(x, z) - 0.05, lean = far ? 0 : (r() - 0.5) * 0.08;
      const put = (list, geo, yy, color) => {
        Q.setFromEuler(E.set(lean, r() * TAU, lean * 0.6));
        M.compose(tmpV.set(x, y0 + yy * s, z), Q, new T.Vector3(s, s, s));
        list.push({ geo, m: M.clone(), c: color });
      };
      const hgt = 2.6 + r() * 0.6, rad = 0.82 + r() * 0.16;
      if (!far) put(green, new T.CylinderGeometry(0.09, 0.13, 0.7, 6), 0.3, cTrunk);
      const tiers = far ? 2 : 3;
      for (let i = 0; i < tiers; i++) {
        const k = 1 - i * (far ? 0.4 : 0.27), yy = hgt * (0.34 + i * (far ? 0.34 : 0.24)), hh = hgt * (far ? 0.62 : 0.46) * (1 - i * 0.1);
        put(green, cone(rad * k, hh), yy, i % 2 ? cDark : cGreen);
        put(white, cone(rad * k * 0.87, hh * 0.72), yy + hh * 0.17, cSnow);
      }
      if (!far) put(white, new T.SphereGeometry(0.16, 8, 6), hgt * 1.02, cSnow);
    }
    [[-4.3, -5.0, 1.2], [-5.6, -3.4, 1.45], [-3.5, -6.5, 1.05], [-5.1, -6.9, 1.5], [-6.8, -5.2, 1.3], [-6.3, -1.6, 1.6], [-7.7, -3.2, 1.4], [-4.4, -0.4, 1.1],
      [-5.2, 1.6, 1.5], [-6.6, 3.4, 1.8], [4.7, 1.3, 1.5], [6.3, 2.6, 1.4], [5.4, 4.6, 1.6], [5.5, -11.8, 1.25], [1.5, -12.1, 1.0], [4.4, -12.9, 1.4],
      [-9.5, 7, 1.9], [9.5, 8, 1.8], [12, 5.5, 1.6], [-10.5, 2.5, 1.8], [-9.2, -6.2, 1.5], [-11, -1.8, 1.9], [-8.6, -8.4, 1.3]]
      .forEach((p) => tree(p[0], p[1], p[2], false));
    for (let i = 0; i < 26; i++) {                         // down the left shore and round behind
      const x = -12 - r() * 42, z = -1.5 + 0.42 * x + 1.5 + r() * 9;
      tree(x, z, 1.3 + r() * 0.9, r() < 0.4);
    }
    for (let i = 0; i < 16; i++) { const x = 9 + r() * 34, z = -1.5 + 0.42 * x + 2 + r() * 8; tree(x, z, 1.3 + r() * 0.9, r() < 0.4); }
    for (let i = 0; i < 130; i++) {                        // the far shore
      const x = -120 + r() * 240, z = -73 + 6 * Math.sin(x * 0.06) - r() * 14;
      tree(x, z, 1.3 + r() * 1.3, true);
    }
    // a few boulders with snow hats
    [[3.3, 1.1, 0.5], [-3.3, 1.8, 0.55], [1.05, -1.3, 0.22], [3.5, -0.6, 0.34]].forEach((p) => {
      const y = W.groundY(p[0], p[1]);
      M.compose(tmpV.set(p[0], y + p[2] * 0.35, p[1]), Q.setFromEuler(E.set(0.2, p[0], 0.1)), new T.Vector3(p[2] * 1.3, p[2] * 0.85, p[2]));
      green.push({ geo: new T.SphereGeometry(1, 10, 8), m: M.clone(), c: cRock });
      M.compose(tmpV.set(p[0], y + p[2] * 0.85, p[1]), Q.setFromEuler(E.set(0, 0, 0)), new T.Vector3(p[2] * 1.15, p[2] * 0.42, p[2] * 0.9));
      white.push({ geo: new T.SphereGeometry(1, 10, 8), m: M.clone(), c: cSnow });
    });
    const tg = new T.Mesh(U.merge(green), new T.MeshStandardMaterial({ vertexColors: true, roughness: 1, map: U.surfaceTex('stone') }));
    tg.castShadow = true;
    treeSnow = new T.Mesh(U.merge(white), new T.MeshStandardMaterial({ vertexColors: true, roughness: 1, map: U.surfaceTex('snow') }));
    treeSnow.castShadow = true;
    scene.add(tg, treeSnow);

    // far fells
    const fellMat = W.fellMat = new T.MeshStandardMaterial({ color: 0xdfe9f8, roughness: 1 });
    [[-80, -150, 56, 15], [-12, -165, 66, 20], [62, -152, 52, 14], [125, -135, 48, 17], [-145, -120, 50, 12]].forEach((f) => {
      const m = U.ball(1, fellMat, f[0], 0, f[1], f[2], f[3], f[2] * 0.6, 20);
      scene.add(m);
    });
  }

  function buildDen(scene) {
    const snow = denMat = new T.MeshStandardMaterial({ color: 0xf2f6ff, roughness: 1, map: U.surfaceTex('snow') });     // snow in winter, bare rock once it melts
    denG = W.denG = new T.Group();
    const mound = new T.Mesh(new T.SphereGeometry(1, 30, 14, 0, TAU, 0, Math.PI / 2), snow);
    mound.scale.set(1.75, 1.3, 1.6);
    const tunnel = new T.Mesh(new T.CylinderGeometry(1.02, 1.02, 1.1, 22, 1, true, Math.PI / 2, Math.PI), tunnelMat = new T.MeshStandardMaterial({ color: 0xf2f6ff, roughness: 1, side: T.DoubleSide, map: U.surfaceTex('snow') }));
    tunnel.rotation.x = Math.PI / 2; tunnel.position.z = 1.35;
    const rim = U.torus(0.93, 0.14, snow, 0, 0, 1.9, Math.PI, 22);
    const dark = new T.Mesh(new T.CircleGeometry(0.87, 24, 0, Math.PI), new T.MeshBasicMaterial({ color: 0x0b1430 }));
    dark.position.z = 1.86;
    denG.add(mound, tunnel, rim, dark);
    [[-1.5, 0.5, 0.35], [1.45, 0.3, 0.3], [-0.9, 1.75, 0.22], [1.0, 1.8, 0.24], [0.2, -1.5, 0.3]].forEach((l) => denG.add(U.ball(l[2], snow, l[0], l[2] * 0.3, l[1], 1.3, 0.6, 1.1, 10)));
    denG.position.set(W.DEN.x, W.groundY(W.DEN.x, W.DEN.z) - 0.02, W.DEN.z);
    denG.rotation.y = W.DEN.heading;
    U.shadows(denG, true, true);
    dark.castShadow = false; dark.receiveShadow = false;
    scene.add(denG);
    const f = new T.Vector3(Math.sin(W.DEN.heading), 0, Math.cos(W.DEN.heading));
    W.DEN.sleep = new T.Vector3(W.DEN.x, 0, W.DEN.z).addScaledVector(f, 2.0);
    W.DEN.inside = new T.Vector3(W.DEN.x, 0, W.DEN.z).addScaledVector(f, 0.6);
    W.DEN.arch = []; for (let i = 0; i <= 12; i++) { const k = 0.06 * Math.PI + i / 12 * 0.88 * Math.PI; W.DEN.arch.push(new T.Vector3(Math.cos(k) * 1.12, Math.sin(k) * 1.12 + 0.02, 1.97)); }
  }

  function buildHole(scene) {
    waterUni = { uTime: { value: 0 }, uDeep: { value: new T.Color(0x0b2a4a) }, uSky: { value: new T.Color(0x6f9fd0) } };
    const water = new T.Mesh(new T.CircleGeometry(0.82, 40), new T.ShaderMaterial({ uniforms: waterUni, fog: false,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `varying vec2 vUv; uniform float uTime; uniform vec3 uDeep, uSky;
        void main(){ vec2 p = vUv - 0.5; float r = length(p);
          float rip = sin(r * 55.0 - uTime * 2.0) * 0.5 + 0.5;
          float n = sin(p.x * 31.0 + uTime * 1.3) * sin(p.y * 27.0 - uTime * 1.1);
          vec3 col = mix(uDeep, uSky, 0.2 + 0.16 * rip * smoothstep(0.5, 0.05, r) + 0.07 * n);
          col = mix(col, uSky * 1.1 + 0.12, smoothstep(0.455, 0.5, r) * 0.6);
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment> }` }));
    water.rotation.x = -Math.PI / 2;
    const holeG = W.holeG = new T.Group();
    const rim = new T.Mesh(new T.RingGeometry(0.8, 1.02, 40), U.mat(0xe4f1fb, { roughness: 0.5 }));
    rim.rotation.x = -Math.PI / 2; rim.position.y = 0.012; rim.receiveShadow = true;
    water.position.y = 0.02;
    rimG = new T.Group();                          // the icy edge, only there while the lake is frozen
    rimG.add(rim);
    holeG.add(water, rimG);
    const r = U.rng(9), snow = U.mat(0xf2f6ff, { roughness: 1 });
    for (let i = 0; i < 11; i++) { const a = i / 11 * TAU + r() * 0.3, d = 1.02 + r() * 0.12, s = 0.13 + r() * 0.12; rimG.add(U.ball(s, snow, Math.cos(a) * d, 0.02, Math.sin(a) * d, 1.4, 0.55, 1, 8)); }
    holeG.position.copy(W.HOLE);
    water.userData.pick = { type: 'hole' };
    W.holeWater = water;
    scene.add(holeG);
  }

  function buildSnow(scene) {
    const n = 1600, pos = new Float32Array(n * 3), seed = new Float32Array(n), r = U.rng(4);
    for (let i = 0; i < n; i++) { pos[i * 3] = (r() - 0.5) * 20; pos[i * 3 + 1] = r() * 10; pos[i * 3 + 2] = -13 + r() * 21; seed[i] = r(); }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new T.BufferAttribute(seed, 1));
    snowUni = { uTime: { value: 0 }, uWind: { value: 0 }, uSize: { value: 60 }, uColor: { value: new T.Color(0xffffff) }, uAlpha: { value: 0.9 } };
    snowPts = new T.Points(g, new T.ShaderMaterial({ uniforms: snowUni, transparent: true, depthWrite: false, fog: false,
      vertexShader: `uniform float uTime, uWind, uSize; attribute float aSeed; varying float vA;
        void main(){ vec3 p = position;
          p.y = mod(p.y - uTime * (0.55 + aSeed * 0.5), 10.0);
          p.x += sin(uTime * 0.7 + aSeed * 40.0) * 0.3 + uWind * (10.0 - p.y) * 0.3;
          p.x = mod(p.x + 10.0, 20.0) - 10.0;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = uSize * (0.5 + aSeed) / -mv.z;
          vA = smoothstep(0.0, 0.6, p.y) * smoothstep(1.2, 3.0, -mv.z); }`,
      fragmentShader: `uniform vec3 uColor; uniform float uAlpha; varying float vA;
        void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.12, d) * uAlpha * vA; if (a < 0.01) discard; gl_FragColor = vec4(uColor, a);
          #include <colorspace_fragment> }` }));
    snowPts.frustumCulled = false; snowPts.renderOrder = 4;
    g.setDrawRange(0, 0);
    scene.add(snowPts);
  }

  /* ---------- things on the shore ---------- */
  W.setDecor = function (placed) {
    Object.keys(SPOTS).concat(Object.keys(ON_DEN)).forEach((id) => {
      const want = !!placed[id];
      if (want && !decor[id]) {
        const d = id === 'lights' || id === 'viirit' ? PN.Props.decor(id, W.DEN.arch) : PN.Props.decor(id);
        if (ON_DEN[id]) {
          const o = ON_DEN[id]; d.g.position.set(o[0], o[1], o[2]); denG.add(d.g);
          if (d.conform) d.conform((x, z) => denGround(o[0] + x, o[2] + z) - o[1]);
        }
        else {
          const s = SPOTS[id], y0 = W.groundY(s[0], s[1]);
          d.g.position.set(s[0], y0, s[1]); d.g.rotation.y = s[2];
          d.onLake = !W.isLand(s[0], s[1]);
          d.front = s[1] > -2.5;
          if (d.conform) { const cs = Math.cos(s[2]), sn = Math.sin(s[2]); d.conform((x, z) => W.groundY(s[0] + x * cs + z * sn, s[1] - x * sn + z * cs) - y0); }
          W.scene.add(d.g);
        }
        d.g.traverse((o) => { if (o.isMesh) o.material = Array.isArray(o.material) ? o.material.map(U.homeMaterial) : U.homeMaterial(o.material); });
        U.shadows(d.g, !d.flat, id === 'sauna' || !!d.flat);
        d.g.traverse((o) => { if (o.isMesh && (o.material.isMeshBasicMaterial || o.material.transparent)) o.castShadow = false; });
        d.g.userData.pick = { type: 'decor', id };
        decor[id] = d;
        if (!d.flat) W.pickables.push(d.g);
      } else if (!want && decor[id]) {
        decor[id].g.parent.remove(decor[id].g);
        if (W.pickables.indexOf(decor[id].g) >= 0) W.pickables.splice(W.pickables.indexOf(decor[id].g), 1);
        delete decor[id];
      }
    });
  };
  /* How high the ground is under a point given in the den's own space, measured from the den's floor. */
  function denGround(lx, lz) {
    const c = Math.cos(W.DEN.heading), sn = Math.sin(W.DEN.heading);
    return W.groundY(W.DEN.x + lx * c + lz * sn, W.DEN.z - lx * sn + lz * c) - denG.position.y;
  }
  W.decorOf = (id) => decor[id] || null;
  W.decorAt = (id, out) => {
    if (ON_DEN[id]) { const o = ON_DEN[id]; return denG.localToWorld(out.set(o[0], o[1], o[2])); }
    const s = SPOTS[id]; return out.set(s[0], W.groundY(s[0], s[1]), s[1]);
  };
  W.hasDecor = (id) => !!decor[id];
  /* Clear the front of the shore for a mini-game, and put it all back afterwards. */
  let staged = false;
  W.stage = function (on) {
    staged = on;
    poopG.visible = !on;
    showDecor();
  };
  /* What is out but should not be seen just now: the front of the shore during a game, and things
     that stand on the ice once the ice has gone (boats and birds stay: they float). */
  function showDecor() {
    Object.keys(decor).forEach((id) => {
      const d = decor[id];
      d.g.visible = !(staged && d.front) && !(d.onLake && !d.float && env.ice < 0.35);
    });
  }
  W.lampOverride = null;                 // null follows the daylight; true or false once the player taps the lantern

  /* ---------- poo ---------- */
  const AVOID = [[SPOTS.campfire[0], SPOTS.campfire[1], 0.85], [SPOTS.feeder[0], SPOTS.feeder[1], 0.6], [SPOTS.snowman[0], SPOTS.snowman[1], 0.7],
    [SPOTS.xmastree[0], SPOTS.xmastree[1], 0.8], [SPOTS.lahjat[0], SPOTS.lahjat[1], 0.6], [SPOTS.lumilyhty[0], SPOTS.lumilyhty[1], 0.5], [SPOTS.jaalyhty[0], SPOTS.jaalyhty[1], 0.5],
    [SPOTS.kurpitsa[0], SPOTS.kurpitsa[1], 0.5], [W.BALL.x, W.BALL.z, 0.55], [W.HOME.x, W.HOME.z, 1.3]];
  W.poopSpot = function (p, out) {
    const ang = (-30 + p.a * 240) * RAD, rad = 1.45 + p.r * 0.85;
    let x = W.HOME.x + Math.cos(ang) * rad, z = W.HOME.z + Math.sin(ang) * rad * 0.8;
    x = U.clamp(x, -2.1, 2.1);
    const shore = -1.5 + 0.42 * x + 0.5;
    if (z < shore) z = shore + (shore - z) * 0.3;
    for (let i = 0; i < AVOID.length; i++) {              // not in the fire, under the ball or inside the snowman
      const o = AVOID[i], dx = x - o[0], dz = z - o[1], d = Math.hypot(dx, dz);
      if (d < o[2]) { const k = o[2] / Math.max(d, 0.05); x = o[0] + dx * k; z = o[1] + dz * k; }
    }
    return out.set(x, W.groundY(x, z), z);
  };
  W.syncPoops = function (poops) {
    while (poopG.children.length > poops.length) poopG.remove(poopG.children[poopG.children.length - 1]);
    while (poopG.children.length < poops.length) { const m = U.shadows(PN.Props.poop(), true, false); poopG.add(m); }
    poops.forEach((p, i) => {
      const m = poopG.children[i];
      W.poopSpot(p, m.position);
      m.rotation.y = p.a * 20;
      m.userData.pick = { type: 'poop', index: i };
    });
  };

  /* ---------- camera ---------- */
  const cam = W.cam = { az: 0.05, el: 0.115, dist: 10.6, tx: 0, ty: 1.2, tz: 0, cAz: 0.05, cEl: 0.115, cDist: 10.6, cx: 0, cy: 1.2, cz: 0,
    mode: 'home', size: 1, userAz: 0.05, userEl: 0.115, zoom: 1, focus: new T.Vector3(0.15, 0, 0.25), sheet: 0, cSheet: 0 };
  W.setCamMode = (mode) => { cam.mode = mode; };
  W.orbit = function (dx, dy) {
    cam.userAz = U.clamp(cam.userAz - dx * 0.006, -1.05, 1.05);
    cam.userEl = U.clamp(cam.userEl + dy * 0.004, 0.035, 0.5);
  };
  W.zoomBy = (k) => { cam.zoom = U.clamp(cam.zoom * k, 0.6, 1.6); };
  W.resetView = () => { cam.userAz = 0.05; cam.userEl = 0.115; cam.zoom = 1; };
  function updateCamera(dt, snap) {
    const portrait = W.aspect < 0.8;
    if (cam.mode === 'game') {
      cam.az = 0; cam.el = 0.03; cam.dist = portrait ? 13.5 : 12.5; cam.tx = 0; cam.ty = portrait ? 5.0 : 2.7; cam.tz = 0.6;
    } else if (cam.mode === 'intro') {
      cam.az = 0.3; cam.el = 0.2; cam.dist = 15; cam.tx = -0.6; cam.ty = 2.2; cam.tz = -1;
    } else {
      cam.az = cam.userAz; cam.el = cam.userEl;
      cam.dist = (5.0 + 3.6 * cam.size) * cam.zoom * (portrait ? 1 : 0.95);
      cam.tx = cam.focus.x * 0.75; cam.tz = cam.focus.z * 0.6;
      cam.ty = cam.focus.y + 0.55 + 0.65 * cam.size + (portrait ? 0.1 : -0.1);
      // a menu covers the bottom of the screen: step back a little and aim lower, so the seal sits above it
      cam.cSheet += (cam.sheet - cam.cSheet) * (snap ? 1 : 1 - Math.exp(-6 * dt));
      cam.dist *= 1 + 0.5 * cam.cSheet;
      cam.ty -= cam.cSheet * Math.tan(W.camera.fov * RAD / 2) * cam.dist * 0.92;
    }
    const k = snap ? 1 : 1 - Math.exp(-3.2 * dt);
    cam.cAz += (cam.az - cam.cAz) * k; cam.cEl += (cam.el - cam.cEl) * k; cam.cDist += (cam.dist - cam.cDist) * k;
    cam.cx += (cam.tx - cam.cx) * k; cam.cy += (cam.ty - cam.cy) * k; cam.cz += (cam.tz - cam.cz) * k;
    const c = W.camera, ce = Math.cos(cam.cEl);
    c.position.set(cam.cx + Math.sin(cam.cAz) * ce * cam.cDist, cam.cy + Math.sin(cam.cEl) * cam.cDist, cam.cz + Math.cos(cam.cAz) * ce * cam.cDist);
    const gy = W.groundY(c.position.x, c.position.z) + 0.4;
    if (c.position.y < gy) c.position.y = gy;
    c.lookAt(cam.cx, cam.cy, cam.cz);
    W.sky.position.copy(c.position);
  }
  W.snapCamera = () => updateCamera(0, true);

  W.resize = function () {
    const w = window.innerWidth, h = window.innerHeight;
    W.aspect = w / h;
    W.renderer.setSize(w, h, false);
    const c = W.camera;
    c.aspect = W.aspect;
    c.fov = U.clamp(2 * Math.atan(Math.tan(13.8 * RAD) / W.aspect) / RAD, 34, 58);
    c.updateProjectionMatrix();
    if (snowUni) snowUni.uSize.value = h * W.pixelRatio * 0.085;
  };
  W.setPixelRatio = function (pr) { W.pixelRatio = pr; W.renderer.setPixelRatio(pr); W.resize(); };

  /* ---------- finding what was tapped ---------- */
  const ray = new T.Raycaster(), ndc = new T.Vector2();
  W.pick = function (cx, cy, extra) {
    ndc.set(cx / window.innerWidth * 2 - 1, -(cy / window.innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, W.camera);
    const hits = ray.intersectObjects(extra ? W.pickables.concat(extra) : W.pickables, true);
    for (let i = 0; i < hits.length; i++) {
      let o = hits[i].object;
      if (o.isSprite) continue;
      while (o) {
        if (o.userData.pick) return { pick: o.userData.pick, point: hits[i].point, object: hits[i].object };
        if (o.userData.seal) return { pick: { type: 'seal', seal: o.userData.seal }, point: hits[i].point, object: hits[i].object };
        o = o.parent;
      }
    }
    return null;
  };
  W.rayAt = function (cx, cy) {
    ndc.set(cx / window.innerWidth * 2 - 1, -(cy / window.innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, W.camera);
    return ray.ray;
  };
  /* Where a point in the world lands on the screen, in CSS pixels. */
  W.screen = function (v, out) {
    tmpV.copy(v).project(W.camera);
    out.x = (tmpV.x * 0.5 + 0.5) * window.innerWidth; out.y = (-tmpV.y * 0.5 + 0.5) * window.innerHeight; out.behind = tmpV.z > 1;
    return out;
  };

  /* ---------- every frame ---------- */
  let snowT = 0;
  W.update = function (dt, t) {
    const date = W.now(), mode = W.skyMode;
    let sun = A.sun(date), moon = A.moon(date);
    const se = A.season(date), w = A.weather(date);
    let cloud = w.cloud, precip = w.precip, aur = w.aurora;
    if (mode === 'day') { sun = { el: 30, az: 38 }; cloud = Math.min(cloud, 0.3); precip = 0; }
    else if (mode === 'night') { sun = { el: -32, az: 0 }; moon = { el: 30, az: 148, phase: 0.42, lit: 0.9 }; cloud = Math.min(cloud, 0.2); precip = Math.min(precip, 0.25); aur = Math.max(aur, 0.85); }
    const dark = 1 - U.smooth(-12, -7, sun.el);
    if (W.auroraBoost && dark > 0.5) { aur = Math.max(aur, 0.85); cloud = Math.min(cloud, 0.25); precip = Math.min(precip, 0.3); }
    const P = palette(sun.el);
    const night = 1 - U.smooth(-9, -2, sun.el);

    skyDir(sun.az, sun.el, sunV); skyDir(moon.az, moon.el, moonV);
    const moonUp = U.smooth(-3, 3, moon.el);
    const moonI = 1.5 * moon.lit * U.smooth(0, 14, moon.el) * night;
    const sunI = P.sunI * (1 - 0.72 * cloud);
    const auroraVis = aur * dark * (1 - cloud * 0.85);

    // sky
    const un = uniforms;
    un.uZenith.value.copy(P.zen); un.uHorizon.value.copy(P.hor); un.uGlowCol.value.copy(P.glow); un.uSunCol.value.copy(P.sun);
    un.uSunDir.value.copy(sunV); un.uMoonDir.value.copy(moonV);
    un.uGlow.value = U.smooth(-15, -3, sun.el) * (1 - U.smooth(7, 24, sun.el)) * (1 - cloud * 0.5);
    un.uSunDisc.value = U.smooth(-2.2, 0.3, sun.el) * (1 - cloud * 0.6);
    un.uMoonPhase.value = moon.phase; un.uMoonVis.value = moonUp * (0.3 + 0.7 * night);
    un.uStars.value = P.stars * (1 - cloud * 0.6);
    un.uCloud.value = cloud; un.uAurora.value = auroraVis; un.uTime.value = t;
    un.uVenus.value = U.smooth(-8, -3, sun.el) * (1 - U.smooth(-1, 4, sun.el)) * 0.55 * (1 - cloud * 0.7) + (se.polarNight ? 0.12 * U.smooth(-8, -2, sun.el) : 0);
    tmpC.copy(P.hor).lerp(P.zen, 0.3);
    if (precip > 0.02) tmpC.lerp(tmpC2.copy(P.hs).multiplyScalar(0.6), U.clamp(precip * 0.8, 0, 0.6));
    W.scene.fog.color.copy(tmpC);
    W.scene.fog.density = 0.0105 + 0.03 * precip + 0.004 * cloud;
    un.uGround.value.copy(tmpC);
    // clouds: bright and warm by day, slate at night
    un.uCloudLit.value.setRGB(1, 1, 1).lerp(P.glow, 0.55 * (1 - U.smooth(4, 20, sun.el))).multiplyScalar(U.lerp(0.11, 1, 1 - night)).lerp(tmpC2.set(0x2b3a66), night * 0.5);
    un.uCloudDark.value.copy(P.zen).lerp(tmpC2.set(0x8a93a8), 0.55 * (1 - night)).multiplyScalar(U.lerp(0.9, 1, 1 - night));

    // light
    hemi.color.copy(P.hs); hemi.groundColor.copy(P.hg);
    hemi.intensity = P.hi * (1 - 0.12 * cloud) + 0.25 * auroraVis;
    if (auroraVis > 0.01) hemi.color.lerp(tmpC2.set(0x58ffb0), 0.14 * auroraVis);
    if (sunI > 0.02) {
      skyDir(sun.az, Math.max(sun.el, 13), keyV); key.color.copy(P.sun); key.intensity = sunI;
    } else if (moonI > 0.06) {
      skyDir(moon.az, Math.max(moon.el, 22), keyV); key.color.set(0xa9c1ff); key.intensity = moonI;
    } else {
      skyDir(62, 58, keyV); key.color.set(0x8ea6e8); key.intensity = 0.5 * night;
    }
    key.position.copy(key.target.position).addScaledVector(keyV, 34);
    fill.position.copy(W.camera.position); fill.position.y += 3;
    fill.color.copy(P.hs); fill.intensity = U.lerp(0.35, 0.75, night);

    // lamps
    const lampOn = W.lampOverride == null ? (night > 0.25 ? 1 : 0) : (W.lampOverride ? 1 : 0);
    env.lamp = lampOn; env.night = night; env.wind = w.wind; env.aurora = auroraVis;
    if (decor.lantern) { W.decorAt('lantern', lampLight.position); lampLight.position.y += 0.45; lampLight.intensity = lampOn * (2.5 + 7.5 * night) * (0.94 + 0.06 * Math.sin(t * 9)); } else lampLight.intensity = 0;
    if (decor.campfire && decor.campfire.g.visible) { const s = SPOTS.campfire; fireLight.position.set(s[0], W.groundY(s[0], s[1]) + 0.55, s[1]); fireLight.intensity = (3 + 9 * night) * decor.campfire.flicker; } else fireLight.intensity = 0;
    Object.keys(decor).forEach((id) => { if (decor[id].tick) decor[id].tick(t, env); });
    if (decor.campfire && decor.campfire.g.visible && Math.random() < dt * 3) PN.FX.spark(tmpV.set(SPOTS.campfire[0], W.groundY(SPOTS.campfire[0], SPOTS.campfire[1]) + 0.5, SPOTS.campfire[1]));
    if (decor.sauna && Math.random() < dt * 1.4) {
      const s = SPOTS.sauna;
      tmpV.copy(decor.sauna.chimney).applyAxisAngle(UP, s[2]);
      tmpV.x += s[0]; tmpV.y += W.groundY(s[0], s[1]); tmpV.z += s[1];
      PN.FX.smoke(tmpV);
    }

    // season on the ground
    env.snow = se.snow; env.ice = se.ice; env.season = se.name;
    showDecor();
    groundMat.color.setRGB(1, 1, 1).lerp(tmpC2.set(0x93a877), 1 - se.snow);
    treeSnow.visible = se.snow > 0.4;
    denMat.color.set(0xf2f6ff).lerp(tmpC2.set(0xa9a595), 1 - se.snow); tunnelMat.color.copy(denMat.color);
    rimG.visible = se.ice > 0.35;
    iceMat.color.setRGB(1, 1, 1).lerp(tmpC2.set(0x2f6a9a), 1 - se.ice);
    iceMat.roughness = U.lerp(0.1, 0.32, se.ice);
    iceMat.emissive.set(0x35ffa0).multiplyScalar(0.1 * auroraVis);
    W.fellMat.color.set(0xdfe9f8).lerp(tmpC2.set(0x7f9a80), 1 - se.snow);
    waterUni.uTime.value = t; waterUni.uSky.value.copy(P.hor).lerp(P.zen, 0.5);

    // snowfall
    const frozen = w.frozen || mode !== 'live';
    const flakes = precip > 0.03 && frozen ? Math.round(U.lerp(260, 1600, U.clamp(precip * 1.2, 0, 1))) : 0;
    snowPts.geometry.setDrawRange(0, flakes);
    snowT += dt * (1 + precip * 0.8 + w.wind * 0.6);
    snowUni.uTime.value = snowT; snowUni.uWind.value = (w.wind - 0.3) * 1.6;
    snowUni.uColor.value.copy(P.hs).lerp(tmpC2.set(0xffffff), 0.75 - 0.35 * night);
    snowUni.uAlpha.value = 0.95;

    // facts for the rest of the game
    env.precip = precip; env.snowing = flakes > 0; env.temp = w.temp; env.cloud = cloud; env.kind = w.kind; env.sunEl = sun.el;
    env.moonUp = moon.el > 4 && night > 0.5 && cloud < 0.7; env.moonLit = moon.lit;
    env.polarNight = se.polarNight && mode === 'live'; env.midnightSun = se.midnightSun && mode === 'live';
    env.blue = sun.el > -8 && sun.el < -1.5 && se.snow > 0.5; env.starry = P.stars > 0.6 && cloud < 0.4; env.sunUp = sun.el > 0.5 && cloud < 0.8;
    env.hours = date.getHours() + date.getMinutes() / 60;
    env.live = !!w.live && mode === 'live';

    updateCamera(dt, false);
  };

  /* An arcade game shows a stage of its own in place of the lake. */
  W.override = null;
  W.render = function () { const o = W.override; W.renderer.render(o ? o.scene : W.scene, o ? o.camera : W.camera); };
})(window.PN = window.PN || {});
