import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import type {Deck,DeckInput} from '../../shared/contracts';

test('connected Prueba profile is shown in deck and collection selectors on desktop and mobile',async({page,request})=>{
 const catalog=await(await request.get('/api/catalog')).json();
 const profile={id:'41',alias:'Prueba'};
 let decks:Deck[]=[{id:'42',ownerId:profile.id,name:'Mi mazo',description:'',used:false,entries:catalog.cards.slice(0,10).map((card:{id:string})=>({cardId:card.id,quantity:2}))}];
 const saves:DeckInput[]=[],unexpected:string[]=[],collections:string[]=[];
 await page.route('**/api/**',async route=>{
  const req=route.request(),path=new URL(req.url()).pathname;
  if(path==='/api/health')return route.fulfill({json:{status:'ok',storage:'supabase',mode:'persistent',database:'connected'}});
  if(path==='/api/me')return route.fulfill({json:{profile}});
  if(path==='/api/catalog')return route.fulfill({json:catalog});
  if(path==='/api/history')return route.fulfill({json:{duels:[]}});
  if(path==='/api/rooms')return route.fulfill({json:{rooms:[]}});
  if(path===`/api/players/${profile.id}/collection`){collections.push(path);return route.fulfill({json:{cards:catalog.cards.map((card:object)=>({...card,quantity:2})),mode:'persistent'}});}
  if(path==='/api/decks'){
   if(req.method()==='GET')return route.fulfill({json:{decks,mode:'persistent'}});
   if(req.method()==='POST'){const input=req.postDataJSON() as DeckInput;saves.push(input);const saved={...input,id:String(43+saves.length),ownerId:profile.id};decks=[...decks,saved];return route.fulfill({status:201,json:saved});}
  }
  unexpected.push(path);return route.fulfill({status:404,json:{error:{message:'Unexpected fixture request'}}});
 });
 await mkdir('artifacts/profile-owner',{recursive:true});
 for(const [width,height]of [[1366,900],[390,844]]){
  await page.setViewportSize({width,height});await page.goto('/#/mazos');
  const owner=page.getByLabel('Propietario del mazo',{exact:true});
  await expect(owner).toHaveValue(profile.id);await expect(owner.locator('option')).toHaveText([profile.alias]);
  await page.locator('.persistent-panel').screenshot({path:`artifacts/profile-owner/mazos-${width}.png`});
  await page.getByRole('button',{name:'Nuevo mazo',exact:true}).click();
  await page.getByLabel('Nombre del mazo',{exact:true}).fill(`Mazo personal ${width}`);
  await page.getByRole('button',{name:'Elegir 20 cartas al azar',exact:true}).click();
  await page.getByRole('button',{name:'Guardar mazo',exact:true}).click();
  await expect(page.getByText(`“Mazo personal ${width}” guardado en tu perfil.`,{exact:true})).toBeVisible();
  await page.getByRole('link',{name:'Colección',exact:true}).click();
  const collection=page.getByLabel('Jugador de la colección',{exact:true});
  await expect(collection).toHaveValue(profile.id);await expect(collection.locator('option')).toHaveText([profile.alias]);
  await expect(page.locator('.collection-grid .playing-card')).toHaveCount(40);
  await page.locator('.persistent-panel').screenshot({path:`artifacts/profile-owner/coleccion-${width}.png`});
 }
 expect(saves).toHaveLength(2);expect(saves.every(s=>s.ownerId===profile.id)).toBe(true);
 expect(collections.length).toBeGreaterThan(0);expect(unexpected).toEqual([]);
 await page.getByRole('link',{name:'Inicio',exact:true}).click();
 await expect(page.getByRole('heading',{name:/La mesa está lista/})).toBeVisible();
 await expect(page.locator('main')).not.toContainText(/B1[–—-]B4|pendientes de aprobación|PostgreSQL|MariaDB|modelo académico/);
});

test('deck cross opens an accessible popup; cancel preserves it and confirmation removes it',async({page,request})=>{
 const deck=await (await request.post('/api/decks',{data:{name:'Mazo para eliminar',entries:[{cardId:'ESP-01',quantity:1}]}})).json();
 await page.setViewportSize({width:390,height:844});await page.goto('/#/mazos');
 const cross=page.getByRole('button',{name:'Eliminar mazo Mazo para eliminar',exact:true});await cross.click();
 const popup=page.getByRole('dialog',{name:'¿Eliminar este mazo?'});
 await expect(popup).toBeVisible();await expect(popup.getByRole('button',{name:'Cancelar',exact:true})).toBeFocused();
 expect(await popup.evaluate(el=>el.getBoundingClientRect().width<=innerWidth)).toBe(true);
 await popup.getByRole('button',{name:'Cancelar',exact:true}).click();await expect(cross).toBeVisible();
 await cross.click();const response=page.waitForResponse(r=>r.request().method()==='DELETE'&&r.url().endsWith(`/api/decks/${deck.id}`));
 await popup.getByRole('button',{name:'Eliminar mazo',exact:true}).click();expect((await response).status()).toBe(200);
 await expect(cross).toHaveCount(0);await page.reload();await expect(page.getByLabel('Nombre del mazo',{exact:true})).toBeVisible();await expect(cross).toHaveCount(0);
});

test('collection creates a twenty-card random draft that can be named and saved',async({page})=>{
 await page.goto('/#/coleccion');
 await page.getByRole('button',{name:'Armar mazo aleatorio de 20 cartas',exact:true}).click();
 await expect(page).toHaveURL(/#\/mazos$/);
 await expect(page.getByRole('link',{name:'Ir a Jugar',exact:true})).toHaveCount(0);
 await expect(page.getByLabel('Nombre del mazo',{exact:true})).toHaveValue('Mi mazo aleatorio');
 const randomize=page.locator('.deck-summary').getByRole('button',{name:'Elegir 20 cartas al azar',exact:true});
 await expect(randomize).toBeVisible();await randomize.click();
 const quantities=await page.locator('.deck-entry strong').allTextContents();
 expect(quantities.reduce((n,q)=>n+Number(q.replace('×','')),0)).toBe(20);
 expect(quantities.every(q=>[1,2].includes(Number(q.replace('×',''))))).toBe(true);
 await page.getByLabel('Nombre del mazo',{exact:true}).fill('Mazo al azar de la colección');
 const response=page.waitForResponse(r=>r.url().endsWith('/api/decks')&&r.request().method()==='POST');
 await page.getByRole('button',{name:'Guardar mazo',exact:true}).click();
 const saved=await response;expect(saved.status()).toBe(201);
 expect((await saved.json()).entries.reduce((n:number,e:{quantity:number})=>n+e.quantity,0)).toBe(20);
 await mkdir('artifacts/deck-tools',{recursive:true});
 await page.screenshot({path:'artifacts/deck-tools/mazo-aleatorio.png',fullPage:true});
});

test('persistent selectors hide fixtures, separate demos and keep owner collection limits',async({page,request})=>{
 const catalog=(await (await request.get('/api/catalog')).json()).cards;
 await page.route('**/api/health',route=>route.fulfill({json:{status:'ok',service:'truco-arena-api',mode:'persistent',storage:'mariadb',database:'connected',agreements:'pending'}}));
 await page.route('**/api/decks',route=>route.fulfill({json:{decks:[],mode:'persistent'}}));
 await page.route('**/api/players',route=>route.fulfill({json:{players:[{id:'1',alias:'Ana demo SQL'},{id:'2',alias:'Zoe'},{id:'3',alias:'TEST-123'},{id:'4',alias:'Prueba temporal'},{id:'5',alias:'UI Ana abcd1234'}],mode:'persistent'}}));
 await page.route(/\/api\/players\/[12]\/collection$/,route=>route.fulfill({json:{cards:catalog.slice(0,10).map((c:object)=>({...c,quantity:route.request().url().includes('/2/')?1:2})),mode:'persistent'}}));
 await page.goto('/#/coleccion');
 const select=page.getByLabel('Jugador de la colección');
 await expect(select.locator('option')).toHaveText(['Zoe','Ana demo SQL']);
 expect(await select.locator('optgroup').evaluateAll(groups=>groups.map(g=>g.getAttribute('label')))).toEqual(['Jugadores','Demostración']);
 await select.selectOption('2');
 const random=page.getByRole('button',{name:'Armar mazo aleatorio de 20 cartas',exact:true});
 await expect(random).toBeEnabled();await random.click();
 await expect(page.getByText('Tu colección no tiene veinte cartas disponibles para armar un mazo.')).toBeVisible();
 await select.selectOption('1');await expect(random).toBeEnabled();await random.click();
 await expect(page.getByLabel('Propietario del mazo')).toHaveValue('1');
 expect(await page.locator('.deck-entry strong').allTextContents()).toEqual(Array(10).fill('×2'));
 for(const label of ['Propietario del mazo']) {
   const text=await page.getByLabel(label,{exact:true}).locator('option').allTextContents();
   expect(text.join(' ')).not.toMatch(/TEST|Prueba|UI Ana/);
 }
 await page.getByRole('link',{name:'Jugar',exact:true}).click();
 for(const label of ['Jugador 1','Jugador 2'])expect((await page.getByLabel(label,{exact:true}).locator('option').allTextContents()).join(' ')).not.toMatch(/TEST|Prueba|UI Ana/);
 await page.route('**/api/players/*/duels',route=>route.fulfill({json:{duels:[],mode:'persistent'}}));
 await page.goto('/#/arena');
 await expect(page.getByLabel('Jugador para recuperar partida').locator('option')).toHaveCount(2);
});
