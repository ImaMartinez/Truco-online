import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

test('PC setup hides rival deck, uses short difficulty labels and generates twenty random cards per start',async({page,request})=>{
 await page.goto('/#/jugar');
 await expect(page.getByLabel('Dificultad',{exact:true}).locator('option')).toHaveText(['Fácil','Normal','Difícil']);
 await expect(page.getByLabel('Mazo del jugador 2',{exact:true})).toHaveCount(0);
 const generated=[];
 for(let i=0;i<2;i++){
  if(i)await page.goto('/#/jugar');
  const saved=page.waitForResponse(r=>r.url().endsWith('/api/decks')&&r.request().method()==='POST');
  const created=page.waitForResponse(r=>r.url().endsWith('/api/duels')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Jugar contra la PC',exact:true}).click();
  const deck=await(await saved).json();generated.push(deck);
  expect(deck.entries.reduce((sum:number,e:{quantity:number})=>sum+e.quantity,0)).toBe(20);
  expect(deck.entries.every((e:{quantity:number})=>e.quantity>=1&&e.quantity<=2)).toBe(true);
  const response=await created;expect(response.status()).toBe(201);
  expect(response.request().postDataJSON().deckIds[1]).toBe(deck.id);
  const duel=await response.json();expect(duel.players.map((p:{hand:unknown[];deckCount:number})=>p.hand.length+p.deckCount)).toEqual([20,20]);
  await expect(page.locator('.battle-table')).toBeVisible();
 }
 expect(generated[0].id).not.toBe(generated[1].id);
 await page.goto('/#/jugar');
 await page.getByLabel('Modo de juego',{exact:true}).selectOption('local');
 await expect(page.getByLabel('Mazo del jugador 2',{exact:true})).toBeVisible();
});

test('Jugar selects difficulty, drag invokes in slot three and PC acts without switching perspective',async({page,request})=>{
 await page.setViewportSize({width:1480,height:1400});
 const catalog=(await (await request.get('/api/catalog')).json()).cards;
 const entries=[...catalog].sort((a:{cost:number},b:{cost:number})=>a.cost-b.cost).slice(0,10).map((c:{id:string})=>({cardId:c.id,quantity:2}));
 const decks=[];for(const name of ['Mazo humano PC QA','Mazo rival PC QA'])decks.push(await(await request.post('/api/decks',{data:{name,entries}})).json());
 await page.goto('/');await page.getByRole('link',{name:'Jugar',exact:true}).click();
 await page.getByLabel('Dificultad',{exact:true}).selectOption('dificil');
 await page.getByLabel('Mazo del jugador 1',{exact:true}).selectOption(decks[0].id);
 const start=page.waitForResponse(r=>r.url().endsWith('/api/duels')&&r.request().method()==='POST');
 await page.getByRole('button',{name:'Jugar contra la PC',exact:true}).click();const state=await(await start).json();
 await expect(page.locator('.battle-table')).toBeVisible();await expect(page.locator('.turn-curtain')).toHaveCount(0);
 await page.getByRole('button',{name:'Finalizar turno',exact:true}).click();
 await expect.poll(async()=>((await(await request.get(`/api/duels/${state.id}`)).json()).turn),{timeout:18000}).toBe(3);
 await expect(page.getByRole('button',{name:'Finalizar turno',exact:true})).toBeEnabled();
 const hand=page.locator('.own-hand .playing-card').first();const id=await hand.getAttribute('data-instance-id');
 const source=await hand.boundingBox();const target=page.locator('[data-field-slot="2"]');await target.scrollIntoViewIfNeeded();const destination=await target.boundingBox();
 // Re-read source after scrolling; pointer events implement the same drag on mouse and touch.
 await hand.scrollIntoViewIfNeeded();const box=await hand.boundingBox();const slot=await target.boundingBox();
 expect(source&&destination&&box&&slot).toBeTruthy();
 await page.mouse.move(box!.x+box!.width/2,box!.y+box!.height/2);await page.mouse.down();await page.mouse.move(slot!.x+slot!.width/2,slot!.y+slot!.height/2,{steps:12});await page.mouse.up();
 await expect(page.locator(`[data-slot-index="2"] [data-instance-id="${id}"]`)).toBeVisible();
 await page.getByRole('button',{name:'Finalizar turno',exact:true}).click();
 await expect(page.getByText('La computadora está pensando…',{exact:false})).toBeVisible();
 await expect(page.locator('.rival-zone .computer-thinking')).toBeVisible();
 expect(await page.locator('.rival-zone .card-back').first().evaluate(el=>getComputedStyle(el).animationName)).toBe('opponent-card');
 await mkdir('artifacts/computer',{recursive:true});
 await page.locator('.rival-zone').screenshot({path:'artifacts/computer/rival-pensando.png'});
 await expect(page.locator('.turn-curtain')).toHaveCount(0);
 await expect.poll(async()=>{const d=await(await request.get(`/api/duels/${state.id}`)).json();return d.turn;},{timeout:12000}).toBe(5);
 await expect(page.getByRole('button',{name:'Finalizar turno',exact:true})).toBeEnabled();
 await expect(page.locator('.rival-zone')).not.toHaveClass(/is-thinking/);
 expect(await page.locator('.enemy-field .playing-card').count()).toBeLessThanOrEqual(3);
 await expect(page.locator('.own-hand')).not.toContainText('PC');
 await mkdir('artifacts/computer',{recursive:true});await page.screenshot({path:'artifacts/computer/tablero-pc.png',fullPage:true});
});

test('touch drag places a card in the chosen mobile slot without horizontal overflow',async({page,request})=>{
 await page.setViewportSize({width:390,height:1000});
 const catalog=(await(await request.get('/api/catalog')).json()).cards;
 const entries=[...catalog].sort((a:{cost:number},b:{cost:number})=>a.cost-b.cost).slice(0,10).map((c:{id:string})=>({cardId:c.id,quantity:2}));
 const deck=await(await request.post('/api/decks',{data:{name:'Mazo táctil QA',entries}})).json();
 await page.goto('/#/jugar');await page.getByLabel('Mazo del jugador 1',{exact:true}).selectOption(deck.id);
 await page.getByRole('button',{name:'Jugar contra la PC',exact:true}).click();
 await expect(page.locator('.battle-table')).toBeVisible();
 await page.getByRole('button',{name:'Finalizar turno',exact:true}).click();
 await expect(page.getByRole('button',{name:'Finalizar turno',exact:true})).toBeEnabled({timeout:18000});
 const hand=page.locator('.own-hand .playing-card').first();await hand.scrollIntoViewIfNeeded();
 const id=await hand.getAttribute('data-instance-id');const from=await hand.boundingBox(),to=await page.locator('[data-field-slot="1"]').boundingBox();expect(from&&to).toBeTruthy();
 const session=await page.context().newCDPSession(page);await session.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
 const start={x:from!.x+from!.width/2,y:from!.y+from!.height/2},end={x:to!.x+to!.width/2,y:to!.y+to!.height/2};
 await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...start,id:1}]});
 for(let i=1;i<=12;i++)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start.x+(end.x-start.x)*i/12,y:start.y+(end.y-start.y)*i/12,id:1}]});
 await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await expect(page.locator(`[data-slot-index="1"] [data-instance-id="${id}"]`)).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.locator('[data-slot-index="1"] .field-card').evaluate(el=>Promise.all(el.getAnimations().map(animation=>animation.finished)));
 await page.evaluate(()=>window.scrollTo(0,0));
 await mkdir('artifacts/computer',{recursive:true});await page.screenshot({path:'artifacts/computer/arrastre-movil.png',fullPage:true});
});
