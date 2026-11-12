import {chromium,expect} from '@playwright/test';
import {existsSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:5173',headers={Origin:base};const browser=await chromium.launch({channel:existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe')?'chrome':'msedge'});
const contexts=[],results=[];
const post=(p,path,data)=>p.request.post(base+'/api'+path,{headers,data});
const get=async(p,path)=>(await p.request.get(base+'/api'+path)).json();
try{
 const people=[];
 for(const label of ['a','b','limited']){const context=await browser.newContext({permissions:['clipboard-read','clipboard-write']});contexts.push(context);const p=await context.newPage();const r=await post(p,'/profile',{alias:'qa-sync-'+label+'-'+randomUUID().slice(0,8)});assert.ok(r.ok());const profile=(await r.json()).profile;const catalog=(await get(p,'/catalog')).cards;const deck=await(await post(p,'/decks',{name:'Sync 12',entries:catalog.slice(0,6).map(c=>({cardId:c.id,quantity:2}))})).json();people.push({p,profile,deck});}
 const [a,b,c]=people;const room=await(await post(a.p,'/rooms',{deckId:a.deck.id,requestId:randomUUID()})).json();assert.ok(room.id);await a.p.goto(base+'/#/sala?id='+room.id);await expect(a.p.getByTestId('room-code')).toHaveText(room.code);await a.p.getByRole('button',{name:'Copiar código',exact:true}).click();await expect(a.p.getByRole('button',{name:'Código copiado',exact:true})).toBeVisible();assert.equal(await a.p.evaluate(()=>navigator.clipboard.readText()),room.code);
 await a.p.setViewportSize({width:390,height:844});assert.equal(await a.p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await mkdir('artifacts/online',{recursive:true});await a.p.screenshot({path:'artifacts/online/sala-mobile.png',fullPage:true});await a.p.setViewportSize({width:1440,height:900});results.push('código copiado realmente y sala móvil sin desborde');
 const joined=await(await post(b.p,'/rooms/join',{code:room.code,deckId:b.deck.id,requestId:randomUUID()})).json();const id=joined.duelId;assert.ok(id);await b.p.goto(base+'/#/arena?partida='+id);for(const p of [a.p,b.p])await expect(p.locator('.battle-table')).toHaveAttribute('data-version','1');
 let release,held;const heldPromise=new Promise(r=>held=r),releasePromise=new Promise(r=>release=r);let once=false;
 await a.p.route(`**/api/duels/${id}`,async route=>{
  const response=await route.fetch();if(!once&&route.request().method()==='GET'){once=true;held();await releasePromise;}
  await route.fulfill({response}).catch(()=>{});
 });
 await heldPromise;await a.p.getByRole('button',{name:'Finalizar turno',exact:true}).click();await expect(a.p.locator('.battle-table')).toHaveAttribute('data-version','2');release();await a.p.waitForTimeout(600);await expect(a.p.locator('.battle-table')).toHaveAttribute('data-version','2');await a.p.unroute(`**/api/duels/${id}`);await expect(b.p.locator('.battle-table')).toHaveAttribute('data-version','2');results.push('respuesta HTTP real antigua retrasada no revierte una versión más reciente');
 const commands=await Promise.all([post(b.p,'/duels/'+id+'/actions',{expectedVersion:2,requestId:randomUUID(),action:{type:'endTurn'}}),post(b.p,'/duels/'+id+'/actions',{expectedVersion:2,requestId:randomUUID(),action:{type:'endTurn'}})]);assert.deepEqual(commands.map(r=>r.status()).sort(),[200,409]);assert.equal((await get(a.p,'/duels/'+id)).version,3);for(const p of [a.p,b.p])await expect(p.locator('.battle-table')).toHaveAttribute('data-version','3');results.push('dos comandos diferentes sobre una versión: uno gana y ambos tableros convergen');
 await expect(a.p.locator('.in-table-history > .arena-info').first()).toHaveCSS('display','flex');await a.p.screenshot({path:'artifacts/online/tablero-anfitrion.png',fullPage:true});await b.p.setViewportSize({width:1440,height:900});await b.p.screenshot({path:'artifacts/online/tablero-invitado.png',fullPage:true});
 for(let i=0;i<10;i++)assert.equal((await post(c.p,'/rooms/lookup',{code:'ZZZZ-ZZZZ'})).status(),404);assert.equal((await post(c.p,'/rooms/lookup',{code:'ZZZZ-ZZZZ'})).status(),429);results.push('límite SQL de búsquedas verificado mediante HTTP real');
 assert.equal((await get(a.p,'/duels/'+id+'?viewerPlayerId='+b.profile.id)).viewerPlayerId,a.profile.id);results.push('cambiar viewerPlayerId en URL no cambia la identidad ni muestra la mano rival');
 await writeFile('artifacts/online/sync-results.json',JSON.stringify({date:new Date().toISOString(),game:id,project:'gjcpcbrkdjymrwktshfr',tests:results,passed:results.length},null,2));console.log('PASS '+results.join('; '));
}finally{await browser.close();}
