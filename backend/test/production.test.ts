import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {runtimeConfiguration} from '../src/runtime-config.js';
import {supabaseWebConfiguration,createSupabaseApp} from '../src/supabase-app.js';
import {proxyClientIp} from '../src/proxy-boundary.js';
const secret='b'.repeat(64),project='https://gjcpcbrkdjymrwktshfr.supabase.co';

test('production binds assigned port publicly and refuses memory/disabled CPU; local defaults stay local',()=>{
 assert.deepEqual(runtimeConfiguration({}),{production:false,port:4000,host:'127.0.0.1'});
 assert.deepEqual(runtimeConfiguration({NODE_ENV:'production',ARENA_STORAGE:'supabase',CPU_DB_PASSWORD:'test',PORT:'8080'}),{production:true,port:8080,host:'0.0.0.0'});
 for(const env of [{NODE_ENV:'production'},{NODE_ENV:'production',ARENA_STORAGE:'memory',CPU_DB_PASSWORD:'x'},{PORT:'0'},{PORT:'65536'},{BIND_HOST:'attacker.invalid'}])assert.throws(()=>runtimeConfiguration(env));
});
test('production requires canonical HTTPS origin, stable session encryption and dedicated proxy key',()=>{
 const valid={NODE_ENV:'production',SUPABASE_URL:project,SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',SESSION_ENCRYPTION_KEY:'a'.repeat(64),APP_ORIGIN:'https://truco.example.test',API_PROXY_SECRET:secret};
 assert.equal(supabaseWebConfiguration(valid).secure,true);assert.equal(supabaseWebConfiguration(valid).requireCpu,true);
 for(const override of [{API_PROXY_SECRET:''},{API_PROXY_SECRET:'short'},{APP_ORIGIN:'http://localhost:5173'},{APP_ORIGIN:'https://truco.example.test/path'},{APP_ORIGIN:'https://user@truco.example.test'},{SESSION_ENCRYPTION_KEY:'short'}])assert.throws(()=>supabaseWebConfiguration({...valid,...override}));
});
test('explicit Preview/Production origins are canonical, limited and fail closed',async()=>{
 const preview='https://truco-online-o8iyhhp4o-ima-7bec.vercel.app',production='https://truco-online-beta.vercel.app';
 const env={NODE_ENV:'production',SUPABASE_URL:project,SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',SESSION_ENCRYPTION_KEY:'a'.repeat(64),APP_ORIGIN:preview,APP_ORIGINS:JSON.stringify([preview,production]),API_PROXY_SECRET:secret};
 const config=supabaseWebConfiguration(env);assert.deepEqual(config.allowedOrigins,[preview,production]);
 for(const value of ['*','[]','["https://*.vercel.app"]',JSON.stringify([production]),JSON.stringify([preview,preview]),JSON.stringify([preview,'http://localhost:5173']),JSON.stringify([preview,production+'/path']),JSON.stringify([preview,'https://user@host.invalid'])])assert.throws(()=>supabaseWebConfiguration({...env,APP_ORIGINS:value}));
 const server=createSupabaseApp(config).listen(0,'127.0.0.1');await once(server,'listening');const address=server.address();assert.ok(address&&typeof address!=='string');
 try{for(const origin of [preview,production,'https://another.vercel.app',production+'.attacker.invalid','null',production+'/',production+':444']){
  const r=await fetch(`http://127.0.0.1:${address.port}/api/profile`,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,'x-arena-proxy-key':secret,'x-vercel-forwarded-for':'203.0.113.12'},body:JSON.stringify({alias:''})});assert.equal(r.status,[preview,production].includes(origin)?400:403,origin);
 }}finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
});

test('proxy IPs require authenticated ingress; arbitrary forwarded chains never authorize a browser',()=>{
 assert.equal(proxyClientIp(undefined,undefined,'1.2.3.4','127.0.0.1'),'127.0.0.1');
 for(const key of [undefined,'x',secret.toUpperCase()])assert.equal(proxyClientIp(secret,key,'203.0.113.1','127.0.0.1'),undefined);
 assert.equal(proxyClientIp(secret,secret,'203.0.113.1','127.0.0.1'),'203.0.113.1');assert.equal(proxyClientIp(secret,secret,'2001:db8::1','127.0.0.1'),'2001:db8::1');
 for(const ip of [undefined,'unknown','203.0.113.1, 10.0.0.1'])assert.equal(proxyClientIp(secret,secret,ip,'127.0.0.1'),undefined);
});
test('production HTTP blocks direct ingress/CSRF, separates rate buckets and never caches errors or secrets',async()=>{
 const app=createSupabaseApp({url:project,key:'sb_publishable_test',sessionKey:'a'.repeat(64),origin:'https://truco.example.test',secure:true,proxySecret:secret});const server=app.listen(0,'127.0.0.1');await once(server,'listening');const address=server.address();assert.ok(address&&typeof address!=='string');const base=`http://127.0.0.1:${address.port}`;
 const headers={'Content-Type':'application/json',Origin:'https://truco.example.test','x-arena-proxy-key':secret,'x-vercel-forwarded-for':'203.0.113.1'};
 try{
  let r=await fetch(base+'/api/me');assert.equal(r.status,403);assert.match(r.headers.get('Cache-Control')! ,/no-store/);assert.equal(r.headers.get('Vercel-CDN-Cache-Control'),'no-store');assert.ok(!(await r.text()).includes(secret));
  r=await fetch(base+'/api/profile',{method:'POST',headers:{...headers,Origin:'https://attacker.invalid'},body:'{}'});assert.equal(r.status,403);
  for(let i=0;i<30;i++){r=await fetch(base+'/api/profile',{method:'POST',headers,body:'{"alias":""}'});assert.equal(r.status,400);}
  r=await fetch(base+'/api/profile',{method:'POST',headers,body:'{"alias":""}'});assert.equal(r.status,429);
  r=await fetch(base+'/api/profile',{method:'POST',headers:{...headers,'x-vercel-forwarded-for':'203.0.113.2'},body:'{"alias":""}'});assert.equal(r.status,400);
  r=await fetch(base+'/api/profile',{method:'POST',headers:{...headers,'x-vercel-forwarded-for':'203.0.113.2'},body:'{'});assert.equal(r.status,400);assert.equal((await r.json()).error.code,'JSON_INVALIDO');
  r=await fetch(base+'/api/profile',{method:'POST',headers:{...headers,'x-vercel-forwarded-for':'203.0.113.2'},body:JSON.stringify({alias:'x'.repeat(20000)})});assert.equal(r.status,413);
 }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
