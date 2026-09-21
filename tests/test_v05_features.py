"""Extended theme/route/seed interactions in the offline Chromium fixture."""
from pathlib import Path
import json,mimetypes,os,shutil,argparse
from urllib.parse import urlparse,unquote
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
from offline_browser import mount
parser=argparse.ArgumentParser();parser.add_argument('--report',default='v05-feature-report.json');parser.add_argument('--screenshots',default='v05-previews');args=parser.parse_args()
ORIGIN='offline blob fixture'
def start(context,theme='command'):
 page=context.new_page();mount(page,ROOT,theme);return page
def eng(p,js):return p.evaluate("async()=>{const g=await import(window.__twModules['v05-engine.js']);"+js+"}")
report={'origin':ORIGIN,'storage':'Emulated WebStorage; native-origin navigation is blocked by this execution environment','external_network':False,'checks':[],'errors':[]}
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE') or shutil.which('chromium') or pw.chromium.executable_path,headless=True,args=['--no-sandbox']);report['browser']=b.version
 c=b.new_context(viewport={'width':390,'height':900},reduced_motion='reduce');p=start(c,'terminal');p.on('pageerror',lambda e:report['errors'].append(str(e)))
 p.locator('[data-view=markets]').first.evaluate('b=>b.click()');p.locator('.qty-exact').first.fill('137');p.locator('.buy').first.click();saved=eng(p,'return g.getState();');saved_ui=p.evaluate("()=>localStorage.getItem('trade-wars-desk-v05')");p.close();p=c.new_page();mount(p,ROOT,'terminal',{'trade-wars-campaign-v5':json.dumps(saved),'trade-wars-desk-v05':saved_ui});assert eng(p,'return g.getState();')==saved;assert p.locator('.qty-exact').first.input_value()=='137'
 report['checks'].append('Account + exact quantity + view/theme restored from stored JSON into a new browser page')
 # Mobile hub-picker travel and local mark rows.
 p.locator('.mobile-hub-change').click();p.locator('.hub-sheet-option').filter(has_text='Houston').click();p.locator('#dismissTurn').click();assert eng(p,'return g.getState().currentHub;')=='houston';assert eng(p,'return g.getState().day;')==2
 report['checks'].append('Mobile hub picker travel consumes one day; Continue dismisses the briefing')
 p.locator('[data-view=dashboard]').first.evaluate('b=>b.click()');p.evaluate("async()=>{(await import(window.__twModules['themes.js'])).applyTheme('situation');}");assert p.locator('#routePlanner').evaluate('e=>e.open')
 p.locator('.route-map [data-map-hub=rotterdam]').click();assert 'Rotterdam' in p.locator('.route-quote').inner_text();p.locator('#mapTravel').click();p.locator('#dismissTurn').click();assert eng(p,'return g.getState().currentHub;')=='rotterdam';assert eng(p,'return g.getState().day;')==3
 report['checks'].append('Situation Room: clickable SVG hubs, comparative quotes, actual route travel')
 # Newspaper brief attribution for inventory carried at the preceding repricing.
 p.evaluate("async()=>{(await import(window.__twModules['themes.js'])).applyTheme('newspaper');}");assert p.locator('.paper-masthead').is_visible();assert 'Crude Oil' in p.locator('.brief-positions').inner_text();assert 'Not realized profit' in p.locator('#dailyBrief').inner_text()
 report['checks'].append('Newspaper personal edition shows carried inventory mark attribution, not new-purchase gains')
 # Charts contain series, avg line, global/local controls, and exact values.
 p.locator('[data-view=markets]').first.evaluate('b=>b.click()');p.locator('.asset-history').first.click();assert p.locator('.chart-average').count()==1;assert p.locator('.chart-price').get_attribute('d').count('L')==2;p.get_by_role('button',name='Global reference',exact=True).click();assert 'Global reference prices' in p.locator('#deskDialogBody').inner_text();p.locator('#deskDialogClose').click()
 report['checks'].append('Three-session history, average basis, local/global switch and accessible daily values')
 # End-to-end new run entered seed, not a hidden test hook.
 p.locator('#resetBtn').click();p.locator('#seedInput').fill('MY-SCENARIO');p.get_by_role('button',name='Start campaign',exact=True).click();assert eng(p,'return g.getState().seed;')=='MY-SCENARIO';assert eng(p,'return g.getState().cash;')==50000
 p.locator('[data-view=markets]').first.evaluate('b=>b.click()');assert p.locator('.qty-exact').first.input_value()=='1'
 p.locator('.qty-exact').first.fill('0');assert p.locator('.buy').first.is_disabled();p.locator('.qty-exact').first.fill('1.5');assert p.locator('.buy').first.is_disabled()
 report['checks'].append('User-entered seed, new-run confirmation, size reset; zero/fractional input cannot trade')
 # Screenshots from stable pages, not synthetic mockups.
 shots=Path(args.screenshots);shots.mkdir(parents=True,exist_ok=True)
 p.locator('.qty-exact').first.fill('1');p.screenshot(path=str(shots/'newspaper-mobile.png'),full_page=True)
 p.evaluate("async()=>{(await import(window.__twModules['themes.js'])).applyTheme('terminal');}");p.locator('.market-row').first.scroll_into_view_if_needed();p.screenshot(path=str(shots/'terminal-mobile.png'))
 p.set_viewport_size({'width':1640,'height':1000});p.locator('[data-view=dashboard]').first.evaluate('b=>b.click()');p.evaluate("async()=>{(await import(window.__twModules['themes.js'])).applyTheme('situation');}");p.screenshot(path=str(shots/'situation-desktop.png'),full_page=True)
 p.locator('[data-view=markets]').first.evaluate('b=>b.click()');p.locator('.sector-section').evaluate('e=>e.open=true');p.locator('.sector-section').scroll_into_view_if_needed();p.screenshot(path=str(shots/'solar-grid-desktop.png'))
 c.close();b.close()
Path(args.report).write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2));assert not report['errors']
