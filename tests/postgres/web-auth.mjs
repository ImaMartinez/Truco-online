// Real Supabase Auth + real HTTP + independent browser contexts. No mocked identity.
import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
const base=process.env.WEB_BASE??'http://127.0.0.1:5173';const origin=base;
const browser=await chromium.launch({channel:existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe')?'chrome':'msedge'});
const contexts=await Promise.all([0,1,2,3].map(()=>browser.newContext()));
const [a,b,c,d]=await Promise.all(contexts.map(c=>c.newPage()));
const headers={Origin:origin};const suffix=randomUUID().slice(0,8);const results=[];
const get=async(page,path)=>(await page.request.get(base+'/api'+path)).json();
const post=(page,path,data)=>page.request.post(base+'/api'+path,{headers,data});
await mkdir('artifacts/profiles',{recursive:true});
try{
 for(const [page,alias]of [[a,'qa-web-A-'+suffix],[b,'qa-web-B-'+suffix]]){
  await page.goto(base);await page.getByLabel('Tu alias').fill(alias);await page.getByRole('button',{name:'Crear mi perfil',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible({timeout:30000});
 }
 const codeA=await a.getByTestId('recovery-code').innerText();assert.match(codeA,/^[0-9a-f]{64}$/);
 await a.getByRole('button',{name:'Ya lo guardé'}).click();await b.getByRole('button',{name:'Ya lo guardé'}).click();
 const pa=(await get(a,'/me')).profile,pb=(await get(b,'/me')).profile;assert.notEqual(pa.id,pb.id);
 await a.reload();await expect(a.getByRole('link',{name:'Mi perfil',exact:true})).toBeVisible({timeout:20000});assert.equal((await get(a,'/me')).profile.id,pa.id);
 const cookie=(await contexts[0].cookies()).find(c=>c.name==='ta_session');assert.ok(cookie.httpOnly);assert.ok(!cookie.value.includes('access_token'));assert.equal(await a.evaluate(()=>Object.keys(localStorage).some(k=>/token|supabase|recovery/i.test(k))),false);
 results.push('alta real Auth anónimo, cookie HttpOnly cifrada y restauración por recarga');
 await a.getByRole('link',{name:'Mis mazos',exact:true}).click();await expect(a.getByLabel('Nombre del mazo',{exact:false})).toBeVisible({timeout:15000});
 await a.getByLabel('Nombre del mazo',{exact:false}).fill('Mazo web '+suffix);
 await a.getByRole('button',{name:'Elegir 20 cartas al azar',exact:true}).click();
 await a.getByRole('button',{name:/Guardar mazo/}).click();await expect(a.getByText(/guardado en/)).toBeVisible({timeout:20000});
 let decks=(await get(a,'/decks')).decks;const deckA=decks.find(x=>x.name==='Mazo web '+suffix);assert.ok(deckA);
 assert.equal((await get(b,'/decks')).decks.length,0);assert.equal((await b.request.get(base+'/api/players/'+pa.id+'/collection')).status(),403);
 assert.equal((await b.request.put(base+'/api/decks/'+deckA.id,{headers,data:{name:'Robado',entries:deckA.entries}})).status(),403);
 assert.equal((await post(b,'/decks',{name:'Dueño falso',ownerId:pa.id,entries:deckA.entries})).status(),403);
 const deckB=await(await post(b,'/decks',{name:'Mazo B '+suffix,entries:deckA.entries})).json();assert.ok(deckB.id);
 const changed=await a.request.put(base+'/api/decks/'+deckA.id,{headers,data:{name:deckA.name,description:'Edición verificada',entries:deckA.entries}});assert.equal(changed.status(),200);
 results.push('colección propia, mazo por UI, edición y rechazo de dueño ajeno');
 await c.goto(base);await c.getByRole('button',{name:'Recuperar perfil',exact:true}).click();await c.getByLabel('Código privado de recuperación').fill('0'.repeat(64));await c.getByRole('button',{name:'Recuperar mi perfil',exact:true}).click();await expect(c.getByRole('alertdialog')).toContainText('no es válido',{timeout:20000});
 await c.getByRole('button',{name:'Entendido',exact:true}).click();await c.getByLabel('Código privado de recuperación').fill(codeA);await c.getByRole('button',{name:'Recuperar mi perfil',exact:true}).click();await expect(c.getByTestId('recovery-code')).toBeVisible({timeout:20000});const code2=await c.getByTestId('recovery-code').innerText();assert.notEqual(code2,codeA);await c.getByRole('button',{name:'Ya lo guardé'}).click();assert.equal((await get(c,'/me')).profile.id,pa.id);
 await d.goto(base);await d.getByRole('button',{name:'Recuperar perfil',exact:true}).click();await d.getByLabel('Código privado de recuperación').fill(codeA);await d.getByRole('button',{name:'Recuperar mi perfil',exact:true}).click();await expect(d.getByRole('alertdialog')).toContainText('no es válido',{timeout:20000});
 await c.getByRole('link',{name:'Mi perfil',exact:true}).click();await c.getByRole('button',{name:'Generar código nuevo'}).click();await c.getByRole('button',{name:'Generar código nuevo',exact:true}).last().click();await expect(c.getByTestId('recovery-code')).toBeVisible();const code3=await c.getByTestId('recovery-code').innerText();assert.notEqual(code3,code2);await c.getByRole('button',{name:'Ya lo guardé'}).click();
 const old=await post(d,'/profile/recover',{code:code2});assert.equal(old.status(),400);
 assert.equal((await get(a,'/me')).profile.id,pa.id);assert.equal((await get(c,'/decks')).decks.find(x=>x.id===deckA.id).description,'Edición verificada');
 results.push('recuperación desde otro navegador, código inválido/usado, rotación y perfil histórico conservado');
 for(const item of ['Inicio','Jugar','Colección','Mis mazos','Historial','Mi perfil']){await a.getByRole('link',{name:item,exact:true}).click();await expect(a.locator('main')).toBeVisible();}
 await a.getByRole('link',{name:'Jugar',exact:true}).click();await expect(a.getByRole('link',{name:'Multijugador',exact:true})).toBeVisible();await a.screenshot({path:'artifacts/profiles/jugar.png',fullPage:true});
 const response=a.waitForResponse(r=>r.url().endsWith('/api/duels')&&r.request().method()==='POST');
 await a.getByLabel('Tu mazo',{exact:true}).selectOption(deckA.id);await a.getByLabel('Dificultad',{exact:true}).selectOption('normal');await a.getByRole('button',{name:'Iniciar partida',exact:true}).click();const start=await response;assert.equal(start.status(),201);const fixture=await start.json();
 for(const page of [a,c]){await page.goto(base+'/#/arena?partida='+fixture.id);await expect(page.locator('.battle-table')).toBeVisible({timeout:30000});const s=await get(page,'/duels/'+fixture.id);assert.equal(s.viewerPlayerId,pa.id);assert.equal(s.players.find(x=>x.id===s.cpu.playerId).hand.length,0);await expect(page.locator('.turn-curtain')).toHaveCount(0);}
 assert.equal((await b.request.get(base+'/api/duels/'+fixture.id)).status(),403);
 await expect(a.getByRole('button',{name:'Finalizar turno',exact:true})).toBeEnabled({timeout:30000});let state=await get(a,'/duels/'+fixture.id);const turn=state.turn;
 await a.getByRole('button',{name:'Finalizar turno',exact:true}).click();await expect.poll(async()=>(await get(a,'/duels/'+fixture.id)).turn,{timeout:30000}).toBeGreaterThan(turn);
 await a.reload();await expect(a.locator('.battle-table')).toBeVisible({timeout:30000});assert.ok((await get(a,'/duels/'+fixture.id)).turn>turn);
 await a.screenshot({path:'artifacts/profiles/cpu-arena.png',fullPage:true});
 await a.getByRole('button',{name:'Cómo jugar',exact:true}).click();await expect(a.getByRole('dialog')).toContainText('PostgreSQL');await expect(a.getByRole('dialog')).toContainText('automáticamente');await expect(a.getByRole('dialog')).not.toContainText('Pasá el dispositivo');await a.getByRole('button',{name:'Volver al juego',exact:true}).click();
 await a.getByRole('link',{name:'Historial',exact:true}).click();await a.getByRole('button',{name:'Actualizar historial'}).click();await expect(a.getByText('Partida #'+fixture.id,{exact:true})).toBeVisible({timeout:20000});
 results.push('partida real del motor, mano privada, acción ajena rechazada, acción válida, historial y recarga');
 await c.getByRole('link',{name:'Mi perfil',exact:true}).click();await c.screenshot({path:'artifacts/profiles/perfil.png',fullPage:true});
 await a.setViewportSize({width:390,height:844});await a.getByRole('link',{name:'Mi perfil',exact:true}).click();await a.screenshot({path:'artifacts/profiles/movil.png',fullPage:true});
 await writeFile('artifacts/profiles/web-results.json',JSON.stringify({date:new Date().toISOString(),project:'gjcpcbrkdjymrwktshfr',tests:results,passed:results.length,fixtureId:fixture.id},null,2));console.log('PASS '+results.join('; '));
}finally{await browser.close();}
