import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,randomAt} from '../v06-engine.js';
import {assets,hubs,STORAGE_KEY,LEGACY_KEY,RECORDS_KEY} from '../v06-data.js';
const memory=initial=>{const map=new Map(Object.entries(initial||{}));return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k),map};};
const game=(seed='REGRESSION')=>createGame({storage:memory(),seed});
const approx=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
const snapshot=g=>JSON.stringify(g.getState());
function buyPackage(g,c){for(const [id,n] of Object.entries(c.requirements))assert.equal(g.trade(id,1,n).ok,true);}
function finish(g){while(g.getState().day<30)assert.equal(g.advanceDay().ok,true);assert.equal(g.finishCampaign().ok,true);}
function reconcile(g){const r=g.campaignReport();approx(r.worth,r.openingEquity+r.realized+r.contractProfit+r.unrealized-r.openingUnrealized-r.travelCosts-r.forfeits-r.upgradeCosts);}

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
 const store=memory({[STORAGE_KEY]:'{bad-json'}),g=createGame({storage:store});assert.equal(store.getItem(STORAGE_KEY),'{bad-json');assert.equal(store.getItem(`${STORAGE_KEY}-unreadable-backup`),'{bad-json');assert.match(g.getLoadNotice(),/could not be read/);assert.equal(g.trade('oil',1,1).ok,true);assert.equal(JSON.parse(store.getItem(STORAGE_KEY)).version,6);
});
test('mixed long campaign accounting stays finite and consistent',()=>{
 for(let j=0;j<20;j++){
  const g=game('STRESS-'+j);
  while(g.getState().day<30){const a=assets[g.getState().day%assets.length];if(g.getState().holdings[a.id])g.trade(a.id,-1,g.getState().holdings[a.id]);else if(g.getState().cash>g.localPrice(a.id)*5)g.trade(a.id,1,5);if(g.getState().day%5===1&&g.getState().offers.length)g.acceptContract(g.getState().offers[0].id);g.advanceDay();reconcile(g);assert.ok(g.getState().cash>=0);assert.ok(Number.isFinite(g.netWorth()));}g.finishCampaign();reconcile(g);
 }
});

import {specialties,customers,upgrades,V5_KEY,ATTEMPTS_KEY,RULES,parseInvitation,shareURL,utcDay,validChallengeDate} from '../v06-data.js';
import {createGame as oldGame} from '../v05-engine.js';
const launch=(specialty='independent',seed='HOUSE')=>{const g=game();assert.equal(g.resetState({seed,specialty,companyName:'Sklar Global'}).ok,true);return g;};
const complete=(g,c)=>{assert.equal(g.acceptContract(c.id).ok,true);buyPackage(g,c);if(g.getState().currentHub!==c.hub)assert.equal(g.travelTo(c.hub).ok,true);assert.equal(g.fulfillContract(c.id).ok,true);reconcile(g);};

test('each company has disclosed capital/home/perks and a zero starting return',()=>{
 for(const h of specialties){const g=launch(h.id);assert.equal(g.getState().cash,h.cash);assert.equal(g.getState().currentHub,h.home);assert.equal(g.campaignReport().returnPct,0);assert.equal(g.campaignReport().companyName,'Sklar Global');assert.equal(g.travelCost('houston'),Math.round(650*h.travelFactor));reconcile(g);}
});
test('specialties never alter the day-by-day price world',()=>{
 const games=specialties.map(h=>launch(h.id,'WORLD'));
 for(let d=1;d<20;d++){for(const g of games)g.advanceDay();for(const g of games.slice(1)){assert.deepEqual(g.getState().prices,games[0].getState().prices);assert.deepEqual(g.getState().hubDrift,games[0].getState().hubDrift);}}
});
test('specialty payouts apply only to disclosed customers and signed terms are frozen',()=>{
 const ind=launch('independent'),grid=launch('grid'),log=launch('logistics');
 for(const base of ind.getState().offers){for(const g of [grid,log]){const c=g.getState().offers.find(c=>c.id===base.id);const h=g.house();const rate=h.clientIds.includes(c.customerId)?1.06:1;assert.ok(Math.abs(c.payout-base.payout*rate)<2);assert.equal(c.terms.specialtyBonus,rate===1?0:.06);}}
 const c=grid.getState().offers[0];grid.acceptContract(c.id);const before=JSON.stringify(grid.getState().contracts[0]);grid.getState().company.customers[c.customerId].trust=6;grid.advanceDay();assert.equal(JSON.stringify(grid.getState().contracts[0]),before);
});
test('all upgrade costs reconcile; carrier discount stacks multiplicatively and applies once',()=>{
 const g=launch('logistics');for(const u of upgrades){const before=g.netWorth();assert.equal(g.purchaseUpgrade(u.id).ok,true);approx(g.netWorth(),before-u.cost);const snap=snapshot(g);assert.equal(g.purchaseUpgrade(u.id).ok,false);assert.equal(snapshot(g),snap);reconcile(g);}
 assert.equal(g.travelCost('houston'),390);const cash=g.getState().cash;g.travelTo('houston');approx(g.getState().cash,cash-390);assert.equal(g.maxContracts(),4);reconcile(g);
});
test('upgrade previews are pure; no late procurement purchase or negative cash',()=>{
 const g=launch(),before=snapshot(g);assert.equal(g.quoteUpgrade('carrier').ok,true);assert.equal(snapshot(g),before);assert.equal(g.purchaseUpgrade('unknown').ok,false);
 while(g.getState().day<21)g.advanceDay();const snap=snapshot(g);assert.equal(g.purchaseUpgrade('procurement').ok,false);assert.equal(snapshot(g),snap);
 while(g.getState().day<30)g.advanceDay();assert.equal(g.purchaseUpgrade('carrier').ok,false);
});
test('procurement affects future tenders only; max three visible offers and larger requirements',()=>{
 const g=launch(),before=JSON.stringify(g.getState().offers);g.purchaseUpgrade('procurement');assert.equal(JSON.stringify(g.getState().offers),before);
 while(g.getState().day<6)g.advanceDay();assert.equal(g.getState().offers.length,3);const c=g.getState().offers.find(c=>c.kind==='licensed');assert.ok(c);assert.ok(c.payout>0);assert.equal(c.status,'offered');
});
test('operations raises acceptance limit without granting goods',()=>{
 const g=launch();g.purchaseUpgrade('operations');for(const c of [...g.getState().offers])g.acceptContract(c.id);while(g.getState().day<6)g.advanceDay();assert.equal(g.getState().contracts.filter(c=>c.status==='accepted').length,3);assert.equal(g.acceptContract(g.getState().offers[0].id).ok,true);assert.equal(g.acceptContract(g.getState().offers[0].id).ok,false);assert.equal(Object.values(g.getState().holdings).reduce((a,b)=>a+b),0);reconcile(g);
});
test('deliveries earn trust; cancellation loses one; next successful job recovers it',()=>{
 const g=launch(),c={...g.getState().offers[0]};complete(g,c);assert.equal(g.relationship(c.customerId).trust,1);assert.equal(g.relationship(c.customerId).delivered,1);
 while(g.getState().day<6)g.advanceDay();const repeat=g.getState().offers.find(x=>x.customerId===c.customerId);assert.ok(repeat);assert.equal(repeat.kind,'rush');assert.equal(repeat.deadline-g.getState().day,2);assert.equal(repeat.terms.bondFactor,.9);
 g.acceptContract(repeat.id);g.cancelContract(repeat.id);assert.equal(g.relationship(c.customerId).trust,0);assert.equal(g.relationship(c.customerId).failed,1);reconcile(g);
 while(g.getState().day<11)g.advanceDay();const next=g.getState().offers.find(x=>x.customerId===c.customerId);if(next){complete(g,next);assert.equal(g.relationship(c.customerId).trust,1);}
});
test('preferred terms are future-only; expiry and close penalize a client once',()=>{
 const g=launch();for(const c of customers)g.getState().company.customers[c.id].trust=3;while(g.getState().day<6)g.advanceDay();assert.ok(g.getState().offers.every(c=>c.terms.bondFactor===.8));const c={...g.getState().offers[0]};g.acceptContract(c.id);while(g.getState().day<=c.deadline)g.advanceDay();assert.equal(g.relationship(c.customerId).trust,2);assert.equal(g.relationship(c.customerId).failed,1);g.advanceDay();assert.equal(g.relationship(c.customerId).failed,1);reconcile(g);
});
test('decision strip detects shortages, travel, due-today and ready delivery without mutation',()=>{
 const g=launch(),c=g.getState().offers[0];g.acceptContract(c.id);let before=snapshot(g),dec=g.nextDecisions();assert.ok(dec.some(d=>d.id===c.id&&/Need/.test(d.detail)));assert.equal(snapshot(g),before);
 buyPackage(g,c);if(g.getState().currentHub!==c.hub)g.travelTo(c.hub);dec=g.nextDecisions();assert.match(dec.find(d=>d.id===c.id).title,/Ready/);
 g.getState().holdings.modules=0;g.getState().cash=0; // Purposefully isolated shortage fixture, not an accounting run.
 dec=g.nextDecisions();assert.ok(dec.length<=3);
});
test('daily fixes seed, setup and UTC edition even if specialty/seed overrides are provided',()=>{
 const g=launch('grid'),r=g.resetState({mode:'daily',challengeDate:'2026-09-20',specialty:'logistics',seed:'CHEAT'});assert.equal(r.ok,true);const s=g.getState();assert.equal(s.seed,'DAILY-2026-09-20');assert.equal(s.company.specialty,'independent');assert.equal(s.cash,50000);assert.equal(s.currentHub,'newyork');assert.equal(s.attempt,1);assert.equal(s.mode,'daily');
});
test('first-attempt labels survive reload; replay increments; new runs do not erase counts',()=>{
 const store=memory(),g=createGame({storage:store});g.resetState({mode:'daily',challengeDate:'2026-09-20'});const loaded=createGame({storage:store});assert.equal(loaded.getState().attempt,1);assert.equal(loaded.resetState({replay:true}).ok,true);assert.equal(loaded.getState().attempt,2);loaded.resetState({seed:'FREE'});loaded.resetState({mode:'daily',challengeDate:'2026-09-20'});assert.equal(loaded.getState().attempt,3);assert.match(loaded.shareResult().text,/Replay · attempt 3/);
});
test('daily replay keeps identical world history despite player actions and upgrades',()=>{
 const a=launch(),b=launch();for(const g of [a,b])g.resetState({mode:'daily',challengeDate:'2026-09-20'});a.purchaseUpgrade('carrier');a.travelTo('houston');b.advanceDay();for(let d=2;d<30;d++){a.advanceDay();b.advanceDay();}assert.deepEqual(a.getState().priceHistory,b.getState().priceHistory);
});
test('date rules are exact and UTC-stable; future/nonexistent dates and bad links cannot start',()=>{
 assert.equal(utcDay(new Date('2026-09-20T23:30:00-05:00')),'2026-09-21');assert.equal(validChallengeDate('2026-02-30','2026-09-21'),false);assert.equal(validChallengeDate('2099-01-01','2026-09-21'),false);assert.equal(validChallengeDate('2026-09-20','2026-09-21'),true);
 const g=game(),before=snapshot(g);assert.equal(g.resetState({mode:'daily',challengeDate:'2099-01-01'}).ok,false);assert.equal(snapshot(g),before);
 assert.ok(parseInvitation('?challenge=2026-09-20&rules=0.5.0').error);assert.ok(parseInvitation('?rules=0.6.0&seed=x&house=evil').error);assert.ok(parseInvitation('?rules=0.6.0&seed=%3Cscript%3E').error);
});
test('invitations round-trip and carry matching specialty; all scores explicitly self-reported',()=>{
 const g=launch('grid','SEED_123'),p=g.shareResult();assert.match(p.text,/CHECKPOINT/);assert.match(p.text,/Self-reported/);const result=parseInvitation(new URL(p.url).search);assert.equal(result.specialty,'grid');assert.equal(result.seed,'SEED_123');const before=snapshot(g);parseInvitation('?rules=0.6.0&challenge=2026-09-20');assert.equal(snapshot(g),before);finish(g);assert.match(g.shareResult().text,/FINAL RESULT/);
});
test('results reconcile expense accounting and preserve records across specialty/mode groups',()=>{
 const store=memory(),g=createGame({storage:store});for(const specialty of ['independent','grid','logistics']){g.resetState({specialty,seed:'RECORDS'});g.purchaseUpgrade('carrier');finish(g);assert.equal(g.getRecords().length,1);assert.equal(g.getState().result.upgradeCosts,1500);reconcile(g);}assert.equal(JSON.parse(store.getItem(RECORDS_KEY)).length,3);
 g.resetState({mode:'daily',challengeDate:'2026-09-20'});finish(g);assert.equal(g.getRecords().length,1);assert.equal(JSON.parse(store.getItem(RECORDS_KEY)).length,4);
});
test('v0.5 continuation preserves original world RNG, orders, journal, costs, and source save',()=>{
 const oldStore=memory(),old=oldGame({storage:oldStore,seed:'CONTINUE'});old.trade('inverters',1,7);const c=old.getState().offers[0];old.acceptContract(c.id);for(let n=0;n<7;n++)old.advanceDay();const raw=JSON.stringify(old.getState());
 const store=memory({[V5_KEY]:raw}),g=createGame({storage:store});assert.equal(store.getItem(V5_KEY),raw);assert.equal(g.getState().legacyRules,true);assert.deepEqual(g.getState().prices,old.getState().prices);assert.deepEqual(g.getState().journal,old.getState().journal);assert.equal(g.purchaseUpgrade('carrier').ok,false);assert.equal(g.shareResult().ok,false);
 for(let n=0;n<12;n++){old.advanceDay();g.advanceDay();assert.deepEqual(g.getState().prices,old.getState().prices);assert.deepEqual(g.getState().offers,old.getState().offers);assert.deepEqual(g.getState().activeConditions,old.getState().activeConditions);approx(g.netWorth(),old.netWorth());}
 const loaded=createGame({storage:store});assert.equal(loaded.getState().day,g.getState().day);assert.equal(loaded.getState().legacyRules,true);assert.equal(store.getItem(V5_KEY),raw);finish(g);assert.equal(g.getRecords().length,0);reconcile(g);
});
test('failed backup blocks new campaign and leaves live progress intact',()=>{
 const store=memory(),g=createGame({storage:store});g.trade('copper',1,10);const before=snapshot(g);store.setItem=()=>{throw Error('Quota');};assert.equal(g.resetState({seed:'NEW'}).ok,false);assert.equal(snapshot(g),before);assert.match(g.getStorageWarning(),/Export/);
});
test('company names are bounded; invalid house never overwrites a campaign',()=>{
 const g=game(),before=snapshot(g);assert.equal(g.resetState({specialty:'nothing'}).ok,false);assert.equal(snapshot(g),before);g.resetState({companyName:'A'.repeat(400)+'\x00'});assert.equal(g.getState().company.name.length,40);
});
