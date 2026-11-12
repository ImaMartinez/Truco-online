import {Pool,type PoolConfig} from 'pg';
import {readFileSync,existsSync} from 'node:fs';
import {decideCpu,type CpuDifficulty} from './policy.js';
import type {PrivateGame} from '../repositories/postgres-engine.js';
import type {Card} from '../../../shared/contracts.js';
export type CpuState=PrivateGame&{cpuDifficulty:CpuDifficulty;cpuPlayerId:string};
export class CpuWorker {
 private pool:Pool;private stopped=false;private running=false;private timer:ReturnType<typeof setInterval>|undefined;private cards:Card[]=[];
 private lastSuccessAt:string|null=null;private failures=0;private drain:Promise<void>=Promise.resolve();
 constructor(config:PoolConfig){this.pool=new Pool({...config,max:3,connectionTimeoutMillis:5000,idleTimeoutMillis:10000});this.pool.on('error',()=>console.error('CPU: conexión inactiva interrumpida; se recuperará.'));}
 private async query<T>(sql:string,args:unknown[]=[]):Promise<T>{const c=await this.pool.connect();try{await c.query('BEGIN; SET LOCAL ROLE ta_cpu_worker');const r=await c.query(sql,args);await c.query('COMMIT');return r.rows[0]?.value;}catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}}
 async jobs(){return this.query<string[]>('SELECT truco_arena_der.ta_cpu_jobs() value');}
 async state(id:string){return this.query<CpuState|null>('SELECT truco_arena_der.ta_cpu_state($1) value',[id]);}
 async step(s:CpuState,action=decideCpu(s,this.cards,s.cpuDifficulty)){return this.query('SELECT truco_arena_der.ta_cpu_step($1,$2,$3::jsonb) value',[s.id,s.version,JSON.stringify(action)]);}
 async sweep(){
  if(this.running||this.stopped)return;this.running=true;let done!:()=>void;this.drain=new Promise(resolve=>{done=resolve;});let failed=false;
  try{
   if(!this.cards.length)this.cards=await this.query<Card[]>('SELECT truco_arena_der.ta_cpu_catalog() value');
   // Each pass advances at most one action per game: no game monopolizes the worker.
   const jobs=await this.jobs();
   for(let i=0;i<jobs.length&&!this.stopped;i+=3)await Promise.all(jobs.slice(i,i+3).map(async id=>{
    if(this.stopped)return;
    try{const s=await this.state(id);if(s)await this.step(s);}catch(error){if(!/DESACTUALIZADO|TURNO_AJENO|FINALIZADA|CLAVE_REUTILIZADA/.test((error as Error).message)){failed=true;console.error('CPU: operación pendiente; se reintentará.');}}
   }));
  }catch{failed=true;console.error('CPU: conexión no disponible; se reintentará sin perder el estado.');}finally{if(failed)this.failures++;else{this.failures=0;this.lastSuccessAt=new Date().toISOString();}this.running=false;done();}
 }
 start(){if(this.timer)return;this.stopped=false;void this.sweep();this.timer=setInterval(()=>void this.sweep(),500);this.timer.unref();}
 status(){const stale=this.lastSuccessAt&&Date.now()-Date.parse(this.lastSuccessAt)>15000;return {configured:true,running:!!this.timer&&!this.stopped,state:this.stopped?'stopped':this.failures?'retrying':stale?'stalled':this.lastSuccessAt?'ready':'starting',lastSuccessAt:this.lastSuccessAt,consecutiveFailures:this.failures};}
 async close(){this.stopped=true;if(this.timer)clearInterval(this.timer);await this.drain;await this.pool.end();}
}
export function cpuConfiguration(env=process.env):PoolConfig{
 const host=env.CPU_DB_HOST??'';
 if(host!=='db.gjcpcbrkdjymrwktshfr.supabase.co'||env.CPU_DB_USER!=='ta_cpu_node'||!env.CPU_DB_PASSWORD)throw Error('Falta la conexión SQL limitada de CPU para TrucoOnline');
 const sourceCa=new URL('../../certs/supabase-prod-ca-2021.crt',import.meta.url);
 const ca=readFileSync(env.CPU_DB_CA_FILE??(existsSync(sourceCa)?sourceCa:new URL('../../../../certs/supabase-prod-ca-2021.crt',import.meta.url)),'utf8');
 return {host,port:5432,database:'postgres',user:env.CPU_DB_USER,password:env.CPU_DB_PASSWORD,ssl:{ca,rejectUnauthorized:true},keepAlive:true};
}
