const THEME_KEY = 'trade-wars-interface-theme-v1';

const themes = [
  {id:'command',icon:'◫',name:'Command Center',tag:'Original interface',brand:'GLOBAL MARKETS SIM',top:'GLOBAL TRADING DESK',event:'WORLD EVENT',advance:'Advance Day',complete:'Campaign Complete',reset:'Reset Run',status:'Simulation feed online',views:{dashboard:'Command',markets:'Markets',intel:'World Intel',portfolio:'Portfolio'},titles:{dashboard:'Command Center',markets:'Global Markets',intel:'World Intel',portfolio:'Portfolio'}},
  {id:'situation',icon:'🌐',name:'The Situation Room',tag:'Geopolitical command map',brand:'GLOBAL SITUATION ROOM',top:'WORLD OPERATIONS CENTER',event:'ACTIVE WORLD EVENT',advance:'Advance Situation',complete:'Situation Closed',reset:'New Scenario',status:'Global watch active',views:{dashboard:'Situation',markets:'Markets',intel:'Alerts',portfolio:'Positions'},titles:{dashboard:'World Situation',markets:'Regional Markets',intel:'Active Intelligence',portfolio:'Strategic Positions'}},
  {id:'terminal',icon:'📟',name:'1987 Trade Terminal',tag:'CRT institutional terminal',brand:'GLOBAL TRADE SYSTEM / 87',top:'TW/87 TERMINAL SESSION',event:'WIRE FLASH',advance:'EXEC NEXT.DAY',complete:'SESSION CLOSED',reset:'RESET SESSION',status:'HOST LINK: ONLINE',views:{dashboard:'SYS',markets:'MKT',intel:'WIRE',portfolio:'BOOK'},titles:{dashboard:'SYSTEM OVERVIEW',markets:'MARKET MATRIX',intel:'NEWS WIRE',portfolio:'POSITION BOOK'}},
  {id:'intel',icon:'🕵️',name:'Intelligence Desk',tag:'Analyst dossier room',brand:'GLOBAL INTELLIGENCE DESK',top:'TRADE INTELLIGENCE DIRECTORATE',event:'FLASH CABLE',advance:'Next Briefing',complete:'Case Closed',reset:'Open New File',status:'Secure channel open',views:{dashboard:'Briefing',markets:'Assets',intel:'Signals',portfolio:'Dossier'},titles:{dashboard:'Morning Briefing',markets:'Asset Assessment',intel:'Signal Traffic',portfolio:'Position Dossier'}},
  {id:'freight',icon:'🚢',name:'Global Freight Empire',tag:'Ports, cargo, manifests',brand:'GLOBAL FREIGHT EMPIRE',top:'GLOBAL LOGISTICS CONTROL',event:'PORT DISPATCH',advance:'Advance Watch',complete:'Voyage Complete',reset:'New Voyage',status:'Port network online',views:{dashboard:'Port',markets:'Exchange',intel:'Dispatch',portfolio:'Cargo'},titles:{dashboard:'Port Control',markets:'Cargo Exchange',intel:'Dispatch Feed',portfolio:'Cargo Manifest'}},
  {id:'newspaper',icon:'📰',name:'Financial Newspaper',tag:'Daily printed edition',brand:'THE TRADE WARS LEDGER',top:'BUSINESS · TRADE · WORLD MARKETS',event:'LEAD STORY',advance:'Print Next Edition',complete:'Final Edition',reset:'New Run',status:'Evening edition desk',views:{dashboard:'Front Page',markets:'Markets',intel:'World',portfolio:'Ledger'},titles:{dashboard:'Front Page',markets:'Markets & Commerce',intel:'World Dispatches',portfolio:'Investor Ledger'}},
  {id:'news',icon:'📺',name:'Global News Network',tag:'24-hour market television',brand:'TWNN · GLOBAL BUSINESS',top:'TWNN LIVE',event:'BREAKING NEWS',advance:'Next Broadcast',complete:'Broadcast Complete',reset:'Restart Coverage',status:'LIVE · worldwide',views:{dashboard:'Live Desk',markets:'Market Board',intel:'News Wire',portfolio:'Book'},titles:{dashboard:'Trade Wars Live',markets:'Global Market Board',intel:'Breaking News Wire',portfolio:'Portfolio Desk'}},
  {id:'travel',icon:'🗺️',name:"Trader's Travel Desk",tag:'Passport and dealbook',brand:'TRADER’S TRAVEL DESK',top:'INDEPENDENT GLOBAL TRADER',event:'FIELD DISPATCH',advance:'Board Next Day',complete:'Journey Complete',reset:'New Journey',status:'Passport ready',views:{dashboard:'Passport',markets:'Local Markets',intel:'Dispatches',portfolio:'Ledger'},titles:{dashboard:'Passport & Itinerary',markets:'Local Trading Desk',intel:'Dispatches From Abroad',portfolio:'Travel Ledger'}},
  {id:'control',icon:'🏗️',name:'Supply Chain Control Tower',tag:'Network dependency view',brand:'SUPPLY CHAIN CONTROL TOWER',top:'GLOBAL SUPPLY NETWORK',event:'NETWORK DISRUPTION',advance:'Run Next Cycle',complete:'Cycle Complete',reset:'Reset Network',status:'Network telemetry live',views:{dashboard:'Network',markets:'Inputs',intel:'Alerts',portfolio:'Inventory'},titles:{dashboard:'Network Control',markets:'Input Markets',intel:'Network Alerts',portfolio:'Inventory Exposure'}},
  {id:'briefcase',icon:'💼',name:'The Executive Briefcase',tag:'Private dealmaker desktop',brand:'PRIVATE GLOBAL DEALBOOK',top:'EXECUTIVE TRADE OFFICE',event:'PRIORITY MEMO',advance:'Next Deal Day',complete:'Book Closed',reset:'New Dealbook',status:'Private line connected',views:{dashboard:'Desk',markets:'Deals',intel:'Files',portfolio:'Book'},titles:{dashboard:'Executive Desk',markets:'Deal Sheet',intel:'Briefing Files',portfolio:'Private Book'}},
  {id:'exchange',icon:'📈',name:'Exchange Floor',tag:'Fast, loud market board',brand:'TRADE WARS EXCHANGE',top:'GLOBAL EXCHANGE FLOOR',event:'MARKET FLASH',advance:'Close Session',complete:'Final Bell',reset:'New Session',status:'Market session open',views:{dashboard:'Floor',markets:'Quotes',intel:'Wire',portfolio:'Positions'},titles:{dashboard:'Exchange Floor',markets:'Live Quote Board',intel:'Market Wire',portfolio:'Open Positions'}},
  {id:'surveillance',icon:'🛰️',name:'Global Surveillance Network',tag:'Orbital market awareness',brand:'GLOBAL SURVEILLANCE NETWORK',top:'ECONOMIC OBSERVATION GRID',event:'SIGNAL DETECTED',advance:'Next Sweep',complete:'Sweep Complete',reset:'Clear Network',status:'Orbital feed locked',views:{dashboard:'Globe',markets:'Signals',intel:'Intercepts',portfolio:'Tracked Assets'},titles:{dashboard:'Global Observation',markets:'Economic Signals',intel:'Intercept Queue',portfolio:'Tracked Exposure'}},
  {id:'arcade',icon:'🎮',name:'Trade Wars Arcade',tag:'Maximum game energy',brand:'TRADE WARS // ARCADE',top:'GLOBAL TRADING ARCADE',event:'WORLD EVENT!',advance:'NEXT ROUND ▶',complete:'RUN COMPLETE',reset:'NEW GAME',status:'PLAYER 1 READY',views:{dashboard:'HQ',markets:'Shop',intel:'Alerts',portfolio:'Loadout'},titles:{dashboard:'PLAYER HQ',markets:'GLOBAL MARKET SHOP',intel:'WORLD ALERTS',portfolio:'PLAYER LOADOUT'}}
];

const byId = id => themes.find(t => t.id === id) || themes[0];
let currentTheme = byId(readTheme());
let drawerOpen = false;
let syncPending = false;

function readTheme(){
  try { return localStorage.getItem(THEME_KEY) || 'command'; }
  catch (_) { return 'command'; }
}
function writeTheme(id){
  try { localStorage.setItem(THEME_KEY,id); } catch (_) {}
}
function activeView(){
  return document.querySelector('[data-view-panel].is-active')?.dataset.viewPanel || 'dashboard';
}
function setText(selector,value){
  const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
  if(el && typeof value === 'string' && el.textContent !== value) el.textContent = value;
}
function updateDesktopNav(theme){
  document.querySelectorAll('.nav-btn[data-view]').forEach(btn => {
    const label = theme.views[btn.dataset.view];
    if(!label) return;
    let textNode = Array.from(btn.childNodes).find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
    if(!textNode){
      textNode = document.createTextNode(' ' + label);
      btn.appendChild(textNode);
    } else if(textNode.textContent.trim() !== label){
      textNode.nodeValue = ' ' + label;
    }
  });
}
function updateMobileNav(theme){
  document.querySelectorAll('.mobile-nav-btn[data-view]').forEach(btn => {
    const small = btn.querySelector('small');
    const label = theme.views[btn.dataset.view];
    if(small && label && small.textContent !== label) small.textContent = label;
  });
}
function contextCopy(theme){
  const hub = (document.getElementById('currentHubCode')?.textContent || 'NYC').trim();
  const day = (document.getElementById('dayValue')?.textContent || '1').split('/')[0].trim();
  const event = (document.getElementById('eventTitle')?.textContent || 'World markets active').trim();
  const cash = (document.getElementById('cashValue')?.textContent || '$50,000').trim();
  switch(theme.id){
    case 'terminal': return `TW/87> NODE:${hub}  DAY:${String(day).padStart(2,'0')}  WIRE:${event}`;
    case 'intel': return `CASE ${String(day).padStart(3,'0')} · DESK ${hub} · DISTRIBUTION: TRADER · ${event}`;
    case 'freight': return `MANIFEST // PORT ${hub} // WATCH ${day} // LIQUID CAPITAL ${cash}`;
    case 'newspaper': return `THE TRADE WARS LEDGER · DAY ${day} EDITION · DATELINE ${hub}`;
    case 'news': return `LIVE ● ${hub} | DAY ${day} | BREAKING: ${event}`;
    case 'travel': return `PASSPORT CONTROL · CURRENT STAMP ${hub} · JOURNEY DAY ${day}`;
    case 'control': return `NETWORK STATUS · NODE ${hub} · CYCLE ${day} · ${event}`;
    case 'briefcase': return `DEAL BOOK · ${hub} · DAY ${day} · AVAILABLE ${cash}`;
    case 'exchange': return `OPEN BOARD ◆ ${hub} ◆ SESSION ${day} ◆ ${event}`;
    case 'surveillance': return `ORBITAL FEED · NODE ${hub} · SWEEP ${day} · TRACK: ${event}`;
    case 'arcade': return `PLAYER 1 ★ STAGE ${String(day).padStart(2,'0')} ★ HUB ${hub} ★ SCORE ${cash}`;
    case 'situation': return `WORLD STATUS // HUB ${hub} // DAY ${day} // ACTIVE: ${event}`;
    default: return `GLOBAL DESK · ${hub} · DAY ${day} · ${event}`;
  }
}
function syncTheme(){
  const theme = currentTheme;
  document.body.dataset.theme = theme.id;
  setText('.brand small',theme.brand);
  setText('.topbar .eyebrow',theme.top);
  setText('#viewTitle',theme.titles[activeView()] || 'Trade Wars');
  setText('.live-pill',theme.event);
  setText('.sidebar-foot span:last-child',theme.status);
  setText('#resetBtn',theme.reset);
  const next = document.getElementById('nextDayBtn');
  if(next) next.textContent = next.disabled ? theme.complete : `${theme.advance} →`;
  updateDesktopNav(theme);
  updateMobileNav(theme);
  setText('#themeCurrentName',theme.name);
  setText('#themeContext',contextCopy(theme));
  document.querySelectorAll('.theme-card').forEach(card => {
    const selected = card.dataset.themeChoice === theme.id;
    card.classList.toggle('is-selected',selected);
    card.setAttribute('aria-pressed',selected ? 'true' : 'false');
  });
}
function scheduleSync(){
  if(syncPending) return;
  syncPending = true;
  requestAnimationFrame(() => {
    syncPending = false;
    try { syncTheme(); } catch (err) { console.error('Trade Wars theme sync failed',err); }
  });
}
function ensureStyles(){
  for(const href of ['themes.css?v=4','themes-fixes.css?v=4']){
    if(document.querySelector(`link[href="${href}"]`)) continue;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }
}
function buildControls(){
  const actions = document.querySelector('.topbar-actions');
  if(actions && !document.getElementById('themeBtn')){
    const btn = document.createElement('button');
    btn.id = 'themeBtn';
    btn.type = 'button';
    btn.className = 'ghost-btn theme-button';
    btn.setAttribute('aria-haspopup','dialog');
    btn.innerHTML = '<span class="theme-button-icon">◈</span><span>Interface</span><small id="themeCurrentName">Command Center</small>';
    btn.addEventListener('click',openDrawer);
    actions.prepend(btn);
  }
  const top = document.querySelector('.topbar');
  if(top && !document.getElementById('themeContext')){
    const strip = document.createElement('div');
    strip.id = 'themeContext';
    strip.className = 'theme-context';
    top.after(strip);
  }
  if(!document.getElementById('themeAmbient')){
    const ambient = document.createElement('div');
    ambient.id = 'themeAmbient';
    ambient.className = 'theme-ambient';
    ambient.setAttribute('aria-hidden','true');
    ambient.innerHTML = '<i class="ambient-a"></i><i class="ambient-b"></i><i class="ambient-c"></i>';
    document.body.prepend(ambient);
  }
}
function buildDrawer(){
  if(document.getElementById('themeDrawer')) return;
  const backdrop = document.createElement('div');
  backdrop.id = 'themeDrawer';
  backdrop.className = 'theme-drawer-backdrop';
  backdrop.setAttribute('aria-hidden','true');
  const drawer = document.createElement('section');
  drawer.className = 'theme-drawer';
  drawer.setAttribute('role','dialog');
  drawer.setAttribute('aria-modal','true');
  drawer.innerHTML = '<div class="theme-drawer-head"><div><div class="eyebrow">INTERFACE SYSTEM</div><h2>Choose your Trade Wars world</h2><p>Same economy. Completely different desk.</p></div><button class="theme-close" type="button" aria-label="Close theme selector">×</button></div><div class="theme-grid"></div>';
  const grid = drawer.querySelector('.theme-grid');
  themes.forEach(theme => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'theme-card';
    card.dataset.themeChoice = theme.id;
    card.innerHTML = `<span class="theme-preview preview-${theme.id}" aria-hidden="true"><b>${theme.icon}</b></span><span class="theme-card-copy"><strong>${theme.name}</strong><small>${theme.tag}</small><span>Switch the entire Trade Wars desk to this interface world.</span></span><span class="theme-check">✓</span>`;
    card.addEventListener('click',() => applyTheme(theme.id));
    grid.appendChild(card);
  });
  drawer.querySelector('.theme-close').addEventListener('click',closeDrawer);
  backdrop.addEventListener('click',e => { if(e.target === backdrop) closeDrawer(); });
  backdrop.appendChild(drawer);
  document.body.appendChild(backdrop);
}
function openDrawer(){
  const el = document.getElementById('themeDrawer');
  if(!el) return;
  drawerOpen = true;
  el.classList.add('open');
  el.setAttribute('aria-hidden','false');
  document.body.classList.add('theme-picker-open');
  (el.querySelector('.theme-card.is-selected') || el.querySelector('.theme-card'))?.focus();
}
function closeDrawer(){
  const el = document.getElementById('themeDrawer');
  if(!el) return;
  drawerOpen = false;
  el.classList.remove('open');
  el.setAttribute('aria-hidden','true');
  document.body.classList.remove('theme-picker-open');
}
function applyTheme(id){
  currentTheme = byId(id);
  writeTheme(currentTheme.id);
  syncTheme();
  closeDrawer();
}

export function initThemes(){
  ensureStyles();
  buildControls();
  buildDrawer();
  syncTheme();
  document.addEventListener('click',e => {
    if(e.target.closest('[data-view], [data-jump], #nextDayBtn, #resetBtn, .hub-travel, .buy, .sell')){
      setTimeout(scheduleSync,0);
    }
  },true);
  document.addEventListener('keydown',e => {
    if(e.key === 'Escape' && drawerOpen) closeDrawer();
  });
  window.addEventListener('hashchange',scheduleSync);
}

export {themes,applyTheme};
