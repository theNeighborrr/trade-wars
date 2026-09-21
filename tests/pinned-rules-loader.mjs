/* Offline test adapter for the deployment's immutable HTTPS rule imports. */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const prefix='https://raw.githubusercontent.com/theNeighborrr/trade-wars/b0baa09cb21ad8c5a12292258078ff06bea5de5e/';
const root=new URL('../',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('supabase/functions/trade-wars-leaderboard/rules-manifest.json',root)));
export async function resolve(specifier,context,next){
 if(specifier.startsWith(prefix)){
   const name=specifier.slice(prefix.length).split('?')[0],hash=manifest.sha256[name];
   if(!hash)throw Error('Unknown pinned source');
   const path=new URL(name,root);if(createHash('sha256').update(readFileSync(path)).digest('hex')!==hash)throw Error('Pinned rules changed: '+name);
   return {url:path.href,shortCircuit:true};
 }
 return next(specifier,context);
}
