import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {COMPUTER_DECK_DESCRIPTION} from '../../frontend/src/deckDirectory';

test('old PC decks stay out of the editor and selectors; new memory snapshots are released after confirmation',async({page,request})=>{
 const entries=['ESP-01','ESP-02','ESP-03','ESP-04','ESP-05','ESP-06','ESP-07','ESP-10','ESP-11','ESP-12'].map(cardId=>({cardId,quantity:2}));
 const old=await(await request.post('/api/decks',{data:{name:`PC · ${randomUUID()}`,description:COMPUTER_DECK_DESCRIPTION,entries}})).json();
 const personal=await(await request.post('/api/decks',{data:{name:'Mi mazo PC favorito',description:'Hecho por el jugador',entries}})).json();
 await page.goto('/#/mazos');await expect(page.getByText(old.name,{exact:true})).toHaveCount(0);await expect(page.getByText(personal.name,{exact:true})).toBeVisible();
 await page.reload();await expect(page.getByText(old.name,{exact:true})).toHaveCount(0);
 for(let index=0;index<3;index++){
  await page.goto('/#/jugar');await expect(page.getByLabel('Mazo del jugador 1',{exact:true})).not.toContainText(old.name);
  const saved=page.waitForResponse(r=>r.url().endsWith('/api/decks')&&r.request().method()==='POST');
  const started=page.waitForResponse(r=>r.url().endsWith('/api/duels')&&r.request().method()==='POST');
  const removed=page.waitForResponse(r=>r.url().includes('/api/decks/')&&r.request().method()==='DELETE');
  await page.getByRole('button',{name:'Jugar contra la PC',exact:true}).click();
  const automatic=await(await saved).json();const duel=await(await started).json();
  const cleanup=await removed;expect(cleanup.status()).toBe(200);expect(cleanup.url()).toContain(automatic.id);
  const decks=(await(await request.get('/api/decks')).json()).decks;
  expect(decks.some((d:{id:string})=>d.id===automatic.id)).toBe(false);expect(decks.some((d:{id:string})=>d.id===old.id)).toBe(true);expect(decks.some((d:{id:string})=>d.id===personal.id)).toBe(true);
  const recovered=await request.get(`/api/duels/${duel.id}`);expect(recovered.status()).toBe(200);expect((await recovered.json()).players).toHaveLength(2);
  await page.goto('/#/mazos');await expect(page.getByText(automatic.name,{exact:true})).toHaveCount(0);
 }
});
