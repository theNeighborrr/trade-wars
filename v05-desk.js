import {assets,hubs,MAX_DAYS,RULES} from './v05-data.js?cache=15';
import {getState,getAsset,getHub,localPrice,localMove,currentHub,netWorth,holdingsValue,exactMoney,money,pct,signedMoney,acceptContract,deliveryPreview,fulfillContract,cancelContract,travelTo,finishCampaign,resetState,campaignReport,getRecords,getLoadNotice,getStorageWarning,exportCampaign} from './v05-engine.js?cache=15';

export const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const esc=escapeHTML;
const tone=n=>n>0?'positive':n<0?'negative':'neutral';
const key='trade-wars-desk-v05';
function loadUI(){try{return JSON.parse(localStorage.getItem(key)||'{}')||{};}catch{return {};}}
export const deskState={filter:'all',solarOpen:false,quantities:{},...loadUI()};
if(!deskState.quantities||typeof deskState.quantities!=='object')deskState.quantities={};
if(!['all','owned'].includes(deskState.filter))deskState.filter='all';
export function saveUI(){try{localStorage.setItem(key,JSON.stringify(deskState));}catch{}}
let callbacks={},selectedHub=null,lastReceipt=null,chartAsset=null,chartMode='local',priorFocus=null;
const s=()=>getState();
const byId=id=>document.getElementById(id);
function panel(id,tag='section'){const e=document.createElement(tag);e.id=id;e.className='desk-panel';return e;}
function actions(result){callbacks.action(result);}
function button(label,fn,cls='desk-button'){const b=document.createElement('button');b.type='button';b.className=cls;b.textContent=label;b.addEventListener('click',fn);return b;}
function openDialog(title,html){
  const d=byId('deskDialog');priorFocus=document.activeElement;byId('deskDialogTitle').textContent=title;byId('deskDialogBody').innerHTML=html;
  if(!d.open)d.showModal();return byId('deskDialogBody');
}
function closeDialog(){byId('deskDialog')?.close();chartAsset=null;if(priorFocus?.isConnected)priorFocus.focus({preventScroll:true});}
function confirmAction(title,text,fn,label='Confirm'){
  const body=openDialog(title,`<p>${esc(text)}</p><div class="desk-dialog-actions"></div>`);
  body.lastElementChild.append(button('Cancel',closeDialog),button(label,()=>{closeDialog();fn();},'desk-button accent'));
}
export function offerCloseCampaign(){
  const active=s().contracts.filter(c=>c.status==='accepted'),bonds=active.reduce((n,c)=>n+c.bond,0);
  confirmAction('Close the campaign?',`Your remaining inventory will be valued at current ${currentHub().name} prices; it is not booked as a realized sale. ${active.length?`${active.length} unfinished contract(s) will forfeit ${money(bonds)} in bonds. `:''}Trading then closes.`,()=>{actions(finishCampaign());openResults();},'Close & see results');
}
export function offerNewRun(){
  const body=openDialog('Start a new campaign',`<p>A new run starts with $50,000 in New York. Your current campaign is saved as the previous-run backup on this device.</p><label class="desk-label">Scenario seed <input id="seedInput" maxlength="48" autocomplete="off" placeholder="Leave blank for a new world"></label><p class="desk-note">Letters, numbers, hyphens and underscores. The same seed + rules ${RULES} produces the same day-by-day world. Your decisions determine the result.</p><div class="desk-dialog-actions"></div>`);
  body.lastElementChild.append(button('Cancel',closeDialog),button('Start campaign',()=>{const seed=byId('seedInput').value;closeDialog();deskState.quantities={};lastReceipt=null;saveUI();actions(resetState({seed}));callbacks.setView('dashboard');},'desk-button accent'));
}
function replayRun(){
  confirmAction('Replay this scenario?',`Restart seed ${s().seed} from Day 1 with $50,000. The same global and regional prices will occur on the same days, regardless of how you trade or travel. Current progress will become the previous-run backup.`,()=>{deskState.quantities={};lastReceipt=null;saveUI();actions(resetState({replay:true}));callbacks.setView('markets');},'Replay');
}
function download(name,content,type='application/json'){
  const u=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=u;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1500);
}
export function showReceipt(receipt){lastReceipt=receipt;}
function receiptLine(r){
  if(['buy','sell'].includes(r.type))return `${r.type.toUpperCase()} · ${r.qty} ${getAsset(r.assetId)?.ticker||r.assetId} · ${exactMoney(r.total)}${r.type==='sell'?` · ${signedMoney(r.realized)} realized`:''}`;
  if(r.type==='delivery')return `DELIVERY · ${money(r.total)} · ${signedMoney(r.realized)} realized`;
  if(r.type==='travel')return `${getHub(r.fromHub)?.code} → ${getHub(r.toHub)?.code} · ${money(r.total)} · arrives Day ${r.arrivalDay}`;
  return `${r.type.toUpperCase()} · ${money(r.total)} · ${r.message||''}`;
}
function journalMarkup(entries){
  if(!entries.length)return '<p class="desk-note">No activity recorded yet. Buy, sell, travel, or accept a contract to begin.</p>';
  return `<ol class="journal-list">${entries.map(r=>`<li><span class="journal-day">D${r.day} · ${esc(getHub(r.hub)?.code||'')}</span><div><strong>${esc(receiptLine(r))}</strong>${r.assetId?`<small>${esc(getAsset(r.assetId)?.name)} at ${exactMoney(r.price)} per lot${r.cashAfter!=null?' · Cash after '+exactMoney(r.cashAfter):''}</small>`:''}</div></li>`).join('')}</ol>`;
}
function openJournal(){
  const body=openDialog('Trade journal',`<p class="desk-note">${s().migrated?`Records begin on upgrade Day ${s().coverageStart}. Earlier realized results are unknown.`:'All recorded campaign activity, newest first.'}</p><div class="journal-tools"></div>${journalMarkup([...s().journal].reverse())}`);
  body.querySelector('.journal-tools').append(button('Export journal CSV',()=>{
    const headers=['day','type','hub','asset','quantity','price','total','realized','cash_after','contract'];
    const cell=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
    const lines=s().journal.map(r=>[r.day,r.type,r.hub,r.assetId,r.qty,r.price,r.total,r.realized,r.cashAfter,r.contractId].map(cell).join(','));
    download(`trade-wars-${s().seed}-journal.csv`,[headers.join(','),...lines].join('\n'),'text/csv');
  }));
}
export function openAssetHistory(id){chartAsset=id;chartMode='local';renderHistoryDialog();}
function renderHistoryDialog(){
  const id=chartAsset,a=getAsset(id);if(!a)return;
  const hist=s().priceHistory,avg=s().holdings[id]>0?s().avgCosts[id]:null;
  const points=hist.map(p=>({day:p.day,value:chartMode==='global'?p.global[id]:p.hubs[s().currentHub]?.[id]})).filter(p=>Number.isFinite(p.value));
  const values=points.map(p=>p.value);if(avg!=null)values.push(avg);
  const low=Math.min(...values)*.96,high=Math.max(...values)*1.04,span=Math.max(.01,high-low),x=d=>44+(d-(points[0]?.day||1))*620/Math.max(1,(points.at(-1)?.day||1)-(points[0]?.day||1)),y=v=>225-(v-low)/span*190;
  const path=points.map((p,i)=>`${i?'L':'M'}${x(p.day).toFixed(2)} ${y(p.value).toFixed(2)}`).join(' ');
  const labels=[high,(high+low)/2,low].map(v=>`<text x="44" y="${y(v)-7}" class="chart-label">${money(v)}</text><line x1="44" x2="676" y1="${y(v)}" y2="${y(v)}" class="chart-grid"/>`).join('');
  const r=s().moveReasons[id]||{},lm=localMove(id),previous=hist.length>1?hist.at(-2).hubs[s().currentHub]?.[id]:null;
  const body=openDialog(`${a.name} · history & drivers`,
    `<div class="history-toggle"></div><p class="desk-note">${chartMode==='local'?`Daily quotes in ${esc(currentHub().name)} (one fixed hub), not a line connecting different destinations.`:'Global reference prices, before regional premiums and local hub differences.'}</p>
     <svg class="price-chart" viewBox="0 0 700 265" role="img" aria-label="${esc(a.name)} price history${avg!=null?' with your current average buy price':''}">${labels}<path d="${path}" class="chart-price" fill="none"/>${points.length===1?`<circle cx="${x(points[0].day)}" cy="${y(points[0].value)}" r="4" class="chart-dot"/>`:''}${avg!=null?`<line x1="44" x2="676" y1="${y(avg)}" y2="${y(avg)}" class="chart-average"/><text x="676" y="${y(avg)-8}" text-anchor="end" class="chart-average-label">Your local avg ${exactMoney(avg)}</text>`:''}<text x="44" y="254" class="chart-label">Day ${points[0]?.day||s().day}</text><text x="676" y="254" text-anchor="end" class="chart-label">Day ${s().day}</text></svg>
     <div class="desk-kpis"><div><span>Local quote</span><strong>${exactMoney(localPrice(id))}</strong></div><div><span>Local Δ · same hub</span><strong class="${tone(lm||0)}">${lm==null?'—':pct(lm)}</strong></div><div><span>Global Δ</span><strong class="${tone(s().moves[id])}">${hist.length<2?'—':pct(s().moves[id])}</strong></div></div>
     ${previous?`<p class="desk-note">Previous ${esc(currentHub().code)} quote: ${exactMoney(previous)}. Travel changes your available quote separately.</p>`:''}
     <h3>Global move breakdown</h3><dl class="driver-list">${[['Condition premium change',r.event],['Ordinary volatility',r.noise],['Mean reversion',r.meanReversion],['Lagged input costs',r.supplyChain],['Model adjustment',r.adjustment]].map(([label,v])=>`<div><dt>${label}</dt><dd class="${tone(v||0)}">${pct(v||0)}</dd></div>`).join('')}</dl>
     <p class="desk-note">Global components sum to the global reference move. The local quote additionally includes structural hub basis, local drift, and regional conditions. ${s().migrated?`History begins on upgrade Day ${s().coverageStart}; earlier prices are not invented.`:'History begins on Day 1.'}</p>
     <details class="history-data"><summary>Daily price values</summary><div class="history-values">${points.map(p=>`<span>Day ${p.day}</span><strong>${exactMoney(p.value)}</strong>`).join('')}</div></details>`);
  body.querySelector('.history-toggle').append(button('Local hub',()=>{chartMode='local';renderHistoryDialog();},`desk-button ${chartMode==='local'?'selected':''}`),button('Global reference',()=>{chartMode='global';renderHistoryDialog();},`desk-button ${chartMode==='global'?'selected':''}`));
}
function conditionMarkup(c){
  return `<article class="condition-card"><div class="condition-meta"><span class="phase phase-${c.phase}">${esc(c.phase)}</span><span>${esc(c.region)}</span></div><h3>${esc(c.title)}</h3><p>${esc(c.body)}</p><div class="condition-tags">${Object.keys(c.effects).map(id=>`<span>${esc(getAsset(id)?.ticker||id)}</span>`).join('')}</div><small>${esc(c.duration)} · simulated</small></article>`;
}
function renderConditions(){
  byId('activeConditions').innerHTML=`<div class="desk-section-head"><div><span class="eyebrow">WORLD IN MOTION</span><h2>Active conditions</h2></div><span class="desk-note">Developing ≠ guaranteed</span></div><div class="condition-grid">${s().activeConditions.map(conditionMarkup).join('')}</div><p class="desk-note">Authored, seeded scenarios—not live news or forecasts. Premiums build, ease, and unwind; headline effects are not repeatedly compounded each day.</p>`;
}
function contractMarkup(c){
  const active=c.status==='accepted',ready=active&&deliveryPreview(c.id).ok;
  return `<article class="contract-card"><div class="condition-meta"><span class="phase">${esc(active?'accepted':'offer')}</span><span>${esc(getHub(c.hub).code)} · by Day ${c.deadline}</span></div><h3>${esc(c.name)}</h3><ul class="contract-goods">${Object.entries(c.requirements).map(([id,n])=>`<li><span>${esc(getAsset(id).name)}</span><strong>${active?s().holdings[id]+'/':''}${n} lots</strong></li>`).join('')}</ul><div class="contract-money"><div><span>Fixed payout</span><strong>${money(c.payout)}</strong></div><div><span>Refundable bond</span><strong>${money(c.bond)}</strong></div></div><p class="desk-note">${active?`Deliver in ${esc(getHub(c.hub).name)}. ${ready?'Ready to deliver.':deliveryPreview(c.id).message}`:`Offer expires after Day ${c.expires}. Source inventory and cover travel yourself.`}</p><div class="contract-actions"><button type="button" class="desk-button accent" data-contract="${esc(c.id)}" data-contract-action="${active?'deliver':'accept'}" ${s().finished||(active&&!ready)?'disabled':''}>${active?'Deliver goods':'Review offer'}</button>${active?`<button type="button" class="desk-button" data-contract="${esc(c.id)}" data-contract-action="cancel" ${s().finished?'disabled':''}>Cancel</button>`:''}</div></article>`;
}
function renderContracts(){
  const active=s().contracts.filter(c=>c.status==='accepted'),offers=s().finished?[]:s().offers;
  byId('contractsPanel').innerHTML=`<summary><span>Project contracts</span><strong>${active.length} active · ${offers.length} offers</strong></summary><div class="contracts-body"><p class="desk-note">Optional delivery jobs. Bonds remain part of net worth while held. Deliver by the deadline to recover the bond; cancellation, a missed deadline, or closing with unfinished work forfeits it. Inventory is consumed only on delivery.</p><div class="contract-grid">${[...active,...offers].map(contractMarkup).join('')||'<p>No open offers. New tender rounds arrive every five sessions through Day 24.</p>'}</div><p class="desk-note">${s().contracts.filter(c=>c.status==='fulfilled').length} delivered · ${s().contracts.filter(c=>['cancelled','expired'].includes(c.status)).length} cancelled / expired · ${money(s().escrow)} bonds held</p></div>`;
  byId('contractsPanel').querySelectorAll('[data-contract]').forEach(b=>b.addEventListener('click',()=>{
    const id=b.dataset.contract,c=[...s().offers,...s().contracts].find(c=>c.id===id);if(!c)return;
    if(b.dataset.contractAction==='accept'){
      const estimate=Object.entries(c.requirements).reduce((n,[id,q])=>n+q*localPrice(id),0);
      confirmAction(c.name,`Deliver ${Object.entries(c.requirements).map(([a,n])=>n+' '+getAsset(a).name).join(' + ')} in ${getHub(c.hub).name} by the end of Day ${c.deadline}. Fixed payout ${money(c.payout)}. ${money(c.bond)} is held now, refunded on successful delivery, and forfeited if cancelled, late, or unfinished at campaign close. Buying all goods at today's current-hub quotes would cost ${money(estimate)}, before travel. Quotes will change.`,()=>actions(acceptContract(id)),'Accept & post bond');
    }else if(b.dataset.contractAction==='deliver'){
      const p=deliveryPreview(id);if(!p.ok)return actions(p);
      confirmAction('Deliver this package?',`Consume the required inventory for ${money(p.total)}, recover your ${money(p.bond)} bond, and record ${signedMoney(p.realized)} delivery profit versus cost basis.`,()=>actions(fulfillContract(id)),'Deliver');
    }else confirmAction('Cancel this contract?',`Your ${money(c.bond)} performance bond will be forfeited. Inventory stays yours.`,()=>actions(cancelContract(id)),'Forfeit & cancel');
  }));
}
const xy=([lon,lat])=>[40+(lon+180)/360*820,20+(80-lat)/150*300];
function mapSVG(){
  const contours=[
    [[-168,70],[-145,70],[-130,55],[-123,48],[-124,40],[-117,32],[-110,30],[-106,24],[-97,15],[-86,15],[-82,23],[-81,25],[-80,31],[-75,36],[-69,44],[-56,53],[-60,60],[-85,66],[-125,73]],
    [[-80,10],[-69,11],[-50,0],[-35,-7],[-40,-20],[-51,-35],[-68,-55],[-76,-43],[-72,-20],[-81,-5]],
    [[-10,36],[-10,44],[-5,49],[5,54],[8,65],[25,71],[40,68],[32,53],[30,44],[20,40],[14,42],[3,41]],
    [[-17,35],[10,37],[33,31],[51,12],[40,-12],[32,-33],[17,-35],[12,-17],[5,5],[-10,6],[-17,20]],
    [[30,70],[60,75],[120,70],[160,62],[178,55],[150,45],[135,33],[123,25],[121,15],[109,5],[103,1],[97,10],[87,20],[79,7],[73,20],[60,25],[55,24],[43,12],[35,32],[28,42],[40,55]],
    [[112,-22],[115,-35],[137,-38],[154,-28],[145,-12],[132,-11],[118,-17]]
  ];
  const land=contours.map(c=>'<path d="'+c.map((pt,i)=>(i?'L':'M')+xy(pt).join(' ')).join(' ')+'Z"/>').join('');
  const [ox,oy]=xy(currentHub().coords),to=getHub(selectedHub||s().currentHub),[tx,ty]=xy(to.coords);
  return `<svg viewBox="0 0 900 360" class="route-map" role="img" aria-label="Schematic world trade routes. Choose a hub using the buttons below."><defs><pattern id="routeGrid" width="50" height="40" patternUnits="userSpaceOnUse"><path d="M50 0H0V40" class="map-grid" fill="none"/></pattern></defs><rect width="900" height="360" fill="url(#routeGrid)"/><g class="map-land">${land}</g>${hubs.filter(h=>h.id!==s().currentHub).map(h=>{const [x,y]=xy(h.coords);return `<path d="M${ox} ${oy}Q${(ox+x)/2} ${Math.min(oy,y)-35} ${x} ${y}" class="map-route"/>`;}).join('')}<path d="M${ox} ${oy}Q${(ox+tx)/2} ${Math.min(oy,ty)-35} ${tx} ${ty}" class="map-selected"/>${hubs.map(h=>{const [x,y]=xy(h.coords);return `<a href="#" role="button" tabindex="0" data-map-hub="${h.id}" aria-label="Compare ${esc(h.name)}"><circle cx="${x}" cy="${y}" r="18" fill="transparent"/><circle cx="${x}" cy="${y}" r="${h.id===s().currentHub?7:5}" class="map-node"/><text x="${x+9}" y="${y+(h.id==='singapore'?18:-9)}" class="map-label">${h.code}</text></a>`;}).join('')}</svg>`;
}
function renderRoutes(){
  if(!getHub(selectedHub))selectedHub=s().currentHub;
  const target=getHub(selectedHub),here=target.id===s().currentHub,after=assets.reduce((n,a)=>n+s().holdings[a.id]*localPrice(a.id,target.id),0),delta=after-holdingsValue();
  byId('routePlanner').innerHTML=`<summary><span>Route planner</span><small>Compare hubs before traveling</small></summary><div class="route-body">${mapSVG()}<p class="desk-note">Schematic geography · current quotes, not arrival-price forecasts.</p><div class="map-hub-buttons">${hubs.map(h=>`<button class="desk-button ${selectedHub===h.id?'selected':''}" type="button" data-map-hub="${h.id}">${h.code}<small>${esc(h.name)}</small></button>`).join('')}</div><div class="route-quote"><h3>${esc(currentHub().code)} → ${esc(target.code)} · ${esc(target.name)}</h3><div class="desk-kpis"><div><span>Travel cost</span><strong>${here?'—':money(target.travelCost)}</strong></div><div><span>Arrival</span><strong>${here?'Current hub':'Day '+Math.min(30,s().day+1)}</strong></div><div><span>Inventory quote difference</span><strong class="${tone(delta)}">${signedMoney(delta)}</strong></div></div><p class="desk-note">${here?'You are here.':`Difference after travel cost at today's quotes: ${signedMoney(delta-target.travelCost)}. Prices reprice during travel; this is NOT a guaranteed profit.`}</p><div class="route-buying-quotes">${assets.filter(a=>a.group==='solar').map(a=>`<span>${esc(a.name)} <strong>${exactMoney(localPrice(a.id,target.id))}</strong></span>`).join('')}</div><button class="desk-button accent" id="mapTravel" type="button" ${here||s().day>=30||s().finished||s().cash<target.travelCost?'disabled':''}>Travel · ${money(target.travelCost)} · 1 day</button></div></div>`;
  byId('routePlanner').querySelectorAll('[data-map-hub]').forEach(b=>{const choose=e=>{e.preventDefault();selectedHub=b.dataset.mapHub;renderRoutes();};b.addEventListener('click',choose);if(b.tagName.toLowerCase()==='a')b.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key))choose(e);});});
  byId('mapTravel').addEventListener('click',()=>actions(travelTo(target.id)));
}
function briefMarkup(){
  const turn=s().lastTurn,marks=turn?Object.entries(turn.marks).filter(([id])=>turn.quantities[id]>0).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1])):[];
  return `<div class="paper-masthead">THE TRADE WARS LEDGER</div><div class="brief-meta"><span>SESSION ${s().day} / 30</span><span>${esc(currentHub().name)}</span><span>SIMULATED EDITION</span></div><h2>${esc(s().currentEvent.title)}</h2><p>${esc(s().currentEvent.body)}</p><h3>Your book this session</h3>${marks.length?`<div class="brief-positions">${marks.slice(0,4).map(([id,n])=>`<div><span>${esc(getAsset(id).name)}</span><strong class="${tone(n)}">${signedMoney(n)}</strong></div>`).join('')}</div><p class="desk-note">Inventory mark changes at the last repricing, for the quantities carried into the session. Not realized profit. ${turn.fromHub!==turn.toHub?`Includes the change from ${esc(getHub(turn.fromHub).code)} to ${esc(getHub(turn.toHub).code)} quotes; travel cost ${money(turn.travelCost)} is separate.`:''}</p>`:'<p class="desk-note">No carried inventory was exposed at the last repricing. New purchases do not retroactively earn the last move.</p>'}`;
}
export function openResults(){
  const r=s().result||campaignReport(),records=getRecords(),best=records[0];
  const body=openDialog(s().finished?'Campaign complete':'Campaign checkpoint',`<div class="result-hero"><span class="eyebrow">${esc(r.title)}</span><h2>${money(r.worth)}</h2><strong class="${tone(r.returnPct)}">${pct(r.returnPct)} versus $50,000</strong><p>Seed ${esc(r.seed)} · rules ${RULES}</p></div><div class="desk-kpis result-kpis">${[['Cash',money(r.cash)],['Inventory marked at current hub',money(r.inventory)],['Trading profit · realized',signedMoney(r.realized)],['Delivery profit · realized',signedMoney(r.contractProfit)],['Unrealized inventory P/L',signedMoney(r.unrealized)],['Travel expenses',money(r.travelCosts)],['Forfeited bonds',money(r.forfeits)],['Bonds still held',money(r.escrow)]].map(([name,value])=>`<div><span>${name}</span><strong>${value}</strong></div>`).join('')}</div><p>${r.deliveries} deliveries · ${r.trades} trades · ${r.cities} hubs visited · ${(r.maxDrawdown*100).toFixed(1)}% maximum recorded drawdown.</p><p class="desk-note">${r.migrated?`This is a continued v0.4 campaign. Journal statistics and drawdown cover Day ${r.coverageStart} onward, not earlier activity. It is excluded from v0.5 personal-best comparisons. Replay cannot reconstruct the older random world.`:'Cash + current inventory value + refundable bonds = net worth. Open inventory is not recorded as a sale.'}</p><dl class="driver-list"><div><dt>Best recorded sale</dt><dd>${r.bestSale?esc(getAsset(r.bestSale.assetId).name)+' · '+signedMoney(r.bestSale.realized):'No sales yet'}</dd></div><div><dt>Worst recorded sale</dt><dd>${r.worstSale?esc(getAsset(r.worstSale.assetId).name)+' · '+signedMoney(r.worstSale.realized):'No sales yet'}</dd></div><div><dt>Most profitable sale market</dt><dd>${esc(r.bestAsset||'No profitable sale market yet')}</dd></div><div><dt>Personal best · complete v0.5 runs</dt><dd>${best?money(best.worth):'Finish a new v0.5 run to set a record'}</dd></div></dl><div class="desk-dialog-actions"></div>`);
  const a=body.lastElementChild;a.append(button('New scenario',()=>{closeDialog();offerNewRun();},'desk-button accent'));
  if(!s().migrated)a.append(button('Replay this seed',()=>{closeDialog();replayRun();}));
  a.append(button('Export campaign',()=>download(`trade-wars-${s().seed}.json`,exportCampaign())));
}
function help(){
  openDialog('Your trading desk',`<h3>Choose → trade → advance → adapt</h3><p>Tap an asset name or <strong>History / Why?</strong> for price history and drivers. A <strong>local move</strong> compares yesterday and today in the same hub. Global moves exclude hub premiums.</p><p>Drag the slider for quick sizing, or type any exact whole-lot quantity. <strong>Buy Max</strong> and <strong>Sell All</strong> select a quantity only; the stacked BUY / SELL buttons execute it. Both previews show the consequence before you trade.</p><p>Solar / Grid expands into four individually tradable equipment markets. Its parent is an equal-weight, base-100 reference index—not another tradable asset.</p><p>Contract bonds remain part of net worth until refunded or forfeited. Inventory is consumed only on delivery. Deadlines include the final trading session of that day.</p><p>Day 30 stays open for your final trades and deliveries. <strong>Close campaign</strong> ends the run and values unsold goods at that hub's quotes. Unfinished contracts lose their bonds.</p><h3>Terminal keyboard</h3><p><kbd>C</kbd> Command · <kbd>M</kbd> Markets · <kbd>I</kbd> Intel · <kbd>P</kbd> Portfolio · <kbd>J</kbd> Journal · <kbd>N</kbd> next day · <kbd>?</kbd> help. Keys are ignored while typing or a dialog is open. No shortcut executes a trade.</p><p class="desk-note">All themes use the same economy and information. Same seed and rules version = the same world on the same day; outcomes are not guaranteed profits.</p>`);
}
export function initDesk(cb){
  callbacks=cb;
  const main=document.querySelector('.main-content'),dash=document.querySelector('[data-view-panel="dashboard"]'),markets=document.querySelector('[data-view-panel="markets"]'),intel=document.querySelector('[data-view-panel="intel"]'),portfolio=document.querySelector('[data-view-panel="portfolio"]');
  const notice=panel('campaignNotice');main.querySelector('.topbar').after(notice);
  const bar=panel('deskTools');bar.classList.add('desk-toolbar');markets.querySelector('.market-table-wrap').before(bar);
  bar.append(button('All markets',()=>{deskState.filter='all';saveUI();cb.render();},'desk-button filter-all'),button('My holdings',()=>{deskState.filter='owned';saveUI();cb.render();},'desk-button filter-owned'),button('Journal',openJournal),button('Contracts',()=>{byId('contractsPanel').open=true;byId('contractsPanel').scrollIntoView({block:'start'});}),button('Route planner',()=>{cb.setView('dashboard');byId('routePlanner').open=true;byId('routePlanner').scrollIntoView({block:'start'});}),button('Help',help));
  const receipt=panel('tradeReceipt');receipt.setAttribute('role','status');bar.after(receipt);
  const contracts=panel('contractsPanel','details');contracts.open=false;markets.append(contracts);
  const route=panel('routePlanner','details');dash.prepend(route);
  const brief=panel('dailyBrief');dash.insertBefore(brief,route.nextSibling);
  const cond=panel('activeConditions');intel.prepend(cond);
  const journal=panel('portfolioJournal');portfolio.append(journal);
  const tape=panel('terminalTape','details');tape.classList.add('terminal-only');main.querySelector('.topbar').after(tape);
  const end=panel('campaignCloseNotice');main.querySelector('.topbar').after(end);
  const dialog=document.createElement('dialog');dialog.id='deskDialog';dialog.className='desk-dialog';dialog.setAttribute('aria-labelledby','deskDialogTitle');dialog.innerHTML='<header><h2 id="deskDialogTitle"></h2><button id="deskDialogClose" type="button" aria-label="Close dialog">×</button></header><div id="deskDialogBody"></div>';document.body.append(dialog);
  byId('deskDialogClose').addEventListener('click',closeDialog);dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDialog();}});dialog.addEventListener('close',()=>{chartAsset=null;});
  document.addEventListener('tw:theme-change',()=>{if(document.body.dataset.theme==='situation')byId('routePlanner').open=true;});
  document.addEventListener('keydown',e=>{
    if(document.body.dataset.theme!=='terminal'||e.repeat||e.ctrlKey||e.altKey||e.metaKey||e.target.closest('input,select,textarea,[contenteditable=true]')||document.querySelector('dialog[open],.modal-backdrop.open,.hub-sheet-backdrop.open,.theme-drawer-backdrop.open,.day-transition.show'))return;
    const k=e.key.toLowerCase(),views={c:'dashboard',m:'markets',i:'intel',p:'portfolio'};
    if(views[k]){e.preventDefault();cb.setView(views[k]);}else if(k==='j'){e.preventDefault();openJournal();}else if(k==='n'){e.preventDefault();cb.advance();}else if(k==='?'){e.preventDefault();help();}
  });
}
export function renderDesk(){
  const status=getStorageWarning()||getLoadNotice();byId('campaignNotice').hidden=!status;byId('campaignNotice').textContent=status;
  const end=byId('campaignCloseNotice');end.hidden=s().day<29&&!s().finished;
  end.innerHTML=s().finished?'<strong>Campaign closed.</strong> Your remaining inventory is marked at the final hub quote.':s().day===29?'<strong>One market session remains after this one.</strong> Day 30 will stay open for final trades and deliveries.':'<strong>Final trading session.</strong> Travel is closed. Complete trades and deliveries before closing your campaign.';
  if(s().finished)end.append(button('View results',openResults));
  document.querySelector('.filter-all').classList.toggle('selected',deskState.filter==='all');document.querySelector('.filter-owned').classList.toggle('selected',deskState.filter==='owned');
  const receipt=byId('tradeReceipt');receipt.hidden=!lastReceipt;receipt.textContent=lastReceipt?receiptLine(lastReceipt):'';
  byId('terminalTape').innerHTML=`<summary>TAPE &gt; ${esc(s().journal.length?receiptLine(s().journal.at(-1)):'No executions · M markets · J journal · ? help')}</summary>${journalMarkup([...s().journal].reverse().slice(0,5))}`;
  byId('dailyBrief').innerHTML=briefMarkup();renderConditions();renderContracts();renderRoutes();
  const r=campaignReport();byId('portfolioJournal').innerHTML=`<div class="desk-section-head"><div><span class="eyebrow">DEAL MEMORY</span><h2>Recent activity</h2></div></div><div class="desk-kpis"><div><span>Trading · realized</span><strong class="${tone(r.realized)}">${signedMoney(r.realized)}</strong></div><div><span>Delivery · realized</span><strong class="${tone(r.contractProfit)}">${signedMoney(r.contractProfit)}</strong></div><div><span>Travel expenses</span><strong>${money(r.travelCosts)}</strong></div></div><p class="desk-note">${s().migrated?'Recorded since upgrade Day '+s().coverageStart+'. Earlier transactions are unknown.':'Full campaign activity. Unsold positions remain unrealized.'}</p>${journalMarkup([...s().journal].reverse().slice(0,8))}<div class="journal-tools"></div>`;
  byId('portfolioJournal').lastElementChild.append(button('Full journal',openJournal),button(s().finished?'Results & replay':'Campaign checkpoint',openResults),button('Export campaign',()=>download(`trade-wars-${s().seed}.json`,exportCampaign())));
}
