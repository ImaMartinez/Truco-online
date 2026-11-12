// Reproducible fresh-install artifact. Never connects to a database.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const directory='database/postgres/install';
const baseline=JSON.parse(await readFile(directory+'/baseline-source.json','utf8'));
const migrations=['20261111145947_arena_engine_v1.sql','20261111151817_arena_profiles_web.sql','20261111153232_arena_profiles_claim_subject.sql','20261111153756_arena_web_private_gateway.sql','20261111160453_arena_cpu_engine.sql','20261111164349_arena_online_rooms.sql','20261111202129_arena_online_deadlines.sql','20261112220307_arena_close_cpu_and_switch_online.sql'];
const sources=[];
const section=(name,body)=>{sources.push({name,sha256:createHash('sha256').update(body).digest('hex')});return `\n-- ==================== ${name} ====================\n${body}\nSET LOCAL search_path = public, pg_catalog;\n`;};
let sql=`-- TRUCOONLINE: INSTALACION COMPLETA DESDE CERO (PostgreSQL 17+).
-- Generado con: node scripts/build-postgres-install.mjs
-- No contiene usuarios, partidas, contrasenas ni secretos del proyecto publicado.
-- Ejecutar UNA VEZ como postgres en una base NUEVA llamada truco_arena_local.
-- psql -h 127.0.0.1 -U postgres -d truco_arena_local -v ON_ERROR_STOP=1 -f TrucoOnline-completo.sql
-- Para Supabase NUEVO: cambiar SOLO la siguiente linea a 'supabase-new'.
-- En postgres-local, auth.users/auth.uid son compatibilidad SQL de desarrollo,
-- NO un servidor de autenticacion ni un validador de tokens. Ver LEEME.md.
BEGIN;
SET LOCAL truco.install_target = 'postgres-local';
SET LOCAL TIME ZONE 'UTC';
SET LOCAL lock_timeout = '5s';
DO $install_guard$
BEGIN
 IF current_setting('server_version_num')::integer < 170000 THEN RAISE EXCEPTION 'Se requiere PostgreSQL 17 o posterior'; END IF;
 IF to_regnamespace('truco_arena_der') IS NOT NULL THEN RAISE EXCEPTION 'INSTALACION_EXISTENTE: usar una base nueva; no se reemplazan datos'; END IF;
 IF current_setting('truco.install_target') = 'postgres-local' THEN
  IF current_database() <> 'truco_arena_local' THEN RAISE EXCEPTION 'El modo local solo instala en la base truco_arena_local'; END IF;
  IF to_regnamespace('auth') IS NOT NULL THEN RAISE EXCEPTION 'El modo local requiere una base sin esquema auth'; END IF;
 ELSIF current_setting('truco.install_target') = 'supabase-new' THEN
  IF to_regclass('auth.users') IS NULL OR to_regprocedure('auth.uid()') IS NULL THEN RAISE EXCEPTION 'Se requiere una instancia Supabase inicializada'; END IF;
 ELSE RAISE EXCEPTION 'Destino de instalacion invalido';
 END IF;
 IF EXISTS(SELECT FROM pg_roles WHERE rolname IN ('ta_engine_owner','ta_engine_server','ta_cpu_worker','ta_timer_runner','ta_cpu_node')) THEN
  RAISE EXCEPTION 'ROLES_EXISTENTES: usar una instancia PostgreSQL aislada sin roles TrucoOnline';
 END IF;
END $install_guard$;
DO $install_auth$
BEGIN
 IF current_setting('truco.install_target') = 'postgres-local' THEN
  IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN NOBYPASSRLS; END IF;
  IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN NOBYPASSRLS; END IF;
  CREATE SCHEMA auth;
  CREATE TABLE auth.users(id uuid PRIMARY KEY);
  EXECUTE $uid$CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE SET search_path=pg_catalog AS $body$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $body$$uid$;
  REVOKE ALL ON SCHEMA auth FROM PUBLIC,anon,authenticated;
  REVOKE ALL ON auth.users FROM PUBLIC,anon,authenticated;
  REVOKE ALL ON FUNCTION auth.uid() FROM PUBLIC,anon,authenticated;
  COMMENT ON SCHEMA auth IS 'Compatibilidad SQL local de TrucoOnline; NO implementa Supabase Auth ni valida JWT';
 END IF;
END $install_auth$;
`;
for(const r of baseline){assert.equal(r.statements.length,1);const original=r.statements[0];assert.ok(!/CREATE\s+ROLE|PASSWORD\s+'|INSERT\s+INTO\s+(?:truco_arena_der\.)?(?:jugador|partida)\b/i.test(original));sql+=section(r.version+'_'+r.name,original.replace(/^\s*(?:BEGIN|COMMIT);\s*$/gm,''));}
const catalog=JSON.parse(await readFile('backend/src/demo/catalog.json','utf8')).cards;
assert.equal(catalog.length,40);const literal=x=>typeof x==='number'?String(x):"'"+String(x).replaceAll("'","''")+"'";
const columns=['id_carta','nombre','palo','numero','ataque_base','vida_base','costo_energia','jerarquia_truco'];
const rows=catalog.map(c=>[c.id,c.name,c.suit,c.number,c.attack,c.health,c.cost,c.hierarchy]);
assert.ok(rows.every(r=>r.every(x=>x!==undefined)));
sql+=section('catalogo_original_40_cartas',`INSERT INTO truco_arena_der.carta (${columns.join(',')}) VALUES\n${rows.map(r=>'('+r.map(literal).join(',')+')').join(',\n')};`);
for(const f of migrations)sql+=section(f,await readFile('supabase/migrations/'+f,'utf8'));
sql+=section('login_cpu_sin_credenciales',`-- Bloqueado hasta que cada administrador configure SU propia clave.
CREATE ROLE ta_cpu_node NOLOGIN NOBYPASSRLS NOINHERIT;
GRANT ta_cpu_worker TO ta_cpu_node WITH INHERIT FALSE, SET TRUE;
DO $connect$ BEGIN EXECUTE format('GRANT CONNECT ON DATABASE %I TO ta_cpu_node',current_database()); END $connect$;`);
const cron=await readFile('supabase/migrations/20261111202132_arena_deadline_cron.sql','utf8');
sql+=section('20261111202132_arena_deadline_cron.sql (condicional)',`DO $install_cron$
BEGIN
 IF EXISTS(SELECT FROM pg_available_extensions WHERE name='pg_cron') AND
    (EXISTS(SELECT FROM pg_extension WHERE extname='pg_cron') OR
     (current_setting('shared_preload_libraries') LIKE '%pg_cron%' AND
      coalesce(nullif(current_setting('cron.database_name',true),''),'postgres')=current_database())) THEN
  EXECUTE $cron_source$${cron}$cron_source$;
 ELSE
  RAISE NOTICE 'CRON_NO_DISPONIBLE: motor instalado; los turnos online NO vencen automaticamente hasta programar ta_online_tick() cada segundo. Ver LEEME.md';
 END IF;
END $install_cron$;`);
sql+=`\nDO $verify$
BEGIN
 IF (SELECT count(*) FROM pg_tables WHERE schemaname='truco_arena_der')<>16 THEN RAISE EXCEPTION 'Verificacion: se esperaban 16 tablas'; END IF;
 IF (SELECT count(*) FROM pg_constraint WHERE connamespace='truco_arena_der'::regnamespace AND contype='f')<>28 THEN RAISE EXCEPTION 'Verificacion: se esperaban 28 FK'; END IF;
 IF (SELECT count(*) FROM truco_arena_der.carta)<>40 THEN RAISE EXCEPTION 'Verificacion: se esperaban 40 cartas'; END IF;
 IF EXISTS(SELECT FROM pg_class WHERE relnamespace='truco_arena_der'::regnamespace AND relkind='r' AND NOT relrowsecurity) THEN RAISE EXCEPTION 'Verificacion: falta RLS'; END IF;
END $verify$;
COMMIT;
SELECT 'Instalacion SQL completada' AS resultado,
 (SELECT count(*) FROM pg_tables WHERE schemaname='truco_arena_der') AS tablas,
 (SELECT count(*) FROM pg_constraint WHERE connamespace='truco_arena_der'::regnamespace AND contype='f') AS relaciones_fk,
 (SELECT count(*) FROM truco_arena_der.carta) AS cartas;
`;
await mkdir(directory,{recursive:true});const target=directory+'/TrucoOnline-completo.sql';
if(process.argv.includes('--check')){assert.equal(await readFile(target,'utf8'),sql,'Regenerar SQL con node scripts/build-postgres-install.mjs');console.log('PASS installation SQL matches sources');}
else{await writeFile(target,sql);await writeFile(directory+'/fuentes.json',JSON.stringify({format:1,sources,artifactSha256:createHash('sha256').update(sql).digest('hex')},null,2)+'\n');console.log(`Generated ${target}: ${Buffer.byteLength(sql)} bytes, ${sources.length} source sections`);}
