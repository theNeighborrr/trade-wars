import {getState,campaignReport,money,exactMoney,pct} from './v06-engine.js?cache=16';
import {submissionFor,boardMeta,eligibility,LEADERBOARD_RULES} from './v07-proof.js?cache=17';
import {readBoard,setNickname,submitScore,deleteScores,hasGuest,guestWarning} from './v07-online.js?cache=17';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const id=s=>document.getElementById(s);
let dialog,profile=null,meta=null,serverDate=null,mode='daily',busy=false,ticket=0,previousFocus=null;
let pendingProof=null,pendingRunId=null,lastBoard=null;
function btn(label,action,kind='desk-button') {const b=document.createElement('button');b.type='button';b.className=kind;b.textContent=label;b.onclick=action;return b;}
function message(text,error=false){const e=id('lbStatus');if(e){e.textContent=text;e.className='lb-status'+(error?' error':'');}}
function setBusy(value){busy=value;dialog.setAttribute('aria-busy',String(value));dialog.querySelectorAll('[data-online-write]').forEach(b=>b.disabled=value||(b.id==='lbPost'&&(!profile||profile.blocked)));}
function currentMeta(){const s=getState();return boardMeta({rules:s.worldRules,mode:s.mode,seed:s.seed,specialty:s.company.specialty,challengeDate:s.challengeDate},serverDate||undefined);}
function close(){ticket++;dialog.close();pendingProof=null;pendingRunId=null;if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});}
function shell(){
 id('lbBody').innerHTML=`<div class="lb-intro"><span class="lb-live">REAL PLAYERS · REPLAY-VALIDATED</span><p>One best closed-campaign result per guest profile and board. Replays are welcome. Daily editions have identical starts; free scenarios are separated by seed and specialty.</p></div>
 <div class="lb-controls"><div class="lb-tabs" role="group" aria-label="Leaderboard type"></div><label class="lb-date">Daily edition · UTC<input type="date" id="lbDate" min="2026-09-20" aria-label="Daily edition date"></label><button id="lbRefresh" type="button" class="desk-button">Refresh board</button></div>
 <p class="desk-note" id="lbContext">Loading the shared board…</p><div id="lbStatus" class="lb-status" role="status" aria-live="polite"></div>
 <section id="lbPlayer" class="lb-player" aria-label="Guest player profile"></section>
 <section id="lbSubmission" class="lb-submission" hidden aria-label="Review score publication"></section>
 <div id="lbMyRank" class="lb-my-rank" hidden></div><section id="lbRows" aria-label="Rankings"></section>
 <div class="lb-footer"><p><strong>What replay-validated means:</strong> the server starts from the same rules and replays the submitted decisions to calculate the score. This does not certify human-only play, first attempts, or no advance knowledge of a public seed.</p><p>Guest profiles are tied to this browser. Clearing its storage or switching devices can lose access to the profile. This is not cloud game saving. Don't use your email or personal contact details as a public nickname.</p></div>`;
 const tabs=id('lbBody').querySelector('.lb-tabs');
 tabs.append(btn('Daily challenge',()=>switchMode('daily'),'desk-button lb-tab-daily'),btn('This scenario',()=>switchMode('current'),'desk-button lb-tab-current'));
 id('lbRefresh').onclick=()=>load(meta);
 id('lbDate').onchange=()=>{if(!busy){mode='daily';pendingProof=null;pendingRunId=null;const date=id('lbDate').value;load({rules:LEADERBOARD_RULES,mode:'daily',seed:'DAILY-'+date,specialty:'independent',challengeDate:date});}};
 renderPlayer();renderSubmit();
}
function updateControls(){
 const daily=meta?.mode==='daily';
 id('lbDate').parentElement.hidden=!daily;id('lbDate').value=meta?.challengeDate||serverDate||'';if(serverDate)id('lbDate').max=serverDate;
 id('lbBody').querySelector('.lb-tab-daily').classList.toggle('selected',mode==='daily');id('lbBody').querySelector('.lb-tab-current').classList.toggle('selected',mode==='current');
 id('lbContext').textContent=meta?(daily?`Daily ${meta.challengeDate} · UTC · $50,000 / New York / Independent`:`Seed ${meta.seed} · ${meta.specialty==='grid'?'Grid Contractor':meta.specialty==='logistics'?'Logistics Broker':'Independent Trader'}`)+` · rules ${meta.rules}`:'Shared board';
}
async function load(nextMeta){
 if(busy)return; const request=++ticket;lastBoard=null;
 message('Loading rankings…');id('lbRows').innerHTML='';id('lbMyRank').hidden=true;
 try{
   const data=await readBoard(nextMeta);
   if(request!==ticket||!dialog.open)return;
   meta=data.meta;serverDate=data.serverDate;profile=data.profile||null;lastBoard=data;
   updateControls();renderPlayer();renderSubmit();renderRows(data);message('');
 }catch(e){if(request!==ticket||!dialog.open)return;message(e.message,true);id('lbRows').innerHTML='<div class="lb-empty"><h3>Board temporarily unavailable</h3><p>No progress was lost. Close this window to keep playing, or refresh to try again.</p></div>';}
}
function renderRows(data){
 const rows=id('lbRows');rows.innerHTML='';
 if(!data.entries?.length){rows.innerHTML='<div class="lb-empty"><span aria-hidden="true">◇</span><h3>The first place is yours to chase.</h3><p>No submitted scores on this board yet. Finish a matching campaign and be the first to post a replay-validated result.</p></div>';}
 else{
  const heading=document.createElement('p');heading.className='desk-note';heading.textContent=`${data.total} player${data.total===1?'':'s'} · showing top ${Math.min(data.limit,data.total)} · equal scores share a rank`;rows.append(heading);
  const list=document.createElement('ol');list.className='lb-list';list.setAttribute('aria-label','Ranked player results');
  for(const row of data.entries){const item=document.createElement('li');item.className='lb-row'+(row.isYou?' is-you':'');item.innerHTML=`<div class="lb-rank" aria-label="Rank ${Number(row.rank)}">${Number(row.rank)<=3?'#':''}${Number(row.rank)}</div><div class="lb-name"><strong>${esc(row.nickname)}${row.isYou?' <span class="lb-you">YOU</span>':''}</strong><span>${esc(row.companyName)}</span><small>${Number(row.deliveries)} deliveries · ${Number(row.trades)} trades</small></div><div class="lb-score"><strong>${exactMoney(Number(row.scoreCents)/100)}</strong><span class="${row.returnPct>=0?'positive':'negative'}">${pct(Number(row.returnPct))}</span><small>Replay-validated</small></div>`;list.append(item);}rows.append(list);
 }
 const mine=id('lbMyRank');mine.hidden=!data.me;
 if(data.me)mine.innerHTML=`<div><span>YOUR BEST ON THIS BOARD</span><strong>#${Number(data.me.rank)} · ${exactMoney(Number(data.me.scoreCents)/100)}</strong></div><p>${data.gapToNextCents==null?'You share the leading score.':`${exactMoney(Number(data.gapToNextCents)/100)} to tie the next higher score.`}</p>`;
}
function renderPlayer(){
 const target=id('lbPlayer');
 if(profile){
   target.innerHTML=`<div><span class="lb-live">YOUR GUEST PROFILE</span><strong>${esc(profile.nickname)}</strong><p class="desk-note">${profile.blocked?'This profile is restricted. Contact the game owner.':'Public nickname · one best score per matching board.'}</p>${guestWarning()?`<p class="desk-note">${esc(guestWarning())}</p>`:''}</div><div class="lb-player-actions"></div>`;
   const actions=target.lastElementChild;actions.append(btn('Change nickname',()=>nicknameForm(true)),btn('Remove my scores',confirmRemoval));
 }else{target.innerHTML='<div><strong>Browse freely. Post when you’re ready.</strong><p class="desk-note">A guest profile gives this browser a server-issued player ID. No email or password. A profile is not a ranked entry; your result is posted only after you approve it.</p></div><div class="lb-player-actions"></div>';target.lastElementChild.append(btn(hasGuest()?'Choose public nickname':'Create guest profile',()=>nicknameForm(false)));}
}
function nicknameForm(editing){
 if(busy)return;const target=id('lbPlayer');target.innerHTML=`<form id="lbProfileForm"><label class="desk-label">Public nickname<input id="lbNickname" type="text" autocomplete="nickname" minlength="3" maxlength="24" pattern="[A-Za-z0-9][A-Za-z0-9 _.\\-]{2,23}" required value="${esc(editing?profile.nickname:'')}" placeholder="Choose a nickname"></label><p class="desk-note">3–24 letters, numbers, spaces, dots, dashes or underscores. This name appears with scores you explicitly publish. Creating a guest profile does not submit your campaign. Access stays in this browser.</p><div class="lb-player-actions"><button class="desk-button accent" type="submit" data-online-write>${editing?'Save nickname':'Create guest profile'}</button><button type="button" class="desk-button" id="lbProfileCancel">Cancel</button></div></form>`;
 id('lbProfileCancel').onclick=renderPlayer;
 id('lbProfileForm').onsubmit=async e=>{e.preventDefault();if(busy)return;const nickname=id('lbNickname').value;setBusy(true);message('Saving guest profile…');try{const data=await setNickname(nickname);profile=data.profile;renderPlayer();renderSubmit();message('Profile ready. Nothing has been posted.');}catch(e){message(e.message,true);}finally{setBusy(false);}};
 id('lbNickname').focus({preventScroll:true});
}
function confirmRemoval(){
 if(busy)return;const target=id('lbPlayer');target.innerHTML='<div><strong>Remove your public scores?</strong><p class="desk-note">This removes your visible leaderboard results and their replay records, not your local campaign or guest identity. Owner-moderated entries remain withheld.</p></div><div class="lb-player-actions"></div>';
 target.lastElementChild.append(btn('Cancel',renderPlayer),btn('Remove my scores',async()=>{if(busy)return;setBusy(true);try{const data=await deleteScores();renderPlayer();setBusy(false);await load(meta);message(`${data.deleted} public result(s) removed. Your campaign is unchanged.`);}catch(e){message(e.message,true);}finally{setBusy(false);}}));
}
function renderSubmit(){
 const target=id('lbSubmission');target.hidden=!pendingProof;
 if(!pendingProof)return;
 const p=pendingProof;target.innerHTML=`<span class="lb-live">REVIEW BEFORE PUBLISHING</span><h3>${esc(p.companyName)}</h3><div class="desk-kpis"><div><span>Final net worth</span><strong>${money(p.expected.worth)}</strong></div><div><span>Return</span><strong>${pct(p.expected.worth/p.expected.startingCash-1)}</strong></div><div><span>Deliveries</span><strong>${Number(p.expected.deliveries)}</strong></div></div><p class="desk-note">${p.meta.mode==='daily'?'Daily '+esc(p.meta.challengeDate)+' UTC':'Seed '+esc(p.meta.seed)+' · '+esc(p.meta.specialty)} · rules ${esc(p.meta.rules)}</p>
 <label class="lb-consent"><input id="lbConsent" type="checkbox"><span>Publish my nickname, company name, final wealth, return, delivery/trade counts and submission time on this public board. Send the ordered game decisions to the server for private replay checking.</span></label><p class="desk-note">Your game save and login tokens are not published. The server calculates the score; a mismatch is rejected. Replays are allowed. Only your best result on each board is retained.</p><div class="lb-submit-actions"></div>`;
 const submit=btn(profile?'Submit for replay validation':'Create a guest profile above to submit',publish,'desk-button accent');submit.id='lbPost';submit.dataset.onlineWrite='';submit.disabled=!profile||profile.blocked||busy;target.lastElementChild.append(submit,btn('Cancel submission',()=>{pendingProof=null;pendingRunId=null;target.hidden=true;}));
}
async function publish(){
 if(busy||!profile||!pendingProof)return;
 if(!id('lbConsent').checked){message('Check the publication consent box before submitting.',true);id('lbConsent').focus();return;}
 if(getState().runId!==pendingRunId){pendingProof=null;renderSubmit();message('The active campaign changed. Review the completed campaign again before posting.',true);return;}
 const proof=pendingProof;setBusy(true);message('Replaying the campaign on the server…');
 try{
   const result=await submitScore(proof);meta=result.meta;lastBoard=result.board;pendingProof=null;pendingRunId=null;renderSubmit();updateControls();renderRows(result.board);
   const text=result.status==='accepted'?'Score accepted and replay-validated.':result.status==='duplicate'?'This result is already on the board. No duplicate was added.':'Your higher previously submitted score was kept.';
   message(text+(result.board.me?` You are ranked #${result.board.me.rank}.`:''));
 }catch(e){message(e.message,true);}finally{setBusy(false);}
}
function prepareSubmission(){
 try {const s=getState();pendingProof=submissionFor(s,campaignReport());pendingRunId=s.runId;mode='current';meta=pendingProof.meta;renderSubmit();return meta;}
 catch(e){pendingProof=null;pendingRunId=null;renderSubmit();message(e.message,true);return null;}
}
function switchMode(next){
 if(busy)return;mode=next;pendingProof=null;pendingRunId=null;renderSubmit();
 if(next==='daily')load(serverDate?{rules:LEADERBOARD_RULES,mode:'daily',seed:'DAILY-'+serverDate,specialty:'independent',challengeDate:serverDate}:null);
 else{try{load(currentMeta());}catch(e){message(e.message,true);}}
}
export function openLeaderboard(action='browse'){
 if(busy)return;
 previousFocus=document.activeElement;
 document.getElementById('deskDialog')?.close();
 pendingProof=null;pendingRunId=null;mode='daily';profile=null;meta=null;shell();
 if(!dialog.open)dialog.showModal();
 if(action==='submit'){
   const chosen=prepareSubmission();
   if(chosen)load(chosen);
   else{id('lbRows').innerHTML='<div class="lb-empty"><h3>No eligible closed result yet</h3><p>Your current campaign has not changed. Browse the daily board above, or return to finish your run.</p></div>';}
 }else load(null);
}
export function initLeaderboard(){
 dialog=document.createElement('dialog');dialog.id='leaderboardDialog';dialog.className='desk-dialog lb-dialog';dialog.setAttribute('aria-labelledby','lbTitle');dialog.innerHTML='<header><div><span class="lb-live">TRADE WARS / GLOBAL LEADERBOARD</span><h2 id="lbTitle">A real score to beat.</h2></div><button id="lbClose" type="button" aria-label="Close leaderboard">×</button></header><div id="lbBody"></div>';document.body.append(dialog);
 id('lbClose').onclick=close;dialog.addEventListener('cancel',()=>{ticket++;pendingProof=null;pendingRunId=null;});
 dialog.addEventListener('keydown',e=>{
  if(e.key!=='Tab')return;
  const focusable=[...dialog.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]')].filter(n=>n.getClientRects().length);
  const first=focusable[0],last=focusable.at(-1);
  if(!first){e.preventDefault();return;}
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
 });
 dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}});
 const launch=btn('Leaderboard',()=>openLeaderboard());launch.id='leaderboardOpen';id('deskTools')?.append(launch);
 const panel=document.createElement('section');panel.id='globalLeaderboardCard';panel.className='desk-panel lb-teaser';panel.innerHTML='<div><span class="lb-live">REAL PLAYERS · OPTIONAL COMPETITION</span><h2>Put your trading house on the board.</h2><p>Same daily scenario. Real submitted results. Server-replayed scores.</p></div><div class="lb-player-actions"></div>';panel.lastElementChild.append(btn('View leaderboard',()=>openLeaderboard(),'desk-button accent'),btn('Submit completed run',()=>openLeaderboard('submit')));id('companyOverview')?.after(panel);
 document.addEventListener('tw:leaderboard',e=>openLeaderboard(e.detail==='submit'?'submit':'browse'));
 // Attach to the retained results renderer without replacing its controls.
 // The guard means our own insertion produces no further mutation loop.
 const attachResultAction=()=>{
  const title=id('deskDialogTitle')?.textContent;
  if(!['Campaign complete','Campaign checkpoint'].includes(title)||id('leaderboardResultsButton'))return;
  const actions=id('deskDialogBody')?.lastElementChild;
  if(!actions?.classList.contains('desk-dialog-actions'))return;
  const button=btn(getState().finished?'Submit to leaderboard':'View leaderboard',()=>openLeaderboard(getState().finished?'submit':'browse'),'desk-button accent');
  button.id='leaderboardResultsButton';actions.append(button);
 };
 const resultsBody=id('deskDialogBody');
 if(resultsBody)new MutationObserver(attachResultAction).observe(resultsBody,{childList:true,subtree:true});

 // Merely playing, launching the game, or reading a local score creates no
 // remote profile, performs no network request, and posts nothing.
}
