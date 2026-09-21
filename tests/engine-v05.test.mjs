import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,randomAt} from '../v05-engine.js';
import {assets,hubs,STORAGE_KEY,LEGACY_KEY,RECORDS_KEY} from '../v05-data.js';
const memory=initial=>{const map=new Map(Object.entries(initial||{}));return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k),map};};
const game=(seed='REGRESSION')=>createGame({storage:memory(),seed});
const approx=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
const snapshot=g=>JSON.stringify(g.getState());
function buyPackage(g,c){for(const [id,n] of Object.entries(c.requirements))assert.equal(g.trade(id,1,n).ok,true);}
function finish(g){while(g.getState().day<30)assert.equal(g.advanceDay().ok,true);assert.equal(g.finishCampaign().ok,true);}
function reconcile(g){const r=g.campaignReport();approx(r.worth,r.openingEquity+r.realized+r.contractProfit+r.unrealized-r.openingUnrealized-r.travelCosts-r.forfeits);}

test('12 assets, separate equipment markets, and reproducible coordinate RNG',()=>{
 assert.equal(assets.length,12);assert.equal(assets.filter(a=>a.group==='solar').length,4);
 assert.equal(randomAt('x','a'),randomAt('x','a'));assert.notEqual(randomAt('x','a'),randomAt('y','a'));
});
test('preview is side-effect-free and matches an exact purchase',()=>{
 const g=game(),before=snapshot(g),p=g.previewTrade('copper',1,137);assert.equal(p.ok,true);assert.equal(snapshot(g),before);
 const r=g.trade('copper',1,137);assert.equal(r.ok,true);approx(g.getState().cash,p.cashAfter);approx(g.getState().avgCosts.copper,p.averageAfter);assert.equal(r.receipt.qty,137);reconcile(g);
});
test('weighted average, partial sale, sale P/L, full exit and re-entry',()=>{
 const g=game();g.trade('oil',1,10);const first=g.localPrice('oil');g.advanceDay();const second=g.localPrice('oil');g.trade('oil',1,20);
 const avg=(first*10+second*20)/30;approx(g.getState().avgCosts.oil,avg);
 const receipt=g.trade('oil',-1,7).receipt;approx(receipt.realized,7*(second-avg));assert.equal(g.getState().holdings.oil,23);approx(g.getState().avgCosts.oil,avg);
 g.trade('oil',-1,23);assert.equal(g.getState().avgCosts.oil,0);g.advanceDay();g.trade('oil',1,1);approx(g.getState().avgCosts.oil,g.localPrice('oil'));reconcile(g);
});
test('negative, fractional, zero, nonfinite and invalid trades never mutate',()=>{
 const g=game(),before=snapshot(g);
 for(const n of [0,-1,1.5,NaN,Infinity,'5',10000001,Number.MAX_SAFE_INTEGER])assert.equal(g.trade('oil',1,n).ok,false);
 for(const [id,dir,n] of [['not-real',1,1],['oil',0,1],['oil',2,1],['oil',-1,1],['oil',1,999999]])assert.equal(g.trade(id,dir,n).ok,false);
 assert.equal(snapshot(g),before);
});
test('Buy Max spends within available cash and Sell All restores it at same quote',()=>{
 const g=game(),max=Math.floor(g.getState().cash/g.localPrice('oil'));assert.equal(g.trade('oil',1,max).ok,true);assert.ok(g.getState().cash>=0);assert.ok(g.getState().cash<g.localPrice('oil'));
 assert.equal(g.trade('oil',-1,max).ok,true);approx(g.getState().cash,50000);reconcile(g);
});
test('same seeded world despite buying, travel and contracts',()=>{
 const a=game('SAME'),b=game('SAME');a.trade('modules',1,8);a.acceptContract(a.getState().offers[0].id);
 for(let i=0;i<12;i++){
  if(i%4===0){const h=hubs.find(h=>h.id!==a.getState().currentHub);assert.equal(a.travelTo(h.id).ok,true);}else a.advanceDay();b.advanceDay();
  assert.deepEqual(a.getState().prices,b.getState().prices);assert.deepEqual(a.getState().hubDrift,b.getState().hubDrift);assert.deepEqual(a.getState().regionalPremiums,b.getState().regionalPremiums);assert.deepEqual(a.getState().activeConditions,b.getState().activeConditions);
 }
});
test('reload resumes the exact deterministic world',()=>{
 const store=memory(),g=createGame({storage:store,seed:'LOAD'});g.trade('inverters',1,13);for(let i=0;i<7;i++)g.advanceDay();
 const loaded=createGame({storage:store});assert.equal(snapshot(g),snapshot(loaded));g.advanceDay();loaded.advanceDay();assert.equal(snapshot(g),snapshot(loaded));
});
test('local movement compares a fixed hub; travel cost/day recorded once',()=>{
 const g=game(),old=g.localPrice('oil','houston'),global=g.getState().prices.oil;g.trade('oil',1,10);const cash=g.getState().cash;
 assert.equal(g.travelTo('houston').ok,true);assert.equal(g.getState().day,2);approx(g.getState().cash,cash-650);
 approx(g.localMove('oil'),g.localPrice('oil')/old-1);approx(g.getState().moves.oil,g.getState().prices.oil/global-1);
 assert.equal(g.getState().journal.filter(r=>r.type==='travel').length,1);reconcile(g);
});
test('multi-day conditions develop, branch, ease, resolve; global components reconcile',()=>{
 const phases=new Set();let inputSeen=false;
 for(const seed of ['A','B','C','D']){
  const g=game(seed);
  for(let d=1;d<30;d++){
   const prev=g.getState().moves.chips;g.advanceDay();
   for(const c of g.getState().activeConditions){phases.add(c.phase);assert.ok(c.weight>=0&&c.weight<=1);if(c.phase==='resolved')assert.equal(c.weight,0);assert.equal('outcome' in c,false);}
   for(const a of assets){const r=g.getState().moveReasons[a.id];approx(r.event+r.noise+r.meanReversion+r.supplyChain+r.adjustment,r.total);}
   if(Math.abs(prev)>0)inputSeen=true;
  }
 }
 assert.deepEqual([...phases].sort(),['active','developing','easing','resolved']);assert.ok(inputSeen);
});
test('equipment costs use previous-session input moves',()=>{
 const g=game();g.advanceDay();const m={...g.getState().moves};g.advanceDay();approx(g.getState().moveReasons.inverters.supplyChain,m.chips*.22+m.copper*.12);approx(g.getState().moveReasons.transformers.supplyChain,m.copper*.2+m.steel*.14);
});
test('bond is escrow, not immediate expense; duplicate acceptance rejected',()=>{
 const g=game(),c=g.getState().offers[0],before=g.netWorth();assert.equal(g.acceptContract(c.id).ok,true);approx(g.netWorth(),before);approx(g.getState().cash,50000-c.bond);approx(g.getState().escrow,c.bond);assert.equal(g.acceptContract(c.id).ok,false);reconcile(g);
});
test('delivery removes goods atomically, records profit and returns the bond',()=>{
 const g=game('TEST'),c={...g.getState().offers[0]};g.acceptContract(c.id);const before=snapshot(g);assert.equal(g.fulfillContract(c.id).ok,false);assert.equal(snapshot(g),before);
 buyPackage(g,c);if(g.getState().currentHub!==c.hub)g.travelTo(c.hub);
 const p=g.deliveryPreview(c.id),cash=g.getState().cash;assert.equal(p.ok,true);const r=g.fulfillContract(c.id);assert.equal(r.ok,true);approx(g.getState().cash,cash+c.payout+c.bond);assert.equal(g.getState().escrow,0);approx(r.receipt.realized,c.payout-p.cost);
 for(const id of Object.keys(c.requirements)){assert.equal(g.getState().holdings[id],0);assert.equal(g.getState().avgCosts[id],0);}assert.equal(g.fulfillContract(c.id).ok,false);reconcile(g);
});
test('cancel forfeits only bond and keeps all inventory',()=>{
 const g=game(),c=g.getState().offers[0];g.acceptContract(c.id);buyPackage(g,c);const q={...g.getState().holdings},cash=g.getState().cash,worth=g.netWorth();assert.equal(g.cancelContract(c.id).ok,true);approx(g.getState().cash,cash);approx(g.netWorth(),worth-c.bond);assert.deepEqual(g.getState().holdings,q);assert.equal(g.cancelContract(c.id).ok,false);reconcile(g);
});
test('deadline is inclusive; expiry happens next day and only once',()=>{
 const g=game('TEST'),c={...g.getState().offers[0]};g.acceptContract(c.id);buyPackage(g,c);if(g.getState().currentHub!==c.hub)g.travelTo(c.hub);
 while(g.getState().day<c.deadline)g.advanceDay();assert.equal(g.deliveryPreview(c.id).ok,true);g.advanceDay();assert.equal(g.deliveryPreview(c.id).ok,false);assert.equal(g.getState().escrow,0);assert.equal(g.getState().journal.filter(x=>x.type==='forfeit').length,1);g.advanceDay();assert.equal(g.getState().journal.filter(x=>x.type==='forfeit').length,1);reconcile(g);
});
test('expired offers cannot be accepted; max three commitments',()=>{
 const g=game();const offer=g.getState().offers[0];for(const c of [...g.getState().offers])assert.equal(g.acceptContract(c.id).ok,true);for(let i=0;i<5;i++)g.advanceDay();assert.equal(g.acceptContract(g.getState().offers[0].id).ok,false);assert.equal(g.acceptContract(offer.id).ok,false);
});
test('Day 30 is tradable, then explicit closure locks the run and marks inventory',()=>{
 const g=game();assert.equal(g.finishCampaign().ok,false);while(g.getState().day<30)g.advanceDay();assert.equal(g.getState().finished,false);assert.equal(g.trade('copper',1,2).ok,true);assert.equal(g.travelTo('houston').ok,false);assert.equal(g.advanceDay().ok,false);
 const inventory=g.holdingsValue(),qty=g.getState().holdings.copper;assert.equal(g.finishCampaign().ok,true);assert.equal(g.getState().result.inventory,inventory);assert.equal(g.getState().holdings.copper,qty);assert.equal(g.trade('copper',-1,1).ok,false);assert.equal(g.finishCampaign().ok,false);reconcile(g);
});
test('remaining bonds forfeit at close and reconcile the score',()=>{
 const g=game();while(g.getState().day<21)g.advanceDay();const c=g.getState().offers.find(c=>c.deadline===30)||g.getState().offers.at(-1);g.acceptContract(c.id);while(g.getState().day<30)g.advanceDay();g.finishCampaign();assert.equal(g.getState().escrow,0);reconcile(g);
});
test('personal best persists and replay reproduces world history',()=>{
 const store=memory(),g=createGame({storage:store,seed:'REPLAY'});finish(g);const hist=structuredClone(g.getState().priceHistory),runId=g.getState().runId;assert.equal(g.getRecords().length,1);assert.equal(g.resetState({replay:true}).ok,true);assert.notEqual(g.getState().runId,runId);finish(g);assert.deepEqual(g.getState().priceHistory,hist);assert.equal(g.getRecords().length,2);assert.ok(store.getItem(`${STORAGE_KEY}-previous`));
});
test('legacy migration preserves holdings, average, cash, day and quote; does not invent history',()=>{
 const old={version:2,day:26,cash:8986,currentHub:'singapore',prices:Object.fromEntries(assets.filter(a=>a.group==='core').map(a=>[a.id,a.price])),holdings:Object.fromEntries(assets.filter(a=>a.group==='core').map(a=>[a.id,0])),avgCosts:Object.fromEntries(assets.filter(a=>a.group==='core').map(a=>[a.id,0])),hubDrift:{},finished:false};
 old.holdings.copper=10;old.holdings.rare=210;old.avgCosts.copper=123;old.avgCosts.rare=128;
 const raw=JSON.stringify(old),store=memory({[LEGACY_KEY]:raw}),g=createGame({storage:store});const st=g.getState();assert.equal(st.day,26);assert.equal(st.cash,8986);assert.equal(st.holdings.copper,10);assert.equal(st.holdings.rare,210);assert.equal(st.avgCosts.copper,123);assert.equal(st.currentHub,'singapore');approx(g.localPrice('copper'),old.prices.copper*1.03);
 assert.equal(st.journal.length,0);assert.equal(st.priceHistory.length,1);assert.equal(st.priceHistory[0].day,26);assert.equal(store.getItem(LEGACY_KEY),raw);assert.equal(st.migrated,true);assert.equal(g.resetState({replay:true}).ok,false);finish(g);assert.equal(g.getRecords().length,0);reconcile(g);
});
test('storage failure is nonfatal and campaign can be exported',()=>{
 const storage={getItem:()=>null,setItem:()=>{throw Error('Quota exceeded');}};const g=createGame({storage,seed:'FAIL'});assert.equal(g.trade('oil',1,1).ok,true);assert.match(g.getStorageWarning(),/Export/);assert.equal(JSON.parse(g.exportCampaign()).holdings.oil,1);
});
test('unreadable current save is backed up, not silently destroyed on load',()=>{
 const store=memory({[STORAGE_KEY]:'{bad-json'}),g=createGame({storage:store});assert.equal(store.getItem(STORAGE_KEY),'{bad-json');assert.equal(store.getItem(`${STORAGE_KEY}-unreadable-backup`),'{bad-json');assert.match(g.getLoadNotice(),/could not be read/);assert.equal(g.trade('oil',1,1).ok,true);assert.equal(JSON.parse(store.getItem(STORAGE_KEY)).version,5);
});
test('mixed long campaign accounting stays finite and consistent',()=>{
 for(let j=0;j<20;j++){
  const g=game('STRESS-'+j);
  while(g.getState().day<30){const a=assets[g.getState().day%assets.length];if(g.getState().holdings[a.id])g.trade(a.id,-1,g.getState().holdings[a.id]);else if(g.getState().cash>g.localPrice(a.id)*5)g.trade(a.id,1,5);if(g.getState().day%5===1&&g.getState().offers.length)g.acceptContract(g.getState().offers[0].id);g.advanceDay();reconcile(g);assert.ok(g.getState().cash>=0);assert.ok(Number.isFinite(g.netWorth()));}g.finishCampaign();reconcile(g);
 }
});
