import {STARTING_CASH,MAX_DAYS,assets,hubs,palette} from './v02-data.js';
import {getState,getAsset,currentHub,hubFactor,localPrice,holdingsValue,netWorth,investedCost,unrealized,money,pct,signedMoney,trade,advanceDay,travelTo,resetState} from './v02-engine.js';

let toastTimer;
let dayTransitionTimer;
const tradeSelection=new Map();
const state=()=>getState();
const leaderLine=asset=>`<span class="leader-line">${asset.leaderLabel} · ${asset.leader}</span>`;

function showToast(message){
  const el=document.getElementById('toast');
  if(!el)return;
  el.textContent=message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>el.classList.remove('show'),2400);
}
function doAction(result){showToast(result.message);renderAll();}

function renderEvent(){
  const ev=state().currentEvent;
  document.getElementById('eventRegion').textContent=ev.region;
  document.getElementById('eventSeverity').textContent=`SEVERITY ${ev.severity}`;
  document.getElementById('eventTitle').textContent=ev.title;
  document.getElementById('eventBody').textContent=ev.body;
  document.getElementById('eventDuration').textContent=`Expected duration: ${ev.duration}`;
  const wrap=document.getElementById('impactTags');
  wrap.innerHTML='';
  Object.entries(ev.effects).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1])).slice(0,4).forEach(([id,val])=>{
    const span=document.createElement('span');
    span.className=`impact-tag ${val>=0?'up':'down'}`;
    span.textContent=`${getAsset(id).ticker} ${pct(val)}`;
    wrap.appendChild(span);
  });
}

function renderStats(){
  const s=state(),worth=netWorth(),pnl=worth-STARTING_CASH,held=holdingsValue(),hub=currentHub();
  document.getElementById('netWorth').textContent=money(worth);
  document.getElementById('cashValue').textContent=money(s.cash);
  document.getElementById('holdingsValue').textContent=money(held);
  const pnlEl=document.getElementById('pnlValue');
  pnlEl.textContent=signedMoney(pnl);
  pnlEl.className=pnl>0?'positive':pnl<0?'negative':'neutral';
  document.getElementById('dayValue').textContent=`${s.day} / ${MAX_DAYS}`;
  document.getElementById('sideDay').textContent=`${s.day} / ${MAX_DAYS}`;
  document.getElementById('campaignProgress').style.width=`${(s.day/MAX_DAYS)*100}%`;
  document.getElementById('marketCash').textContent=money(s.cash);
  document.getElementById('investedKpi').textContent=money(investedCost());
  const un=document.getElementById('unrealizedKpi');
  un.textContent=signedMoney(unrealized());
  un.className=unrealized()>0?'positive':unrealized()<0?'negative':'neutral';
  const performance=(worth/STARTING_CASH)-1,badge=document.getElementById('performanceBadge');
  badge.textContent=s.finished?'FINAL':performance>.2?'SURGING':performance>.05?'AHEAD':performance<-.12?'UNDER PRESSURE':performance<-.03?'BEHIND':'STEADY';
  document.getElementById('nextDayBtn').disabled=s.finished;
  document.getElementById('nextDayBtn').innerHTML=s.finished?'Campaign Complete':'Advance Day <span>→</span>';
  document.getElementById('sideHub').textContent=`${hub.code} · ${hub.name}`;
  document.getElementById('currentHubName').textContent=hub.name;
  document.getElementById('currentHubCode').textContent=hub.code;
  document.getElementById('currentHubNote').textContent=hub.note;
  document.getElementById('currentHubRegion').textContent=hub.region;
  const hudDay=document.getElementById('hudDay'),hudHub=document.getElementById('hudHub'),hudWorth=document.getElementById('hudWorth');
  if(hudDay)hudDay.textContent=`${s.day} / ${MAX_DAYS}`;
  if(hudHub)hudHub.textContent=hub.code;
  if(hudWorth)hudWorth.textContent=money(worth);
}

function renderMarketStrip(){
  const s=state(),wrap=document.getElementById('marketStrip');
  wrap.innerHTML='';
  [...assets].sort((a,b)=>Math.abs(s.moves[b.id])-Math.abs(s.moves[a.id])).slice(0,4).forEach(asset=>{
    const move=s.moves[asset.id],tile=document.createElement('button');
    tile.type='button';
    tile.className='market-tile';
    tile.innerHTML=`<div class="top"><span>${asset.ticker}</span><span>${asset.name}</span></div>${leaderLine(asset)}<div class="price">${money(localPrice(asset.id))}</div><div class="move ${move>0?'positive':move<0?'negative':'neutral'}">${move===0?'No move yet':pct(move)}</div><div class="local-caption">${currentHub().code} local price</div>`;
    tile.addEventListener('click',()=>setView('markets'));
    wrap.appendChild(tile);
  });
}

function openHubSheet(){
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
    card.innerHTML=`<div class="hub-card-top"><span class="hub-code">${hub.code}</span><span class="hub-region">${hub.region}</span></div><h3>${hub.name}</h3><p>${hub.note}</p><div class="hub-edge">Relative bargain <strong>${cheapest.a.ticker}</strong></div><button type="button" class="${here?'hub-here':'hub-travel'}" ${here?'disabled':''}>${here?'Current hub':`Travel · 1 day · ${money(hub.travelCost)}`}</button>`;
    const btn=card.querySelector('button');
    if(!here)btn.addEventListener('click',()=>doAction(travelTo(hub.id)));
    wrap.appendChild(card);

    if(sheetList){
      const option=document.createElement('button');
      option.type='button';
      option.className=`hub-sheet-option ${here?'is-current':''}`;
      option.disabled=here;
      option.innerHTML=`<span class="hub-sheet-code">${hub.code}</span><span class="hub-sheet-copy"><strong>${hub.name}</strong><span>${hub.note}</span></span><span class="hub-sheet-action">${here?'CURRENT':`TRAVEL<small>1 day · ${money(hub.travelCost)}</small>`}</span>`;
      if(!here)option.addEventListener('click',()=>{
        const result=travelTo(hub.id);
        closeHubSheet();
        doAction(result);
      });
      sheetList.appendChild(option);
    }
  });
}

function quantitySteps(maxQty){
  const max=Math.max(1,Math.floor(maxQty));
  const base=[1,2,5,10,25,50,100,250,500,1000,2500,5000,10000];
  return [...new Set([...base.filter(n=>n<=max),max])].sort((a,b)=>a-b);
}

function sliderMarkup(asset,price,s){
  const affordable=Math.max(0,Math.floor(s.cash/price));
  const owned=s.holdings[asset.id]||0;
  const maxQty=Math.max(1,affordable,owned);
  const steps=quantitySteps(maxQty);
  const remembered=Math.min(maxQty,Math.max(1,tradeSelection.get(asset.id)||1));
  let stepIndex=steps.findIndex(n=>n>=remembered);
  if(stepIndex<0)stepIndex=steps.length-1;
  return `<div class="trade-qty" data-asset="${asset.id}" data-price="${price}" data-affordable="${affordable}" data-owned="${owned}" data-steps="${steps.join(',')}">
    <div class="qty-slider-wrap">
      <output class="qty-bubble">${steps[stepIndex]} lot${steps[stepIndex]===1?'':'s'}</output>
      <input class="qty-slider" type="range" min="0" max="${Math.max(0,steps.length-1)}" value="${stepIndex}" step="1" aria-label="Trade quantity for ${asset.name}">
    </div>
    <div class="qty-meta"><span>Quantity</span><div><strong>${steps[stepIndex]} / ${maxQty}</strong><button class="qty-max" type="button">MAX</button></div></div>
  </div>`;
}

function wireTradeControls(row,asset,price,s){
  const box=row.querySelector('.trade-box');
  const slider=row.querySelector('.qty-slider');
  const bubble=row.querySelector('.qty-bubble');
  const meta=row.querySelector('.qty-meta strong');
  const maxButton=row.querySelector('.qty-max');
  const steps=(row.querySelector('.trade-qty')?.dataset.steps||'1').split(',').map(Number).filter(Number.isFinite);
  const buy=document.createElement('button');
  const sell=document.createElement('button');
  buy.type='button';buy.className='buy';
  sell.type='button';sell.className='sell';
  box.append(buy,sell);

  const affordable=Math.max(0,Math.floor(s.cash/price));
  const owned=s.holdings[asset.id]||0;
  const maxQty=steps[steps.length-1]||1;
  const selectedQty=()=>steps[Math.max(0,Math.min(steps.length-1,Number(slider.value)||0))]||1;

  function sync(){
    const idx=Math.max(0,Math.min(steps.length-1,Number(slider.value)||0));
    const qty=selectedQty();
    const ratio=steps.length<=1?0:idx/(steps.length-1);
    slider.style.setProperty('--slider-pct',`${ratio*100}%`);
    bubble.style.left=`${ratio*100}%`;
    bubble.textContent=`${qty} lot${qty===1?'':'s'}`;
    meta.textContent=`${qty} / ${maxQty}`;
    tradeSelection.set(asset.id,qty);
    buy.textContent=`BUY · ${money(price*qty)}`;
    sell.textContent=`SELL · ${money(price*qty)}`;
    buy.disabled=qty>affordable||s.finished;
    sell.disabled=qty>owned||owned===0||s.finished;
  }
  slider.addEventListener('input',sync);
  maxButton?.addEventListener('click',()=>{slider.value=String(Math.max(0,steps.length-1));sync();});
  buy.addEventListener('click',()=>doAction(trade(asset.id,1,selectedQty())));
  sell.addEventListener('click',()=>doAction(trade(asset.id,-1,selectedQty())));
  sync();
}

function renderMarketTable(){
  const s=state(),wrap=document.getElementById('marketTable');
  wrap.innerHTML='';
  assets.forEach(asset=>{
    const row=document.createElement('div'),move=s.moves[asset.id],price=localPrice(asset.id);
    row.className='market-row';
    row.innerHTML=`<div class="asset-name"><strong>${asset.name}</strong><small>${asset.ticker} · ${asset.unit}</small>${leaderLine(asset)}</div><div class="market-price"><strong>${money(price)}</strong><small>${currentHub().code} local</small></div><div class="move-cell"><span class="${move>0?'positive':move<0?'negative':'neutral'}">${move===0?'—':pct(move)}</span><button class="why-btn" type="button">Why?</button></div><div>${s.holdings[asset.id]}</div><div class="exposure">${asset.sectors.map(x=>`<span class="sector-chip">${x}</span>`).join('')}</div><div class="trade-column">${sliderMarkup(asset,price,s)}<div class="trade-box trade-actions-stack"></div></div>`;
    row.querySelector('.why-btn').addEventListener('click',()=>openWhy(asset.id));
    wireTradeControls(row,asset,price,s);
    wrap.appendChild(row);
  });
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
  const pad=14,min=Math.min(...data,STARTING_CASH)*.96,max=Math.max(...data,STARTING_CASH)*1.04,range=Math.max(1,max-min);
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
  renderEvent();renderStats();renderMarketStrip();renderHubs();renderMarketTable();renderPortfolioSnapshot();renderRecentEvents();renderIntel();renderPortfolio();renderChart();renderHubEdge();
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
  if(navigator.vibrate)navigator.vibrate(35);
  clearTimeout(dayTransitionTimer);
  dayTransitionTimer=setTimeout(()=>{overlay.classList.remove('show');overlay.setAttribute('aria-hidden','true');},1350);
}

function advanceTurn(){
  const result=advanceDay();
  showToast(result.message);
  renderAll();
  if(result.ok)showDayTransition();
}

function setView(view){
  document.querySelectorAll('[data-view-panel]').forEach(el=>el.classList.toggle('is-active',el.dataset.viewPanel===view));
  document.querySelectorAll('[data-view]').forEach(el=>el.classList.toggle('is-active',el.dataset.view===view));
  document.getElementById('viewTitle').textContent=({dashboard:'Command Center',markets:'Global Markets',intel:'World Intel',portfolio:'Portfolio'})[view]||'Trade Wars';
  location.hash=view==='dashboard'?'':view;
  window.scrollTo({top:0,behavior:'smooth'});
}

export function initUI(){
  document.querySelectorAll('[data-view]').forEach(btn=>btn.addEventListener('click',()=>setView(btn.dataset.view)));
  document.querySelectorAll('[data-jump]').forEach(btn=>btn.addEventListener('click',()=>setView(btn.dataset.jump)));
  document.getElementById('nextDayBtn').addEventListener('click',advanceTurn);
  document.getElementById('resetBtn').addEventListener('click',()=>{
    if(confirm('Reset this Trade Wars campaign? Your current run will be lost.')){
      resetState();renderAll();setView('dashboard');showToast('Fresh campaign started in New York.');
    }
  });
  document.getElementById('whyClose').addEventListener('click',closeWhy);
  document.getElementById('whyModal').addEventListener('click',e=>{if(e.target.id==='whyModal')closeWhy();});
  document.getElementById('hubSheetClose')?.addEventListener('click',closeHubSheet);
  document.getElementById('hubSheet')?.addEventListener('click',e=>{if(e.target.id==='hubSheet')closeHubSheet();});
  document.getElementById('dayTransition')?.addEventListener('click',e=>{e.currentTarget.classList.remove('show');e.currentTarget.setAttribute('aria-hidden','true');});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeWhy();closeHubSheet();}});
  window.addEventListener('resize',renderChart);
  const initial=(location.hash||'').replace('#','');
  setView(['markets','intel','portfolio'].includes(initial)?initial:'dashboard');
  renderAll();
}
