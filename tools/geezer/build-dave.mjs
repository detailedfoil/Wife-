// Builds Big Dave from scratch: a body sculpted from smooth blended shapes (a signed distance field),
// turned into a mesh with surface nets, given its own skeleton (Mixamo-style bone names so the game's
// sitting and arm poses work) and skin weights from the shapes each bone owns. Colours are painted
// per pixel in the game (geezer-3d.js), so the file only holds shape, normals and weights.
// Run from a folder with @gltf-transform/core and meshoptimizer installed:
//   node build-dave.mjs out.glb [cell=0.006] [triangles=56000]
import { Document, NodeIO } from '@gltf-transform/core';
import { MeshoptSimplifier } from 'meshoptimizer';
const OUT = process.argv[2] || 'dave.glb', H = +(process.argv[3] || 0.006), TRIS = +(process.argv[4] || 56000);

// ---- skeleton (metres, y up, he faces +z), left side; the right side is mirrored ----
const J = {
  Hips: [0, 0.70, -0.01], Spine: [0, 0.84, -0.06], Spine1: [0, 0.975, -0.09], Spine2: [0, 1.11, -0.11], Neck: [0, 1.225, -0.095], Head: [0, 1.30, -0.075],
  Shoulder: [0.085, 1.18, -0.10], Arm: [0.30, 1.146, -0.083], ForeArm: [0.445, 1.026, -0.083], Hand: [0.61, 0.895, -0.088],
  UpLeg: [0.147, 0.636, -0.045], Leg: [0.206, 0.31, -0.061], Foot: [0.206, 0.143, -0.075], ToeBase: [0.23, 0.05, 0.06],
};
const BONES = [['Hips', null], ['Spine', 'Hips'], ['Spine1', 'Spine'], ['Spine2', 'Spine1'], ['Neck', 'Spine2'], ['Head', 'Neck']];
for (const s of ['Left', 'Right']) BONES.push([s + 'Shoulder', 'Spine2'], [s + 'Arm', s + 'Shoulder'], [s + 'ForeArm', s + 'Arm'], [s + 'Hand', s + 'ForeArm'],
  [s + 'UpLeg', 'Hips'], [s + 'Leg', s + 'UpLeg'], [s + 'Foot', s + 'Leg'], [s + 'ToeBase', s + 'Foot']);
const jpos = (name) => { const side = name.startsWith('Left') ? 1 : name.startsWith('Right') ? -1 : 0, base = name.replace(/^(Left|Right)/, ''), p = J[base]; return side < 0 ? [-p[0], p[1], p[2]] : p.slice(); };
const BI = Object.fromEntries(BONES.map((b, i) => [b[0], i]));

// ---- shapes ----
const len = (x, y, z) => Math.sqrt(x * x + y * y + z * z);
const ell = (c, r) => (x, y, z) => { const a = (x - c[0]) / r[0], b = (y - c[1]) / r[1], d = (z - c[2]) / r[2], k0 = len(a, b, d), k1 = len(a / r[0], b / r[1], d / r[2]); return k1 < 1e-9 ? -Math.min(...r) : k0 * (k0 - 1) / k1; };
const cone = (a, b, r1, r2) => { const bx = b[0] - a[0], by = b[1] - a[1], bz = b[2] - a[2], bb = bx * bx + by * by + bz * bz;
  return (x, y, z) => { const px = x - a[0], py = y - a[1], pz = z - a[2]; let t = (px * bx + py * by + pz * bz) / bb; t = t < 0 ? 0 : t > 1 ? 1 : t; return len(px - bx * t, py - by * t, pz - bz * t) - (r1 + (r2 - r1) * t); }; };
const sph = (c, r) => (x, y, z) => len(x - c[0], y - c[1], z - c[2]) - r;
// an ellipsoid turned to lie along direction u (unit), with v the second axis
const oell = (c, u, v, r) => { const w = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], e = ell([0, 0, 0], r);
  return (x, y, z) => { const px = x - c[0], py = y - c[1], pz = z - c[2]; return e(px * u[0] + py * u[1] + pz * u[2], px * v[0] + py * v[1] + pz * v[2], px * w[0] + py * w[1] + pz * w[2]); }; };
const norm = (v) => { const l = len(...v); return v.map((a) => a / l); };
const P = [];   // { f, bone, k, op, c, rad }  op: add (smooth), hard (plain union), sub (smooth carve)
const add = (f, bone, k, c, rad, op = 'add') => P.push({ f, bone, k, op, c, rad });
const mir = (p) => [-p[0], p[1], p[2]];

// body
add(ell([0, 0.86, 0.05], [0.335, 0.275, 0.30]), 'Spine', 0.07, [0, 0.86, 0.05], 0.34);          // the belly
add(ell([0, 1.06, -0.08], [0.30, 0.20, 0.215]), 'Spine2', 0.07, [0, 1.06, -0.08], 0.31);        // chest and moobs
add(ell([0.1, 1.02, 0.07], [0.12, 0.09, 0.09]), 'Spine2', 0.06, [0.1, 1.02, 0.07], 0.13);
add(ell([-0.1, 1.02, 0.07], [0.12, 0.09, 0.09]), 'Spine2', 0.06, [-0.1, 1.02, 0.07], 0.13);
add(ell([0, 0.66, -0.07], [0.29, 0.17, 0.25]), 'Hips', 0.07, [0, 0.66, -0.07], 0.3);            // hips and bum
add(ell([0, 0.68, 0.07], [0.27, 0.12, 0.22]), 'Hips', 0.09, [0, 0.68, 0.07], 0.28);            // lower belly in the waistband
add(cone([-0.2, 1.135, -0.095], [0.2, 1.135, -0.095], 0.095, 0.095), 'Spine2', 0.06, [0, 1.135, -0.095], 0.3);   // shoulders
add(cone([0, 1.12, -0.10], [0, 1.30, -0.07], 0.115, 0.105), 'Neck', 0.06, [0, 1.21, -0.085], 0.2);
add(sph([0, 0.775, 0.343], 0.016), 'Spine', 0.012, [0, 0.775, 0.343], 0.02, 'sub');             // belly button
// head
const HC = [0, 1.50, -0.035];
add(ell(HC, [0.195, 0.205, 0.195]), 'Head', 0.05, HC, 0.21);                                       // dome
add(ell([0, 1.375, 0.005], [0.205, 0.135, 0.18]), 'Head', 0.06, [0, 1.375, 0.005], 0.21);        // jowls
add(ell([0, 1.29, 0.045], [0.15, 0.07, 0.13]), 'Head', 0.05, [0, 1.29, 0.045], 0.16);            // double chin
for (const s of [1, -1]) {
  add(ell([0.21 * s, 1.45, -0.05], [0.032, 0.062, 0.047]), 'Head', 0.025, [0.21 * s, 1.45, -0.05], 0.07);                     // ears
  add(ell([0.115 * s, 1.40, 0.11], [0.07, 0.06, 0.06]), 'Head', 0.05, [0.115 * s, 1.40, 0.11], 0.08);                         // cheeks
  add(cone([0.035 * s, 1.553, 0.172], [0.145 * s, 1.548, 0.128], 0.02, 0.016), 'Head', 0.012, [0.09 * s, 1.55, 0.15], 0.08);  // brows
  add(ell([0.072 * s, 1.453, 0.155], [0.042, 0.018, 0.024]), 'Head', 0.012, [0.072 * s, 1.453, 0.155], 0.05);                 // eye bags
}
add(ell([0, 1.418, 0.20], [0.06, 0.052, 0.055]), 'Head', 0.025, [0, 1.418, 0.2], 0.07);          // big nose
add(cone([0, 1.47, 0.17], [0, 1.43, 0.2], 0.022, 0.03), 'Head', 0.02, [0, 1.45, 0.185], 0.05);
const EYE = [0.07, 1.492, 0.152], ER = 0.038;
for (const s of [1, -1]) {
  const e = [EYE[0] * s, EYE[1], EYE[2]];
  add(sph(e, ER), 'Head', 0, e, ER + 0.01, 'hard');                                                  // eyeball
  const lid = sph(e, ER + 0.005);
  add((x, y, z) => Math.max(lid(x, y, z), (e[1] + 0.004 - 0.12 * (x - e[0]) * s) - y), 'Head', 0.006, e, ER + 0.02, 'hard');   // heavy sleepy lid
}
// arms and hands
for (const s of [1, -1]) {
  const S = (p) => (s > 0 ? p : mir(p)), side = s > 0 ? 'Left' : 'Right';
  add(cone(S([0.24, 1.15, -0.088]), S(J.ForeArm), 0.1, 0.074), side + 'Arm', 0.05, S([0.34, 1.09, -0.085]), 0.17);
  add(cone(S(J.ForeArm), S([0.60, 0.905, -0.088]), 0.072, 0.05), side + 'ForeArm', 0.04, S([0.52, 0.96, -0.085]), 0.15);
  const u = norm([0.70 - 0.61, 0.80 - 0.895, 0]), us = s > 0 ? u : [-u[0], u[1], u[2]];
  add(oell(S([0.655, 0.852, -0.06]), us, [0, 0, 1], [0.062, 0.062, 0.032]), side + 'Hand', 0.03, S([0.655, 0.852, -0.06]), 0.08);   // palm
  for (const [k1, k4, r] of [[[0.707, 0.80, -0.142], [0.752, 0.75, -0.143], 0.017], [[0.714, 0.794, -0.09], [0.767, 0.735, -0.086], 0.019],
    [[0.707, 0.80, -0.03], [0.758, 0.73, -0.018], 0.02], [[0.687, 0.80, 0.023], [0.728, 0.735, 0.044], 0.019], [[0.64, 0.86, 0.0], [0.66, 0.79, 0.07], 0.021]])
    add(cone(S(k1), S(k4), r, r * 0.92), side + 'Hand', 0.016, S(k1.map((v, i) => (v + k4[i]) / 2)), 0.08);
  // trackie legs, cuffs, socks and feet
  add(cone(S([0.15, 0.62, -0.05]), S([0.205, 0.31, -0.06]), 0.165, 0.125), side + 'UpLeg', 0.06, S([0.18, 0.47, -0.055]), 0.33);
  add(cone(S(J.Leg), S([0.206, 0.23, -0.065]), 0.118, 0.105), side + 'Leg', 0.04, S([0.206, 0.27, -0.06]), 0.17);
  add(ell(S([0.206, 0.205, -0.066]), [0.1, 0.045, 0.1]), side + 'Leg', 0.03, S([0.206, 0.205, -0.066]), 0.11);           // gathered cuff
  add(cone(S([0.206, 0.19, -0.07]), S([0.208, 0.08, -0.05]), 0.072, 0.07), side + 'Foot', 0.03, S([0.207, 0.13, -0.06]), 0.12);
  add(ell(S([0.218, 0.058, 0.0]), [0.078, 0.06, 0.135]), side + 'Foot', 0.04, S([0.218, 0.058, 0.0]), 0.15);
  add(ell(S([0.228, 0.05, 0.08]), [0.07, 0.045, 0.07]), side + 'ToeBase', 0.04, S([0.228, 0.05, 0.08]), 0.09);
}

function smin(a, b, k) { if (k <= 0) return Math.min(a, b); const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; }
function smax(a, b, k) { return -smin(-a, -b, k); }
function field(x, y, z) {
  let d = 1e9;
  for (const p of P) {
    const bd = len(x - p.c[0], y - p.c[1], z - p.c[2]) - p.rad;
    if (p.op === 'sub') { if (bd < p.k) d = smax(d, -p.f(x, y, z), p.k); continue; }
    if (bd > d + p.k) continue;
    const v = p.f(x, y, z);
    d = p.op === 'hard' ? Math.min(d, v) : smin(d, v, p.k);
  }
  return d;
}

// ---- surface nets ----
const X0 = -0.84, Y0 = -0.01, Z0 = -0.42, NX = Math.ceil(1.68 / H) + 1, NY = Math.ceil(1.74 / H) + 1, NZ = Math.ceil(0.86 / H) + 1;
console.log('grid', NX, NY, NZ);
const F = new Float32Array(NX * NY * NZ), id = (i, j, k) => (k * NY + j) * NX + i;
for (let k = 0; k < NZ; k++) for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) F[id(i, j, k)] = field(X0 + i * H, Y0 + j * H, Z0 + k * H);
const CI = new Int32Array(NX * NY * NZ).fill(-1), V = [];
const corners = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
for (let k = 0; k < NZ - 1; k++) for (let j = 0; j < NY - 1; j++) for (let i = 0; i < NX - 1; i++) {
  const v = corners.map((c) => F[id(i + c[0], j + c[1], k + c[2])]);
  let neg = 0; for (const a of v) if (a < 0) neg++;
  if (neg === 0 || neg === 8) continue;
  let sx = 0, sy = 0, sz = 0, n = 0;
  for (const [a, b] of edges) if ((v[a] < 0) !== (v[b] < 0)) { const t = v[a] / (v[a] - v[b]), ca = corners[a], cb = corners[b];
    sx += ca[0] + (cb[0] - ca[0]) * t; sy += ca[1] + (cb[1] - ca[1]) * t; sz += ca[2] + (cb[2] - ca[2]) * t; n++; }
  CI[id(i, j, k)] = V.length / 3; V.push(X0 + (i + sx / n) * H, Y0 + (j + sy / n) * H, Z0 + (k + sz / n) * H);
}
const I = [];
const quad = (a, b, c, d, flip) => { if (a < 0 || b < 0 || c < 0 || d < 0) return; if (flip) I.push(a, c, b, a, d, c); else I.push(a, b, c, a, c, d); };
for (let k = 1; k < NZ - 1; k++) for (let j = 1; j < NY - 1; j++) for (let i = 1; i < NX - 1; i++) {
  const f0 = F[id(i, j, k)] < 0;
  if (f0 !== (F[id(i + 1, j, k)] < 0)) quad(CI[id(i, j - 1, k - 1)], CI[id(i, j, k - 1)], CI[id(i, j, k)], CI[id(i, j - 1, k)], !f0);
  if (f0 !== (F[id(i, j + 1, k)] < 0)) quad(CI[id(i - 1, j, k - 1)], CI[id(i - 1, j, k)], CI[id(i, j, k)], CI[id(i, j, k - 1)], !f0);
  if (f0 !== (F[id(i, j, k + 1)] < 0)) quad(CI[id(i - 1, j - 1, k)], CI[id(i, j - 1, k)], CI[id(i, j, k)], CI[id(i - 1, j, k)], !f0);
}
console.log('nets', V.length / 3, 'verts', I.length / 3, 'tris');
// pull vertices onto the true surface
const grad = (x, y, z) => { const e = 0.0008; return [field(x + e, y, z) - field(x - e, y, z), field(x, y + e, z) - field(x, y - e, z), field(x, y, z + e) - field(x, y, z - e)].map((g) => g / (2 * e)); };
for (let it = 0; it < 2; it++) for (let v = 0; v < V.length; v += 3) { const d = field(V[v], V[v + 1], V[v + 2]), g = grad(V[v], V[v + 1], V[v + 2]), gg = g[0] ** 2 + g[1] ** 2 + g[2] ** 2; if (gg < 1e-8) continue; const s = Math.max(-H, Math.min(H, d / gg)); V[v] -= g[0] * s; V[v + 1] -= g[1] * s; V[v + 2] -= g[2] * s; }
// fix the winding so every triangle faces outward
for (let t = 0; t < I.length; t += 3) { const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
  const ux = V[b] - V[a], uy = V[b + 1] - V[a + 1], uz = V[b + 2] - V[a + 2], wx = V[c] - V[a], wy = V[c + 1] - V[a + 1], wz = V[c + 2] - V[a + 2];
  const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx, g = grad((V[a] + V[b] + V[c]) / 3, (V[a + 1] + V[b + 1] + V[c + 1]) / 3, (V[a + 2] + V[b + 2] + V[c + 2]) / 3);
  if (nx * g[0] + ny * g[1] + nz * g[2] < 0) { const s = I[t + 1]; I[t + 1] = I[t + 2]; I[t + 2] = s; } }

// ---- simplify ----
await MeshoptSimplifier.ready;
const pos0 = new Float32Array(V);
const [idx] = MeshoptSimplifier.simplify(new Uint32Array(I), pos0, 3, TRIS * 3, 0.0015, []);
const remap = new Int32Array(pos0.length / 3).fill(-1); let nv = 0;
for (const v of idx) if (remap[v] < 0) remap[v] = nv++;
const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), jn = new Uint16Array(nv * 4), wt = new Float32Array(nv * 4);
for (let v = 0; v < remap.length; v++) if (remap[v] >= 0) pos.set(pos0.subarray(v * 3, v * 3 + 3), remap[v] * 3);
const ind = (nv < 65536 ? Uint16Array : Uint32Array).from(idx, (v) => remap[v]);
console.log('simplified', nv, 'verts', ind.length / 3, 'tris');
// normals from the shape itself, weights from the shapes each bone owns
for (let v = 0; v < nv; v++) {
  const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2], g = norm(grad(x, y, z)); nor.set(g, v * 3);
  const ds = [];
  for (const p of P) if (p.op !== 'sub' && len(x - p.c[0], y - p.c[1], z - p.c[2]) - p.rad < 0.1) ds.push([p.f(x, y, z), p.bone]);
  const dmin = Math.min(...ds.map((d) => d[0])), acc = {};
  for (const [d, b] of ds) acc[b] = (acc[b] || 0) + Math.exp(-(d - dmin) / 0.012);
  const top = Object.entries(acc).sort((a, b) => b[1] - a[1]).slice(0, 4), sum = top.reduce((s, e) => s + e[1], 0);
  top.forEach(([b, w], k) => { jn[v * 4 + k] = BI[b]; wt[v * 4 + k] = w / sum; });
}

// ---- write the glb ----
const doc = new Document(), buf = doc.createBuffer(), scene = doc.createScene('Dave');
const nodes = {};
for (const [name, parent] of BONES) {
  const p = jpos(name), q = parent ? jpos(parent) : [0, 0, 0];
  nodes[name] = doc.createNode('mixamorig:' + name).setTranslation([p[0] - q[0], p[1] - q[1], p[2] - q[2]]);
  if (parent) nodes[parent].addChild(nodes[name]); else scene.addChild(nodes[name]);
}
const ibm = new Float32Array(BONES.length * 16);
BONES.forEach(([name], k) => { const p = jpos(name); ibm.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -p[0], -p[1], -p[2], 1], k * 16); });
const skin = doc.createSkin('dave').setInverseBindMatrices(doc.createAccessor().setType('MAT4').setArray(ibm).setBuffer(buf));
for (const [name] of BONES) skin.addJoint(nodes[name]);
const mat = doc.createMaterial('dave').setBaseColorFactor([1, 1, 1, 1]).setMetallicFactor(0).setRoughnessFactor(0.75);
const prim = doc.createPrimitive().setMaterial(mat)
  .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(pos).setBuffer(buf))
  .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(nor).setBuffer(buf))
  .setAttribute('JOINTS_0', doc.createAccessor().setType('VEC4').setArray(jn).setBuffer(buf))
  .setAttribute('WEIGHTS_0', doc.createAccessor().setType('VEC4').setArray(wt).setBuffer(buf))
  .setIndices(doc.createAccessor().setType('SCALAR').setArray(ind).setBuffer(buf));
scene.addChild(doc.createNode('Dave').setMesh(doc.createMesh('Dave').addPrimitive(prim)).setSkin(skin));
await new NodeIO().write(OUT, doc);
console.log('wrote', OUT);
