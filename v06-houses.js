import {specialties,customers,upgrades,getSpecialty,getCustomer,customerTier,RULES,utcDay,shareURL,parseInvitation} from './v06-data.js?cache=16';
import {getState,getHub,house,maxContracts,relationship,travelCost,nextTenderDay,quoteUpgrade,purchaseUpgrade,nextDecisions,shareResult,resetState,money,pct,campaignReport,getStorageWarning} from './v06-engine.js?cache=16';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state=()=>getState(),id=s=>document.getElementById(s);
let ui={};
const btn=(...a)=>ui.button(...a);
const modeLabel=s=>s.legacyRules?'Preserved campaign':s.mode==='daily'?`Daily ${s.challengeDate} · UTC`:'Free campaign';
export function attemptLabel(s=state()) { return s.mode!=='daily'?'Free campaign':s.attempt===1?'First attempt on this device':s.attempt?'Replay · attempt '+s.attempt:'Attempt not tracked'; }
function newRun(options){
  const result=resetState(options);
  if(result.ok){ui.clearRunUI();ui.closeDialog();ui.actions(result);ui.setView('dashboard');}
  else {const e=id('setupError');if(e)e.textContent=result.message;ui.actions(result);}
}
export function openCompanySetup(prefill={}){
  const selected=getSpecialty(prefill.specialty)||getSpecialty(state().company.specialty)||specialties[0];
  const body=ui.openDialog('Launch a trading house',`<div class="house-kicker">A NEW COMPANY. A DIFFERENT PLAN.</div><p>Your current run is backed up before a new campaign starts. Company advantages last for this run only.</p>
    <label class="desk-label">Company name<input id="companyNameInput" maxlength="40" value="${esc(state().company.name)}" autocomplete="organization"></label>
    <fieldset class="specialty-options"><legend>Choose your business specialty</legend>${specialties.map(h=>`<label class="specialty-option"><input type="radio" name="specialty" value="${h.id}" ${h.id===selected.id?'checked':''}><span><strong>${h.name}</strong><b>${money(h.cash)} · ${h.home==='newyork'?'New York':h.home==='houston'?'Houston':'Singapore'}</b><small>${h.summary}</small></span></label>`).join('')}</fieldset>
    <label class="desk-label">Scenario seed<input id="seedInput" maxlength="48" value="${esc(prefill.seed||'')}" placeholder="Leave blank for a new world" autocomplete="off"></label><p class="desk-note">Same seed + rules ${RULES} = the same market world. Specialty changes starting terms, not tomorrow's news. Daily challenges use a fixed Independent Trader setup.</p><p id="setupError" role="status" class="negative"></p><div class="desk-dialog-actions"></div>`);
  body.lastElementChild.append(btn('Cancel',ui.closeDialog),btn('Start campaign',()=>newRun({companyName:id('companyNameInput').value,specialty:body.querySelector('[name=specialty]:checked').value,seed:id('seedInput').value}),'desk-button accent'),btn('Daily challenge',()=>openDaily()));
}
export function openDaily(date=utcDay()){
  const s=state(),resume=s.mode==='daily'&&s.challengeDate===date&&!s.finished;
  const body=ui.openDialog('Daily challenge',`<div class="challenge-banner"><span>THE SAME WORLD FOR EVERYONE</span><h3>${esc(date)}</h3><p>UTC edition · rules ${RULES}</p></div><div class="desk-kpis"><div><span>Starting cash</span><strong>$50,000</strong></div><div><span>Starting hub</span><strong>New York</strong></div><div><span>Specialty</span><strong>Independent</strong></div><div><span>Length</span><strong>30 sessions</strong></div></div><p>Company upgrades are available under identical rules. Headlines and hub prices are fixed by this edition; your decisions determine the result.</p><p class="desk-note">First attempt / replay labels are tracked on this device only. These are friendly, self-reported scores—not a verified leaderboard. Opening this page or sharing a link does not start an attempt.</p><p>${resume?`Your current attempt is on Day ${s.day}. Resume without resetting it.`:'Starting replaces the active run after creating its previous-run backup. Prior daily attempts are not erased.'}</p><p id="setupError" role="status" class="negative"></p><div class="desk-dialog-actions"></div>`);
  body.lastElementChild.append(btn('Cancel',ui.closeDialog));
  if(resume)body.lastElementChild.append(btn('Resume challenge',()=>{ui.closeDialog();ui.setView('markets');},'desk-button accent'));
  else body.lastElementChild.append(btn('Start daily challenge',()=>newRun({mode:'daily',challengeDate:date,companyName:s.company.name}),'desk-button accent'));
  body.lastElementChild.append(btn('Share challenge link',()=>openShare({title:'Trade Wars daily challenge',text:`Trade Wars · ${date} UTC edition. Same $50,000, New York and Independent setup. Friendly self-reported scores.`,url:shareURL({challengeDate:date})})));
}
function requestUpgrade(upgrade){
  const q=quoteUpgrade(upgrade.id);if(!q.ok)return;
  const h=house(),saving=upgrade.id==='carrier'?` On a Houston trip you would save ${money(travelCost('houston')-Math.round(650*h.travelFactor*.8))}.`:'';
  ui.confirmAction(`Purchase ${upgrade.name}?`,`${money(upgrade.cost)} is deducted now as a non-refundable expense, reducing net worth by the same amount. Cash afterward: ${money(q.cashAfter)}. ${upgrade.summary} ${upgrade.id==='procurement'?'Next tender: Day '+q.nextTender+'. ':''}${upgrade.caution}${saving}`,()=>{ui.actions(purchaseUpgrade(upgrade.id));openTradingHouse();},'Purchase upgrade');
}
export function openTradingHouse(){
  const s=state(),h=house(),active=s.contracts.filter(c=>c.status==='accepted').length;
  const body=ui.openDialog('Your trading house',`<div class="company-hero"><span class="house-monogram">${esc(s.company.name.slice(0,2).toUpperCase())}</span><div><span class="house-kicker">${esc(modeLabel(s))}</span><h3>${esc(s.company.name)}</h3><p>${h.name} · ${esc(getHub(s.company.home)?.name||s.company.home)} headquarters</p></div></div><p>${s.legacyRules?'This campaign is continuing on its original rules. No company bonuses, reputation changes or upgrade expenses are added retroactively. Start a new v0.6 campaign to use Trading Houses.':h.summary}</p>
    <div class="desk-kpis"><div><span>Available cash</span><strong>${money(s.cash)}</strong></div><div><span>Active contracts</span><strong>${active} / ${maxContracts()}</strong></div><div><span>Upgrade spending</span><strong>${money(campaignReport().upgradeCosts)}</strong></div></div>
    <h3>Invest in this run</h3><p class="desk-note">Upgrades cost money, not points. They have no resale value and do not carry into your next campaign.</p><div class="upgrade-grid">${upgrades.map(u=>{const q=quoteUpgrade(u.id),owned=s.company.upgrades.includes(u.id);return `<article class="upgrade-card"><div class="upgrade-top"><strong>${u.name}</strong><b>${money(u.cost)}</b></div><p>${u.summary}</p><p class="desk-note">${owned?'Active for the rest of this run.':q.ok?u.caution:q.message}</p><button type="button" class="desk-button ${owned?'selected':''}" data-upgrade="${u.id}" ${q.ok?'':'disabled'}>${owned?'Owned':q.ok?'Review purchase':'Unavailable'}</button></article>`;}).join('')}</div>
    <h3>People who trust your deliveries</h3><p class="desk-note">One successful delivery earns Proven terms (10% lower future bonds). Three net trust points earn Preferred terms (20% lower future bonds). Any successful relationship can generate a two-day rush offer in a future tender. Cancellation or failure loses one trust point; completing another job rebuilds it. Signed terms never change.</p>
    <div class="customer-grid">${customers.map(c=>{const r=relationship(c.id);return `<article class="customer-card"><div class="condition-meta"><span>${c.business}</span><span class="phase">${s.legacyRules?'Original rules':customerTier(r.trust)}</span></div><h3>${c.name}</h3><div class="trust-track" role="meter" aria-label="${c.name} trust" aria-valuemin="0" aria-valuemax="6" aria-valuenow="${r.trust}"><span style="width:${r.trust/6*100}%"></span></div><p class="desk-note">${r.delivered} delivered · ${r.failed} missed / cancelled · trust ${r.trust}/6</p></article>`;}).join('')}</div><div class="desk-dialog-actions"></div>`);
  body.querySelectorAll('[data-upgrade]').forEach(b=>b.addEventListener('click',()=>requestUpgrade(upgrades.find(u=>u.id===b.dataset.upgrade))));
  body.lastElementChild.append(btn('Review contracts',()=>{ui.closeDialog();reviewContract();}),btn('New company',()=>openCompanySetup()),btn('Daily challenge',()=>openDaily()));
}
function reviewContract(contractId){
  ui.setView('markets');const panel=id('contractsPanel');panel.open=true;
  const exact=contractId?[...panel.querySelectorAll('[data-contract]')].find(b=>b.dataset.contract===contractId):null;
  (exact?.closest('.contract-card')||panel).scrollIntoView({block:'start',behavior:'instant'});
  if(exact)exact.focus({preventScroll:true});
}
function decisionAction(d){
  if(d.kind==='intel')ui.setView('intel');
  else if(d.kind==='results')ui.openResults();
  else if(d.kind==='closing'&&state().day===30)ui.closeCampaign();
  else reviewContract(d.id);
}
function decisionCards(){return nextDecisions().map((d,i)=>`<article class="decision-item"><span class="decision-index">0${i+1}</span><div><strong>${esc(d.title)}</strong><p>${esc(d.detail)}</p><button type="button" class="text-btn" data-decision="${i}">${esc(d.action)} →</button></div></article>`).join('');}
export function renderHouses(){
  const s=state();
  id('companyIdentity').innerHTML=`<span class="house-monogram">${esc(s.company.name.slice(0,2).toUpperCase())}</span><span><strong>${esc(s.company.name)}</strong><small>${house().name} · ${esc(modeLabel(s))}</small></span>`;
  const company=id('companyOverview');company.innerHTML=`<div class="house-overview"><div><span class="house-kicker">YOUR TRADING HOUSE</span><h2>${esc(s.company.name)}</h2><p>${house().name} · ${esc(s.mode==='daily'?attemptLabel(s):s.legacyRules?'Original rules preserved':s.company.upgrades.length+' upgrades · '+s.contracts.filter(c=>c.status==='accepted').length+'/'+maxContracts()+' active contracts')}</p></div><div class="desk-dialog-actions"></div></div>`;
  company.querySelector('.desk-dialog-actions').append(btn('Manage company',openTradingHouse,'desk-button accent'),btn('Daily challenge',()=>openDaily()),btn('Share run',()=>openShare()));
  id('dashboardDecisions').innerHTML=`<div class="desk-section-head"><h2>Your next decisions</h2><span class="desk-note">Known facts, not trading instructions</span></div><div class="decision-grid">${decisionCards()}</div>`;
  const md=id('marketDecisions'),was=md.open;
  md.innerHTML=`<summary>Next decisions · ${nextDecisions().length}<small>${esc(nextDecisions()[0]?.title||'No deadlines')}</small></summary><div class="decision-grid">${decisionCards()}</div>`;md.open=was;
  for(const root of [md,id('dashboardDecisions')])root.querySelectorAll('[data-decision]').forEach(b=>b.addEventListener('click',()=>decisionAction(nextDecisions()[Number(b.dataset.decision)])));
}
export function openShare(payload){
  const data=payload||shareResult();
  if(data.ok===false){ui.openDialog('Share this run',`<p>${esc(data.message)}</p><p class="desk-note">Your current run remains unchanged. New v0.6 runs support matching challenge links.</p>`);return;}
  const text=data.text+'\n'+data.url;
  const body=ui.openDialog('Share the challenge',`<div class="share-preview"><span class="house-kicker">TRADE WARS / FRIENDLY COMPETITION</span><pre>${esc(data.text)}</pre></div><label class="desk-label">Result + invitation link<textarea id="shareText" readonly rows="8">${esc(text)}</textarea></label><p id="shareStatus" role="status" class="desk-note">Preview before sharing. Nothing is sent automatically. Links open a confirmation screen and never overwrite a campaign by themselves.</p><div class="desk-dialog-actions"></div>`);
  const controls=body.lastElementChild;
  if(typeof navigator.share==='function')controls.append(btn('Share…',async()=>{
    try {await navigator.share({title:data.title,text:data.text,url:data.url});id('shareStatus').textContent='Share request completed.';}
    catch(e){id('shareStatus').textContent=e?.name==='AbortError'?'Sharing cancelled. Your run is unchanged.':'Sharing is unavailable here. Copy the text below instead.';}
  },'desk-button accent'));
  controls.append(btn('Copy result + link',async()=>{
    try{if(!navigator.clipboard?.writeText)throw Error('Unavailable');await navigator.clipboard.writeText(text);id('shareStatus').textContent='Copied result and link.';}
    catch{id('shareText').focus();id('shareText').select();id('shareStatus').textContent='Copy is unavailable here. The text is selected—use your browser’s Copy action.';}
  }));
  controls.append(btn('Close',ui.closeDialog));
}
export function appendHouseResults(target,r){
  const context=document.createElement('p');context.className='desk-note';context.textContent=`${r.companyName} · ${getSpecialty(r.specialty)?.name||'Independent'} · ${r.mode==='daily'?r.challengeDate+' UTC · '+attemptLabel(r):'Free campaign'}. Upgrade expenses ${money(r.upgradeCosts||0)} are already deducted. Comparisons use the same specialty and campaign type.`;
  target.before(context);
  target.append(btn('Share result',()=>openShare()));
}
export function reviewInvitation(search=location.search){
  const invitation=parseInvitation(search);if(!invitation)return;
  if(invitation.error){ui.openDialog('Scenario link needs attention',`<p>${esc(invitation.error)}</p><p>Your saved campaign has not changed.</p>`);return;}
  if(invitation.mode==='daily')openDaily(invitation.challengeDate);else openCompanySetup(invitation);
}
export function initHouses(callbacks){
  ui=callbacks;
  const heading=document.querySelector('.topbar > div:first-child'),identity=document.createElement('button');identity.type='button';identity.id='companyIdentity';identity.className='company-identity';identity.setAttribute('aria-label','Manage your trading house');identity.addEventListener('click',openTradingHouse);heading.append(identity);
  const dash=document.querySelector('[data-view-panel=dashboard]');
  for(const [name,tag] of [['dashboardDecisions','section'],['companyOverview','section']]){const el=document.createElement(tag);el.id=name;el.className='desk-panel';dash.prepend(el);}
  const decisions=document.createElement('details');decisions.id='marketDecisions';decisions.className='desk-panel decision-strip';id('deskTools').before(decisions);
  id('deskTools').append(btn('Trading house',openTradingHouse),btn('Daily challenge',()=>openDaily()));
  // Invitations are reviewed only after startup. They never mutate the engine by loading.
  setTimeout(()=>reviewInvitation(),100);
}
