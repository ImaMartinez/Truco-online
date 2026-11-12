import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
test.beforeEach(async ({page})=>{await page.addInitScript(()=>localStorage.setItem('truco-arena:play-mode','local'));});
import { randomUUID } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import type { Card, DuelAction, DuelState } from '../../shared/contracts';
import {observeCombatEffects} from '../combat-effects';

async function fixture(request: APIRequestContext) {
  const catalog = JSON.parse(await readFile(new URL('../../backend/src/demo/catalog.json',import.meta.url),'utf8')).cards as Card[];
  const entries = catalog.filter(c=>c.cost===1).slice(0,6).map(c=>({cardId:c.id,quantity:2}));
  expect(entries).toHaveLength(6);
  const players=[],decks=[];
  for(const alias of [`Combate Ana ${randomUUID().slice(0,8)}`,`Combate Bruno ${randomUUID().slice(0,8)}`]) {
    const profile=await request.post('/api/players',{data:{alias}});expect(profile.status()).toBe(201);const player=await profile.json();players.push(player);
    const deck=await request.post('/api/decks',{data:{ownerId:player.id,name:'Mazo combate navegador',entries}});expect(deck.status()).toBe(201);decks.push(await deck.json());
  }
  const started=await request.post('/api/duels',{data:{scenario:'inicio',playerIds:players.map(p=>p.id),deckIds:decks.map(d=>d.id),requestId:randomUUID()}});expect(started.status()).toBe(201);
  return {state:await started.json() as DuelState,catalog};
}

async function command(page:Page,state:DuelState,action:DuelAction):Promise<DuelState> {
  const response=page.waitForResponse(r=>r.url().endsWith(`/api/duels/${state.id}/actions`)&&r.request().method()==='POST');
  if(action.type==='play') await page.locator(`.own-hand [data-instance-id="${action.instanceId}"]`).click();
  if(action.type==='attack') await page.locator(`.own-field [data-instance-id="${action.attackerId}"]`).click();
  if(action.type==='play') await page.getByRole('button',{name:'Invocar carta',exact:true}).click();
  else if(action.type==='attack') {
    if(action.targetId!=='hero') await page.locator(`.enemy-field [data-instance-id="${action.targetId}"]`).click();
  } else await page.getByRole('button',{name:'Finalizar turno',exact:true}).click();
  const result=await response;expect(result.status()).toBe(200);return await result.json() as DuelState;
}

test('partida completa SQL desde el tablero: invocar, combatir, descartes, daño al héroe, victoria y recuperación',async({page,request})=>{
  test.setTimeout(90_000);
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  const f=await fixture(request);let state=f.state;const aggressor=state.activePlayerId;
  await page.goto(`/#/arena?partida=${state.id}`);
  await page.getByRole('button',{name:'Estoy listo para jugar'}).click();
  await observeCombatEffects(page);
  let cardAttacks=0,heroAttacks=0,invocations=0,discardSeen=false;
  // Both players make legal decisions using only the confirmed SQL DTO.
  // Position 2 summons once, then passes; position 1 clears that card and wins.
  while(state.status==='active') {
    let actor=state.players.find(p=>p.id===state.activePlayerId)!;
    if(state.activePlayerId===aggressor || state.turn===2) {
      while(actor.energy>0&&actor.field.length<3&&actor.hand.length&&(state.activePlayerId===aggressor||actor.field.length===0)) {
        const instance=actor.hand[0]!;
        state=await command(page,state,{type:'play',instanceId:instance.id});invocations++;
        await expect(page.locator(`.own-field [data-instance-id="${instance.id}"]`)).toBeVisible();
        await expect(page.locator(`.own-field [data-instance-id="${instance.id}"]`)).toBeDisabled();
        actor=state.players.find(p=>p.id===state.activePlayerId)!;
      }
    }
    if(state.activePlayerId===aggressor) {
      const ready=actor.field.filter(c=>c.enteredTurn<state.turn&&c.lastAttackTurn!==state.turn).map(c=>c.id);
      for(const attackerId of ready) {
        if(state.status==='finished') break;
        const rival=state.players.find(p=>p.id!==state.activePlayerId)!;
        const targetId=rival.field[0]?.id??'hero';
        state=await command(page,state,{type:'attack',attackerId,targetId});
        if(targetId==='hero') heroAttacks++;else cardAttacks++;
        discardSeen ||= state.players.some(p=>p.discardCount>0);
      }
    }
    if(state.status==='active') {
      state=await command(page,state,{type:'endTurn'});
      await expect(page.getByRole('region',{name:'Cambio de jugador'})).toBeVisible();
      await expect(page.locator('.own-hand')).toHaveCount(0);
      await page.getByRole('button',{name:'Estoy listo para jugar'}).click();
    }
  }
  expect(invocations).toBeGreaterThan(1);expect(cardAttacks).toBeGreaterThan(0);expect(heroAttacks).toBeGreaterThan(0);expect(discardSeen).toBe(true);
  expect(state.winnerId).toBe(aggressor);expect(state.result?.reason).toBe('VIDA_CERO');
  await expect(page.locator('.result-panel')).toContainText('se lleva la mesa.');
  await expect(page.getByText('Victoria inmediata por vida cero.',{exact:true})).toBeVisible();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button',{name:'Ver tablero',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Cartas eliminadas'})).toBeVisible();
  await page.getByText(/Historial completo \(/).click();
  await expect(page.locator('.complete-history ol')).toBeVisible();
  const confirmed=await (await request.get(`/api/duels/${state.id}`)).json();
  const effects=await page.evaluate(()=>(window as any).__combatEffects);
  expect(effects.stages).toContain('lunge');expect(effects.stages).toContain('elimination');
  expect(effects.damage.some((event:string)=>event.startsWith('hero:'))).toBe(true);expect(effects.deaths.length).toBeGreaterThan(0);
  await page.reload();
  await expect(page.locator('.result-panel')).toContainText('se lleva la mesa.');
  const recovered=await (await request.get(`/api/duels/${state.id}`)).json();
  expect(recovered).toEqual(confirmed);expect(recovered.history.length).toBe(invocations+cardAttacks+heroAttacks);
  await expect(page.locator('.rival-hand [data-card-id]')).toHaveCount(0);
  await mkdir('artifacts/persistence',{recursive:true});await page.screenshot({path:'artifacts/persistence/combate-sql-victoria.png',fullPage:true});
  expect(errors).toEqual([]);
});

test('invocación y ataque SQL con respuesta perdida se recuperan con la misma solicitud tras recargar',async({page,request})=>{
  const f=await fixture(request);let state=f.state;
  await page.goto(`/#/arena?partida=${state.id}`);await page.getByRole('button',{name:'Estoy listo para jugar'}).click();
  const actor=state.players.find(p=>p.id===state.activePlayerId)!;const instance=actor.hand[0]!;
  let lostInput:any;
  async function loseNextResponse() {
    await page.route(`**/api/duels/${state.id}/actions`,async route=>{
      lostInput=route.request().postDataJSON();const r=await route.fetch();expect(r.status()).toBe(200);state=await r.json();await route.abort('failed');
    },{times:1});
  }
  async function retryAfterReload() {
    await expect(page.getByRole('button',{name:'Reintentar jugada pendiente',exact:true})).toBeVisible();
    await page.reload();
    await observeCombatEffects(page);
    const retryResponse=page.waitForResponse(r=>r.url().endsWith(`/api/duels/${state.id}/actions`));
    await page.getByRole('button',{name:'Reintentar jugada pendiente',exact:true}).click();
    const retry=await retryResponse;expect(retry.request().postDataJSON()).toEqual(lostInput);const result=await retry.json();expect(result.operation.replayed).toBe(true);expect(result.version).toBe(state.version);state=result;
    await expect(page.locator('.own-hand')).toBeVisible();
    expect(await page.evaluate(()=>(window as any).__combatEffects.stages)).toEqual([]);
  }
  await loseNextResponse();
  await page.locator(`.own-hand [data-instance-id="${instance.id}"]`).click();await page.getByRole('button',{name:'Invocar carta',exact:true}).click();
  await retryAfterReload();expect(state.players.find(p=>p.id===actor.id)!.field.filter(c=>c.id===instance.id)).toHaveLength(1);
  for(let i=0;i<2;i++) {state=await command(page,state,{type:'endTurn'});await page.getByRole('button',{name:'Estoy listo para jugar'}).click();}
  const before=state.players.find(p=>p.id!==actor.id)!.life;
  await loseNextResponse();
  await page.locator(`.own-field [data-instance-id="${instance.id}"]`).click();
  await retryAfterReload();
  const damage=f.catalog.find(c=>c.id===instance.cardId)!.attack;
  expect(state.players.find(p=>p.id!==actor.id)!.life).toBe(before-damage);
  expect(state.history?.filter(e=>e.type==='attack')).toHaveLength(1);
  await expect(page.locator(`.own-field [data-instance-id="${instance.id}"]`)).toBeDisabled();
});
