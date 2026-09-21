import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame} from '../v06-engine.js';
import {assets,hubs,upgrades} from '../v06-data.js';
import {submissionFor,eligibility,boardMeta,MAX_ACTIONS} from '../v07-proof.js';
import {validateReplay} from '../supabase/functions/trade-wars-leaderboard/validate.js';
const storage=()=>({getItem:()=>null,setItem:()=>{}});
const day='2026-09-21',clone=x=>JSON.parse(JSON.stringify(x));
function game(options={}){const g=createGame({storage:storage(),seed:options.seed||'LEADERBOARD',now:()=>new Date(day+'T12:00:00Z')});assert.equal(g.resetState({seed:'LEADERBOARD',companyName:'Test House',...options}).ok,true);return g;}
function finish(g){while(g.getState().day<30)assert.equal(g.advanceDay().ok,true);assert.equal(g.finishCampaign().ok,true);return submissionFor(g.getState(),g.campaignReport());}
function exercise(seed,specialty){
 const g=game({seed,specialty});g.purchaseUpgrade('carrier');g.purchaseUpgrade('procurement');g.purchaseUpgrade('operations');
 while(g.getState().day<30){
   const d=g.getState().day;
   if(d%5===1&&g.getState().offers.length){
     const c=g.getState().offers[0];if(g.acceptContract(c.id).ok){
       if(d===1)g.cancelContract(c.id);
       else if(d===6){for(const [a,n]of Object.entries(c.requirements))g.trade(a,1,n);if(g.getState().currentHub!==c.hub)g.travelTo(c.hub);g.fulfillContract(c.id);}
       // Other contracts expire or close unfinished.
     }
   }
   const a=assets[d%assets.length],n=g.getState().holdings[a.id];
   if(n)g.trade(a.id,-1,n);else if(g.getState().cash>g.localPrice(a.id)*7)g.trade(a.id,1,7);
   if(g.getState().day<30){if(d%4===0){const h=hubs.find(h=>h.id!==g.getState().currentHub);if(!g.travelTo(h.id).ok)g.advanceDay();}else g.advanceDay();}
 }
 g.trade('copper',1,2);g.finishCampaign();return {g,proof:submissionFor(g.getState(),g.campaignReport())};
}
test('closed quiet campaign replays, no fake journal events are needed',()=>{const g=game(),p=finish(g),v=validateReplay(p,day);assert.equal(v.scoreCents,5000000);assert.equal(p.actions.length,30);assert.equal(v.trades,0);});
test('full v0.6 journal preserves travel, upgrades, cancellations, expiry and delivery',()=>{
 for(const specialty of ['independent','logistics','grid'])for(let i=0;i<12;i++){
  const {g,proof}=exercise('LB-'+i,specialty),v=validateReplay(proof,day);
  assert.equal(v.scoreCents,Math.round(g.netWorth()*100));assert.equal(v.companyName,'Test House');assert.equal(v.meta.specialty,specialty);
 }
});
test('daily starts locked to Independent / same server date and seed',()=>{const g=game({mode:'daily',challengeDate:day}),p=finish(g),v=validateReplay(p,day);assert.equal(v.meta.boardKey,'daily|0.6.0|'+day);assert.equal(v.startingCash,50000);});
test('changed client balance/score/quantity and overspending fail replay',()=>{
 const {proof}=exercise('TAMPER','grid');
 for(const k of ['worth','cash','inventory','realized','upgradeCosts','trades']){const p=clone(proof);p.expected[k]+=1000;assert.throws(()=>validateReplay(p,day),/does not match/);}
 const p=clone(proof);p.actions.unshift({type:'buy',asset:'oil',qty:1000000});assert.throws(()=>validateReplay(p,day),/Not enough cash/);
 const q=clone(proof);q.final.holdings.oil=999999;assert.throws(()=>validateReplay(q,day),/inventory/);
});
test('invalid actions, unknown types, extra fields and non-whole sizes rejected',()=>{
 const proof=finish(game());for(const a of [{type:'eval',code:'1+1'},{type:'buy',asset:'oil',qty:-1},{type:'buy',asset:'oil',qty:1.5},{type:'advance',cash:10000},{type:'constructor'}]){
  const p=clone(proof);p.actions.unshift(a);assert.throws(()=>validateReplay(p,day));
 }
});
test('partial, migrated and preserved pre-0.6 worlds are not rankable',()=>{
 const g=game();assert.match(eligibility(g.getState()),/close/);assert.throws(()=>submissionFor(g.getState(),g.campaignReport()));finish(g);
 for(const patch of [{legacyRules:true},{migrated:true},{coverageStart:6},{worldRules:'0.5.0'}])assert.match(eligibility({...g.getState(),...patch}),/Only full/);
});
test('server rejects changed/future daily setup, invalid rules and invented dates',()=>{
 for(const patch of [{rules:'0.7.0'},{specialty:'grid'},{challengeDate:'2026-09-22',seed:'DAILY-2026-09-22'},{challengeDate:'2026-09-31',seed:'DAILY-2026-09-31'},{seed:'DAILY-not-correct'}]){
  assert.throws(()=>boardMeta({rules:'0.6.0',mode:'daily',specialty:'independent',seed:'DAILY-'+day,challengeDate:day,...patch},day));
 }
});
test('different seeds/specialties have different free boards; public name does not affect world',()=>{
 const one=boardMeta({rules:'0.6.0',mode:'free',seed:'A',specialty:'grid'}),two=boardMeta({rules:'0.6.0',mode:'free',seed:'B',specialty:'grid'}),three=boardMeta({...one,specialty:'logistics'});
 assert.notEqual(one.boardKey,two.boardKey);assert.notEqual(one.boardKey,three.boardKey);
 const g=game(),p=finish(g);p.companyName='Another House';assert.equal(validateReplay(p,day).scoreCents,5000000);
});
test('bounded actions, closure required and no actions after final close',()=>{
 const p=finish(game()),a=clone(p);a.actions=Array(MAX_ACTIONS+1).fill({type:'advance'});assert.throws(()=>validateReplay(a,day),/decisions/);
 const b=clone(p);b.actions.pop();assert.throws(()=>validateReplay(b,day),/Only closed/);
 const c=clone(p);c.actions.push({type:'advance'});assert.throws(()=>validateReplay(c,day),/after campaign/);
});
test('client proof generation is read-only and rejects inconsistent journal ordering',()=>{
 const g=game();g.trade('oil',1,10);const p=finish(g),before=JSON.stringify(g.getState());submissionFor(g.getState(),g.campaignReport());assert.equal(JSON.stringify(g.getState()),before);
 const bad=clone(g.getState());bad.journal[0].id=20;assert.throws(()=>submissionFor(bad,g.campaignReport()),/incomplete/);
 assert.equal(validateReplay(p,day).actionCount,p.actions.length);
});
test('the compiled rules and protocol are reproducible from the pinned source',async()=>{
 const fs=await import('node:fs'),crypto=await import('node:crypto');const manifest=JSON.parse(fs.readFileSync(new URL('../supabase/functions/trade-wars-leaderboard/rules-manifest.json',import.meta.url)));
 for(const [name,hash]of Object.entries(manifest.sha256))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(new URL('../'+name,import.meta.url))).digest('hex'),hash);
 assert.equal(fs.readFileSync(new URL('../v07-proof.js',import.meta.url),'utf8'),fs.readFileSync(new URL('../supabase/functions/trade-wars-leaderboard/protocol.js',import.meta.url),'utf8'));
});
