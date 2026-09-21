/* Trading Houses: explicit game rules. No live news, real money, or remote accounts. */
export {STARTING_CASH,MAX_DAYS,assets,hubs,conditions,palette} from './v05-data.js?cache=15';
export const RULES = '0.6.0';
export const STORAGE_KEY = 'trade-wars-campaign-v6';
export const LEGACY_KEY = 'trade-wars-prototype-v2';
export const V5_KEY = 'trade-wars-campaign-v5';
export const RECORDS_KEY = 'trade-wars-records-v6';
export const ATTEMPTS_KEY = 'trade-wars-daily-attempts-v6';
export const GAME_URL = 'https://theneighborrr.github.io/trade-wars/';
export const specialties = [
  {id:'independent',name:'Independent Trader',cash:50000,home:'newyork',travelFactor:1,bondFactor:1,clientBonus:0,clientIds:[],summary:'The largest starting bankroll. No discounts or contract bonuses.'},
  {id:'logistics',name:'Logistics Broker',cash:48000,home:'singapore',travelFactor:.75,bondFactor:1,clientBonus:.06,clientIds:['harborline','atlas'],summary:'25% lower travel costs and 6% higher Harborline / Atlas payouts. Starts with $2,000 less cash.'},
  {id:'grid',name:'Grid Contractor',cash:48500,home:'houston',travelFactor:1,bondFactor:.75,clientBonus:.06,clientIds:['meridian','northstar'],summary:'25% lower contract bonds and 6% higher Meridian / Northstar payouts. Starts with $1,500 less cash.'}
];
export const customers = [
  {id:'meridian',name:'Meridian Gridworks',business:'Grid developer',short:'MERIDIAN'},
  {id:'northstar',name:'Northstar Storage',business:'Storage integrator',short:'NORTHSTAR'},
  {id:'atlas',name:'Atlas Industrial',business:'Industrial distributor',short:'ATLAS'},
  {id:'harborline',name:'Harborline Logistics',business:'Shipping broker',short:'HARBORLINE'}
];
export const contractTemplates = [
  {name:'Grid expansion package',customerId:'meridian',requirements:{inverters:6,transformers:3}},
  {name:'Storage interconnection package',customerId:'northstar',requirements:{batteries:8,transformers:2}},
  {name:'Industrial supply package',customerId:'atlas',requirements:{steel:20,copper:15,chips:5}},
  {name:'Solar distribution package',customerId:'harborline',requirements:{modules:10,inverters:4}}
];
export const upgrades = [
  {id:'carrier',name:'Carrier Agreement',cost:1500,summary:'20% off future travel charges. Stacks with the Logistics Broker discount.',caution:'Non-refundable operating expense. It pays back only through later trips.'},
  {id:'procurement',name:'Procurement License',cost:2200,summary:'One larger package in each future tender round, with an 8% higher goods-price multiplier.',caution:'Larger orders tie up more cash. No benefit to existing offers; no tenders after Day 24.'},
  {id:'operations',name:'Operations Desk',cost:1800,summary:'Handle four active contracts instead of three.',caution:'Extra capacity, not free inventory or guaranteed profit.'}
];
export const getSpecialty=id=>specialties.find(x=>x.id===id);
export const getCustomer=id=>customers.find(x=>x.id===id);
export function customerTier(trust=0){return trust>=3?'Preferred':trust>=1?'Proven':'New relationship';}
export function utcDay(date=new Date()){return date.toISOString().slice(0,10);}
export function validChallengeDate(value,today=utcDay()){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||value<'2026-09-20'||value>today)return false;
  const date=new Date(`${value}T00:00:00Z`);return Number.isFinite(date.getTime())&&utcDay(date)===value;
}
export const dailySeed=date=>`DAILY-${date}`;
export function shareURL({challengeDate,seed,specialty='independent',rules=RULES}){
  const url=new URL(GAME_URL);url.searchParams.set('rules',rules);
  if(challengeDate)url.searchParams.set('challenge',challengeDate);
  else{url.searchParams.set('seed',seed);url.searchParams.set('house',specialty);}
  return url.href;
}
export function parseInvitation(search,today=utcDay()){
  const p=new URLSearchParams(search);if(!p.has('challenge')&&!p.has('seed'))return null;
  if(p.get('rules')!==RULES)return {error:'This link uses a different rules version. It will not be substituted with a different scenario.'};
  if(p.has('challenge'))return validChallengeDate(p.get('challenge'),today)?{mode:'daily',challengeDate:p.get('challenge'),specialty:'independent',seed:dailySeed(p.get('challenge'))}:{error:'This daily challenge date is invalid, not yet available, or predates this edition.'};
  const seed=p.get('seed'),specialty=p.get('house')||'independent';
  if(!seed||!/^[-_a-zA-Z0-9]{1,48}$/.test(seed)||!getSpecialty(specialty))return {error:'This scenario link has an invalid seed or specialty.'};
  return {mode:'free',seed,specialty};
}
