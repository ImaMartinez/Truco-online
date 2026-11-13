// Read-only repository/dependency audit. Does not execute SQL or contact providers.
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname,relative} from 'node:path';
import assert from 'node:assert/strict';

const git=(...a)=>execFileSync('git',a,{encoding:'utf8'});
const deleted=new Set(git('ls-files','--deleted','-z').split('\0'));
const paths=[...new Set(git('ls-files','--cached','--others','--exclude-standard','-z').split('\0').filter(f=>f&&!deleted.has(f)))].sort();
const hash=b=>createHash('sha256').update(b).digest('hex');
const textFiles=new Map(),files=[];
function role(p){
 if(p==='docs/etapa-0/02-cartas-y-equilibrio.md')return 'build input: catalog source and provenance hash';
 if(p==='tests/postgres/schema-baseline.json')return 'PostgreSQL test input fixture; not generated QA output';
 if(p==='truco_arena_sprites/sprites.json')return 'frontend import: card codes, suits and values';
 if(p==='truco_arena_sprites/checksums.json')return 'regression input: immutable canonical asset hashes';
 if(p.startsWith('frontend/public/'))return 'runtime public assets';
 if(/^(frontend\/src|backend\/src|shared\/)/.test(p))return 'runtime/build source (all existing modules preserved)';
 if(/^(tests\/|frontend\/test\/|backend\/test\/|playwright)/.test(p))return 'test source/configuration/fixture; effects documented in docs/pruebas.md';
 if(p.startsWith('scripts/'))return 'installation, catalog, reproducible SQL/diagram or audit tool';
 if(p.startsWith('supabase/migrations/'))return 'existing SQL migration history; never applied by this audit';
 if(p.startsWith('database/'))return 'SQL, sources, manifests and installation documentation';
 if(p.startsWith('docs/archivo/'))return 'historical technical decisions, separated from current instructions';
 if(p.startsWith('docs/'))return 'academic/current documentation, IA trace or review deliverable';
 if(p.includes('.env')&&p.endsWith('.example'))return 'sanitized configuration template (no private values)';
 if(p.startsWith('backend/certs/'))return 'public TLS CA required by persistent runtime';
 if(['Dockerfile','.dockerignore','vercel.ts','.vercelignore'].includes(p)||p.startsWith('infrastructure/'))return 'deployment build/routing contract';
 return 'project manifest, lockfile, settings or entry documentation';
}
for(const p of paths){const b=await readFile(p);files.push({path:p,bytes:b.length,sha256:hash(b),purpose:role(p)});if(/\.(?:mjs|ts|tsx|json|md|css)$/.test(p))textFiles.set(p,b.toString('utf8'));}
const unresolvedImports=[],generatedBuildImports=[];
for(const [p,s]of textFiles){if(!/\.(?:ts|tsx|mjs)$/.test(p))continue;
 for(const m of s.matchAll(/(?:\bfrom\s*|\bimport\s*\(|\bimport\s*)['"]([^'"]+)['"]/g)){
  if(!m[1].startsWith('.'))continue;const base=resolve(dirname(p),m[1]);
  // This import is source text passed to node -e with cwd=the temporary build,
  // not an import resolved relative to this test file. Its production import
  // is actually exercised by test:deployment:build after tsc and npm prune.
  if(p==='tests/deployment/clean-build.mjs'&&m[1]==='./backend/dist/backend/src/supabase-app.js'){
   await access('backend/src/supabase-app.ts');generatedBuildImports.push({file:p,import:m[1],verifiedBy:'test:deployment:build'});continue;
  }
  const candidates=[base,base+'.ts',base+'.tsx',base+'.mjs',base+'.json',base+'/index.ts',base+'/index.tsx'];
  if(base.endsWith('.js'))candidates.push(base.slice(0,-3)+'.ts',base.slice(0,-3)+'.tsx');
  let found=false;for(const c of candidates)try{await access(c);found=true;break;}catch{}
  if(!found)unresolvedImports.push({file:p,import:m[1]});
 }
}
const brokenReadmeLinks=[];
for(const p of ['README.md','README-INSTALACION-XAMPP.md','docs/README.md','docs/entrega/README.md','docs/revision-final/README.md']){
 const s=await readFile(p,'utf8');for(const m of s.matchAll(/\]\(([^)]+)\)/g)){
  if(/^(https?:|mailto:|#)/.test(m[1]))continue;const dest=m[1].split('#')[0];
  try{await access(resolve(dirname(p),dest));}catch{brokenReadmeLinks.push({file:p,target:m[1]});}
 }
}
const manifest=JSON.parse(await readFile('truco_arena_sprites/sprites.json','utf8'));
const hashes=JSON.parse(await readFile('truco_arena_sprites/checksums.json','utf8')).files;
assert.equal(manifest.cards.length,40);assert.equal(Object.keys(hashes).length,80);
for(const c of manifest.cards)for(const ext of ['png','webp']){const n=c.code+'.'+ext;assert.equal(hash(await readFile('frontend/public/cards/v3/'+n)),hashes[n]);}
const required=['Dockerfile','.dockerignore','.vercelignore','vercel.ts','infrastructure/vercel-config.mjs','backend/certs/supabase-prod-ca-2021.crt','backend/tsconfig.json','shared/contracts.ts','shared/deck-rules.ts','scripts/extract-catalog.mjs','docs/etapa-0/02-cartas-y-equilibrio.md','database/postgres/install/baseline-source.json'];for(const f of required)await access(f);
const groups={};for(const f of files){const key=f.path.includes('/')?f.path.split('/')[0]:'root';const g=groups[key]??={files:0,bytes:0};g.files++;g.bytes+=f.bytes;}
const result={date:new Date().toISOString(),files,groups,unresolvedImports,generatedBuildImports,brokenReadmeLinks,canonicalSprites:80,sharedContractsPresent:true,deploymentInputsPresent:true,sqlExecuted:false,limitations:['Static import scan covers literal imports; dynamic file/URL dependencies also reviewed manually and exercised by build/tests','Remote provider settings and actual container daemon are outside this read-only audit']};
await mkdir('artifacts/cleanup-review',{recursive:true});await writeFile('artifacts/cleanup-review/inventory.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({files:files.length,bytes:files.reduce((n,f)=>n+f.bytes,0),unresolvedImports,brokenReadmeLinks,canonicalSprites:80,deploymentInputsPresent:true},null,2));
if(unresolvedImports.length||brokenReadmeLinks.length)process.exitCode=1;
