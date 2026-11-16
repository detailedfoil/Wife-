import numpy as np, math
def view_region(dist, el, tgt, aspect, fov_deg, lim, az=0.05, h=0.0):
    tx, ty, tz = tgt
    ce = math.cos(el)
    cam = np.array([tx + math.sin(az) * ce * dist, ty + math.sin(el) * dist, tz + math.cos(az) * ce * dist])
    f = np.array([tx, ty, tz]) - cam; f /= np.linalg.norm(f)
    r = np.cross(f, [0, 1, 0]); r /= np.linalg.norm(r); u = np.cross(r, f)
    t = math.tan(math.radians(fov_deg) / 2)
    def proj(x, y, z):
        d = np.stack([x - cam[0], y - cam[1], z - cam[2]], -1)
        zc = d @ f; xc = d @ r; yc = d @ u
        return xc / (zc * t * aspect), yc / (zc * t)
    return proj
