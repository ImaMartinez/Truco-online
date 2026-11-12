import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

test('three field positions align with a four-card hand and hover/selection stay inside its scrollport',async({page,request})=>{
 const response=await request.post('/api/duels',{data:{scenario:'inicio',deckIds:['espadas-20','copas-20']}});
 const fixture=await response.json();fixture.players[0].hand.push({...fixture.players[0].hand[0],id:'fourth-card'});
 await page.route('**/api/duels',route=>route.fulfill({json:fixture}));
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/#/jugar');await page.getByRole('button',{name:'Jugar contra la PC',exact:true}).click();
 await expect(page.locator('.own-hand .playing-card')).toHaveCount(4);
 for(const [width,height] of [[1920,1080],[1440,900],[1280,720],[1024,600]]){
  await page.setViewportSize({width,height});await page.mouse.move(0,0);
  await page.locator('.own-hand .playing-card').evaluateAll(elements=>Promise.all(elements.flatMap(el=>el.getAnimations()).map(animation=>animation.finished)));
  const centers=await page.evaluate(()=>{
   const center=(elements:Element[])=>{const first=elements[0].getBoundingClientRect(),last=elements.at(-1)!.getBoundingClientRect();return(first.left+last.right)/2;};
   return {field:center([...document.querySelectorAll('.own-field > .field-slot,.own-field > .occupied-slot')]),hand:center([...document.querySelectorAll('.own-hand .playing-card')])};
  });
  expect(Math.abs(centers.field-centers.hand)).toBeLessThan(2);
  const wrappers=page.locator('.own-hand .draggable-hand-card');const first=await wrappers.first().boundingBox(),second=await wrappers.nth(1).boundingBox();
  expect(second!.x).toBeGreaterThan(first!.x);
  expect(await wrappers.first().evaluate(el=>getComputedStyle(el).transform)).not.toBe('none');
  const card=page.locator('.own-hand .playing-card').nth(1);const rest=await card.boundingBox();await card.hover();
  await expect.poll(async()=>{const box=await card.boundingBox();return box!.height/rest!.height;}).toBeGreaterThan(1.25);
  expect(await page.locator('.own-hand').evaluate(el=>getComputedStyle(el).overflowY)).toBe('visible');
  expect(await card.evaluate(el=>el.getBoundingClientRect().top-el.closest('.battle-table')!.getBoundingClientRect().top)).toBeGreaterThan(0);
  await card.click();
  expect(await card.evaluate(el=>el.getBoundingClientRect().top-el.closest('.battle-table')!.getBoundingClientRect().top)).toBeGreaterThan(0);
  expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1)).toBe(true);
 }
 await page.setViewportSize({width:1440,height:900});await page.locator('.own-hand .playing-card').nth(1).hover();
 await mkdir('artifacts/arena-focus',{recursive:true});await page.screenshot({path:'artifacts/arena-focus/mano-centrada-hover.png'});
});
