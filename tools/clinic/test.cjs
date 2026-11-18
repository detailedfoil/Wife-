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
// Pup skills: practice, natural lean, what a pup becomes, the family bonus, visiting helpers and old saves.
{
 const T=S.T, mum=S.newState(now); mum.stage=2; mum.name='Emo'; mum.stats.joy=55; mum.stats.clean=100;
 assert.ok(ctx.PN.SKILL_ORDER.includes(mum.lean),'every seal is a natural at something');
 ctx.PN.GAME_ORDER.forEach(g=>assert.ok(ctx.PN.skillOf(g),'every coin game teaches a skill: '+g));
 const pup=S.addPup(mum,now,'Aino');
 assert.equal(pup.skill[pup.lean],T.leanStart);
 assert.equal(S.pupSpec(pup),pup.lean,'an untrained pup grows up a natural');
 const other=ctx.PN.SKILL_ORDER.find(k=>k!==pup.lean&&k!=='care'), game=ctx.PN.SKILLS[other].games[0];
 const r=S.gameReward(mum,game,10,{},null,40,now,1);
 assert.deepEqual([...r.learnt],['Aino']); assert.equal(r.skill,other); assert.equal(pup.skill[other],1);
 S.gameReward(mum,game,10,{},null,4,now,1); assert.equal(pup.skill[other],1,'a game quit early teaches nothing');
 S.gameReward(mum,game,10,{},null,40,now,1); assert.equal(S.pupSpec(pup),'all','two close skills make an all-rounder');
 S.gameReward(mum,game,10,{},null,40,now,1); assert.equal(S.pupSpec(pup),other,'practice wins over the natural lean');
 S.train(mum,pup,pup.lean,4); assert.equal(pup.skill[pup.lean],T.leanStart+4*T.leanMult,'the natural lean is learned faster');
 const pats=mum.counters.pets, care=pup.skill.care; mum.petWin={t0:now,n:0};
 for(let k=0;k<15;k++) S.cuddlePup(mum,0,now);
 assert.ok(Math.abs(pup.skill.care-care-10*T.careCuddle*(pup.lean==='care'?T.leanMult:1))<1e-9,'only the ten cuddles an hour count');
 mum.stats.clean=20; const sr=S.saunaDone(mum,S.saunaNeed(mum),S.saunaNeed(mum)); assert.deepEqual([...sr.learnt],['Aino']);
 assert.equal(S.familyBonus(mum),0);
 pup.ready=true; const spec=S.pupSpec(pup), g=S.graduatePup(mum,0,now);
 assert.equal(g.spec,spec); assert.equal(mum.family[0].spec,spec); assert.equal(g.fam,T.famBonusEach);
 for(let k=0;k<20;k++) mum.family.push({name:'P'+k,fate:k%5?'grown':'lost',spec:'water'});
 assert.equal(S.familyBonus(mum),T.famBonusMax,'the family bonus is capped');
 mum.family=[{name:'Uimari',fate:'grown',spec:'water',arriveAt:now-1,leaveAt:now+3600e3},{name:'Halailija',fate:'grown',spec:'care',arriveAt:now-1,leaveAt:now+3600e3},{name:'Kotona',fate:'grown',spec:'water'}];
 mum.stats.joy=55; mum.stats.clean=100;
 const fam=1+S.familyBonus(mum)/100, base=S.gameMult(mum,null,now);
 assert.ok(Math.abs(base-fam)<1e-9,'no game, no helpers');
 assert.ok(Math.abs(S.gameMult(mum,'catch',now)-(fam+T.specBonus/100))<1e-9,'a visiting Swimmer helps in Fish Rain');
 assert.ok(Math.abs(S.gameMult(mum,'bj',now)-fam)<1e-9,'but not at the card table');
 mum.stats.clean=0; const muddy=S.gameMult(mum,'bj',now); mum.family[1].arriveAt=0;
 assert.ok(muddy>S.gameMult(mum,'bj',now),'a visiting Cuddler halves the muck');
 mum.family[1].spec='all'; mum.family[1].arriveAt=now-1;
 assert.ok(Math.abs(S.helpers(mum,'bj',now)[0].pct-T.allBonus)<1e-9,'an all-rounder helps everywhere');
 // Old saves: pups at home get skills, grown pups get a skill of their own.
 const old=clone(mum); delete old.lean; old.pups=[{id:9,name:'Vanha',bornAt:now,food:80,joy:80,sick:false,starveMs:0,grownMs:0,ready:false}];
 old.family=[{name:'Ennen',fate:'grown'},{name:'Poissa',fate:'lost'}];
 const back=S.migrate(old);
 assert.ok(ctx.PN.SKILL_ORDER.includes(back.lean)); assert.ok(back.pups[0].skill&&back.pups[0].lean);
 assert.ok(ctx.PN.SKILL_ORDER.includes(back.family[0].spec)); assert.equal(back.family[1].spec,undefined,'lost pups have no skill');
}
console.log('PASS: pup skills from games, cuddles and saunas, natural lean, all-rounders, grow-up skill, capped family bonus, visiting helpers and old saves.');
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
