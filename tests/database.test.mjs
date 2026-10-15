import{test}from'node:test';import assert from'node:assert/strict';import{readFile}from'node:fs/promises';import{PGlite}from'@electric-sql/pglite';
test('PostgreSQL: access, atomic audit, retries and conflicting remarks',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid()returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated;`);
 for(const f of ['202610150001_teacher_records.sql','202610150002_owner_identity.sql'])await db.exec(await readFile('supabase/migrations/'+f,'utf8'));
 const owner='10000000-0000-0000-0000-000000000001',other='10000000-0000-0000-0000-000000000002';
 await db.exec(`insert into rls_private.teacher_emails values('teacher@example.test');insert into auth.users values('${owner}','teacher@example.test',now()),('${other}','other@example.test',now());set role authenticated;set "request.jwt.claim.sub"='${owner}';`);
 const id='20000000-0000-0000-0000-000000000001';
 const change=async request=>(await db.query('select public.rls_change_student($1,$2,$3,$4,$5,$6) as r',request)).rows[0].r;
 let r=await change(['math-3aep','ÉLÈVE Exemple',id,1,null,null]);assert.equal(r.points,1);assert.equal(r.version,1);
 r=await change(['math-3aep','ÉLÈVE Exemple',id,1,null,null]);assert.equal(r.points,1);
 assert.equal((await db.query('select count(*)::integer n from public.rls_student_events')).rows[0].n,1);
 await assert.rejects(change(['math-3aep','AUTRE Exemple',id,1,null,null]));
 r=await change(['math-3aep','ÉLÈVE Exemple','20000000-0000-0000-0000-000000000002',null,'Observation vérifiée',1]);assert.equal(r.remark,'Observation vérifiée');
 await assert.rejects(change(['math-3aep','ÉLÈVE Exemple','20000000-0000-0000-0000-000000000003',null,'Écrasement périmé',1]));
 assert.equal((await db.query('select count(*)::integer n from public.rls_student_events')).rows[0].n,2);
 assert.equal((await db.query('select remark from public.rls_student_records')).rows[0].remark,'Observation vérifiée');
 await assert.rejects(db.query('update public.rls_student_records set points=99'));
 await db.exec(`set "request.jwt.claim.sub"='${other}'`);assert.equal((await db.query('select * from public.rls_student_records')).rows.length,0);await assert.rejects(change(['math-3aep','ÉLÈVE Exemple','20000000-0000-0000-0000-000000000004',1,null,null]));
 await db.exec('reset role;set role anon');await assert.rejects(db.query('select * from public.rls_student_records'));await assert.rejects(db.query('select public.rls_is_teacher()'));
 }finally{await db.close()}
});
