/* Pikku Norppa: a small loader for simple .glb models (developer prototype).
   The game's three.js build has no model loader, so this reads the GLB itself. It handles
   what the geezer prototype needs: the node tree, meshes with POSITION, NORMAL, TEXCOORD_0,
   COLOR_0, indices, one skin (bones and their bind matrices), a base colour texture and a
   normal map. Animations are not read: the game moves the bones in code. */
(function (PN) {
  'use strict';
  const T = THREE;
  const SIZES = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
  const TYPES = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array, 5121: Uint8Array };

  function accessor(json, bin, i) {
    const a = json.accessors[i], v = json.bufferViews[a.bufferView], Arr = TYPES[a.componentType], n = SIZES[a.type];
    const off = (v.byteOffset || 0) + (a.byteOffset || 0), stride = v.byteStride || 0, el = Arr.BYTES_PER_ELEMENT;
    let out;
    if (!stride || stride === n * el) {
      if ((bin.byteOffset + off) % el === 0) out = new Arr(bin.buffer, bin.byteOffset + off, a.count * n).slice();
      else out = new Arr(bin.slice(off, off + a.count * n * el).buffer);
    } else {
      out = new Arr(a.count * n); const view = new DataView(bin.buffer, bin.byteOffset);
      for (let k = 0; k < a.count; k++) for (let c = 0; c < n; c++) {
        const p = off + k * stride + c * el;
        out[k * n + c] = el === 4 ? (Arr === Float32Array ? view.getFloat32(p, true) : view.getUint32(p, true)) : el === 2 ? view.getUint16(p, true) : view.getUint8(p);
      }
    }
    return new T.BufferAttribute(out, n, !!a.normalized);
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

  /* Load a .glb from a URL. Gives back a Group with the scene in it; group.bones maps bone names to bones. */
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
      return { m, pbr, map: await texture(json, bin, pbr.baseColorTexture, true), normalMap: await texture(json, bin, m.normalTexture, false) };
    }));
    const material = (i, colors, skinned) => {
      const d = mats[i] || { m: {}, pbr: {} }, f = d.pbr.baseColorFactor || [1, 1, 1, 1];
      return new T.MeshStandardMaterial({
        color: new T.Color(f[0], f[1], f[2]), map: d.map || null, normalMap: d.normalMap || null, vertexColors: colors,
        metalness: d.pbr.metallicFactor != null ? d.pbr.metallicFactor : 0, roughness: d.pbr.roughnessFactor != null ? d.pbr.roughnessFactor : 0.9,
        side: d.m.doubleSided ? T.DoubleSide : T.FrontSide,
      });
    };
    // the node tree: bones for skin joints, groups for the rest
    const jointSet = new Set(); (json.skins || []).forEach((s) => s.joints.forEach((j) => jointSet.add(j)));
    const nodes = (json.nodes || []).map((n, i) => {
      const o = jointSet.has(i) ? new T.Bone() : new T.Group();
      o.name = n.name || '';
      if (n.matrix) new T.Matrix4().fromArray(n.matrix).decompose(o.position, o.quaternion, o.scale);
      if (n.translation) o.position.fromArray(n.translation);
      if (n.rotation) o.quaternion.fromArray(n.rotation);
      if (n.scale) o.scale.fromArray(n.scale);
      return o;
    });
    (json.nodes || []).forEach((n, i) => (n.children || []).forEach((c) => nodes[i].add(nodes[c])));
    const skinned = [];
    (json.nodes || []).forEach((n, i) => {
      if (n.mesh == null) return;
      json.meshes[n.mesh].primitives.forEach((pr) => {
        const g = new T.BufferGeometry(), at = pr.attributes;
        g.setAttribute('position', accessor(json, bin, at.POSITION));
        if (at.TEXCOORD_0 != null) g.setAttribute('uv', accessor(json, bin, at.TEXCOORD_0));
        if (at.COLOR_0 != null) {
          // 8-bit colours from tools/geezer/repack.py are stored gamma-encoded (extras.srgb): turn them into linear RGB
          const c = accessor(json, bin, at.COLOR_0), srgb = (json.accessors[at.COLOR_0].extras || {}).srgb, n = c.count, out = new Float32Array(n * 3);
          const div = c.array instanceof Uint8Array ? 255 : c.array instanceof Uint16Array ? 65535 : 1;
          for (let k = 0; k < n; k++) for (let ch = 0; ch < 3; ch++) { const v = c.array[k * c.itemSize + ch] / div; out[k * 3 + ch] = srgb ? Math.pow(v, 2.2) : v; }
          g.setAttribute('color', new T.BufferAttribute(out, 3));
        }
        if (at._PAINT != null) g.setAttribute('paint', accessor(json, bin, at._PAINT));   // where the game paints his clothes
        if (pr.indices != null) g.setIndex(accessor(json, bin, pr.indices));
        if (at.NORMAL != null) g.setAttribute('normal', accessor(json, bin, at.NORMAL)); else g.computeVertexNormals();
        const isSkin = n.skin != null && at.JOINTS_0 != null;
        if (isSkin) {
          const jn = accessor(json, bin, at.JOINTS_0), w = accessor(json, bin, at.WEIGHTS_0);
          g.setAttribute('skinIndex', new T.Uint16BufferAttribute(Uint16Array.from(jn.array), 4));
          g.setAttribute('skinWeight', w.normalized || !(w.array instanceof Float32Array) ? new T.Float32BufferAttribute(Float32Array.from(w.array, (x) => x / (w.array instanceof Uint8Array ? 255 : 65535)), 4) : w);
        }
        const mat = material(pr.material, at.COLOR_0 != null, isSkin);
        const mesh = isSkin ? new T.SkinnedMesh(g, mat) : new T.Mesh(g, mat);
        nodes[i].add(mesh);
        if (isSkin) skinned.push([mesh, json.skins[n.skin]]);
      });
    });
    const group = new T.Group(), roots = (json.scenes && json.scenes[json.scene || 0] ? json.scenes[json.scene || 0].nodes : nodes.map((_, i) => i).filter((i) => !nodes[i].parent));
    roots.forEach((r) => group.add(nodes[r]));
    group.updateMatrixWorld(true);
    skinned.forEach(([mesh, s]) => {
      const ibm = s.inverseBindMatrices != null ? accessor(json, bin, s.inverseBindMatrices).array : null;
      const bones = s.joints.map((j) => nodes[j]);
      const inv = bones.map((_, k) => (ibm ? new T.Matrix4().fromArray(ibm, k * 16) : new T.Matrix4()));
      mesh.bind(new T.Skeleton(bones, inv), mesh.matrixWorld);
      mesh.frustumCulled = false;
    });
    group.bones = {}; nodes.forEach((o) => { if (o.isBone) group.bones[o.name] = o; });
    return group;
  };
})(window.PN = window.PN || {});
