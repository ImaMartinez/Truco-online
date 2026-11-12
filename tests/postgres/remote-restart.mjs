// Run with the normal backend stopped: this test owns the only CPU worker.
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
let child,cookie='';const origin=process.env.APP_ORIGIN;
async function boot(enabled){child=spawn(process.execPath,['--env-file=backend/.env.supabase','--import','tsx','tests/postgres/remote-cpu-server.mjs'],{windowsHide:true,env:{...process.env,TEST_WORKER_START:enabled?'yes':'no'},stdio:['ignore','pipe','pipe']});await new Promise((r,j)=>{child.stdout.on('data',b=>{if(b.toString().includes('READY'))r();});child.once('error',j);child.once('exit',()=>j(Error('Test process exited')));});}
async function stop(){if(!child)return;const c=child;child=null;c.kill();await new Promise(r=>c.once('exit',r));}
async function api(path,data){const r=await fetch('http://127.0.0.1:4210/api'+path,{method:data?'POST':'GET',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})});const set=r.headers.getSetCookie()[0];if(set)cookie=set.split(';')[0];const b=await r.json();assert.ok(r.ok,JSON.stringify(b));return b;}
try{
 await boot(false);const {profile}=await api('/profile',{alias:'qa-restart-'+randomUUID().slice(0,8)});const {cards}=await api('/catalog');const deck=await api('/decks',{name:'QA restart',entries:cards.slice(0,6).map(c=>({cardId:c.id,quantity:2}))});let s=await api('/duels',{deckId:deck.id,difficulty:'dificil',requestId:randomUUID()});
 // Initial start requests one sweep. Let it finish before positioning a durable CPU turn.
 await delay(2500);s=await api('/duels/'+s.id);if(s.activePlayerId===profile.id)s=await api('/duels/'+s.id+'/actions',{expectedVersion:s.version,requestId:randomUUID(),action:{type:'endTurn'}});
 assert.equal(s.activePlayerId,s.cpu.playerId);await delay(1800);const before=await api('/duels/'+s.id);assert.equal(before.version,s.version,'Another worker is running; stop it before this test');
 await stop();await boot(true);let after;for(let i=0;i<20;i++){await delay(500);after=await api('/duels/'+s.id);if(after.version>before.version)break;}assert.ok(after.version>before.version);assert.equal((await api('/me')).profile.id,profile.id);
 await mkdir('artifacts/postgres',{recursive:true});await writeFile('artifacts/postgres/cpu-restart-results.json',JSON.stringify({date:new Date().toISOString(),project:'gjcpcbrkdjymrwktshfr',game:s.id,beforeVersion:before.version,afterVersion:after.version,onlyWorker:true,nodeProcessRestart:true,passed:true},null,2));console.log('PASS only worker Node process restarted; durable CPU turn advanced and HttpOnly session survived');
}finally{await stop();}
