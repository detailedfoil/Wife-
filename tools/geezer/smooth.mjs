// Shrinks and smooths a Meshy .glb for the geezer prototype: drops the metal and normal maps, cleans the
// texture, smooths the bumpy sculpted hair on skin, then simplifies. Needs @gltf-transform/core and functions,
// meshoptimizer and sharp installed.  node smooth.mjs in.glb out.glb 0.15 20
import { NodeIO } from '@gltf-transform/core';
import { weld, simplify, textureCompress, prune, dedup, normals } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
const [,, input, output, ratio, iters] = process.argv;
const io = new NodeIO();
const doc = await io.read(input);
const mat = doc.getRoot().listMaterials()[0];
mat.setMetallicRoughnessTexture(null); mat.setMetallicFactor(0); mat.setRoughnessFactor(0.85);
const baseTex = mat.getBaseColorTexture();
const img = await sharp(Buffer.from(baseTex.getImage())).raw().toBuffer({ resolveWithObject: true });
mat.setNormalTexture(null);
const cleaned = await sharp(Buffer.from(baseTex.getImage())).median(5).jpeg({ quality: 92 }).toBuffer(); baseTex.setImage(cleaned); baseTex.setMimeType('image/jpeg');   // the normal map carries the sculpted hair bumps
await doc.transform(weld());
for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) {
  const pos = prim.getAttribute('POSITION'), uv = prim.getAttribute('TEXCOORD_0'), idx = prim.getIndices();
  const n = pos.getCount(), P = new Float32Array(n * 3), key = new Map(), gid = new Int32Array(n);
  const v = [0, 0, 0], t = [0, 0];
  for (let i = 0; i < n; i++) { pos.getElement(i, v); P.set(v, i * 3); const k = v.map((x) => Math.round(x * 1e5)).join(','); if (!key.has(k)) key.set(k, key.size); gid[i] = key.get(k); }
  const G = key.size, nb = Array.from({ length: G }, () => new Set());
  const I = idx.getArray();
  for (let f = 0; f < I.length; f += 3) { const a = gid[I[f]], b = gid[I[f + 1]], c = gid[I[f + 2]]; nb[a].add(b).add(c); nb[b].add(a).add(c); nb[c].add(a).add(b); }
  // group positions and a "skin" mask from the texture colour (orange-ish, not white vest or grey trackies)
  const Q = new Float32Array(G * 3), mask = new Float32Array(G), cnt = new Float32Array(G);
  for (let i = 0; i < n; i++) {
    const g = gid[i]; Q[g * 3] = P[i * 3]; Q[g * 3 + 1] = P[i * 3 + 1]; Q[g * 3 + 2] = P[i * 3 + 2];
    uv.getElement(i, t);
    const x = Math.min(img.info.width - 1, Math.max(0, Math.floor(t[0] * img.info.width))), y = Math.min(img.info.height - 1, Math.max(0, Math.floor(t[1] * img.info.height)));
    const o = (y * img.info.width + x) * img.info.channels, r = img.data[o], gg = img.data[o + 1], bb = img.data[o + 2];
    const skin = r > 120 && r - bb > 45 && r > gg ? 1 : 0;
    mask[g] += skin; cnt[g]++;
  }
  for (let g = 0; g < G; g++) mask[g] = mask[g] / cnt[g];
  // spread the mask a little so edges blend
  for (let pass = 0; pass < 3; pass++) { const m2 = mask.slice(); for (let g = 0; g < G; g++) { let s = mask[g], c = 1; for (const h of nb[g]) { s += mask[h]; c++; } m2[g] = s / c; } mask.set(m2); }
  const step = (w) => {
    const R = Q.slice();
    for (let g = 0; g < G; g++) {
      if (!nb[g].size) continue;
      let x = 0, y = 0, z = 0; for (const h of nb[g]) { x += Q[h * 3]; y += Q[h * 3 + 1]; z += Q[h * 3 + 2]; }
      const k = nb[g].size, m = w * (0.25 + 0.75 * mask[g]);
      R[g * 3] += m * (x / k - Q[g * 3]); R[g * 3 + 1] += m * (y / k - Q[g * 3 + 1]); R[g * 3 + 2] += m * (z / k - Q[g * 3 + 2]);
    }
    Q.set(R);
  };
  for (let it = 0; it < +iters; it++) { step(0.55); if (it % 3 === 2) step(-0.4); }
  // smooth normals across UV seams: area-weighted face normals summed per position group
  const N = new Float32Array(G * 3);
  for (let f = 0; f < I.length; f += 3) {
    const a = gid[I[f]], b = gid[I[f + 1]], c = gid[I[f + 2]];
    const ux = Q[b*3]-Q[a*3], uy = Q[b*3+1]-Q[a*3+1], uz = Q[b*3+2]-Q[a*3+2], vx = Q[c*3]-Q[a*3], vy = Q[c*3+1]-Q[a*3+1], vz = Q[c*3+2]-Q[a*3+2];
    const nx = uy*vz-uz*vy, ny = uz*vx-ux*vz, nz = ux*vy-uy*vx;
    for (const g of [a, b, c]) { N[g*3] += nx; N[g*3+1] += ny; N[g*3+2] += nz; }
  }
  const nor = prim.getAttribute('NORMAL');
  for (let i = 0; i < n; i++) { const g = gid[i], l = Math.hypot(N[g*3], N[g*3+1], N[g*3+2]) || 1; nor.setElement(i, [N[g*3]/l, N[g*3+1]/l, N[g*3+2]/l]); }
  for (let i = 0; i < n; i++) { const g = gid[i]; pos.setElement(i, [Q[g * 3], Q[g * 3 + 1], Q[g * 3 + 2]]); }
}
await doc.transform(
  simplify({ simplifier: MeshoptSimplifier, ratio: +ratio, error: 0.002 }),
  prune(), dedup(),
  textureCompress({ encoder: sharp, targetFormat: 'jpeg', resize: [1024, 1024], quality: 82 }),
);
await io.write(output, doc);
