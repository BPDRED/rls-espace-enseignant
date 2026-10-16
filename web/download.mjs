export async function downloadBlob(url,fetcher=fetch){
 // A browser download can bypass the service worker. Fetch privately before saving the blob.
 const r=await fetcher(url,{cache:'no-store'});if(!r.ok)throw Error('Le téléchargement a échoué. Vérifiez la connexion et réessayez.');return r.blob();
}
