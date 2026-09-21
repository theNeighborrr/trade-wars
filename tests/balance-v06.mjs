/* Small deterministic smoke simulation, not proof of human-play balance. */
import {createGame} from '../v06-engine.js';
import {specialties} from '../v06-data.js';
const memory=()=>{const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v)}};
const runs=[];
for(const specialty of specialties)for(let seed=0;seed<40;seed++)for(const policy of ['contracts','upgraded-contracts']){
 const g=createGame({storage:memory()});g.resetState({seed:'BALANCE-'+seed,specialty:specialty.id});
 if(policy==='upgraded-contracts'){g.purchaseUpgrade('carrier');g.purchaseUpgrade('procurement');}
 let actions=0;
 while(g.getState().day<30&&actions++<200){
  const s=g.getState();const offers=s.offers.map(c=>({c,cost:Object.entries(c.requirements).reduce((n,[id,q])=>n+q*g.localPrice(id),0),fare:c.hub===s.currentHub?0:g.travelCost(c.hub)})).filter(x=>x.c.deadline>=s.day+Number(x.fare>0)&&x.cost+x.fare+x.c.bond<=s.cash&&x.c.payout-x.cost-x.fare>100).sort((a,b)=>(b.c.payout-b.cost-b.fare)-(a.c.payout-a.cost-a.fare));
  if(offers.length){const {c}=offers[0];if(g.acceptContract(c.id).ok){for(const [id,q] of Object.entries(c.requirements))g.trade(id,1,q);if(c.hub!==s.currentHub)g.travelTo(c.hub);g.fulfillContract(c.id);continue;}}
  g.advanceDay();
 }
 g.finishCampaign();const r=g.campaignReport();const expected=r.openingEquity+r.realized+r.contractProfit+r.unrealized-r.openingUnrealized-r.travelCosts-r.forfeits-r.upgradeCosts;
 if(Math.abs(r.worth-expected)>.000001)throw Error('Accounting discrepancy');
 runs.push({specialty:specialty.id,seed,policy,worth:r.worth,returnPct:r.returnPct,deliveries:r.deliveries,travel:r.travelCosts,upgrades:r.upgradeCosts});
}
const groups=[];
for(const specialty of specialties)for(const policy of ['contracts','upgraded-contracts']){const r=runs.filter(x=>x.specialty===specialty.id&&x.policy===policy).sort((a,b)=>a.worth-b.worth);groups.push({specialty:specialty.id,policy,runs:r.length,min:r[0].worth,median:(r[19].worth+r[20].worth)/2,max:r.at(-1).worth,meanDeliveries:r.reduce((n,x)=>n+x.deliveries,0)/r.length});}
console.log(JSON.stringify({disclaimer:'Illustrative greedy contract policies only. Does not establish balanced or optimal human gameplay.',campaigns:runs.length,groups,runs},null,2));
