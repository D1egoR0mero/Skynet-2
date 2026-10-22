import http from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {fetchInternships} from './src/sources/simplify.js';
import {fetchBoards} from './src/sources/boards.js';
const root=path.dirname(fileURLToPath(import.meta.url));
const port=Number(process.env.PORT)||3000;
const day=24*60*60*1000;
const cacheFile=path.join(root,'data','listings-cache.json');
let cache=null,pending=null;
function key(j){return (j.url||`${j.company}|${j.title}|${j.location}`).replace(/\?.*$/,'').replace(/\/$/,'').toLowerCase()}
async function init(){try{cache=JSON.parse(await readFile(cacheFile,'utf8'))}catch{}}
async function refresh(force=false){
 if(pending)return pending;
 if(!force&&cache&&Date.now()-Date.parse(cache.updatedAt)<day)return cache;
 pending=(async()=>{
  const previous=cache;
  const [github,boards]=await Promise.allSettled([fetchInternships(),fetchBoards()]);
  const errors=[];let all=[];let success=0;
  if(github.status==='fulfilled'){all.push(...github.value);success++}else errors.push(`GitHub: ${github.reason.message}`);
  if(boards.status==='fulfilled'){all.push(...boards.value.jobs);errors.push(...boards.value.errors);if(boards.value.errors.length<5)success++}else errors.push(`Career boards: ${boards.reason.message}`);
  if(!success)throw Error(errors.join('; '));
  // Preserve old entries from a failed source, but not from a successfully refreshed source.
  if(previous){if(github.status!=='fulfilled')all.push(...previous.listings.filter(x=>x.source?.startsWith('Simplify')));
    if(boards.status!=='fulfilled'||(boards.status==='fulfilled'&&boards.value.errors.length)){
      const failed=new Set(boards.status==='fulfilled'?boards.value.errors.map(e=>e.split(':')[0]):[]);
      all.push(...previous.listings.filter(x=>x.source?.startsWith('Greenhouse:')||x.source?.startsWith('Lever:')).filter(x=>boards.status!=='fulfilled'||failed.has(x.company)));
    }}
  const old=new Map((previous?.listings||[]).map(x=>[key(x),x]));const seen=new Set();
  const listings=all.filter(x=>{const k=key(x);if(seen.has(k))return false;seen.add(k);return true}).map(x=>{
    const oldItem=old.get(key(x));return {...x,id:key(x),datePosted:x.datePosted instanceof Date?x.datePosted.toISOString():x.datePosted||null,firstSeen:oldItem?.firstSeen||new Date().toISOString()};
  });
  cache={listings,updatedAt:new Date().toISOString(),newCount:listings.filter(x=>!old.has(key(x))).length,errors};
  await mkdir(path.dirname(cacheFile),{recursive:true});await writeFile(cacheFile,JSON.stringify(cache,null,2));
  return cache;
 })().finally(()=>pending=null);
 try{return await pending}catch(e){if(cache)return {...cache,errors:[...(cache.errors||[]),`Refresh failed: ${e.message}`]};throw e}
}
await init();
const files={'/':'index.html','/app.js':'app.js','/style.css':'style.css'};
http.createServer(async(req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 try{
  if(pathname==='/api/listings'||pathname==='/api/refresh'){
   if(pathname==='/api/refresh'&&req.method!=='POST'){res.writeHead(405);res.end('Method not allowed');return}
   const data=await refresh(pathname==='/api/refresh');res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));return;
  }
  if(!files[pathname]){res.writeHead(404);res.end('Not found');return}
  const ext=path.extname(files[pathname]);const data=await readFile(path.join(root,'public',files[pathname]));
  res.writeHead(200,{'Content-Type':ext==='.css'?'text/css':ext==='.js'?'text/javascript':'text/html','X-Content-Type-Options':'nosniff'});res.end(data);
 }catch(e){res.writeHead(502,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Could not load listings. '+e.message}));console.error(e)}
}).listen(port,()=>console.log(`Skynet web app: http://localhost:${port}`));
// A local server only refreshes while running; the first request after restart also checks freshness.
setInterval(()=>refresh().catch(e=>console.error('Scheduled refresh:',e.message)),day).unref();
