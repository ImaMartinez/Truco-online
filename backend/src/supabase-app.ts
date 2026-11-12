import express from 'express';
import type {Request,Response,NextFunction} from 'express';
import {createClient,type Session} from '@supabase/supabase-js';
import {createCipheriv,createDecipheriv,randomBytes,createHash} from 'node:crypto';
import type {Card,DuelState,DemoPlayer} from '../../shared/contracts.js';
import type {PrivateGame} from './repositories/postgres-engine.js';
import {TRUCO_ONLINE_PROJECT} from './repositories/postgres-engine.js';
import {actionInput,deckInput,playerInput,requestIdInput} from './validation.js';
import {ApiError} from './errors.js';
import type {CpuWorker} from './cpu/worker.js';
import {requestOriginAllowed} from './request-origin.js';
import {proxyClientIp} from './proxy-boundary.js';

export interface SupabaseWebConfig {url:string;key:string;sessionKey:string;origin:string;allowedOrigins?:readonly string[];secure:boolean;proxySecret?:string;requireCpu?:boolean}
export function supabaseWebConfiguration(env=process.env):SupabaseWebConfig {
 const url=env.SUPABASE_URL??'';const key=env.SUPABASE_PUBLISHABLE_KEY??'';const sessionKey=env.SESSION_ENCRYPTION_KEY??'';
 if(url!==`https://${TRUCO_ONLINE_PROJECT}.supabase.co`||!key.startsWith('sb_publishable_')||!/^[0-9a-f]{64}$/.test(sessionKey))throw Error('Falta configuración Supabase TrucoOnline o clave de sesión válida');
 const origin=env.APP_ORIGIN??'http://127.0.0.1:5173';const secure=origin.startsWith('https://');
 if(!secure&&!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin))throw Error('HTTPS obligatorio fuera de localhost');
 const parsed=new URL(origin);if(parsed.origin!==origin||parsed.username||parsed.password)throw Error('APP_ORIGIN debe ser un origen exacto sin ruta.');
 let allowedOrigins:string[]=[origin];
 if(env.APP_ORIGINS!==undefined){
  let list:unknown;try{list=JSON.parse(env.APP_ORIGINS);}catch{throw Error('APP_ORIGINS debe ser un array JSON de orígenes exactos.');}
  if(!Array.isArray(list)||!list.length||list.length>8||list.some(v=>typeof v!=='string')||new Set(list).size!==list.length||!list.includes(origin))throw Error('APP_ORIGINS debe incluir APP_ORIGIN, sin duplicados ni entradas vacías.');
  for(const value of list){let u:URL;try{u=new URL(value);}catch{throw Error('Origen inválido en APP_ORIGINS.');}if(u.origin!==value||u.username||u.password||u.hostname.includes('*')||(secure?u.protocol!=='https:':value!==origin))throw Error('APP_ORIGINS solo permite orígenes HTTPS exactos, sin rutas ni comodines.');}
  allowedOrigins=list;
 }
 const production=env.NODE_ENV==='production';const proxySecret=env.API_PROXY_SECRET;
 if(proxySecret&&!/^[0-9a-f]{64}$/.test(proxySecret))throw Error('API_PROXY_SECRET debe contener 32 bytes hexadecimales.');
 if(production&&(!secure||!env.APP_ORIGIN||!proxySecret))throw Error('Producción requiere APP_ORIGIN HTTPS exacto y API_PROXY_SECRET.');
 return {url,key,sessionKey,origin,allowedOrigins,secure,proxySecret,requireCpu:production};
}
type SessionCookie={access_token:string;refresh_token:string;expires_at:number;validUntil:number};
export function createSupabaseApp(config:SupabaseWebConfig,cpu?:CpuWorker){
 const app=express();app.disable('x-powered-by');app.set('trust proxy',false);
 app.use((req,res,next)=>{
  res.setHeader('Cache-Control','private, no-store');res.setHeader('CDN-Cache-Control','no-store');res.setHeader('Vercel-CDN-Cache-Control','no-store');res.setHeader('Vary','Cookie');res.setHeader('X-Content-Type-Options','nosniff');
  if(req.path==='/api/health'&&['GET','HEAD'].includes(req.method))return next();
  const ip=proxyClientIp(config.proxySecret,req.get('x-arena-proxy-key'),req.get('x-vercel-forwarded-for'),req.socket.remoteAddress);
  if(!ip)return res.status(403).json({error:{code:'PROXY_NO_AUTORIZADO',message:'Acceso permitido únicamente desde la web configurada.'}});
  res.locals.clientIp=ip;next();
 });
 app.use(express.json({limit:'16kb'}));
 const cookieName=config.secure?'__Host-ta_session':'ta_session';const encryptionKey=Buffer.from(config.sessionKey,'hex');
 const client=(token?:string)=>createClient(config.url,config.key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:token?{headers:{Authorization:`Bearer ${token}`}}:undefined});
 function seal(session:SessionCookie){const iv=randomBytes(12);const cipher=createCipheriv('aes-256-gcm',encryptionKey,iv);const body=Buffer.concat([cipher.update(JSON.stringify(session),'utf8'),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),body]).toString('base64url');}
 function read(req:Request):SessionCookie|undefined{
  const raw=req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='))?.slice(cookieName.length+1);
  if(!raw)return;try{const bytes=Buffer.from(raw,'base64url');const cipher=createDecipheriv('aes-256-gcm',encryptionKey,bytes.subarray(0,12));cipher.setAuthTag(bytes.subarray(12,28));const s=JSON.parse(Buffer.concat([cipher.update(bytes.subarray(28)),cipher.final()]).toString());if(s.validUntil>Date.now())return s;}catch{/* Invalid cookies are unauthenticated, never logged. */}
 }
 function set(res:Response,s:Session){res.cookie(cookieName,seal({access_token:s.access_token,refresh_token:s.refresh_token,expires_at:s.expires_at??0,validUntil:Date.now()+30*86400000}),{httpOnly:true,secure:config.secure,sameSite:'lax',path:'/',maxAge:30*86400000});}
 function clear(res:Response){res.clearCookie(cookieName,{httpOnly:true,secure:config.secure,sameSite:'lax',path:'/'});}
 const refreshes=new Map<string,Promise<Session>>();
 async function session(req:Request,res:Response,create=false){
  let s=read(req);
  if(s&&s.expires_at*1000<Date.now()+30000){
   const hash=createHash('sha256').update(s.refresh_token).digest('hex');let refresh=refreshes.get(hash);
   if(!refresh){const token=s.refresh_token;refresh=client().auth.refreshSession({refresh_token:token}).then(({data,error})=>{if(error&&(!error.status||error.status>=500))throw new ApiError(503,'AUTH_NO_DISPONIBLE','La conexión está interrumpida. Reintentá sin cerrar la sesión.');if(error||!data.session)throw new ApiError(401,'SESION_VENCIDA','La sesión venció. Recuperá tu perfil con el código privado.');return data.session;});refreshes.set(hash,refresh);void refresh.finally(()=>{const timer=setTimeout(()=>refreshes.delete(hash),15000);timer.unref();}).catch(()=>{});}
   try{const fresh=await refresh;set(res,fresh);s={...fresh,expires_at:fresh.expires_at??0,validUntil:Date.now()+30*86400000};}catch(error){if(error instanceof ApiError&&error.status===503)throw error;clear(res);s=undefined;}
  }
  if(!s&&create){const {data,error}=await client().auth.signInAnonymously();if(error||!data.session)throw new ApiError(503,'AUTH_NO_DISPONIBLE','No se pudo abrir la sesión anónima. Revisá la configuración o esperá antes de reintentar.');set(res,data.session);s={...data.session,expires_at:data.session.expires_at??0,validUntil:Date.now()+30*86400000};}
  if(!s)return;
  const {data,error}=await client().auth.getUser(s.access_token);if(error&&(!error.status||error.status>=500))throw new ApiError(503,'AUTH_NO_DISPONIBLE','La conexión está interrumpida. Reintentá sin cerrar la sesión.');if(error||!data.user){clear(res);return;}
  return {userId:data.user.id,token:s.access_token};
 }
 async function rpc(token:string,op:string,data:Record<string,unknown>={},gateway='ta_web'){
  const {data:result,error}=await client(token).rpc(gateway,{p_op:op,p_data:data});
  const code=error?.message??result?.error;
  if(code){const status=/LIMITAD/.test(code)?429:/SALA_NO_DISPONIBLE/.test(code)?404:/SALA_FORMATO|SALA_PROPIA|INVALID[AO]|INSUFICIENTE|LLENO|NUEVA|AGOTADA|PROTEGIDO/.test(code)?400:/AJEN[AO]|PERFIL_REQUERIDO|TURNO_AJENO/.test(code)?403:/TURNO_VENCIDO|PARTIDA_FINALIZADA|SALA_PENDIENTE|SALA_YA_INICIADA|PARTIDA_ACTIVA|RESERVADO|DESACTUALIZADO|EXISTENTE|UTILIZADO|CLAVE_REUTILIZADA/.test(code)||error?.code==='23505'?409:500;
   const messages:Record<string,string>={TURNO_VENCIDO:'El tiempo de este turno terminó. Estamos recuperando el estado confirmado.',PARTIDA_FINALIZADA:'La partida ya terminó. Consultá el resultado.',CODIGO_INVALIDO:'El código no es válido o ya fue utilizado.',RECUPERACION_LIMITADA:'Demasiados intentos. Esperá 15 minutos.',PERFIL_EXISTENTE:'Esta sesión ya tiene un perfil.',PERFIL_REQUERIDO:'Primero creá o recuperá tu perfil.',SALA_NO_DISPONIBLE:'La sala no existe, venció o ya no admite jugadores.',SALA_PROPIA:'No podés unirte a tu propia sala.',SALA_FORMATO_INCOMPATIBLE:'Elegí un mazo del mismo tamaño que el del anfitrión.',SALA_PENDIENTE:'Primero continuá o cancelá tu sala de espera.',SALA_INTENTOS_LIMITADOS:'Demasiados intentos. Esperá un minuto antes de volver a probar.',SALA_YA_INICIADA:'La partida ya comenzó. Entrá al tablero para continuar.',MAZO_RESERVADO:'Ese mazo está reservado por tu sala de espera. Cancelá la sala para modificarlo.',PARTIDA_ACTIVA:'Ya tenés una partida en curso. Continuá desde Jugar o el historial.'};
   throw new ApiError(status,error?.code==='23505'?'NOMBRE_EXISTENTE':code.replace(/[^A-Z_]/g,'').slice(0,60)||'ERROR_SQL',error?.code==='23505'?'Ese alias o nombre ya existe.':messages[code]??(status===500?'No se pudo completar la operación segura.':code));}
  return result;
 }
 const bursts=new Map<string,{n:number;until:number}>();
 app.use('/api',(req,res,next)=>{
  if(!['GET','HEAD'].includes(req.method)){
   if(!requestOriginAllowed(req.get('Origin'),config.allowedOrigins??config.origin))return next(new ApiError(403,'ORIGEN_INVALIDO','Origen no permitido.'));
   if(!req.is('application/json'))return next(new ApiError(415,'JSON_REQUERIDO','Se requiere JSON.'));
   if(req.path.startsWith('/profile')||req.path.startsWith('/session')){
    const key=res.locals.clientIp;const now=Date.now();const previous=bursts.get(key);const bucket=previous&&previous.until>now?previous:{n:0,until:now+600000};bucket.n++;bursts.set(key,bucket);
    if(bursts.size>10000)for(const [k,v]of bursts)if(v.until<now)bursts.delete(k);
    if(bucket.n>30)return next(new ApiError(429,'LIMITE_SOLICITUDES','Esperá antes de volver a intentar.'));
   }
  }next();
 });
 app.get('/api/health',async(_req,res)=>{
  let connected=false;try{const r=await fetch(config.url+'/rest/v1/rpc/ta_web',{method:'POST',headers:{apikey:config.key,'Content-Type':'application/json'},body:JSON.stringify({p_op:'me'}),signal:AbortSignal.timeout(5000)});const body=await r.json();connected=body.code==='42501';}catch{/* No silent fallback to another provider. */}
  const worker=cpu?.status()??{configured:false,state:'disabled'};const ready=connected&&(!config.requireCpu||worker.state==='ready');
  res.status(ready?200:503).json({status:ready?'ok':'degraded',service:'truco-arena-api',storage:'supabase',mode:'persistent',database:connected?'connected':'unavailable',cpu:worker,agreements:'pending'});
 });
 app.get('/api/me',async(req,res)=>{const auth=await session(req,res);res.json(auth?{authenticated:true,...await rpc(auth.token,'me')}:{authenticated:false,profile:null});});
 for(const [path,op]of [['/api/profile','register'],['/api/profile/recover','recover']]as const)app.post(path,async(req,res)=>{
  const payload=op==='register'?{alias:playerInput(req.body)}:{code:typeof req.body?.code==='string'?req.body.code.trim().toLowerCase():''};
  const auth=await session(req,res,true);if(!auth)throw new ApiError(401,'SESION_REQUERIDA','No se pudo validar la sesión.');res.json(await rpc(auth.token,op,payload));
 });
 app.use('/api',async(req,res,next)=>{
  const auth=await session(req,res);if(!auth)return next(new ApiError(401,'SESION_REQUERIDA','Creá o recuperá tu perfil.'));
  res.locals.token=auth.token;const info=await rpc(auth.token,'me');if(!info.profile)return next(new ApiError(403,'PERFIL_REQUERIDO','Creá o recuperá tu perfil.'));res.locals.profile=info.profile;next();
 });
 const run=(res:Response,op:string,data:Record<string,unknown>={})=>rpc(res.locals.token,op,data);
 const roomRpc=(res:Response,op:string,data:Record<string,unknown>={})=>rpc(res.locals.token,op,data,'ta_rooms');
 const numericId=(v:unknown)=>{if(typeof v!=='string'||!/^\d{1,19}$/.test(v))throw new ApiError(400,'ID_INVALIDO','Identificador no válido.');return v;};
 const roomInput=(req:Request)=>{for(const key of ['ownerId','playerId','actorId','hostId','guestId'])if(req.body?.[key]!==undefined)throw new ApiError(403,'IDENTIDAD_DERIVADA','La identidad se obtiene de la sesión.');};
 const roomCode=(v:unknown)=>{if(typeof v!=='string'||v.length>32)throw new ApiError(400,'SALA_CODIGO_INVALIDO','Ingresá un código de ocho letras y números.');const code=v.toUpperCase().replace(/[\s-]/g,'');if(!/^[A-HJ-NP-Z2-9]{8}$/.test(code))throw new ApiError(400,'SALA_CODIGO_INVALIDO','Revisá el código de invitación.');return code.slice(0,4)+'-'+code.slice(4);};
 app.get('/api/rooms',async(_req,res)=>res.json(await roomRpc(res,'list')));
 app.get('/api/rooms/:id',async(req,res)=>res.json(await roomRpc(res,'state',{id:numericId(req.params.id)})));
 app.post('/api/rooms',async(req,res)=>{roomInput(req);res.json(await roomRpc(res,'create',{deckId:numericId(req.body?.deckId),requestId:requestIdInput(req.body?.requestId)}));});
 app.post('/api/rooms/lookup',async(req,res)=>{roomInput(req);res.json(await roomRpc(res,'lookup',{code:roomCode(req.body?.code)}));});
 app.post('/api/rooms/join',async(req,res)=>{roomInput(req);res.json(await roomRpc(res,'join',{code:roomCode(req.body?.code),deckId:numericId(req.body?.deckId),requestId:requestIdInput(req.body?.requestId)}));});
 app.post('/api/rooms/:id/cancel',async(req,res)=>{roomInput(req);res.json(await roomRpc(res,'cancel',{id:numericId(req.params.id)}));});
 // Approximate presence only: authorized successful polling is a heartbeat. No game penalty.
 const presence=new Map<string,Map<string,number>>();
 function withPresence(dto:DuelState){
  if(!dto.room||!dto.viewerPlayerId)return dto;const now=Date.now();const seen=presence.get(dto.id)??new Map<string,number>();seen.set(dto.viewerPlayerId,now);presence.set(dto.id,seen);
  const rival=dto.players.find(p=>p.id!==dto.viewerPlayerId)!;const last=seen.get(rival.id);
  dto.opponentConnection={status:last===undefined?'unknown':now-last<10000?'online':'not-recent',...(last?{lastSeen:new Date(last).toISOString()}:{} )};
  if(presence.size>500)for(const [id,p]of presence)if([...p.values()].every(t=>now-t>300000))presence.delete(id);
  return dto;
 }
 const own=(req:Request,res:Response)=>{const id=req.params.id??req.query.ownerId;if(id!==undefined&&id!==res.locals.profile.id)throw new ApiError(403,'PERFIL_AJENO','Solo podés consultar tu perfil.');};
 app.post('/api/profile/rotate',async(_req,res)=>res.json(await run(res,'rotate')));
 app.post('/api/session/logout',async(req,res)=>{await fetch(config.url+'/auth/v1/logout?scope=local',{method:'POST',headers:{apikey:config.key,Authorization:'Bearer '+res.locals.token}});clear(res);res.json({signedOut:true});});
 app.get('/api/catalog',async(_req,res)=>res.json(await run(res,'catalog')));
 app.get('/api/players',(_req,res)=>res.json({players:[res.locals.profile],mode:'persistent'}));
 app.get('/api/players/:id/collection',async(req,res)=>{own(req,res);res.json(await run(res,'collection'));});
 app.get('/api/players/:id/duels',async(req,res)=>{own(req,res);const h=await run(res,'history');res.json({...h,duels:h.duels.filter((d:{status:string})=>req.query.status!=='active'||d.status==='active')});});
 app.get('/api/history',async(_req,res)=>res.json(await run(res,'history')));
 app.get('/api/decks',async(req,res)=>{own(req,res);res.json(await run(res,'decks'));});
 async function save(req:Request,res:Response){const input=deckInput(req.body);if(input.ownerId&&input.ownerId!==res.locals.profile.id)throw new ApiError(403,'MAZO_AJENO','El mazo debe ser propio.');const saved=await run(res,'saveDeck',{...input,id:req.params.id??null});const list=await run(res,'decks');res.json(list.decks.find((d:{id:string})=>d.id===saved.id));}
 app.post('/api/decks',save);app.put('/api/decks/:id',save);
 app.delete('/api/decks/:id',async(req,res)=>{if(req.query.ownerId&&req.query.ownerId!==res.locals.profile.id)throw new ApiError(403,'MAZO_AJENO','El mazo debe ser propio.');res.json(await run(res,'deleteDeck',{id:req.params.id}));});
 async function snapshot(res:Response,id:string){const [game,catalog]=await Promise.all([run(res,'state',{id}),run(res,'catalog')]);return withPresence(privateGameDto(game,catalog.cards));}
 app.get('/api/duels/:id',async(req,res)=>res.json(await snapshot(res,String(req.params.id))));
 app.post('/api/duels/:id/actions',async(req,res)=>{
  const input=actionInput(req.body);if(input.actorId&&input.actorId!==res.locals.profile.id)throw new ApiError(403,'ACTOR_AJENO','No podés actuar por otro jugador.');
  if(!input.requestId)throw new ApiError(400,'CLAVE_REQUERIDA','Falta requestId.');
  const game=await run(res,'act',{id:req.params.id,requestId:input.requestId,expectedVersion:input.expectedVersion,action:input.action});const catalog=await run(res,'catalog');
  const dto=withPresence(privateGameDto(game,catalog.cards));dto.operation={requestId:input.requestId,replayed:game.operation.replayed,versionResult:game.operation.versionResult};res.json(dto);
 });
 app.post('/api/duels/:id/abandon',async(req,res)=>{
  if(req.body?.actorId!==undefined&&req.body.actorId!==res.locals.profile.id)throw new ApiError(403,'ACTOR_AJENO','No podés abandonar por otro jugador.');
  const version=req.body?.expectedVersion;
  if(!Number.isSafeInteger(version)||version<1||version>4294967295)throw new ApiError(400,'SOLICITUD_INVALIDA','Falta la versión válida de la partida.');
  const requestId=requestIdInput(req.body?.requestId);
  const game=await run(res,'abandon',{id:numericId(req.params.id),expectedVersion:version,requestId});
  const catalog=await run(res,'catalog');const dto=withPresence(privateGameDto(game,catalog.cards));dto.operation={requestId,...game.operation};res.json(dto);
 });
 app.post('/api/duels',async(req,res)=>{
  if(!cpu)throw new ApiError(503,'CPU_NO_DISPONIBLE','El servidor de la computadora no está disponible.');
  const {deckId,difficulty,requestId,replaceActive=false}=req.body??{};
  if(typeof deckId!=='string'||!/^[1-9]\d*$/.test(deckId)||!['facil','normal','dificil'].includes(difficulty)||typeof requestId!=='string'||!/^[0-9a-f-]{36}$/.test(requestId)||typeof replaceActive!=='boolean')throw new ApiError(400,'SOLICITUD_INVALIDA','Elegí un mazo válido y una dificultad.');
  requestIdInput(requestId);
  if(req.body.playerIds||req.body.actorId||req.body.ownerId)throw new ApiError(400,'IDENTIDAD_DERIVADA','El jugador se obtiene de su sesión.');
  const {data:game,error}=await client(res.locals.token).rpc('ta_start_cpu',{p_key:requestId,p_deck:deckId,p_difficulty:difficulty.toUpperCase(),p_restart:replaceActive});
  if(error){const known=error.code==='P0001'||/^(22|23)/.test(error.code??'');const messages:Record<string,string>={PARTIDA_ACTIVA:'Ya tenés una partida activa. Podés continuarla o confirmar empezar de cero.',MAZO_AJENO:'Elegí uno de tus mazos.',MAZO_INVALIDO:'El mazo debe tener exactamente 12 o 20 cartas.',CLAVE_REUTILIZADA:'El inicio pendiente corresponde a otra configuración.',SALA_PENDIENTE:'Continuá o cancelá tu sala de espera antes de jugar contra PC.',REINICIO_NO_CPU:'Tu partida online sigue activa. Podés continuarla desde Jugar o el historial.'};throw new ApiError(!known?503:/PARTIDA_ACTIVA|CLAVE_REUTILIZADA/.test(error.message)?409:/AJENO/.test(error.message)?403:400,error.message.replace(/[^A-Z_]/g,'').slice(0,60),messages[error.message]??'No se pudo confirmar el inicio. Volvé a intentar.');}
  const catalog=await run(res,'catalog');const dto=privateGameDto(game,catalog.cards);dto.operation={requestId,replayed:game.operation.replayed,versionResult:game.operation.versionResult};
  res.status(game.operation.replayed?200:201).json(dto);void cpu.sweep();
 });
 app.use((_req,_res,next)=>next(new ApiError(404,'RUTA_NO_ENCONTRADA','Ruta no disponible.')));
 app.use((error:unknown,_req:Request,res:Response,_next:NextFunction)=>{const parse=error as {status?:number;type?:string};const e=error instanceof ApiError?error:parse.type==='entity.too.large'?new ApiError(413,'CUERPO_GRANDE','La solicitud supera el tamaño permitido.'):parse.type==='entity.parse.failed'?new ApiError(400,'JSON_INVALIDO','El cuerpo JSON no es válido.'):new ApiError(500,'ERROR_INTERNO','No se pudo completar la operación.');if(e.status>=500)console.error(JSON.stringify({event:'api.operation_failed',code:e.code,status:e.status}));res.status(e.status).json({error:{code:e.code,message:e.message}});});
 return app;
}

export function privateGameDto(game:PrivateGame&{cpuDifficulty?:'facil'|'normal'|'dificil';cpuPlayerId?:string;finishedAt?:string;room?:DuelState['room'];onlineTimer?:DuelState['onlineTimer']},cards:Card[]):DuelState{
 const players=game.players.map(p=>{
  const own=p.id===game.viewerPlayerId;
  const instances=(zone:string)=>p.cards.filter(c=>c.zone===zone&&(zone!=='MANO'||own)).map(c=>({id:c.id,cardId:c.cardId,health:c.health??cards.find(card=>card.id===c.cardId)!.health,enteredTurn:c.enteredTurn??0,lastAttackTurn:c.lastAttackTurn}));
  const last=game.turn-((game.turn%2===p.position%2)?0:1);
  return {id:p.id,name:p.id===game.cpuPlayerId?'CPU':p.name,life:p.life,energy:p.energy,maxEnergy:last>0?Math.min(5,Math.floor((last+1)/2)):0,hand:instances('MANO'),handCount:p.handCount,field:instances('CAMPO'),discard:instances('DESCARTE'),discardCount:p.cards.filter(c=>c.zone==='DESCARTE').length,deckCount:p.deckCount};
 }) as [DemoPlayer,DemoPlayer];
 const active=players.find((_,i)=>i+1===game.activePosition)!;
 const history=game.history.map(h=>({id:`${game.id}:${h.turn}:${h.order}`,turn:Number(h.turn),order:Number(h.order),actorId:players[(Number(h.turn)+1)%2]!.id,type:h.invocation?'play' as const:'attack' as const,instanceId:String(h.invocation??h.attacker),...(h.invocation?{}:{targetId:h.hero?'hero' as const:String(h.target),previousAttackerHealth:Number(h.attackerHealthBefore),previousTargetHealth:Number(h.targetHealthBefore)})}));
 const names=new Map(game.players.flatMap(p=>p.cards.map(c=>[c.id,cards.find(card=>card.id===c.cardId)?.name??'carta'] as const)));
 const log=history.map(h=>`Turno ${h.turn}: ${players.find(p=>p.id===h.actorId)!.name} ${h.type==='play'?'invocó '+(names.get(h.instanceId)??'una carta'):(names.get(h.instanceId)??'una carta')+' atacó '+(h.targetId==='hero'?'al héroe rival':(names.get(h.targetId??'')??'a una carta'))}.`);
 return {id:game.id,version:game.version,turn:game.turn,viewerPlayerId:game.viewerPlayerId,...(game.onlineTimer?{onlineTimer:game.onlineTimer}:{}),...(game.room?{room:game.room}:{}),...(game.cpuPlayerId&&game.cpuDifficulty?{cpu:{playerId:game.cpuPlayerId,difficulty:game.cpuDifficulty}}:{}),...(game.finishedAt&&game.reason?{result:{reason:game.reason as NonNullable<DuelState['result']>['reason'],finishedAt:game.finishedAt}}:{}),activePlayerId:active.id,players,status:game.status,winnerId:game.winnerPosition?players[game.winnerPosition-1]!.id:null,mode:'persistent',scenario:'inicio',history,log};
}
