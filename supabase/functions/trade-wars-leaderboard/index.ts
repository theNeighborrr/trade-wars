// Public read-only board; EVERY account/write operation verifies the user with
// Supabase Auth. No trust in decoded JWT claims, client scores, or user IDs.
import {validateReplay} from './validate.js';
import {boardMeta,ProofError} from './protocol.js';
const URL_BASE=Deno.env.get('SUPABASE_URL')!;
const SERVICE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON=Deno.env.get('SUPABASE_ANON_KEY')!;
const MAX_BYTES=196608;
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Vary':'Origin','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
class HttpError extends Error {constructor(public status:number,message:string){super(message);}}
function json(data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json'}});}
async function rpc(name:string,args:unknown){
 const r=await fetch(URL_BASE+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:SERVICE,Authorization:'Bearer '+SERVICE,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(15000)});
 const data=await r.json();
 if(!r.ok){if(data.code==='23505')throw new HttpError(409,'That nickname is already in use. Choose another.');throw new HttpError(503,'The leaderboard database is unavailable. Your game is safe; retry later.');}
 return data;
}
async function user(req:Request,required:boolean){
 const bearer=req.headers.get('Authorization');
 if(!bearer){if(required)throw new HttpError(401,'Create or restore your guest profile first.');return null;}
 if(!/^Bearer [A-Za-z0-9._-]+$/.test(bearer))throw new HttpError(401,'Invalid player session.');
 const r=await fetch(URL_BASE+'/auth/v1/user',{headers:{apikey:ANON,Authorization:bearer},signal:AbortSignal.timeout(10000)});
 if(r.status!==200)throw new HttpError(r.status>=500?503:401,r.status>=500?'Player sign-in is temporarily unavailable.':'Your guest session expired. Reconnect before posting.');
 const u=await r.json();if(typeof u.id!=='string'||!/^[0-9a-f-]{36}$/.test(u.id))throw new HttpError(401,'Invalid player session.');return u.id;
}
async function boundedJSON(req:Request){
 const size=Number(req.headers.get('Content-Length')||0);if(size>MAX_BYTES)throw new HttpError(413,'Replay is too large.');
 if(!req.headers.get('Content-Type')?.startsWith('application/json'))throw new HttpError(415,'Send JSON.');
 const reader=req.body?.getReader();if(!reader)throw new HttpError(400,'Missing request body.');
 const chunks:Uint8Array[]=[];let length=0;
 while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>MAX_BYTES){await reader.cancel();throw new HttpError(413,'Replay is too large.');}chunks.push(value);}
 const all=new Uint8Array(length);let offset=0;for(const part of chunks){all.set(part,offset);offset+=part.length;}
 try{return JSON.parse(new TextDecoder().decode(all));}catch{throw new HttpError(400,'Invalid JSON.');}
}
Deno.serve(async(req:Request)=>{
 try{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  const today=new Date().toISOString().slice(0,10),url=new URL(req.url);
  if(req.method==='GET'){
    const uid=await user(req,false);
    const meta=boardMeta({rules:url.searchParams.get('rules')||'0.6.0',mode:url.searchParams.get('mode')||'daily',seed:url.searchParams.get('seed')||'DAILY-'+today,specialty:url.searchParams.get('specialty')||'independent',challengeDate:url.searchParams.get('mode')==='free'?null:url.searchParams.get('date')||today},today);
    const [board,profile]=await Promise.all([rpc('tw_board',{p_key:meta.boardKey,p_user:uid}),uid?rpc('tw_profile',{p_user:uid}):null]);
    return json({ok:true,serverDate:today,meta,...board,profile,validation:'replay-validated',replaysAllowed:true});
  }
  if(req.method!=='POST')throw new HttpError(405,'Method not allowed.');
  const uid=await user(req,true);
  if(!await rpc('tw_gate',{p_user:uid}))throw new HttpError(429,'Submission limit reached or this profile is restricted. Wait before trying again.');
  const body=await boundedJSON(req);
  if(body?.operation==='profile'){
    const name=typeof body.nickname==='string'?body.nickname.trim():'';
    if(!/^[A-Za-z0-9][A-Za-z0-9 _.-]{2,23}$/.test(name))throw new HttpError(400,'Use a nickname of 3–24 letters, numbers, spaces, dots, dashes or underscores.');
    return json({ok:true,profile:await rpc('tw_profile',{p_user:uid,p_name:name})});
  }
  if(body?.operation==='delete_scores'){
    if(body.confirm!==true)throw new HttpError(400,'Deletion requires confirmation.');
    return json({ok:true,deleted:await rpc('tw_delete_scores',{p_user:uid})});
  }
  if(body?.operation!=='submit'||body.consent!==true)throw new HttpError(400,'Posting a result requires explicit publication consent.');
  const profile=await rpc('tw_profile',{p_user:uid});if(!profile||profile.blocked)throw new HttpError(403,'Create an available public nickname first.');
  const checked=validateReplay(body.proof,today);
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({meta:checked.meta,actions:body.proof.actions})));
  const hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
  // Explicit QA/preview path runs the same auth, limits and replay, but cannot
  // create or change a ranked score. The shipped client uses normal submission.
  if(body.dryRun===true)return json({ok:true,dryRun:true,scoreCents:checked.scoreCents,meta:checked.meta});
  const stored=await rpc('tw_store_score',{p_user:uid,p:{...checked,hash,proof:body.proof}});
  if(stored.status==='moderated')throw new HttpError(403,'This entry has been removed by the owner and cannot be reposted.');
  const board=await rpc('tw_board',{p_key:checked.meta.boardKey,p_user:uid});
  return json({ok:true,...stored,meta:checked.meta,board,validation:'replay-validated'});
 }catch(error){
   if(error instanceof HttpError)return json({ok:false,error:error.message},error.status);
   if(error instanceof ProofError)return json({ok:false,error:error.message},422);
   // Never log request bodies, Authorization headers, secrets or raw database errors.
   console.error('leaderboard_request_failed',error?.name||'Error');
   return json({ok:false,error:'The leaderboard could not complete that request. Your local campaign has not changed.'},503);
 }
});
