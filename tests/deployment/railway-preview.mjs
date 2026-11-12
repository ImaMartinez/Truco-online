// Optional lifecycle verification against the already linked, explicitly selected Preview service.
import {spawn} from 'node:child_process';
import {dirname,join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import assert from 'node:assert/strict';
import {verifyPreview} from './preview.mjs';
const project='0ceb2799-958c-4881-965a-5266897c51ca',environment='32a6b309-8dd9-4267-a177-24e98f49b663',service='e8a5f8ea-b35b-49b7-91fc-1cb34385a67b';
const backend='https://truco-arena-api-preview.up.railway.app';
const npm=join(dirname(process.execPath),'node_modules/npm/bin/npx-cli.js');
const selected=['--project',project,'--environment',environment,'--service',service];
async function cli(args){return await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[npm,'--yes','@railway/cli@5.71.0',...args],{windowsHide:true,stdio:['ignore','pipe','pipe']});let out='',err='';child.stdout.on('data',b=>out+=b);child.stderr.on('data',b=>err+=b);child.on('error',reject);child.on('exit',code=>code?reject(Error('Railway lifecycle command failed: '+err.slice(0,400))):resolve(out));});}
async function health(){try{const r=await fetch(backend+'/api/health',{signal:AbortSignal.timeout(5000)});return r.ok&&(await r.json()).cpu?.state==='ready';}catch{return false;}}
async function ready(){for(let i=0;i<90;i++){const s=JSON.parse(await cli(['service','status',...selected,'--json']));if(s.status==='SUCCESS'&&!s.stopped&&await health())return;await delay(2000);}throw Error('Railway did not return to healthy');}
let stopped=false,stoppedDeployment;
async function start(){await cli(['api',`mutation { deploymentRestart(id: ${JSON.stringify(stoppedDeployment)}) }`,'--compact']);await ready();stopped=false;console.log('PASS Railway returned to one healthy replica');}
const state=JSON.parse(await cli(['status','--json']));assert.equal(state.id,project);assert.equal(state.services.edges.find(x=>x.node.id===service)?.node.name,'truco-arena-api');
// Validate both project and linked service before any lifecycle mutation.
const current=JSON.parse(await cli(['service','status','--json']));assert.equal(current.id,service);
assert.equal((await cli(['environment','list','--json'])).includes(environment),true);
try{
 await ready();
 await verifyPreview(process.env.WEB_BASE,{
  restartBackend:async()=>{await cli(['service','restart',...selected,'--yes','--json']);await delay(3000);await ready();console.log('PASS Railway restart completed');},
  stopBackend:async()=>{const s=JSON.parse(await cli(['service','status',...selected,'--json']));stoppedDeployment=s.deploymentId;assert.match(stoppedDeployment,/^[a-f0-9-]{36}$/);stopped=true;await cli(['api',`mutation { deploymentStop(id: ${JSON.stringify(stoppedDeployment)}) }`,'--compact']);let off;for(let i=0;i<30;i++){off=JSON.parse(await cli(['service','status',...selected,'--json']));if(off.stopped)break;await delay(1000);}assert.equal(off.stopped,true);assert.equal(await health(),false,'backend must be stopped during the Cron probe');console.log('PASS Railway stopped; Cron probe uses no backend');},
  startBackend:start
 });
}finally{if(stopped)await start();}
