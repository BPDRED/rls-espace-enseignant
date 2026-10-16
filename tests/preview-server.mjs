// Local integration harness only. Never included in the published dist directory.
import http from'node:http';import{readFile,readdir,mkdir}from'node:fs/promises';import{resolve,join,extname}from'node:path';import{build}from'esbuild';import{PGlite}from'@electric-sql/pglite';import{allowedPath,parseRoster}from'../supabase/functions/rls-gateway/core.mjs';
const root=process.env.RLS_TEST_WORKSPACE;if(!root)throw Error('RLS_TEST_WORKSPACE required');
const temp='/tmp/rls-web-browser-tests',port=4173,base=`http://127.0.0.1:${port}`,prefix='/rls-espace-enseignant/',user='10000000-0000-0000-0000-000000000001';await mkdir(temp,{recursive:true});
await build({entryPoints:['web/app.mjs'],bundle:true,format:'esm',outfile:temp+'/app.js',plugins:[{name:'local-test-config',setup(b){b.onLoad({filter:/web\/config\.js$/},()=>({contents:`export const CONFIG={url:'${base}',key:'public-test-key'}`,loader:'js'}))}}]});
const db=new PGlite();await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;`);for(const f of ['202610150001_teacher_records.sql','202610150002_owner_identity.sql','20261016071242_private_rpc_implementation.sql'])await db.exec(await readFile('supabase/migrations/'+f,'utf8'));await db.exec(`insert into rls_private.teacher_emails values('teacher@example.test');insert into auth.users values('${user}','teacher@example.test',now());set role authenticated;set "request.jwt.claim.sub"='${user}'`);
const claims={sub:user,aud:'authenticated',role:'authenticated',iss:base+'/auth/v1',exp:Math.floor(Date.now()/1000)+86400,iat:Math.floor(Date.now()/1000),email:'teacher@example.test'},token=Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')+'.'+Buffer.from(JSON.stringify(claims)).toString('base64url')+'.test-signature';
const files=[];async function walk(dir){for(const entry of await readdir(join(root,dir),{withFileTypes:true})){if(entry.name.startsWith('.'))continue;const p=dir+entry.name;if(entry.isDirectory())await walk(p+'/');else if(allowedPath(p))files.push({path:p,size:0})}}
for(const d of await readdir(root))if(d.startsWith('01 - ')||d.startsWith('02 - ')||d.startsWith('03 - ')||d.startsWith('04 - '))await walk(d+'/');
const calendar=JSON.parse(await readFile(join(root,files.find(f=>f.path.endsWith('/calendrier_seances.json')).path),'utf8')),roster=Object.fromEntries(['3AEP','4AEP','5AEP','6AEP'].map(level=>[level,['EXEMPLE Prénom','AUTRE Exemple']])),catalog={files,calendar,roster,revision:'a'.repeat(40)};let failNext=false;
const authUser={id:user,aud:'authenticated',role:'authenticated',email:'teacher@example.test',email_confirmed_at:new Date().toISOString(),app_metadata:{provider:'email',providers:['email']},user_metadata:{},created_at:new Date().toISOString()};
const server=http.createServer(async(req,res)=>{const u=new URL(req.url,base),send=(body,status=200,type='application/json')=>{res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store'});res.end(type==='application/json'?JSON.stringify(body):body)};try{
 if(u.pathname==='/__test/login'){res.writeHead(302,{Location:prefix+'#'+new URLSearchParams({access_token:token,refresh_token:'test-refresh',token_type:'bearer',expires_in:'3600',type:'magiclink'})});return res.end()}
 if(u.pathname==='/__test/fail-next'){failNext=true;return send({ok:true})}
 if(u.pathname==='/__test/stats')return send((await db.query('select points,remark,version,(select count(*) from public.rls_student_events)::integer as events from public.rls_student_records')).rows);
 if(u.pathname.startsWith(prefix)){
  const p=u.pathname.slice(prefix.length)||'index.html';if(p.includes('..'))return send({},400);const data=await readFile(p==='app.js'?temp+'/app.js':join('dist',p));return send(data,200,({'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css'}[extname(p)]||'application/octet-stream'));
 }
 if(req.headers.authorization!=='Bearer '+token)return send({error:'not authorized'},401);
 if(u.pathname==='/auth/v1/user')return send(authUser);
 if(u.pathname==='/auth/v1/logout')return send({});
 if(u.pathname==='/functions/v1/rls-gateway/catalog')return send(catalog);
 if(u.pathname==='/functions/v1/rls-gateway/file'){
  const path=u.searchParams.get('path');if(!allowedPath(path)||!resolve(root,path).startsWith(resolve(root)+'/'))return send({},400);const data=await readFile(join(root,path));return send(data,200,({'.html':'text/html','.pdf':'application/pdf','.png':'image/png','.css':'text/css','.js':'application/javascript','.md':'text/plain'}[extname(path)]||'application/octet-stream'));
 }
 if(u.pathname==='/rest/v1/rls_student_records')return send((await db.query('select * from public.rls_student_records')).rows);
 if(u.pathname==='/rest/v1/rls_student_events')return send((await db.query('select * from public.rls_student_events where class_id=$1 order by created_at desc,id desc limit 100',[(u.searchParams.get('class_id')||'').replace(/^eq\./,'')])).rows);
 if(u.pathname==='/rest/v1/rpc/rls_change_student'){
  let body='';for await(const c of req)body+=c;const p=JSON.parse(body),r=(await db.query('select public.rls_change_student($1,$2,$3,$4,$5,$6) as r',[p.p_class_id,p.p_student_name,p.p_request_id,p.p_delta,p.p_remark,p.p_expected_version])).rows[0].r;
  if(failNext){failNext=false;return send({message:'Test : réponse perdue après commit.'},503)}return send(r);
 }
 send({error:'unknown route'},404);
}catch(e){send({message:e.message,code:e.code},e.code==='40001'?409:500)}});server.listen(port,'127.0.0.1',()=>console.log('Local integration preview: '+base+'/__test/login'));
