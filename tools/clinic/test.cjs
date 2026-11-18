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
 assert.equal(born.size,1,'overall size is clinic-only'); assert.ok(born.headSize>=A.naturalRanges.headSize[0]&&born.headSize<=A.naturalRanges.headSize[1]);
 assert.equal(born.decal,'none'); assert.equal(born.finish,'none');
 if(born.coat===natural.coat) matches++;
 coats.add(born.coat);bodies.add(born.bodyWidth);
}
assert.equal(coats.size,7);assert.ok(bodies.size>3);assert.ok(matches>1200&&matches<1700,'offspring often resemble natural parent');
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
// The creator: free, natural only, sets both layers, and the free choice is once.
const fresh=S.newState(now); fresh.coins=0;
assert.ok(A.canChooseFree(fresh));
const picked=A.create(fresh,{...fresh.birthAppearance,coat:'pink',decal:'hearts',size:1.2,headSize:1.2,pattern:'spots',coat2:'x'});
assert.equal(picked.coat,'original'===fresh.birthAppearance.coat?'original':fresh.birthAppearance.coat,'dream colours are not natural');
assert.equal(picked.decal,'none'); assert.equal(picked.size,1); assert.equal(picked.headSize,A.naturalRanges.headSize[1]); assert.equal(picked.pattern,'spots');
assert.deepEqual(clone(fresh.appearance),clone(fresh.birthAppearance)); assert.equal(fresh.coins,0); assert.ok(!A.canChooseFree(fresh));
// Clinic extras are priced, and never inherited.
const fancy={...clone(state.appearance),decal:'stars',decalLayout:'one',decalColor:'gold',gradient:'lavender',mask:'charcoal',flippers:'pink',tail:'teal',finish:'aurora',eyeRight:'ocean',eyeStar:'star',cheeks:'rosy',freckles:'cheeks',whiskerColor:'pink',whiskerLength:1.4};
const fq=A.quote(state,fancy), labels=fq.lines.map(l=>l.label);
for(const l of ['Special marking','Head to tail fade','Face mask','Flipper tips','Dipped tail','Coat finish','Odd eyes','Star sparkle','Rosy cheeks','Cheek freckles','Whiskers']) assert.ok(labels.includes(l),l);
assert.equal(fq.lines.find(l=>l.label==='Coat finish').cost,20000);
assert.equal(fq.lines.find(l=>l.label==='Special marking').cost,7500);
state.coins=200000; assert.ok(A.purchase(state,'main',fancy,now).ok);
assert.equal(A.quote(state,{...fancy,decalColor:'pink'}).lines[0].cost,2500,'tweaking an owned marking is cheaper');
for(let i=0;i<200;i++){const kid=A.natural(now+i,state.birthAppearance);for(const k of ['decal','gradient','mask','flippers','tail','finish','eyeRight','eyeStar','cheeks','freckles'])assert.equal(kid[k],A.defaults[k]);}
console.log('PASS: creator is free and natural-only, the free choice is once, clinic extras are priced and never inherited.');
console.log('PASS: atomic purchases, level/coin gates, monotonic prices, paid restoration, 2,000 natural births, inheritance, family transitions, legacy migration and save/import round trip.');
// Pup levels and skill points: xp from everything the family does, a point per level up to 10, locked once spent, perks scaled by points, old saves.
{
 const J=(o)=>JSON.stringify(PN_KEYS.map(k=>o[k])), PN_KEYS=['water','sport','brain','care'];
 const T=S.T, mum=S.newState(now); mum.stage=2; mum.name='Emo'; mum.stats.joy=55; mum.stats.clean=100;
 ctx.PN.GAME_ORDER.forEach(g=>assert.ok(ctx.PN.skillOf(g),'every coin game belongs to a skill: '+g));
 const pup=S.addPup(mum,now,'Aino'); pup.xp=0; S.drain();
 assert.equal(J(pup.pts),J({water:0,sport:0,brain:0,care:0})); assert.equal(S.pupLevel(pup),0); assert.equal(S.spendPoint(mum,0,'water').ok,false,'no level, no point');
 S.pupXp(mum,T.pupXpStep-1); assert.equal(S.pupLevel(pup),0); S.pupXp(mum,1); assert.equal(S.pupLevel(pup),1);
 const ev=S.drain().find(e=>e.type==='pupLevel'); assert.ok(ev&&ev.name==='Aino'&&ev.level===1&&ev.free===1,'reaching a level is an event');
 pup.xp=0; S.drain(); S.gameReward(mum,'catch',10,{},null,40,now,1); assert.ok(pup.xp>0,'a game earns the pups at home xp');
 const sick=S.addPup(mum,now+1,'Kipee'); sick.xp=0; sick.sick=true; S.pupXp(mum,50); assert.equal(sick.xp,0,'a poorly pup earns nothing');
 mum.pups.splice(1,1);
 pup.xp=1e6; S.pupXp(mum,100); assert.equal(S.pupLevel(pup),T.pupMaxPoints,'capped at the most points'); assert.equal(pup.xp,T.pupMaxPoints*T.pupXpStep);
 for(let k=0;k<6;k++) assert.ok(S.spendPoint(mum,0,'water').ok); for(let k=0;k<4;k++) assert.ok(S.spendPoint(mum,0,'care').ok);
 assert.equal(S.pupFree(pup),0); assert.equal(S.spendPoint(mum,0,'sport').ok,false,'no points left'); assert.equal(S.spendPoint(mum,0,'nonsense').ok,false);
 assert.equal(S.pupSpec(pup),'water');
 pup.ready=true; const g=S.graduatePup(mum,0,now);
 assert.equal(g.spec,'water'); assert.equal(g.pts.water,6); assert.equal(g.pts.care,4); assert.equal(mum.family[0].pts.water,6); assert.equal(g.fam,T.famBonusEach);
 { const q=S.newState(now); q.stage=2; const pp=S.addPup(q,now,'K'); pp.xp=T.pupMaxPoints*T.pupXpStep; for(let n=0;n<T.pupSkillMax;n++) assert.ok(S.spendPoint(q,0,'water').ok); assert.equal(S.spendPoint(q,0,'water').ok,false,'no skill goes past the cap'); assert.ok(S.spendPoint(q,0,'sport').ok); assert.equal(pp.pts.water,T.pupSkillMax); }
 assert.equal(S.topSkills({water:5,sport:5,brain:0,care:0}).join(),'water,sport','two skills at the same level are both hers'); assert.equal(S.topSkills({water:0,sport:0,brain:0,care:0}).length,0); assert.equal(S.topSkills({water:2,sport:1,brain:0,care:0}).join(),'water');
 assert.equal(S.specOf({water:3,sport:3,brain:0,care:0}),'all','a tie is an all-rounder'); assert.equal(S.specOf({water:0,sport:0,brain:0,care:0}),'all'); assert.equal(S.specOf({water:3,sport:4,brain:0,care:0}),'sport');
 for(let k=0;k<20;k++) mum.family.push({name:'P'+k,fate:k%5?'grown':'lost',pts:{water:1,sport:0,brain:0,care:0}});
 assert.equal(S.familyBonus(mum),T.famBonusMax,'the family bonus is capped');
 mum.family=[{name:'Uimari',fate:'grown',spec:'water',pts:{water:7,sport:0,brain:0,care:0},arriveAt:now-1,leaveAt:now+3600e3},
   {name:'Hoiva',fate:'grown',spec:'care',pts:{water:0,sport:0,brain:0,care:5},arriveAt:now-1,leaveAt:now+3600e3},{name:'Kotona',fate:'grown',spec:'water',pts:{water:10,sport:0,brain:0,care:0}}];
 mum.stats.joy=55; mum.stats.clean=100;
 const fam=1+S.familyBonus(mum)/100;
 assert.ok(Math.abs(S.gameMult(mum,null,now)-fam)<1e-9,'no game, no helpers');
 assert.ok(Math.abs(S.gameMult(mum,'catch',now)-(fam+7*T.pointBonus/100))<1e-9,'a visiting pup gives a percent per point in her skill');
 assert.ok(Math.abs(S.gameMult(mum,'bj',now)-fam)<1e-9,'and nothing in games of other skills');
 { const run=(withPup)=>{ let coins=0,sulks=0; for(let n=0;n<600;n++){ const s=S.newState(now); s.stage=2; s.counters.dives=5; s.seed=n*7+1; s.stats.energy=100; if(withPup) s.family=[{name:'U',fate:'grown',pts:{water:10,sport:0,brain:0,care:0},arriveAt:now-1,leaveAt:now+3600e3}]; const l=S.diveResult(s,now); coins+=(l.coins||0); if(l.sulked) sulks++; if(withPup) assert.ok(l.kind==='none'||l.help.pct===10); } return {coins,sulks}; }; const a=run(false), b=run(true); assert.ok(b.coins>a.coins,'swimming points earn more on dives'); assert.ok(b.sulks<a.sulks,'and fewer angry dives'); }
 { const d=S.diveHelp(mum,now); assert.equal(d.pts,7,'only the visiting pup counts'); assert.equal(d.pct,7*T.pointBonus); assert.equal(d.sulkCut,7*T.diveSulkCut); assert.equal(d.names.join(),'Uimari'); }
 assert.equal(S.careSlow(mum),5*T.carePoint,'the best Care pup sets how much slower happiness drops');
 { const away=(fam)=>{ const s=S.newState(now); s.stage=2; s.stats.joy=90; s.stats.food=100; s.stats.clean=100; s.family=fam; S.advance(s,now+3*3600e3,{away:true}); return s.stats.joy; };
   const none=away([]), cared=away([{name:'H',fate:'grown',pts:{water:0,sport:0,brain:0,care:10},arriveAt:0,leaveAt:0}]);
   assert.ok(cared>none,'Care keeps her happier while the game is closed'); }
 mum.family[1].arriveAt=now-1;
 const r=S.gameReward(mum,'catch',10,{},null,40,now,1); assert.equal(r.help.map(h=>h.name).sort().join(),'Uimari','Care no longer shows in game results');
 // Old saves: pups at home start again from nothing, once; grown pups keep what they gave before.
 const old=clone(mum); delete old.pupsFresh; old.pups=[{id:9,name:'Vanha',bornAt:now,food:80,joy:80,sick:false,starveMs:0,grownMs:T.pupGrow,ready:true,lean:'sport',skill:{water:1,sport:5.5,brain:0,care:0.25}}];
 old.family=[{name:'A',fate:'grown',spec:'brain'},{name:'B',fate:'grown',spec:'care'},{name:'C',fate:'grown',spec:'all'},{name:'D',fate:'lost'}];
 const back=S.migrate(old), q=back.pups[0];
 assert.equal(S.pupLevel(q),0,'a pup at home starts again at level 0'); assert.equal(S.pupFree(q),0); assert.equal(q.skill,undefined); assert.equal(q.grownMs,0,'with a fresh two days'); assert.equal(q.ready,false);
 assert.equal(J(back.family[0].pts),J({water:0,sport:0,brain:5,care:0})); assert.equal(back.family[0].spec,'brain');
 assert.equal(J(back.family[1].pts),J({water:0,sport:0,brain:0,care:5})); assert.equal(J(back.family[2].pts),J({water:2,sport:2,brain:2,care:0})); assert.equal(back.family[2].spec,'all');
 assert.equal(back.family[3].pts,undefined,'lost pups have no points');
 q.xp=95; q.grownMs=1000; S.spendPoint(back,0,'water');
 const again=S.migrate(clone(back)); assert.equal(S.pupLevel(again.pups[0]),3,'it only happens once'); assert.equal(again.pups[0].grownMs,1000); assert.equal(J(again.family[0].pts),J(back.family[0].pts));
 // A pup already on the points version (without the one-time flag) is reset too.
 const early=clone(back); delete early.pupsFresh; assert.equal(S.pupLevel(S.migrate(early).pups[0]),0);
 // A brand new seal's first pup is never reset by a reload.
 const fresh=S.newState(now); fresh.stage=2; const f1=S.addPup(fresh,now,'Uusi'); f1.xp=T.pupXpStep*2; assert.equal(S.pupLevel(S.migrate(clone(fresh)).pups[0]),2);
}
console.log('PASS: pup xp and levels, skill points up to 10, locked once spent, grow-up skill, capped family bonus, visiting perks scaled by points and old saves.');
// "Add to Home Screen": which kind of device is it, and do update stamps sort by time? (Compared as text, 10 Dec comes before 18 Nov.)
load('js/install.js');
{
 const K=ctx.PN.Install.kind, ua={
  iphone:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  mac:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  android:'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
  win:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'};
 assert.equal(K(ua.iphone,'iPhone',5),'ios'); assert.equal(K(ua.mac,'MacIntel',5),'ios','an iPad asking for the desktop site');
 assert.equal(K(ua.mac,'MacIntel',0),'desktop'); assert.equal(K(ua.android,'Linux armv8l',5),'android');
 assert.equal(K(ua.win,'Win32',0),'desktop'); assert.equal(K('','',0),'desktop');
 const key=ctx.PN.stampKey, order=['18 Nov 2026, 10:04','18 Nov 2026, 10:30','19 Nov 2026, 09:00','1 Dec 2026, 09:00','10 Dec 2026, 09:00','18 Dec 2026, 09:00','2 Jan 2027, 09:00','12 Jan 2027, 09:00'];
 for(let i=1;i<order.length;i++) assert.ok(key(order[i])>key(order[i-1]),order[i]+' is later than '+order[i-1]);
 assert.equal(key('nonsense'),0); assert.ok(key(ctx.PN.UPDATED)>0,'the real stamp parses');
}
console.log('PASS: install button device detection and update stamps that sort by time.');
try{
 const {createCanvas}=require('@napi-rs/canvas');
 ctx.document={createElement:(name)=>{if(name!=='canvas')throw Error(name);const c=createCanvas(1,1);c.addEventListener=()=>{};return c;}};
 ['vendor/three.min.js','js/props.js','js/seal.js'].forEach(load);
 const Seal=ctx.PN.Seal;
 const one=new Seal({stage:2,appearance:state.appearance}),two=new Seal({stage:2,appearance:state.appearance});
 const oldMap=one.body.material.map;
 const baseColor=two.eyeMats[0].color.getHex();
 one.setAppearance(pink);one.update(.016,1,()=>0);
 assert.notEqual(one.body.material.map,oldMap);
 assert.notEqual(one.body.material,two.body.material,'per-seal materials');
 assert.equal(two.eyeMats[0].color.getHex(),baseColor);
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
