(() => {
  const STARTING_CASH = 50000;
  const MAX_DAYS = 30;
  const STORAGE_KEY = 'trade-wars-prototype-v1';

  const assets = [
    { id:'oil', ticker:'CRUDE', name:'Crude Oil', unit:'bbl index', price:82, volatility:.045, sectors:['Energy','Shipping'] },
    { id:'lng', ticker:'LNG', name:'LNG', unit:'gas index', price:61, volatility:.05, sectors:['Energy','Europe'] },
    { id:'freight', ticker:'FRT', name:'Ocean Freight', unit:'route index', price:104, volatility:.07, sectors:['Shipping','Trade'] },
    { id:'steel', ticker:'STL', name:'Steel', unit:'metal index', price:76, volatility:.045, sectors:['Industry','Tariffs'] },
    { id:'chips', ticker:'CHIP', name:'Semiconductors', unit:'tech index', price:164, volatility:.06, sectors:['Technology','Asia'] },
    { id:'copper', ticker:'CU', name:'Copper', unit:'metal index', price:93, volatility:.04, sectors:['Industry','Energy'] },
    { id:'wheat', ticker:'WHT', name:'Wheat', unit:'grain index', price:48, volatility:.055, sectors:['Food','Weather'] },
    { id:'rare', ticker:'REE', name:'Rare Earths', unit:'minerals index', price:131, volatility:.075, sectors:['Technology','Trade'] }
  ];

  const scenarioDeck = [
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

  const palette = ['#52d9ff','#4ee7a8','#ffc45f','#6ca4ff','#b589ff','#ff8a66','#74d5ba','#f395bf'];
  let toastTimer;

  function freshState(){
    const prices = {}; const holdings = {}; const avgCosts = {}; const moves = {};
    assets.forEach(a => { prices[a.id]=a.price; holdings[a.id]=0; avgCosts[a.id]=0; moves[a.id]=0; });
    return {
      day:1,cash:STARTING_CASH,prices,holdings,avgCosts,moves,
      wealthHistory:[STARTING_CASH],
      currentEvent:{region:'GLOBAL',severity:2,title:'Shipping insurers raise risk premiums through a key trade corridor',body:'Longer routes and tighter capacity push transport costs higher. Energy and bulk commodities may move with freight.',duration:'2–4 days',effects:{freight:.08,oil:.025,wheat:.015},tags:['Shipping','Risk premium']},
      eventHistory:[], usedEvents:[], finished:false
    };
  }

  let state = loadState();

  function loadState(){
    try{
      const raw=localStorage.getItem(STORAGE_KEY);
      if(!raw) return freshState();
      const parsed=JSON.parse(raw);
      if(!parsed || !parsed.prices || !parsed.holdings) return freshState();
      return parsed;
    }catch(e){ return freshState(); }
  }
  function saveState(){ try{ localStorage.setItem(STORAGE_KEY,JSON.stringify(state)); }catch(e){} }
  const money = n => '$' + Math.round(n).toLocaleString();
  const pct = n => (n>0?'+':'') + (n*100).toFixed(1) + '%';
  const signedMoney = n => (n>0?'+':'') + money(n);
  function holdingsValue(){ return assets.reduce((s,a)=>s+state.holdings[a.id]*state.prices[a.id],0); }
  function netWorth(){ return state.cash + holdingsValue(); }
  function investedCost(){ return assets.reduce((s,a)=>s+state.holdings[a.id]*state.avgCosts[a.id],0); }
  function unrealized(){ return holdingsValue()-investedCost(); }

  function showToast(message){
    const el=document.getElementById('toast'); el.textContent=message; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('show'),2200);
  }

  function trade(id,dir,qty=1){
    if(state.finished) return showToast('This run is complete. Reset to play again.');
    const asset=assets.find(a=>a.id===id); const price=state.prices[id];
    if(dir>0){
      const cost=price*qty;
      if(state.cash<cost) return showToast('Not enough cash for that trade.');
      const oldQty=state.holdings[id];
      const newQty=oldQty+qty;
      state.avgCosts[id]=((state.avgCosts[id]*oldQty)+(price*qty))/newQty;
      state.holdings[id]=newQty; state.cash-=cost;
      showToast(`Bought ${qty} ${asset.ticker} lot${qty>1?'s':''} at ${money(price)}.`);
    }else{
      if(state.holdings[id]<qty) return showToast('You do not own enough to sell.');
      state.holdings[id]-=qty; state.cash+=price*qty;
      if(state.holdings[id]===0) state.avgCosts[id]=0;
      showToast(`Sold ${qty} ${asset.ticker} lot${qty>1?'s':''} at ${money(price)}.`);
    }
    saveState(); renderAll();
  }

  function chooseEvent(){
    let choices=scenarioDeck.map((_,i)=>i).filter(i=>!state.usedEvents.includes(i));
    if(!choices.length){ state.usedEvents=[]; choices=scenarioDeck.map((_,i)=>i); }
    const idx=choices[Math.floor(Math.random()*choices.length)];
    state.usedEvents.push(idx); return scenarioDeck[idx];
  }

  function advanceDay(){
    if(state.finished) return;
    const ev=chooseEvent();
    state.currentEvent=ev;
    const dayRecord={...ev,day:state.day+1};
    state.eventHistory.unshift(dayRecord);
    state.eventHistory=state.eventHistory.slice(0,18);

    assets.forEach(asset=>{
      const eventMove=ev.effects[asset.id]||0;
      const noise=(Math.random()-.5)*2*asset.volatility;
      const meanRevert=((asset.price-state.prices[asset.id])/asset.price)*.018;
      const severityScale=.68 + ev.severity*.12;
      const raw=eventMove*severityScale + noise + meanRevert;
      const move=Math.max(-.28,Math.min(.30,raw));
      state.moves[asset.id]=move;
      state.prices[asset.id]=Math.max(8,state.prices[asset.id]*(1+move));
    });

    state.day += 1;
    state.wealthHistory.push(netWorth());
    if(state.day>=MAX_DAYS){
      state.finished=true;
      showToast(`Campaign complete — final net worth ${money(netWorth())}.`);
    }else{
      showToast(`Day ${state.day}: ${ev.region} shock repriced the board.`);
    }
    saveState(); renderAll();
  }

  function renderEvent(){
    const ev=state.currentEvent;
    document.getElementById('eventRegion').textContent=ev.region;
    document.getElementById('eventSeverity').textContent=`SEVERITY ${ev.severity}`;
    document.getElementById('eventTitle').textContent=ev.title;
    document.getElementById('eventBody').textContent=ev.body;
    document.getElementById('eventDuration').textContent=`Expected duration: ${ev.duration}`;
    const wrap=document.getElementById('impactTags'); wrap.innerHTML='';
    const entries=Object.entries(ev.effects).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1])).slice(0,4);
    entries.forEach(([id,val])=>{
      const asset=assets.find(a=>a.id===id); const span=document.createElement('span');
      span.className=`impact-tag ${val>=0?'up':'down'}`; span.textContent=`${asset.ticker} ${pct(val)}`; wrap.appendChild(span);
    });
  }

  function renderStats(){
    const worth=netWorth(); const pnl=worth-STARTING_CASH; const held=holdingsValue();
    document.getElementById('netWorth').textContent=money(worth);
    document.getElementById('cashValue').textContent=money(state.cash);
    document.getElementById('holdingsValue').textContent=money(held);
    const pnlEl=document.getElementById('pnlValue'); pnlEl.textContent=signedMoney(pnl); pnlEl.className=pnl>0?'positive':pnl<0?'negative':'neutral';
    document.getElementById('dayValue').textContent=`${state.day} / ${MAX_DAYS}`;
    document.getElementById('sideDay').textContent=`${state.day} / ${MAX_DAYS}`;
    document.getElementById('campaignProgress').style.width=`${(state.day/MAX_DAYS)*100}%`;
    document.getElementById('marketCash').textContent=money(state.cash);
    document.getElementById('investedKpi').textContent=money(investedCost());
    const un=document.getElementById('unrealizedKpi'); un.textContent=signedMoney(unrealized()); un.className=unrealized()>0?'positive':unrealized()<0?'negative':'neutral';
    const performance=(worth/STARTING_CASH)-1; const badge=document.getElementById('performanceBadge');
    badge.textContent=state.finished?'FINAL':performance>.2?'SURGING':performance>.05?'AHEAD':performance<-.12?'UNDER PRESSURE':performance<-.03?'BEHIND':'STEADY';
    document.getElementById('nextDayBtn').disabled=state.finished;
    document.getElementById('nextDayBtn').innerHTML=state.finished?'Campaign Complete':'Advance Day <span>→</span>';
  }

  function renderMarketStrip(){
    const wrap=document.getElementById('marketStrip'); wrap.innerHTML='';
    [...assets].sort((a,b)=>Math.abs(state.moves[b.id])-Math.abs(state.moves[a.id])).slice(0,4).forEach(asset=>{
      const move=state.moves[asset.id]; const tile=document.createElement('button'); tile.type='button'; tile.className='market-tile'; tile.dataset.jump='markets';
      tile.innerHTML=`<div class="top"><span>${asset.ticker}</span><span>${asset.name}</span></div><div class="price">${money(state.prices[asset.id])}</div><div class="move ${move>0?'positive':move<0?'negative':'neutral'}">${move===0?'No move yet':pct(move)}</div>`;
      tile.addEventListener('click',()=>setView('markets')); wrap.appendChild(tile);
    });
  }

  function renderMarketTable(){
    const wrap=document.getElementById('marketTable'); wrap.innerHTML='';
    assets.forEach(asset=>{
      const row=document.createElement('div'); row.className='market-row';
      const move=state.moves[asset.id];
      row.innerHTML=`
        <div class="asset-name">${asset.name}<small>${asset.ticker} · ${asset.unit}</small></div>
        <div class="market-price">${money(state.prices[asset.id])}</div>
        <div class="${move>0?'positive':move<0?'negative':'neutral'}">${move===0?'—':pct(move)}</div>
        <div>${state.holdings[asset.id]}</div>
        <div class="exposure">${asset.sectors.map(s=>`<span class="sector-chip">${s}</span>`).join('')}</div>
        <div class="trade-box"></div>`;
      const tradeBox=row.querySelector('.trade-box');
      const buy=document.createElement('button'); buy.type='button'; buy.className='buy'; buy.textContent='Buy'; buy.addEventListener('click',()=>trade(asset.id,1));
      const sell=document.createElement('button'); sell.type='button'; sell.className='sell'; sell.textContent='Sell'; sell.disabled=state.holdings[asset.id]===0; sell.addEventListener('click',()=>trade(asset.id,-1));
      tradeBox.append(buy,sell); wrap.appendChild(row);
    });
  }

  function renderPortfolioSnapshot(){
    const wrap=document.getElementById('portfolioSnapshot'); wrap.innerHTML='';
    const owned=assets.filter(a=>state.holdings[a.id]>0).sort((a,b)=>(state.holdings[b.id]*state.prices[b.id])-(state.holdings[a.id]*state.prices[a.id])).slice(0,4);
    if(!owned.length){ wrap.innerHTML='<div class="empty-state">No positions yet. Open Markets and put some capital to work.</div>'; return; }
    owned.forEach(a=>{
      const value=state.holdings[a.id]*state.prices[a.id]; const gain=value-state.holdings[a.id]*state.avgCosts[a.id];
      const item=document.createElement('div'); item.className='snapshot-item';
      item.innerHTML=`<div><strong>${a.name}</strong><span>${state.holdings[a.id]} lot${state.holdings[a.id]===1?'':'s'} · avg ${money(state.avgCosts[a.id])}</span></div><div class="snapshot-value"><strong>${money(value)}</strong><span class="${gain>0?'positive':gain<0?'negative':'neutral'}">${signedMoney(gain)}</span></div>`; wrap.appendChild(item);
    });
  }

  function renderRecentEvents(){
    const wrap=document.getElementById('recentEvents'); wrap.innerHTML='';
    const events=state.eventHistory.slice(0,4);
    if(!events.length){ wrap.innerHTML='<div class="empty-state">Advance the day to start generating market-moving events.</div>'; return; }
    events.forEach(ev=>{
      const div=document.createElement('div'); div.className='event-mini';
      div.innerHTML=`<div><strong>${ev.title}</strong><p>${ev.region} · Day ${ev.day}</p></div><span><i class="sev sev${ev.severity}"></i></span>`; wrap.appendChild(div);
    });
  }

  function renderIntel(){
    const wrap=document.getElementById('intelFeed'); wrap.innerHTML='';
    const current={...state.currentEvent,day:state.day,current:true};
    const list=[current,...state.eventHistory.filter(e=>e.day!==state.day)].slice(0,12);
    list.forEach(ev=>{
      const card=document.createElement('article'); card.className='intel-card';
      const impacts=Object.entries(ev.effects).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1])).slice(0,4).map(([id,v])=>{ const a=assets.find(x=>x.id===id); return `<span class="impact-tag ${v>=0?'up':'down'}">${a.ticker} ${pct(v)}</span>`;}).join('');
      card.innerHTML=`<div class="intel-top"><span>${ev.region}</span><span><i class="sev sev${ev.severity}"></i> SEVERITY ${ev.severity}</span></div><h3>${ev.title}</h3><p>${ev.body}</p><div class="impact-row">${impacts}</div><div class="intel-day">${ev.current?'CURRENT EVENT':'DAY '+ev.day} · SIMULATED SCENARIO</div>`; wrap.appendChild(card);
    });
  }

  function renderPortfolio(){
    const table=document.getElementById('portfolioTable'); table.innerHTML='';
    const owned=assets.filter(a=>state.holdings[a.id]>0);
    if(!owned.length){ table.innerHTML='<div class="empty-state">Your portfolio is all cash. Buy a market position to see allocation and P/L here.</div>'; }
    else{
      const head=document.createElement('div'); head.className='position-row header'; head.innerHTML='<div>Asset</div><div class="right">Qty</div><div class="right">Avg cost</div><div class="right">Value</div><div class="right">P/L</div>'; table.appendChild(head);
      owned.forEach(a=>{
        const val=state.holdings[a.id]*state.prices[a.id]; const gain=val-state.holdings[a.id]*state.avgCosts[a.id]; const row=document.createElement('div'); row.className='position-row';
        row.innerHTML=`<div class="asset-name">${a.name}<small>${a.ticker}</small></div><div class="right">${state.holdings[a.id]}</div><div class="right">${money(state.avgCosts[a.id])}</div><div class="right">${money(val)}</div><div class="right ${gain>0?'positive':gain<0?'negative':'neutral'}">${signedMoney(gain)}</div>`; table.appendChild(row);
      });
    }
    renderAllocation(owned);
  }

  function renderAllocation(owned){
    const legend=document.getElementById('allocationLegend'); legend.innerHTML='';
    const total=holdingsValue(); const nw=netWorth(); const investedPct=nw?Math.round((total/nw)*100):0;
    const donut=document.getElementById('allocationDonut'); document.getElementById('allocationCenter').textContent=`${investedPct}%`;
    if(!owned.length){ donut.style.background='conic-gradient(#142735 0 100%)'; legend.innerHTML='<div class="empty-state">100% cash</div>'; return; }
    let acc=0; const stops=[];
    owned.forEach((a,i)=>{ const share=(state.holdings[a.id]*state.prices[a.id])/total*100; stops.push(`${palette[i%palette.length]} ${acc}% ${acc+share}%`); acc+=share; const row=document.createElement('div'); row.className='alloc-row'; row.innerHTML=`<span class="alloc-name"><i class="alloc-dot" style="background:${palette[i%palette.length]}"></i>${a.ticker}</span><strong>${share.toFixed(0)}%</strong>`; legend.appendChild(row); });
    donut.style.background=`conic-gradient(${stops.join(',')})`;
  }

  function drawChart(){
    const c=document.getElementById('wealthChart'); const ctx=c.getContext('2d'); if(!ctx) return;
    const dpr=Math.max(1,window.devicePixelRatio||1); const rect=c.getBoundingClientRect(); const w=Math.max(260,Math.floor(rect.width*dpr)); const h=Math.max(100,Math.floor(rect.height*dpr));
    if(c.width!==w||c.height!==h){c.width=w;c.height=h} ctx.clearRect(0,0,w,h);
    const data=state.wealthHistory; if(data.length<1)return; const pad=14*dpr; let min=Math.min(...data,STARTING_CASH),max=Math.max(...data,STARTING_CASH); const spread=Math.max(4000,max-min); min-=spread*.25; max+=spread*.25;
    const x=i=>pad+(data.length===1?0:(i/(Math.max(1,data.length-1)))*(w-pad*2)); const y=v=>h-pad-((v-min)/(max-min))*(h-pad*2);
    ctx.strokeStyle='rgba(140,164,179,.14)';ctx.lineWidth=dpr;ctx.beginPath();ctx.moveTo(pad,y(STARTING_CASH));ctx.lineTo(w-pad,y(STARTING_CASH));ctx.stroke();
    if(data.length===1){ctx.fillStyle='#52d9ff';ctx.beginPath();ctx.arc(x(0),y(data[0]),3*dpr,0,Math.PI*2);ctx.fill();return;}
    const grad=ctx.createLinearGradient(0,0,w,0);grad.addColorStop(0,'#52d9ff');grad.addColorStop(1,'#4ee7a8');ctx.strokeStyle=grad;ctx.lineWidth=2.2*dpr;ctx.lineJoin='round';ctx.lineCap='round';ctx.beginPath();data.forEach((v,i)=>i?ctx.lineTo(x(i),y(v)):ctx.moveTo(x(i),y(v)));ctx.stroke();
  }

  function setView(view){
    document.querySelectorAll('[data-view-panel]').forEach(p=>p.classList.toggle('is-active',p.dataset.viewPanel===view));
    document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('is-active',b.dataset.view===view));
    const titles={dashboard:'Command Center',markets:'Market Terminal',intel:'World Intel',portfolio:'Portfolio'}; document.getElementById('viewTitle').textContent=titles[view]||'Trade Wars';
    window.scrollTo({top:0,behavior:'smooth'}); if(view==='dashboard') setTimeout(drawChart,20);
  }

  function renderAll(){ renderEvent();renderStats();renderMarketStrip();renderMarketTable();renderPortfolioSnapshot();renderRecentEvents();renderIntel();renderPortfolio();drawChart(); }

  document.querySelectorAll('[data-view]').forEach(btn=>btn.addEventListener('click',()=>setView(btn.dataset.view)));
  document.querySelectorAll('[data-jump]').forEach(btn=>btn.addEventListener('click',()=>setView(btn.dataset.jump)));
  document.getElementById('nextDayBtn').addEventListener('click',advanceDay);
  document.getElementById('resetBtn').addEventListener('click',()=>{ if(confirm('Reset this 30-day campaign and erase the current portfolio?')){ state=freshState(); saveState(); renderAll(); showToast('New campaign started.'); }});
  window.addEventListener('resize',()=>{ if(document.querySelector('[data-view-panel="dashboard"]').classList.contains('is-active')) drawChart(); });

  renderAll();
})();
