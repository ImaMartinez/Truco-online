import {createServer as httpsServer} from 'node:https';
import {request as upstreamRequest} from 'node:http';
import {spawn,execFileSync} from 'node:child_process';
import {readFile,mkdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import express from 'express';
import assert from 'node:assert/strict';
import {verifyPreview} from './preview.mjs';
const base='https://localhost:5443',backendPort=4320,secret=randomBytes(32).toString('hex'),logs=[];
let child,proxy;const env={...process.env,NODE_ENV:'production',ARENA_STORAGE:'supabase',APP_ORIGIN:base,API_PROXY_SECRET:secret,PORT:String(backendPort),BIND_HOST:'0.0.0.0'};
async function start(){
 child=spawn(process.execPath,['--env-file=backend/.env.supabase','backend/dist/backend/src/server.js'],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});child.stdout.on('data',b=>logs.push(b.toString()));child.stderr.on('data',b=>logs.push(b.toString()));
 let health;for(let i=0;i<40;i++){if(child.exitCode!==null)throw Error('Production backend exited; inspect configuration without printing credentials.');let r;try{r=await fetch(`http://127.0.0.1:${backendPort}/api/health`);}catch{await delay(400);continue;}health=await r.json();if(r.ok)return;await delay(400);}console.log(JSON.stringify({productionHealth:health}));throw Error('Production health did not become ready');
}
async function stop(){if(!child||child.exitCode!==null)return;child.kill();await new Promise(r=>child.once('exit',r));child=undefined;}
try{
 await mkdir('tmp/deployment-tls',{recursive:true});const openssl=['C:/Program Files/Git/usr/bin/openssl.exe','C:/xampp/apache/bin/openssl.exe'].find(existsSync);if(!openssl)throw Error('OpenSSL needed only to generate the isolated local HTTPS test certificate.');
 execFileSync(openssl,['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-keyout','tmp/deployment-tls/key.pem','-out','tmp/deployment-tls/cert.pem','-subj','/CN=localhost','-addext','subjectAltName=DNS:localhost,IP:127.0.0.1'],{stdio:'ignore',windowsHide:true});
 const app=express();app.use('/api',(req,res)=>{
  const upstream=upstreamRequest({hostname:'127.0.0.1',port:backendPort,path:req.originalUrl,method:req.method,headers:{...req.headers,'x-arena-proxy-key':secret,'x-vercel-forwarded-for':'127.0.0.1','x-forwarded-proto':'https'}},response=>{res.writeHead(response.statusCode,response.headers);response.pipe(res);});upstream.on('error',()=>{if(!res.headersSent)res.status(503).json({error:{code:'BACKEND_RESTARTING'}});else res.end();});req.pipe(upstream);
 });app.use(express.static('frontend/dist'));app.use((_req,res)=>res.sendFile('index.html',{root:'frontend/dist'}));
 proxy=httpsServer({key:await readFile('tmp/deployment-tls/key.pem'),cert:await readFile('tmp/deployment-tls/cert.pem')},app);await new Promise(r=>proxy.listen(5443,'127.0.0.1',r));await start();
 await verifyPreview(base,{local:true,restartBackend:async()=>{await stop();await start();},stopBackend:stop,startBackend:start});
 const output=logs.join('');for(const value of [secret,process.env.SESSION_ENCRYPTION_KEY,process.env.CPU_DB_PASSWORD])if(value)assert.ok(!output.includes(value),'no secrets in production process logs');console.log('PASS production process logs contain no session, ingress or SQL secret values');
}finally{await stop();if(proxy)await new Promise(r=>proxy.close(r));}
