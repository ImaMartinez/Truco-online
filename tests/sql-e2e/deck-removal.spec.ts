import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {mkdir} from 'node:fs/promises';
import {selectFixturePlayers} from './player-fixtures';

test('confirmed deck removal enforces owner, preserves used match history and stays removed after reload',async({page,request})=>{
 const players=[],decks=[];const entries=['ESP-01','ESP-02','ESP-03','ESP-04','ESP-05','ESP-06'].map(cardId=>({cardId,quantity:2}));
 for(let i=0;i<2;i++){
  const p=await (await request.post('/api/players',{data:{alias:`test-delete-${i}-${randomUUID().slice(0,8)}`}})).json();players.push(p);
  const d=await request.post('/api/decks',{data:{ownerId:p.id,name:`Histórico ${i}`,entries}});expect(d.status()).toBe(201);decks.push(await d.json());
 }
 const input={playerIds:players.map(p=>p.id),deckIds:decks.map(d=>d.id),requestId:randomUUID()};
 const started=await request.post('/api/duels',{data:input});expect(started.status()).toBe(201);const state=await started.json();
 const temporary=await (await request.post('/api/decks',{data:{ownerId:players[0].id,name:'Descartable',entries}})).json();
 expect((await request.delete(`/api/decks/${temporary.id}?ownerId=${players[1].id}`)).status()).toBe(403);
 expect((await request.delete(`/api/decks/${temporary.id}`)).status()).toBe(400);
 await selectFixturePlayers(page,players);await page.goto('/#/mazos');
 const remove=page.getByRole('button',{name:'Eliminar mazo Descartable',exact:true});await remove.click();
 const popup=page.getByRole('dialog',{name:'¿Eliminar este mazo?'});
 await expect(popup.getByRole('button',{name:'Cancelar',exact:true})).toBeFocused();
 await page.keyboard.press('Escape');await expect(popup).toHaveCount(0);await expect(remove).toBeVisible();
 await remove.click();await popup.getByRole('button',{name:'Eliminar mazo',exact:true}).click();await expect(remove).toHaveCount(0);
 // An unused deck is deleted, so its name can immediately be used again.
 expect((await request.post('/api/decks',{data:{ownerId:players[0].id,name:'Descartable',entries}})).status()).toBe(201);
 await page.getByRole('button',{name:'Eliminar mazo Histórico 0',exact:true}).click();
 await expect(popup).toContainText('historial');await mkdir('artifacts/deck-tools',{recursive:true});
 await popup.screenshot({path:'artifacts/deck-tools/confirmar-eliminacion.png'});
 await popup.getByRole('button',{name:'Eliminar mazo',exact:true}).click();
 await expect(page.getByRole('button',{name:'Eliminar mazo Histórico 0',exact:true})).toHaveCount(0);
 const recovered=await request.get(`/api/duels/${state.id}`);expect(recovered.status()).toBe(200);
 const {operation: _receipt,...expected}=state;expect(await recovered.json()).toMatchObject(expected);
 let final=state;
 while(final.status==='active') {
   const next=await request.post(`/api/duels/${state.id}/actions`,{data:{actorId:final.activePlayerId,expectedVersion:final.version,requestId:randomUUID(),action:{type:'endTurn'}}});
   expect(next.status()).toBe(200);final=await next.json();
 }
 expect((await request.post('/api/duels',{data:{...input,requestId:randomUUID()}})).status()).toBe(403);
 await page.reload();await expect(page.getByLabel('Propietario del mazo')).toBeVisible();await expect(page.getByRole('button',{name:'Eliminar mazo Histórico 0',exact:true})).toHaveCount(0);
 const ownerDecks=(await (await request.get(`/api/decks?ownerId=${players[1].id}`)).json()).decks;expect(ownerDecks.map((d:{id:string})=>d.id)).toContain(decks[1].id);
});
