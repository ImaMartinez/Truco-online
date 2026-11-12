import {test,expect,type Page,type APIRequestContext} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const sizes=[[1920,1080],[1366,768],[1280,720],[390,844],[844,390],[360,740]];
async function fixture(page:Page,request:APIRequestContext){
 const state=await(await request.post('/api/duels',{data:{scenario:'mesa-abierta',deckIds:['espadas-20','copas-20']}})).json();
 state.viewerPlayerId=state.activePlayerId;state.room={id:'qa-layout',code:'ABCD-EFGH',status:'EN_CURSO'};
 state.players.forEach((p:any)=>{p.field=p.field.slice(0,1);p.energy=4;p.maxEnergy=5;p.handCount=p.hand.length;});
 state.log=Array.from({length:40},(_,i)=>`Movimiento ${i+1}: invocación y daño confirmados en el escenario local.`);
 state.onlineTimer={turnId:'qa-turn',serverNow:new Date().toISOString(),openedAt:new Date().toISOString(),deadlineAt:new Date(Date.now()+15000).toISOString(),durationSeconds:15,running:true,lastClosure:null,inactivity:[]};
 await page.route('**/api/duels',route=>route.fulfill({json:state}));await page.route('**/api/duels/*',route=>route.request().method()==='GET'?route.fulfill({json:state}):route.continue());
 await page.goto('/#/jugar');await page.getByRole('button',{name:'Jugar contra la PC',exact:true}).click();await expect(page.locator('.battle-table')).toBeVisible();await page.locator('.field-card').evaluateAll(elements=>Promise.all(elements.flatMap(el=>el.getAnimations()).map(a=>a.finished)));return state;
}
test('six real viewport captures: resources, selection, actions and hero animation anchors',async({page,request})=>{
 test.setTimeout(180000);const phase=process.env.ARENA_REVIEW_PHASE??'after';await mkdir(`artifacts/arena-review/${phase}`,{recursive:true});const rows=[];
 for(const [width,height]of sizes){
  await page.setViewportSize({width,height});await fixture(page,request);await page.screenshot({path:`artifacts/arena-review/${phase}/${width}x${height}-unselected.png`,fullPage:true});const card=page.locator('.own-hand .playing-card').first();const edge=height<500?{x:8,y:35}:undefined;if(phase==='before')await card.evaluate((e:HTMLButtonElement)=>e.click());else{await card.click({timeout:5000,position:edge});await card.hover({timeout:5000,position:edge});}await page.waitForTimeout(220);
  const measurements=await page.evaluate(()=>{
   const box=(s:string)=>{const r=document.querySelector(s)!.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
   return {horizontalOverflow:document.documentElement.scrollWidth>innerWidth+1,topline:box('.table-topline'),stats:[...document.querySelectorAll<HTMLElement>('.indicator-card')].map(e=>({name:e.className,overflow:e.scrollHeight>e.clientHeight+1,client:e.clientHeight,scroll:e.scrollHeight})),lives:box('.indicator-lives'),energy:box('.indicator-energy'),actions:box('.action-dock'),hand:box('.own-hand'),selected:box('.own-hand .selected'),anchor:document.querySelector('[data-combat-hero-anchor]')?box('.rival-hand'):null};
  });rows.push({width,height,...measurements});await page.screenshot({path:`artifacts/arena-review/${phase}/${width}x${height}.png`,fullPage:true});
  if(phase!=='before'){
   expect(measurements.horizontalOverflow).toBe(false);expect(measurements.stats.filter(s=>s.overflow)).toEqual([]);expect(measurements.anchor!.height).toBeGreaterThan(12);expect(measurements.topline.top).toBeGreaterThanOrEqual(0);
   if(width<=600){expect(measurements.lives.right).toBeLessThanOrEqual(measurements.energy.left+1);expect(measurements.lives.bottom).toBeLessThanOrEqual(measurements.actions.top+1);expect(measurements.energy.bottom).toBeLessThanOrEqual(measurements.actions.top+1);expect(measurements.selected.bottom).toBeLessThanOrEqual(measurements.lives.top+1);}
   await expect(page.getByRole('button',{name:'Finalizar turno',exact:true})).toBeVisible();
   expect((await page.locator('.own-hand .playing-card').last().boundingBox())!.height).toBeGreaterThanOrEqual(44);
   expect((await page.locator('.own-field .playing-card').first().boundingBox())!.height).toBeGreaterThanOrEqual(40);
   if(height<500){await page.getByRole('button',{name:'Finalizar turno',exact:true}).scrollIntoViewIfNeeded();await expect(page.getByRole('button',{name:'Finalizar turno',exact:true})).toBeInViewport();await page.screenshot({path:`artifacts/arena-review/${phase}/${width}x${height}-actions.png`,fullPage:true});}
  }
 }
 await writeFile(`artifacts/arena-review/${phase}/measurements.json`,JSON.stringify(rows,null,2));
});

test('hero damage lunges to the hand anchor in either perspective; card attacks keep card targets',async({page,request})=>{
 for(const [width,height]of [[1366,768],[390,844]]){
  await page.setViewportSize({width,height});const state=await fixture(page,request);
  const outcomes=await page.evaluate(async before=>{
   const {animateCombat}=await import('/src/combatAnimation.ts');const result=[];
   for(const own of [true,false]){
    const actor=before.players.find((p:any)=>(p.id===before.viewerPlayerId)===own),rival=before.players.find((p:any)=>p.id!==actor.id),after=structuredClone(before);after.version++;
    after.players.find((p:any)=>p.id===rival.id).life--;
    const promise=animateCombat(before,after,{expectedVersion:before.version,actorId:actor.id,action:{type:'attack',attackerId:actor.field[0].id,targetId:'hero'}},new AbortController().signal);
    await new Promise(r=>requestAnimationFrame(r));const layer=document.querySelector<HTMLElement>('[data-combat-animation]')!,anchor=[...document.querySelectorAll<HTMLElement>('[data-combat-hero-anchor]')].find(e=>e.dataset.combatHeroAnchor===rival.id)!,source=[...document.querySelectorAll<HTMLElement>('.battle-table [data-instance-id]')].find(e=>e.dataset.instanceId===actor.field[0].id)!;
    const a=anchor.getBoundingClientRect(),s=source.getBoundingClientRect(),frames=(layer.querySelector('.combat-attacker')!.getAnimations()[0].effect as KeyframeEffect).getKeyframes(),last=frames.at(-1)!;const transform=new DOMMatrix(last.transform as string);
    result.push({own,dx:transform.m41,dy:transform.m42,wantX:a.x+a.width/2-s.x-s.width/2,wantY:a.y+a.height/2-s.y-s.height/2,anchorId:anchor.dataset.combatHeroAnchor});await promise;
   }return result;
  },state);
  for(const r of outcomes){expect(Math.abs(r.dx-r.wantX)).toBeLessThan(1);expect(Math.abs(r.dy-r.wantY)).toBeLessThan(1);expect(r.anchorId).toBeTruthy();}
 }
});
