// Turns Meshy's rigged (untextured) Dave into a small coloured, skinned GLB for the game.
// Colours: head and torso copied from the first (textured, seated) Dave by nearest point; limbs by body part.
import { NodeIO } from '@gltf-transform/core';
import { weld, simplify, prune, dedup } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
const [,, rigIn, oldIn, out, ratio] = process.argv;
const io = new NodeIO();
const doc = await io.read(rigIn), old = await io.read(oldIn);
for (const a of doc.getRoot().listAnimations()) a.dispose();
// old model: positions, uvs, texture pixels
const oprim = old.getRoot().listMeshes()[0].listPrimitives()[0];
const OP = oprim.getAttribute('POSITION').getArray(), OUV = oprim.getAttribute('TEXCOORD_0').getArray();
const otex = old.getRoot().listMaterials()[0].getBaseColorTexture();
const img = await sharp(Buffer.from(otex.getImage())).median(5).raw().toBuffer({ resolveWithObject: true });
const W = img.info.width, H = img.info.height, CH = img.info.channels;
const samp = (u, v) => { const x = Math.min(W - 1, Math.max(0, Math.floor(u * W))), y = Math.min(H - 1, Math.max(0, Math.floor(v * H))), o = (y * W + x) * CH; return [img.data[o] / 255, img.data[o + 1] / 255, img.data[o + 2] / 255]; };
const skin = doc.getRoot().listSkins()[0], joints = skin.listJoints(), names = joints.map((j) => j.getName());
const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0];
const P = prim.getAttribute('POSITION').getArray(), J = prim.getAttribute('JOINTS_0').getArray(), WT = prim.getAttribute('WEIGHTS_0').getArray();
const n = P.length / 3;
// joint world positions from inverse bind matrices
const ibm = skin.getInverseBindMatrices().getArray();
const jpos = names.map((_, k) => { const m = ibm.slice(k * 16, k * 16 + 16); // invert affine: pos = -R^T t
  const r = [[m[0], m[4], m[8]], [m[1], m[5], m[9]], [m[2], m[6], m[10]]], t = [m[12], m[13], m[14]];
  return [-(r[0][0] * t[0] + r[1][0] * t[1] + r[2][0] * t[2]), -(r[0][1] * t[0] + r[1][1] * t[1] + r[2][1] * t[2]), -(r[0][2] * t[0] + r[1][2] * t[1] + r[2][2] * t[2])]; });
const J_ = (nm) => names.indexOf('mixamorig:' + nm);
console.log('head', jpos[J_('Head')], 'neck', jpos[J_('Neck')], 'lfoot', jpos[J_('LeftFoot')], 'larm', jpos[J_('LeftArm')], 'lhand', jpos[J_('LeftHand')]);
const region = (i) => { let best = -1, bw = -1; for (let k = 0; k < 4; k++) if (WT[i * 4 + k] > bw) { bw = WT[i * 4 + k]; best = J[i * 4 + k]; } return names[best] || ''; };
// align old head to new head: compare the top 40% of each head
let ntop = -1e9; const headIdx = [];
for (let i = 0; i < n; i++) { const r = region(i); if (/Head|Neck|headfront/.test(r)) { headIdx.push(i); ntop = Math.max(ntop, P[i * 3 + 1]); } }
let otop = -1e9; for (let i = 1; i < OP.length; i += 3) otop = Math.max(otop, OP[i]);
const capBox = (arr, idxs, top, h) => { let mnx = 1e9, mxx = -1e9, mnz = 1e9, mxz = -1e9; for (const i of idxs) { const y = arr[i * 3 + 1]; if (y > top - h) { const x = arr[i * 3], z = arr[i * 3 + 2]; mnx = Math.min(mnx, x); mxx = Math.max(mxx, x); mnz = Math.min(mnz, z); mxz = Math.max(mxz, z); } } return { cx: (mnx + mxx) / 2, cz: (mnz + mxz) / 2, w: mxx - mnx, d: mxz - mnz }; };
const nb = capBox(P, headIdx, ntop, 0.08);
const oall = Array.from({ length: OP.length / 3 }, (_, i) => i);
const ob = capBox(OP, oall, otop, 0.08 * 1.0);
const s = ob.w / nb.w;   // old units per new unit
console.log('newcap', nb, 'oldcap', ob, 'scale', s);
let A = { s, dx: 0, dy: 0, dz: 0, pitch: 0 };
const toOld = (x, y, z, a = A) => { let X = (x - nb.cx) * a.s, Y = (y - ntop) * a.s, Z = (z - nb.cz) * a.s;
  const c = Math.cos(a.pitch), sn = Math.sin(a.pitch); const Y2 = Y * c - Z * sn, Z2 = Y * sn + Z * c;
  return [X + ob.cx + a.dx, Y2 + otop + a.dy, Z2 + ob.cz + a.dz]; };
// spatial hash of old vertices
const cell = 0.02, grid = new Map(), key = (a, b, c) => a + ',' + b + ',' + c;
for (let i = 0; i < OP.length / 3; i++) { const k = key(Math.floor(OP[i * 3] / cell), Math.floor(OP[i * 3 + 1] / cell), Math.floor(OP[i * 3 + 2] / cell)); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(i); }
const nearest = (q, maxd) => { const cx = Math.floor(q[0] / cell), cy = Math.floor(q[1] / cell), cz = Math.floor(q[2] / cell), R = Math.ceil(maxd / cell); let best = -1, bd = maxd * maxd;
  for (let a = -R; a <= R; a++) for (let b = -R; b <= R; b++) for (let c = -R; c <= R; c++) { const l = grid.get(key(cx + a, cy + b, cz + c)); if (!l) continue; for (const i of l) { const dx = OP[i * 3] - q[0], dy = OP[i * 3 + 1] - q[1], dz = OP[i * 3 + 2] - q[2], d = dx * dx + dy * dy + dz * dz; if (d < bd) { bd = d; best = i; } } }
  return best; };
const sample = headIdx.filter((_, k) => k % Math.ceil(headIdx.length / 1500) === 0);
const cost = (a) => { let t = 0; for (const i of sample) { const q = toOld(P[i*3], P[i*3+1], P[i*3+2], a); const j = nearest(q, 0.05); t += j < 0 ? 0.05 : Math.hypot(OP[j*3]-q[0], OP[j*3+1]-q[1], OP[j*3+2]-q[2]); } return t / sample.length; };
let best = cost(A); console.log('cost0', best);
const steps = { s: 0.03, dx: 0.01, dy: 0.02, dz: 0.03, pitch: 0.08 };
for (let round = 0; round < 5; round++) { for (const k of Object.keys(steps)) for (const dir of [1, -1]) { for (let tries = 0; tries < 6; tries++) { const B = { ...A, [k]: A[k] + dir * steps[k] }; const c = cost(B); if (c < best) { best = c; A = B; } else break; } } for (const k in steps) steps[k] /= 2; }
console.log('cost', best, A);
const C = new Float32Array(n * 3), FALL = { skin: [0.94, 0.62, 0.47], vest: [0.93, 0.92, 0.9], grey: [0.42, 0.41, 0.44], sock: [0.95, 0.95, 0.95], stripe: [0.2, 0.35, 0.75] };
const lf = jpos[J_('LeftFoot')], rf = jpos[J_('RightFoot')];
let hits = 0;
const SKINC = [0.94, 0.66, 0.5];
const stains = [[-0.06, 1.02, 0.035, [0.86, 0.68, 0.2]], [0.1, 0.97, 0.028, [0.85, 0.42, 0.3]], [-0.02, 0.95, 0.015, [0.86, 0.68, 0.2]], [0.03, 1.06, 0.012, [0.85, 0.42, 0.3]]];
for (let i = 0; i < n; i++) {
  const r = region(i), x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2], ax = Math.abs(x), front = z > -0.06;
  let col = null;
  const fy = x > 0 ? lf[1] : rf[1], isArm = /Arm|Hand|Bone_/.test(r) && !/Shoulder/.test(r);
  const waist = front ? 0.8 : 0.84;
  if (y > 1.24 && !isArm) {
    const j = nearest(toOld(x, y, z), 0.05);
    if (j >= 0) { col = samp(OUV[j * 2], OUV[j * 2 + 1]); hits++; } else col = SKINC;
  } else if (isArm && (ax > 0.31 || (ax > 0.24 && y > 1.05))) col = process.env.DBG2 ? [1,0,1] : SKINC;
  else if (y - fy < 0.09 && y < 0.4) { const h = y - fy; col = (h > 0.03 && h < 0.045) || (h > 0.06 && h < 0.075) ? FALL.stripe : FALL.sock; }
  else if (y < waist) col = (front && ax < 0.025 && y > 0.7 && z > 0.05) ? [0.96, 0.96, 0.96] : (y > waist - 0.03 ? [0.36, 0.35, 0.38] : FALL.grey);
  else {
    // torso: bare belly under the vest at the front, a vest with a scoop neck and armholes
    const f = Math.min(1, Math.max(0, z / 0.18)), vestBottom = 0.84 + 0.09 * f;
    if (y < vestBottom) col = process.env.DBG2 ? [1,0,0] : SKINC;
    else if (y > 1.13) col = (ax > 0.1 && ax < 0.19 && y < 1.23) ? FALL.vest : (process.env.DBG2 ? [0,1,0] : SKINC);
    else if (front && y > 1.06 + 0.45 * ax) col = process.env.DBG2 ? [0,0,1] : SKINC;
    else if (ax > 0.22 && y > 1.04 && z < 0.12) col = process.env.DBG2 ? [1,1,0] : SKINC;
    else col = FALL.vest;
    if (col === FALL.vest && front) for (const st of stains) if (Math.hypot(x - st[0], y - st[1]) < st[2]) col = st[3];
  }
  if (process.env.DEBUG) { const pal = { Hips: [1,0,0], Spine: [0,1,0], Spine1: [0,0,1], Spine2: [1,1,0], Neck: [1,0,1], LeftShoulder: [0,1,1], RightShoulder: [0,1,1], LeftArm: [0.5,0,0], RightArm: [0.5,0,0], LeftUpLeg: [0,0.4,0], RightUpLeg: [0,0.4,0] }; col = pal[r.replace('mixamorig:', '')] || [0.2,0.2,0.2]; }
  C.set(col.map((v) => Math.pow(v, 2.2)), i * 3);   // vertex colours are linear in glTF
}
console.log('transferred', hits, 'of', n);
prim.setAttribute('COLOR_0', doc.createAccessor().setType('VEC3').setArray(C).setBuffer(doc.getRoot().listBuffers()[0]));
const mat = doc.createMaterial('dave').setBaseColorFactor([1, 1, 1, 1]).setMetallicFactor(0).setRoughnessFactor(0.8);
prim.setMaterial(mat);
prim.getAttribute('NORMAL').dispose();
await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: +ratio, error: 0.001 }), prune(), dedup());
for (const a of doc.getRoot().listAccessors()) if (a.listParents().every((p) => p === doc.getRoot())) a.dispose();
await io.write(out, doc);
