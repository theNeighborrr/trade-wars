"""Trading Houses browser checks. Real Chromium; offline resources/emulated storage.
Native web-share and clipboard are not proven by this fixture; manual fallback is.
"""
from pathlib import Path
import json,sys,os,shutil,argparse
from playwright.sync_api import sync_playwright
from offline_browser import mount
ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--quick',action='store_true');p.add_argument('--report',default='v06-house-report.json');p.add_argument('--screenshots',default='v06-previews');args=p.parse_args()
THEMES=['command','situation','terminal','intel','freight','newspaper','news','travel','control','briefcase','exchange','surveillance','arcade']
WIDTHS=[320,390,700,1024,1640]
report={'fixture':'Chromium, blob resources, emulated storage; not physical Safari/native web-share','layout_cases':0,'failures':[],'runtime_errors':[],'flows':[]}
def engine(page,code):return page.evaluate("async()=>{const g=await import(window.__twModules['v06-engine.js']);"+code+'}')
def house(page,code):return page.evaluate("async()=>{const h=await import(window.__twModules['v06-houses.js']);"+code+'}')
def view(page,name):page.evaluate("n=>document.querySelector('[data-view='+n+']').click()",name);page.wait_for_timeout(30)
def dismiss(page):
 if page.locator('#dayTransition.show').count():page.locator('#dismissTurn').click()
def scan(page):
 return page.evaluate("""()=>{const d=document.querySelector('dialog[open]'),out=[],v=document.documentElement.clientWidth;if(d){if(d.scrollWidth>d.clientWidth+2)out.push('dialog internal overflow');const b=d.getBoundingClientRect();if(b.left<0||b.right>v+1)out.push('dialog out of viewport');for(const e of d.querySelectorAll('input,textarea,button,.upgrade-card,.specialty-option,.share-preview,.customer-card')){const r=e.getBoundingClientRect();if(r.width&&(r.left<b.left-1||r.right>b.right+1))out.push('clipped '+e.className);}}if(document.documentElement.scrollWidth>v+2)out.push('document overflow');return out;}""")
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE') or shutil.which('chromium') or pw.chromium.executable_path,headless=True,args=['--no-sandbox']);report['browser']=b.version
 for theme in (['terminal','newspaper'] if args.quick else THEMES):
  print('HOUSE LAYOUT',theme,flush=True);page=b.new_page(viewport={'width':390,'height':950},reduced_motion='reduce');page.on('pageerror',lambda e:report['runtime_errors'].append(str(e)));mount(page,ROOT,theme)
  for width in ([320,1024] if args.quick else WIDTHS):
   page.set_viewport_size({'width':width,'height':950})
   for name,code in [('house','h.openTradingHouse();'),('setup','h.openCompanySetup();'),('daily',"h.openDaily('2026-09-20');"),('share','h.openShare();')]:
    house(page,code);page.wait_for_timeout(25);problems=scan(page);report['layout_cases']+=1
    if problems:report['failures'].append({'theme':theme,'width':width,'dialog':name,'problems':problems})
    # Native dialog keeps keyboard focus inside the modal.
    page.keyboard.press('Tab');assert page.evaluate("()=>document.activeElement.closest('dialog')!==null")
    page.locator('#deskDialogClose').click()
  page.close()
 for width in [390,700,1024,1640]:
  print('HOUSE FLOW',width,flush=True);page=b.new_page(viewport={'width':width,'height':950},reduced_motion='reduce');page.on('pageerror',lambda e:report['runtime_errors'].append(str(e)));mount(page,ROOT,'terminal')
  page.locator('#resetBtn').click();page.locator('#companyNameInput').fill('Sklar Global');page.locator('[name=specialty][value=grid]').check();page.locator('#seedInput').fill('TEST');page.get_by_role('button',name='Start campaign',exact=True).click();assert engine(page,'return g.getState().cash;')==48500;assert engine(page,'return g.getState().currentHub;')=='houston'
  view(page,'markets');page.get_by_role('button',name='Trading house',exact=True).click();page.locator('[data-upgrade=carrier]').click();assert 'non-refundable' in page.locator('#deskDialogBody').text_content();page.get_by_role('button',name='Purchase upgrade',exact=True).click();assert engine(page,'return g.getState().cash;')==47000;assert page.locator('[data-upgrade=carrier]').is_disabled();page.locator('#deskDialogClose').click()
  # Real customer contract, source goods via normal board controls, travel and deliver.
  page.locator('#contractsPanel').evaluate('e=>e.open=true');page.locator('[data-contract-action=accept]').first.click();page.get_by_role('button',name='Accept & post bond',exact=True).click();c=engine(page,'return g.getState().contracts[0];')
  page.locator('.sector-section').evaluate('e=>e.open=true')
  for asset,qty in c['requirements'].items():
   row=page.locator('.market-row[data-asset='+asset+']');row.locator('.qty-exact').fill(str(qty));row.locator('.buy').click()
  if engine(page,'return g.getState().currentHub;')!=c['hub']:
   dest=engine(page,'return g.getHub('+json.dumps(c['hub'])+').name;')
   if width<=820:
    page.locator('.mobile-hub-change').click();page.locator('.hub-sheet-option').filter(has_text=dest).click()
   else:page.locator('#hubGrid .hub-card').filter(has_text=dest).locator('button').click()
   dismiss(page)
  assert 'Ready to deliver' in page.locator('#marketDecisions').text_content();page.locator('#marketDecisions').evaluate('e=>e.open=true');page.locator('#marketDecisions [data-decision]').first.click()
  page.locator('[data-contract-action=deliver]').first.click();page.get_by_role('button',name='Deliver',exact=True).click();assert engine(page,'return g.relationship('+json.dumps(c['customerId'])+').trust;')==1
  # Daily setup is explicit. Merely opening it doesn't change the run.
  before=engine(page,'return JSON.stringify(g.getState());');house(page,"h.openDaily('2026-09-20');");assert engine(page,'return JSON.stringify(g.getState());')==before;page.get_by_role('button',name='Start daily challenge',exact=True).click();assert engine(page,'return g.getState().attempt;')==1;assert engine(page,'return g.getState().company.specialty;')=='independent';assert engine(page,'return g.getState().cash;')==50000
  house(page,"h.openDaily('2026-09-20');");page.get_by_role('button',name='Resume challenge',exact=True).click();assert engine(page,'return g.getState().attempt;')==1
  # Invitation mismatch/valid invitation never change the active game by themselves.
  before=engine(page,'return JSON.stringify(g.getState());');house(page,"h.reviewInvitation('?rules=0.5.0&challenge=2026-09-20');");assert 'different rules' in page.locator('#deskDialogBody').text_content();page.locator('#deskDialogClose').click();house(page,"h.reviewInvitation('?rules=0.6.0&seed=OTHER&house=logistics');");assert page.locator('[name=specialty][value=logistics]').is_checked();page.get_by_role('button',name='Cancel',exact=True).click();assert engine(page,'return JSON.stringify(g.getState());')==before
  # Full closure and self-reported share card. Time progression is fixture setup.
  engine(page,'while(g.getState().day<29)g.advanceDay();');view(page,'markets');page.locator('.filter-all').click();page.locator('#nextDayBtn').click();dismiss(page);page.locator('#nextDayBtn').click();page.get_by_role('button',name='Close & see results',exact=True).click();assert 'Upgrade expenses' in page.locator('#deskDialogBody').text_content();page.get_by_role('button',name='Share result',exact=True).click();assert 'FINAL RESULT' in page.locator('#shareText').input_value();assert 'First attempt on this device' in page.locator('#shareText').input_value();assert 'Self-reported' in page.locator('#shareText').input_value();page.get_by_role('button',name='Copy result + link',exact=True).click();assert ('selected' in page.locator('#shareStatus').text_content() or 'Copied' in page.locator('#shareStatus').text_content());page.locator('#deskDialogClose').click()
  page.locator('#nextDayBtn').click();page.get_by_role('button',name='Replay this seed',exact=True).click();page.get_by_role('button',name='Replay',exact=True).click();assert engine(page,'return g.getState().attempt;')==2;assert engine(page,'return g.getState().day;')==1
  # Restore v0.6 across reload without advancing an attempt.
  saves=page.evaluate("()=>Object.fromEntries(Array.from({length:localStorage.length},(_,i)=>localStorage.key(i)).map(k=>[k,localStorage.getItem(k)]))");q=b.new_page(viewport={'width':width,'height':950});mount(q,ROOT,'terminal',saves);assert engine(q,'return g.getState().attempt;')==2;assert engine(q,'return g.getState().seed;')=='DAILY-2026-09-20';q.close()
  # User-entered names are displayed as text, never parsed as markup.
  page.locator('#resetBtn').click();page.locator('#companyNameInput').fill('<img src=x onerror=alert(1)>');page.get_by_role('button',name='Start campaign',exact=True).click();assert page.locator('#companyIdentity img').count()==0
  report['flows'].append({'width':width,'passed':['company specialty/start','upgrade confirmation/cost/no duplicate','customer delivery/trust','ready-decision navigation','daily explicit start/resume','invitation mismatch/confirmation','closing/results/share/manual-copy fallback','replay attempt count','storage restoration','name escaping']})
  page.close()
 # Final previews from actual DOM, not synthetic mockups.
 shots=Path(args.screenshots);shots.mkdir(parents=True,exist_ok=True);page=b.new_page(viewport={'width':1440,'height':1000});mount(page,ROOT,'situation');page.locator('#resetBtn').click();page.locator('#companyNameInput').fill('Sklar Global Trading');page.locator('[name=specialty][value=grid]').check();page.locator('#seedInput').fill('SKLAR-GLOBAL');page.screenshot(path=str(shots/'company-setup.png'));page.get_by_role('button',name='Start campaign',exact=True).click();page.screenshot(path=str(shots/'company-dashboard.png'))
 house(page,'h.openTradingHouse();');page.screenshot(path=str(shots/'company-upgrades.png'));page.locator('#deskDialogClose').click();page.set_viewport_size({'width':390,'height':844});house(page,"h.openDaily('2026-09-20');");page.screenshot(path=str(shots/'daily-mobile.png'));page.close();b.close()
Path(args.report).write_text(json.dumps(report,indent=2));print('HOUSE RESULTS',report['layout_cases'],'cases;',len(report['failures']),'failures;',report['runtime_errors']);assert not report['failures'] and not report['runtime_errors']
