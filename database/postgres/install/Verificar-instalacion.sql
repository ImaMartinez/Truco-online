-- Solo lectura. Ejecutar como postgres en la base instalada.
SELECT current_database() AS base, version() AS version_postgresql;
SELECT count(*) AS tablas,
       count(*) FILTER(WHERE c.relrowsecurity) AS tablas_con_rls
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='truco_arena_der' AND c.relkind='r';
SELECT count(*) AS relaciones_fk FROM pg_constraint
WHERE connamespace='truco_arena_der'::regnamespace AND contype='f';
SELECT count(*) AS cartas FROM truco_arena_der.carta;
SELECT id_carta,nombre,palo,numero,ataque_base,vida_base,costo_energia,jerarquia_truco
FROM truco_arena_der.carta ORDER BY palo,numero;
SELECT p.proname AS rutina, p.prosecdef AS security_definer, r.rolname AS propietario
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
JOIN pg_roles r ON r.oid=p.proowner
WHERE n.nspname='truco_arena_der' ORDER BY p.proname;
SELECT rolname,rolcanlogin,rolsuper,rolbypassrls FROM pg_roles
WHERE rolname IN ('ta_engine_owner','ta_engine_server','ta_cpu_worker','ta_cpu_node','ta_timer_runner');
SELECT tablename,
 has_table_privilege('authenticated',format('%I.%I',schemaname,tablename),'SELECT') AS lectura_directa_navegador,
 has_table_privilege('authenticated',format('%I.%I',schemaname,tablename),'UPDATE') AS escritura_directa_navegador
FROM pg_tables WHERE schemaname='truco_arena_der' ORDER BY tablename;
SELECT CASE WHEN EXISTS(SELECT FROM pg_extension WHERE extname='pg_cron')
 THEN 'pg_cron instalado: revisar sus dos jobs en cron.job'
 ELSE 'Sin pg_cron: los vencimientos ONLINE requieren scheduler de ta_online_tick()'
 END AS temporizador_automatico;
SELECT obj_description(to_regnamespace('auth'),'pg_namespace') AS nota_auth_local;
