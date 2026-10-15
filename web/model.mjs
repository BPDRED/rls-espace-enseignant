export const SUBJECTS={maths:'Mathématiques',svt:'SVT'};
export const ORDER={maths:['math-3aep','math-4aep'],svt:['svt-4aep','svt-5aep','svt-6aep']};
export const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Africa/Casablanca'}).format(new Date());
export function documentURL(path,revision,download=false){
 const p=new URL('documents/'+path.split('/').map(encodeURIComponent).join('/'),location.href.split('#')[0]);
 p.searchParams.set('ref',revision);if(download)p.searchParams.set('download','1');return p.href;
}
export function classesFromCatalog(catalog){
 const result={};
 for(const id of [...ORDER.maths,...ORDER.svt]){
  const [s,l]=id.split('-'),subject=s==='math'?'maths':'svt',level=l.toUpperCase();
  const sessions=catalog.calendar.filter(x=>`${x.g}AEP`===level && (x.s==='MATH'?'maths':'svt')===subject);
  const paths=catalog.files.filter(f=>f.path.toLowerCase().includes('/'+l+'/'+(subject==='maths'?'maths':'svt')+'/') && f.path.endsWith('.html') && !/activite.s?-exercices|Activites_et_Corriges/i.test(f.path));
  const lessons=[];
  for(const f of paths){
   const name=f.path.split('/').pop(),number=Number(name.match(/(?:Leçon|Séance)_(\d+)/u)?.[1]);
   if(!number)continue;
   let lesson=lessons.find(x=>x.number===number);
   const planned=subject==='maths'?sessions.filter(x=>x.ref.match(new RegExp('leçon '+number+'(?:[^0-9]|$)','i'))):sessions.filter(x=>Number(x.w)===number);
   const label=name.replace(/^(?:MATHS|SVT)-\daep-(?:Leçon|Séance)_\d+-/,'').replace(/-Séance_\d+/,'').replace(/-(?:Progression_\d-\d|Partie_1&2).*$/,'').replace(/\.html$/,'').replaceAll('_',' ');
   if(!lesson){lesson={number,num:(subject==='maths'?'Leçon ':'Séance ')+number,title:planned[0]?.title||label,unit:'',date:planned[0]?.date||null,ref:planned[0]?.ref||'',parts:[],html:f.path,pdf:f.path.replace(/\.html$/,'.pdf')};lessons.push(lesson);}
   const part=Number(name.match(/-Séance_(\d+)/)?.[1]||1),slot=planned[part-1];
   lesson.parts.push({t:`Séance ${part}`,number:part,sub:slot?.title||lesson.title,d:slot?.date||'',duration:slot?.dur,html:f.path,pdf:f.path.replace(/\.html$/,'.pdf')});
  }
  lessons.sort((a,b)=>a.number-b.number);for(const l of lessons)l.parts.sort((a,b)=>a.number-b.number);
  result[id]={level,subject,students:catalog.roster[level]||[],lessons,manuel:catalog.files.filter(f=>f.path.includes('/Manuels_et_guides/')&&f.path.endsWith('.pdf')&&f.path.toLowerCase().includes(subject==='maths'?'/maths/':'/svt/'))};
 }
 return result;
}
// Keep directory names intact and return their existing catalog order.
export function directoryRows(files,path=''){
 const rows=[],seen=new Set();
 for(const file of files){if(!file.path.startsWith(path))continue;const rest=file.path.slice(path.length);if(!rest)continue;const split=rest.indexOf('/'),name=split<0?rest:rest.slice(0,split),key=path+name+(split<0?'':'/');if(seen.has(key))continue;seen.add(key);rows.push({name,path:key,directory:split>=0,size:file.size});}return rows;
}
