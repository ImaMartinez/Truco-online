import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {decideCpu} from '../../backend/src/cpu/policy.ts';
const base='http://127.0.0.1:4210/api',results=[];let server;
async function boot(start=true){server=spawn(process.execPath,['--env-file=backend/.env.supabase','--import','tsx','tests/postgres/remote-cpu-server.mjs'],{windowsHide:true,env:{...process.env,TEST_WORKER_START:start?'yes':'no'},stdio:['ignore','pipe','pipe']});await new Promise((resolve,reject)=>{server.once('error',reject);server.stdout.on('data',b=>{if(b.toString().includes('READY'))resolve();});server.once('exit',code=>reject(Error('Test server exited '+code)));});}
async function stop(){if(!server)return;const p=server;server=null;p.kill();await new Promise(r=>p.once('exit',r));}
async function call(p,path,data,method=data?'POST':'GET'){
 const r=await fetch(base+path,{method,headers:{Cookie:p.cookie??'',Origin:process.env.APP_ORIGIN,'Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})});
 const cookie=r.headers.getSetCookie()[0];if(cookie)p.cookie=cookie.split(';')[0];const body=await r.json();return {status:r.status,body};
}
async function ok(p,path,data){const r=await call(p,path,data);assert.ok(r.status>=200&&r.status<300,JSON.stringify({path,...r}));return r.body;}
function humanView(s){return {...s,players:s.players.map((p,i)=>({...p,position:i+1,cards:[...p.hand.map(x=>({...x,zone:'MANO'})),...p.field.map(x=>({...x,zone:'CAMPO'})),...p.discard.map(x=>({...x,zone:'DESCARTE'}))]}))};}
try{
 await boot(false);const people=[];
 for(const difficulty of ['facil','normal','dificil']){const p={difficulty};const r=await ok(p,'/profile',{alias:'qa-cpu-'+difficulty+'-'+randomUUID().slice(0,8)});p.id=r.profile.id;p.recovery=r.recoveryCode;const catalog=await ok(p,'/catalog');p.cards=catalog.cards;
  const pool=[...p.cards].sort((a,b)=>a.cost-b.cost||b.attack-a.attack);const entries=pool.slice(0,10).map(c=>({cardId:c.id,quantity:2}));p.deck=await ok(p,'/decks',{name:'QA CPU '+difficulty,entries});people.push(p);
 }
 await Promise.all(people.map(async p=>{p.input={deckId:p.deck.id,difficulty:p.difficulty,requestId:randomUUID(),replaceActive:false};const [a,b]=await Promise.all([ok(p,'/duels',p.input),ok(p,'/duels',p.input)]);assert.equal(a.id,b.id);p.game=a.id;assert.equal(a.players.find(x=>x.id===a.cpu.playerId).hand.length,0);assert.equal((await ok(p,'/decks')).decks.length,1);}));results.push('tres usuarios/dificultades, inicios concurrentes idempotentes y CPU separadas');
 const p=people[0];let s=await ok(p,'/duels/'+p.game);if(s.activePlayerId===p.id){await ok(p,'/duels/'+p.game+'/actions',{expectedVersion:s.version,requestId:randomUUID(),action:{type:'endTurn'}});}
 s=await ok(p,'/duels/'+p.game);await stop();await boot(true);let recovered;for(let i=0;i<30;i++){recovered=await ok(p,'/duels/'+p.game);if(recovered.version>s.version)break;await delay(400);}assert.ok(recovered.version>s.version);assert.equal((await ok(p,'/me')).profile.id,p.id);results.push('reinicio real del proceso Node recupera sesión y turno CPU persistido');
 const stranger=people[1];assert.equal((await call(stranger,'/duels/'+p.game)).status,403);assert.equal((await call(stranger,'/duels/'+p.game+'/actions',{expectedVersion:recovered.version,actorId:p.id,requestId:randomUUID(),action:{type:'endTurn'}})).status,403);
 await Promise.all(people.map(async p=>{let s=await ok(p,'/duels/'+p.game),n=0;const deadline=Date.now()+300000;
  while(s.status==='active'){
   assert.ok(Date.now()<deadline,'Partida no terminó en cinco minutos');assert.equal(s.players.find(x=>x.id===s.cpu.playerId).hand.length,0);
   if(s.activePlayerId===p.id){const action=decideCpu(humanView(s),p.cards,'normal');const r=await call(p,'/duels/'+p.game+'/actions',{expectedVersion:s.version,requestId:randomUUID(),action});assert.equal(r.status,200,JSON.stringify(r));n++;}
   else await delay(500);
   s=await ok(p,'/duels/'+p.game);
  }
  const h=(await ok(p,'/history')).duels.find(x=>x.id===p.game);assert.equal(h.status,'finished');assert.equal(h.cpuDifficulty,p.difficulty);assert.ok(h.finishedAt);p.outcome={id:s.id,turn:s.turn,winnerId:s.winnerId,reason:s.result.reason,humanActions:n};console.log('PASS remote '+p.difficulty+': '+s.result.reason+' turn '+s.turn);
 }));results.push('tres partidas completas sobre Supabase con combate, resultados, historial y manos privadas');
 const restored={};const r=await ok(restored,'/profile/recover',{code:p.recovery});assert.equal(r.profile.id,p.id);assert.equal((await ok(restored,'/duels/'+p.game)).status,'finished');results.push('otra sesión recupera perfil, mazos y partida finalizada');
 await mkdir('artifacts/postgres',{recursive:true});await writeFile('artifacts/postgres/remote-cpu-results.json',JSON.stringify({date:new Date().toISOString(),project:'gjcpcbrkdjymrwktshfr',tests:results,passed:results.length,games:people.map(p=>({difficulty:p.difficulty,...p.outcome}))},null,2));console.log('PASS '+results.join('; '));
}finally{await stop();}
