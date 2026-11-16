import json, math, sys
import numpy as np
import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt
from shapely.geometry import Polygon, Point, LineString
from shapely import affinity
import os
HERE = os.path.dirname(os.path.abspath(__file__))
feet = json.load(open(os.path.join(HERE, 'feet.json')))
L = json.load(open(sys.argv[1]))
spots, land, trees, rocks = L['spots'], L['land'], L['trees'], L['rocks']
HOME, BALL, HOLE, DEN, DENH = (0.15, 0.3), (-0.95, 1.35), (2.0, -2.9), (-2.45, -3.2), 0.62
def landD(x, z):
    ds = [(z - (land['shoreB'] + land['shoreK'] * x)) / 1.085]
    for e in land['ell']:
        cx, cz, rx, rz = e; ds.append((1 - np.hypot((x - cx) / rx, (z - cz) / rz)) * rx)
    return np.maximum.reduce(ds)
def foot(id, s):
    x0, x1, z0, z1, h = feet[id]
    p = Polygon([(x0, z0), (x1, z0), (x1, z1), (x0, z1)])
    th = s[2]
    pts = [(s[0] + x * math.cos(th) + z * math.sin(th), s[1] - x * math.sin(th) + z * math.cos(th)) for x, z in p.exterior.coords]
    return Polygon(pts), h
F = {k: foot(k, v) for k, v in spots.items() if k in feet}
# fixed obstacles
f = (math.sin(DENH), math.cos(DENH))
obst = {
  'SEAL': Point(HOME).buffer(1.15), 'BALL': Point(BALL).buffer(0.5), 'HOLE': Point(HOLE).buffer(1.45),
  'DEN': Point(DEN).buffer(2.3),
  'DOOR': LineString([(DEN[0] + f[0] * 2.0, DEN[1] + f[1] * 2.0), (DEN[0] + f[0] * 4.2, DEN[1] + f[1] * 4.2)]).buffer(1.3),
  'PATHHOLE': LineString([HOME, HOLE]).buffer(0.55),
}
for i, t in enumerate(trees): obst['tree%d' % i] = Point(t[0], t[1]).buffer(0.75 * t[2])
for i, r in enumerate(rocks): obst['rock%d' % i] = Point(r[0], r[1]).buffer(r[2] * 1.3)
allow = set(tuple(sorted(p)) for p in L.get('allow', []))
issues = []
ids = list(F)
GAP = 0.15
for i in range(len(ids)):
    a = ids[i]; pa = F[a][0]
    for j in range(i + 1, len(ids)):
        b = ids[j]
        if tuple(sorted((a, b))) in allow: continue
        if pa.buffer(GAP).intersects(F[b][0]): issues.append('%s x %s (%.2f)' % (a, b, pa.buffer(GAP).intersection(F[b][0]).area))
    for k, o in obst.items():
        if (a == 'matto' and k in ('SEAL', 'PATHHOLE', 'BALL')) : continue
        if pa.intersects(o): issues.append('%s x %s (%.2f)' % (a, k, pa.intersection(o).area))
    c = pa.centroid
    want = L.get('where', {}).get(a)
    on = landD(c.x, c.y) > 0.15
    allin = all(landD(x, z) > 0.05 for x, z in pa.exterior.coords)
    if want == 'land' and not allin: issues.append('%s not fully on land' % a)
    if want == 'ice' and on: issues.append('%s should be on ice' % a)
for k, o in obst.items():
    if k.startswith('tree'):
        pass
print('%d items, %d issues' % (len(F), len(issues)))
for s in issues: print('  ', s)
# plot
fig, ax = plt.subplots(figsize=(12, 13))
xs = np.linspace(-14, 14, 281); zs = np.linspace(-18, 8, 261); X, Z = np.meshgrid(xs, zs)
ax.contourf(X, Z, landD(X, Z), levels=[0, 99], colors=['#e3ead9']); ax.contour(X, Z, landD(X, Z), levels=[0], colors=['#7a9a6a'])
for k, o in obst.items():
    xx, zz = o.exterior.xy; ax.fill(xx, zz, color='#bbbbbb' if not k.startswith('tree') else '#5a8a6a', alpha=0.5)
    if not k.startswith(('tree', 'rock')): ax.text(o.centroid.x, o.centroid.y, k, fontsize=7, color='#444', ha='center')
for k, (p, h) in F.items():
    xx, zz = p.exterior.xy
    ax.fill(xx, zz, color='#e05050' if h > 1.7 else ('#e0a040' if h > 1.0 else '#5080e0'), alpha=0.6)
    ax.text(p.centroid.x, p.centroid.y, k, fontsize=7.5, ha='center', va='center', weight='bold')
ax.set_xlim(-12, 12); ax.set_ylim(6, -16); ax.set_aspect('equal'); ax.grid(alpha=.3)
ax.set_title('red tall >1.7, orange medium, blue low. camera at bottom (+z) looking up the page')
plt.savefig(sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, 'plan.png'), dpi=65, bbox_inches='tight')
# optional camera overlay: env CAM="dist,el,tx,ty,tz,aspect,fov"
import os
if os.environ.get('CAM'):
    from wedge import view_region
    dist, el, tx, ty, tz, aspect, fov = map(float, os.environ['CAM'].split(','))
    lim = (-0.9, 0.9, -0.7, 0.56) if aspect < 0.8 else (-0.88, 0.88, -0.58, 0.42)
    proj = view_region(dist, el, (tx, ty, tz), aspect, fov, lim)
    px, py = proj(X, np.zeros_like(X), Z)
    inside = (px > lim[0]) & (px < lim[1]) & (py > lim[2]) & (py < lim[3])
    ax.contour(X, Z, inside.astype(float), levels=[0.5], colors=['purple'], linewidths=2)
    px2, py2 = proj(X, np.full_like(X, 1.5), Z)
    inside2 = (px2 > lim[0]) & (px2 < lim[1]) & (py2 > lim[2]) & (py2 < lim[3])
    ax.contour(X, Z, inside2.astype(float), levels=[0.5], colors=['magenta'], linewidths=1, linestyles='dashed')
    plt.savefig(sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, 'plan.png'), dpi=65, bbox_inches='tight')
