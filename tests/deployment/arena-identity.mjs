// Visual-only probe of the deployed bundle. No profile, deck or game is written remotely.
import {chromium,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import assert from 'node:assert/strict';
import {DemoRepository} from '../../backend/src/demo/demo-repository.ts';
const base=process.env.WEB_BASE;assert.equal(new URL(base).protocol,'https:');
const protection=process.env.TEST_VERCEL_BYPASS?{'x-vercel-protection-bypass':process.env.TEST_VERCEL_BYPASS}:{};
const health=await fetch(base+'/api/health',{headers:protection});assert.equal(health.status,200);const healthDto=await health.json();assert.equal(healthDto.cpu.state,'ready');
const repo=new DemoRepository(),browser=await chromium.launch({channel:existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe')?'chrome':'msedge'}),results=[],errors=[],blockedWrites=[];
const folder=process.env.IDENTITY_OUTPUT??'public';assert.match(folder,/^[a-z0-9-]+$/);
const modes=process.env.ARENA_PROBE_MODES==='both'?['cpu','online']:['online'];
await mkdir('artifacts/arena-identity/'+folder,{recursive:true});
try{for(const [width,height]of [[1920,1080],[1366,768],[1280,720],[390,844],[844,390],[360,740],[360,800],[375,812],[412,915]])for(const mode of modes){
 const context=await browser.newContext({viewport:{width,height}});
 if(process.env.TEST_VERCEL_BYPASS)await context.route(base+'/**',route=>route.continue({headers:{...route.request().headers(),...protection}}));
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 const state=repo.createDuel({scenario:'mesa-abierta',deckIds:['espadas-20','copas-20']});state.viewerPlayerId=state.players[0].id;state.mode='persistent';state.room=mode==='online'?{id:'visual-only',code:'ABCD-EFGH',status:'EN_CURSO'}:undefined;state.cpu=mode==='cpu'?{playerId:state.players[1].id,difficulty:'facil'}:undefined;
 state.players[0].name='Tu perfil';state.players[1].name=mode==='cpu'?'Rival PC':'Rival online';state.players.forEach(p=>{p.handCount=p.hand.length;});
 state.onlineTimer=mode==='online'?{turnId:'visual-turn',serverNow:new Date().toISOString(),openedAt:new Date().toISOString(),deadlineAt:new Date(Date.now()+15000).toISOString(),durationSeconds:15,running:true,lastClosure:null,inactivity:[]}:undefined;
 await page.route(base+'/api/**',async route=>{
  const req=route.request(),path=new URL(req.url()).pathname;
  if(req.method()!=='GET'){blockedWrites.push(path);return route.fulfill({status:405,json:{error:{message:'Visual probe blocks remote writes.'}}});}
  const value=path==='/api/health'?healthDto:path==='/api/me'?{authenticated:true,profile:{id:state.viewerPlayerId,alias:'Tu perfil'}}:path==='/api/catalog'?{cards:repo.listCards(),mode:'persistent'}:path==='/api/decks'?{decks:[]}:path==='/api/history'?{duels:[]}:path==='/api/rooms'?{rooms:[]}:path==='/api/duels/'+state.id?state:null;
  return route.fulfill({status:value?200:404,json:value??{error:{message:'Unexpected visual fixture endpoint.'}}});
 });
 await page.goto(base+'/#/arena?partida='+state.id);await expect(page.locator('.battle-table')).toBeVisible();
 await page.locator('.field-card').evaluateAll(elements=>Promise.all(elements.flatMap(e=>e.getAnimations()).map(a=>a.finished)));
 for(const selector of ['.rival-summary','.own-summary']){await expect(page.locator(selector)).not.toContainText(/En mazo|En mano|Descartadas|TU MANO/);await expect(page.locator(selector+' .avatar')).toHaveCount(1);}
 await expect(page.locator('.rival-summary .player-kind')).toHaveText(mode==='online'?'Jugador online':'Computadora');await expect(page.locator('.hand-heading,.player-card-count')).toHaveCount(0);
 if(modes.length>1)await page.screenshot({path:`artifacts/arena-identity/${folder}/${width}x${height}-${mode}-unselected.png`,fullPage:true});
 const hand=page.locator('.own-hand .playing-card').first();await hand.click({position:height<500?{x:8,y:35}:undefined});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 assert.ok(await page.locator('.indicator-card').evaluateAll(es=>es.every(e=>e.scrollHeight<=e.clientHeight+1)));
 for(const stack of await page.locator('.indicator-decks .draw-pile-stack').all()){
  if(width<=600||(width<=900&&height<=500))await expect(stack).toBeHidden();else await expect(stack).toBeVisible();
 }
 await expect(page.locator('.indicator-decks .draw-pile > strong')).toHaveText(state.players.slice().reverse().map(p=>String(p.deckCount)));
 if(width<=600){
  const handBox=await page.locator('.own-hand').boundingBox(),selected=await hand.boundingBox(),mini=await page.locator('.indicator-middle').boundingBox(),actions=await page.locator('.action-dock').boundingBox();
  assert.ok(selected.y>=handBox.y-1&&selected.y+selected.height<=handBox.y+handBox.height+1);assert.ok(actions.y>=mini.y+mini.height+8);
  await expect(page.locator('.match-mode-badge')).toHaveText(mode==='cpu'?'CPU · Fácil':'Online');
  assert.ok(await page.locator('.indicator-middle .indicator-card').evaluateAll(es=>es.every(e=>e.scrollWidth<=e.clientWidth+1)));
 }
 if(width>900){for(const s of ['.indicator-lives','.indicator-energy','.indicator-decks','.indicator-hands','.indicator-discards'])await expect(page.locator(s)).toBeInViewport();}
 else{for(const s of ['.indicator-lives','.indicator-energy','.indicator-decks','.indicator-hands','.indicator-discards']){await page.locator(s).scrollIntoViewIfNeeded();await expect(page.locator(s)).toBeInViewport();}}
 await page.locator('.indicator-lives').scrollIntoViewIfNeeded();await page.locator('.indicator-middle').evaluate(e=>{e.scrollLeft=0;});await page.screenshot({path:`artifacts/arena-identity/${folder}/${width}x${height}${modes.length>1?'-'+mode:''}.png`,fullPage:true});
 results.push({width,height,mode,identityOnly:true,resourceCardsHaveNoIndividualScroll:true,resourcesAccessible:true,horizontalOverflow:false});
 await context.close();
}}finally{await browser.close();}
assert.deepEqual(errors,[]);assert.deepEqual(blockedWrites,[]);
await writeFile(`artifacts/arena-identity/${folder}/results.json`,JSON.stringify({date:new Date().toISOString(),base,scope:'deployed-static-bundle-with-browser-only-fixtures; real-read-only-health',remoteWrites:0,realAuthOrGameIntegrationRetested:false,results,errors},null,2));
console.log(`PASS deployed arena: ${results.length} visual scenarios; static sprites and real health; zero remote writes.`);
