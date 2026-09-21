/* Authored game scenarios, not live reporting or economic forecasts. */
import {assets as coreAssets, hubs as coreHubs, palette} from './v02-data.js';
export {palette};
export const STARTING_CASH = 50000;
export const MAX_DAYS = 30;
export const RULES = '0.5.0';
export const STORAGE_KEY = 'trade-wars-campaign-v5';
export const LEGACY_KEY = 'trade-wars-prototype-v2';
export const RECORDS_KEY = 'trade-wars-records-v5';
export const assets = [
  ...coreAssets.map(a=>({...a, group:'core'})),
  {id:'modules',ticker:'PV',name:'Solar Modules',unit:'equipment lot',price:210,volatility:.04,group:'solar',sectors:['Solar','Trade'],leaderLabel:'Supply chain',leader:'Manufacturing · tariffs · freight',inputs:{freight:.12,steel:.04}},
  {id:'inverters',ticker:'PCU',name:'Power Inverters',unit:'equipment lot',price:340,volatility:.035,group:'solar',sectors:['Solar','Technology'],leaderLabel:'Supply chain',leader:'Semiconductors · copper',inputs:{chips:.22,copper:.12}},
  {id:'transformers',ticker:'TX',name:'Transformers',unit:'equipment lot',price:480,volatility:.03,group:'solar',sectors:['Grid','Industry'],leaderLabel:'Supply chain',leader:'Copper · steel · grid demand',inputs:{copper:.2,steel:.14}},
  {id:'batteries',ticker:'CELL',name:'Battery Cells',unit:'equipment lot',price:280,volatility:.045,group:'solar',sectors:['Storage','Trade'],leaderLabel:'Supply chain',leader:'Factory output · logistics',inputs:{freight:.1}}
];
const equipmentBasis={newyork:[1.08,1.04,1.08,1.06],houston:[1.05,1.01,1.02,1.04],rotterdam:[1.06,1.05,1.10,1.08],singapore:[.98,.96,1.03,.96],shanghai:[.90,.92,.97,.89],dubai:[1.03,1.05,1.06,1.02],saopaulo:[1.10,1.12,1.15,1.12]};
const coordinates={newyork:[-74,41],houston:[-95,30],rotterdam:[4,52],singapore:[104,1],shanghai:[121,31],dubai:[55,25],saopaulo:[-47,-24]};
export const hubs=coreHubs.map(h=>({...h,coords:coordinates[h.id],spreads:{...h.spreads,...Object.fromEntries(['modules','inverters','transformers','batteries'].map((id,i)=>[id,equipmentBasis[h.id][i]]))}}));
/* Effects are finite price-premium targets. They build and unwind, not compound
   by the headline percentage every day. Outcome rolls remain hidden until due. */
export const conditions=[
  {id:'port',name:'Port strike negotiations',region:'EUROPE',severity:2,develop:2,active:3,ease:2,chance:.62,effects:{freight:.18,steel:.04,modules:.05},developing:'Port workers warn of a possible walkout',activeTitle:'Port strike begins; cargo backlogs build',averted:'Port agreement averts the threatened strike',body:'Freight and delivered equipment are exposed. Talks may still avert the disruption.'},
  {id:'energy',name:'Energy corridor disruption',region:'MIDDLE EAST',severity:3,develop:1,active:3,ease:3,chance:.78,effects:{oil:.18,lng:.13,freight:.09},developing:'Reports of an infrastructure attack raise supply concerns',activeTitle:'Energy exports curtailed as inspections continue',averted:'Inspections clear the export facilities for operation',body:'This fictional attack scenario affects energy availability and transport risk, not every sector equally.'},
  {id:'tariffs',name:'Industrial tariff review',region:'NORTH AMERICA',severity:2,develop:2,active:4,ease:2,chance:.7,effects:{steel:.12,copper:.05,modules:.09},developing:'Industrial import duties enter policy review',activeTitle:'New industrial duties take effect',averted:'Industrial tariff proposal is withdrawn',body:'Local import costs can rise more than the global reference; the model does not score political parties.'},
  {id:'chips',name:'Semiconductor licensing review',region:'ASIA',severity:3,develop:2,active:3,ease:2,chance:.67,effects:{chips:.19,rare:.1},developing:'Chip exporters prepare for a licensing decision',activeTitle:'Advanced-chip export licenses tighten',averted:'Chip licensing review preserves existing access',body:'Inverter input costs respond to earlier semiconductor moves with a one-session lag.'},
  {id:'grain',name:'Crop survey uncertainty',region:'SOUTH AMERICA',severity:2,develop:2,active:3,ease:3,chance:.58,effects:{wheat:.20,freight:.03},developing:'Dry conditions put crop forecasts under review',activeTitle:'Crop survey confirms reduced harvest prospects',averted:'Rainfall stabilizes the crop outlook',body:'Replacement grain demand can support prices, but an improved survey can unwind that premium.'},
  {id:'grid',name:'Grid procurement round',region:'EUROPE',severity:2,develop:2,active:4,ease:2,chance:.74,effects:{transformers:.18,inverters:.11,batteries:.08,copper:.07,steel:.04},developing:'Grid operators prepare a new equipment tender',activeTitle:'Grid procurement awards boost equipment demand',averted:'Grid tender is postponed',body:'Transformer, inverter and storage demand rises only if the procurement round proceeds.'},
  {id:'pv',name:'Solar factory expansion',region:'ASIA',severity:2,develop:1,active:4,ease:2,chance:.72,effects:{modules:-.17,batteries:-.05},developing:'Module manufacturers prepare additional capacity',activeTitle:'New module lines ramp up output',averted:'Factory commissioning slips',body:'Extra supply can lower module prices; downstream equipment does not automatically follow.'},
  {id:'shipping',name:'Shipping route reopening',region:'GLOBAL',severity:2,develop:2,active:3,ease:2,chance:.65,effects:{freight:-.17,oil:-.04,lng:-.03},developing:'Carriers assess a shorter shipping route',activeTitle:'Carriers resume service on the shorter route',averted:'Route reopening is delayed',body:'Shorter transit times ease freight premiums if service actually resumes.'},
  {id:'election',name:'Post-election policy timetable',region:'NORTH AMERICA',severity:1,develop:2,active:3,ease:2,chance:.55,effects:{modules:.08,steel:.06,transformers:.04},developing:'Election shifts the timetable for an industrial policy vote',activeTitle:'Legislators approve the announced import-cost measures',averted:'Legislators defer the proposed measures',body:'Only a simulated policy action changes costs. A candidate or party winning is not inherently good or bad.'},
  {id:'minerals',name:'Mineral supply agreement',region:'GLOBAL',severity:2,develop:2,active:3,ease:2,chance:.7,effects:{rare:-.16,chips:-.04},developing:'Negotiators draft a critical-mineral access agreement',activeTitle:'Mineral access agreement opens additional supply',averted:'Mineral access talks end without agreement',body:'Easier supply access reduces modeled scarcity premiums.'}
];
export const contractTemplates=[
  {name:'Grid expansion package',requirements:{inverters:6,transformers:3}},
  {name:'Solar installation package',requirements:{modules:10,inverters:4}},
  {name:'Storage interconnection package',requirements:{batteries:8,transformers:2}}
];
