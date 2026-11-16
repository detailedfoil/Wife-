"""Write a layout JSON (spots, land ellipses, trees, rocks) into norppa/js/world.js.
   Numbers are replaced in place, so the grouping and comments in world.js stay as they are."""
import json, re, sys
lay, world = sys.argv[1], sys.argv[2]
L = json.load(open(lay)); s = open(world).read()
def f(v):
    t = ('%.2f' % v).rstrip('0').rstrip('.')
    return '0' if t in ('-0', '') else t
a = s.index('  const SPOTS = {'); b = s.index('\n  };\n', a)
block = s[a:b]
for k, v in L['spots'].items():
    pat = re.compile(r'(\b%s: )\[[^\]]*\]' % re.escape(k))
    if not pat.search(block): sys.exit('spot %s missing from SPOTS in world.js: add it to a group first' % k)
    block = pat.sub(lambda m: m.group(1) + '[' + ', '.join(f(x) for x in v) + ']', block, count=1)
s = s[:a] + block + s[b:]
names = ['d2', 'd3', 'd4']
for n, (cx, cz, rx, rz) in zip(names, L['land']['ell']):
    pat = re.compile(r'const %s = \(1 - Math\.hypot\(\(x [^)]*\) / [\d.]+, \(z [^)]*\) / [\d.]+\)\) \* [\d.]+;' % n)
    sx = '- %s' % f(cx) if cx >= 0 else '+ %s' % f(-cx); sz = '- %s' % f(cz) if cz >= 0 else '+ %s' % f(-cz)
    rep = 'const %s = (1 - Math.hypot((x %s) / %s, (z %s) / %s)) * %s;' % (n, sx, f(rx), sz, f(rz), f(min(rx, rz)))
    if not pat.search(s): sys.exit('land line %s not found' % n)
    s = pat.sub(rep, s, count=1)
t0 = s.index('    [[', s.index('function tree(')); t1 = s.index('      [-9.5, 7, 1.9]', t0)
near = L['trees'][:-7]
rows = ['[%s]' % ', '.join(f(x) for x in t) for t in near]
txt = '    [' + ', '.join(rows[:8]) + ',\n      ' + ', '.join(rows[8:]) + ',\n'
s = s[:t0] + txt + s[t1:]
r0 = s.index('    [[', s.index('a few boulders')); r1 = s.index('].forEach', r0)
s = s[:r0] + '    [' + ', '.join('[%s]' % ', '.join(f(x) for x in r) for r in L['rocks']) + s[r1:]
open(world, 'w').write(s)
print('ok')
