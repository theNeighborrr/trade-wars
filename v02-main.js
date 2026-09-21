import {initUI} from './v03-ui.js?cache=4';
import {RELEASE_LABEL,RELEASE_VERSION,RELEASE_BUILD} from './release.js?cache=12';

function addStyles(){
  for(const href of ['v02.css','trade-controls.css?v=1','mobile-vertical.css?v=1','mobile-ux.css?v=1','release.css?cache=11','account-context.css?cache=12']){
    if(document.querySelector(`link[href="${href}"]`))continue;
    const link=document.createElement('link');link.rel='stylesheet';link.href=href;document.head.appendChild(link);
  }
}

function upgradeDOM(){
  const topbar=document.querySelector('.topbar');
  const titleBlock=topbar?.querySelector(':scope > div:first-child');
  if(titleBlock&&!document.getElementById('releaseBadge')){
    const badge=document.createElement('div');
    badge.id='releaseBadge';badge.className='release-badge';
    badge.innerHTML=`<span>Trade Wars</span><strong>${RELEASE_LABEL}</strong>`;
    titleBlock.appendChild(badge);
    document.title=`Trade Wars v${RELEASE_VERSION} — Global Market Strategy`;
    document.documentElement.dataset.release=`v${RELEASE_VERSION}`;
    document.documentElement.dataset.build=String(RELEASE_BUILD);
  }
  if(topbar&&!document.getElementById('mobileHud')){
    const hud=document.createElement('div');
    hud.id='mobileHud';hud.className='mobile-hud';hud.setAttribute('aria-label','Current campaign status');
    hud.innerHTML='<div><span>Day</span><strong id="hudDay">1 / 30</strong></div><div><span>Hub</span><strong id="hudHub">NYC</strong></div><div><span>Net worth</span><strong id="hudWorth">$50,000</strong></div>';
    topbar.after(hud);
  }

  const sideFoot=document.querySelector('.sidebar-foot');
  if(sideFoot&&!document.getElementById('sideHub')){
    const card=document.createElement('div');card.className='sidebar-card hub-sidebar-card';
    card.innerHTML='<div class="eyebrow">CURRENT HUB</div><strong id="sideHub">NYC · New York</strong><p>Local prices differ by market. Moving hubs costs one day.</p>';
    sideFoot.before(card);
  }

  const dashboard=document.querySelector('[data-view-panel="dashboard"]');
  if(dashboard&&!document.getElementById('currentHubName')){
    const firstHead=dashboard.querySelector('.section-head');
    const banner=document.createElement('article');banner.className='hub-banner panel';
    banner.innerHTML='<div class="hub-banner-main"><div class="hub-pin" id="currentHubCode">NYC</div><div><div class="eyebrow">YOUR TRADING HUB</div><h2 id="currentHubName">New York</h2><p id="currentHubNote">Finance & Atlantic gateway</p></div></div><div class="hub-banner-side"><span id="currentHubRegion">NORTH AMERICA</span><div id="hubEdgeList" class="hub-edge-list"></div><button class="text-btn" data-jump="markets" type="button">Compare hubs →</button></div>';
    dashboard.insertBefore(banner,firstHead);
  }

  const markets=document.querySelector('[data-view-panel="markets"]');
  if(markets&&!document.getElementById('hubGrid')){
    const intro=markets.querySelector('.section-intro');
    const h2=intro?.querySelector('h2'),p=intro?.querySelector('p');
    if(h2)h2.textContent='Prices are local. Information is global.';
    if(p)p.textContent='Buy in one hub, travel, and sell into another market. Travel consumes one campaign day and triggers a fresh world event.';
    const table=markets.querySelector('.market-table-wrap');
    const hubSection=document.createElement('div');
    hubSection.innerHTML='<div class="section-head compact"><div><div class="eyebrow">TRADING HUBS</div><h2>Choose your market</h2></div><span class="muted-note">Current hub is highlighted</span></div><div class="mobile-hub-summary" id="mobileHubSummary"></div><div class="hub-grid" id="hubGrid"></div><div class="section-head compact market-board-head"><div><div class="eyebrow">LOCAL BOARD</div><h2>Current prices</h2></div><span class="muted-note">Tap “Why?” for the move breakdown</span></div>';
    while(hubSection.firstChild)markets.insertBefore(hubSection.firstChild,table);
    const heads=markets.querySelectorAll('.market-table-head span');if(heads[1])heads[1].textContent='Local Price';
  }

  if(!document.getElementById('whyModal')){
    const modal=document.createElement('div');modal.className='modal-backdrop';modal.id='whyModal';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','whyAsset');
    modal.innerHTML='<div class="why-modal panel"><div class="why-modal-head"><div><div class="eyebrow">WHY IS THIS MOVING?</div><h2 id="whyAsset">Crude Oil · New York</h2></div><button id="whyClose" class="icon-btn" type="button" aria-label="Close">×</button></div><div class="why-kpis"><div><span>Local price</span><strong id="whyPrice">$0</strong></div><div><span>Reference move</span><strong id="whyMove">—</strong></div></div><p class="why-event" id="whyEventTitle">No repricing yet</p><div id="whyBreakdown" class="why-breakdown"></div><div class="why-foot"><span id="whyLeader">Top producer: —</span><small>Local price = global reference × structural hub basis × local conditions.</small></div></div>';
    document.body.appendChild(modal);
  }

  if(!document.getElementById('hubSheet')){
    const sheet=document.createElement('div');sheet.id='hubSheet';sheet.className='hub-sheet-backdrop';sheet.setAttribute('aria-hidden','true');
    sheet.innerHTML='<section class="hub-sheet" role="dialog" aria-modal="true" aria-labelledby="hubSheetTitle"><div class="hub-sheet-head"><div><div class="eyebrow">TRADING HUBS</div><h2 id="hubSheetTitle">Change market</h2></div><button class="hub-sheet-close" id="hubSheetClose" type="button" aria-label="Close hub picker">×</button></div><div class="hub-sheet-list" id="hubSheetList"></div></section>';
    document.body.appendChild(sheet);
  }

  if(!document.getElementById('dayTransition')){
    const transition=document.createElement('div');transition.id='dayTransition';transition.className='day-transition';transition.setAttribute('aria-hidden','true');
    transition.innerHTML='<div class="day-transition-card"><div class="day-transition-day" id="dayTransitionDay">DAY 2</div><h2>Markets repriced</h2><p id="dayTransitionTitle">New world event</p><div class="day-transition-movers" id="dayTransitionMovers"></div></div>';
    document.body.appendChild(transition);
  }
}

function guardWealthCanvas(){
  const canvas=document.getElementById('wealthChart');
  if(!canvas||typeof canvas.getContext!=='function')return;
  let ctx=null;
  try{ctx=canvas.getContext('2d');}catch(error){console.warn('Wealth chart canvas unavailable',error);}
  if(ctx)return;
  console.warn('Wealth chart disabled: browser returned no 2D canvas context.');
  canvas.getContext=()=>({
    setTransform(){},clearRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},
    strokeStyle:'',lineWidth:1
  });
}

addStyles();
upgradeDOM();
guardWealthCanvas();
initUI();
