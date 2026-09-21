import {STARTING_CASH,MAX_DAYS,assets,hubs,palette} from './v06-data.js?cache=16';
import {getState,getAsset,currentHub,hubFactor,localPrice,holdingsValue,netWorth,investedCost,unrealized,money,pct,signedMoney,trade,advanceDay,travelTo,resetState,localMove,exactMoney,previewTrade,travelCost} from './v06-engine.js?cache=16';

import {initDesk,renderDesk,deskState,saveUI,showReceipt,openAssetHistory,offerCloseCampaign,offerNewRun,openResults} from './v06-desk.js?cache=16';

let toastTimer;
let dayTransitionTimer;

const state=()=>getState();
const leaderLine=asset=>`<span class="leader-line">${asset.leaderLabel} · ${asset.leader}</span>`;

function showToast(message){
  const el=document.getElementById('toast');
  if(!el)return;
  el.textContent=message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>el.classList.remove('show'),4500);
}
function doAction(result){
  if(!result)return;
  showToast(result.message);
  if(result.receipt)showReceipt(result.receipt);
  renderAll();
  if(result.dayAdvanced)showDayTransition();
}

function renderEvent(){
  const ev=state().currentEvent;
  document.getElementById('eventRegion').textContent=ev.region;
  document.getElementById('eventSeverity').textContent=`SEVERITY ${ev.severity}`;
  document.getElementById('eventTitle').textContent=ev.title;
  document.getElementById('eventBody').textContent=ev.body;
  document.getElementById('eventDuration').textContent=`${ev.phase.toUpperCase()} · ${ev.duration}`;
  const wrap=document.getElementById('impactTags');
  wrap.innerHTML='';
  Object.entries(ev.effects).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1])).slice(0,4).forEach(([id,val])=>{
    const span=document.createElement('span');
    span.className=`impact-tag ${val>=0?'up':'down'}`;
    span.textContent=`${getAsset(id).ticker} · peak target ${pct(val)}`;
    wrap.appendChild(span);
  });
}

function renderStats(){
  const s=state(),worth=netWorth(),pnl=worth-s.startingCash,held=holdingsValue(),lots=assets.reduce((sum,a)=>sum+(s.holdings[a.id]||0),0),hub=currentHub();
  document.getElementById('netWorth').textContent=money(worth);
  document.getElementById('cashValue').textContent=money(s.cash);
  document.getElementById('holdingsValue').textContent=money(held);
  const pnlEl=document.getElementById('pnlValue');
  pnlEl.textContent=signedMoney(pnl);
  pnlEl.className=pnl>0?'positive':pnl<0?'negative':'neutral';
  document.getElementById('dayValue').textContent=`${s.day} / ${MAX_DAYS}`;
  document.getElementById('sideDay').textContent=`${s.day} / ${MAX_DAYS}`;
  document.getElementById('campaignProgress').style.width=`${(s.day/MAX_DAYS)*100}%`;
  const sideCash=document.getElementById('sideCash'),sideInventory=document.getElementById('sideInventory'),sideInventoryLots=document.getElementById('sideInventoryLots'),sideWorth=document.getElementById('sideWorth');
  if(sideCash)sideCash.textContent=money(s.cash);
  if(sideInventory)sideInventory.textContent=money(held);
  if(sideInventoryLots)sideInventoryLots.textContent=`${lots.toLocaleString()} lot${lots===1?'':'s'}`;
  if(sideWorth)sideWorth.textContent=money(worth);
  const bonds=document.getElementById('sideBonds');if(bonds)bonds.textContent=money(s.escrow);
  document.getElementById('marketCash').textContent=money(s.cash);
  document.getElementById('investedKpi').textContent=money(investedCost());
  const un=document.getElementById('unrealizedKpi');
  un.textContent=signedMoney(unrealized());
  un.className=unrealized()>0?'positive':unrealized()<0?'negative':'neutral';
  const performance=(worth/s.startingCash)-1,badge=document.getElementById('performanceBadge');
  badge.textContent=s.finished?'FINAL':performance>.2?'SURGING':performance>.05?'AHEAD':performance<-.12?'UNDER PRESSURE':performance<-.03?'BEHIND':'STEADY';
  document.getElementById('nextDayBtn').disabled=false;
  document.getElementById('nextDayBtn').dataset.campaignPhase=s.finished?'finished':s.day===30?'closing':'open';
  document.getElementById('nextDayBtn').innerHTML=s.finished?'View Results':s.day===30?'Close Campaign':'Advance Day <span>→</span>';
  document.getElementById('sideHub').textContent=`${hub.code} · ${hub.name}`;
  document.getElementById('currentHubName').textContent=hub.name;
  document.getElementById('currentHubCode').textContent=hub.code;
  document.getElementById('currentHubNote').textContent=hub.note;
  document.getElementById('currentHubRegion').textContent=hub.region;
  const hudDay=document.getElementById('hudDay'),hudHub=document.getElementById('hudHub'),hudWorth=document.getElementById('hudWorth');
  if(hudDay)hudDay.textContent=`${s.day} / ${MAX_DAYS}`;
  if(hudHub)hudHub.textContent=hub.code;
  if(hudWorth)hudWorth.textContent=money(worth);
  const cash=document.getElementById('hudCash');if(cash)cash.textContent=money(s.cash);
}

function renderMarketStrip(){
  const s=state(),wrap=document.getElementById('marketStrip');
  wrap.innerHTML='';
  [...assets].sort((a,b)=>Math.abs(localMove(b.id)||0)-Math.abs(localMove(a.id)||0)).slice(0,4).forEach(asset=>{
    const move=localMove(asset.id)||0,tile=document.createElement('button');
    tile.type='button';
    tile.className='market-tile';
    tile.innerHTML=`<div class="top"><span>${asset.ticker}</span><span>${asset.name}</span></div>${leaderLine(asset)}<div class="price">${money(localPrice(asset.id))}</div><div class="move ${move>0?'positive':move<0?'negative':'neutral'}">${move===0?'No move yet':pct(move)}</div><div class="local-caption">${currentHub().code} local price</div>`;
    tile.addEventListener('click',()=>setView('markets'));
    wrap.appendChild(tile);
  });
}

let hubReturnFocus=null;
function openHubSheet(){
  hubReturnFocus=document.activeElement;
  const sheet=document.getElementById('hubSheet');
  if(!sheet)return;
  sheet.classList.add('open');
  sheet.setAttribute('aria-hidden','false');
  document.body.style.overflow='hidden';
  document.getElementById('hubSheetClose')?.focus();
}
function closeHubSheet(){
  const sheet=document.getElementById('hubSheet');
  if(!sheet)return;
  sheet.classList.remove('open');
  sheet.setAttribute('aria-hidden','true');
  document.body.style.overflow='';
  if(hubReturnFocus?.isConnected)hubReturnFocus.focus({preventScroll:true});
}

function renderHubs(){
  const s=state(),wrap=document.getElementById('hubGrid');
  wrap.innerHTML='';
  const sheetList=document.getElementById('hubSheetList');
  if(sheetList)sheetList.innerHTML='';
  const current=currentHub();
  const summary=document.getElementById('mobileHubSummary');
  if(summary){
    summary.innerHTML=`<div class="mobile-hub-summary-main"><div class="mobile-hub-summary-code">${current.code}</div><div class="mobile-hub-summary-copy"><strong>${current.name}</strong><span>${current.note}</span></div></div><button class="mobile-hub-change" type="button">Change hub</button>`;
    summary.querySelector('.mobile-hub-change')?.addEventListener('click',openHubSheet);
  }

  hubs.forEach(hub=>{
    const here=hub.id===s.currentHub;
    const cheapest=assets.map(a=>({a,p:localPrice(a.id,hub.id)})).sort((x,y)=>x.p/x.a.price-y.p/y.a.price)[0];

    const card=document.createElement('article');
    card.className=`hub-card ${here?'is-current':''}`;
    card.innerHTML=`<div class="hub-card-top"><span class="hub-code">${hub.code}</span><span class="hub-region">${hub.region}</span></div><h3>${hub.name}</h3><p>${hub.note}</p><div class="hub-edge">Relative bargain <strong>${cheapest.a.ticker}</strong></div><button type="button" class="${here?'hub-here':'hub-travel'}" ${here?'disabled':''}>${here?'Current hub':`Travel · 1 day · ${money(travelCost(hub.id))}`}</button>`;
    const btn=card.querySelector('button');
    btn.disabled=here||s.finished||s.day>=30||s.cash<travelCost(hub.id);
    if(!here)btn.addEventListener('click',()=>doAction(travelTo(hub.id)));
    wrap.appendChild(card);

    if(sheetList){
      const option=document.createElement('button');
      option.type='button';
      option.className=`hub-sheet-option ${here?'is-current':''}`;
      option.disabled=here||s.finished||s.day>=30||s.cash<travelCost(hub.id);
      option.innerHTML=`<span class="hub-sheet-code">${hub.code}</span><span class="hub-sheet-copy"><strong>${hub.name}</strong><span>${hub.note}</span></span><span class="hub-sheet-action">${here?'CURRENT':`TRAVEL<small>1 day · ${money(travelCost(hub.id))}</small>`}</span>`;
      if(!here)option.addEventListener('click',()=>{
        const result=travelTo(hub.id);
        closeHubSheet();
        doAction(result);
      });
      sheetList.appendChild(option);
    }
  });
}

function quantitySteps(maxQty,extra=[]){
  const max=Math.max(1,Math.floor(maxQty));
  const base=[1,2,5,10,25,50,100,250,500,1000,2500,5000,10000,25000,50000,100000,1000000];
  return [...new Set([...base,...extra,max].filter(n=>Number.isSafeInteger(n)&&n>=1&&n<=max))].sort((a,b)=>a-b);
}
function sliderMarkup(asset,price,s){
  const affordable=Math.min(10000000,Math.max(0,Math.floor((s.cash+1e-8)/price))),owned=s.holdings[asset.id]||0,maxQty=Math.min(10000000,Math.max(1,affordable,owned));
  const remembered=Math.min(maxQty,Math.max(1,Math.floor(Number(deskState.quantities[asset.id])||1))),steps=quantitySteps(maxQty,[affordable,owned,remembered]);
  return `<div class="trade-qty" data-asset="${asset.id}" data-steps="${steps.join(',')}">
    <div class="qty-slider-wrap"><output class="qty-bubble">${remembered} lots</output><input class="qty-slider" type="range" min="0" max="${steps.length-1}" value="${steps.indexOf(remembered)}" step="1" aria-label="Trade quantity for ${asset.name}" ${s.finished?'disabled':''}></div>
    <div class="qty-meta"><label for="qty-${asset.id}">Lots</label><input id="qty-${asset.id}" class="qty-exact" type="number" min="1" max="${maxQty}" step="1" inputmode="numeric" value="${remembered}" aria-label="Exact quantity for ${asset.name}" ${s.finished?'disabled':''}></div>
    <div class="qty-shortcuts"><button class="qty-buy-max" type="button" ${!affordable||s.finished?'disabled':''}>Buy Max</button><button class="qty-sell-all" type="button" ${!owned||s.finished?'disabled':''}>Sell All</button></div>
  </div>`;
}
function wireTradeControls(row,asset,price,s){
  const slider=row.querySelector('.qty-slider'),bubble=row.querySelector('.qty-bubble'),exact=row.querySelector('.qty-exact'),box=row.querySelector('.trade-box'),preview=row.querySelector('.trade-preview');
  const buy=document.createElement('button'),sell=document.createElement('button');
  buy.type=sell.type='button';buy.className='buy';sell.className='sell';box.append(buy,sell);
  const affordable=Math.min(10000000,Math.max(0,Math.floor((s.cash+1e-8)/price))),owned=s.holdings[asset.id]||0,maxQty=Math.min(10000000,Math.max(1,affordable,owned));
  let steps=row.querySelector('.trade-qty').dataset.steps.split(',').map(Number),qty=Number(exact.value);
  function sync(){
    const valid=Number.isSafeInteger(qty)&&qty>=1&&qty<=maxQty;
    const idx=steps.indexOf(qty),ratio=steps.length<=1?0:Math.max(0,idx)/(steps.length-1);
    slider.style.setProperty('--slider-pct',`${ratio*100}%`);bubble.style.setProperty('--bubble-pct',`${ratio*100}%`);
    bubble.textContent=valid?`${qty.toLocaleString()} lot${qty===1?'':'s'}`:'Set lots';
    slider.setAttribute('aria-valuetext',valid?`${qty} lots`:'Set quantity');exact.setAttribute('aria-invalid',String(!valid));
    const b=valid?previewTrade(asset.id,1,qty):{ok:false,message:'Enter a valid whole-lot quantity.'},v=valid?previewTrade(asset.id,-1,qty):b;
    buy.textContent=valid?`BUY · ${exactMoney(price*qty)}`:'BUY';sell.textContent=valid?`SELL · ${exactMoney(price*qty)}`:'SELL';buy.disabled=!b.ok;sell.disabled=!v.ok;
    preview.innerHTML=`<div><span>Buy preview</span>${b.ok?`<strong>Cash after ${exactMoney(b.cashAfter)}</strong><small>New avg ${exactMoney(b.averageAfter)} · ${b.ownedAfter.toLocaleString()} lot${b.ownedAfter===1?'':'s'}</small>`:`<small>${b.message}</small>`}</div><div><span>Sell preview</span>${v.ok?`<strong class="${v.realized>0?'positive':v.realized<0?'negative':'neutral'}">${signedMoney(v.realized)} realized</strong><small>Receive ${exactMoney(v.total)} · ${v.ownedAfter.toLocaleString()} lot${v.ownedAfter===1?'':'s'} left</small>`:`<small>${v.message}</small>`}</div>`;
    if(valid){deskState.quantities[asset.id]=qty;saveUI();}
  }
  function select(n){qty=n;steps=quantitySteps(maxQty,[affordable,owned,qty]);slider.max=String(steps.length-1);slider.value=String(Math.max(0,steps.indexOf(qty)));exact.value=String(qty);sync();}
  slider.addEventListener('input',()=>{qty=steps[Number(slider.value)]||1;exact.value=String(qty);sync();});
  exact.addEventListener('input',()=>{qty=exact.value===''?NaN:Number(exact.value);if(Number.isSafeInteger(qty)&&qty>=1&&qty<=maxQty){steps=quantitySteps(maxQty,[affordable,owned,qty]);slider.max=String(steps.length-1);slider.value=String(steps.indexOf(qty));}sync();});
  row.querySelector('.qty-buy-max').addEventListener('click',()=>select(affordable));row.querySelector('.qty-sell-all').addEventListener('click',()=>select(owned));
  buy.addEventListener('click',()=>doAction(trade(asset.id,1,qty)));sell.addEventListener('click',()=>doAction(trade(asset.id,-1,qty)));sync();
}
function marketRow(asset){
  const s=state(),row=document.createElement('div'),move=localMove(asset.id),price=localPrice(asset.id),owned=s.holdings[asset.id]||0,avg=s.avgCosts[asset.id]||0,ret=owned&&avg?price/avg-1:0;
  row.className='market-row';row.dataset.asset=asset.id;
  row.innerHTML=`<div class="asset-name"><button type="button" class="asset-history" aria-label="${asset.name} price history"><strong>${asset.name}</strong></button><small>${asset.ticker} · ${asset.unit}</small>${leaderLine(asset)}</div><div class="market-price"><strong>${exactMoney(price)}</strong><small>${currentHub().code} local</small></div><div class="move-cell"><span class="${move>0?'positive':move<0?'negative':'neutral'}">${move==null?'—':pct(move)}</span><small>Local Δ</small><button class="why-btn" type="button">History / Why?</button></div><div class="position-cell ${owned?'has-position':''}"><strong>${owned?`${owned.toLocaleString()} lot${owned===1?'':'s'}`:'0 lots'}</strong><small>${owned?`Avg ${exactMoney(avg)}<br><span class="position-pl ${ret>0?'positive':ret<0?'negative':'neutral'}">${pct(ret)}</span> unrealized`:'No position'}</small></div><div class="exposure">${asset.sectors.map(x=>`<span class="sector-chip">${x}</span>`).join('')}</div><div class="trade-column">${sliderMarkup(asset,price,s)}<div class="trade-box trade-actions-stack"></div><div class="trade-preview"></div></div>`;
  row.querySelectorAll('.why-btn,.asset-history').forEach(b=>b.addEventListener('click',()=>openAssetHistory(asset.id)));wireTradeControls(row,asset,price,s);return row;
}
function renderMarketTable(){
  const s=state(),wrap=document.getElementById('marketTable'),shown=assets.filter(a=>deskState.filter!=='owned'||s.holdings[a.id]>0);
  wrap.innerHTML='';shown.filter(a=>a.group!=='solar').forEach(a=>wrap.append(marketRow(a)));
  const solar=assets.filter(a=>a.group==='solar'),visible=shown.filter(a=>a.group==='solar');
  if(visible.length){
    const sector=document.createElement('details');sector.className='sector-section';sector.open=deskState.solarOpen||deskState.filter==='owned';
    const index=solar.reduce((n,a)=>n+s.prices[a.id]/a.price,0)/solar.length*100;
    const prev=s.priceHistory.at(-2),prevIndex=prev?solar.reduce((n,a)=>n+prev.global[a.id]/a.price,0)/solar.length*100:null;
    sector.innerHTML=`<summary><div><strong>Solar / Grid Infrastructure</strong><small>Modules · Inverters · Transformers · Battery Cells</small></div><span>${index.toFixed(1)} <b class="${prevIndex&&index>prevIndex?'positive':prevIndex&&index<prevIndex?'negative':'neutral'}">${prevIndex?pct(index/prevIndex-1):'—'}</b><small>Equal-weight reference index · expand to trade</small></span></summary><div class="sector-rows"></div>`;
    visible.forEach(a=>sector.querySelector('.sector-rows').append(marketRow(a)));
    sector.addEventListener('toggle',()=>{if(sector.isConnected){deskState.solarOpen=sector.open;saveUI();}});wrap.append(sector);
  }
  if(!shown.length)wrap.innerHTML='<div class="empty-state">No inventory yet. Switch to All markets to find your first trade.</div>';
}

function openWhy(assetId){
  const s=state(),asset=getAsset(assetId),hub=currentHub();
  const r=s.moveReasons[assetId]||{event:0,noise:0,meanReversion:0,total:0,eventTitle:'No repricing yet'};
  const basis=(hub.spreads[assetId]||1)-1;
  const drift=((s.hubDrift[hub.id]&&s.hubDrift[hub.id][assetId])||1)-1;
  document.getElementById('whyAsset').textContent=`${asset.name} · ${hub.name}`;
  document.getElementById('whyPrice').textContent=money(localPrice(assetId));
  document.getElementById('whyMove').textContent=s.moves[assetId]===0?'No reference move yet':pct(s.moves[assetId]);
  document.getElementById('whyLeader').textContent=`${asset.leaderLabel}: ${asset.leader}`;
  document.getElementById('whyEventTitle').textContent=r.eventTitle;
  const rows=[['Event shock',r.event],['Ordinary volatility',r.noise],['Mean reversion',r.meanReversion],[`${hub.code} structural basis`,basis],[`${hub.code} local conditions`,drift]];
  const list=document.getElementById('whyBreakdown');
  list.innerHTML='';
  rows.forEach(([label,val])=>{
    const div=document.createElement('div');
    div.className='why-line';
    div.innerHTML=`<span>${label}</span><strong class="${val>0?'positive':val<0?'negative':'neutral'}">${pct(val)}</strong>`;
    list.appendChild(div);
  });
  document.getElementById('whyModal').classList.add('open');
  document.getElementById('whyClose').focus();
}
function closeWhy(){document.getElementById('whyModal').classList.remove('open');}

function renderPortfolioSnapshot(){
  const s=state(),wrap=document.getElementById('portfolioSnapshot');
  wrap.innerHTML='';
  const owned=assets.filter(a=>s.holdings[a.id]>0).sort((a,b)=>(s.holdings[b.id]*localPrice(b.id))-(s.holdings[a.id]*localPrice(a.id))).slice(0,4);
  if(!owned.length){wrap.innerHTML='<div class="empty-state">No positions yet. Open Markets and put some capital to work.</div>';return;}
  owned.forEach(a=>{
    const value=s.holdings[a.id]*localPrice(a.id),gain=value-s.holdings[a.id]*s.avgCosts[a.id],item=document.createElement('div');
    item.className='snapshot-item';
    item.innerHTML=`<div><strong>${a.name}</strong><span>${s.holdings[a.id]} lot${s.holdings[a.id]===1?'':'s'} · avg ${money(s.avgCosts[a.id])}</span></div><div class="snapshot-value"><strong>${money(value)}</strong><span class="${gain>0?'positive':gain<0?'negative':'neutral'}">${signedMoney(gain)}</span></div>`;
    wrap.appendChild(item);
  });
}

function renderRecentEvents(){
  const events=state().eventHistory.slice(0,4),wrap=document.getElementById('recentEvents');
  wrap.innerHTML='';
  if(!events.length){wrap.innerHTML='<div class="empty-state">Advance the day to start building your intelligence feed.</div>';return;}
  events.forEach(ev=>{
    const item=document.createElement('div');
    item.className='event-mini';
    item.innerHTML=`<div class="sev-dot sev${ev.severity}"></div><div><strong>${ev.title}</strong><span>Day ${ev.day} · ${ev.region}</span></div>`;
    wrap.appendChild(item);
  });
}

function renderIntel(){
  const s=state(),wrap=document.getElementById('intelFeed');
  wrap.innerHTML='';
  const events=s.eventHistory.length?s.eventHistory:[{...s.currentEvent,day:1}];
  events.forEach(ev=>{
    const card=document.createElement('article');
    const impacts=Object.entries(ev.effects).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1])).map(([id,v])=>`<span class="impact-tag ${v>=0?'up':'down'}">${getAsset(id).ticker} ${pct(v)}</span>`).join('');
    card.className='intel-card panel';
    card.innerHTML=`<div class="intel-meta"><span>DAY ${ev.day}</span><span>${ev.region}</span><span>SEVERITY ${ev.severity}</span><span>SIMULATED</span></div><h3>${ev.title}</h3><p>${ev.body}</p><div class="impact-row">${impacts}</div><small>Expected duration: ${ev.duration}</small>`;
    wrap.appendChild(card);
  });
}

function renderPortfolio(){
  const s=state(),wrap=document.getElementById('portfolioTable');
  wrap.innerHTML='';
  const owned=assets.filter(a=>s.holdings[a.id]>0);
  if(!owned.length)wrap.innerHTML='<div class="empty-state roomy">Your portfolio is empty. Buy an asset from the Markets tab.</div>';
  else owned.forEach(a=>{
    const qty=s.holdings[a.id],px=localPrice(a.id),value=qty*px,cost=qty*s.avgCosts[a.id],gain=value-cost,row=document.createElement('div');
    row.className='portfolio-row';
    row.innerHTML=`<div><strong>${a.name}</strong><span>${a.ticker} · ${currentHub().code} liquidation</span></div><div><span>Qty</span><strong>${qty}</strong></div><div><span>Avg</span><strong>${money(s.avgCosts[a.id])}</strong></div><div><span>Value</span><strong>${money(value)}</strong></div><div><span>P/L</span><strong class="${gain>0?'positive':gain<0?'negative':'neutral'}">${signedMoney(gain)}</strong></div>`;
    wrap.appendChild(row);
  });
  renderAllocation(owned);
}

function renderAllocation(owned){
  const s=state(),total=holdingsValue(),donut=document.getElementById('allocationDonut'),legend=document.getElementById('allocationLegend');
  legend.innerHTML='';
  if(total<=0){donut.style.background='conic-gradient(#1b2a35 0 100%)';document.getElementById('allocationCenter').textContent='0%';return;}
  let cursor=0;
  const stops=[];
  owned.forEach((a,i)=>{
    const value=s.holdings[a.id]*localPrice(a.id),share=value/total*100,start=cursor;
    cursor+=share;
    stops.push(`${palette[i%palette.length]} ${start}% ${cursor}%`);
    const div=document.createElement('div');
    div.innerHTML=`<i style="background:${palette[i%palette.length]}"></i><span>${a.ticker}</span><strong>${share.toFixed(0)}%</strong>`;
    legend.appendChild(div);
  });
  donut.style.background=`conic-gradient(${stops.join(',')})`;
  document.getElementById('allocationCenter').textContent=`${Math.round((total/netWorth())*100)}%`;
}

function renderChart(){
  const canvas=document.getElementById('wealthChart');
  if(!canvas)return;
  const ctx=canvas.getContext('2d');
  if(!ctx)return;
  const data=state().wealthHistory,dpr=Math.min(window.devicePixelRatio||1,2),cssW=canvas.clientWidth||520,cssH=canvas.clientHeight||170;
  if(canvas.width!==Math.floor(cssW*dpr)||canvas.height!==Math.floor(cssH*dpr)){canvas.width=Math.floor(cssW*dpr);canvas.height=Math.floor(cssH*dpr);}
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,cssW,cssH);
  const pad=14,min=Math.min(...data,state().startingCash)*.96,max=Math.max(...data,state().startingCash)*1.04,range=Math.max(1,max-min);
  ctx.strokeStyle='rgba(148,170,186,.18)';ctx.lineWidth=1;
  [0,.5,1].forEach(t=>{const y=pad+(cssH-pad*2)*t;ctx.beginPath();ctx.moveTo(pad,y);ctx.lineTo(cssW-pad,y);ctx.stroke();});
  if(data.length<2)return;
  ctx.beginPath();
  data.forEach((v,i)=>{const x=pad+(cssW-pad*2)*(i/(data.length-1)),y=cssH-pad-((v-min)/range)*(cssH-pad*2);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);});
  ctx.strokeStyle='#52d9ff';ctx.lineWidth=2.4;ctx.stroke();
}

function renderHubEdge(){
  const hub=currentHub(),wrap=document.getElementById('hubEdgeList');
  wrap.innerHTML='';
  assets.map(a=>({a,basis:hubFactor(hub.id,a.id)-1})).sort((x,y)=>x.basis-y.basis).slice(0,3).forEach(x=>{
    const div=document.createElement('div');
    div.innerHTML=`<span>${x.a.ticker}</span><strong class="${x.basis<0?'positive':x.basis>0?'negative':'neutral'}">${pct(x.basis)}</strong>`;
    wrap.appendChild(div);
  });
}

function renderAll(){
  renderEvent();renderStats();renderMarketStrip();renderHubs();renderMarketTable();renderPortfolioSnapshot();renderRecentEvents();renderIntel();renderPortfolio();renderChart();renderHubEdge();renderDesk();
  document.dispatchEvent(new CustomEvent('tw:render'));
}

function showDayTransition(){
  const overlay=document.getElementById('dayTransition');
  if(!overlay)return;
  const s=state();
  const movers=[...assets].sort((a,b)=>Math.abs(s.moves[b.id])-Math.abs(s.moves[a.id])).slice(0,3);
  document.getElementById('dayTransitionDay').textContent=s.finished?'FINAL DAY':`DAY ${s.day}`;
  document.getElementById('dayTransitionTitle').textContent=s.currentEvent.title;
  const wrap=document.getElementById('dayTransitionMovers');
  wrap.innerHTML='';
  movers.forEach(asset=>{
    const move=s.moves[asset.id];
    const chip=document.createElement('span');
    chip.className=move>0?'positive':move<0?'negative':'neutral';
    chip.textContent=`${asset.ticker} ${pct(move)}`;
    wrap.appendChild(chip);
  });
  overlay.classList.remove('show');
  void overlay.offsetWidth;
  overlay.classList.add('show');
  overlay.setAttribute('aria-hidden','false');
  // No automatic vibration; respects quiet play and reduced motion.
  clearTimeout(dayTransitionTimer);
  dayTransitionTimer=setTimeout(()=>{overlay.classList.remove('show');overlay.setAttribute('aria-hidden','true');},4000);
}

function advanceTurn(){
  if(state().finished){openResults();return;}
  if(state().day===MAX_DAYS){offerCloseCampaign();return;}
  doAction(advanceDay());
}

function setView(view){
  document.querySelectorAll('[data-view-panel]').forEach(el=>el.classList.toggle('is-active',el.dataset.viewPanel===view));
  document.querySelectorAll('[data-view]').forEach(el=>el.classList.toggle('is-active',el.dataset.view===view));
  document.getElementById('viewTitle').textContent=({dashboard:'Command Center',markets:'Global Markets',intel:'World Intel',portfolio:'Portfolio'})[view]||'Trade Wars';
  deskState.view=view;saveUI();
  location.hash=view==='dashboard'?'':view;
  document.dispatchEvent(new CustomEvent('tw:render'));
  window.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
}

export function initUI(){
  initDesk({action:doAction,render:renderAll,setView,advance:advanceTurn});
  document.querySelectorAll('[data-view]').forEach(btn=>btn.addEventListener('click',()=>setView(btn.dataset.view)));
  document.querySelectorAll('[data-jump]').forEach(btn=>btn.addEventListener('click',()=>setView(btn.dataset.jump)));
  document.getElementById('nextDayBtn').addEventListener('click',advanceTurn);
  document.getElementById('resetBtn').addEventListener('click',offerNewRun);
  document.getElementById('whyClose').addEventListener('click',closeWhy);
  document.getElementById('whyModal').addEventListener('click',e=>{if(e.target.id==='whyModal')closeWhy();});
  document.getElementById('hubSheetClose')?.addEventListener('click',closeHubSheet);
  document.getElementById('hubSheet')?.addEventListener('click',e=>{if(e.target.id==='hubSheet')closeHubSheet();});
  document.getElementById('dayTransition')?.addEventListener('click',e=>{e.currentTarget.classList.remove('show');e.currentTarget.setAttribute('aria-hidden','true');});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeWhy();closeHubSheet();}});
  window.addEventListener('resize',renderChart);
  const initial=(location.hash||'').replace('#','')||deskState.view||'dashboard';
  setView(['markets','intel','portfolio'].includes(initial)?initial:'dashboard');
  renderAll();
}
