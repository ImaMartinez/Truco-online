import {test,expect,type Page,type APIRequestContext} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

async function fixture(page:Page,request:APIRequestContext){
 const game=await(await request.post('/api/duels',{data:{scenario:'mesa-abierta',deckIds:['espadas-20','copas-20']}})).json();
 const catalog=await(await request.get('/api/catalog')).json();game.id='99';game.viewerPlayerId=game.players[0].id;game.activePlayerId=game.viewerPlayerId;game.mode='persistent';game.cpu={playerId:game.players[1].id,difficulty:'normal'};game.players[0].energy=1;
 game.players[0].hand[0].cardId=catalog.cards.find((c:any)=>c.cost===3).id;game.players[0].field=game.players[0].field.slice(0,1);
 let pollFailure=false,actionFailure=false,polls=0;const writes:any[]=[];
 await page.route('**/api/**',async route=>{
  const req=route.request(),path=new URL(req.url()).pathname;
  if(path==='/api/health')return route.fulfill({json:{storage:'supabase'}});
  if(path==='/api/me')return route.fulfill({json:{profile:{id:game.viewerPlayerId,alias:'QA avisos'}}});
  if(path==='/api/catalog')return route.fulfill({json:catalog});
  if(path==='/api/decks')return route.fulfill({json:{decks:[]}});
  if(path==='/api/history')return route.fulfill({json:{duels:[]}});
  if(path==='/api/rooms')return route.fulfill({json:{rooms:[]}});
  if(path==='/api/duels/99/actions'){
   writes.push(req.postDataJSON());if(actionFailure)return route.fulfill({status:503,json:{error:{code:'CONEXION',message:'No se pudo confirmar la jugada. La solicitud sigue pendiente.'}}});
   game.version++;game.turn++;return route.fulfill({json:game});
  }
  if(path==='/api/duels/99'){polls++;if(pollFailure)return route.fulfill({status:503,json:{error:{code:'CONEXION',message:'Sin conexión'}}});return route.fulfill({json:game});}
  return route.fulfill({status:404,json:{error:{message:'Unexpected fixture endpoint'}}});
 });
 await page.goto('/#/arena?partida=99');await expect(page.locator('.battle-table')).toBeVisible();await page.locator('.field-card').evaluateAll(es=>Promise.all(es.flatMap(e=>e.getAnimations()).map(a=>a.finished)));
 return {writes,failPolling:(v:boolean)=>{pollFailure=v;},failAction:(v:boolean)=>{actionFailure=v;},pollCount:()=>polls};
}
async function boxes(page:Page){return page.evaluate(()=>Object.fromEntries(['.battle-table','.arena-center','.combat-area','.own-hand','.indicator-lives','.action-dock'].map(s=>{const r=document.querySelector(s)!.getBoundingClientRect();return [s,{x:r.x,y:r.y+scrollY,width:r.width,height:r.height}];})));}
function sameBoxes(a:Awaited<ReturnType<typeof boxes>>,b:Awaited<ReturnType<typeof boxes>>){for(const name of Object.keys(a))for(const k of ['x','y','width','height'] as const)expect(Math.abs(a[name][k]-b[name][k]),name+' '+k).toBeLessThanOrEqual(1);}

test('energy errors open an accessible popup without resizing desktop or mobile, including repeated failures',async({page,request})=>{
 await mkdir('artifacts/error-popups',{recursive:true});
 for(const [width,height]of [[1366,768],[390,844],[360,800]]){
  await page.setViewportSize({width,height});const f=await fixture(page,request);await page.locator('.own-hand .playing-card').first().click({position:{x:8,y:35}});
  const before=await boxes(page),slot=page.getByRole('button',{name:'Invocar en espacio 2',exact:true});await slot.click();
  const popup=page.getByRole('alertdialog');await expect(popup).toContainText('Necesitás 3 de energía y tenés 1.');await expect(popup.getByRole('button',{name:'Entendido',exact:true})).toBeFocused();sameBoxes(before,await boxes(page));
  expect(await page.locator('.page-arena > .notice').count()).toBe(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);const d=await popup.boundingBox();expect(d!.width).toBeLessThanOrEqual(width-20);expect(d!.height).toBeLessThanOrEqual(height-20);
  await page.screenshot({path:`artifacts/error-popups/${width}x${height}-energy.png`,fullPage:true});await page.keyboard.press('Escape');await expect(popup).toHaveCount(0);await expect(slot).toBeFocused();sameBoxes(before,await boxes(page));
  await slot.press('Enter');await expect(popup).toBeVisible();await popup.getByRole('button',{name:'Cerrar aviso',exact:true}).click();expect(f.writes).toHaveLength(0);
  await page.unroute('**/api/**');
 }
});
test('uncertain actions keep stable retry identity and controls inside a single popup, never in the arena flow',async({page,request})=>{
 const f=await fixture(page,request);f.failAction(true);const before=await boxes(page);await page.getByRole('button',{name:'Finalizar turno',exact:true}).click();const popup=page.getByRole('alertdialog');await expect(popup).toContainText('solicitud sigue pendiente');await expect(popup.getByRole('button',{name:'Reintentar cierre pendiente',exact:true})).toBeVisible();sameBoxes(before,await boxes(page));
 await popup.getByRole('button',{name:'Entendido',exact:true}).click();await expect(popup).toHaveCount(0);sameBoxes(before,await boxes(page));await page.getByRole('button',{name:'Ver operación pendiente',exact:true}).click();await expect(popup).toBeVisible();f.failAction(false);await popup.getByRole('button',{name:'Reintentar cierre pendiente',exact:true}).click();await expect(popup).toHaveCount(0);expect(f.writes).toHaveLength(2);expect(f.writes[1]).toEqual(f.writes[0]);
});
test('background connection failure is dismissible once per episode and reconnect remains accessible without resizing',async({page,request})=>{
 const f=await fixture(page,request),before=await boxes(page);f.failPolling(true);const popup=page.getByRole('alertdialog');await expect(popup).toHaveAccessibleName('Conexión interrumpida');sameBoxes(before,await boxes(page));await popup.getByRole('button',{name:'Entendido',exact:true}).click();const count=f.pollCount();await expect.poll(()=>f.pollCount(),{timeout:10000}).toBeGreaterThan(count+1);await expect(popup).toHaveCount(0);sameBoxes(before,await boxes(page));
 await page.getByRole('button',{name:'Ver aviso de conexión',exact:true}).click();f.failPolling(false);await popup.getByRole('button',{name:'Reconectar',exact:true}).click();await expect(popup).toHaveCount(0);await expect(page.locator('.floating-notice')).toHaveCount(0);sameBoxes(before,await boxes(page));
});
