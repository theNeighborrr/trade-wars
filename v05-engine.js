import {STARTING_CASH,MAX_DAYS,RULES,STORAGE_KEY,LEGACY_KEY,RECORDS_KEY,assets,hubs,conditions,contractTemplates} from './v05-data.js?cache=15';

const copy=value=>JSON.parse(JSON.stringify(value));
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const sum=xs=>xs.reduce((a,b)=>a+b,0);
const assetById=id=>assets.find(a=>a.id===id);
const hubById=id=>hubs.find(h=>h.id===id);
const perAsset=fn=>Object.fromEntries(assets.map(a=>[a.id,fn(a)]));
const perHub=fn=>Object.fromEntries(hubs.map(h=>[h.id,perAsset(a=>fn(h,a))]));
export const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n);
export const exactMoney=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2}).format(n);
export const pct=n=>(n>0?'+':'')+(n*100).toFixed(1)+'%';
export const signedMoney=n=>(n>0?'+':'')+money(n);
export const getAsset=assetById;
export const getHub=hubById;
/* Coordinate-keyed randomness: trade, travel, rendering and reload never consume
   the world RNG. A replay has the same world on the same numbered day. */
export function randomAt(seed,key){
  let h=2166136261;for(const c of `${RULES}|${seed}|${key}`){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}
  h^=h>>>16;h=Math.imul(h,0x7feb352d);h^=h>>>15;h=Math.imul(h,0x846ca68b);h^=h>>>16;
  return (h>>>0)/4294967296;
}
function newSeed(){return `TW-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`;}
function seedText(value){return String(value||newSeed()).replace(/[^a-zA-Z0-9_-]/g,'').slice(0,48)||'TRADE-WARS';}
function browserStorage(){try{return globalThis.localStorage||null;}catch{return null;}}

export function createGame({storage=browserStorage(),seed}={}){
  let storageWarning='',loadNotice='';
  const read=key=>{try{return storage?.getItem(key)||null;}catch{storageWarning='Saving is unavailable. Export your campaign before closing.';return null;}};
  const write=(key,value)=>{try{if(!storage)throw Error();storage.setItem(key,value);return true;}catch{storageWarning='Saving is unavailable. Export your campaign before closing.';return false;}};
  function fresh(seedValue){
    return {version:5,rules:RULES,seed:seedText(seedValue),runId:`run-${Date.now()}-${Math.random().toString(36).slice(2,9)}`,day:1,worldStartDay:1,coverageStart:1,migrated:false,cash:STARTING_CASH,
      prices:perAsset(a=>a.price),fundamentals:perAsset(a=>a.price),holdings:perAsset(()=>0),avgCosts:perAsset(()=>0),moves:perAsset(()=>0),premiums:perAsset(()=>0),regionalPremiums:perHub(()=>0),hubDrift:perHub(()=>1),
      currentHub:'newyork',moveReasons:{},wealthHistory:[STARTING_CASH],priceHistory:[],activeConditions:[],eventHistory:[],journal:[],travelHistory:[],offers:[],contracts:[],escrow:0,finished:false,result:null,
      lastTurn:null,openingEquity:STARTING_CASH,openingUnrealized:0,sequence:0};
  }
  function basicValid(s){
    if(!s||![2,5].includes(s.version)||!Number.isInteger(s.day)||s.day<1||s.day>MAX_DAYS||!Number.isFinite(s.cash)||s.cash<-.00001||!s.prices||!s.holdings||!s.avgCosts)return false;
    return Object.keys(s.holdings).every(id=>Number.isSafeInteger(s.holdings[id])&&s.holdings[id]>=0)
      &&Object.values(s.prices).every(p=>Number.isFinite(p)&&p>0)
      &&Object.values(s.avgCosts).every(p=>Number.isFinite(p)&&p>=0);
  }
  function validV5(s){
    return basicValid(s)&&s.version===5&&s.rules===RULES&&typeof s.seed==='string'&&hubById(s.currentHub)
      &&assets.every(a=>Number.isFinite(s.prices[a.id])&&Number.isFinite(s.fundamentals?.[a.id])&&Number.isSafeInteger(s.holdings[a.id])&&Number.isFinite(s.avgCosts[a.id]))
      &&['journal','priceHistory','activeConditions','eventHistory','travelHistory','offers','contracts','wealthHistory'].every(k=>Array.isArray(s[k]))
      &&Number.isInteger(s.coverageStart)&&s.coverageStart>=1&&s.coverageStart<=s.day&&s.priceHistory.length>0&&s.currentEvent&&typeof s.currentEvent.title==='string'&&s.currentEvent.effects
      &&Number.isInteger(s.sequence)&&s.sequence>=0&&Number.isInteger(s.worldStartDay)&&s.worldStartDay>=1&&s.worldStartDay<=s.day
      &&hubs.every(h=>assets.every(a=>Number.isFinite(s.hubDrift?.[h.id]?.[a.id])&&s.hubDrift[h.id][a.id]>0&&Number.isFinite(s.regionalPremiums?.[h.id]?.[a.id])))
      &&assets.every(a=>Number.isFinite(s.premiums?.[a.id]))&&Number.isFinite(s.openingEquity)&&Number.isFinite(s.openingUnrealized)&&Number.isFinite(s.escrow)&&s.escrow>=0;
  }
  let state;
  function hubFactor(hubId,assetId){
    const h=hubById(hubId)||hubs[0];return (h.spreads[assetId]||1)*(state.hubDrift[h.id]?.[assetId]||1)*(1+(state.regionalPremiums[h.id]?.[assetId]||0));
  }
  function localPrice(id,hubId=state.currentHub){return Math.max(1,state.prices[id]*hubFactor(hubId,id));}
  const currentHub=()=>hubById(state.currentHub)||hubs[0];
  const holdingsValue=()=>sum(assets.map(a=>state.holdings[a.id]*localPrice(a.id)));
  const netWorth=()=>state.cash+holdingsValue()+state.escrow;
  const investedCost=()=>sum(assets.map(a=>state.holdings[a.id]*state.avgCosts[a.id]));
  const unrealized=()=>holdingsValue()-investedCost();
  function save(){return write(STORAGE_KEY,JSON.stringify(state));}
  function mark(){
    state.wealthHistory[state.wealthHistory.length-1]=netWorth();
  }
  function record(type,fields){const entry={id:++state.sequence,type,day:state.day,hub:state.currentHub,...fields};state.journal.push(entry);return entry;}
  function worldConditions(day){
    const order=[...conditions].sort((a,b)=>randomAt(state.seed,`deck/${a.id}`)-randomAt(state.seed,`deck/${b.id}`));
    const out=[];
    for(let start=state.worldStartDay,i=0;start<=day;start+=3,i++){
      const def=order[i%order.length],age=day-start;
      if(age>def.develop+def.active+def.ease)continue;
      let phase,weight=0,title,remaining=0;
      if(age<def.develop){phase='developing';weight=.18;title=def.developing;remaining=def.develop-age;}
      else if(randomAt(state.seed,`outcome/${start}/${def.id}`)>=def.chance){
        if(age>def.develop+1)continue;
        phase='resolved';title=def.averted;
      }else if(age<def.develop+def.active){phase='active';weight=.7+.3*(age-def.develop)/Math.max(1,def.active-1);title=def.activeTitle;remaining=def.develop+def.active-age;}
      else if(age<def.develop+def.active+def.ease){phase='easing';weight=(def.develop+def.active+def.ease-age)/(def.ease+1);title=`${def.name}: pressure is easing`;remaining=def.develop+def.active+def.ease-age;}
      else{phase='resolved';title=`${def.name}: conditions normalize`;}
      out.push({id:`${def.id}-${start}`,name:def.name,region:def.region,severity:def.severity,phase,weight,title,body:def.body,start,remaining,effects:{...def.effects},duration:phase==='developing'?`Decision in ${remaining} session${remaining===1?'':'s'}`:phase==='resolved'?'Resolved':`${remaining} session${remaining===1?'':'s'} in this stage`});
    }
    return out;
  }
  function setNews(previous=[]){
    const updates=state.activeConditions.filter(c=>previous.find(p=>p.id===c.id)?.phase!==c.phase);
    updates.forEach(c=>state.eventHistory.unshift({...c,day:state.day}));
    const event=updates.find(c=>c.phase==='active')||updates[0]||state.activeConditions.find(c=>c.phase==='active')||state.activeConditions[0];
    state.currentEvent=event||{title:'Markets await the next development',body:'No active supply conditions. Prices still respond to ordinary volatility.',region:'GLOBAL',severity:1,effects:{},phase:'clear',duration:'No active condition'};
  }
  function priceSnapshot(){state.priceHistory.push({day:state.day,global:{...state.prices},hubs:perHub((h,a)=>localPrice(a.id,h.id))});}
  function offerBatch(){
    if(state.day>24||!((state.day-state.worldStartDay)%5===0))return;
    state.offers=[];
    contractTemplates.forEach((template,i)=>{
      const h=hubs[Math.floor(randomAt(state.seed,`contract/${state.day}/${i}/hub`)*hubs.length)];
      const scale=1+Math.floor(randomAt(state.seed,`contract/${state.day}/${i}/size`)*2);
      const requirements=Object.fromEntries(Object.entries(template.requirements).map(([id,n])=>[id,n*scale]));
      const quote=sum(Object.entries(requirements).map(([id,n])=>n*localPrice(id,h.id)));
      const payout=Math.round(quote*1.24+h.travelCost*.65),bond=Math.max(100,Math.round(payout*.05));
      state.offers.push({id:`C-${state.day}-${i+1}`,name:template.name,hub:h.id,requirements,payout,bond,created:state.day,expires:Math.min(28,state.day+3),deadline:Math.min(MAX_DAYS,state.day+7+i),status:'offered'});
    });
  }
  function initialize(){
    state.activeConditions=worldConditions(state.day);setNews();priceSnapshot();offerBatch();save();
  }
  function migrate(old){
    const s=fresh(`LEGACY-${old.day}-${Math.round(old.cash)}`);
    for(const a of assets){if(Number.isFinite(old.prices[a.id])){s.prices[a.id]=old.prices[a.id];s.fundamentals[a.id]=old.prices[a.id];s.holdings[a.id]=old.holdings[a.id]||0;s.avgCosts[a.id]=old.avgCosts[a.id]||0;}}
    s.day=old.day;s.worldStartDay=old.day;s.coverageStart=old.day;s.migrated=true;s.cash=old.cash;s.currentHub=hubById(old.currentHub)?old.currentHub:'newyork';
    for(const h of hubs)for(const a of assets){const d=old.hubDrift?.[h.id]?.[a.id];if(Number.isFinite(d)&&d>0)s.hubDrift[h.id][a.id]=d;}
    s.finished=!!old.finished;s.wealthHistory=[0];return s;
  }
  const raw=read(STORAGE_KEY),legacy=read(LEGACY_KEY);
  try{
    const parsed=raw?JSON.parse(raw):null;
    if(parsed&&!validV5(parsed))throw Error('Unrecognized save');
    if(parsed)state=parsed;
    else if(!seed&&legacy){
      const old=JSON.parse(legacy);if(!basicValid(old))throw Error('Invalid legacy save');
      state=migrate(old);state.openingEquity=netWorth();state.openingUnrealized=unrealized();mark();initialize();
      loadNotice=`Campaign preserved from v0.4. Journal and price history begin on Day ${state.day}; earlier trades cannot be reconstructed. The original save is unchanged.`;
    }else{state=fresh(seed);initialize();}
  }catch{
    if(raw)write(`${STORAGE_KEY}-unreadable-backup`,raw);
    state=fresh(seed);loadNotice='The previous save could not be read. Its stored copy was not overwritten; this session is a new campaign.';
    // Preserve the original under its key until the user takes a game action.
    state.activeConditions=worldConditions(1);setNews();priceSnapshot();offerBatch();
  }
  if(state.finished&&!state.result){state.result=campaignReport();save();}

  function previewTrade(id,dir,qty){
    if(!assetById(id)||![1,-1].includes(dir)||!Number.isSafeInteger(qty)||qty<1||qty>10000000)return {ok:false,message:'Enter a whole-number quantity from 1 to 10,000,000.'};
    if(state.finished)return {ok:false,message:'Campaign closed. Start a new run to trade.'};
    const price=localPrice(id),owned=state.holdings[id],total=price*qty;
    if(dir===1&&total>state.cash+1e-8)return {ok:false,message:'Not enough cash for this quantity.'};
    if(dir===-1&&qty>owned)return {ok:false,message:'You do not own enough to sell this quantity.'};
    const ownedAfter=owned+dir*qty,cashAfter=state.cash-dir*total;
    return {ok:true,assetId:id,qty,price,total,cashAfter:Math.max(0,cashAfter),ownedAfter,averageAfter:ownedAfter===0?0:dir===1?(state.avgCosts[id]*owned+total)/ownedAfter:state.avgCosts[id],realized:dir===-1?(price-state.avgCosts[id])*qty:null,dir};
  }
  function trade(id,dir,qty=1){
    const p=previewTrade(id,dir,qty);if(!p.ok)return p;
    state.cash=p.cashAfter;state.holdings[id]=p.ownedAfter;state.avgCosts[id]=p.averageAfter;
    const receipt=record(dir===1?'buy':'sell',{...p});mark();save();
    return {ok:true,receipt,message:`${dir===1?'BOUGHT':'SOLD'} · ${qty} ${assetById(id).ticker} · ${exactMoney(p.total)} ${dir===1?'paid':'received'}${dir===-1?' · '+signedMoney(p.realized)+' realized':''}`};
  }
  function reprice(){
    const previousPrices={...state.prices},previousMoves={...state.moves};
    const oldConditions=state.activeConditions;state.activeConditions=worldConditions(state.day);
    const newPremium=perAsset(a=>clamp(sum(state.activeConditions.map(c=>(c.effects[a.id]||0)*c.weight)),-.45,.65));
    assets.forEach(a=>{
      const noise=(randomAt(state.seed,`noise/${state.day}/${a.id}`)-.5)*2*a.volatility*.65;
      const meanReversion=(a.price/state.fundamentals[a.id]-1)*.035;
      const supplyChain=sum(Object.entries(a.inputs||{}).map(([id,w])=>(previousMoves[id]||0)*w));
      const fundamentalMove=clamp(noise+meanReversion+supplyChain,-.20,.20);
      const previousPremium=state.premiums[a.id]||0;
      state.fundamentals[a.id]=Math.max(8,state.fundamentals[a.id]*(1+fundamentalMove));
      state.prices[a.id]=Math.max(8,state.fundamentals[a.id]*(1+newPremium[a.id]));
      const total=state.prices[a.id]/previousPrices[a.id]-1;
      const event=(1+fundamentalMove)*((1+newPremium[a.id])/(1+previousPremium)-1);
      state.moves[a.id]=total;state.moveReasons[a.id]={noise,meanReversion,supplyChain,event,adjustment:total-noise-meanReversion-supplyChain-event,total,eventTitle:'Active condition premiums + ordinary market movement'};
    });
    state.premiums=newPremium;
    hubs.forEach(h=>assets.forEach(a=>{
      state.hubDrift[h.id][a.id]=clamp((state.hubDrift[h.id][a.id]||1)*.985+.015+(randomAt(state.seed,`hub/${state.day}/${h.id}/${a.id}`)-.5)*.014,.93,1.07);
      state.regionalPremiums[h.id][a.id]=clamp(sum(state.activeConditions.filter(c=>c.region===h.region).map(c=>(c.effects[a.id]||0)*c.weight*.35)),-.18,.25);
    }));
    setNews(oldConditions);
  }
  function expireContracts(){
    state.contracts.filter(c=>c.status==='accepted'&&state.day>c.deadline).forEach(c=>{
      c.status='expired';state.escrow=Math.max(0,state.escrow-c.bond);record('forfeit',{contractId:c.id,total:c.bond,message:`Deadline missed: ${c.name}`});
    });
    state.offers=state.offers.filter(c=>c.expires>=state.day);
  }
  function advanceDay(options={}){
    if(state.finished)return {ok:false,message:'Campaign closed.'};
    if(state.day===MAX_DAYS)return {ok:false,message:'Day 30 is your last trading session. Close the campaign when ready.'};
    const before=perAsset(a=>state.holdings[a.id]*localPrice(a.id,options.fromHub||state.currentHub));
    const qty={...state.holdings},from=options.fromHub||state.currentHub;
    state.day++;reprice();expireContracts();offerBatch();priceSnapshot();state.wealthHistory.push(netWorth());
    state.lastTurn={day:state.day,fromHub:from,toHub:state.currentHub,travelCost:options.travelCost||0,quantities:qty,marks:perAsset(a=>qty[a.id]*localPrice(a.id)-before[a.id])};
    save();return {ok:true,dayAdvanced:true,message:options.travelTo?`Arrived in ${currentHub().name} · Day ${state.day}.`:`Day ${state.day} · ${state.day===30?'Final trading session is open.':'Markets repriced.'}`};
  }
  function travelTo(hubId){
    const h=hubById(hubId);if(!h)return {ok:false,message:'Unknown hub.'};
    if(state.finished||state.day>=MAX_DAYS)return {ok:false,message:'No travel days remain.'};
    if(hubId===state.currentHub)return {ok:false,message:'Already in this hub.'};
    if(state.cash<h.travelCost)return {ok:false,message:`Travel requires ${money(h.travelCost)} in available cash.`};
    const from=state.currentHub;state.cash-=h.travelCost;state.currentHub=hubId;
    const entry={day:state.day+1,from:hubById(from).name,to:h.name,cost:h.travelCost};state.travelHistory.push(entry);
    record('travel',{hub:from,fromHub:from,toHub:hubId,total:h.travelCost,arrivalDay:state.day+1});
    return advanceDay({fromHub:from,travelTo:hubId,travelCost:h.travelCost});
  }
  function acceptContract(id){
    const c=state.offers.find(c=>c.id===id);
    if(state.finished||!c||state.day>c.expires||state.contracts.some(x=>x.id===id))return {ok:false,message:'This offer is no longer available.'};
    if(state.contracts.filter(c=>c.status==='accepted').length>=3)return {ok:false,message:'Complete or cancel a contract first (three active maximum).'};
    if(state.cash<c.bond)return {ok:false,message:`Accepting this offer requires a ${money(c.bond)} performance bond.`};
    state.cash-=c.bond;state.escrow+=c.bond;state.contracts.push({...copy(c),status:'accepted',accepted:state.day});state.offers=state.offers.filter(x=>x.id!==id);
    record('bond',{contractId:id,total:c.bond,message:`Accepted: ${c.name}`});mark();save();return {ok:true,message:`Contract accepted. ${money(c.bond)} held as a refundable bond.`};
  }
  function deliveryPreview(id){
    const c=state.contracts.find(c=>c.id===id);
    if(state.finished||!c||c.status!=='accepted'||state.day>c.deadline)return {ok:false,message:'This contract is not active.'};
    if(state.currentHub!==c.hub)return {ok:false,message:`Deliver in ${hubById(c.hub).name}.`};
    if(Object.entries(c.requirements).some(([a,n])=>state.holdings[a]<n))return {ok:false,message:'Acquire the required inventory before delivering.'};
    const cost=sum(Object.entries(c.requirements).map(([a,n])=>state.avgCosts[a]*n));
    return {ok:true,contract:c,total:c.payout,bond:c.bond,cost,realized:c.payout-cost};
  }
  function fulfillContract(id){
    const p=deliveryPreview(id);if(!p.ok)return p;
    const c=p.contract;
    Object.entries(c.requirements).forEach(([a,n])=>{state.holdings[a]-=n;if(!state.holdings[a])state.avgCosts[a]=0;});
    state.cash+=c.payout+c.bond;state.escrow=Math.max(0,state.escrow-c.bond);c.status='fulfilled';c.completed=state.day;
    const receipt=record('delivery',{contractId:id,total:c.payout,bondReturned:c.bond,cost:p.cost,realized:p.realized,requirements:{...c.requirements},message:c.name});mark();save();
    return {ok:true,receipt,message:`DELIVERED · ${money(c.payout)} paid + ${money(c.bond)} bond returned · ${signedMoney(p.realized)} realized.`};
  }
  function cancelContract(id){
    const c=state.contracts.find(c=>c.id===id&&c.status==='accepted');if(!c||state.finished)return {ok:false,message:'No active contract to cancel.'};
    c.status='cancelled';state.escrow=Math.max(0,state.escrow-c.bond);record('forfeit',{contractId:id,total:c.bond,message:`Cancelled: ${c.name}`});mark();save();
    return {ok:true,message:`Contract cancelled. ${money(c.bond)} bond forfeited.`};
  }
  function localMove(id,hubId=state.currentHub){
    const hist=state.priceHistory;if(hist.length<2)return null;
    const last=hist[hist.length-2].hubs[hubId]?.[id];return last?localPrice(id,hubId)/last-1:null;
  }
  function campaignReport(){
    const sales=state.journal.filter(x=>x.type==='sell'),deliveries=state.journal.filter(x=>x.type==='delivery');
    const realized=sum(sales.map(x=>x.realized)),contractProfit=sum(deliveries.map(x=>x.realized));
    const travelCosts=sum(state.journal.filter(x=>x.type==='travel').map(x=>x.total));
    const forfeits=sum(state.journal.filter(x=>x.type==='forfeit').map(x=>x.total));
    const byAsset=perAsset(a=>sum(sales.filter(x=>x.assetId===a.id).map(x=>x.realized)));
    const bestAsset=assets.filter(a=>byAsset[a.id]>0).sort((a,b)=>byAsset[b.id]-byAsset[a.id])[0];
    const bestSale=[...sales].sort((a,b)=>b.realized-a.realized)[0]||null,worstSale=[...sales].sort((a,b)=>a.realized-b.realized)[0]||null;
    const worth=netWorth(),returnPct=worth/STARTING_CASH-1;
    const title=deliveries.length>=3?'Grid Contractor':bestAsset?.id==='freight'?'Freight Baron':returnPct>=.5?'Trade Magnate':state.travelHistory.length>=4&&travelCosts>Math.max(0,realized+contractProfit)?'Frequent Flyer':returnPct<-.2?'Risk Taker':'Global Trader';
    let peak=state.openingEquity,maxDrawdown=0;
    for(const v of state.wealthHistory){peak=Math.max(peak,v);maxDrawdown=Math.max(maxDrawdown,peak?(peak-v)/peak:0);}
    return {runId:state.runId,seed:state.seed,rules:RULES,worth,returnPct,realized,contractProfit,travelCosts,forfeits,inventory:holdingsValue(),escrow:state.escrow,unrealized:unrealized(),cash:state.cash,bestSale,worstSale,bestAsset:bestAsset?.name||null,byAsset,title,deliveries:deliveries.length,trades:state.journal.filter(x=>['buy','sell'].includes(x.type)).length,cities:new Set([state.currentHub,...state.journal.filter(x=>x.type==='travel').flatMap(x=>[x.fromHub,x.toHub])]).size,maxDrawdown,migrated:state.migrated,coverageStart:state.coverageStart,openingEquity:state.openingEquity,openingUnrealized:state.openingUnrealized};
  }
  function getRecords(){try{const r=JSON.parse(read(RECORDS_KEY)||'[]');return Array.isArray(r)?r.filter(x=>x.rules===RULES&&Number.isFinite(x.worth)):[];}catch{return [];}}
  function finishCampaign(){
    if(state.finished)return {ok:false,message:'Campaign is already closed.'};
    if(state.day!==MAX_DAYS)return {ok:false,message:'The campaign closes after your Day 30 trading session.'};
    for(const c of state.contracts.filter(c=>c.status==='accepted')){c.status='expired';state.escrow=Math.max(0,state.escrow-c.bond);record('forfeit',{contractId:c.id,total:c.bond,message:`Campaign closed before delivery: ${c.name}`});}
    mark();state.finished=true;state.result=campaignReport();
    if(!state.migrated){const records=getRecords().filter(r=>r.runId!==state.runId);records.push({runId:state.runId,seed:state.seed,rules:RULES,worth:state.result.worth,returnPct:state.result.returnPct,title:state.result.title});write(RECORDS_KEY,JSON.stringify(records.sort((a,b)=>b.worth-a.worth).slice(0,10)));}
    save();return {ok:true,finished:true,message:`Campaign complete · ${money(state.result.worth)} · ${pct(state.result.returnPct)}`};
  }
  function resetState({seed:nextSeed,replay=false}={}){
    if(replay&&state.migrated)return {ok:false,message:'The pre-upgrade random world cannot be reconstructed. Start a new v0.5 scenario.'};
    write(`${STORAGE_KEY}-previous`,JSON.stringify(state));state=fresh(replay?state.seed:nextSeed);loadNotice='';initialize();return {ok:true,message:`Fresh campaign · seed ${state.seed}`};
  }
  return {getState:()=>state,currentHub,hubFactor,localPrice,localMove,holdingsValue,netWorth,investedCost,unrealized,previewTrade,trade,advanceDay,travelTo,acceptContract,deliveryPreview,fulfillContract,cancelContract,finishCampaign,resetState,campaignReport,getRecords,getStorageWarning:()=>storageWarning,getLoadNotice:()=>loadNotice,exportCampaign:()=>JSON.stringify(state,null,2)};
}
const game=createGame();
export const getState=(...a)=>game.getState(...a),currentHub=(...a)=>game.currentHub(...a),hubFactor=(...a)=>game.hubFactor(...a),localPrice=(...a)=>game.localPrice(...a),localMove=(...a)=>game.localMove(...a),holdingsValue=(...a)=>game.holdingsValue(...a),netWorth=(...a)=>game.netWorth(...a),investedCost=(...a)=>game.investedCost(...a),unrealized=(...a)=>game.unrealized(...a),previewTrade=(...a)=>game.previewTrade(...a),trade=(...a)=>game.trade(...a),advanceDay=(...a)=>game.advanceDay(...a),travelTo=(...a)=>game.travelTo(...a),acceptContract=(...a)=>game.acceptContract(...a),deliveryPreview=(...a)=>game.deliveryPreview(...a),fulfillContract=(...a)=>game.fulfillContract(...a),cancelContract=(...a)=>game.cancelContract(...a),finishCampaign=(...a)=>game.finishCampaign(...a),resetState=(...a)=>game.resetState(...a),campaignReport=(...a)=>game.campaignReport(...a),getRecords=(...a)=>game.getRecords(...a),getStorageWarning=(...a)=>game.getStorageWarning(...a),getLoadNotice=(...a)=>game.getLoadNotice(...a),exportCampaign=(...a)=>game.exportCampaign(...a);
