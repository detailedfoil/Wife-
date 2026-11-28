# Keep only the accessors the mesh and skin use, and pack them into a fresh buffer.
import sys,json,struct
src,dst=sys.argv[1],sys.argv[2]
b=open(src,'rb').read()
l=struct.unpack('<I',b[12:16])[0]; j=json.loads(b[20:20+l]); bin_off=20+l+8; binb=b[bin_off:]
p=j['meshes'][0]['primitives'][0]
used=list(p['attributes'].values())+[p['indices'],j['skins'][0]['inverseBindMatrices']]
newacc=[];newbv=[];out=bytearray();remap={}
for k in used:
  a=dict(j['accessors'][k]); bv=j['bufferViews'][a['bufferView']]
  comp={5126:4,5125:4,5123:2,5121:1}[a['componentType']]; n={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']]
  size=a['count']*n*comp; stride=bv.get('byteStride',n*comp); start=bv.get('byteOffset',0)+a.get('byteOffset',0)
  data=bytearray()
  for i in range(a['count']): data+=binb[start+i*stride:start+i*stride+n*comp]
  name=[kk for kk,v in p['attributes'].items() if v==k]
  if name and name[0] in ('COLOR_0','WEIGHTS_0') and a['componentType']==5126:
    fl=struct.unpack('<%df'%(a['count']*n),bytes(data)); out8=bytearray()
    for i in range(a['count']):
      vals=[fl[i*n+c] for c in range(n)]
      if name[0]=='COLOR_0': vals=[min(1,max(0,v))**(1/2.2) for v in vals]  # store sRGB-ish in 8 bits, decoded below
      q=[int(round(min(1,max(0,v))*255)) for v in vals]
      if name[0]=='WEIGHTS_0': d=255-sum(q); q[q.index(max(q))]+=d
      while len(q)<4: q.append(255)
      out8+=bytes(q)
    data=out8; a['componentType']=5121; a['normalized']=True; a['type']='VEC4'; a.pop('min',None); a.pop('max',None)
    if name[0]=='COLOR_0': a['extras']={'srgb':True}
  while len(out)%4: out.append(0)
  newbv.append({'buffer':0,'byteOffset':len(out),'byteLength':len(data)}); out+=data
  a['bufferView']=len(newbv)-1; a.pop('byteOffset',None); remap[k]=len(newacc); newacc.append(a)
p['attributes']={kk:remap[v] for kk,v in p['attributes'].items()}; p['indices']=remap[p['indices']]
j['skins'][0]['inverseBindMatrices']=remap[j['skins'][0]['inverseBindMatrices']]
j['accessors']=newacc; j['bufferViews']=newbv; j['buffers']=[{'byteLength':len(out)}]
js=json.dumps(j,separators=(',',':')).encode()
while len(js)%4: js+=b' '
while len(out)%4: out.append(0)
glb=struct.pack('<III',0x46546C67,2,12+8+len(js)+8+len(out))+struct.pack('<II',len(js),0x4E4F534A)+js+struct.pack('<II',len(out),0x004E4942)+out
open(dst,'wb').write(glb)
print(len(glb))
