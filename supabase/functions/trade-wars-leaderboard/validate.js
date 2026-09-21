import {createGame} from './rules.js';
import {PROOF_VERSION,MAX_ACTIONS,boardMeta,ProofError} from './protocol.js';
const SUMMARY=['worth','cash','inventory','startingCash','realized','contractProfit','travelCosts','upgradeCosts','forfeits','unrealized','escrow','trades','deliveries'];
const TYPES={buy:['type','asset','qty'],sell:['type','asset','qty'],advance:['type'],close:['type'],travel:['type','hub'],accept:['type','id'],deliver:['type','id'],cancel:['type','id'],upgrade:['type','id']};
const fail=m=>{throw new ProofError(m);};
const same=(a,b)=>typeof a==='number'&&Number.isFinite(a)&&Math.abs(a-b)<=0.00001;
function cleanCompany(value){
  if(typeof value!=='string')fail('Company name is required.');
  const s=value.normalize('NFKC').trim();
  if(!s||s.length>40||/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(s))fail('Company name must be 1–40 characters without control characters.');
  return s;
}
export function validateReplay(proof,today=new Date().toISOString().slice(0,10)){
  if(!proof||proof.proofVersion!==PROOF_VERSION)fail('Unsupported replay format.');
  const meta=boardMeta(proof.meta,today),companyName=cleanCompany(proof.companyName);
  if(!Array.isArray(proof.actions)||proof.actions.length<1||proof.actions.length>MAX_ACTIONS)fail(`A replay must contain 1–${MAX_ACTIONS} decisions.`);
  const game=createGame({seed:meta.seed,storage:{getItem:()=>null,setItem:()=>{}},now:()=>new Date(today+'T12:00:00Z')});
  const setup=game.resetState({seed:meta.seed,mode:meta.mode,specialty:meta.specialty,challengeDate:meta.challengeDate,companyName});
  if(!setup.ok)fail('Invalid starting setup.');
  for(let i=0;i<proof.actions.length;i++){
    const a=proof.actions[i],fields=a&&Object.hasOwn(TYPES,a.type)?TYPES[a.type]:null;
    if(!fields||Object.getPrototypeOf(a)!==Object.prototype||Object.keys(a).length!==fields.length||Object.keys(a).some(k=>!fields.includes(k)))fail(`Unsupported decision at step ${i+1}.`);
    if(game.getState().finished)fail('Replay has decisions after campaign closure.');
    let result;
    switch(a.type){
      case 'buy':case 'sell':result=game.trade(a.asset,a.type==='buy'?1:-1,a.qty);break;
      case 'advance':result=game.advanceDay();break;
      case 'travel':result=game.travelTo(a.hub);break;
      case 'accept':result=game.acceptContract(a.id);break;
      case 'deliver':result=game.fulfillContract(a.id);break;
      case 'cancel':result=game.cancelContract(a.id);break;
      case 'upgrade':result=game.purchaseUpgrade(a.id);break;
      case 'close':result=game.finishCampaign();break;
    }
    if(!result?.ok)fail(`Replay rejected at step ${i+1}: ${result?.message||'invalid decision'}`);
  }
  const state=game.getState(),r=game.campaignReport();
  if(!state.finished||state.day!==30)fail('Only closed Day 30 campaigns can be ranked.');
  for(const k of SUMMARY)if(!same(proof.expected?.[k],r[k]))fail(`Replayed ${k} does not match the recorded result. Nothing was posted.`);
  if(!proof.final||proof.final.hub!==state.currentHub)fail('Final hub does not match replay.');
  for(const key of ['holdings','avgCosts']){
    const candidate=proof.final[key];
    if(!candidate||Object.keys(candidate).length!==Object.keys(state[key]).length)fail('Final inventory is incomplete.');
    for(const [id,val]of Object.entries(state[key]))if(!same(candidate[id],val))fail('Final inventory or cost basis does not match replay.');
  }
  const scoreCents=Math.round(r.worth*100);
  if(!Number.isSafeInteger(scoreCents)||scoreCents<0||scoreCents>1e14||SUMMARY.some(k=>!Number.isFinite(r[k])))fail('Score is outside the supported range.');
  return {meta,companyName:state.company.name,scoreCents,returnPct:r.returnPct,deliveries:r.deliveries,trades:r.trades,startingCash:r.startingCash,
    summary:Object.fromEntries([...SUMMARY,'returnPct','title','cities','maxDrawdown'].map(k=>[k,r[k]])),actionCount:proof.actions.length};
}
