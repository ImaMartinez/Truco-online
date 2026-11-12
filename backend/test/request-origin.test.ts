import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createSupabaseApp} from '../src/supabase-app.js';
import {requestOriginAllowed} from '../src/request-origin.js';

test('local aliases share an allowed port; external origins, malformed values and other ports remain blocked',()=>{
 for(const configured of ['http://127.0.0.1:5173','http://localhost:5173']){
  for(const allowed of ['http://127.0.0.1:5173','http://localhost:5173'])assert.equal(requestOriginAllowed(allowed,configured),true);
  for(const denied of [undefined,'null','https://localhost:5173','http://localhost:5174','http://127.0.0.1:4200','http://localhost.evil.invalid:5173','http://127.0.0.1.evil.invalid:5173','http://evil.invalid:5173','http://user@localhost:5173','http://localhost:5173/path','http://localhost:5173/','http://localhost:5173?x=1'])assert.equal(requestOriginAllowed(denied,configured),false,denied);
 }
});
test('HTTPS deployment keeps exact origin validation, including subdomains and port',()=>{
 const configured='https://truco.example.com';assert.equal(requestOriginAllowed(configured,configured),true);
 for(const origin of [undefined,'null','http://truco.example.com','https://other.truco.example.com','https://truco.example.com:444','http://localhost:5173','http://127.0.0.1:5173'])assert.equal(requestOriginAllowed(origin,configured),false);
 assert.equal(requestOriginAllowed('https://localhost:5173','https://127.0.0.1:5173'),false);
});
test('real Express profile requests accept both local origins before validation without calling Auth; bad origins stay 403',async()=>{
 const server=createSupabaseApp({url:'https://gjcpcbrkdjymrwktshfr.supabase.co',key:'sb_publishable_test',sessionKey:'a'.repeat(64),origin:'http://127.0.0.1:5173',secure:false}).listen(0,'127.0.0.1');
 await once(server,'listening');const address=server.address();assert.ok(address&&typeof address!=='string');
 try{
  for(const [origin,status,code]of [['http://localhost:5173',400,'SOLICITUD_INVALIDA'],['http://127.0.0.1:5173',400,'SOLICITUD_INVALIDA'],['https://attacker.invalid',403,'ORIGEN_INVALIDO'],['http://localhost:5174',403,'ORIGEN_INVALIDO'],['null',403,'ORIGEN_INVALIDO']]as const){
   const r=await fetch(`http://127.0.0.1:${address.port}/api/profile`,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({alias:''})});assert.equal(r.status,status);assert.equal((await r.json()).error.code,code);
  }
 }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
