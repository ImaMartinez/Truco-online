import {test,expect,type Page,type APIRequestContext} from '@playwright/test';
import type {Card,DuelState} from '../../shared/contracts';
import {mkdir} from 'node:fs/promises';

async function presentationFixture(page:Page,request:APIRequestContext){
 const cards:Card[]=(await(await request.get('/api/catalog')).json()).cards;
 const fixture:DuelState=await(await request.post('/api/duels',{data:{scenario:'inicio',deckIds:['espadas-20','copas-20']}})).json();
 fixture.turn=9;fixture.players[0].energy=3;fixture.players[0].maxEnergy=3;fixture.players[0].life=14;
 fixture.players[0].hand=[2,5,1,3].map((cost,index)=>{const card=cards.find(card=>card.cost===cost)!;return{id:`preview-${index}`,cardId:card.id,health:card.health,enteredTurn:0,lastAttackTurn:null};});
 fixture.players.forEach((player,index)=>{player.field=[{...player.hand[0],id:`field-${index}`,enteredTurn:0}];});
 await page.route('**/api/duels',route=>route.fulfill({json:fixture}));
 await page.goto('/#/jugar');await page.getByRole('button',{name:'Jugar contra la PC',exact:true}).click();
 await expect(page.locator('.battle-table')).toBeVisible();return fixture;
}

test('readable turn and player meters, equal combat cards and energy previews never spend resources',async({page,request})=>{
 await page.setViewportSize({width:1440,height:900});const fixture=await presentationFixture(page,request);
 let writes=0;page.on('request',request=>{if(request.method()==='POST'&&request.url().endsWith('/actions'))writes++;});
 await expect(page.locator('.turn-announcement')).toHaveText('Tu turno');await expect(page.locator('.global-turn')).toContainText('9');
 expect(await page.locator('.global-turn').evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
 expect(await page.locator('.own-summary .player-identity strong').evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(17);
 for(const zone of ['.own-summary','.rival-summary']){
  await expect(page.locator(`${zone} .player-card-count`)).toHaveCount(0);
  await expect(page.locator(zone)).not.toContainText(/En mazo|En mano|Descartadas|TU MANO/);
 }
 await expect(page.locator('.rival-summary .player-kind')).toHaveText('Computadora');
 const life=page.locator(`[data-life-player="${fixture.players[0].id}"] [role="meter"]`);await expect(life).toHaveAttribute('aria-valuenow','14');
 const lives=await page.locator('.indicator-lives').boundingBox(),energyCard=await page.locator('.indicator-energy').boundingBox();
 expect(lives!.y+lives!.height).toBeLessThanOrEqual(energyCard!.y);
 expect(await life.locator('i').evaluate(el=>parseFloat((el as HTMLElement).style.width))).toBe(70);
 await expect(page.locator('.hand-heading')).toHaveCount(0);
 await expect(page.locator('.player-panel .eyebrow')).toHaveCount(0);
 const energy=page.locator(`[data-energy-player="${fixture.players[0].id}"] .energy-counter`);
 const selectCard=async(id:string)=>{
  const wrapper=page.locator(`[data-hand-instance="${id}"]`);const box=await wrapper.boundingBox();
  await page.mouse.move(box!.x+box!.width/2,box!.y+box!.height/2);
  await expect(wrapper).toHaveClass(/is-hovered/);await wrapper.locator('.playing-card').click();
 };
 await selectCard('preview-0');
 await expect(energy).toHaveAttribute('data-preview-cost','2');await expect(energy.locator('.preview-spend')).toHaveCount(2);
 await expect(energy).toHaveAccessibleName('Energía 3 de 3');await expect(energy.locator('.energy-preview')).toHaveText('−2 al invocar');
 await selectCard('preview-1');
 await expect(energy).toHaveAttribute('data-preview-affordable','false');await expect(energy.locator('.preview-missing')).toHaveCount(2);
 await expect(page.getByRole('button',{name:'Invocar carta',exact:true})).toBeDisabled();
 await selectCard('preview-0');
 const source=await page.locator('.own-hand [data-instance-id="preview-2"]').boundingBox();const divider=await page.locator('.table-divider').boundingBox();
 await page.mouse.move(source!.x+source!.width/2,source!.y+source!.height/2);await page.mouse.down();await page.mouse.move(divider!.x+divider!.width/2,divider!.y+divider!.height/2,{steps:8});
 await expect(energy).toHaveAttribute('data-preview-cost','1');await expect(energy.locator('.preview-spend')).toHaveCount(1);
 await page.mouse.up();await expect(energy).toHaveAttribute('data-preview-cost','2');expect(writes).toBe(0);
 const original=await(await request.get(`/api/duels/${fixture.id}`)).json();expect(original.version).toBe(1);
 await page.emulateMedia({reducedMotion:'reduce'});
 expect(await energy.locator('.preview-spend').first().evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
 await mkdir('artifacts/arena-feedback',{recursive:true});await page.screenshot({path:'artifacts/arena-feedback/escritorio-energia.png'});
});

test('symmetric fields and mirrored deck, with an interactive mobile fan and no viewport overflow',async({page,request})=>{
 await presentationFixture(page,request);
 for(const [width,height] of [[1920,1080],[1440,900],[1366,768],[1280,720],[390,844],[360,740],[768,1024]]){
  await page.setViewportSize({width,height});
  await page.locator('.field-card').evaluateAll(elements=>Promise.all(elements.flatMap(el=>el.getAnimations()).map(a=>a.finished)));
  const boxes=await Promise.all(['.enemy-field','.own-field','.enemy-field .playing-card','.own-field .playing-card'].map(selector=>page.locator(selector).boundingBox()));
  expect(Math.abs(boxes[0]!.height-boxes[1]!.height)).toBeLessThan(1);
  expect(Math.abs(boxes[2]!.height-boxes[3]!.height)).toBeLessThan(1);
  expect(Math.abs(boxes[2]!.width-boxes[3]!.width)).toBeLessThan(1);
  if(width===1920){
   expect(boxes[2]!.height).toBeGreaterThanOrEqual(120);
   const center=await page.locator('.arena-center').boundingBox(),right=await page.locator('.arena-right').boundingBox();
   expect(center!.x+center!.width).toBeLessThanOrEqual(right!.x);
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  // A small phone uses a short page scroll instead of shrinking the combat slots.
  if(width>600)expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1)).toBe(true);
  else expect(await page.evaluate(()=>document.documentElement.scrollHeight)).toBeLessThanOrEqual(1200);
  expect(await page.locator('.rival-draw-pile .draw-pile-stack').evaluate(el=>getComputedStyle(el).transform)).toContain('-1');
  if(width<760){
   const cards=page.locator('.own-hand .draggable-hand-card');const first=await cards.first().boundingBox(),second=await cards.nth(1).boundingBox();
   expect(second!.x).toBeLessThan(first!.x+first!.width);
   expect(await cards.first().evaluate(el=>getComputedStyle(el).transform)).not.toBe('none');
   await page.locator('.own-hand [data-instance-id="preview-1"]').focus();await page.keyboard.press('Enter');
   await expect(page.locator('.own-hand [data-instance-id="preview-1"]')).toHaveAttribute('aria-pressed','true');
   await expect(page.locator('.rival-hand [data-card-id]')).toHaveCount(0);
  }
  await mkdir('artifacts/arena-feedback',{recursive:true});await page.screenshot({path:`artifacts/arena-feedback/${width}x${height}.png`});
 }
});
