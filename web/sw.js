// Documents are streamed on demand. No document, image or pupil data is cached locally.
const base=new URL('./',self.location.href),prefix=base.pathname+'documents/';
self.addEventListener('install',e=>e.waitUntil(self.skipWaiting()));
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
async function auth(clientId){
 const list=await self.clients.matchAll({type:'window',includeUncontrolled:true});
 const clients=list.filter(c=>[base.pathname,base.pathname+'index.html'].includes(new URL(c.url).pathname)).sort((a,b)=>Number(b.id===clientId)-Number(a.id===clientId));
 for(const client of clients){
  const answer=await new Promise(resolve=>{const channel=new MessageChannel(),timer=setTimeout(()=>resolve(null),1500);channel.port1.onmessage=e=>{clearTimeout(timer);channel.port1.close();resolve(e.data)};client.postMessage({type:'RLS_DOCUMENT_AUTH'},[channel.port2]);});
  if(answer?.token&&answer?.gateway)return answer;
 }
 return null;
}
self.addEventListener('fetch',e=>{
 const u=new URL(e.request.url);if(u.origin!==base.origin||!u.pathname.startsWith(prefix))return;
 e.respondWith((async()=>{
  const a=await auth(e.clientId);if(!a)return new Response('Connexion requise. Ouvrez votre espace enseignant.',{status:401,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});
  const target=new URL(a.gateway+'/file');target.searchParams.set('path',decodeURIComponent(u.pathname.slice(prefix.length)));target.searchParams.set('ref',u.searchParams.get('ref')||a.revision||'');
  if(u.searchParams.get('download')==='1')target.searchParams.set('download','1');
  const h={Authorization:'Bearer '+a.token,apikey:a.key};if(e.request.headers.has('Range'))h.Range=e.request.headers.get('Range');
  try{
   const r=await fetch(target,{headers:h,cache:'no-store',signal:e.request.signal});const headers=new Headers(r.headers);headers.set('Cache-Control','no-store');headers.set('Referrer-Policy','no-referrer');headers.set('X-Frame-Options','SAMEORIGIN');headers.set('Content-Security-Policy',"frame-ancestors 'self'");headers.set('X-Robots-Tag','noindex, nofollow');
   // The Edge platform may force HTML to text/plain; trusted lesson files retain their MIME here.
   if(r.ok){const ext=u.pathname.split('.').pop().toLowerCase(),types={html:'text/html; charset=utf-8',pdf:'application/pdf',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',css:'text/css; charset=utf-8',js:'text/javascript; charset=utf-8',svg:'image/svg+xml',txt:'text/plain; charset=utf-8',md:'text/plain; charset=utf-8',json:'application/json'};if(types[ext])headers.set('Content-Type',types[ext]);if(u.searchParams.get('download')!=='1')headers.set('Content-Disposition','inline');}
   return new Response(r.body,{status:r.status,statusText:r.statusText,headers});
  }catch{return new Response('Le document n’a pas pu être chargé. Vérifiez la connexion puis réessayez.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});}
 })());
});
