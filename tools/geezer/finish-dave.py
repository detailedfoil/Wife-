"""Finish the rig from build-dave.mjs using the owner's square T-pose reference.
Run: python finish-dave.py body.glb dave.glb (Pillow, NumPy, SciPy).
The head and ears are closed volumes attached to the original head joint.
"""
import io
import json
import struct
import sys
from pathlib import Path

import numpy as np
import clothing
from PIL import Image
from scipy.interpolate import PchipInterpolator
from scipy.ndimage import map_coordinates

source, output = map(Path, sys.argv[1:])
portrait = Path(__file__).with_name('dave-face.webp')
raw = source.read_bytes()
json_size = struct.unpack_from('<I', raw, 12)[0]
doc = json.loads(raw[20:20 + json_size])
data = bytearray(raw[28 + json_size:])
photo = np.asarray(Image.open(portrait).convert('RGB'), dtype=float)


def view(payload):
    data.extend(bytes(-len(data) % 4))
    doc['bufferViews'].append({'buffer': 0, 'byteOffset': len(data), 'byteLength': len(payload)})
    data.extend(payload)
    return len(doc['bufferViews']) - 1


def accessor(values, kind, component, bounds=False):
    item = {'type': kind, 'componentType': component, 'count': len(values),
            'bufferView': view(values.tobytes())}
    if bounds:
        item.update(min=values.min(axis=0).tolist(), max=values.max(axis=0).tolist())
    doc['accessors'].append(item)
    return len(doc['accessors']) - 1


def read(index, dtype, size):
    a = doc['accessors'][index]
    offset = doc['bufferViews'][a['bufferView']].get('byteOffset', 0) + a.get('byteOffset', 0)
    el = np.dtype(dtype).itemsize
    stride = doc['bufferViews'][a['bufferView']].get('byteStride', size * el)
    return np.ndarray((a['count'], size), dtype, buffer=bytes(data), offset=offset, strides=(stride, el))


body = doc['meshes'][0]['primitives'][0]
pos = read(body['attributes']['POSITION'], '<f4', 3)
old_index = body['indices']
dtype = '<u2' if doc['accessors'][old_index]['componentType'] == 5123 else '<u4'
tris = read(old_index, dtype, 1).reshape(-1, 3)
# The new jaw overlaps the retained neck. The wrists overlap the new prop grips.
x, y, z = pos.T
outside_wrist = (abs(x) - .61) * .76 + (.895 - y) * .65
keep = (y < 1.252 + .027*clothing.smooth(.13,.21,abs(x))) & ~((abs(x) > .55) & (outside_wrist > .014))
# Retain the torso for tailoring. The trousers and socks are cut in the sitting pose.
keep &= y > .65
remaining = tris[keep[tris].all(axis=1)]
used, indices = np.unique(remaining.flatten(), return_inverse=True)
# Repack only the retained body vertices and the original inverse bind matrices.
attributes = {}
for name, index in body['attributes'].items():
    a = doc['accessors'][index]
    number = {5123: '<u2', 5126: '<f4'}[a['componentType']]
    attributes[name] = (read(index, number, int(a['type'][-1]))[used], a['type'], a['componentType'])
# Tuck the old jaw attachment into the new chin, leaving the shoulders intact.
neck_pos = attributes['POSITION'][0]
neck = np.clip((neck_pos[:, 1] - 1.197) / 0.052, 0, 1)
neck *= np.clip((0.20 - abs(neck_pos[:, 0])) / 0.05, 0, 1)
neck_pos[:, 0] *= 1 - 0.46 * neck
neck_pos[:, 2] = -0.07 + (neck_pos[:, 2] + 0.07) * (1 - 0.44 * neck)
neck_pos[:, 1] += 0.035 * neck
bind = read(doc['skins'][0]['inverseBindMatrices'], '<f4', 16)
data.clear()
doc['accessors'] = []
doc['bufferViews'] = []
doc['skins'][0]['inverseBindMatrices'] = accessor(bind, 'MAT4', 5126)
mesh_pos = attributes['POSITION'][0]
mesh_normal = attributes['NORMAL'][0]
ji, sw = attributes['JOINTS_0'][0], attributes['WEIGHTS_0'][0]
# The abdomen rests above the hips while the legs bend independently below the band.
waist = (mesh_pos[:, 1] > 0.62) & (mesh_pos[:, 1] < 0.79)
remaining_weight = clothing.smooth(0.75, 0.79, mesh_pos[waist, 1])
for row, factor in zip(np.nonzero(waist)[0], remaining_weight):
    w = np.bincount(ji[row], weights=sw[row] * factor, minlength=len(doc['skins'][0]['joints']))
    w[0] += 1 - factor
    slots = np.argsort(-w)[:4]
    ji[row], sw[row] = slots, w[slots] / w[slots].sum()
torso_weight = np.sum((ji < 4) * sw, axis=1)
shirt, hem = clothing.vest(mesh_pos, mesh_normal, indices.reshape(-1, 3), ji, sw, torso_weight)
sculpt = clothing.torso(mesh_pos, torso_weight)
arm_x = abs(mesh_pos[:, 0])
fullness = 0.012 * clothing.smooth(0.30, 0.39, arm_x) * (1 - clothing.smooth(0.53, 0.60, arm_x))
sculpt += mesh_normal * fullness[:, None]
attributes['POSITION'] = (sculpt.astype('<f4'), 'VEC3', 5126)
attributes['NORMAL'] = (
    clothing.normal_after_sculpt(mesh_pos, mesh_normal, torso_weight).astype('<f4'),
    'VEC3',
    5126,
)
for name, params in attributes.items():
    body['attributes'][name] = accessor(*params, bounds=name == 'POSITION')
# The tailored seated abdomen takes over below the vest. Retain the arms and shoulders.
tri = indices.reshape(-1, 3)
covered = (mesh_pos[:, 1] < 0.93) & (mesh_pos[:, 1] > 0.30) & (abs(mesh_pos[:, 0]) < 0.395)
body['indices'] = accessor(tri[~covered[tri].all(axis=1)].flatten().astype('<u2'), 'SCALAR', 5123)

profile_y = [10, 12, 18, 30, 54, 86, 126, 165, 195, 228, 262, 294, 322, 350, 379, 399, 416, 424, 428]
profile_x = [0, 20, 45, 72, 98, 121, 141, 154, 168, 183, 192, 193, 188, 176, 154, 123, 78, 43, 0]
width = PchipInterpolator(profile_y, profile_x)


def surface(u, v, ear):
    theta = (u - 0.5) * (2 * np.pi)
    lat = np.pi * v
    front = np.cos(theta)
    if ear:
        py = 202 - 53 * np.cos(lat)
        px = 231 + ear * 173 + 47 * np.sin(lat) * np.sin(theta)
        depth = -0.046 + 0.043 * np.sin(lat) * front
        depth -= (
            0.015
            * np.exp(-(((px - (231 + ear * 189)) / 18) ** 2) - ((py - 205) / 24) ** 2)
            * np.maximum(front, 0)
        )
    else:
        py = 219 - 209 * np.cos(lat)
        radius = width(py.clip(10, 428))
        px = 231 + radius * np.sin(theta)
        depth = -0.039 + 0.00105 * radius * front
        # Cheek pads, chin, eye sockets and fleshy lids, brow arches, bridge and nasal tip.
        # All relief fades into the side of the skull.
        ax = abs(px - 231)
        def pad(cx, cy, rx, ry, height):
            return height * np.exp(-((ax - cx) / rx)**2 - ((py - cy) / ry)**2)
        relief = (pad(93, 230, 62, 56, .037) + pad(0, 337, 71, 41, .024)
                  - pad(60, 143, 49, 43, .025) + pad(59, 146, 37, 26, .035)
                  + pad(63, 123, 45, 19, .019) + pad(66, 74, 51, 18, .033)
                  + pad(0, 147, 23, 62, .046) + pad(0, 195, 48, 38, .087)
                  + pad(0, 244, 83, 24, .016))
        depth += relief * np.maximum(front, 0)**2
    xyz = np.stack(((px - 231) * .00116, 1.716 - (py - 10) * .00116 - 1.30, depth + .075), axis=-1)
    return xyz, px, py, front


head = next(i for i, n in enumerate(doc['nodes']) if n['name'] == 'mixamorig:Head')
for ear in (0, -1, 1):
    cols, rows = (96, 72) if not ear else (36, 28)
    u, v = np.meshgrid(np.linspace(0, 1, cols + 1), np.linspace(0, 1, rows + 1))
    xyz, _, _, _ = surface(u, v, ear)
    # Analytic tangents keep the light continuous across the longitude seam.
    vv = v.clip(.0005, .9995)
    du = surface(u + .0001, vv, ear)[0] - surface(u - .0001, vv, ear)[0]
    dv = surface(u, vv + .0001, ear)[0] - surface(u, vv - .0001, ear)[0]
    normals = np.cross(dv, du)
    normals /= np.maximum(1.e-12, np.linalg.norm(normals, axis=2, keepdims=True))
    a = (np.arange(rows)[:, None] * (cols + 1) + np.arange(cols)).flatten()
    idx = np.stack((a, a + cols + 1, a + 1, a + 1, a + cols + 1, a + cols + 2), axis=1)
    # Bake the reference onto the front. Transition to an uninterrupted skin tone at the rear.
    tw, th = (1024, 512) if not ear else (256, 128)
    tu, tv = np.meshgrid((np.arange(tw) + .5) / tw, (np.arange(th) + .5) / th)
    _, px, py, facing = surface(tu, tv, ear)
    if ear:
        px = np.clip(px, 15, 447)
        center = 231 + ear * 173
        px = center + (px - center) * .93
        py = 202 + (py - 202) * .95
    else:
        px = 231 + (px - 231) * .993
        py = np.clip(py, 13, 424)
    color = np.stack([map_coordinates(photo[:, :, i], [py, px], order=1, mode='nearest') for i in range(3)], axis=2)
    skin = np.array([242, 169, 125])
    alpha = np.clip((facing + .02) / .48, 0, 1)
    alpha = (alpha * alpha * (3 - 2 * alpha))[:, :, None]
    color = skin + (color - skin) * alpha
    # Lift the baked shadows slightly so Dave can pick up the lounge lighting.
    color = np.clip(color * .94 + skin * .06, 0, 255).astype('uint8')
    jpeg = io.BytesIO()
    Image.fromarray(color).save(jpeg, format='JPEG', quality=91, subsampling=0)
    images = doc.setdefault('images', [])
    images.append({'bufferView': view(jpeg.getvalue()), 'mimeType': 'image/jpeg'})
    textures = doc.setdefault('textures', [])
    textures.append({'source': len(images) - 1})
    doc['materials'].append({'name': 'Dave skin', 'pbrMetallicRoughness': {
        'baseColorTexture': {'index': len(textures) - 1}, 'metallicFactor': 0, 'roughnessFactor': .94}})
    primitive = {'attributes': {
        'POSITION': accessor(xyz.reshape(-1, 3).astype('<f4'), 'VEC3', 5126, True),
        'NORMAL': accessor(normals.reshape(-1, 3).astype('<f4'), 'VEC3', 5126),
        'TEXCOORD_0': accessor(np.stack((u, v), axis=-1).reshape(-1, 2).astype('<f4'), 'VEC2', 5126)},
        'indices': accessor(idx.flatten().astype('<u2'), 'SCALAR', 5123), 'material': len(doc['materials']) - 1}
    doc['meshes'].append({'primitives': [primitive]})
    doc['nodes'][head].setdefault('children', []).append(len(doc['nodes']))
    doc['nodes'].append({'name': 'Ear' if ear else 'Face', 'mesh': len(doc['meshes']) - 1})


def clothing_mesh(name, xyz, normals, triangles, colors, material, *, uv=None, joint=None, weight=None, skin=None, parent=None):
    at = {'POSITION': accessor(xyz.astype('<f4'), 'VEC3', 5126, True),
          'NORMAL': accessor(normals.astype('<f4'), 'VEC3', 5126),
          'COLOR_0': accessor((colors.clip(0,1)*255).round().astype('u1'), 'VEC3', 5121)}
    doc['accessors'][at['COLOR_0']]['normalized'] = True
    if uv is not None:
        at['TEXCOORD_0'] = accessor(uv.astype('<f4'),'VEC2',5126)
    if skin is not None:
        at['JOINTS_0'] = accessor(joint.astype('u1'),'VEC4',5121)
        packed = (weight * 255).round().astype('i2')
        packed[np.arange(len(packed)),weight.argmax(axis=1)] += 255-packed.sum(axis=1)
        at['WEIGHTS_0'] = accessor(packed.astype('u1'),'VEC4',5121)
        doc['accessors'][at['WEIGHTS_0']]['normalized'] = True
    large = len(xyz)>65535
    ix = accessor(triangles.flatten().astype('<u4' if large else '<u2'),'SCALAR',5125 if large else 5123)
    doc['meshes'].append({'name': name, 'primitives':[{'attributes':at, 'indices':ix, 'material':material}]})
    node = {'name':name, 'mesh':len(doc['meshes'])-1}
    if skin is not None:
        node['skin'] = skin
    items = doc['scenes'][0]['nodes'] if parent is None else doc['nodes'][parent].setdefault('children', [])
    items.append(len(doc['nodes']))
    doc['nodes'].append(node)


swatch = io.BytesIO()
Image.open(Path(__file__).with_name('dave-vest.webp')).convert('RGB').save(swatch, format='JPEG', quality=93)
doc['images'].append({'bufferView': view(swatch.getvalue()), 'mimeType': 'image/jpeg'})
doc['textures'].append({'source': len(doc['images']) - 1})
doc['materials'].append(
    {
        'name': 'Cotton vest',
        'doubleSided': True,
        'pbrMetallicRoughness': {
            'baseColorTexture': {'index': len(doc['textures']) - 1},
            'roughnessFactor': 1,
            'metallicFactor': 0,
        },
    }
)
q, n, f, uv, color, ji, sw = shirt
clothing_mesh('Vest', q, n, f, color, len(doc['materials']) - 1, uv=uv, joint=ji, weight=sw, skin=0)

doc['materials'].append(
    {'name': 'Tracksuit fleece', 'pbrMetallicRoughness': {'roughnessFactor': 1, 'metallicFactor': 0}}
)
fabric = len(doc['materials']) - 1
q, n, f, color = clothing.joggers()
# Keep the fleece rigged. Its rest surface was cut with the knees already bent.
legs = ['Hips', 'LeftUpLeg', 'LeftLeg', 'RightUpLeg', 'RightLeg', 'LeftFoot', 'RightFoot']
nodes = [next(i for i, n in enumerate(doc['nodes']) if n['name'] == 'mixamorig:' + b) for b in legs]
matrices = clothing.seated_joints()
ibm = accessor(np.linalg.inv(matrices).transpose(0, 2, 1).reshape(-1, 16).astype('<f4'), 'MAT4', 5126)
doc['skins'].append({'name': 'Seated joggers', 'joints': nodes, 'inverseBindMatrices': ibm})
x, y, z = q.T
leg = clothing.smooth(0.01, 0.21, z) * clothing.smooth(0.045, 0.19, abs(x))
shin = 1 - clothing.smooth(0.46, 0.58, y)
sw = np.column_stack((1 - leg, leg * (1 - shin), leg * shin, np.zeros(len(q))))
ji = np.column_stack((np.zeros(len(q)), np.where(x > 0, 1, 3), np.where(x > 0, 2, 4), np.zeros(len(q))))
clothing_mesh('Joggers', q, n, f, color, fabric, joint=ji, weight=sw, skin=len(doc['skins']) - 1)
q, n, f, color, ji = clothing.sports_socks()
sw = np.zeros(ji.shape)
sw[:, 0] = 1
clothing_mesh('Striped socks', q, n, f, color, fabric, joint=ji, weight=sw, skin=len(doc['skins']) - 1)
q, n, f, color = clothing.abdomen(hem)
clothing_mesh('Belly', q - [0, 0.70, -0.01], n, f, color, fabric, parent=nodes[0])
q, n, f, color = clothing.waistband()
clothing_mesh('Waistband', q - [0, 0.70, -0.01], n, f, color, fabric, parent=nodes[0])
q, n, f, color = clothing.drawstring()
clothing_mesh('Cotton drawcord', q - [0, 0.70, -0.01], n, f, color, fabric, parent=nodes[0])

data.extend(bytes(-len(data) % 4))
doc['buffers'][0]['byteLength'] = len(data)
header = json.dumps(doc, separators=(',', ':')).encode()
header += b' ' * (-len(header) % 4)
output.write_bytes(
    struct.pack('<4sII', b'glTF', 2, 28 + len(header) + len(data))
    + struct.pack('<I4s', len(header), b'JSON')
    + header
    + struct.pack('<I4s', len(data), b'BIN\0')
    + data
)
