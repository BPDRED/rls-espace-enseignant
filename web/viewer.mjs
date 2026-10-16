export function viewerURL(url){
 const source=new URL(url),ext=source.pathname.split('.').pop().toLowerCase();
 if(['html','png','jpg','jpeg','webp','svg','txt','md','json','css','js'].includes(ext))return source.href;
 const viewer=new URL('./document-reader.html',location.href.split('#')[0]);viewer.searchParams.set('file',source.href);return viewer.href;
}
export function readerSource(href){
 const reader=new URL(href),file=reader.searchParams.get('file');if(!file)throw Error('missing document');
 const source=new URL(file),prefix=new URL('./documents/',reader);
 if(source.origin!==reader.origin||!source.pathname.startsWith(prefix.pathname)||source.searchParams.has('download'))throw Error('invalid document');
 return source;
}
