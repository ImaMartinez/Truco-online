import {readFile} from 'node:fs/promises';
export const currentMigrations=['20261111151817_arena_profiles_web.sql','20261111153232_arena_profiles_claim_subject.sql','20261111153756_arena_web_private_gateway.sql','20261111160453_arena_cpu_engine.sql','20261111164349_arena_online_rooms.sql','20261111202129_arena_online_deadlines.sql'];
export async function applyCurrent(c){
 await c.query("CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$");
 for(const f of currentMigrations){await c.query('BEGIN');await c.query(await readFile('supabase/migrations/'+f,'utf8'));await c.query('COMMIT');}
}
