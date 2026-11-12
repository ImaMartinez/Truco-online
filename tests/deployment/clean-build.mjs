import {mkdir,cp,readFile,readdir,writeFile} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const root=process.cwd(),target=resolve('tmp','clean-release-'+randomUUID());
const safeEnv=Object.fromEntries(Object.entries(process.env).filter(([k])=>/^(path|systemroot|windir|userprofile|home|temp|tmp|appdata|localappdata|comspec|programfiles.*|processor_architecture)$/i.test(k)));
const sentinel='NOT_A_REAL_SECRET_DEPLOYMENT_CANARY';
async function copy(file){await mkdir(dirname(join(target,file)),{recursive:true});await cp(join(root,file),join(target,file),{recursive:true});}
async function run(args,env=safeEnv){await new Promise((done,reject)=>{const child=spawn(process.platform==='win32'?'npm.cmd':'npm',args,{cwd:target,env,windowsHide:true,shell:process.platform==='win32',stdio:['ignore','pipe','pipe']});let output='';child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b);child.once('error',reject);child.once('exit',code=>{if(code)reject(Error(output));else done();});});}
async function files(path){const out=[];for(const f of await readdir(path,{withFileTypes:true})){const p=join(path,f.name);if(f.isDirectory())out.push(...await files(p));else out.push(p);}return out;}
await mkdir(target,{recursive:true});for(const file of ['package.json','package-lock.json','backend/package.json','frontend/package.json','backend/tsconfig.json','backend/src','backend/certs','shared'])await copy(file);
await run(['ci','--workspace','backend','--include-workspace-root=false','--include=dev','--ignore-scripts']);await run(['run','build','--workspace','backend']);await run(['prune','--workspace','backend','--include-workspace-root=false','--omit=dev','--ignore-scripts']);
await new Promise((done,reject)=>{const child=spawn(process.execPath,['--input-type=module','-e',"const m=await import('./backend/dist/backend/src/supabase-app.js');if(typeof m.createSupabaseApp!=='function')process.exit(1);"],{cwd:target,env:safeEnv,windowsHide:true,stdio:'ignore'});child.once('error',reject);child.once('exit',code=>code?reject(Error('Pruned production module failed')):done());});
console.log('PASS clean backend workspace install/build/prune and production imports; bundled public CA exists');
for(const file of ['frontend/src','frontend/public','frontend/index.html','frontend/tsconfig.json','frontend/vite.config.ts','scripts/extract-catalog.mjs','docs/etapa-0/02-cartas-y-equilibrio.md','truco_arena_sprites/sprites.json'])await copy(file);
await run(['ci','--workspace','frontend','--include-workspace-root=false','--include=dev','--ignore-scripts']);await run(['run','catalog:check']);await run(['run','build','--workspace','frontend'],{...safeEnv,SESSION_ENCRYPTION_KEY:sentinel,CPU_DB_PASSWORD:sentinel,API_PROXY_SECRET:sentinel});
const generated=await files(join(target,'frontend/dist'));for(const file of generated){if(/\.(html|js|css|json|map|txt)$/.test(file))assert.ok(!(await readFile(file,'utf8')).includes(sentinel),'server secrets must not appear in public assets');assert.ok(!/\.env(?:\.|$)/.test(file));}
console.log('PASS clean frontend-only build, 40 original cards and server-secret canary absent from public assets');
await mkdir('artifacts/deployment',{recursive:true});await writeFile('artifacts/deployment/clean-build-results.json',JSON.stringify({date:new Date().toISOString(),backendCleanInstall:true,backendPrunedImport:true,frontendCleanInstall:true,secretCanaryAbsent:true,containerBuildExecuted:false,platform:process.platform},null,2));
