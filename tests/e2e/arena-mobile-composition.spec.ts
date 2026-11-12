import {test,expect,type Page,type APIRequestContext} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const sizes=[[360,800],[375,812],[390,844],[412,915]];
async function openFixture(page:Page,request:APIRequestContext,online=false){
 const state=await(await request.post('/api/duels',{data:{scenario:'mesa-abierta',deckIds:['espadas-20','copas-20']}})).json();
 state.viewerPlayerId=state.activePlayerId;state.cpu=online?undefined:{playerId:state.players[1].id,difficulty:'facil'};
 state.players.forEach((p:any)=>{p.handCount=p.hand.length;p.field=p.field.slice(0,1);});
 if(online){state.room={id:'layout-only',code:'ABCD-EFGH',status:'EN_CURSO'};state.onlineTimer={turnId:'layout-turn',serverNow:new Date().toISOString(),openedAt:new Date().toISOString(),deadlineAt:new Date(Date.now()+15000).toISOString(),durationSeconds:15,running:true,lastClosure:null,inactivity:[]};}
 await page.route('**/api/duels',r=>r.fulfill({json:state}));await page.route('**/api/duels/*',r=>r.request().method()==='GET'?r.fulfill({json:state}):r.continue());
 await page.goto('/#/jugar');await page.getByRole('button',{name:'Jugar contra la PC',exact:true}).click();await expect(page.locator('.battle-table')).toBeVisible();
 await page.locator('.field-card').evaluateAll(es=>Promise.all(es.flatMap(e=>e.getAnimations()).map(a=>a.finished)));
 return state;
}
test('CPU mobile composition reserves selection space, shows every statistic and separates touch actions',async({page,request})=>{
 const phase=process.env.COMPOSITION_PHASE??'after',directory=`artifacts/arena-mobile-composition/${phase}`;await mkdir(directory,{recursive:true});const results=[];
 for(const [width,height]of sizes)for(const online of [false,true]){
  await page.setViewportSize({width,height});await openFixture(page,request,online);const mode=online?'online':'cpu';
  await page.screenshot({path:`${directory}/${width}x${height}-${mode}-unselected.png`,fullPage:true});
  const positions=()=>page.evaluate(()=>{const rect=(s:string)=>{const b=document.querySelector(s)!.getBoundingClientRect();return {top:b.top,bottom:b.bottom,left:b.left,right:b.right,height:b.height};};return {hand:rect('.own-hand'),lives:rect('.indicator-lives'),energy:rect('.indicator-energy'),mini:rect('.indicator-middle'),actions:rect('.action-dock')};});
  const before=await positions();const first=page.locator('.own-hand .playing-card').first();await first.click({position:{x:7,y:30}});await page.waitForTimeout(220);
  await page.screenshot({path:`${directory}/${width}x${height}-${mode}-selected.png`,fullPage:true});const after=await positions();
  if(phase!=='before'){
   const selected=await first.boundingBox();expect(selected!.y).toBeGreaterThanOrEqual(after.hand.top-1);expect(selected!.y+selected!.height).toBeLessThanOrEqual(after.hand.bottom+1);expect(selected!.height).toBeGreaterThanOrEqual(100);
   expect(after.hand.bottom+8).toBeLessThanOrEqual(after.lives.top);expect(after.mini.bottom+8).toBeLessThanOrEqual(after.actions.top);
   expect(Math.abs(before.hand.top-after.hand.top)).toBeLessThan(1);expect(Math.abs(before.lives.top-after.lives.top)).toBeLessThan(1);expect(Math.abs(before.actions.top-after.actions.top)).toBeLessThan(1);
   await expect(page.locator('.match-mode-badge')).toHaveText(online?'Online':'CPU · Fácil');await expect(page.locator('.turn-announcement')).toBeVisible();
   const mini=await page.locator('.indicator-middle .indicator-card').evaluateAll(es=>es.map(e=>{const b=e.getBoundingClientRect();return {top:b.top,left:b.left,right:b.right,name:e.className,client:e.clientWidth,scrollWidth:e.scrollWidth,scroll:e.scrollWidth>e.clientWidth+1};}));expect(mini).toHaveLength(3);expect(mini.every(m=>Math.abs(m.top-mini[0]!.top)<1&&m.left>=0&&m.right<=width&&!m.scroll),JSON.stringify(mini)).toBe(true);
   for(const selector of ['.indicator-lives','.indicator-energy','.indicator-decks','.indicator-hands','.indicator-discards'])expect(await page.locator(selector).evaluate(e=>e.scrollHeight<=e.clientHeight+1)).toBe(true);
   const last=page.locator('.own-hand .playing-card').last();await last.click({position:{x:68,y:30}});await page.waitForTimeout(220);const lastBox=await last.boundingBox();
   expect(lastBox!.y).toBeGreaterThanOrEqual(after.hand.top-1);expect(lastBox!.y+lastBox!.height).toBeLessThanOrEqual(after.hand.bottom+1);expect(lastBox!.x).toBeGreaterThanOrEqual(after.hand.left-1);expect(lastBox!.x+lastBox!.width).toBeLessThanOrEqual(after.hand.right+1);
   for(const button of ['Invocar carta','Finalizar turno']){const target=page.getByRole('button',{name:button,exact:true});expect((await target.boundingBox())!.height).toBeGreaterThanOrEqual(44);await target.scrollIntoViewIfNeeded();await expect(target).toBeInViewport();}
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  }
  results.push({width,height,mode,before,after});
 }
 await writeFile(`${directory}/measurements.json`,JSON.stringify(results,null,2));
});

test('CPU landscape keeps the hand readable and selectable without crossing the resource column',async({page,request})=>{
 await page.setViewportSize({width:844,height:390});await openFixture(page,request);
 const first=page.locator('.own-hand .playing-card').first();expect((await first.boundingBox())!.height).toBeGreaterThanOrEqual(65);
 await first.click({position:{x:7,y:25}});await page.waitForTimeout(220);
 const selected=await first.boundingBox(),resources=await page.locator('.arena-right').boundingBox();expect(selected!.x+selected!.width).toBeLessThanOrEqual(resources!.x);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 expect(await page.locator('.indicator-card').evaluateAll(es=>es.every(e=>e.scrollHeight<=e.clientHeight+1))).toBe(true);
 await page.getByRole('button',{name:'Finalizar turno',exact:true}).scrollIntoViewIfNeeded();await expect(page.getByRole('button',{name:'Finalizar turno',exact:true})).toBeInViewport();
 await mkdir('artifacts/arena-mobile-composition/after',{recursive:true});await page.screenshot({path:'artifacts/arena-mobile-composition/after/844x390-cpu-selected.png',fullPage:true});
});
