import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createCipheriv,randomBytes,randomUUID} from 'node:crypto';
import {createSupabaseApp} from '../src/supabase-app.js';

test('authenticated room endpoints forward exact CPU consent, reject malformed/foreign identity inputs and retain origin checks',async()=>{
 const sessionKey=randomBytes(32),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',sessionKey,iv);
 const content=Buffer.concat([cipher.update(JSON.stringify({access_token:'test-access',refresh_token:'test-refresh',expires_at:Math.floor(Date.now()/1000)+3600,validUntil:Date.now()+86400000})),cipher.final()]);
 const cookie='ta_session='+Buffer.concat([iv,cipher.getAuthTag(),content]).toString('base64url');
 const realFetch=global.fetch,calls:{gateway:string;op:string;data:Record<string,unknown>}[]=[];
 global.fetch=async(input,options)=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
  assert.equal(url.hostname,'gjcpcbrkdjymrwktshfr.supabase.co','This test must not use a real external service');
  if(url.pathname==='/auth/v1/user')return Response.json({id:randomUUID(),role:'authenticated',aud:'authenticated'});
  const body=JSON.parse(String(options?.body));calls.push({gateway:url.pathname,op:body.p_op,data:body.p_data});
  if(body.p_op==='me')return Response.json({profile:{id:'1',alias:'QA'}});
  return Response.json({id:'7',status:'ESPERANDO',code:'ABCD-EFGH'});
 };
 const server=createSupabaseApp({url:'https://gjcpcbrkdjymrwktshfr.supabase.co',key:'sb_publishable_test',sessionKey:sessionKey.toString('hex'),origin:'http://127.0.0.1:5173',secure:false}).listen(0,'127.0.0.1');await once(server,'listening');
 const address=server.address();assert.ok(address&&typeof address==='object');
 const send=(path:string,body:unknown,origin='http://127.0.0.1:5173',authenticated=true)=>realFetch(`http://127.0.0.1:${address.port}/api${path}`,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,...(authenticated?{Cookie:cookie}:{})},body:JSON.stringify(body)});
 try{
  for(const path of ['/rooms','/rooms/join']){
   const data={deckId:'10',requestId:randomUUID(),replaceCpuGameId:'99',...(path.endsWith('join')?{code:'ABCD-EFGH'}:{})};const response=await send(path,data);assert.equal(response.status,200);const last=calls.at(-1)!;assert.equal(last.gateway,'/rest/v1/rpc/ta_rooms');assert.equal(last.data.replaceCpuGameId,'99');assert.equal(last.data.deckId,'10');assert.ok(!('actorId'in last.data));
   const n=calls.filter(c=>c.op==='create'||c.op==='join').length;assert.equal((await send(path,{...data,replaceCpuGameId:true})).status,400);assert.equal((await send(path,{...data,actorId:'2'})).status,403);assert.equal((await send(path,data,'https://attacker.invalid')).status,403);assert.equal((await send(path,data,undefined,false)).status,401);assert.equal(calls.filter(c=>c.op==='create'||c.op==='join').length,n);
  }
 }finally{global.fetch=realFetch;await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
