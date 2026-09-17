import {STARTING_CASH,MAX_DAYS,STORAGE_KEY,assets,hubs,scenarioDeck} from './v02-data.js';

const assetById=id=>assets.find(a=>a.id===id);
const hubById=id=>hubs.find(h=>h.id===id);

function freshHubDrift(){
  const drift={};
  hubs.forEach(h=>{drift[h.id]={};assets.forEach(a=>{drift[h.id][a.id]=1;});});
  return drift;
}
function freshReasons(){
  const reasons={};
  assets.forEach(a=>{reasons[a.id]={event:0,noise:0,meanReversion:0,total:0,eventTitle:'No repricing yet'};});
  return reasons;
}
function freshState(){
  const prices={},holdings={},avgCosts={},moves={};
  assets.forEach(a=>{prices[a.id]=a.price;holdings[a.id]=0;avgCosts[a.id]=0;moves[a.id]=0;});
  return {version:2,day:1,cash:STARTING_CASH,prices,holdings,avgCosts,moves,wealthHistory:[STARTING_CASH],currentHub:'newyork',hubDrift:freshHubDrift(),moveReasons:freshReasons(),currentEvent:{region:'GLOBAL',severity:2,title:'Shipping insurers raise risk premiums through a key trade corridor',body:'Longer routes and tighter capacity push transport costs higher. Energy and bulk commodities may move with freight.',duration:'2–4 days',effects:{freight:.08,oil:.025,wheat:.015},tags:['Shipping','Risk premium']},eventHistory:[],usedEvents:[],travelHistory:[],finished:false};
}
function loadState(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY);if(!raw)return freshState();
    const parsed=JSON.parse(raw);if(!parsed||parsed.version!==2||!parsed.prices||!parsed.holdings)return freshState();
    parsed.hubDrift||=freshHubDrift();parsed.moveReasons||=freshReasons();parsed.currentHub||='newyork';parsed.travelHistory||=[];return parsed;
  }catch(e){return freshState();}
}
let state=loadState();
function save(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}catch(e){}}

export const money=n=>'$'+Math.round(n).toLocaleString();
export const pct=n=>(n>0?'+':'')+(n*100).toFixed(1)+'%';
export const signedMoney=n=>(n>0?'+':'')+money(n);
export const getState=()=>state;
export const getAsset=assetById;
export const getHub=hubById;
export const currentHub=()=>hubById(state.currentHub)||hubs[0];

export function hubFactor(hubId,assetId){
  const hub=hubById(hubId)||hubs[0];
  return (hub.spreads[assetId]||1)*((state.hubDrift[hub.id]&&state.hubDrift[hub.id][assetId])||1);
}
export function localPrice(assetId,hubId=state.currentHub){return Math.max(1,state.prices[assetId]*hubFactor(hubId,assetId));}
export function holdingsValue(){return assets.reduce((s,a)=>s+state.holdings[a.id]*localPrice(a.id),0);}
export function netWorth(){return state.cash+holdingsValue();}
export function investedCost(){return assets.reduce((s,a)=>s+state.holdings[a.id]*state.avgCosts[a.id],0);}
export function unrealized(){return holdingsValue()-investedCost();}

export function trade(id,dir,qty=1){
  if(state.finished)return {ok:false,message:'This run is complete. Reset to play again.'};
  const asset=assetById(id),price=localPrice(id);
  if(dir>0){
    const cost=price*qty;if(state.cash<cost)return {ok:false,message:'Not enough cash for that trade.'};
    const oldQty=state.holdings[id],newQty=oldQty+qty;
    state.avgCosts[id]=((state.avgCosts[id]*oldQty)+(price*qty))/newQty;state.holdings[id]=newQty;state.cash-=cost;
    save();return {ok:true,message:`Bought ${qty} ${asset.ticker} in ${currentHub().name} at ${money(price)}.`};
  }
  if(state.holdings[id]<qty)return {ok:false,message:'You do not own enough to sell.'};
  state.holdings[id]-=qty;state.cash+=price*qty;if(state.holdings[id]===0)state.avgCosts[id]=0;
  save();return {ok:true,message:`Sold ${qty} ${asset.ticker} in ${currentHub().name} at ${money(price)}.`};
}

function chooseEvent(){
  let choices=scenarioDeck.map((_,i)=>i).filter(i=>!state.usedEvents.includes(i));
  if(!choices.length){state.usedEvents=[];choices=scenarioDeck.map((_,i)=>i);}
  const idx=choices[Math.floor(Math.random()*choices.length)];state.usedEvents.push(idx);return scenarioDeck[idx];
}
function updateHubDrift(ev){
  hubs.forEach(hub=>assets.forEach(asset=>{
    const regionalKick=ev.region===hub.region?(ev.effects[asset.id]||0)*.06:0;
    const micro=(Math.random()-.5)*.018,existing=state.hubDrift[hub.id][asset.id]||1;
    state.hubDrift[hub.id][asset.id]=Math.max(.94,Math.min(1.06,existing*(1+micro+regionalKick)));
  }));
}
function reprice(ev){
  assets.forEach(asset=>{
    const eventMove=ev.effects[asset.id]||0,severityScale=.68+ev.severity*.12,eventComponent=eventMove*severityScale;
    const noise=(Math.random()-.5)*2*asset.volatility,meanRevert=((asset.price-state.prices[asset.id])/asset.price)*.018;
    const move=Math.max(-.28,Math.min(.30,eventComponent+noise+meanRevert));
    state.moves[asset.id]=move;state.moveReasons[asset.id]={event:eventComponent,noise,meanReversion:meanRevert,total:move,eventTitle:ev.title};
    state.prices[asset.id]=Math.max(8,state.prices[asset.id]*(1+move));
  });
  updateHubDrift(ev);
}
export function advanceDay(options={}){
  if(state.finished)return {ok:false,message:'Campaign complete.'};
  const ev=chooseEvent(),nextDay=Math.min(MAX_DAYS,state.day+1);state.currentEvent=ev;
  state.eventHistory.unshift({...ev,day:nextDay});state.eventHistory=state.eventHistory.slice(0,18);reprice(ev);state.day=nextDay;state.wealthHistory.push(netWorth());
  if(state.day>=MAX_DAYS){state.finished=true;save();return {ok:true,message:`Campaign complete — final net worth ${money(netWorth())}.`};}
  save();
  return {ok:true,message:options.travelTo?`Arrived in ${hubById(options.travelTo).name}. Day ${state.day} markets repriced en route.`:`Day ${state.day}: ${ev.region} shock repriced the board.`};
}
export function travelTo(hubId){
  if(state.finished)return {ok:false,message:'This run is complete. Reset to play again.'};
  if(hubId===state.currentHub)return {ok:false,message:`You are already in ${currentHub().name}.`};
  if(state.day>=MAX_DAYS)return {ok:false,message:'No campaign days remain for travel.'};
  const hub=hubById(hubId);if(!hub)return {ok:false,message:'Unknown trading hub.'};
  if(state.cash<hub.travelCost)return {ok:false,message:`You need ${money(hub.travelCost)} to route to ${hub.name}.`};
  const from=currentHub();state.cash-=hub.travelCost;state.travelHistory.unshift({day:state.day+1,from:from.name,to:hub.name,cost:hub.travelCost});state.travelHistory=state.travelHistory.slice(0,12);state.currentHub=hub.id;
  return advanceDay({travelTo:hub.id});
}
export function resetState(){state=freshState();save();return state;}
