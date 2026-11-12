// Regression for opening Vite with localhost instead of 127.0.0.1. Real Auth/RPC, no user profile modified.
import {chromium,expect} from '@playwright/test';
import {existsSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe')?'chrome':'msedge'});
try{
 const a=await browser.newContext(),p=await a.newPage();const alias='qa-origin-'+randomUUID().slice(0,12);
 await p.goto('http://localhost:5173/');await p.getByLabel('Tu alias').fill(alias);await p.getByRole('button',{name:'Crear mi perfil',exact:true}).click();await expect(p.getByTestId('recovery-code')).toBeVisible({timeout:25000});const code=await p.getByTestId('recovery-code').innerText();await p.getByRole('button',{name:'Ya lo guardé'}).click();
 const before=await(await p.request.get('http://localhost:5173/api/me')).json();assert.equal(before.profile.alias,alias);await p.reload();await expect(p.getByRole('link',{name:'Mi perfil',exact:true})).toBeVisible();assert.equal((await(await p.request.get('http://localhost:5173/api/me')).json()).profile.id,before.profile.id);
 const b=await browser.newContext(),q=await b.newPage();await q.goto('http://127.0.0.1:5173/');await q.getByRole('button',{name:'Recuperar perfil',exact:true}).click();await q.getByLabel('Código privado de recuperación').fill(code);await q.getByRole('button',{name:'Recuperar mi perfil',exact:true}).click();await expect(q.getByTestId('recovery-code')).toBeVisible({timeout:25000});await q.getByRole('button',{name:'Ya lo guardé'}).click();assert.equal((await(await q.request.get('http://127.0.0.1:5173/api/me')).json()).profile.id,before.profile.id);
 const hostile=await q.request.post('http://127.0.0.1:5173/api/profile/rotate',{headers:{Origin:'https://attacker.invalid'},data:{}});assert.equal(hostile.status(),403);assert.equal((await hostile.json()).error.code,'ORIGEN_INVALIDO');
 console.log('PASS real browser: localhost profile creation, reload/session restore, recovery at 127.0.0.1 and external CSRF denied');
}finally{await browser.close();}
