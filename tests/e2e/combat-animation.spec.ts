import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {observeCombatEffects} from '../combat-effects';

test('confirmed combat animates lunge, simultaneous damage and elimination without changing API results',async({page,request})=>{
 await page.addInitScript(()=>localStorage.setItem('truco-arena:play-mode','local'));
 await page.setViewportSize({width:1480,height:1400});await page.goto('/');
 const starting=page.waitForResponse(r=>r.url().endsWith('/api/duels')&&r.request().method()==='POST');
 await page.getByRole('button',{name:'Entrar a la arena',exact:true}).click();const before=await(await starting).json();
 await page.getByRole('button',{name:'Estoy listo para jugar',exact:true}).click();
 await observeCombatEffects(page);
 const actor=before.players.find((p:{id:string})=>p.id===before.activePlayerId),rival=before.players.find((p:{id:string})=>p.id!==actor.id);
 await page.locator(`.own-field [data-instance-id="${actor.field[0].id}"]`).click();
 const response=page.waitForResponse(r=>r.url().endsWith('/actions')&&r.request().method()==='POST');
 await page.locator(`.enemy-field [data-instance-id="${rival.field[0].id}"]`).click();const after=await(await response).json();
 await expect(page.locator('[data-combat-animation="attack"]')).toBeVisible();
 await expect(page.locator('.combat-damage').first()).toBeVisible();
 expect(await page.locator('.combat-damage').first().evaluate(el=>el.getAnimations().length)).toBeGreaterThan(0);
 await mkdir('artifacts/combat-effects',{recursive:true});await page.screenshot({path:'artifacts/combat-effects/impacto.png'});
 await expect(page.locator('[data-combat-animation]')).toHaveCount(0);
 const events=await page.evaluate(()=>(window as any).__combatEffects);
 expect(events.stages).toEqual(['lunge','impact','elimination']);
 const survivors=new Set(after.players.flatMap((p:{field:{id:string}[]})=>p.field.map(c=>c.id)));
 const dead=before.players.flatMap((p:{field:{id:string}[]})=>p.field).filter((c:{id:string})=>!survivors.has(c.id));expect(dead.length).toBeGreaterThan(0);
 for(const card of dead){expect(events.deaths).toContain(card.id);await expect(page.locator(`.battle-table [data-instance-id="${card.id}"]`)).toHaveCount(0);}
 expect(events.damage.length).toBeGreaterThan(0);
 const persisted=await(await request.get(`/api/duels/${before.id}`)).json();expect(persisted.version).toBe(after.version);expect(persisted.players).toEqual(after.players);
});

test('reduced motion skips the combat overlay while still applying the confirmed result',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.addInitScript(()=>localStorage.setItem('truco-arena:play-mode','local'));
 await page.goto('/');const starting=page.waitForResponse(r=>r.url().endsWith('/api/duels')&&r.request().method()==='POST');await page.getByRole('button',{name:'Entrar a la arena',exact:true}).click();const state=await(await starting).json();
 await page.getByRole('button',{name:'Estoy listo para jugar',exact:true}).click();await observeCombatEffects(page);
 await page.locator('.own-field .playing-card').first().click();await page.locator('.enemy-field .playing-card').first().click();
 await expect(page.getByRole('button',{name:'Finalizar turno',exact:true})).toBeEnabled();
 await expect(page.locator('[data-combat-animation]')).toHaveCount(0);
 expect(await page.evaluate(()=>(window as any).__combatEffects.stages)).toEqual([]);
 await expect(page.locator('.table-topline')).toContainText(String(state.turn));
});
