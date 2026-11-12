import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {mkdir} from 'node:fs/promises';
import {selectFixturePlayers} from './player-fixtures';
async function fixture(request:any){
 const catalog=(await(await request.get('/api/catalog')).json()).cards;
 const entries=catalog.slice(0,10).map((c:{id:string})=>({cardId:c.id,quantity:2}));
 const players=[],decks=[];
 for(let i=0;i<2;i++){
  const p=await(await request.post('/api/players',{data:{alias:`test-restart-${i}-${randomUUID().slice(0,8)}`}})).json();players.push(p);
  const saved=await request.post('/api/decks',{data:{ownerId:p.id,name:'Mazo reinicio',entries}});expect(saved.status()).toBe(201);decks.push(await saved.json());
 }
 const input={playerIds:players.map(p=>p.id),deckIds:decks.map(d=>d.id),requestId:randomUUID()};
 const response=await request.post('/api/duels',{data:input});expect(response.status()).toBe(201);
 return {players,input,old:await response.json()};
}
test('restart is atomic, preserves history, rejects invalid decks and replays without closing the new game',async({request})=>{
 const f=await fixture(request),before=await(await request.get(`/api/duels/${f.old.id}`)).json();
 const invalid=await request.post('/api/duels',{data:{...f.input,requestId:randomUUID(),replaceActive:true,deckIds:['4294967295',f.input.deckIds[1]]}});expect(invalid.status()).toBe(403);
 expect(await(await request.get(`/api/duels/${f.old.id}`)).json()).toEqual(before);
 const input={...f.input,requestId:randomUUID(),replaceActive:true};
 const responses=await Promise.all([request.post('/api/duels',{data:input}),request.post('/api/duels',{data:input})]);
 expect(responses.map(r=>r.status()).sort()).toEqual([200,201]);const states=await Promise.all(responses.map(r=>r.json()));expect(states[0].id).toBe(states[1].id);
 const current=states[0];expect(current.id).not.toBe(f.old.id);expect(current.turn).toBe(1);
 expect(current.players.map((p:{hand:unknown[];deckCount:number})=>[p.hand.length,p.deckCount])).toEqual([[3,17],[3,17]]);
 const closed=await(await request.get(`/api/duels/${f.old.id}`)).json();expect(closed.status).toBe('finished');expect(closed.result.reason).toBe('REINICIO');expect(closed.winnerId).toBeNull();expect(closed.players).toEqual(before.players);expect(closed.history).toEqual(before.history);
 const replay=await request.post('/api/duels',{data:input});expect(replay.status()).toBe(200);expect((await replay.json()).status).toBe('active');
 const active=await(await request.get(`/api/players/${f.players[0].id}/duels`)).json();expect(active.duels.map((d:{id:string})=>d.id)).toEqual([current.id]);
});
test('Jugar offers continue or restart, cancel changes nothing and lost response retries the same new game',async({page,request})=>{
 await page.addInitScript(()=>localStorage.setItem('truco-arena:play-mode','local'));
 const f=await fixture(request);await selectFixturePlayers(page,f.players);await page.goto('/#/jugar');
 await expect(page.getByRole('link',{name:new RegExp(`Continuar partida #${f.old.id}`)})).toBeVisible();
 await page.getByRole('button',{name:'Empezar de cero',exact:true}).click();const popup=page.getByRole('dialog',{name:'¿Empezar de cero?'});
 await popup.getByRole('button',{name:'Cancelar',exact:true}).click();expect((await(await request.get(`/api/duels/${f.old.id}`)).json()).status).toBe('active');
 let submitted:any,newId='';
 await page.route('**/api/duels',async route=>{submitted=route.request().postDataJSON();const response=await route.fetch();expect(response.status()).toBe(201);newId=(await response.json()).id;await route.abort('failed');},{times:1});
 await page.getByRole('button',{name:'Empezar de cero',exact:true}).click();await mkdir('artifacts/restart',{recursive:true});await popup.screenshot({path:'artifacts/restart/confirmar-reinicio.png'});
 await popup.getByRole('button',{name:'Empezar de cero',exact:true}).click();await expect(page.getByRole('button',{name:'Reintentar inicio pendiente',exact:true})).toBeVisible();
 expect(submitted.replaceActive).toBe(true);await page.reload();
 const response=page.waitForResponse(r=>r.url().endsWith('/api/duels')&&r.request().method()==='POST');await page.getByRole('button',{name:'Reintentar inicio pendiente',exact:true}).click();
 const replay=await response;expect(replay.request().postDataJSON()).toEqual(submitted);expect(replay.status()).toBe(200);expect((await replay.json()).id).toBe(newId);
 await expect(page).toHaveURL(new RegExp(`partida=${newId}`));expect((await(await request.get(`/api/duels/${newId}`)).json()).status).toBe('active');
 expect((await(await request.get(`/api/duels/${f.old.id}`)).json()).result.reason).toBe('REINICIO');
});

test('restart closes both selected profiles matches and leaves unrelated matches active',async({request})=>{
 const a=await fixture(request),b=await fixture(request),unrelated=await fixture(request);
 const response=await request.post('/api/duels',{data:{playerIds:[a.players[0].id,b.players[0].id],deckIds:[a.input.deckIds[0],b.input.deckIds[0]],requestId:randomUUID(),replaceActive:true}});
 expect(response.status()).toBe(201);
 for(const old of [a.old,b.old])expect((await(await request.get(`/api/duels/${old.id}`)).json()).result.reason).toBe('REINICIO');
 expect((await(await request.get(`/api/duels/${unrelated.old.id}`)).json()).status).toBe('active');
});
