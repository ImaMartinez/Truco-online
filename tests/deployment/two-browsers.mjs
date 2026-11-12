import {chromium,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=process.env.WEB_BASE;assert.equal(new URL(base).protocol,'https:');
const browsers=[],people=[],suffix=randomUUID().slice(0,8);
async function api(p,path,data){const r=data?await p.page.request.post(base+'/api'+path,{headers:{Origin:base},data}):await p.page.request.get(base+'/api'+path);assert.ok(r.ok(),path+' HTTP '+r.status());return r.json();}
try{
 for(const channel of ['chrome','msedge']){
  const browser=await chromium.launch({channel});browsers.push(browser);const page=await browser.newPage({viewport:{width:1440,height:900}});await page.goto(base);
  await page.getByLabel('Tu alias').fill('qa-browsers-'+channel+'-'+suffix);await page.getByRole('button',{name:'Crear mi perfil',exact:true}).click();await expect(page.getByTestId('recovery-code')).toBeVisible({timeout:25000});await page.getByRole('button',{name:'Ya lo guardé'}).click();const p={page,channel};p.id=(await api(p,'/me')).profile.id;const cards=(await api(p,'/catalog')).cards;p.deck=(await api(p,'/decks',{name:'Dos navegadores QA',entries:[...cards].sort((a,b)=>a.cost-b.cost).slice(0,10).map(c=>({cardId:c.id,quantity:2}))})).id;
  assert.equal((await api(p,'/players/'+p.id+'/collection')).cards.length,40);
  for(const route of ['coleccion','mazos','jugar','historial','perfil']){await page.goto(base+'/#/'+route);await expect(page.locator('main')).toBeVisible();}
  people.push(p);
 }
 const [host,guest]=people;assert.notEqual(host.id,guest.id);const room=await api(host,'/rooms',{deckId:host.deck,requestId:randomUUID()});assert.match(room.code,/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);const joined=await api(guest,'/rooms/join',{deckId:guest.deck,code:room.code,requestId:randomUUID()});
 await Promise.all(people.map(async p=>{await p.page.goto(base+'/#/arena?partida='+joined.duelId);await expect(p.page.locator('.battle-table')).toBeVisible({timeout:20000});const s=await api(p,'/duels/'+joined.duelId);assert.equal(s.viewerPlayerId,p.id);assert.ok(s.players.find(x=>x.id!==p.id).hand.length===0);assert.ok(s.players.find(x=>x.id===p.id).hand.length>0);}));
 await mkdir('artifacts/deployment',{recursive:true});await host.page.screenshot({path:'artifacts/deployment/online-desktop.png',fullPage:true});await guest.page.setViewportSize({width:390,height:844});assert.ok(await guest.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 const game=await api(guest,'/duels/'+joined.duelId);await api(guest,'/duels/'+joined.duelId+'/abandon',{expectedVersion:game.version,requestId:randomUUID()});await expect(host.page.getByTestId('match-outcome')).toHaveText('Victoria',{timeout:20000});await expect(guest.page.getByTestId('match-outcome')).toHaveText('Derrota',{timeout:20000});
 for(const p of people)assert.equal((await api(p,'/history')).duels.find(x=>x.id===joined.duelId).reason,'ABANDONO');
 await writeFile('artifacts/deployment/two-browsers-results.json',JSON.stringify({date:new Date().toISOString(),base,browsers:['Google Chrome','Microsoft Edge'],game:joined.duelId,independentProfiles:true,ownCollections:40,privateHands:true,navigation:true,desktop:true,mobile:true,liveOutcome:true,bothHistories:true},null,2));console.log('PASS Chrome + Edge: independent profiles, navigation, collections, room, private hands, live result and histories');
}finally{await Promise.all(browsers.map(b=>b.close()));}
