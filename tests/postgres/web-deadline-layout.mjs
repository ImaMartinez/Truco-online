import {chromium,expect} from '@playwright/test';
import {existsSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:5173',headers={Origin:base};
const browser=await chromium.launch({channel:existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe')?'chrome':'msedge'});
const call=async(page,path,data)=>{const r=data?await page.request.post(base+'/api'+path,{headers,data}):await page.request.get(base+'/api'+path);assert.ok(r.ok(),await r.text());return r.json();};
try{
 const people=[];for(let i=0;i<2;i++){const context=await browser.newContext(),page=await context.newPage();await call(page,'/profile',{alias:'qa-layout-'+i+'-'+randomUUID().slice(0,14)});const cards=(await call(page,'/catalog')).cards;const deck=await call(page,'/decks',{name:'Layout timer',entries:cards.slice(0,6).map(c=>({cardId:c.id,quantity:2}))});people.push({page,deck:deck.id});}
 const [a,b]=people,r=await call(a.page,'/rooms',{deckId:a.deck,requestId:randomUUID()}),g=await call(b.page,'/rooms/join',{code:r.code,deckId:b.deck,requestId:randomUUID()});
 await a.page.goto(base+'/#/arena?partida='+g.duelId);await expect(a.page.getByTestId('turn-seconds')).toBeVisible();await mkdir('artifacts/deadlines',{recursive:true});const checks=[];
 for(const [width,height] of [[1440,900],[1280,720],[390,844],[844,390]]){
  await a.page.setViewportSize({width,height});await a.page.waitForTimeout(150);
  assert.ok(await a.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal overflow');
  assert.ok(await a.page.getByTestId('turn-seconds').evaluate(e=>parseFloat(getComputedStyle(e).fontSize)>=20),'countdown readable');
  if(width>900){for(const cls of ['rival-summary','own-summary']){const p=await a.page.locator('.'+cls).boundingBox(),c=await a.page.locator('.arena-center').boundingBox();assert.ok(p.x+p.width<=c.x,'participant panel must not overlap central zone');}}
  const end=await a.page.getByRole('button',{name:'Finalizar turno',exact:true}).boundingBox();assert.ok(end.y+end.height<=height+2,'actions fit viewport');
  if(height<500){const hand=await a.page.locator('.own-hand .playing-card').first().boundingBox(),slot=await a.page.locator('.own-drop-slot').first().boundingBox();assert.ok(hand.height>=40,'landscape hand remains usable');assert.ok(slot.height>=40,'landscape field remains usable');const zone=await a.page.locator('.own-zone').boundingBox();for(const card of await a.page.locator('.own-hand .playing-card').all()){const box=await card.boundingBox();assert.ok(box.x>=zone.x-2&&box.x+box.width<=zone.x+zone.width+2,'landscape fan stays inside its zone');}}
  await a.page.screenshot({path:`artifacts/deadlines/layout-${width}x${height}.png`,fullPage:true});checks.push(`${width}x${height}`);
 }
 await expect(a.page.locator('.online-turn-timer.urgent')).toBeVisible({timeout:15000});assert.ok(parseInt(await a.page.getByTestId('turn-seconds').innerText())<=5);await a.page.screenshot({path:'artifacts/deadlines/urgent-countdown.png',fullPage:true});
 const current=await call(a.page,'/duels/'+g.duelId);await call(a.page,'/duels/'+g.duelId+'/abandon',{expectedVersion:current.version,requestId:randomUUID()});
 await expect(a.page.getByTestId('match-outcome')).toHaveText('Derrota');await a.page.getByRole('button',{name:'Ver tablero',exact:true}).click();assert.ok((await a.page.locator('.arena-workspace').boundingBox()).height>=150,'finished board keeps its grid height');
 await writeFile('artifacts/deadlines/layout-results.json',JSON.stringify({date:new Date().toISOString(),game:g.duelId,checks,passed:checks.length,urgentLastFiveSeconds:true,landscapeCardsAtLeast40px:true,finishedGridPreserved:true},null,2));console.log('PASS timer legible y últimos cinco segundos resaltados, paneles sin solapamiento, cartas landscape, acciones y tablero final: '+checks.join(', '));
}finally{await browser.close();}
