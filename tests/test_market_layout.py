from pathlib import Path
import json, sys, time, os, shutil, argparse
from playwright.sync_api import sync_playwright
from offline_browser import mount
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description='Trade Wars browser layout regressions')
parser.add_argument('--themes', default='', help='Comma-separated theme IDs; default: all')
parser.add_argument('--layout-only', action='store_true')
parser.add_argument('--report', default='layout-test-report.json')
args=parser.parse_args()
THEMES=['command','situation','terminal','intel','freight','newspaper','news','travel','control','briefcase','exchange','surveillance','arcade']
WIDTHS=[320,360,375,390,430,559,560,592,620,621,700,768,800,820,821,900,1024,1150,1180,1181,1280,1281,1439,1440,1441,1640,1920]
THEMES=(args.themes or ','.join(THEMES)).split(',')
SCAN=r'''() => {
 const problems=[], limit=document.documentElement.clientWidth, eps=1.5;
 if(document.documentElement.scrollWidth>limit+eps)problems.push('document scrolls sideways');
 const wrap=document.querySelector('.market-table-wrap');
 if(wrap.scrollWidth>wrap.clientWidth+eps)problems.push('board internal overflow');
 const hubs=document.querySelector('#hubGrid');
 if(hubs.clientWidth && hubs.scrollWidth>hubs.clientWidth+eps)problems.push('hub horizontal scroll');
 document.querySelectorAll('#marketTable .market-row').forEach((row,i)=>{
  const r=row.getBoundingClientRect(), trade=row.querySelector('.trade-column'), sl=row.querySelector('.qty-slider'), buy=row.querySelector('.buy'),sell=row.querySelector('.sell');
  if(row.scrollWidth>row.clientWidth+eps)problems.push('row '+i+' internal overflow');
  if(getComputedStyle(trade).display!=='grid')problems.push('trade '+i+' is not grid');
  const a=buy.getBoundingClientRect(),b=sell.getBoundingClientRect(),c=sl.getBoundingClientRect();
  if(a.bottom>b.top+eps || Math.abs(a.left-b.left)>eps)problems.push('buttons '+i+' are not stacked');
  if(c.right>a.left+eps)problems.push('slider '+i+' not beside buttons');
  for(const el of row.querySelectorAll('.buy,.sell,.qty-slider,.qty-bubble,.qty-max,.why-btn,.position-cell,.asset-name')){
   const q=el.getBoundingClientRect();
   if(q.left<r.left-eps || q.right>r.right+eps || q.left<-eps || q.right>limit+eps || q.top<r.top-eps || q.bottom>r.bottom+eps)problems.push('row '+i+' clips '+el.className);
  }
 });
 return problems;
}'''
report={'browser':None,'fixture':'Offline real-browser DOM/CSS/ES modules; URLs rewritten to blobs; in-memory WebStorage', 'widths':WIDTHS,'themes':THEMES,'layout_cases':0,'failures':[],'functional':[],'runtime_errors':[]}
with sync_playwright() as pw:
 executable=os.environ.get('CHROMIUM_EXECUTABLE') or shutil.which('chromium')
 b=pw.chromium.launch(**({'executable_path':executable} if executable else {}), headless=True)
 report['browser']=b.version
 p=b.new_page();mount(p,ROOT)
 seed=p.evaluate('''async () => {
  const e=await import(window.__twModules['v02-engine.js']); const s=e.getState();
  s.day=26;s.cash=8986;s.currentHub='singapore';s.holdings.copper=10;s.avgCosts.copper=123;s.holdings.rare=210;s.avgCosts.rare=128;
  s.prices.copper=114/1.03;s.prices.rare=134/1.01;s.moves.copper=-.039;s.moves.rare=-.036;s.wealthHistory=[50000,38315];
  return {'trade-wars-prototype-v2':JSON.stringify(s)};
 }''');p.close()
 for theme in THEMES:
  print('Theme:',theme,flush=True)
  p=b.new_page(viewport={'width':390,'height':950})
  p.on('pageerror',lambda e:report['runtime_errors'].append(str(e)))
  mount(p,ROOT,theme,seed)
  for w in WIDTHS:
   p.set_viewport_size({'width':w,'height':950});p.wait_for_timeout(35)
   for step in ['min','max','middle']:
    p.evaluate('''where=>document.querySelectorAll('.qty-slider').forEach(s=>{s.value=where==='min'?s.min:where==='max'?s.max:Math.floor(Number(s.max)/2);s.dispatchEvent(new Event('input',{bubbles:true}));})''',step)
    problems=p.evaluate(SCAN)
    if problems:report['failures'].append({'theme':theme,'width':w,'step':step,'problems':problems})
   report['layout_cases']+=1
  p.close()
  Path(args.report).write_text(json.dumps(report,indent=2))
 for width in ([] if args.layout_only else [390,700,1024,1640]):
  print('Flow:',width,flush=True)
  p=b.new_page(viewport={'width':width,'height':950});p.on('pageerror',lambda e:report['runtime_errors'].append(str(e)));mount(p,ROOT,'terminal')
  p.locator('.qty-slider').first.evaluate("s=>{s.value='3';s.dispatchEvent(new Event('input',{bubbles:true}));}") # Steps: 1, 2, 5, 10.
  p.locator('#marketTable .buy').first.click()
  s=p.evaluate("async()=> (await import(window.__twModules['v02-engine.js'])).getState()")
  assert s['holdings']['oil']==10, (width,s)
  expected=50000-s['avgCosts']['oil']*10
  assert abs(s['cash']-expected)<1e-7
  assert '10 lots' in p.locator('.position-cell').first.inner_text()
  assert '0.0%' in p.locator('.position-cell').first.inner_text()
  p.locator('#marketTable .sell').first.click()
  s=p.evaluate("async()=> (await import(window.__twModules['v02-engine.js'])).getState()")
  assert s['holdings']['oil']==0 and abs(s['cash']-50000)<1e-7
  if width<=820:
   p.locator('.mobile-hub-change').click();p.wait_for_selector('#hubSheet.open')
   p.locator('.hub-sheet-option',has_text='Houston').click()
   assert not p.locator('#hubSheet').is_visible()
  else:
   p.locator('#hubGrid .hub-card',has_text='Houston').locator('button').click()
  s=p.evaluate("async()=> (await import(window.__twModules['v02-engine.js'])).getState()")
  assert s['day']==2 and s['currentHub']=='houston' and abs(s['cash']-49350)<1e-7
  p.locator('#nextDayBtn').click();p.wait_for_timeout(1500)
  saved=p.evaluate("()=>localStorage.getItem('trade-wars-prototype-v2')")
  loaded=b.new_page(viewport={'width':width,'height':950});mount(loaded,ROOT,'terminal',{'trade-wars-prototype-v2':saved})
  s=loaded.evaluate("async()=> (await import(window.__twModules['v02-engine.js'])).getState()")
  assert s==json.loads(saved)
  assert s['day']==3 and s['currentHub']=='houston'
  report['functional'].append({'width':width,'checks':['buy 10','sell 10','average cost and return','travel cost/day','advance day','restore saved campaign']})
  loaded.close();p.close()
 # Sticky header/HUD: verify after a real window scroll, not a CSS declaration.
 for w,selector in [(1640,'.market-table-head'),(390,'.mobile-hud')]:
  p=b.new_page(viewport={'width':w,'height':900});mount(p,ROOT)
  p.evaluate("()=>window.scrollTo(0,document.querySelectorAll('.market-row')[2].getBoundingClientRect().top+scrollY)")
  p.wait_for_timeout(150)
  y=p.locator(selector).bounding_box()['y'];assert abs(y)<2,(w,selector,y)
  report['functional'].append({'width':w,'checks':['sticky '+selector]});p.close()
 b.close()
Path(args.report).write_text(json.dumps(report,indent=2))
print(json.dumps({k:v for k,v in report.items() if k not in ['widths','themes','failures']},indent=2))
print('FAILURES:',len(report['failures']));print(json.dumps(report['failures'][:12],indent=2))
if report['failures'] or report['runtime_errors']:sys.exit(1)
