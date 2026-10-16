import{getDocument,GlobalWorkerOptions,TextLayer}from'pdfjs-dist/legacy/build/pdf.mjs';
import{renderAsync}from'docx-preview';
import{readerSource}from'./viewer.mjs';
const $=s=>document.querySelector(s),content=$('#readerContent'),status=$('#readerStatus');
GlobalWorkerOptions.workerSrc=new URL('./pdf.worker.min.mjs',location.href).href;
let pdf=null,pageNumber=1,zoom=1,rendering=false,rerender=false;
const message=(text,error=false)=>{status.textContent=text;status.classList.toggle('error',error)};
async function draw(){
 if(!pdf)return;if(rendering){rerender=true;return}rendering=true;
 try{
  const page=await pdf.getPage(pageNumber),natural=page.getViewport({scale:1}),width=Math.min(1100,document.documentElement.clientWidth-36),scale=width/natural.width*zoom,viewport=page.getViewport({scale}),ratio=Math.min(devicePixelRatio||1,2);
  const paper=document.createElement('section'),canvas=document.createElement('canvas'),text=document.createElement('div');paper.className='pdf-page';paper.setAttribute('aria-label',`Page ${pageNumber} sur ${pdf.numPages}`);paper.style.width=viewport.width+'px';paper.style.height=viewport.height+'px';paper.style.setProperty('--total-scale-factor',scale);text.className='textLayer';paper.append(canvas,text);
  canvas.width=Math.floor(viewport.width*ratio);canvas.height=Math.floor(viewport.height*ratio);canvas.style.width=viewport.width+'px';canvas.style.height=viewport.height+'px';
  await page.render({canvas,viewport,transform:ratio===1?null:[ratio,0,0,ratio,0,0]}).promise;
  await new TextLayer({textContentSource:await page.getTextContent(),container:text,viewport}).render();
  if(!rerender){content.replaceChildren(paper);$('#pageNumber').value=pageNumber;$('#previous').disabled=pageNumber===1;$('#next').disabled=pageNumber===pdf.numPages;$('#zoomValue').textContent=Math.round(zoom*100)+'%';message('');}
 }catch{message('Cette page n’a pas pu être affichée. Réessayez ou téléchargez le document.',true)}finally{rendering=false;if(rerender){rerender=false;draw()}}
}
function changePage(value){const n=Number(value);if(!Number.isInteger(n)||n<1||n>pdf.numPages){$('#pageNumber').value=pageNumber;return}pageNumber=n;draw();scrollTo(0,0)}
$('#previous').onclick=()=>changePage(pageNumber-1);$('#next').onclick=()=>changePage(pageNumber+1);$('#pageNumber').oninput=$('#pageNumber').onchange=e=>changePage(e.target.value);
$('#zoomOut').onclick=()=>{zoom=Math.max(.5,zoom-.25);draw()};$('#zoomIn').onclick=()=>{zoom=Math.min(3,zoom+.25);draw()};$('#fit').onclick=()=>{zoom=1;draw()};
let resizeTimer;addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(draw,150)});
addEventListener('keydown',e=>{if(e.key==='Escape')parent.postMessage({type:'RLS_CLOSE_DOCUMENT'},location.origin);if(e.target.matches('input'))return;if(e.key==='ArrowRight'&&pdf){e.preventDefault();changePage(Math.min(pageNumber+1,pdf.numPages))}if(e.key==='ArrowLeft'&&pdf){e.preventDefault();changePage(Math.max(1,pageNumber-1))}});
async function open(){
 const source=readerSource(location.href),format=source.pathname.split('.').pop().toLowerCase();document.body.dataset.format=format;
 if(format==='pdf'){
  const assets=new URL('./pdf-assets/',location.href).href;
  const task=getDocument({url:source.href,cMapUrl:assets+'cmaps/',cMapPacked:true,standardFontDataUrl:assets+'standard_fonts/',wasmUrl:assets+'wasm/',isEvalSupported:false});
  task.onProgress=p=>{if(!pdf&&p.total)message(`Chargement du PDF… ${Math.min(100,Math.round(p.loaded/p.total*100))} %`)};
  pdf=await task.promise;$('#pageCount').textContent='/ '+pdf.numPages;$('#pageNumber').max=pdf.numPages;$('#readerToolbar').hidden=false;await draw();
 }else if(format==='docx'){
  const r=await fetch(source,{cache:'no-store'});if(!r.ok)throw Error('fetch');await renderAsync(await r.blob(),content,null,{ignoreLastRenderedPageBreak:false,renderAltChunks:false,useBase64URL:true});message('Aperçu Word. Pour une impression fidèle, utilisez le fichier original ou sa version PDF.');
 }else message('Ce format ne possède pas d’aperçu. Utilisez le bouton Télécharger pour l’ouvrir dans son application.');
}
open().catch(()=>message('Le document n’a pas pu être chargé. Vérifiez votre connexion et réessayez depuis votre espace enseignant.',true));
