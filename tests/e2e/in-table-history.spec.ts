import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

test('history stays inside the full-width table, scrolls independently and help opens in a modal',async({page,request})=>{
 await page.setViewportSize({width:1440,height:900});
 const response=await request.post('/api/duels',{data:{scenario:'inicio',deckIds:['espadas-20','copas-20']}});
 const fixture=await response.json();fixture.log=Array.from({length:60},(_,i)=>`Movimiento ${i+1}: una carta fue invocada y el rival preparó su siguiente jugada.`);
 fixture.players.forEach((p:any,index:number)=>{p.field=[{...p.hand[0],id:`field-${index}`,enteredTurn:0}];});
 await page.route('**/api/duels',route=>route.fulfill({json:fixture}));
 await page.route('**/api/duels/*/actions',route=>{
  fixture.version++;fixture.turn+=2;fixture.log.push(`Nuevo movimiento ${fixture.version}`);
  return route.fulfill({json:fixture});
 });
 await page.goto('/#/jugar');await page.getByRole('button',{name:'Jugar contra la PC',exact:true}).click();
 const table=page.locator('.battle-table'),history=table.locator('.in-table-history'),log=page.getByRole('list',{name:'Movimientos recientes'});
 await expect(history).toBeVisible();await expect(page.locator('.quick-rules')).toHaveCount(0);
 const before=await history.boundingBox(),tableBox=await table.boundingBox(),layout=await page.locator('.arena-layout').boundingBox();
 expect(tableBox!.width).toBeCloseTo(layout!.width,0);
 expect(before!.x).toBeGreaterThanOrEqual(tableBox!.x);expect(before!.x+before!.width).toBeLessThanOrEqual(tableBox!.x+tableBox!.width);
 const scrolling=await log.evaluate(el=>({height:el.clientHeight,scroll:el.scrollHeight,top:el.scrollTop}));
 expect(scrolling.scroll).toBeGreaterThan(scrolling.height);expect(scrolling.top).toBeGreaterThan(0);
 await log.evaluate(el=>{el.scrollTop=0;el.dispatchEvent(new Event('scroll'));});
 await page.getByRole('button',{name:'Finalizar turno',exact:true}).click();
 await expect(log.locator('li').last()).toContainText('Nuevo movimiento');
 expect(await log.evaluate(el=>el.scrollTop)).toBe(0);
 const after=await history.boundingBox();expect(after!.height).toBeCloseTo(before!.height,0);
 const pile=await page.locator('.draw-pile-stack').first().boundingBox();expect(pile!.width).toBeGreaterThanOrEqual(20);
 await mkdir('artifacts/arena-focus',{recursive:true});await page.screenshot({path:'artifacts/arena-focus/bitacora-dentro.png'});
 const trigger=page.getByRole('button',{name:'Cómo jugar',exact:true});await trigger.click();
 const dialog=page.getByRole('dialog',{name:'Cómo jugar',exact:true});await expect(dialog).toBeVisible();
 await expect(dialog).toContainText('daño simultáneamente');await expect(dialog).toContainText('turno global 30');
 await expect(dialog).not.toContainText(/B1[–—-]B4|pendientes de aprobación|PostgreSQL|MariaDB|simulación en memoria/);
 await page.screenshot({path:'artifacts/arena-focus/como-jugar.png'});
 await page.getByRole('button',{name:'Volver al juego',exact:true}).click();await expect(dialog).toHaveCount(0);await expect(trigger).toBeFocused();
 await trigger.click();await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
});

test('help can be read while the PC waits and its turn resumes on close',async({page})=>{
 let commands=0;page.on('request',request=>{if(request.method()==='POST'&&request.url().endsWith('/actions'))commands++;});
 await page.goto('/#/jugar');await page.getByRole('button',{name:'Jugar contra la PC',exact:true}).click();
 await page.getByRole('button',{name:'Finalizar turno',exact:true}).click();
 await expect(page.locator('.computer-thinking')).toBeVisible();
 await page.getByRole('button',{name:'Cómo jugar',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'Cómo jugar',exact:true})).toBeVisible();
 const before=commands;await page.waitForTimeout(1600);expect(commands).toBe(before);
 await page.getByRole('button',{name:'Volver al juego',exact:true}).click();
 await expect(page.getByRole('button',{name:'Finalizar turno',exact:true})).toBeEnabled({timeout:15000});
 expect(commands).toBeGreaterThan(before);
});
