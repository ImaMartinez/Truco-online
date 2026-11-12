import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {makeVercelConfig} from '../../infrastructure/vercel-config.mjs';
test('Vercel routes /api before SPA files, retains path/query and injects runtime-only ingress secret',()=>{
 const c=makeVercelConfig({API_BACKEND_ORIGIN:'https://api.example.test'});assert.equal(c.outputDirectory,'frontend/dist');
 const route=c.routes[0];assert.equal('/api/duels/12/actions'.replace(new RegExp(route.src),route.dest),'https://api.example.test/api/duels/12/actions');assert.equal(route.headers['Cache-Control'],'private, no-store');assert.equal(route.headers['Vercel-CDN-Cache-Control'],'no-store');assert.equal(route.transforms[0].args,'$API_PROXY_SECRET');assert.equal(c.routes[1].handle,'filesystem');assert.equal(c.routes[2].dest,'/index.html');assert.equal(c.crons,undefined);
 for(const value of [undefined,'http://127.0.0.1:4200','https://localhost','https://user@api.example.test','https://api.example.test/path','https://api.example.test/','https://api.example.test?x=1','https://placeholder.invalid'])assert.throws(()=>makeVercelConfig({API_BACKEND_ORIGIN:value}));
});
test('upload contexts exclude private environment files, runtime backend code and operational artifacts',async()=>{
 for(const f of ['.dockerignore','.vercelignore']){const s=await readFile(f,'utf8');assert.ok(s.startsWith('**\n'));assert.ok(s.includes('**/.env*'));assert.ok(!s.includes('!backend/.env'));}
 const s=await readFile('.vercelignore','utf8');assert.ok(!s.includes('!backend/src/**'));assert.ok(!s.includes('!supabase/'));assert.ok(!s.includes('!artifacts/'));assert.ok(s.includes('!frontend/public/**'));assert.ok(s.includes('!truco_arena_sprites/sprites.json'));
 const d=await readFile('Dockerfile','utf8');assert.ok(d.includes('USER node'));assert.ok(d.includes('--omit=dev'));assert.ok(!d.includes('COPY . .'));assert.ok(d.includes('backend/certs'));
});
