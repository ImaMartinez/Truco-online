// Read-only source audit. Reports paths/rule names, never matched credential values.
import {execFileSync} from 'node:child_process';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']});
const files=[...new Set(git('ls-files','--cached','--others','--exclude-standard','-z').split('\0').filter(Boolean))];
const forbidden=[];
for(const file of ['backend/.env.supabase','backend/.env.mariadb','.env','frontend/.env'])try{for(const [name,value]of Object.entries(parseEnv(await readFile(file,'utf8'))))if(/PASSWORD|TOKEN|SECRET|ENCRYPTION_KEY/.test(name)&&value.length>=12)forbidden.push(value);}catch{}
const patterns=[['private-key',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],['supabase-admin',/sb_secret_[A-Za-z0-9_-]{24,}/],['github-token',/\bgh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}/],['embedded-jwt',/eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/]];
const issues=[];
for(const file of files){
 if(/(?:^|\/)(?:\.env(?:\.|$)|storage[-_]?state|auth-state|test-results|playwright-report|artifacts|\.vercel|\.railway|node_modules)(?:\/|\.|$)/i.test(file)&&!/(?:^|\/)\.env(?:\.[^/]+)?\.example$/.test(file))issues.push({file,rule:'private-or-generated-path'});
 const data=await readFile(file);for(const value of forbidden)if(data.includes(Buffer.from(value)))issues.push({file,rule:'known-local-secret'});
 if(/\.(?:ts|tsx|js|mjs|json|sql|md|example|yml|yaml|toml|css|html)$/.test(file))for(const [rule,pattern]of patterns)if(pattern.test(data.toString('utf8')))issues.push({file,rule});
}
const changed=[...new Set([...git('diff','--name-only','HEAD').trim().split('\n'),...git('ls-files','--others','--exclude-standard').trim().split('\n')].filter(Boolean))];
const classification={source:[],migrations:[],tests:[],documentation:[],configuration:[]};
for(const f of changed){const group=f.startsWith('supabase/migrations/')?'migrations':f.startsWith('docs/')||f.endsWith('README.md')?'documentation':/^(tests\/|backend\/test\/|frontend\/test\/|playwright)/.test(f)?'tests':/^(backend\/src|frontend\/src|shared\/)/.test(f)?'source':'configuration';classification[group].push(f);}
const report={date:new Date().toISOString(),filesScanned:files.length,changedFiles:changed.length,classification,issues};await mkdir('artifacts/release',{recursive:true});await writeFile('artifacts/release/source-audit.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({filesScanned:files.length,changedFiles:changed.length,categories:Object.fromEntries(Object.entries(classification).map(([k,v])=>[k,v.length])),issues},null,2));if(issues.length)process.exitCode=1;
