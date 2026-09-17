export const STARTING_CASH = 50000;
export const MAX_DAYS = 30;
export const STORAGE_KEY = 'trade-wars-prototype-v2';

export const assets = [
  { id:'oil', ticker:'CRUDE', name:'Crude Oil', unit:'bbl index', price:82, volatility:.045, sectors:['Energy','Shipping'], leader:'🇺🇸 United States', leaderLabel:'Top producer' },
  { id:'lng', ticker:'LNG', name:'LNG', unit:'gas index', price:61, volatility:.05, sectors:['Energy','Europe'], leader:'🇺🇸 United States', leaderLabel:'Top exporter' },
  { id:'freight', ticker:'FRT', name:'Ocean Freight', unit:'route index', price:104, volatility:.07, sectors:['Shipping','Trade'], leader:'🇨🇳 China', leaderLabel:'Largest shipbuilder' },
  { id:'steel', ticker:'STL', name:'Steel', unit:'metal index', price:76, volatility:.045, sectors:['Industry','Tariffs'], leader:'🇨🇳 China', leaderLabel:'Top producer' },
  { id:'chips', ticker:'CHIP', name:'Semiconductors', unit:'tech index', price:164, volatility:.06, sectors:['Technology','Asia'], leader:'🇹🇼 Taiwan', leaderLabel:'Foundry leader' },
  { id:'copper', ticker:'CU', name:'Copper', unit:'metal index', price:93, volatility:.04, sectors:['Industry','Energy'], leader:'🇨🇱 Chile', leaderLabel:'Top mined producer' },
  { id:'wheat', ticker:'WHT', name:'Wheat', unit:'grain index', price:48, volatility:.055, sectors:['Food','Weather'], leader:'🇨🇳 China', leaderLabel:'Top producer' },
  { id:'rare', ticker:'REE', name:'Rare Earths', unit:'minerals index', price:131, volatility:.075, sectors:['Technology','Trade'], leader:'🇨🇳 China', leaderLabel:'Top mined producer' }
];

export const hubs = [
  { id:'newyork', name:'New York', code:'NYC', region:'NORTH AMERICA', travelCost:700, note:'Finance & Atlantic gateway', spreads:{oil:1.04,lng:1.06,freight:1.02,steel:1.05,chips:1.03,copper:1.02,wheat:1.01,rare:1.04} },
  { id:'houston', name:'Houston', code:'HOU', region:'NORTH AMERICA', travelCost:650, note:'Energy & Gulf export hub', spreads:{oil:.94,lng:.93,freight:1.00,steel:1.01,chips:1.05,copper:1.01,wheat:.99,rare:1.04} },
  { id:'rotterdam', name:'Rotterdam', code:'RTM', region:'EUROPE', travelCost:1150, note:'European port & refining hub', spreads:{oil:1.06,lng:1.09,freight:.98,steel:1.03,chips:1.04,copper:1.05,wheat:1.04,rare:1.06} },
  { id:'singapore', name:'Singapore', code:'SIN', region:'ASIA', travelCost:1350, note:'Asia shipping & energy hub', spreads:{oil:1.08,lng:1.04,freight:.94,steel:1.02,chips:.98,copper:1.03,wheat:1.08,rare:1.01} },
  { id:'shanghai', name:'Shanghai', code:'SHA', region:'ASIA', travelCost:1250, note:'Manufacturing & export center', spreads:{oil:1.03,lng:1.06,freight:.93,steel:.94,chips:1.00,copper:.99,wheat:1.04,rare:.91} },
  { id:'dubai', name:'Dubai', code:'DXB', region:'MIDDLE EAST', travelCost:1200, note:'Energy, logistics & re-export hub', spreads:{oil:.97,lng:1.00,freight:1.01,steel:1.04,chips:1.08,copper:1.03,wheat:1.09,rare:1.06} },
  { id:'saopaulo', name:'São Paulo', code:'SAO', region:'SOUTH AMERICA', travelCost:1100, note:'Agriculture & industrial market', spreads:{oil:1.02,lng:1.10,freight:1.07,steel:1.03,chips:1.11,copper:1.00,wheat:.94,rare:1.08} }
];

export const scenarioDeck = [
  {region:'MIDDLE EAST',severity:3,title:'Energy export infrastructure is disrupted after an attack',body:'Buyers race to replace delayed cargoes while insurers and shippers reprice risk across nearby routes.',duration:'2–5 days',effects:{oil:.17,lng:.12,freight:.10,copper:-.02},tags:['Energy shock','Route risk']},
  {region:'NORTH AMERICA',severity:2,title:'New industrial tariffs take effect on imported metals',body:'Importers face higher landed costs while domestic producers gain short-term pricing power.',duration:'4–8 days',effects:{steel:.15,copper:.07,freight:-.03},tags:['Tariffs','Industry']},
  {region:'ASIA',severity:3,title:'Advanced semiconductor export controls tighten',body:'Manufacturers begin stockpiling sensitive components and alternative suppliers see sudden demand.',duration:'5–10 days',effects:{chips:.18,rare:.13,copper:.04},tags:['Export controls','Technology']},
  {region:'GLOBAL',severity:2,title:'Major shipping lane faces renewed disruption',body:'Carriers divert vessels onto longer routes, lifting transit times and freight premiums.',duration:'3–7 days',effects:{freight:.20,oil:.06,lng:.05,wheat:.04,chips:.05},tags:['Shipping','Supply chain']},
  {region:'EUROPE',severity:2,title:'A major port labor dispute reaches a settlement',body:'Backlogs start clearing faster than expected and spot freight prices soften.',duration:'2–4 days',effects:{freight:-.16,steel:-.03,wheat:-.03,chips:-.02},tags:['Labor','Logistics']},
  {region:'SOUTH AMERICA',severity:3,title:'Drought cuts the outlook for a major agricultural exporter',body:'Crop forecasts fall and global buyers compete for replacement supply.',duration:'5–12 days',effects:{wheat:.24,freight:.05},tags:['Weather','Food']},
  {region:'GLOBAL',severity:2,title:'Critical-minerals trade agreement opens new supply channels',body:'Manufacturers price in easier access to specialty inputs and lower scarcity premiums.',duration:'5–10 days',effects:{rare:-.17,chips:-.05,copper:.03},tags:['Trade agreement','Minerals']},
  {region:'ASIA',severity:1,title:'Large manufacturing economy trims import duties',body:'Lower input costs improve demand expectations across industrial and technology supply chains.',duration:'4–7 days',effects:{steel:.06,chips:.08,copper:.08,freight:.04},tags:['Trade policy','Demand']},
  {region:'GLOBAL',severity:2,title:'Energy sanctions expand to additional buyers and shippers',body:'Replacement barrels become more valuable as compliance and transport costs rise.',duration:'4–9 days',effects:{oil:.14,lng:.08,freight:.08},tags:['Sanctions','Energy']},
  {region:'NORTH AMERICA',severity:1,title:'Election result changes the legislative balance',body:'Markets wait for confirmed trade and industrial-policy changes while near-term uncertainty rises.',duration:'2–5 days',effects:{steel:.03,chips:.025,rare:.03,freight:.02},tags:['Election','Policy uncertainty']},
  {region:'EUROPE',severity:1,title:'Diplomatic talks reduce expectations of new trade restrictions',body:'Risk premiums ease across several exposed industrial markets, though no final agreement is in place.',duration:'2–4 days',effects:{steel:-.05,chips:-.035,rare:-.04,freight:-.02},tags:['Diplomacy','Trade']},
  {region:'GLOBAL',severity:1,title:'A strong grain harvest beats expectations',body:'Higher expected supply pressures agricultural prices and slightly reduces bulk-shipping demand.',duration:'3–6 days',effects:{wheat:-.18,freight:-.025},tags:['Agriculture','Supply']}
];

export const palette = ['#52d9ff','#4ee7a8','#ffc45f','#6ca4ff','#b589ff','#ff8a66','#74d5ba','#f395bf'];
