import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {mkdir} from 'node:fs/promises';
import {selectFixturePlayers} from './player-fixtures';

test('SQL Jugar starts the twenty-card format and retains all forty initial copies',async({page,request})=>{
 const cards=(await(await request.get('/api/catalog')).json()).cards;
 const entries=cards.slice(0,10).map((c:{id:string})=>({cardId:c.id,quantity:2}));
 const players=[],decks=[];
 for(let i=0;i<2;i++){
  const p=await(await request.post('/api/players',{data:{alias:`test-twenty-${i}-${randomUUID().slice(0,8)}`}})).json();players.push(p);
  const d=await request.post('/api/decks',{data:{ownerId:p.id,name:'Mazo de veinte',entries}});expect(d.status()).toBe(201);decks.push(await d.json());
 }
 await selectFixturePlayers(page,players);await page.goto('/#/jugar');
 await expect(page.getByLabel('Mazo del jugador 1',{exact:true})).toHaveValue(decks[0].id);
 await expect(page.getByLabel('Mazo del jugador 2',{exact:true})).toHaveCount(0);
 const generatedResponse=page.waitForResponse(r=>r.url().endsWith('/api/decks')&&r.request().method()==='POST');
 const response=page.waitForResponse(r=>r.url().endsWith('/api/duels')&&r.request().method()==='POST');await page.getByRole('button',{name:'Jugar contra la PC',exact:true}).click();
 const generated=await(await generatedResponse).json();expect(generated.ownerId).toBe(players[1].id);expect(generated.id).not.toBe(decks[1].id);
 expect(generated.entries.reduce((n:number,e:{quantity:number})=>n+e.quantity,0)).toBe(20);
 expect(generated.entries.every((e:{quantity:number})=>e.quantity<=2)).toBe(true);
 const started=await response;expect(started.status()).toBe(201);const state=await started.json();
 expect(state.players.map((p:{hand:unknown[];deckCount:number})=>[p.hand.length,p.deckCount])).toEqual([[3,17],[3,17]]);
 await expect(page.locator('.battle-table')).toBeVisible();await expect(page.locator('.turn-curtain')).toHaveCount(0);
 // Automatic SQL decks remain linked to match history, but never enter the personal directory.
 await page.goto('/#/mazos');
 await page.getByLabel('Propietario del mazo',{exact:true}).selectOption(players[1].id);
 await expect(page.getByText(generated.name,{exact:true})).toHaveCount(0);
 await expect(page.getByText('Mazo de veinte',{exact:true})).toBeVisible();
 await page.reload();
 await page.getByLabel('Propietario del mazo',{exact:true}).selectOption(players[1].id);
 await expect(page.getByText(generated.name,{exact:true})).toHaveCount(0);
 const stored=(await(await request.get(`/api/decks?ownerId=${players[1].id}`)).json()).decks;
 expect(stored.some((deck:{id:string})=>deck.id===generated.id)).toBe(true);
 expect((await request.get(`/api/duels/${state.id}`)).status()).toBe(200);
});

for(const difficulty of ['facil','normal','dificil'])test(`SQL PC ${difficulty}: setup, actions, fixed hand and recovery`,async({page,request})=>{
 test.setTimeout(60000);
 const catalog=(await(await request.get('/api/catalog')).json()).cards;
 const entries=[...catalog].sort((a:{cost:number},b:{cost:number})=>a.cost-b.cost).slice(0,10).map((c:{id:string})=>({cardId:c.id,quantity:2}));
 const players=[],decks=[];
 for(let i=0;i<2;i++){
  const response=await request.post('/api/players',{data:{alias:`test-cpu-${i}-${randomUUID().slice(0,8)}`}});expect(response.status()).toBe(201);const p=await response.json();players.push(p);
  const saved=await request.post('/api/decks',{data:{ownerId:p.id,name:`Mazo PC ${difficulty}`,entries}});expect(saved.status()).toBe(201);decks.push(await saved.json());
 }
 await selectFixturePlayers(page,players);await page.goto('/#/jugar');
 await page.getByLabel('Dificultad',{exact:true}).selectOption(difficulty);
 await page.getByLabel('Mazo del jugador 1',{exact:true}).selectOption(decks[0].id);
 await mkdir('artifacts/computer',{recursive:true});
 if(difficulty==='dificil')await page.screenshot({path:'artifacts/computer/jugar-sql.png',fullPage:true});
 const starting=page.waitForResponse(r=>r.url().endsWith('/api/duels')&&r.request().method()==='POST');await page.getByRole('button',{name:'Jugar contra la PC',exact:true}).click();const state=await(await starting).json();
 await expect(page.locator('.battle-table')).toBeVisible();await expect(page.locator('.turn-curtain')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Finalizar turno',exact:true})).toBeEnabled({timeout:15000});
 await page.getByRole('button',{name:'Finalizar turno',exact:true}).click();
 await expect(page.getByRole('button',{name:'Finalizar turno',exact:true})).toBeEnabled({timeout:18000});
 const opening=await(await request.get(`/api/duels/${state.id}`)).json();expect(opening.activePlayerId).toBe(players[0].id);
 await page.locator('.own-hand .playing-card').first().click();await page.getByRole('button',{name:'Invocar carta',exact:true}).click();
 await expect(page.locator('.own-field .playing-card')).toHaveCount(1);
 await page.getByRole('button',{name:'Finalizar turno',exact:true}).click();await expect(page.locator('.computer-thinking')).toBeVisible();
 if(difficulty==='dificil')await page.reload();
 await expect.poll(async()=>{const d=await(await request.get(`/api/duels/${state.id}`)).json();return d.turn;},{timeout:18000}).toBe(opening.turn+2);
 await expect(page.getByRole('button',{name:'Finalizar turno',exact:true})).toBeEnabled();
 const snapshot=await(await request.get(`/api/duels/${state.id}`)).json();expect(snapshot.version).toBeGreaterThanOrEqual(opening.version+2);
 expect(snapshot.activePlayerId).toBe(players[0].id);
 const pcInvocations=snapshot.history.filter((event:{actorId:string;type:string})=>event.actorId===players[1].id&&event.type==='play');
 expect(new Set(pcInvocations.map((event:{instanceId:string})=>event.instanceId)).size).toBe(pcInvocations.length);
 await expect(page.locator('.own-summary .player-identity strong')).toHaveText(players[0].alias);
 await expect(page.locator('.turn-curtain')).toHaveCount(0);
 if(difficulty==='dificil'){
  expect(await page.evaluate(id=>JSON.parse(localStorage.getItem(`truco-arena:opponent:${id}`)!).difficulty,state.id)).toBe('dificil');
  await page.getByRole('button',{name:'Finalizar turno',exact:true}).click();
  await expect.poll(async()=>{const d=await(await request.get(`/api/duels/${state.id}`)).json();return d.turn;},{timeout:20000}).toBe(opening.turn+4);
  const after=await(await request.get(`/api/duels/${state.id}`)).json();expect(after.activePlayerId).toBe(players[0].id);
  await page.screenshot({path:'artifacts/computer/tablero-sql-pc.png',fullPage:true});
 }
});
