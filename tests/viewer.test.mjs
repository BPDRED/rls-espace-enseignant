import{test}from'node:test';import assert from'node:assert/strict';import{readFile}from'node:fs/promises';import vm from'node:vm';
import{viewerURL,readerSource}from'../web/viewer.mjs';
import{downloadBlob}from'../web/download.mjs';
test('Downloads fetch authenticated file bytes before asking the browser to save; errors never save an error page',async()=>{
 const blob=await downloadBlob('https://example.test/doc.pdf',async(_,options)=>{assert.equal(options.cache,'no-store');return new Response('%PDF-1.7 test',{headers:{'Content-Type':'application/pdf'}})});assert.equal(blob.type,'application/pdf');assert.match(await blob.text(),/^%PDF-/);
 await assert.rejects(downloadBlob('https://example.test/doc.pdf',async()=>new Response('Connexion requise',{status:401})),/téléchargement a échoué/);
});
test('PDF and Word open in the reader, HTML keeps relative asset paths, foreign sources are refused',()=>{
 globalThis.location={href:'https://example.test/rls/#maths'};
 const pdf='https://example.test/rls/documents/03%20-%20CORRECTIONS/trace%20%C3%A9crite.pdf?ref='+ 'a'.repeat(40);
 assert.equal(readerSource(viewerURL(pdf)).href,pdf);
 assert.match(viewerURL(pdf.replace('.pdf','.docx')),/document-reader\.html\?file=/);
 const html=pdf.replace('.pdf','.html');assert.equal(viewerURL(html),html);
 for(const file of ['https://other.test/private.pdf','https://example.test/outside.pdf',pdf+'&download=1','javascript:alert(1)'])assert.throws(()=>readerSource('https://example.test/rls/document-reader.html?file='+encodeURIComponent(file)));
 delete globalThis.location;
});
test('Protected preview overrides attachment headers; explicit download remains a download',async()=>{
 const handlers={},base='https://example.test/rls/',requests=[];
 const context={URL,Headers,Response,MessageChannel,setTimeout,clearTimeout,self:{location:{href:base+'sw.js'},addEventListener:(n,f)=>handlers[n]=f,clients:{matchAll:async()=>[{id:'app',url:base,postMessage:(_,ports)=>ports[0].postMessage({token:'session-test',gateway:'https://backend.test/gateway',key:'public-test',revision:'a'.repeat(40)})}]}},fetch:async(url,options)=>{requests.push({url:String(url),headers:options.headers});return new Response('pdf-bytes',{headers:{'Content-Type':'application/octet-stream','Content-Disposition':'attachment; filename="document.pdf"'}})}};
 vm.runInNewContext(await readFile('web/sw.js','utf8'),context);
 async function request(query=''){let result;handlers.fetch({request:new Request(base+'documents/03%20-%20CORRECTIONS/trace.pdf'+query),clientId:'app',respondWith:p=>result=p});return result}
 const inline=await request();assert.equal(inline.headers.get('Content-Type'),'application/pdf');assert.equal(inline.headers.get('Content-Disposition'),'inline');assert.equal(inline.headers.get('Cache-Control'),'no-store');assert.equal(await inline.text(),'pdf-bytes');
 const download=await request('?download=1');assert.match(download.headers.get('Content-Disposition'),/^attachment/);assert.match(requests[1].url,/download=1/);assert.equal(requests[0].headers.Authorization,'Bearer session-test');assert.ok(!requests[0].url.includes('session-test'));
});
