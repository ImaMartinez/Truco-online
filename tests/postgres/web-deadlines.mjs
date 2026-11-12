// Real TrucoOnline Auth, HTTP, UI, SQL deadlines and pg_cron. No production clock overrides.
import {chromium,expect} from '@playwright/test';
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:5178',headers={Origin:base},suffix=randomUUID().slice(0,8),results=[],evidence={};
let backend,vite,browser;const env={...process.env,APP_ORIGIN:base,API_PROXY_TARGET:'http://127.0.0.1:4220'};
async function boot(){backend=spawn(process.execPath,['--env-file=backend/.env.supabase','--import','tsx','tests/postgres/online-http-server.mjs'],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});await new Promise((r,j)=>{backend.stdout.on('data',b=>{if(b.toString().includes('READY'))r();});backend.once('error',j);backend.once('exit',()=>j(Error('BFF exited')));});}
async function stop(p){if(!p||p.exitCode!==null)return;p.kill();await new Promise(r=>p.once('exit',r));}
const get=async(p,path)=>{const r=await p.page.request.get(base+'/api'+path);assert.ok(r.ok(),path+': '+await r.text());return r.json();};
const post=(p,path,data)=>p.page.request.post(base+'/api'+path,{headers,data});
async function ok(p,path,data){const r=await post(p,path,data);const b=await r.json();assert.ok(r.ok(),JSON.stringify({path,status:r.status(),body:b}));return b;}
async function room(a,b){const r=await ok(a,'/rooms',{deckId:a.deck,requestId:randomUUID()});const joined=await ok(b,'/rooms/join',{code:r.code,deckId:b.deck,requestId:randomUUID()});return {room:r,game:joined.duelId};}
async function board(p,id){await p.page.goto(base+'/#/arena?partida='+id);await expect(p.page.locator('.battle-table')).toBeVisible();}
function pass(name){results.push(name);console.log('PASS '+name);}
async function launch(){return chromium.launch({channel:existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe')?'chrome':'msedge'});}
try{
 await mkdir('artifacts/deadlines',{recursive:true});await boot();
 vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','frontend','--config','frontend/vite.config.ts','--host','127.0.0.1','--port','5178','--strictPort'],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});
 for(let i=0;i<40;i++){try{if((await fetch(base)).ok)break;}catch{}await delay(250);}
 browser=await launch();const people=[],privacy=[],errors=[];
 for(const label of ['host','guest']){
  const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage();page.setDefaultTimeout(20000);const p={page,context};
  page.on('pageerror',e=>errors.push(e.message));page.on('response',async r=>{if(/\/api\/duels\/\d+(?:\/actions|\/abandon)?$/.test(r.url())&&r.ok())try{const s=await r.json();if(s.players?.some(x=>x.id!==s.viewerPlayerId&&x.hand?.length))privacy.push(s.id);}catch{}});
  await page.goto(base);await page.getByLabel('Tu alias').fill('qa-deadline-'+label+'-'+suffix);await page.getByRole('button',{name:'Crear mi perfil',exact:true}).click();await expect(page.getByTestId('recovery-code')).toBeVisible();await page.getByRole('button',{name:'Ya lo guardé'}).click();p.id=(await get(p,'/me')).profile.id;
  p.cards=(await get(p,'/catalog')).cards;const cheap=[...p.cards].sort((a,b)=>a.cost-b.cost);p.deck=(await ok(p,'/decks',{name:'Plazo 12',entries:cheap.slice(0,6).map(c=>({cardId:c.id,quantity:2}))})).id;people.push(p);
 }
 let [a,b]=people;let {room:r,game}=await room(a,b);evidence.inactivityGame=game;evidence.room=r.id;
 await Promise.all([board(a,game),board(b,game)]);let s=await get(a,'/duels/'+game),deadline=s.onlineTimer.deadlineAt;
 assert.equal(Date.parse(deadline)-Date.parse(s.onlineTimer.openedAt),15000);
 const times=await Promise.all(people.map(p=>p.page.getByTestId('turn-seconds').innerText()));assert.ok(Math.abs(parseInt(times[0])-parseInt(times[1]))<=1);
 // A skewed Date.now() must not affect performance.now()-based countdown.
 await a.page.evaluate(()=>{const now=Date.now;Date.now=()=>now()+86400000;});await delay(500);assert.ok(parseInt(await a.page.getByTestId('turn-seconds').innerText())<=parseInt(times[0]));
 await Promise.all(people.map(p=>p.page.reload()));for(const p of people)await expect(p.page.getByTestId('turn-seconds')).toBeVisible();
 assert.equal((await get(a,'/duels/'+game)).onlineTimer.deadlineAt,deadline);
 await b.page.setViewportSize({width:390,height:844});await b.page.screenshot({path:'artifacts/deadlines/mobile-countdown.png',fullPage:true});assert.ok(await b.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await a.page.screenshot({path:'artifacts/deadlines/desktop-countdown.png',fullPage:true});
 pass('dos sesiones sincronizadas, plazo fijo tras recarga, reloj local desfasado y móvil sin desborde');
 // Observe the first real automatic closure, including warning and same hands/no redeal.
 await expect.poll(async()=>Number((await get(a,'/duels/'+game)).turn),{timeout:20000}).toBe(2);
 s=await get(a,'/duels/'+game);assert.equal(s.onlineTimer.lastClosure.reason,'TIEMPO_AGOTADO');assert.equal(s.onlineTimer.inactivity.find(p=>p.playerId===a.id).count,1);
 await expect(a.page.locator('.online-turn-notices')).toContainText('Tiempo agotado. Turno finalizado');await a.page.screenshot({path:'artifacts/deadlines/first-timeout.png',fullPage:true});evidence.firstTimeout={turn:s.turn,version:s.version,deadline:s.onlineTimer.deadlineAt};
 pass('pg_cron cierra a los 15 s reales y ambos tableros reciben advertencia y siguiente turno');
 // Store encrypted cookies only in memory, close every test browser and stop our BFF.
 const saved=await Promise.all(people.map(async p=>({id:p.id,deck:p.deck,cookies:await p.context.cookies()})));
 await browser.close();browser=null;await stop(backend);backend=null;evidence.backendStoppedAt=new Date().toISOString();console.log('WAIT_NO_BROWSERS_NO_BFF game='+game);
 await delay(68000);await boot();browser=await launch();const restored=[];
 for(const old of saved){const context=await browser.newContext({viewport:{width:1440,height:900}});await context.addCookies(old.cookies);const p={...old,context,page:await context.newPage()};await board(p,game);restored.push(p);}
 [a,b]=restored;s=await get(a,'/duels/'+game);assert.equal(s.status,'finished');assert.equal(s.result.reason,'INACTIVIDAD');assert.equal(s.winnerId,b.id);assert.equal(s.turn,5);assert.equal(s.version,6);assert.equal(s.room.status,'FINALIZADA');assert.equal(s.onlineTimer.inactivity.find(p=>p.playerId===a.id).count,3);
 assert.equal((await get(a,'/rooms/'+r.id)).status,'FINALIZADA');
 for(const p of [a,b]){await expect(p.page.getByTestId('match-outcome')).toHaveText(p===a?'Derrota':'Victoria');const h=(await get(p,'/history')).duels.find(x=>x.id===game);assert.equal(h.reason,'INACTIVIDAD');}
 evidence.resumed={at:new Date().toISOString(),turn:s.turn,version:s.version,reason:s.result.reason,winner:s.winnerId};await a.page.screenshot({path:'artifacts/deadlines/inactivity-result.png',fullPage:true});
 pass('sin navegadores ni BFF: Cron procesa turnos propios 1/3/5, derrota persistente, sala e historiales tras reiniciar Node');
 // New game: a valid action cannot renew deadline; its timeout must not count as inactivity.
 ({room:r,game}=await room(a,b));s=await get(a,'/duels/'+game);deadline=s.onlineTimer.deadlineAt;
 const cards=(await get(a,'/catalog')).cards,own=s.players.find(p=>p.id===a.id);const card=own.hand.find(x=>cards.find(c=>c.id===x.cardId).cost<=own.energy);assert.ok(card);
 s=await ok(a,'/duels/'+game+'/actions',{expectedVersion:s.version,requestId:randomUUID(),action:{type:'play',instanceId:card.id}});assert.equal(s.onlineTimer.deadlineAt,deadline);
 await expect.poll(async()=>Number((await get(a,'/duels/'+game)).turn),{timeout:20000}).toBe(2);s=await get(a,'/duels/'+game);assert.equal(s.onlineTimer.inactivity.find(p=>p.playerId===a.id).count,0);
 pass('invocación real conserva vencimiento y timeout posterior no suma inactividad');
 await Promise.all([board(a,game),board(b,game)]);await a.page.getByRole('button',{name:'Abandonar partida',exact:true}).click();await expect(a.page.getByRole('dialog')).toContainText('tu rival ganará automáticamente');await a.page.getByRole('button',{name:'Continuar jugando',exact:true}).click();assert.equal((await get(a,'/duels/'+game)).status,'active');
 // Host is off-turn; abandoning must still work. Cancel never writes.
 await a.page.getByRole('button',{name:'Abandonar partida',exact:true}).click();await a.page.getByRole('dialog').getByRole('button',{name:'Abandonar partida',exact:true}).click();
 for(const p of [a,b])await expect(p.page.getByTestId('match-outcome')).toHaveText(p===a?'Derrota':'Victoria');s=await get(a,'/duels/'+game);assert.equal(s.result.reason,'ABANDONO');assert.equal(s.winnerId,b.id);assert.equal(s.room.status,'FINALIZADA');
 for(const p of [a,b])assert.equal((await get(p,'/history')).duels.find(x=>x.id===game).reason,'ABANDONO');evidence.abandonGame=game;await a.page.screenshot({path:'artifacts/deadlines/abandon-result.png',fullPage:true});
 pass('confirmación/cancelación, abandono fuera de turno, resultado sincronizado y ambos historiales');
 const pc=await ok(a,'/duels',{deckId:a.deck,difficulty:'normal',requestId:randomUUID()});assert.equal(pc.onlineTimer,undefined);await board(a,pc.id);await expect(a.page.getByTestId('turn-seconds')).toHaveCount(0);await expect(a.page.getByRole('button',{name:'Abandonar partida',exact:true})).toHaveCount(0);
 let current=await get(a,'/duels/'+pc.id);await ok(a,'/duels/'+pc.id+'/actions',{expectedVersion:current.version,requestId:randomUUID(),action:{type:'endTurn'}});await expect.poll(async()=>Number((await get(a,'/duels/'+pc.id)).turn),{timeout:25000}).toBeGreaterThanOrEqual(3);assert.equal((await get(a,'/duels/'+pc.id)).onlineTimer,undefined);
 pass('partida PC sin temporizador y worker CPU real conserva su turno automático');
 assert.deepEqual(privacy,[]);assert.deepEqual(errors,[]);pass('sin manos rivales filtradas ni errores JavaScript');
 await writeFile('artifacts/deadlines/web-results.json',JSON.stringify({date:new Date().toISOString(),project:'gjcpcbrkdjymrwktshfr',passed:results.length,tests:results,evidence},null,2));
}finally{await browser?.close();await stop(backend);await stop(vite);}
