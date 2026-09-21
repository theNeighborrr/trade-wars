/* Public configuration only. Privileged database keys never belong here. */
export const ONLINE_URL='https://awhcmkcijcajbwlcrafz.supabase.co';
export const ONLINE_KEY='sb_publishable_CnjIoEnKwoV1lP-F5XasKg_SKshmGrr';
const SESSION_KEY='trade-wars-leaderboard-session-v1';
let memory=null,refreshing=null,warning='';
function read(){try{const data=JSON.parse(localStorage.getItem(SESSION_KEY)||'null');if(data?.access_token&&data?.refresh_token)return data;}catch{}return memory;}
function save(session){
 memory={access_token:session.access_token,refresh_token:session.refresh_token,expires_at:session.expires_at||Math.floor(Date.now()/1000)+(session.expires_in||3600)};
 try{localStorage.setItem(SESSION_KEY,JSON.stringify(memory));}catch{warning='Guest sign-in is only held in this tab because browser storage is unavailable. Closing it may lose this profile.';}
 return memory;
}
export const hasGuest=()=>!!read();
export const guestWarning=()=>warning;
export class OnlineError extends Error{constructor(message,status=0){super(message);this.status=status;}}
async function request(url,options={}){
 let response;
 try{response=await fetch(url,{...options,signal:AbortSignal.timeout(20000)});}catch{throw new OnlineError('The leaderboard is offline or could not be reached. Your campaign is safe; you can keep playing and retry later.');}
 const body=await response.json().catch(()=>({}));
 if(!response.ok)throw new OnlineError(body.error_description||body.msg||body.error||'The leaderboard could not complete that request.',response.status);
 return body;
}
async function auth(path,body){return request(ONLINE_URL+'/auth/v1/'+path,{method:'POST',headers:{apikey:ONLINE_KEY,'Content-Type':'application/json'},body:JSON.stringify(body)});}
export async function createGuest(){
 if(read())return read(); // An expired identity is not silently replaced.
 const result=await auth('signup',{data:{app:'trade-wars'}});
 if(!result.access_token||!result.refresh_token)throw new OnlineError('Anonymous sign-in is not enabled or did not return a session.');
 return save(result);
}
async function token(force=false){
 const current=read();if(!current)return null;
 if(!force&&current.expires_at>Date.now()/1000+60)return current.access_token;
 if(refreshing)return refreshing;
 const refresh=async()=>{
   const latest=read();
   if(latest?.access_token!==current.access_token&&latest?.expires_at>Date.now()/1000+60)return latest.access_token;
   try{return save(await auth('token?grant_type=refresh_token',{refresh_token:latest?.refresh_token||current.refresh_token})).access_token;}
   catch(error){if(error.status===400||error.status===401)throw new OnlineError('This guest session can no longer be restored. Existing public scores are unchanged. Keep this browser data, or contact the game owner for help.',401);throw error;}
 };
 refreshing=(navigator.locks?.request?navigator.locks.request('tw-leaderboard-refresh',refresh):refresh()).finally(()=>{refreshing=null;});
 return refreshing;
}
async function call(method,query='',body,authenticated=true,retry=true){
 const bearer=authenticated?await token():null;
 try{return await request(ONLINE_URL+'/functions/v1/trade-wars-leaderboard'+query,{method,headers:{apikey:ONLINE_KEY,...(bearer?{Authorization:'Bearer '+bearer}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});}
 catch(e){if(e.status===401&&bearer&&retry){await token(true);return call(method,query,body,authenticated,false);}throw e;}
}
export async function readBoard(meta=null,{publicOnly=false}={}){
 const p=new URLSearchParams();
 if(meta){p.set('rules',meta.rules);p.set('mode',meta.mode);p.set('seed',meta.seed);p.set('specialty',meta.specialty);if(meta.challengeDate)p.set('date',meta.challengeDate);}
 return call('GET',p.size?'?'+p:'',undefined,!publicOnly);
}
export async function setNickname(nickname){await createGuest();return call('POST','',{operation:'profile',nickname});}
export const submitScore=proof=>call('POST','',{operation:'submit',consent:true,proof});
export const deleteScores=()=>call('POST','',{operation:'delete_scores',confirm:true});
