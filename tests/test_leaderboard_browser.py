"""Local Chromium UI tests; HTTPS responses mocked, backend tested separately."""
from pathlib import Path
import json,os,shutil
from playwright.sync_api import sync_playwright
from offline_browser import mount
ROOT=Path(__file__).resolve().parents[1]
THEMES=['command','situation','terminal','intel','freight','newspaper','news','travel','control','briefcase','exchange','surveillance','arcade']
MOCK=r'''() => {
 window.__lbCalls=[];window.__lbProfile=null;window.__lbHasScore=false;window.__lbOffline=false;window.__lbReject=false;window.__lbRefreshCalls=0;
 const native=window.fetch.bind(window);
 window.fetch=async (url,options={})=>{
   if(!String(url).startsWith('https://awhcmkcijcajbwlcrafz.supabase.co'))return native(url,options);
   const body=options.body?JSON.parse(options.body):null;window.__lbCalls.push({url:String(url),method:options.method,body});
   if(window.__lbOffline)throw new TypeError('offline');
   if(String(url).includes('/auth/')){if(String(url).includes('/token?'))window.__lbRefreshCalls++;return new Response(JSON.stringify({access_token:'test.jwt.token',refresh_token:'test-refresh',expires_at:Math.floor(Date.now()/1000)+3600}),{status:200});}
   const meta={mode:'daily',rules:'0.6.0',seed:'DAILY-2026-09-21',specialty:'independent',challengeDate:'2026-09-21',boardKey:'daily|0.6.0|2026-09-21'};
   const me={rank:2,playerId:'profile-1',nickname:window.__lbProfile?.nickname||'Guest',companyName:'Test Company',scoreCents:5000000,returnPct:0,deliveries:0,trades:0,submittedAt:'2026-09-21',isYou:true};
   const board=()=>({ok:true,meta,serverDate:'2026-09-21',entries:window.__lbHasScore?[{...me,rank:1,isYou:false,nickname:'Another Player',companyName:'Another Trading House',scoreCents:6000000,returnPct:.2},me]:[],me:window.__lbHasScore?me:null,profile:window.__lbProfile,total:window.__lbHasScore?2:0,gapToNextCents:1000000,limit:50});
   if(body?.operation==='profile'){window.__lbProfile={id:'profile-1',nickname:body.nickname,blocked:false};return new Response(JSON.stringify({ok:true,profile:window.__lbProfile}));}
   if(body?.operation==='submit'){if(window.__lbReject)return new Response(JSON.stringify({error:'Replayed worth does not match the recorded result. Nothing was posted.'}),{status:422});window.__lbHasScore=true;return new Response(JSON.stringify({ok:true,status:'accepted',meta:body.proof.meta,board:board()}));}
   if(body?.operation==='delete_scores'){window.__lbHasScore=false;return new Response(JSON.stringify({ok:true,deleted:1}));}
   return new Response(JSON.stringify(board()));
 };
}'''
def engine(p,js):return p.evaluate("async()=>{const g=await import(window.__twModules['v06-engine.js']);"+js+"}")
def openboard(p,mode='browse'):
 p.wait_for_selector('#leaderboardOpen',state='attached')
 p.evaluate("m=>document.dispatchEvent(new CustomEvent('tw:leaderboard',{detail:m}))",mode)
 p.wait_for_selector('#leaderboardDialog[open]')
 p.wait_for_timeout(90)
def assert_fit(p):
 return p.evaluate(r'''()=>{
 const d=document.getElementById('leaderboardDialog'),dr=d.getBoundingClientRect(),out=[];
 if(d.scrollWidth>d.clientWidth+2)out.push('dialog horizontal overflow');
 if(dr.left< -1||dr.right>innerWidth+1)out.push('dialog outside viewport');
 for(const e of d.querySelectorAll('input,button,.lb-row,.lb-submission')){const r=e.getBoundingClientRect();if(!r.width)continue;if(r.left<dr.left-2||r.right>dr.right+2)out.push('clipped '+e.id+' '+e.className);}
 return out;
}''')
report={'browser':'Chromium','fixture':'offline native DOM and mocked HTTPS for UI; backend HTTP tests separate','cases':0,'failures':[],'errors':[],'flows':[]}
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE') or shutil.which('chromium'),headless=True,args=['--no-sandbox'])
 for theme in (['terminal','newspaper'] if os.environ.get('LB_TEST_QUICK') else THEMES):
  print('LB LAYOUT',theme,flush=True)
  p=b.new_page(viewport={'width':390,'height':900},reduced_motion='reduce');p.on('pageerror',lambda e:report['errors'].append(str(e)));p.evaluate(MOCK);mount(p,ROOT,theme)
  assert p.evaluate('window.__lbCalls.length')==0
  for w in [320,390,700,1024,1640]:
   p.set_viewport_size({'width':w,'height':900});openboard(p)
   for state in ['empty','profile','submission','populated']:
    if state=='profile':p.locator('#lbPlayer .desk-button').first.click()
    if state=='submission':
     p.locator('#lbClose').click();engine(p,"g.resetState({seed:'TEST',companyName:'UI Test'});while(g.getState().day<30)g.advanceDay();g.finishCampaign();");openboard(p,'submit')
    if state=='populated':p.evaluate("()=>{window.__lbProfile={id:'profile-1',nickname:'Example Player',blocked:false};window.__lbHasScore=true;}");p.locator('#lbRefresh').click();p.wait_for_timeout(70)
    errors=assert_fit(p);report['cases']+=1
    if errors:report['failures'].append({'theme':theme,'width':w,'state':state,'errors':errors})
   p.locator('#lbClose').click();p.evaluate('()=>{window.__lbProfile=null;window.__lbHasScore=false;}')
  p.close()
 for width in [390,700,1024,1640]:
  print('LB FLOW',width,flush=True)
  p=b.new_page(viewport={'width':width,'height':900},reduced_motion='reduce');p.on('pageerror',lambda e:report['errors'].append(str(e)));p.evaluate(MOCK);mount(p,ROOT,'terminal')
  before=engine(p,'return JSON.stringify(g.getState());');openboard(p)
  assert p.evaluate("window.__lbCalls.every(c=>c.method==='GET')")
  assert 'first place' in p.locator('#lbRows').inner_text().lower()
  p.locator('#lbPlayer .desk-button').first.click();p.locator('#lbNickname').fill('My Trading Name');p.locator('#lbProfileForm button[type=submit]').click();p.wait_for_timeout(120)
  assert p.evaluate("window.__lbCalls.filter(c=>c.body?.operation==='submit').length")==0
  assert engine(p,'return JSON.stringify(g.getState());')==before
  p.locator('#lbClose').click();engine(p,"g.resetState({seed:'LB-SUBMIT',companyName:'My House'});while(g.getState().day<30)g.advanceDay();g.finishCampaign();")
  original=engine(p,'return JSON.stringify(g.getState());');p.locator('#nextDayBtn').click();p.wait_for_selector('#leaderboardResultsButton');p.locator('#leaderboardResultsButton').click();p.wait_for_timeout(100)
  p.locator('#lbPost').click();assert 'consent' in p.locator('#lbStatus').inner_text();assert p.evaluate("window.__lbCalls.filter(c=>c.body?.operation==='submit').length")==0
  p.locator('#lbConsent').check();p.evaluate('window.__lbReject=true');p.locator('#lbPost').click();p.wait_for_timeout(90);assert 'does not match' in p.locator('#lbStatus').inner_text();assert engine(p,'return JSON.stringify(g.getState());')==original
  p.evaluate('window.__lbReject=false');p.locator('#lbPost').click();p.wait_for_timeout(100);assert 'ranked #2' in p.locator('#lbStatus').inner_text();assert p.locator('.lb-row.is-you').count()==1
  assert engine(p,'return JSON.stringify(g.getState());')==original
  p.get_by_role('button',name='Remove my scores',exact=True).click();p.get_by_role('button',name='Remove my scores',exact=True).click();p.wait_for_timeout(100);assert 'removed' in p.locator('#lbStatus').inner_text()
  assert engine(p,'return JSON.stringify(g.getState());')==original
  p.evaluate('window.__lbOffline=true');p.locator('#lbRefresh').click();p.wait_for_timeout(100);assert 'offline' in p.locator('#lbStatus').inner_text().lower();p.locator('#lbClose').click()
  # Authentication restoration/refresh tested against mocked auth response.
  p.evaluate("()=>{window.__lbOffline=false;const k='trade-wars-leaderboard-session-v1',s=JSON.parse(localStorage.getItem(k));s.expires_at=0;localStorage.setItem(k,JSON.stringify(s));}");openboard(p);assert p.evaluate('window.__lbRefreshCalls')==1
  # Focus remains inside the native modal while tabbing.
  for _ in range(15):
   p.keyboard.press('Tab');assert p.evaluate("document.getElementById('leaderboardDialog').contains(document.activeElement)")
  if width in [390,1640]:p.screenshot(path=f'/mnt/data/trade-wars-leaderboard-{width}.png')
  report['flows'].append({'width':width,'passed':['no startup networking','read without signup','explicit guest profile','no automatic posting','required consent','replay rejection','accepted result/rank','campaign nonmutation','delete own entries confirmation','offline fallback','session refresh','modal focus']})
  p.close()
 b.close()
Path('/mnt/data/leaderboard-browser-report.json').write_text(json.dumps(report,indent=2));print('FAILURES',len(report['failures']),'ERRORS',report['errors']);assert not report['failures'] and not report['errors']
