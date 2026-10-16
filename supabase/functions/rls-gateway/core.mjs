const ROOTS=['01 - SOURCES/','02 - ESPACE PEDAGOGIQUE 2026-2027/','03 - CORRECTIONS/','04 - Vacances '];
const TYPES={html:'text/html; charset=utf-8',pdf:'application/pdf',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',svg:'image/svg+xml',css:'text/css; charset=utf-8',js:'text/javascript; charset=utf-8',json:'application/json; charset=utf-8',md:'text/plain; charset=utf-8',txt:'text/plain; charset=utf-8',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',woff2:'font/woff2',woff:'font/woff',ttf:'font/ttf',zip:'application/zip',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'};
export function allowedPath(path){
  return typeof path==='string' && ROOTS.some(p=>path.startsWith(p)) &&
    !path.split('/').some(p=>!p || p==='..' || p==='.' || p.startsWith('.')) &&
    !/[\\\x00-\x1f]/.test(path) && Object.hasOwn(TYPES,path.split('.').pop().toLowerCase());
}
export function resolvePath(path,files){
  if(files.some(f=>f.path===path))return path;
  const matches=files.filter(f=>f.path.normalize('NFC')===path.normalize('NFC'));
  return matches.length===1?matches[0].path:null;
}
export function parseRoster(text){return text.split('\n').map(l=>l.match(/^\s*\d+\.\s+(.+?)\s*$/)?.[1]).filter(Boolean);}
const encPath=p=>p.split('/').map(encodeURIComponent).join('/');
export function createHandler(env,fetcher=fetch){
  let catalogCache=null;const trees=new Map();
  const origin=env.RLS_WEB_ORIGIN || 'https://bpdred.github.io';
  const cors={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, apikey, range','Access-Control-Allow-Methods':'GET, HEAD, OPTIONS','Access-Control-Expose-Headers':'content-type, content-length, content-range, content-disposition, accept-ranges','Vary':'Origin','Cache-Control':'no-store'};
  const fail=(message,status)=>Response.json({error:message},{status,headers:cors});
  const ghHeaders={Authorization:`Bearer ${env.GITHUB_READ_TOKEN}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
  async function gh(url,extra={}){
    const r=await fetcher(url,{headers:{...ghHeaders,...extra}});
    if(!r.ok)throw new Error('github');return r;
  }
  const raw=(path,ref,extra={})=>gh(`https://raw.githubusercontent.com/BPDRED/rls-teaching/${ref}/${encPath(path)}`,extra);
  async function tree(revision){
    if(trees.has(revision))return trees.get(revision);
    const t=await(await gh(`https://api.github.com/repos/BPDRED/rls-teaching/git/trees/${revision}?recursive=1`)).json();
    if(t.truncated || !Array.isArray(t.tree))throw new Error('tree');
    const files=t.tree.filter(f=>f.type==='blob'&&allowedPath(f.path)).map(({path,size})=>({path,size}));
    if(trees.size>=4)trees.delete(trees.keys().next().value);trees.set(revision,files);return files;
  }
  async function catalog(){
    if(catalogCache && Date.now()-catalogCache.time<30000)return catalogCache.value;
    const commit=await(await gh('https://api.github.com/repos/BPDRED/rls-teaching/commits/main')).json();
    const revision=commit.sha;
    if(!/^[a-f0-9]{40}$/.test(revision))throw new Error('revision');
    const files=await tree(revision);
    const calendarPath=files.find(f=>f.path.endsWith('/calendrier_seances.json'))?.path;
    // Fail closed while the new directory layout has not been published to the private source.
    if(!calendarPath)throw new Error('layout');
    const calendar=await(await raw(calendarPath,revision)).json();
    const roster={};
    await Promise.all(['3AEP','4AEP','5AEP','6AEP'].map(async level=>{
      const f=files.find(f=>f.path===`03 - CORRECTIONS/${level}/Liste_eleves_${level}.md`);
      if(!f)throw new Error('roster');roster[level]=parseRoster(await(await raw(f.path,revision)).text());
      if(!roster[level].length)throw new Error('roster');
    }));
    const value={revision,files,calendar,roster};catalogCache={time:Date.now(),value};return value;
  }
  return async req=>{
    if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
    if(!['GET','HEAD'].includes(req.method))return fail('Méthode refusée.',405);
    if(req.headers.get('Origin') && req.headers.get('Origin')!==origin)return fail('Origine refusée.',403);
    const authorization=req.headers.get('Authorization')||'';
    if(!/^Bearer [^\s]+$/.test(authorization))return fail('Connexion requise.',401);
    try{
      const headers={Authorization:authorization,apikey:env.SUPABASE_ANON_KEY};
      const auth=await fetcher(`${env.SUPABASE_URL}/auth/v1/user`,{headers});
      if(!auth.ok)return fail('Session expirée. Reconnectez-vous.',401);
      const check=await fetcher(`${env.SUPABASE_URL}/rest/v1/rpc/rls_is_teacher`,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:'{}'});
      if(!check.ok || await check.json()!==true)return fail('Ce compte ne peut pas ouvrir cet espace.',403);
      if(!env.GITHUB_READ_TOKEN)return fail('La connexion privée aux documents reste à configurer.',503);
      const u=new URL(req.url),action=u.pathname.split('/').filter(Boolean).pop();
      if(action==='catalog')return Response.json(await catalog(),{headers:cors});
      if(action!=='file')return fail('Adresse inconnue.',404);
      const path=u.searchParams.get('path'),ref=u.searchParams.get('ref');
      if(!allowedPath(path)||!ref||!/^[a-f0-9]{40}$/.test(ref))return fail('Chemin refusé.',400);
      const range=req.headers.get('Range');
      if(range&&!/^bytes=\d*-\d*$/.test(range))return fail('Plage invalide.',416);
      const canonical=resolvePath(path,await tree(ref));if(!canonical)return fail('Fichier introuvable.',404);
      const r=await raw(canonical,ref,range?{Range:range}:{}),ext=canonical.split('.').pop().toLowerCase();
      const h=new Headers({...cors,'Content-Type':TYPES[ext],'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});
      for(const k of ['content-range','accept-ranges'])if(r.headers.has(k))h.set(k,r.headers.get(k));
      if(!r.headers.has('content-encoding')&&r.headers.has('content-length'))h.set('content-length',r.headers.get('content-length'));
      if(u.searchParams.get('download')==='1'||['docx','xlsx','zip'].includes(ext))h.set('Content-Disposition',`attachment; filename*=UTF-8''${encodeURIComponent(path.split('/').pop())}`);
      return new Response(req.method==='HEAD'?null:r.body,{status:r.status,headers:h});
    }catch{return fail('Documents momentanément indisponibles. Vérifiez la publication du dépôt privé et la connexion serveur.',503);}
  };
}
