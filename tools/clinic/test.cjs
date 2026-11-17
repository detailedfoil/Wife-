/* node tools/clinic/test.cjs — state, prices, inheritance, save compatibility.
   Optional rig/texture checks use @napi-rs/canvas when available. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '../../norppa');
const data = new Map();
const ctx = vm.createContext({console, Date, Math, localStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)}, btoa:s=>Buffer.from(s,'binary').toString('base64'),atob:s=>Buffer.from(s,'base64').toString('binary')});
ctx.window=ctx;
const load = p => vm.runInContext(fs.readFileSync(path.join(root,p),'utf8'),ctx,{filename:p});
['js/data.js','js/appearance.js','js/sim.js'].forEach(load);
const {Appearance:A,Sim:S}=ctx.PN;
const clone=v=>JSON.parse(JSON.stringify(v));
const now=1794900000000;
const state=S.newState(now); state.maxLevel=30; state.coins=50000; state.name='Pulla';
const natural=clone(state.birthAppearance), originalCoins=state.coins;
assert.deepEqual(clone(state.appearance),natural);
assert.notEqual(state.appearance,state.birthAppearance);
const pink={...state.appearance,coat:'pink',headSize:1.2,size:1.25};
const quote=A.quote(state,pink);
assert.equal(quote.lines[0].cost,10000);
assert.equal(state.coins,originalCoins,'preview cannot charge');
assert.ok(A.purchase(state,'main',pink,now).ok);
assert.equal(state.coins,originalCoins-quote.total);
assert.deepEqual(clone(state.birthAppearance),natural,'surgery cannot change inherited traits');
assert.equal(A.purchase(state,'main',pink,now).why,'unchanged','double submission does not charge');
let last=-1;
for(let v=natural.headSize;v<=1.2+0.001;v+=.01){const q=A.shapeCost({...natural,headSize:v},natural,['headSize'],4000);assert.ok(q>=last);last=q;}
assert.equal(A.shapeCost({...natural,headSize:1.2},natural,['headSize'],4000),8000);
let matches=0; const coats=new Set(), bodies=new Set();
for(let i=0;i<2000;i++){
 const born=A.natural(now+i*7919,state.birthAppearance);
 for(const k of ['coat','belly','marking','eye','nose']) assert.ok(!A.special(born[k]));
 assert.ok(born.size>=.94&&born.size<=1.06); assert.ok(born.headSize>=.96&&born.headSize<=1.05);
 if(born.coat===natural.coat) matches++;
 coats.add(born.coat);bodies.add(born.bodyWidth);
}
assert.equal(coats.size,6);assert.ok(bodies.size>5);assert.ok(matches>1200&&matches<1700,'offspring often resemble natural parent');
const pup=S.addPup(state,now+100,'Lumi');
assert.notEqual(pup.appearance.coat,'pink');
const pupBirth=clone(pup.birthAppearance);
assert.ok(A.purchase(state,pup.id,{...pup.appearance,coat:'mint'},now).ok);
pup.ready=true;
assert.ok(S.graduatePup(state,0,now).ok);
assert.deepEqual(clone(state.family[0].birthAppearance),pupBirth);
assert.equal(state.family[0].appearance.coat,'mint');
assert.equal(A.purchase(state,'family:0',pink,now).why,'away');
state.family[0].arriveAt=now-100;state.family[0].leaveAt=now+100000;
state.coins=50000;
assert.ok(A.purchase(state,'family:0',{...state.family[0].appearance,nose:'rose'},now).ok);
const before=state.coins;
const restoreQuote=A.quote(state,natural);
assert.ok(restoreQuote.total>0,'restoring a confirmed makeover is another paid procedure');
assert.ok(A.purchase(state,'main',natural,now).ok);
assert.equal(state.coins,before-restoreQuote.total,'restoration charges the itemised quote');
assert.deepEqual(clone(state.appearance),natural);
state.coins=1;
const unchanged=JSON.stringify(state);
assert.equal(A.purchase(state,'main',pink,now).why,'coins');
assert.equal(JSON.stringify(state),unchanged,'failed transaction is atomic');
const locked=S.newState(now);assert.equal(A.purchase(locked,'main',pink,now).why,'locked');
const old={createdAt:now,name:'Legacy',stats:{food:90},coins:346,pups:[{id:1,wear:{}}],family:[{name:'Old pup',wear:{},fate:'grown'}]};
S.migrate(old);
assert.deepEqual(clone(old.appearance),clone(A.defaults)); assert.equal(old.coins,346);
assert.equal(old.pups[0].appearance.coat,'original');
assert.equal(old.family[0].appearance.coat,'original');
assert.ok(S.save(state));assert.deepEqual(clone(S.load().birthAppearance),natural);
assert.deepEqual(clone(S.importCode(S.exportCode(state)).appearance),clone(state.appearance));
assert.equal(A.normalize({size:Infinity,headSize:100,coat:'bad'}).size,1);
assert.equal(A.normalize({headSize:100}).headSize,1.2);
console.log('PASS: atomic purchases, level/coin gates, monotonic prices, paid restoration, 2,000 natural births, inheritance, family transitions, legacy migration and save/import round trip.');
try{
 const {createCanvas}=require('@napi-rs/canvas');
 ctx.document={createElement:(name)=>{if(name!=='canvas')throw Error(name);const c=createCanvas(1,1);c.addEventListener=()=>{};return c;}};
 ['vendor/three.min.js','js/props.js','js/seal.js'].forEach(load);
 const Seal=ctx.PN.Seal;
 const one=new Seal({stage:2,appearance:state.appearance}),two=new Seal({stage:2,appearance:state.appearance});
 const oldMap=one.body.material.map;
 const baseColor=two.eyeMaterial.color.getHex();
 one.setAppearance(pink);one.update(.016,1,()=>0);
 assert.notEqual(one.body.material.map,oldMap);
 assert.notEqual(one.body.material,two.body.material,'per-seal materials');
 assert.equal(two.eyeMaterial.color.getHex(),baseColor);
 const texture=one.body.material.map;
 one.setAppearance({...pink,headSize:1.1});assert.equal(one.body.material.map,texture,'shape adjustments reuse textures');
 for(const stage of [0,1,2]) for(const headSize of [.85,1.2]) for(const bodyWidth of [.85,1.2]){
   one.setStage(stage);one.setAppearance({...pink,headSize,bodyWidth,bodyLength:1.2,eyeSize:1.2,noseSize:1.3});
   one.setWear('neck','scarf_blue');one.setWear('head','saunahattu');one.setWear('face','glasses');
   one.asleep=true;one.update(.016,1,()=>0);one.asleep=false;
   one.g.updateMatrixWorld(true);
   one.g.traverse(m=>{if(m.geometry){const p=m.geometry.attributes.position;for(let i=0;i<p.count;i++)assert.ok(Number.isFinite(p.getX(i))&&Number.isFinite(p.getY(i))&&Number.isFinite(p.getZ(i)));}});
 }
 // Repainting after backgrounding must not randomise a seal's markings.
 const bytes=one.body.material.map.image.toBuffer('image/png');
 ctx.PN.U.repaint();assert.deepEqual(one.body.material.map.image.toBuffer('image/png'),bytes);
 one.dispose();two.dispose();
 console.log('PASS: all age rigs, extreme sliders, outfit attachment, per-seal materials, texture reuse and deterministic context restoration.');
}catch(e){if(e.code==='MODULE_NOT_FOUND')console.log('SKIP optional canvas checks: install @napi-rs/canvas.');else throw e;}
