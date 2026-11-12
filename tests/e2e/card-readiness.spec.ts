import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

test('attack readiness uses color, exhausted cards remain disabled, and life fills in opposite directions',async({page,request})=>{
 const state=await(await request.post('/api/duels',{data:{scenario:'inicio',deckIds:['espadas-20','copas-20']}})).json();
 state.turn=5;state.players.forEach((p:{life:number})=>p.life=10);
 const own=state.players[0],rival=state.players[1];
 own.field=own.hand.map((copy:object,index:number)=>({...copy,id:['ready','waiting','spent'][index],enteredTurn:index===1?5:1,lastAttackTurn:index===2?5:null}));
 rival.field=[{...rival.hand[0],id:'defender',enteredTurn:1,lastAttackTurn:null}];
 await page.route('**/api/duels',route=>route.fulfill({json:state}));
 await page.setViewportSize({width:1440,height:900});await page.goto('/#/jugar');await page.getByRole('button',{name:'Jugar contra la PC',exact:true}).click();
 const ready=page.locator('[data-instance-id="ready"]'),waiting=page.locator('[data-instance-id="waiting"]'),spent=page.locator('[data-instance-id="spent"]'),defender=page.locator('[data-instance-id="defender"]');
 await expect(ready).toBeEnabled();await expect(waiting).toBeDisabled();await expect(spent).toBeDisabled();
 expect(await ready.evaluate(el=>getComputedStyle(el).filter)).toBe('none');
 expect(await waiting.evaluate(el=>getComputedStyle(el).filter)).toContain('grayscale(1)');expect(await spent.evaluate(el=>getComputedStyle(el).filter)).toContain('grayscale(1)');
 await expect(ready).toHaveAccessibleName(/Lista para atacar/);await expect(waiting).toHaveAccessibleName(/Preparándose/);await expect(spent).toHaveAccessibleName(/Ya atacó/);
 await expect(page.locator('.field-card-state')).toHaveCount(0);
 await expect(page.locator('.enemy-field')).not.toContainText('Espacio libre');await expect(page.locator('.enemy-field .rival-slot')).toHaveCount(2);await expect(page.locator('.rival-slot svg')).toHaveCount(0);
 await expect(page.locator('.enemy-field [data-field-slot]')).toHaveCount(0);
 await ready.click();await expect(defender).toBeEnabled();expect(await defender.evaluate(el=>getComputedStyle(el).filter)).toBe('none');
 const bars=await page.locator('.indicator-lives .life-meter').evaluateAll(elements=>elements.map(el=>({direction:el.getAttribute('data-fill-direction'),bar:el.getBoundingClientRect().toJSON(),fill:el.firstElementChild!.getBoundingClientRect().toJSON()})));
 expect(bars[0]!.direction).toBe('rtl');expect(bars[0]!.fill.right).toBeCloseTo(bars[0]!.bar.right-1,0);expect(bars[0]!.fill.left).toBeGreaterThan(bars[0]!.bar.left+bars[0]!.bar.width*.4);
 expect(bars[1]!.direction).toBe('ltr');expect(bars[1]!.fill.left).toBeCloseTo(bars[1]!.bar.left+1,0);expect(bars[1]!.fill.right).toBeLessThan(bars[1]!.bar.right-bars[1]!.bar.width*.4);
 const numbers=await page.locator('.indicator-lives .hero-life > strong').evaluateAll(elements=>elements.map(el=>el.getBoundingClientRect().toJSON()));
 expect(numbers[0]!.left).toBeCloseTo(bars[0]!.bar.left,0);expect(numbers[1]!.right).toBeCloseTo(bars[1]!.bar.right,0);
 await mkdir('artifacts/arena-feedback',{recursive:true});await page.screenshot({path:'artifacts/arena-feedback/estados-y-vidas.png'});
});
