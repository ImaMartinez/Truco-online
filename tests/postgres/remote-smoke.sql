-- Run only on TrucoOnline via trusted administrator. All fixtures/memberships roll back.
BEGIN;
DO $$ BEGIN EXECUTE format('GRANT ta_engine_server TO %I',current_user); END $$;
SET LOCAL ROLE ta_engine_server;
DO $$
DECLARE p1 bigint; p2 bigint; d1 bigint; d2 bigint; receipt jsonb; s jsonb; own jsonb; card jsonb;
 actor bigint; game bigint; key uuid; replay jsonb; turn_number integer; round integer;
 entries jsonb:='[{"cardId":"BAS-01","quantity":2},{"cardId":"BAS-02","quantity":2},{"cardId":"BAS-03","quantity":2},{"cardId":"BAS-04","quantity":2},{"cardId":"BAS-05","quantity":2},{"cardId":"BAS-06","quantity":2}]';
BEGIN
 FOR round IN 1..2 LOOP
  p1:=truco_arena_der.ta_crear_jugador('pg-smoke-'||left(gen_random_uuid()::text,24));
  p2:=truco_arena_der.ta_crear_jugador('pg-smoke-'||left(gen_random_uuid()::text,24));
  PERFORM set_config('ta.player_id',p1::text,true);d1:=truco_arena_der.ta_guardar_mazo(NULL,'smoke',entries);
  PERFORM set_config('ta.player_id',p2::text,true);d2:=truco_arena_der.ta_guardar_mazo(NULL,'smoke',entries);
  PERFORM set_config('ta.player_id',p1::text,true);key:=gen_random_uuid();
  receipt:=truco_arena_der.ta_iniciar_partida(key,d1,p2,d2);game:=(receipt->>'id')::bigint;
  replay:=truco_arena_der.ta_iniciar_partida(key,d1,p2,d2);
  ASSERT replay->>'id'=game::text AND (replay->>'replayed')::boolean;
  s:=truco_arena_der.ta_estado_privado(game);
  ASSERT (s->'players'->0->>'handCount')::integer=3 AND (s->'players'->1->>'handCount')::integer=3;
  FOR own IN SELECT value FROM jsonb_array_elements(s->'players') LOOP
   ASSERT (own->>'deckCount')::integer=9;
   ASSERT jsonb_array_length(own->'cards')=CASE WHEN own->>'id'=p1::text THEN 3 ELSE 0 END;
  END LOOP;
  LOOP
   turn_number:=(s->>'turn')::integer;
   SELECT value INTO own FROM jsonb_array_elements(s->'players') WHERE (value->>'position')::integer=(s->>'activePosition')::integer;
   actor:=(own->>'id')::bigint;PERFORM set_config('ta.player_id',actor::text,true);s:=truco_arena_der.ta_estado_privado(game);
   IF round=2 AND turn_number=19 THEN
    SELECT value INTO card FROM jsonb_array_elements((SELECT value->'cards' FROM jsonb_array_elements(s->'players') WHERE value->>'id'=actor::text)) WHERE value->>'cardId'='BAS-01' LIMIT 1;
    PERFORM truco_arena_der.ta_actuar(gen_random_uuid(),game,(s->>'version')::bigint,jsonb_build_object('type','play','instanceId',card->>'id'));
    s:=truco_arena_der.ta_estado_privado(game);
   END IF;
   IF round=2 AND turn_number>19 THEN
    SELECT value INTO own FROM jsonb_array_elements(s->'players') WHERE value->>'id'=actor::text;
    IF EXISTS(SELECT FROM jsonb_array_elements(own->'cards') c WHERE c->>'id'=card->>'id' AND c->>'zone'='CAMPO') THEN
     key:=gen_random_uuid();receipt:=truco_arena_der.ta_actuar(key,game,(s->>'version')::bigint,jsonb_build_object('type','attack','attackerId',card->>'id','targetId','hero'));
     replay:=truco_arena_der.ta_actuar(key,game,(s->>'version')::bigint,jsonb_build_object('type','attack','attackerId',card->>'id','targetId','hero'));
     ASSERT (replay->>'replayed')::boolean;
     s:=truco_arena_der.ta_estado_privado(game);
    END IF;
   END IF;
   EXIT WHEN s->>'status'='finished';
   PERFORM truco_arena_der.ta_actuar(gen_random_uuid(),game,(s->>'version')::bigint,'{"type":"endTurn"}');
   s:=truco_arena_der.ta_estado_privado(game);
   EXIT WHEN s->>'status'='finished';
  END LOOP;
  IF round=1 THEN ASSERT s->>'reason'='LIMITE_TURNOS' AND (s->>'turn')::integer=30 AND s->>'winnerPosition' IS NULL;
  ELSE ASSERT s->>'reason'='VIDA_CERO'; END IF;
 END LOOP;
END $$;
ROLLBACK;
SELECT 'PASS remote PostgreSQL: reparto privado, replay, turnos, empate 30 y victoria letal; fixtures revertidos' AS result;
