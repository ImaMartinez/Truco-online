import {test,expect} from '@playwright/test';

test('confirmed draws fly from the right-hand pile, update counters and keep rival cards hidden',async({page,request})=>{
 await page.goto('/#/jugar');await page.getByRole('button',{name:'Jugar contra la PC',exact:true}).click();
 await expect(page.locator('.battle-table')).toBeVisible();
 await expect(page.locator('.draw-pile')).toHaveCount(2);
 await expect(page.locator('[data-draw-pile="jugador-1"] strong')).toHaveText('17');
 await expect(page.locator('[data-draw-pile="jugador-2"] strong')).toHaveText('17');
 await page.evaluate(()=>{
  (window as any).__draws=[];
  new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes){if(node instanceof HTMLElement&&node.matches('.draw-animation-layer'))(window as any).__draws.push({player:node.dataset.drawPlayer,faces:node.querySelectorAll('[data-card-id]').length});}}).observe(document.body,{childList:true});
 });
 const response=page.waitForResponse(r=>r.url().includes('/api/duels/')&&r.url().endsWith('/actions'));
 await page.getByRole('button',{name:'Finalizar turno',exact:true}).click();
 const next=await(await response).json();
 await expect(page.locator('.draw-animation-layer')).toBeVisible();
 await expect(page.getByRole('button',{name:'Finalizar turno',exact:true})).toBeEnabled({timeout:15000});
 await expect(page.locator('.draw-animation-layer')).toHaveCount(0);
 await expect(page.locator('[data-draw-pile="jugador-1"] strong')).toHaveText('16');
 // Neither player draws on their first personal turn; the first draw is human turn 3.
 await expect(page.locator('[data-draw-pile="jugador-2"] strong')).toHaveText('17');
 await page.setViewportSize({width:390,height:844});
 for(const pile of await page.locator('.indicator-decks .draw-pile-stack').all())await expect(pile).toBeHidden();
 await expect(page.locator('[data-draw-pile="jugador-1"] strong')).toBeVisible();
 await page.getByRole('button',{name:'Finalizar turno',exact:true}).click();
 await expect(page.locator('.draw-animation-layer .card-back')).toBeVisible();
 expect((await page.locator('.draw-animation-layer .card-back').boundingBox())!.width).toBeGreaterThan(0);
 await expect(page.getByRole('button',{name:'Finalizar turno',exact:true})).toBeEnabled({timeout:15000});
 await expect(page.locator('[data-draw-pile="jugador-1"] strong')).toHaveText('15');
 await expect(page.locator('[data-draw-pile="jugador-2"] strong')).toHaveText('16');
 const draws=await page.evaluate(()=>(window as any).__draws);
 expect(draws.map((draw:{player:string})=>draw.player)).toEqual(['jugador-1','jugador-2','jugador-1']);
 expect(draws.every((draw:{faces:number})=>draw.faces===0)).toBe(true);
 const confirmed=await(await request.get(`/api/duels/${next.id}`)).json();
 expect(confirmed.players.map((p:{deckCount:number})=>p.deckCount)).toEqual([15,16]);
});

test('empty piles stay visible and reduced motion skips drawing effects',async({page,request})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 const response=await request.post('/api/duels',{data:{scenario:'inicio',deckIds:['espadas-20','copas-20']}});
 const fixture=await response.json();fixture.players.forEach((p:{deckCount:number})=>p.deckCount=0);
 await page.route('**/api/duels',route=>route.fulfill({json:fixture}));
 await page.route('**/api/duels/*/actions',route=>route.fulfill({json:{...fixture,version:fixture.version+1,turn:3}}));
 await page.goto('/#/jugar');await page.getByRole('button',{name:'Jugar contra la PC',exact:true}).click();
 await expect(page.locator('.draw-pile.is-empty')).toHaveCount(2);
 await expect(page.locator('.draw-pile').first()).toHaveAccessibleName(/0 cartas por robar/);
 await page.getByRole('button',{name:'Finalizar turno',exact:true}).click();
 await expect(page.getByRole('button',{name:'Finalizar turno',exact:true})).toBeEnabled();
 await expect(page.locator('.draw-animation-layer')).toHaveCount(0);
 await expect(page.locator('.draw-pile.is-empty')).toHaveCount(2);
});
