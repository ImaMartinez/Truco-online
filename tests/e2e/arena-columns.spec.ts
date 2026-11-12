import {test,expect} from '@playwright/test';
import type {DuelState} from '../../shared/contracts';
import {mkdir} from 'node:fs/promises';

test('reference layout uses three disjoint columns and keeps 0–3 cards and real counters visible',async({page,request})=>{
 const initial:DuelState=await(await request.post('/api/duels',{data:{scenario:'inicio',deckIds:['espadas-20','copas-20']}})).json();
 let state=structuredClone(initial);
 await page.route('**/api/duels',route=>route.fulfill({json:state}));
 for(const [width,height] of [[1920,1080],[1366,768]])for(const count of [0,1,2,3]){
  state=structuredClone(initial);state.turn=5;
  state.players.forEach((player,index)=>{player.field=player.hand.slice(0,count).map((copy,i)=>({...copy,id:`field-${index}-${i}`,enteredTurn:1}));});
  await page.setViewportSize({width,height});await page.goto('/#/jugar');await page.getByRole('button',{name:'Jugar contra la PC',exact:true}).click();
  await expect(page.locator('.enemy-field .playing-card')).toHaveCount(count);await expect(page.locator('.own-field .playing-card')).toHaveCount(count);
  const boxes=await Promise.all(['.arena-left','.arena-center','.arena-right'].map(selector=>page.locator(selector).boundingBox()));
  expect(boxes[0]!.x+boxes[0]!.width).toBeLessThanOrEqual(boxes[1]!.x);
  expect(boxes[1]!.x+boxes[1]!.width).toBeLessThanOrEqual(boxes[2]!.x);
  const zoneBoxes=await Promise.all(['.rival-zone','.combat-area','.own-zone'].map(selector=>page.locator(selector).boundingBox()));
  expect(zoneBoxes[0]!.y+zoneBoxes[0]!.height).toBeLessThanOrEqual(zoneBoxes[1]!.y);
  expect(zoneBoxes[1]!.y+zoneBoxes[1]!.height).toBeLessThanOrEqual(zoneBoxes[2]!.y);
  const [rivalIdentity,history,ownIdentity]=await Promise.all(['.rival-summary','.in-table-history','.own-summary'].map(selector=>page.locator(selector).boundingBox()));
  expect(rivalIdentity!.height).toBeLessThanOrEqual(84);expect(ownIdentity!.height).toBeLessThanOrEqual(84);
  expect(rivalIdentity!.y+rivalIdentity!.height).toBeLessThan(history!.y);
  expect(history!.y+history!.height).toBeLessThan(ownIdentity!.y);
  expect(history!.height).toBeGreaterThan(zoneBoxes[1]!.height);
  // Resource cards now use natural content height rather than sharing combat tracks.
  expect(await page.locator('.indicator-card').evaluateAll(elements=>elements.every(el=>el.scrollHeight<=el.clientHeight+1))).toBe(true);
  const bars=await page.locator('.indicator-lives .life-meter').evaluateAll(elements=>elements.map(el=>({x:el.getBoundingClientRect().x,width:el.getBoundingClientRect().width})));
  expect(Math.abs(bars[0]!.x-bars[1]!.x)).toBeLessThan(1);expect(Math.abs(bars[0]!.width-bars[1]!.width)).toBeLessThan(1);
  expect(await page.locator('.indicator-cards').evaluate(el=>el.scrollHeight<=el.clientHeight+1)).toBe(true);
  expect(await page.locator('.indicator-decks .draw-pile-stack').evaluateAll(stacks=>stacks.every(stack=>{
   const face=stack.querySelector('.card-back')!.getBoundingClientRect(),label=stack.querySelector('.card-back span')!.getBoundingClientRect(),count=stack.nextElementSibling!.getBoundingClientRect();
   return label.left>=face.left-1&&label.right<=face.right+1&&face.right+3<=count.left;
  }))).toBe(true);
  for(const selector of ['.indicator-lives','.indicator-energy','.indicator-decks','.indicator-hands','.indicator-discards'])await expect(page.locator(selector)).toBeVisible();
  await expect(page.locator(`[data-draw-pile="${state.players[0].id}"] strong`)).toHaveText(String(state.players[0].deckCount));
  expect(await page.locator('.battle-table [data-instance-id]').evaluateAll(cards=>cards.every(el=>{const style=getComputedStyle(el);return Math.abs(parseFloat(style.width)/parseFloat(style.height)-2/3)<.04;}))).toBe(true);
  await expect(page.getByRole('button',{name:'Finalizar turno',exact:true})).toBeInViewport();
  expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1&&document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  if(count===3){await mkdir('artifacts/arena-columns',{recursive:true});await page.screenshot({path:`artifacts/arena-columns/${width}x${height}.png`});}
 }
});

test('mobile keeps every resource reachable, history scrollable and controls separate from the cards',async({page,request})=>{
 const state=await(await request.post('/api/duels',{data:{scenario:'inicio',deckIds:['espadas-20','copas-20']}})).json();
 state.log=Array.from({length:80},(_,i)=>`Movimiento ${i+1} del historial real del escenario de prueba.`);
 await page.route('**/api/duels',route=>route.fulfill({json:state}));
 await page.setViewportSize({width:390,height:844});await page.goto('/#/jugar');await page.getByRole('button',{name:'Jugar contra la PC',exact:true}).click();
 const header=await page.locator('.table-topline').boundingBox(),rival=await page.locator('.rival-zone').boundingBox();expect(header!.y+header!.height).toBeLessThanOrEqual(rival!.y);
 for(const selector of ['.indicator-lives','.indicator-energy','.indicator-decks','.indicator-hands','.indicator-discards']){await page.locator(selector).scrollIntoViewIfNeeded();await expect(page.locator(selector)).toBeInViewport();}
 await page.getByRole('button',{name:'Bitácora',exact:true}).click();
 const log=page.getByRole('list',{name:'Movimientos recientes'});await expect(log).toBeVisible();expect(await log.evaluate(el=>el.scrollHeight>el.clientHeight)).toBe(true);
 await page.getByRole('button',{name:'Cerrar bitácora',exact:true}).click();
 await page.locator('.indicator-lives').scrollIntoViewIfNeeded();
 await mkdir('artifacts/arena-columns',{recursive:true});await page.screenshot({path:'artifacts/arena-columns/movil.png'});
});
