"""Real Chromium offline interaction + layout checks. Not physical Safari tests."""
from pathlib import Path
import json,sys,time,argparse,os,shutil
from playwright.sync_api import sync_playwright
from offline_browser import mount
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--quick',action='store_true');parser.add_argument('--report',default='v06-browser-report.json');args=parser.parse_args()
THEMES=['command','situation','terminal','intel','freight','newspaper','news','travel','control','briefcase','exchange','surveillance','arcade']
WIDTHS=[320,360,390,559,560,620,621,700,768,820,821,900,1024,1180,1181,1280,1440,1640,1920]
SCAN=r'''() => {
 const problems=[],limit=document.documentElement.clientWidth,eps=2;
 if(document.documentElement.scrollWidth>limit+eps)problems.push('document overflows '+document.documentElement.scrollWidth+' > '+limit);
 document.querySelectorAll('[data-view-panel].is-active .desk-panel, [data-view-panel].is-active .market-table-wrap, [data-view-panel].is-active .market-row').forEach(el=>{
  if(el.getBoundingClientRect().width&&el.scrollWidth>el.clientWidth+eps)problems.push('internal overflow '+el.id+' '+el.className);
 });
 document.querySelectorAll('[data-view-panel].is-active .market-row').forEach((row,i)=>{
  const r=row.getBoundingClientRect();if(!r.width)return;
  const sl=row.querySelector('.qty-slider').getBoundingClientRect(),a=row.querySelector('.buy').getBoundingClientRect(),b=row.querySelector('.sell').getBoundingClientRect();
  if(a.bottom>b.top+eps||Math.abs(a.left-b.left)>eps)problems.push('buttons not stacked '+i);
  if(sl.right>a.left+eps)problems.push('slider not beside buttons '+i);
  for(const el of row.querySelectorAll('.buy,.sell,.qty-slider,.qty-bubble,.qty-exact,.qty-buy-max,.qty-sell-all,.why-btn,.position-cell,.asset-name,.trade-preview')){
   const q=el.getBoundingClientRect();if(q.left<r.left-eps||q.right>r.right+eps||q.left<-eps||q.right>limit+eps||q.top<r.top-eps||q.bottom>r.bottom+eps)problems.push('clips '+i+' '+el.className);
  }
 });return problems;
}'''
report={'fixture':'Chromium DOM/CSS/native ES modules; URLs replaced with blobs; emulated localStorage', 'themes':(['terminal','newspaper'] if args.quick else THEMES),'widths':([320,390,700,1024,1640] if args.quick else WIDTHS),'layout_cases':0,'failures':[],'runtime_errors':[],'functional':[]}
def engine(page,code):return page.evaluate("async()=>{const g=await import(window.__twModules['v06-engine.js']);"+code+"}")
def dismiss(page):
 page.evaluate("()=>{const d=document.getElementById('dayTransition');d?.classList.remove('show');d?.setAttribute('aria-hidden','true');}")
def view(page,name):
 page.evaluate("name=>document.querySelector('[data-view=\"'+name+'\"]').click()",name);page.wait_for_timeout(40)
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE') or shutil.which('chromium') or pw.chromium.executable_path,headless=True,args=['--no-sandbox']);report['browser']=b.version
 for theme in (['terminal','newspaper'] if args.quick else THEMES):
  print('LAYOUT',theme,flush=True);p=b.new_page(viewport={'width':390,'height':950},reduced_motion='reduce');p.on('pageerror',lambda e:report['runtime_errors'].append(str(e)));mount(p,ROOT,theme)
  engine(p,"g.trade('copper',1,10);g.trade('inverters',1,6);g.advanceDay();g.advanceDay();")
  p.locator('#nextDayBtn').click();dismiss(p)
  for width in ([320,390,700,1024,1640] if args.quick else WIDTHS):
   p.set_viewport_size({'width':width,'height':950})
   for name in ['markets','dashboard','intel','portfolio']:
    view(p,name)
    if name=='markets':
     p.locator('.sector-section').evaluate('e=>e.open=true');p.locator('#contractsPanel').evaluate('e=>e.open=true')
    if name=='dashboard':p.locator('#routePlanner').evaluate('e=>e.open=true')
    p.wait_for_timeout(35)
    problems=p.evaluate(SCAN)
    if problems:report['failures'].append({'theme':theme,'width':width,'view':name,'problems':problems})
    report['layout_cases']+=1
   view(p,'markets')
   for step in ['min','max','middle']:
    p.evaluate("where=>document.querySelectorAll('.qty-slider').forEach(s=>{s.value=where==='min'?s.min:where==='max'?s.max:Math.floor(Number(s.max)/2);s.dispatchEvent(new Event('input',{bubbles:true}));})",step)
    problems=p.evaluate(SCAN)
    if problems:report['failures'].append({'theme':theme,'width':width,'step':step,'problems':problems})
   # History dialog must fit too; native dialog focus trap/close.
   p.locator('.asset-history').first.evaluate('b=>b.click()');p.wait_for_selector('dialog[open]');
   q=p.locator('#deskDialog').evaluate('(d)=>({width:d.clientWidth,scroll:d.scrollWidth})');
   if q['scroll']>q['width']+2:report['failures'].append({'theme':theme,'width':width,'dialog':q})
   p.locator('#deskDialogClose').evaluate('b=>b.click()')
  p.close();Path(args.report).write_text(json.dumps(report,indent=2))
 for width in [390,700,1024,1640]:
  print('FLOW',width,flush=True);p=b.new_page(viewport={'width':width,'height':950});p.on('pageerror',lambda e:report['runtime_errors'].append(str(e)));mount(p,ROOT,'terminal')
  first=p.locator('.market-row').first
  first.locator('.qty-exact').fill('137');assert first.locator('.qty-bubble').inner_text()=='137 lots'
  before=engine(p,"return g.getState().cash;");first.locator('.buy').click();st=engine(p,'return g.getState();');assert st['holdings']['oil']==137
  assert 'BUY' in p.locator('#tradeReceipt').inner_text();assert st['cash']<before
  first=p.locator('.market-row').first;first.locator('.qty-sell-all').click();assert engine(p,'return g.getState().holdings.oil;')==137 # sizing only
  first.locator('.sell').click();assert engine(p,'return g.getState().holdings.oil;')==0
  first=p.locator('.market-row').first;first.locator('.qty-buy-max').click();assert engine(p,'return g.getState().holdings.oil;')==0
  first.locator('.buy').click();assert engine(p,'return g.getState().cash;')<100
  first=p.locator('.market-row').first;first.locator('.qty-sell-all').click();first.locator('.sell').click()
  p.locator('.filter-owned').click();assert p.locator('#marketTable .market-row').count()==0;p.locator('.filter-all').click()
  p.locator('.sector-section').evaluate('e=>e.open=true');row=p.locator('[data-asset=inverters]');row.locator('.qty-exact').fill('7');row.locator('.buy').click();p.locator('.filter-owned').click();assert p.locator('#marketTable .market-row').count()==1
  p.locator('.asset-history').first.click();assert p.locator('.chart-average').count()==1;p.locator('#deskDialogClose').click()
  p.locator('.filter-all').click()
  # Contract review, accept bond, source goods, travel, deliver.
  engine(p,"g.resetState({seed:'TEST'});")
  # re-render without consuming a day via filter
  p.locator('.filter-all').click();p.locator('#contractsPanel').evaluate('e=>e.open=true')
  p.locator('[data-contract-action=accept]').first.click();assert p.locator('#deskDialogBody').inner_text().find('forfeited')>=0
  p.get_by_role('button',name='Accept & post bond',exact=True).click();st=engine(p,'return g.getState();');c=st['contracts'][0];assert c['status']=='accepted' and st['escrow']==c['bond']
  # Source through actual UI, not engine mutation.
  p.locator('.sector-section').evaluate('e=>e.open=true')
  for asset,qty in c['requirements'].items():
   r=p.locator('[data-asset='+asset+']');r.locator('.qty-exact').fill(str(qty));r.locator('.buy').click()
  if engine(p,'return g.getState().currentHub;')!=c['hub']:
   if width<=820:
    p.locator('.mobile-hub-change').click();p.locator('.hub-sheet-option').filter(has_text=next(h for h in ['New York','Houston','Rotterdam','Singapore','Shanghai','Dubai','São Paulo'] if h.lower().replace(' ','')==c['hub'])).click()
   else:p.locator('#hubGrid .hub-card').filter(has_text=c['hub']).first.locator('button').click()
   dismiss(p)
  p.locator('#contractsPanel').evaluate('e=>e.open=true');p.locator('[data-contract-action=deliver]').first.click();p.get_by_role('button',name='Deliver',exact=True).click();assert engine(p,"return g.getState().contracts[0].status;")=='fulfilled'
  view(p,'portfolio');assert p.locator('#portfolioJournal').inner_text().find('DELIVERY')>=0
  # Last day and closing confirmation; holds all inventory valued, no forced realized sale.
  engine(p,'while(g.getState().day<29)g.advanceDay();');view(p,'markets');p.locator('.filter-all').click();p.locator('#nextDayBtn').click();dismiss(p);assert engine(p,'return g.getState().day;')==30
  assert 'Close Campaign' in p.locator('#nextDayBtn').inner_text();assert not engine(p,'return g.getState().finished;')
  p.locator('#nextDayBtn').click();p.get_by_role('button',name='Close & see results',exact=True).click();assert engine(p,'return g.getState().finished;');assert p.locator('#deskDialogTitle').text_content()=='Campaign complete'
  # Replay with confirmation
  p.get_by_role('button',name='Replay this seed',exact=True).click();p.get_by_role('button',name='Replay',exact=True).click();assert engine(p,'return g.getState().day;')==1
  # Saved data restoration
  saved=p.evaluate("()=>localStorage.getItem('trade-wars-campaign-v6')");q=b.new_page(viewport={'width':width,'height':950});mount(q,ROOT,'terminal',{'trade-wars-campaign-v6':saved});assert engine(q,'return g.getState();')==json.loads(saved);q.close()
  # Keyboard navigation and no shortcut activation while typing.
  p.keyboard.press('j');assert p.locator('#deskDialogTitle').text_content()=='Trade journal';p.locator('#deskDialogClose').click();p.locator('.qty-exact').first.focus();day=engine(p,'return g.getState().day;');p.keyboard.press('n');assert engine(p,'return g.getState().day;')==day
  report['functional'].append({'width':width,'passed':['exact quantity 137','trade receipts','Buy Max and Sell All sizing only','holdings filter incl solar','history avg line','contract review/accept/source/deliver','journal','Day 30 stays open','explicit close and results','replay','save restoration','terminal shortcuts safe in inputs']});p.close()
 b.close()
Path(args.report).write_text(json.dumps(report,indent=2));print('FAILURES',len(report['failures']),'ERRORS',report['runtime_errors']);print(json.dumps(report['failures'][:12],indent=2))
if report['failures'] or report['runtime_errors']:sys.exit(1)
