import {test,expect} from '@playwright/test';
import type {DuelState} from '../../shared/contracts';

test('arena fits desktop and mobile heights with both fields, hand and actions visible',async({page,request})=>{
 const response=await request.post('/api/duels',{data:{scenario:'inicio',deckIds:['espadas-20','copas-20']}});
 expect(response.status()).toBe(201);const fixture:DuelState=await response.json();
 // Presentation stress fixture: full fields and a long hand, without changing game rules.
 fixture.players.forEach((player,index)=>{player.field=player.hand.map((copy,i)=>({...copy,id:`field-${index}-${i}`,enteredTurn:0}));});
 fixture.players[0].hand=Array.from({length:14},(_,i)=>({...fixture.players[0].hand[i%3]!,id:`hand-${i}`}));
 await page.route('**/api/duels',route=>route.fulfill({json:fixture}));
 await page.goto('/#/jugar');await page.getByRole('button',{name:'Jugar contra la PC',exact:true}).click();
 await expect(page.locator('.battle-table')).toBeVisible();
 for(const [width,height] of [[1440,900],[1280,720],[1024,600],[390,844],[844,390]]){
  await page.setViewportSize({width,height});
  // Let arrival transitions settle before checking geometry.
  await page.locator('.field-card').evaluateAll(elements=>Promise.all(elements.flatMap(el=>el.getAnimations()).map(animation=>animation.finished)));
  // Exceptionally short viewports use one labeled resources scrollport, never a scrollbar per statistic.
  if(height<=650)await page.getByRole('button',{name:'Finalizar turno',exact:true}).scrollIntoViewIfNeeded();
  const geometry=await page.evaluate(()=>{
   const box=(selector:string)=>{const r=document.querySelector(selector)!.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right};};
   return {table:box('.battle-table'),enemy:box('.enemy-field'),own:box('.own-field'),hand:box('.own-hand'),dock:box('.action-dock'),scroll:document.documentElement.scrollHeight};
  });
  expect(geometry.table.top).toBeGreaterThanOrEqual(0);
  expect(geometry.table.bottom).toBeLessThanOrEqual(height+1);
  expect(geometry.dock.bottom).toBeLessThanOrEqual(height+1);
  expect(geometry.hand.right<=geometry.dock.left+1||geometry.dock.right<=geometry.hand.left+1||geometry.hand.bottom<=geometry.dock.top+1||geometry.dock.bottom<=geometry.hand.top+1).toBe(true);
  expect(geometry.enemy.bottom).toBeLessThanOrEqual(geometry.own.top+1);
  expect(geometry.scroll).toBeLessThanOrEqual(height+1);
  await expect(page.getByRole('button',{name:'Finalizar turno',exact:true})).toBeInViewport();
 }
 await page.setViewportSize({width:390,height:844});
 await page.getByRole('button',{name:'Bitácora',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Bitácora del duelo'})).toBeVisible();
 await page.getByRole('button',{name:'Cerrar bitácora',exact:true}).click();
 await expect(page.locator('.arena-sidebar')).toBeHidden();
});

test('victory opens a modal with fireworks, can be dismissed and respects reduced motion',async({page,request})=>{
 const response=await request.post('/api/duels',{data:{scenario:'inicio',deckIds:['espadas-20','copas-20']}});
 const fixture:DuelState=await response.json();fixture.status='finished';fixture.winnerId=fixture.players[0].id;fixture.players[1].life=0;
 await page.route('**/api/duels',route=>route.fulfill({json:fixture}));
 await page.goto('/#/jugar');await page.getByRole('button',{name:'Jugar contra la PC',exact:true}).click();
 const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
 await expect(dialog).toContainText('se lleva la mesa.');
 await expect(dialog.locator('.victory-fireworks i')).toHaveCount(90);
 expect(await dialog.locator('.firework-burst i').first().evaluate(el=>getComputedStyle(el).animationName)).toBe('victory-spark');
 await dialog.getByRole('button',{name:'Ver tablero',exact:true}).click();await expect(dialog).toHaveCount(0);
 await page.getByRole('button',{name:'Ver resultado',exact:true}).click();await expect(dialog).toBeVisible();
 await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.getByRole('button',{name:'Ver resultado',exact:true}).click();
 await expect(dialog.locator('.victory-fireworks')).toBeHidden();
 await dialog.getByRole('button',{name:'Ver tablero',exact:true}).click();
 fixture.winnerId=fixture.players[1].id;
 await page.goto('/#/jugar');await page.getByRole('button',{name:'Jugar contra la PC',exact:true}).click();
 await expect(dialog).toBeVisible();await expect(dialog.locator('.victory-fireworks')).toHaveCount(0);
});
