"""Tailor Dave's vest on his weighted body and sculpt the joggers in their seated rest pose."""

import numpy as np
from scipy.spatial.transform import Rotation
from scipy.interpolate import CubicSpline, PchipInterpolator


def smooth(low, high, a):
    t = np.clip((a - low) / (high - low), 0, 1)
    return t * t * (3 - 2 * t)


def unit(a):
    return a / np.maximum(np.linalg.norm(a, axis=-1, keepdims=True), 1e-12)


def torso(points, weight):
    x, y, z = points.T
    # Lower the weight of the belly into the lap and broaden its sides. Shoulders and wrists stay on the rig.
    bulk = np.exp(-(((y - 0.835) / 0.145) ** 2)) * weight
    q = points + np.stack(
        (0.13 * x * bulk, -0.027 * bulk * smooth(-0.10, 0.24, z), 0.052 * bulk * smooth(-0.20, 0.24, z)),
        axis=1,
    )
    return q


def band_top(theta):
    return 0.757 - 0.022 * np.cos(theta) - 0.007 * np.cos(2 * theta)


def normal_after_sculpt(p, n, weight):
    tangent = unit(np.cross(n, np.eye(3)[np.abs(n).argmin(axis=1)]))
    bitangent = np.cross(n, tangent)
    base = torso(p, weight)
    return unit(
        np.cross(torso(p + 0.0005 * tangent, weight) - base, torso(p + 0.0005 * bitangent, weight) - base)
    )


def vest_edges(p):
    x, y, z = p.T
    front = smooth(-0.12, 0.17, z)
    hem = 0.779 + 0.078 * front - 0.041 * (x / 0.35) ** 2 + 0.009 * np.sin(9 * x + 0.4)
    neck = 1.167 - 0.086 * front + 3.7 * x * x
    side = 0.25 - 0.057 * smooth(0.96, 1.21, y)
    armhole = 0.995 + 0.68 * np.maximum(side - np.abs(x), 0) + 1.7 * np.maximum(0.25 - np.abs(x), 0)
    return hem, neck, armhole


def vest(p, n, faces, joints, weights, torso_weight):
    # Subdivide just the torso patch. Clip the triangles to the neckline, armholes and curved hem.
    valid = (p[:, 1] > 0.70) & (p[:, 1] < 1.26) & (np.abs(p[:, 0]) < 0.365)
    f = faces[valid[faces].all(axis=1)]
    used, f = np.unique(f, return_inverse=True)
    f = f.reshape(-1, 3)
    bones = int(joints.max()) + 1
    skin = np.zeros((len(used), bones))
    np.add.at(skin, (np.arange(len(used))[:, None], joints[used]), weights[used])
    a = np.column_stack((p[used], n[used], skin, torso_weight[used]))
    edges = np.vstack((f[:, [0, 1]], f[:, [1, 2]], f[:, [2, 0]]))
    pairs, mid = np.unique(np.sort(edges, axis=1), axis=0, return_inverse=True)
    ab, bc, ca = np.split(mid + len(a), 3)
    a = np.vstack((a, a[pairs].mean(axis=1)))
    i, j, k = f.T
    f = np.vstack([np.column_stack(t) for t in [(i, ab, ca), (ab, j, bc), (ca, bc, k), (ab, bc, ca)]])
    x, y, z = a[:, :3].T
    hem, neck, hole = vest_edges(a[:, :3])
    # Deep scooped arms, with shoulder straps that run over the top onto the back.
    side_limit = 0.263 - 0.044 * smooth(0.99, 1.18, y)
    side = np.maximum(hole - y, side_limit - np.abs(x))
    d = np.minimum.reduce((y - hem, neck - y, side, 1.234 - y))
    # Only intersect the boundary triangles; the interior keeps its indexed topology.
    keep = d >= 0
    complete = f[keep[f].all(axis=1)].tolist()
    extra = []
    intersections = {}
    for tri in f[keep[f].any(axis=1) & ~keep[f].all(axis=1)]:
        poly = []
        for j, i in enumerate(tri):
            k = tri[(j + 1) % 3]
            if keep[i]:
                poly.append(i)
            if keep[i] != keep[k]:
                edge = tuple(sorted((int(i), int(k))))
                if edge not in intersections:
                    intersections[edge] = len(a) + len(extra)
                    extra.append(a[i] + (a[k] - a[i]) * (d[i] / (d[i] - d[k])))
                poly.append(intersections[edge])
        for j in range(1, len(poly) - 1):
            complete.append([poly[0], poly[j], poly[j + 1]])
    a = np.vstack((a, extra))
    used, ix = np.unique(complete, return_inverse=True)
    a = a[used]
    ix = ix.reshape(-1, 3)
    p, n, skin, w = a[:, :3], unit(a[:, 3:6]), a[:, 6:-1], a[:, -1]
    x, y, z = p.T
    hem, neck, hole = vest_edges(p)
    base = torso(p, w)
    # The edge turns out and under. Diagonal folds pull gently from the flanks.
    h = y - hem
    side = smooth(0.07, 0.29, np.abs(x))
    fold = side * (
        0.005 * np.exp(-(((h - 0.042 - 0.027 * np.sin(10 * x)) / 0.013) ** 2))
        + 0.004 * np.exp(-(((h - 0.10 + 0.11 * np.abs(x)) / 0.018) ** 2))
    )
    loft = 0.012 + 0.006 * np.exp(-(((h - 0.010) / 0.008) ** 2)) + fold
    q = base + n * loft[:, None]
    # Stitch an inner lip to every cut edge, to give the garment real thickness.
    edges, cnt = np.unique(
        np.sort(np.vstack((ix[:, [0, 1]], ix[:, [1, 2]], ix[:, [2, 0]])), axis=1), axis=0, return_counts=True
    )
    rim = edges[cnt == 1]
    boundary, local = np.unique(rim, return_inverse=True)
    inner = local.reshape(-1, 2) + len(q)
    rim_faces = np.vstack(
        (
            np.column_stack((rim[:, 0], rim[:, 1], inner[:, 0])),
            np.column_stack((rim[:, 1], inner[:, 1], inner[:, 0])),
        )
    )
    q = np.vstack((q, base[boundary] - 0.001 * n[boundary]))
    # Front artwork is a clean cotton swatch with the food stains from the original vest.
    uv = np.column_stack((0.5 + x / 0.67, np.clip((1.13 - y) / 0.316, 0, 1)))
    uv[z < 0.07] = [0.015, 0.5]
    uv = np.vstack((uv, uv[boundary]))
    distance = np.minimum(
        y - hem, np.minimum(neck - y, np.maximum(hole - y, 0.263 - 0.044 * smooth(0.99, 1.18, y) - np.abs(x)))
    )
    shade = (
        1
        - 0.10 * np.exp(-(((distance - 0.012) / 0.0028) ** 2))
        - 0.035 * np.exp(-(((distance - 0.020) / 0.004) ** 2))
    )
    color = np.repeat(shade[:, None], 3, axis=1)
    color = np.vstack((color, color[boundary] * 0.84))
    skin = np.vstack((skin, skin[boundary]))
    ji = np.argsort(-skin, axis=1)[:, :4]
    sw = np.take_along_axis(skin, ji, axis=1)
    # Capture the actual hem in the seated pose, including the resting spine tilt.
    hem_ids = np.flatnonzero(abs(h) < 0.0007)
    ring = q[hem_ids].copy()
    pivot = np.array([0.0, 0.84, -0.06])
    tilt = Rotation.from_rotvec([-0.12, 0, 0])
    spine = skin[hem_ids, 1:6].sum(axis=1)
    ring += (tilt.apply(ring - pivot) + pivot - ring) * spine[:, None]
    return (
        q,
        np.vstack((unit(n), n[boundary])),
        np.vstack((ix, rim_faces)),
        uv,
        color,
        ji,
        sw / sw.sum(axis=1, keepdims=True),
    ), ring


def smooth_union(a, b, k):
    return np.minimum(a, b) - np.maximum(k - np.abs(a - b), 0) ** 2 / (4 * k)


def ell(x, y, z, center, radii):
    return (np.sqrt(sum(((v - c) / r) ** 2 for v, c, r in zip((x, y, z), center, radii))) - 1) * min(radii)


def trouser_field(x, y, z):
    ax = np.abs(x)
    hip = ell(x, y, z, (0, 0.628, -0.018), (0.335, 0.158, 0.291))
    # A broad soft bridge of fabric under the folded belly, continuous with both thighs.
    lap = ell(x, y, z, (0, 0.643, 0.108), (0.345, 0.132, 0.218))
    body = smooth_union(hip, lap, 0.06)
    # Follow each thigh from the back of the chair to its kneecap.
    t = smooth(-0.11, 0.29, z)
    leg_x = 0.153 + 0.139 * t
    leg_y = 0.625 - 0.092 * t
    thigh = ell(ax - leg_x, y - leg_y, z, (0, 0, 0.092), (0.153, 0.141, 0.302))
    # Cloth stacks above a narrower knitted ankle band.
    height = np.clip((y - 0.38) / 0.16, 0, 1)
    shin_x = 0.335 - 0.043 * height
    ang = np.arctan2(z - 0.245, ax - shin_x)
    radial = np.hypot(ax - shin_x, (z - 0.245) * 0.96)
    cuff = 0.087 + 0.004 * np.cos(2 * ang)
    ridge = 0.014 * np.exp(-(((y - 0.454 - 0.018 * np.cos(ang + 0.5)) / 0.014) ** 2))
    ridge -= 0.010 * np.exp(-(((y - 0.484 - 0.021 * np.cos(ang + 0.5)) / 0.014) ** 2))
    radius = cuff + 0.039 * smooth(0.416, 0.45, y) + ridge + 0.004 * np.sin(6 * ang) * smooth(0.419, 0.446, y)
    shin = np.maximum(radial - radius, np.maximum(0.388 - y, y - 0.567))
    knee = ell(ax, y, z, (0.294, 0.527, 0.256), (0.142, 0.125, 0.151))
    leg = smooth_union(smooth_union(thigh, knee, 0.046), shin, 0.043)
    trousers = smooth_union(body, leg, 0.067)
    theta = np.arctan2(x / 0.346, (z - 0.044) / 0.320)
    # Gather the fleece into the ankle band. The knit stays clear of the sock stripes.
    opening = 0.089 + 0.077 * smooth(0.418, 0.498, y) + 0.48 * smooth(0.45, 0.55, y)
    ankle = radial - opening
    trousers = -smooth_union(-trousers, -ankle, 0.017)
    return np.maximum.reduce((trousers, y - band_top(theta) + 0.026, 0.389 - y))


def joggers():
    # One surface net vertex in each cell that crosses the fabric surface.
    step = 0.012
    origin = np.array([-0.54, 0.363, -0.37])
    grid = np.mgrid[0:91, 0:39, 0:73].transpose(1, 2, 3, 0) * step + origin
    field = trouser_field(*grid.transpose(3, 0, 1, 2))
    shifts = np.array([[i, j, k] for i in range(2) for j in range(2) for k in range(2)])
    corners = [field[i : i + 90, j : j + 38, k : k + 72] for i, j, k in shifts]
    active = (np.minimum.reduce(corners) <= 0) & (np.maximum.reduce(corners) > 0)
    cells = np.array(np.nonzero(active)).T
    values = np.stack([f[active] for f in corners], axis=1)
    count = np.zeros(len(cells))
    offset = np.zeros((len(cells), 3))
    for a in range(8):
        for bit in (1, 2, 4):
            b = a ^ bit
            if a > b:
                continue
            mask = (values[:, a] < 0) != (values[:, b] < 0)
            t = values[mask, a] / (values[mask, a] - values[mask, b])
            offset[mask] += shifts[a] + t[:, None] * (shifts[b] - shifts[a])
            count[mask] += 1
    q = origin + step * (cells + offset / count[:, None])
    index = np.full(active.shape, -1)
    index[active] = np.arange(len(q))
    faces = []
    for axis in range(3):
        crossing = (field < 0) != np.roll(field < 0, -1, axis=axis)
        ijk = np.array(np.nonzero(crossing)).T
        ijk = ijk[((ijk > 0) & (ijk < np.array(active.shape))).all(axis=1)]
        one, two = np.eye(3, dtype=int)[[(axis + 1) % 3, (axis + 2) % 3]]
        quad = np.stack([index[tuple((ijk - d).T)] for d in [one + two, two, one * 0, one]], axis=1)
        reverse = field[tuple(ijk.T)] > 0
        quad[reverse] = quad[reverse, ::-1]
        faces.extend([quad[:, [0, 1, 2]], quad[:, [0, 2, 3]]])
    n = unit(
        np.stack(
            [(trouser_field(*(q + d).T) - trouser_field(*(q - d).T)) for d in 0.0006 * np.eye(3)], axis=1
        )
    )
    f = np.vstack(faces)
    # Diagonal compression folds catch the light above each knee. Recalculate
    # the surface normals after draping so the ridges have a rounded highlight.
    x, y, z = q.T
    ax = np.abs(x)
    ang = np.arctan2(z - 0.245, ax - 0.331)
    cuff = 1 - smooth(0.415, 0.430, y)
    colors = np.array([0.555, 0.532, 0.55]) * (1 - 0.105 * cuff[:, None])
    rib = 1 - 0.04 * cuff * (0.5 + 0.5 * np.cos(ang * 28))
    fold = y - 0.461 - 0.024 * np.cos(ang + 0.6)
    gather = 1 - 0.10 * np.exp(-((fold / 0.008) ** 2)) * smooth(0.10, 0.24, z)
    front = smooth(0.14, 0.31, z)
    leg_angle = ang + 0.25 * np.sign(x)
    crease = y - 0.528 - 0.035 * np.sin(leg_angle)
    ridge = 0.008 * np.exp(-(((crease + 0.020) / 0.017) ** 2)) - 0.006 * np.exp(-((crease / 0.011) ** 2))
    q += n * (front * ridge)[:, None]
    colors *= (rib * gather * (1 - 0.065 * front * np.exp(-((crease / 0.011) ** 2))))[:, None]
    face_normal = np.cross(q[f[:, 1]] - q[f[:, 0]], q[f[:, 2]] - q[f[:, 0]])
    draped = np.zeros_like(n)
    for column in f.T:
        np.add.at(draped, column, face_normal)
    n = unit(n + 0.85 * unit(draped))
    return q, n, f, colors**2.2


def seated_joints():
    def matrix(position, rotation):
        m = np.eye(4)
        m[:3, 3] = position
        m[:3, :3] = rotation.as_matrix()
        return m

    matrices = [matrix([0, 0.70, -0.01], Rotation.identity())]
    for s in (1, -1):
        hip = np.array([s * 0.147, 0.636, -0.045])
        thigh = Rotation.from_rotvec([0, s * 0.3, 0]) * Rotation.from_rotvec([-1.25, 0, 0])
        knee = hip + thigh.apply([s * 0.059, -0.326, -0.016])
        matrices.extend([matrix(hip, thigh), matrix(knee, Rotation.from_rotvec([1.05, 0, 0]) * thigh)])
    for s, shin in [(1, matrices[2]), (-1, matrices[4])]:
        foot = shin.copy()
        foot[:3, 3] += shin[:3, :3] @ [0, -0.167, -0.014]
        matrices.append(foot)
    return np.array(matrices)


def grid_faces(rows, cols):
    i = (np.arange(rows)[:, None] * (cols + 1) + np.arange(cols)).flatten()
    return np.stack((i, i + cols + 1, i + 1, i + 1, i + cols + 1, i + cols + 2), axis=1).reshape(-1, 3)


def waistband():
    theta = np.linspace(-np.pi, np.pi, 111)
    sn, cs = np.sin(theta), np.cos(theta)
    ytop = band_top(theta)
    profiles = [
        (-0.008, -0.031),
        (0, -0.013),
        (-0.002, -0.002),
        (-0.008, 0.001),
        (-0.030, 0.002),
        (-0.041, 0),
        (-0.047, -0.006),
        (-0.046, -0.025),
    ]
    rings = []
    colors = []
    for h, r in profiles:
        rib = 0.0015 * np.cos(84 * theta)
        rings.append(np.stack(((0.346 + r + rib) * sn, ytop + h, 0.044 + (0.320 + r + rib) * cs), axis=1))
        colors.extend(
            np.tile((np.array([0.48, 0.453, 0.47]) * (1 + 0.10 * np.cos(h * 100))) ** 2.2, (len(theta), 1))
        )
    p = np.array(rings)
    n = unit(np.cross(np.gradient(p, axis=0), np.gradient(p, axis=1)))
    # Smooth the frame around the band from its top edge to its underside.
    return p.reshape(-1, 3), n.reshape(-1, 3), grid_faces(len(profiles) - 1, len(theta) - 1), np.array(colors)


def drawstring():
    chunks = []
    normals = []
    faces = []
    colors = []

    def cord(points, r, color):
        points = np.asarray(points)
        t = np.linspace(0, len(points) - 1, max(6, len(points) * 3))
        curve = CubicSpline(np.arange(len(points)), points, axis=0)
        centers = curve(t)
        tangent = unit(curve(t, 1))
        axis = unit(np.cross(tangent, np.array([0.0, 0.0, 1.0])))
        cross = np.cross(tangent, axis)
        ang = np.linspace(0, 2 * np.pi, 9)
        normal = (
            axis[:, None, :] * np.cos(ang)[None, :, None] + cross[:, None, :] * np.sin(ang)[None, :, None]
        )
        radii = np.full(len(t), r)
        radii[[0, -1]] = 0.35 * r
        p = centers[:, None, :] + radii[:, None, None] * normal
        offset = sum(len(c) for c in chunks)
        chunks.append(p.reshape(-1, 3))
        normals.append(normal.reshape(-1, 3))
        faces.append(offset + grid_faces(len(t) - 1, len(ang) - 1)[:, ::-1])
        colors.append(np.tile(np.array(color) ** 2.2, (p.size // 3, 1)))

    ivory = [0.96, 0.917, 0.84]
    for s in (-1, 1):
        cord(
            [
                (0, 0.707, 0.366),
                (0.019 * s, 0.715, 0.371),
                (0.044 * s, 0.700, 0.362),
                (0.048 * s, 0.681, 0.363),
                (0.032 * s, 0.684, 0.368),
                (0.009 * s, 0.703, 0.371),
            ],
            0.0058,
            ivory,
        )
        cord(
            [
                (0.007 * s, 0.704, 0.369),
                (0.013 * s, 0.687, 0.372),
                (0.015 * s, 0.665, 0.366),
                (0.023 * s, 0.646 + 0.007 * s, 0.361),
            ],
            0.0053,
            ivory,
        )
        cord(
            [(0.022 * s, 0.652 + 0.007 * s, 0.362), (0.023 * s, 0.643 + 0.007 * s, 0.361)],
            0.0072,
            [0.87, 0.837, 0.77],
        )
    cord([(-0.007, 0.702, 0.370), (0, 0.707, 0.375), (0.007, 0.710, 0.369)], 0.010, ivory)
    return np.vstack(chunks), np.vstack(normals), np.vstack(faces), np.vstack(colors)


def abdomen(hem):
    # The upper circumference follows the cut of the vest. The lower one slips
    # into the joggers, so neither edge can form a hard intersection in the lap.
    angles = np.arctan2(hem[:, 0], hem[:, 2] - 0.044)
    theta = np.linspace(-np.pi, np.pi, 129)
    t = np.linspace(0, 1, 29)[:, None]
    sn, cs = np.sin(theta), np.cos(theta)
    upper = np.stack([np.interp(theta, angles, c, period=2 * np.pi) for c in hem.T])
    lo = band_top(theta) - 0.016
    height = lo + (upper[1] + 0.014 - lo) * t
    fullness = 0.023 * np.sin(np.pi * t)
    # A small oval depression, with a softer lip beneath it.
    navel = np.exp(-((theta / 0.091) ** 2) - ((t - 0.45) / 0.106) ** 2)
    lower_lip = np.exp(-((theta / 0.107) ** 2) - ((t - 0.33) / 0.092) ** 2)
    disp = fullness - 0.014 * navel + 0.0035 * lower_lip - 0.009 * smooth(0.88, 1, t)
    x = (1 - t) * 0.339 * sn + t * 0.986 * upper[0] + disp * sn
    z = (1 - t) * (0.044 + 0.314 * cs) + t * (0.044 + 0.986 * (upper[2] - 0.044)) + disp * cs
    p = np.stack((x, height, z), axis=2)
    normals = unit(np.cross(np.gradient(p, axis=1), np.gradient(p, axis=0)))
    shade = 1 - 0.12 * navel - 0.045 * smooth(0.84, 1, t) - 0.045 * (1 - smooth(0, 0.20, t))
    skin = np.array([0.97, 0.68, 0.5]) ** 2.2
    return (
        p.reshape(-1, 3),
        normals.reshape(-1, 3),
        grid_faces(len(t) - 1, len(theta) - 1)[:, ::-1],
        (shade[:, :, None] * skin).reshape(-1, 3),
    )


def sports_socks():
    # A broad heel and low toe share a single surface with each ribbed ankle.
    # Section distances are measured from the ankle towards the toes.
    levels = np.linspace(0.256, 0.437, 63)
    heights = [0.256, 0.260, 0.270, 0.285, 0.301, 0.316, 0.332, 0.351, 0.370, 0.409, 0.432, 0.437]
    width = [0.008, 0.066, 0.081, 0.086, 0.084, 0.080, 0.073, 0.069, 0.069, 0.071, 0.070, 0.062]
    toe = [0.048, 0.166, 0.192, 0.203, 0.192, 0.161, 0.104, 0.077, 0.070, 0.070, 0.068, 0.063]
    heel = [0.014, 0.050, 0.065, 0.070, 0.072, 0.075, 0.074, 0.072, 0.069, 0.067, 0.065, 0.061]
    rx, fore, back = [PchipInterpolator(heights, c)(levels)[:, None] for c in [width, toe, heel]]
    theta = np.linspace(-np.pi, np.pi, 65)
    sin, cos = np.sin(theta), np.cos(theta)
    h = levels[:, None]
    rib = 0.0013 * smooth(0.328, 0.366, h) * np.cos(26 * theta)
    lateral = (rx + rib) * sin
    length = (fore - back) / 2 + ((fore + back) / 2 + rib) * cos
    section = h - 0.0016 * np.cos(theta + 0.45)
    stripe = np.maximum(
        smooth(0.348, 0.350, section) * (1 - smooth(0.359, 0.361, section)),
        smooth(0.371, 0.373, section) * (1 - smooth(0.382, 0.384, section)),
    )
    sole = 1 - smooth(0.259, 0.274, h)
    color = (1 - stripe[:, :, None]) * np.array([0.96, 0.95, 0.93]) ** 2.2 + stripe[:, :, None] * np.array(
        [0.24, 0.38, 0.71]
    ) ** 2.2
    toe_seam = 0.309 + 0.008 * (1 - cos)
    stitch = 0.045 * np.exp(-(((h - toe_seam) / 0.0026) ** 2)) * smooth(0.58, 0.91, cos)
    color *= (1 - 0.09 * sole - stitch)[:, :, None]
    chunks = []
    normals = []
    indices = []
    colors = []
    joints = []
    for side in [1, -1]:
        # Turn each foot out with the splayed knees.
        yaw = side * 0.34
        x = side * 0.337 + np.cos(yaw) * lateral + np.sin(yaw) * length
        z = 0.238 - np.sin(yaw) * lateral + np.cos(yaw) * length
        q = np.stack((x, np.broadcast_to(h, x.shape), z), axis=2)
        n = unit(np.cross(np.gradient(q, axis=1), np.gradient(q, axis=0)))
        ix = grid_faces(len(levels) - 1, len(theta) - 1)[:, ::-1]
        # The small flat sole closes underneath, just above the carpet.
        ix = np.vstack(
            (
                ix,
                np.column_stack(
                    (
                        np.zeros(len(theta) - 2, dtype=int),
                        np.arange(1, len(theta) - 1),
                        np.arange(2, len(theta)),
                    )
                ),
            )
        )
        indices.append(ix + sum(len(c) for c in chunks))
        chunks.append(q.reshape(-1, 3))
        normals.append(n.reshape(-1, 3))
        colors.append(color.reshape(-1, 3))
        ji = np.zeros((q.size // 3, 4), dtype=int)
        ji[:, 0] = 5 if side == 1 else 6
        joints.append(ji)
    return np.vstack(chunks), np.vstack(normals), np.vstack(indices), np.vstack(colors), np.vstack(joints)
