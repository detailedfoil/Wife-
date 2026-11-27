/* Pikku Norppa: a small loader for simple .glb models (developer prototype).
   The game's three.js build has no model loader, and the geezer prototype only needs
   one textured mesh, so this reads the GLB itself: meshes with POSITION, NORMAL and
   TEXCOORD_0, indices, a base colour texture and a normal map. */
(function (PN) {
  'use strict';
  const T = THREE;
  const SIZES = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
  const TYPES = { 5126: Float32Array, 5123: Uint16Array, 5125: Uint32Array, 5121: Uint8Array };

  function accessor(json, bin, i) {
    const a = json.accessors[i], v = json.bufferViews[a.bufferView], Arr = TYPES[a.componentType], n = SIZES[a.type];
    const off = (v.byteOffset || 0) + (a.byteOffset || 0), stride = v.byteStride || 0;
    if (!stride || stride === n * Arr.BYTES_PER_ELEMENT) return new T.BufferAttribute(new Arr(bin.buffer, bin.byteOffset + off, a.count * n).slice(), n);
    const out = new Arr(a.count * n), view = new DataView(bin.buffer, bin.byteOffset);
    for (let k = 0; k < a.count; k++) for (let c = 0; c < n; c++) {
      const p = off + k * stride + c * Arr.BYTES_PER_ELEMENT;
      out[k * n + c] = Arr === Float32Array ? view.getFloat32(p, true) : Arr === Uint16Array ? view.getUint16(p, true) : Arr === Uint32Array ? view.getUint32(p, true) : view.getUint8(p);
    }
    return new T.BufferAttribute(out, n);
  }

  async function texture(json, bin, info, srgb) {
    if (!info) return null;
    const img = json.images[json.textures[info.index].source], v = json.bufferViews[img.bufferView];
    const blob = new Blob([new Uint8Array(bin.buffer, bin.byteOffset + (v.byteOffset || 0), v.byteLength)], { type: img.mimeType });
    const bmp = await createImageBitmap(blob);
    const t = new T.Texture(bmp);
    t.flipY = false; t.colorSpace = srgb ? T.SRGBColorSpace : T.NoColorSpace; t.anisotropy = 4; t.needsUpdate = true;
    return t;
  }

  /* Load a .glb from a URL and give back a Group holding its meshes. */
  PN.loadGLB = async function (url) {
    const buf = await (await fetch(url)).arrayBuffer(), dv = new DataView(buf);
    if (dv.getUint32(0, true) !== 0x46546c67) throw new Error('not a glb');
    let p = 12, json = null, bin = null;
    while (p < buf.byteLength) {
      const len = dv.getUint32(p, true), type = dv.getUint32(p + 4, true);
      if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, p + 8, len)));
      else if (type === 0x004e4942) bin = new Uint8Array(buf, p + 8, len);
      p += 8 + len;
    }
    const mats = await Promise.all((json.materials || []).map(async (m) => {
      const pbr = m.pbrMetallicRoughness || {};
      return new T.MeshStandardMaterial({
        map: await texture(json, bin, pbr.baseColorTexture, true), normalMap: await texture(json, bin, m.normalTexture, false),
        metalness: pbr.metallicFactor != null ? pbr.metallicFactor : 0, roughness: pbr.roughnessFactor != null ? pbr.roughnessFactor : 0.9,
        side: m.doubleSided ? T.DoubleSide : T.FrontSide,
      });
    }));
    const group = new T.Group();
    (json.meshes || []).forEach((mesh) => mesh.primitives.forEach((pr) => {
      const g = new T.BufferGeometry(), at = pr.attributes;
      g.setAttribute('position', accessor(json, bin, at.POSITION));
      if (at.NORMAL != null) g.setAttribute('normal', accessor(json, bin, at.NORMAL)); else g.computeVertexNormals();
      if (at.TEXCOORD_0 != null) g.setAttribute('uv', accessor(json, bin, at.TEXCOORD_0));
      if (pr.indices != null) g.setIndex(accessor(json, bin, pr.indices));
      group.add(new T.Mesh(g, mats[pr.material] || new T.MeshStandardMaterial({ color: 0xcccccc })));
    }));
    return group;
  };
})(window.PN = window.PN || {});
