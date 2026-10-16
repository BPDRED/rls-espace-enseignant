import {mkdir,rm,copyFile,readdir,cp}from'node:fs/promises';
import {build}from'esbuild';
await rm('dist',{recursive:true,force:true});await mkdir('dist');
for(const file of await readdir('web'))if(!['app.mjs','document-reader.mjs'].includes(file))await copyFile('web/'+file,'dist/'+file);
await build({entryPoints:['web/app.mjs'],bundle:true,format:'esm',target:['es2022'],outfile:'dist/app.js',minify:true,legalComments:'eof'});
await build({entryPoints:['web/document-reader.mjs'],bundle:true,format:'esm',target:['es2022'],outfile:'dist/document-reader.js',minify:true,legalComments:'eof'});
await copyFile('node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs','dist/pdf.worker.min.mjs');
await copyFile('node_modules/pdfjs-dist/LICENSE','dist/PDFJS-LICENSE');
for(const dir of ['cmaps','standard_fonts','wasm'])await cp('node_modules/pdfjs-dist/'+dir,'dist/pdf-assets/'+dir,{recursive:true});
