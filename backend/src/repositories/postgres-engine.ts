/** Server-only engine boundary. Deliberately NOT mounted on the unauthenticated local API. */
import {Pool,type PoolConfig,type PoolClient} from 'pg';
import {randomUUID} from 'node:crypto';
import type {DeckEntry,DuelAction} from '../../../shared/contracts.js';

export const TRUCO_ONLINE_PROJECT='gjcpcbrkdjymrwktshfr';
export interface PrivateCard {id:string;cardId:string;zone:'MANO'|'CAMPO'|'DESCARTE';health:number|null;enteredTurn:number|null;lastAttackTurn:number|null}
export interface PrivateGame {
 id:string;version:number;turn:number;viewerPlayerId:string;activePosition:number;
 status:'active'|'finished';winnerPosition:number|null;reason:string|null;
 players:{id:string;name:string;position:number;life:number;energy:number;handCount:number;deckCount:number;cards:PrivateCard[]}[];
 history:Record<string,unknown>[];
}
export interface EngineReceipt {id:string;versionResult:number;replayed:boolean}
/** Must be constructed by trusted server authentication, never from req.body/ownerId. */
export interface TrustedPlayerContext {playerId:string}

export class PostgresEngine {
 private readonly pool:Pool;
 constructor(config:PoolConfig,projectId:string){
  if(projectId!==TRUCO_ONLINE_PROJECT)throw Error('Proyecto Supabase incorrecto');
  this.pool=new Pool({...config,max:5});
 }
 async close(){await this.pool.end();}
 private async transaction<T>(context:TrustedPlayerContext|undefined,work:(c:PoolClient)=>Promise<T>):Promise<T>{
  if(context&&!/^[1-9]\d*$/.test(context.playerId))throw Error('Contexto servidor inválido');
  for(let attempt=0;;attempt++){
   const c=await this.pool.connect();
   try{
    await c.query('BEGIN');await c.query('SET LOCAL ROLE ta_engine_server');
    await c.query("SET LOCAL TIME ZONE 'UTC'");
    if(context)await c.query("SELECT set_config('ta.player_id',$1,true)",[context.playerId]);
    const result=await work(c);await c.query('COMMIT');return result;
   }catch(error){
    await c.query('ROLLBACK').catch(()=>{});
    if(attempt<2&&['40001','40P01'].includes((error as {code?:string}).code??''))continue;
    throw error;
   }finally{c.release();}
  }
 }
 async createPlayer(alias:string):Promise<string>{return this.transaction(undefined,async c=>(await c.query('SELECT truco_arena_der.ta_crear_jugador($1) value',[alias])).rows[0].value);}
 async saveDeck(context:TrustedPlayerContext,name:string,entries:DeckEntry[],id:string|null=null,description=''):Promise<string>{
  return this.transaction(context,async c=>(await c.query('SELECT truco_arena_der.ta_guardar_mazo($1,$2,$3::jsonb,$4) value',[id,name,JSON.stringify(entries),description])).rows[0].value);
 }
 async deleteDeck(context:TrustedPlayerContext,id:string):Promise<void>{await this.transaction(context,c=>c.query('SELECT truco_arena_der.ta_eliminar_mazo($1)',[id]).then(()=>{}));}
 async start(context:TrustedPlayerContext,deckId:string,rivalId:string,rivalDeckId:string,requestId=randomUUID(),restart=false):Promise<EngineReceipt>{
  return this.transaction(context,async c=>(await c.query('SELECT truco_arena_der.ta_iniciar_partida($1,$2,$3,$4,$5) value',[requestId,deckId,rivalId,rivalDeckId,restart])).rows[0].value);
 }
 async act(context:TrustedPlayerContext,id:string,version:number,action:DuelAction,requestId=randomUUID()):Promise<EngineReceipt>{
  return this.transaction(context,async c=>(await c.query('SELECT truco_arena_der.ta_actuar($1,$2,$3,$4::jsonb) value',[requestId,id,version,JSON.stringify(action)])).rows[0].value);
 }
 async snapshot(context:TrustedPlayerContext,id:string):Promise<PrivateGame>{
  return this.transaction(context,async c=>(await c.query('SELECT truco_arena_der.ta_estado_privado($1) value',[id])).rows[0].value);
 }
}
