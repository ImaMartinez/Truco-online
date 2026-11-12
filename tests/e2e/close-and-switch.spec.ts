import {test,expect,type Page,type APIRequestContext} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
async function fixture(page:Page,request:APIRequestContext){
 const game=await(await request.post('/api/duels',{data:{scenario:'mesa-abierta',deckIds:['espadas-20','copas-20']}})).json();
 game.id='99';game.viewerPlayerId=game.players[0].id;game.cpu={playerId:game.players[1].id,difficulty:'normal'};game.mode='persistent';
 const catalog=await(await request.get('/api/catalog')).json(),decks=(await(await request.get('/api/decks')).json()).decks;
 const deck={...decks.find((d:any)=>d.id==='espadas-20'),id:'10',ownerId:game.viewerPlayerId};
 let failJoin=false,dropCreate=false;const writes:{path:string;body:any}[]=[];
 const room={id:'7',code:'ABCD-EFGH',status:'ESPERANDO',duelId:null,expiresAt:new Date(Date.now()+900000).toISOString(),host:{id:game.viewerPlayerId,alias:'QA cierre',deckId:'10',deckName:deck.name,deckSize:20},guest:null};
 function summary(){return {id:'99',turn:game.turn,status:game.status,reason:game.result?.reason??null,startedAt:new Date().toISOString(),ownPosition:1,winnerPosition:game.status==='finished'?2:null,cpuDifficulty:'normal'};}
 function finish(){game.status='finished';game.version++;game.winnerId=game.players[1].id;game.result={reason:'ABANDONO',finishedAt:new Date().toISOString()};}
 await page.route('**/api/**',async route=>{
  const req=route.request(),path=new URL(req.url()).pathname,method=req.method();const body=method==='GET'?null:req.postDataJSON();if(body)writes.push({path,body});
  if(path==='/api/health')return route.fulfill({json:{storage:'supabase',database:'connected',cpu:{state:'ready'}}});
  if(path==='/api/me')return route.fulfill({json:{profile:{id:game.viewerPlayerId,alias:'QA cierre'}}});
  if(path==='/api/catalog')return route.fulfill({json:catalog});
  if(path==='/api/decks')return route.fulfill({json:{decks:[deck]}});
  if(path==='/api/history')return route.fulfill({json:{duels:[summary()]}});
  if(path==='/api/rooms'&&method==='GET')return route.fulfill({json:{rooms:[]}});
  if(path==='/api/rooms/lookup')return route.fulfill({json:{code:room.code,hostAlias:'Anfitrión QA',deckSize:20,expiresAt:room.expiresAt}});
  if(path==='/api/rooms/join'&&failJoin)return route.fulfill({status:409,json:{error:{code:'SALA_NO_DISPONIBLE',message:'La sala ya no admite jugadores.'}}});
  if(path==='/api/rooms'||path==='/api/rooms/join'){if(game.status==='active')finish();if(dropCreate){dropCreate=false;return route.abort('failed');}return route.fulfill({json:room});}
  if(path==='/api/rooms/7')return route.fulfill({json:room});
  if(path==='/api/duels/99/abandon'){if(game.status==='active')finish();return route.fulfill({json:game});}
  if(path==='/api/duels/99')return route.fulfill({json:game});
  return route.fulfill({status:404,json:{error:{message:'Unexpected fixture '+path}}});
 });
 return {game,writes,failJoin:()=>{failJoin=true;},dropCreate:()=>{dropCreate=true;}};
}
test('close from Jugar is confirmed, cancellation is harmless and history is retained',async({page,request})=>{
 const f=await fixture(page,request);await page.goto('/#/jugar');await page.getByRole('button',{name:'Cerrar partida',exact:true}).click();
 await expect(page.getByRole('dialog')).toContainText('CPU ganará');await page.getByRole('button',{name:'Seguir jugando',exact:true}).click();expect(f.writes).toHaveLength(0);
 await page.getByRole('button',{name:'Cerrar partida',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Cerrar partida',exact:true}).click();await expect(page.getByRole('link',{name:'Continuar partida #99'})).toHaveCount(0);
 await page.goto('/#/historial');await expect(page.locator('.profile-history')).toContainText('Por abandono');await expect(page.locator('.profile-history')).toContainText('Derrota');await expect(page.getByRole('button',{name:'Cerrar partida',exact:true})).toHaveCount(0);
});
test('mobile create asks before replacing CPU and sends one atomic room command',async({page,request})=>{
 const f=await fixture(page,request);await page.setViewportSize({width:390,height:844});await page.goto('/#/multijugador');await page.getByLabel('Tu mazo para la sala').selectOption('10');await page.getByRole('button',{name:'Crear sala privada'}).click();
 await expect(page.getByRole('dialog')).toContainText('seguirá abierta');await mkdir('artifacts/close-and-switch',{recursive:true});await page.screenshot({path:'artifacts/close-and-switch/mobile-confirm.png',fullPage:true});
 await page.getByRole('button',{name:'Seguir con mi partida'}).click();expect(f.game.status).toBe('active');expect(f.writes).toHaveLength(0);
 await page.getByRole('button',{name:'Crear sala privada'}).click();await page.getByRole('button',{name:'Cerrar y crear sala',exact:true}).click();await expect(page.getByTestId('room-code')).toHaveText('ABCD-EFGH');
 expect(f.writes).toHaveLength(1);expect(f.writes[0].body.replaceCpuGameId).toBe('99');expect(f.game.status).toBe('finished');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});
test('joining a full room fails safely and permits a fresh attempt while CPU stays active',async({page,request})=>{
 const f=await fixture(page,request);f.failJoin();await page.goto('/#/multijugador');await page.getByRole('button',{name:'Unirse a partida',exact:true}).click();await page.getByLabel('Código de sala').fill('ABCD-EFGH');await page.getByRole('button',{name:'Buscar sala',exact:true}).click();await page.getByLabel('Tu mazo para unirte').selectOption('10');await page.getByRole('button',{name:'Unirme a esta partida'}).click();await page.getByRole('button',{name:'Cerrar y unirme',exact:true}).click();
 await expect(page.getByRole('alertdialog')).toContainText('ya no admite');expect(f.game.status).toBe('active');expect(f.writes.find(w=>w.path.endsWith('/join'))?.body.replaceCpuGameId).toBe('99');await page.getByRole('button',{name:'Entendido',exact:true}).click();await expect(page.getByRole('button',{name:'Unirme a esta partida'})).toBeEnabled();
});
test('uncertain room result survives reload and retries the same consent and request key',async({page,request})=>{
 const f=await fixture(page,request);f.dropCreate();await page.goto('/#/multijugador');await page.getByLabel('Tu mazo para la sala').selectOption('10');await page.getByRole('button',{name:'Crear sala privada'}).click();await page.getByRole('button',{name:'Cerrar y crear sala',exact:true}).click();
 await expect(page.getByRole('button',{name:'Reintentar operación pendiente'})).toBeVisible();const first=f.writes[0].body;await page.reload();await page.getByRole('button',{name:'Reintentar operación pendiente'}).click();await expect(page.getByTestId('room-code')).toBeVisible();expect(f.writes[1].body).toEqual(first);
});
test('history and CPU battlefield both offer explicit closure',async({page,request})=>{
 await fixture(page,request);await page.setViewportSize({width:1366,height:768});await page.goto('/#/historial');await expect(page.getByRole('button',{name:'Cerrar partida',exact:true})).toBeVisible();await mkdir('artifacts/close-and-switch',{recursive:true});await page.screenshot({path:'artifacts/close-and-switch/history-desktop.png',fullPage:true});
 await page.getByRole('link',{name:'Ver partida',exact:true}).click();await page.getByRole('button',{name:'Cerrar partida',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('historial se conservará');await page.getByRole('button',{name:'Continuar jugando',exact:true}).click();
});
