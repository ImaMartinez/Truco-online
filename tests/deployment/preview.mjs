// Same browser/API story for a real HTTPS Preview and for the local production harness.
import {chromium,expect,request as playwrightRequest} from '@playwright/test';
import {existsSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
export async function verifyPreview(base,{restartBackend,stopBackend,startBackend,local=false,apiOrigin=base,scope=local?'local-production-https-proxy-not-public-vercel':'public-preview',evidenceFile=local?'local-production-results.json':'public-preview-results.json'}={}){
 const url=new URL(base);assert.equal(url.protocol,'https:');assert.equal(url.origin,base);
 assert.equal(new URL(apiOrigin).protocol,'https:');assert.equal(new URL(apiOrigin).origin,apiOrigin);
 assert.match(evidenceFile,/^[a-z0-9-]+\.json$/);
 // Staged Production has no canonical alias yet. This test-only adapter exercises
 // the exact authorized Production origin without widening the server allowlist.
 async function authorizeCanary(context){if(apiOrigin!==base)await context.route(base+'/api/**',route=>route.continue({headers:{...route.request().headers(),origin:apiOrigin}}));}
 const browser=await chromium.launch({channel:existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe')?'chrome':'msedge'});
 const contexts=[],clients=[],results=[],privacy=[],errors=[],http=[],cpuGames=[];const suffix=randomUUID().slice(0,8);const people=[];
 const pass=name=>{results.push(name);console.log('PASS '+name);};
 async function get(p,path){const r=await p.client.get('/api'+path);assert.ok(r.ok(),path+': '+await r.text());if(path!=='/health'){assert.match(r.headers()['cache-control']??'',/no-store/);assert.notEqual(r.headers()['x-vercel-cache'],'HIT','private response must never come from shared cache');}const s=await r.json();if(s.players)assert.ok(s.players.every(x=>x.id===s.viewerPlayerId||x.hand.length===0),'private rival hand');return s;}
 async function post(p,path,data,expected){const r=await p.client.post('/api'+path,{headers:{Origin:apiOrigin},data});const s=await r.json();assert.ok(expected?r.status()===expected:r.ok(),JSON.stringify({path,status:r.status(),body:s}));return s;}
 async function pageFor(p){const context=await browser.newContext({ignoreHTTPSErrors:local,storageState:await p.client.storageState(),viewport:{width:1440,height:900}});await authorizeCanary(context);contexts.push(context);p.context=context;p.page=await context.newPage();p.page.on('pageerror',e=>errors.push(e.message));p.page.on('response',async r=>{if(r.url().startsWith(base+'/api/')){http.push(r.status());if(r.ok()&&/\/duels\/\d+(?:\/actions|\/abandon)?$/.test(r.url()))try{const s=await r.json();if(s.players?.some(x=>x.id!==s.viewerPlayerId&&x.hand?.length))privacy.push(s.id);}catch{}}});await p.page.goto(base);return p.page;}
 async function board(p,id){await p.page.goto(base+'/#/arena?partida='+id);await expect(p.page.locator('.battle-table')).toBeVisible({timeout:25000});}
 try{
  await mkdir('artifacts/deployment',{recursive:true});
  const blank=await playwrightRequest.newContext({baseURL:base,ignoreHTTPSErrors:local});clients.push(blank);assert.equal((await blank.get('/api/catalog')).status(),401);assert.equal((await blank.post('/api/profile',{headers:{Origin:'https://attacker.invalid'},data:{alias:'denied'}})).status(),403);
  for(const label of ['cpu','host','guest']){
   const client=await playwrightRequest.newContext({baseURL:base,ignoreHTTPSErrors:local});clients.push(client);const p={client};await pageFor(p);
   await p.page.getByLabel('Tu alias').fill('qa-release-'+label+'-'+suffix);await p.page.getByRole('button',{name:'Crear mi perfil',exact:true}).click();await expect(p.page.getByTestId('recovery-code')).toBeVisible({timeout:25000});p.recovery=await p.page.getByTestId('recovery-code').innerText();await p.page.getByRole('button',{name:'Ya lo guardé'}).click();
   // Auth cookie belongs to the frontend HTTPS origin and is copied only into test memory.
   const cookies=await p.context.cookies();const cookie=cookies.find(x=>x.name==='__Host-ta_session');assert.ok(cookie?.secure&&cookie.httpOnly&&cookie.sameSite==='Lax');
   await client.dispose();clients.pop();p.client=await playwrightRequest.newContext({baseURL:base,ignoreHTTPSErrors:local,storageState:await p.context.storageState()});clients.push(p.client);
   const me=await get(p,'/me');p.id=me.profile.id;await p.page.reload();await expect(p.page.getByRole('link',{name:'Mi perfil',exact:true})).toBeVisible();assert.equal((await get(p,'/me')).profile.id,p.id);
   p.cards=(await get(p,'/catalog')).cards;assert.equal(p.cards.length,40);const cheap=[...p.cards].sort((a,b)=>a.cost-b.cost);p.deck=(await post(p,'/decks',{name:'Preview 20',entries:cheap.slice(0,10).map(c=>({cardId:c.id,quantity:2}))})).id;assert.ok((await get(p,'/decks')).decks.some(d=>d.id===p.deck));people.push(p);
  }
  const [cpu,a,b]=people;const health=await get(a,'/health');assert.equal(health.database,'connected');assert.equal(health.cpu.state,'ready');pass('HTTPS, perfiles reales, cookie __Host Secure/HttpOnly, recarga y mazos persistentes; 401/403 correctos');
  let pc=await post(cpu,'/duels',{deckId:cpu.deck,difficulty:'normal',requestId:randomUUID()});assert.equal(pc.onlineTimer,undefined);await board(cpu,pc.id);
  assert.equal((await b.client.get('/api/duels/'+pc.id)).status(),403);
  // PC games may randomly give the first turn to the CPU; wait for the actual human turn.
  await expect.poll(async()=>{pc=await get(cpu,'/duels/'+pc.id);return pc.activePlayerId===cpu.id;},{timeout:30000,intervals:[600,1000]}).toBe(true);
  const before=pc.version,humanTurn=pc.turn;await post(cpu,'/duels/'+pc.id+'/actions',{expectedVersion:before,requestId:randomUUID(),action:{type:'endTurn'}});await cpu.context.close();
  if(restartBackend)await restartBackend();
  await expect.poll(async()=>{pc=await get(cpu,'/duels/'+pc.id);return pc.turn>humanTurn&&pc.activePlayerId===cpu.id;},{timeout:30000}).toBe(true);assert.equal(pc.onlineTimer,undefined);assert.ok(pc.players.every(p=>p.handCount+p.deckCount+p.field.length+p.discard.length===20));
  await post(cpu,'/duels/'+pc.id+'/actions',{expectedVersion:before,requestId:randomUUID(),action:{type:'endTurn'}},409);await pageFor(cpu);await board(cpu,pc.id);pass('CPU persistente juega sin navegador, recupera estado y rechaza versión vieja; sin temporizador PC');
  // Drive only legal human inputs through the public API; the deployed worker plays the rival.
  // No SQL access, privileged keys, or second game engine are used by this probe.
  await cpu.context.close();
  for(const difficulty of ['facil','normal','dificil']){
   const input={deckId:cpu.deck,difficulty,requestId:randomUUID(),replaceActive:true};let game=await post(cpu,'/duels',input);
   const replay=await post(cpu,'/duels',input);assert.equal(replay.id,game.id);assert.equal(replay.operation.replayed,true);assert.equal(game.cpu.difficulty,difficulty);
   let steps=0;
   while(game.status==='active'&&steps++<240){
    if(game.activePlayerId!==cpu.id){await expect.poll(async()=>{game=await get(cpu,'/duels/'+game.id);return game.status!=='active'||game.activePlayerId===cpu.id;},{timeout:30000,intervals:[600,1000]}).toBe(true);continue;}
    const own=game.players.find(p=>p.id===cpu.id),rival=game.players.find(p=>p.id!==cpu.id);
    const attacker=own.field.find(c=>c.enteredTurn<game.turn&&c.lastAttackTurn!==game.turn);
    const summon=own.field.length<3&&own.hand.find(c=>cpu.cards.find(x=>x.id===c.cardId).cost<=own.energy);
    const action=attacker?{type:'attack',attackerId:attacker.id,targetId:rival.field[0]?.id??'hero'}:summon?{type:'play',instanceId:summon.id}:{type:'endTurn'};
    game=await post(cpu,'/duels/'+game.id+'/actions',{expectedVersion:game.version,requestId:randomUUID(),action});
    assert.ok(game.players.every(p=>p.handCount+p.deckCount+p.field.length+p.discard.length===20));assert.ok(game.turn<=30);
   }
   assert.equal(game.status,'finished');assert.ok((await get(cpu,'/history')).duels.some(d=>d.id===game.id));cpuGames.push({id:game.id,difficulty,turn:game.turn,reason:game.result.reason});console.log('PASS CPU '+difficulty+' finished game='+game.id+' turn='+game.turn);
  }
  pass('tres dificultades CPU completan partidas por API HTTP, inicios idempotentes, combate, historial y límite de 30 turnos');
  async function startRoom(){const r=await post(a,'/rooms',{deckId:a.deck,requestId:randomUUID()});const j=await post(b,'/rooms/join',{code:r.code,deckId:b.deck,requestId:randomUUID()});await Promise.all([board(a,j.duelId),board(b,j.duelId)]);return {r,id:j.duelId};}
  let {r,id}=await startRoom();let s=await get(a,'/duels/'+id);await post(a,'/duels/'+id+'/actions',{expectedVersion:s.version,requestId:randomUUID(),action:{type:'endTurn'}});s=await get(b,'/duels/'+id);await post(b,'/duels/'+id+'/actions',{expectedVersion:s.version,requestId:randomUUID(),action:{type:'endTurn'}});s=await get(a,'/duels/'+id);
  const own=s.players.find(p=>p.id===a.id),copy=own.hand.find(c=>a.cards.find(x=>x.id===c.cardId).cost<=own.energy);assert.ok(copy);const deadline=s.onlineTimer.deadlineAt;s=await post(a,'/duels/'+id+'/actions',{expectedVersion:s.version,requestId:randomUUID(),action:{type:'play',instanceId:copy.id}});assert.equal(s.onlineTimer.deadlineAt,deadline);await expect(b.page.locator('.enemy-field [data-instance-id="'+copy.id+'"]')).toBeVisible({timeout:20000});
  await b.page.setViewportSize({width:390,height:844});assert.ok(await b.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await b.page.screenshot({path:'artifacts/deployment/online-mobile.png',fullPage:true});pass('sala privada, sincronización e invocación entre dos navegadores; manos privadas, plazo fijo y móvil');
  await b.page.getByRole('button',{name:'Abandonar partida',exact:true}).click();await b.page.getByRole('button',{name:'Continuar jugando',exact:true}).click();assert.equal((await get(b,'/duels/'+id)).status,'active');await b.page.getByRole('button',{name:'Abandonar partida',exact:true}).click();await b.page.getByRole('dialog').getByRole('button',{name:'Abandonar partida',exact:true}).click();
  for(const p of [a,b]){await expect(p.page.getByTestId('match-outcome')).toHaveText(p===a?'Victoria':'Derrota');assert.equal((await get(p,'/history')).duels.find(x=>x.id===id).reason,'ABANDONO');}pass('abandono confirmado fuera de turno, ambos resultados e historiales');
  ({r,id}=await startRoom());s=await get(a,'/duels/'+id);const opened=s.onlineTimer.openedAt;await a.page.reload();await expect(a.page.getByTestId('turn-seconds')).toBeVisible();assert.equal((await get(a,'/duels/'+id)).onlineTimer.openedAt,opened);
  for(const p of people)await p.context.close();if(stopBackend)await stopBackend();console.log('WAIT_CLOSED_CLIENTS'+(stopBackend?'_AND_BACKEND':'')+' game='+id);await delay(79000);if(startBackend)await startBackend();
  s=await get(a,'/duels/'+id);assert.equal(s.result.reason,'INACTIVIDAD');assert.equal(s.turn,5);assert.equal(s.version,6);assert.equal(s.room.status,'FINALIZADA');
  for(const p of [a,b]){assert.equal((await get(p,'/history')).duels.find(x=>x.id===id).reason,'INACTIVIDAD');await pageFor(p);await board(p,id);await expect(p.page.getByTestId('match-outcome')).toHaveText(p===a?'Derrota':'Victoria');}pass('recarga no renueva plazo; Cron finaliza turno 5/versión 6 sin navegadores y conserva resultado al volver');
  const recoverContext=await browser.newContext({ignoreHTTPSErrors:local}),recoverPage=await recoverContext.newPage();await authorizeCanary(recoverContext);contexts.push(recoverContext);await recoverPage.goto(base);await recoverPage.getByRole('button',{name:'Recuperar perfil',exact:true}).click();await recoverPage.getByLabel('Código privado de recuperación').fill(a.recovery);await recoverPage.getByRole('button',{name:'Recuperar mi perfil',exact:true}).click();await expect(recoverPage.getByTestId('recovery-code')).toBeVisible({timeout:25000});assert.notEqual(await recoverPage.getByTestId('recovery-code').innerText(),a.recovery);await recoverPage.getByRole('button',{name:'Ya lo guardé'}).click();assert.equal((await(await recoverPage.request.get(base+'/api/me')).json()).profile.id,a.id);pass('recuperación real en otro navegador y rotación del código secreto');
  let limited=false;for(let i=0;i<12;i++){const response=await b.client.post('/api/rooms/lookup',{headers:{Origin:apiOrigin},data:{code:'ZZZZ-ZZZZ'}});if(response.status()===429){limited=true;break;}assert.equal(response.status(),404);}assert.ok(limited,'SQL lookup throttle');assert.deepEqual(privacy,[]);assert.deepEqual(errors,[]);assert.deepEqual(http.filter(x=>x>=500),[],'unexpected HTTP server errors');pass('límite SQL 429, consola sin errores y ninguna respuesta filtra mano rival');
  const evidence={date:new Date().toISOString(),base,apiOrigin,testOnlyOriginAdapter:apiOrigin!==base,scope,passed:results.length,tests:results,backendRestartVerified:!!restartBackend,backendStoppedDuringCron:!!stopBackend,games:{pc:pc.id,inactivity:id,cpuDifficulties:cpuGames},privacyFailures:privacy,unexpected500:http.filter(x=>x>=500)};
  await writeFile('artifacts/deployment/'+evidenceFile,JSON.stringify(evidence,null,2));return evidence;
 }finally{for(const client of clients)await client.dispose().catch(()=>{});await browser.close();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){if(!process.env.WEB_BASE)throw Error('Definí WEB_BASE con la URL HTTPS Preview verificada.');await verifyPreview(process.env.WEB_BASE,{apiOrigin:process.env.TEST_API_ORIGIN??process.env.WEB_BASE,scope:process.env.TEST_SCOPE??'public-preview',evidenceFile:process.env.TEST_EVIDENCE_FILE??'public-preview-results.json'});}
