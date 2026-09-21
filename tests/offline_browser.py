"""Offline browser fixture: real DOM, CSS and JS modules; no network required.
Only resource URLs are rewritten to memory blobs. localStorage is emulated for
about:blank's opaque origin; the game reads/writes the normal storage API.
"""
from pathlib import Path
import re

BOOT = r'''async ({resources, initialStorage}) => {
  const store = new Map(Object.entries(initialStorage || {}));
  Object.defineProperty(window, 'localStorage', {configurable:true, value:{
    getItem:key=>store.get(String(key)) ?? null,
    setItem:(key,value)=>store.set(String(key),String(value)),
    removeItem:key=>store.delete(String(key)),clear:()=>store.clear(),
    key:i=>Array.from(store.keys())[i] ?? null,get length(){return store.size;}
  }});
  const blobs = {};
  function url(path){
    path=path.replace(/^\.\//,'').split('?')[0];
    if(blobs[path])return blobs[path];
    if(!(path in resources))throw new Error('Missing offline asset: '+path);
    let source=resources[path];
    if(path.endsWith('.js')){
      source=source.replace(/(['"])(\.\/[\w.-]+\.js(?:\?[^'"]*)?)\1/g,(_,q,p)=>q+url(p)+q);
      source=source.replace(/(['"])([\w.-]+\.css(?:\?[^'"]*)?)\1/g,(_,q,p)=>q+url(p)+q);
    }
    const type=path.endsWith('.css')?'text/css':path.endsWith('.js')?'text/javascript':'image/svg+xml';
    return blobs[path]=URL.createObjectURL(new Blob([source],{type}));
  }
  document.querySelectorAll('link[data-offline-href]').forEach(link=>{
    link.href=url(link.dataset.offlineHref);
  });
  window.__twModules={};
  for(const name of Object.keys(resources).filter(n=>n.endsWith('.js'))){
    window.__twModules[name]=url(name);
  }
  await import(url('app.js'));
}'''

def mount(page, root, theme='terminal', storage=None):
    root=Path(root)
    resources={p.name:p.read_text() for p in root.iterdir() if p.suffix in ('.js','.css','.svg')}
    html=(root/'index.html').read_text()
    html=re.sub(r'<script\b[^>]*src=[^>]*>\s*</script>', '', html)
    def link(m):
        tag=m.group(0)
        if 'rel="stylesheet"' not in tag:return ''
        return tag.replace('href=', 'data-offline-href=')
    html=re.sub(r'<link\b[^>]*>',link,html)
    page.set_content(html)
    init={'trade-wars-interface-theme-v1':theme}
    init.update(storage or {})
    page.evaluate(BOOT,{'resources':resources,'initialStorage':init})
    page.wait_for_selector('#marketTable .buy',state='attached')
    page.wait_for_function('document.body.dataset.theme !== undefined')
    page.wait_for_function('Array.from(document.querySelectorAll("link[rel=stylesheet]")).every(l=>l.sheet)')
    page.evaluate("() => document.querySelector('[data-view=markets]').click()")
    page.wait_for_timeout(80)
