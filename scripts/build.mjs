import {mkdir,rm,copyFile,readdir}from'node:fs/promises';
import {build}from'esbuild';
await rm('dist',{recursive:true,force:true});await mkdir('dist');
for(const file of await readdir('web'))if(file!=='app.mjs')await copyFile('web/'+file,'dist/'+file);
await build({entryPoints:['web/app.mjs'],bundle:true,format:'esm',target:['es2022'],outfile:'dist/app.js',minify:true,legalComments:'eof'});
