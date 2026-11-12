import assert from 'node:assert/strict';
import {createCipheriv,createDecipheriv,randomBytes,randomUUID} from 'node:crypto';
const base='http://127.0.0.1:4200/api',origin=process.env.APP_ORIGIN;
const response=await fetch(base+'/profile',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({alias:'qa-security-'+randomUUID().slice(0,12)})});
assert.equal(response.status,200);const profile=await response.json();const set=response.headers.getSetCookie()[0];assert.match(set,/HttpOnly/i);let cookie=set.split(';')[0];
const key=Buffer.from(process.env.SESSION_ENCRYPTION_KEY,'hex');const bytes=Buffer.from(cookie.split('=')[1],'base64url');const dec=createDecipheriv('aes-256-gcm',key,bytes.subarray(0,12));dec.setAuthTag(bytes.subarray(12,28));const session=JSON.parse(Buffer.concat([dec.update(bytes.subarray(28)),dec.final()]).toString());
session.expires_at=1;const iv=randomBytes(12);const enc=createCipheriv('aes-256-gcm',key,iv);const body=Buffer.concat([enc.update(JSON.stringify(session)),enc.final()]);const expired='ta_session='+Buffer.concat([iv,enc.getAuthTag(),body]).toString('base64url');
const refreshes=await Promise.all(Array.from({length:4},()=>fetch(base+'/me',{headers:{Cookie:expired}})));
for(const r of refreshes){assert.equal(r.status,200);assert.equal((await r.json()).profile.id,profile.profile.id);assert.ok(r.headers.getSetCookie().length);}
cookie=refreshes[0].headers.getSetCookie()[0].split(';')[0];
assert.equal((await fetch(base+'/decks')).status,401);
assert.equal((await fetch(base+'/profile/rotate',{method:'POST',headers:{Cookie:cookie,Origin:'https://attacker.invalid','Content-Type':'application/json'},body:'{}'})).status,403);
assert.equal((await(await fetch(base+'/me',{headers:{Cookie:'ta_session=tampered'}})).json()).authenticated,false);
const raw=await fetch(process.env.SUPABASE_URL+'/rest/v1/rpc/ta_web',{method:'POST',headers:{apikey:process.env.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({p_op:'me'})});assert.equal(raw.status,401);
const publicKey=process.env.SUPABASE_PUBLISHABLE_KEY;
const impersonation=await fetch(process.env.SUPABASE_URL+'/rest/v1/rpc/ta_web',{method:'POST',headers:{apikey:publicKey,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify({p_op:'state',p_data:{id:'3',actorId:'7',ownerId:'7',auth_user_id:randomUUID()}})});
assert.equal(impersonation.status,400);assert.match((await impersonation.json()).message,/AJENA/);
const hidden=await fetch(process.env.SUPABASE_URL+'/rest/v1/jugador?select=*',{headers:{apikey:publicKey,Authorization:'Bearer '+session.access_token,'Accept-Profile':'truco_arena_der'}});assert.ok(!hidden.ok);
for(let i=0;i<6;i++){
 // Another Auth identity is needed for invalid recovery; use a separate encrypted session from an invalid first request.
 if(i===0){const r=await fetch(base+'/profile/recover',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({code:'0'.repeat(64)})});assert.equal(r.status,400);cookie=r.headers.getSetCookie()[0].split(';')[0];}
 else{const r=await fetch(base+'/profile/recover',{method:'POST',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({code:'0'.repeat(64)})});assert.equal(r.status,i===5?429:400);}
}
console.log('PASS HTTP security: real concurrent refresh, session restoration, forged cookie, CSRF, anonymous RPC denied, forged IDs rejected, schema private, recovery throttle');
