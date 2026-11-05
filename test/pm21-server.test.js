// Expanded with AI assistance; new outage test prompt/scope: docs/ai/PM2.2-ai-usage.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,cp,writeFile,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const project=fileURLToPath(new URL('../',import.meta.url));
const fixture=`globalThis.fetch=async(url)=>{if(String(url).includes('raw.githubusercontent.com'))return {ok:true,json:async()=>[{title:'Software Intern',company_name:'Acme',locations:['Remote'],url:'https://jobs.test/swe?ref=github',date_posted:1790000000,terms:['Summer 2027']}]};if(String(url).includes('greenhouse'))return {ok:true,json:async()=>({jobs:[{title:'Software Intern',absolute_url:'https://jobs.test/swe?ref=board',location:{name:'Remote'}}]})};return {ok:true,json:async()=>([])};};`;
test('PM2.1 integration: server, GitHub, boards, dedup, cache, refresh, static UI and method checks', {timeout:20000},async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'skynet-pm21-'));let child;
 try{
  for(const name of ['server.js','package.json','job-boards.json'])await cp(path.join(project,name),path.join(dir,name));
  await cp(path.join(project,'src'),path.join(dir,'src'),{recursive:true});await cp(path.join(project,'public'),path.join(dir,'public'),{recursive:true});
  await writeFile(path.join(dir,'mock.mjs'),fixture);
  const port=32000+Math.floor(Math.random()*20000);child=spawn(process.execPath,['--import','./mock.mjs','server.js'],{cwd:dir,env:{...process.env,PORT:String(port)},stdio:'ignore'});
  let base=`http://127.0.0.1:${port}`,ready=false;
  for(let i=0;i<80;i++){try{const r=await fetch(base+'/');if(r.ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,75))}
  assert.equal(ready,true,'server should start');
  const first=await (await fetch(base+'/api/listings')).json();assert.ok(first.listings.length>0);assert.equal(first.newCount,first.listings.length);assert.ok(first.listings.every(x=>x.firstSeen&&x.id));
  assert.equal(first.listings.filter(x=>x.url?.startsWith('https://jobs.test/swe')).length,1,'same URL without tracking query deduplicates');
  const second=await (await fetch(base+'/api/listings')).json();assert.equal(second.updatedAt,first.updatedAt,'cached GET does not refetch');
  const refreshed=await (await fetch(base+'/api/refresh',{method:'POST'})).json();assert.equal(refreshed.newCount,0);assert.equal(refreshed.listings[0].firstSeen,first.listings[0].firstSeen);
  assert.equal((await fetch(base+'/api/refresh')).status,405);
  assert.equal((await fetch(base+'/missing')).status,404);
  assert.equal((await fetch(base+'/app.js')).status,200);
 }finally{if(child)child.kill();await rm(dir,{recursive:true,force:true})}
});

// Exercise startup cache loading and the refresh fallback through real HTTP.
test('PM2.1 integration: upstream outage returns 502 without cache and preserves stale cached listings', {timeout: 20000}, async () => {
 for (const seeded of [false, true]) {
  const dir = await mkdtemp(path.join(tmpdir(), 'skynet-outage-'));
  let child;
  try {
   for (const name of ['server.js', 'package.json', 'job-boards.json']) await cp(path.join(project, name), path.join(dir, name));
   await cp(path.join(project, 'src'), path.join(dir, 'src'), {recursive: true});
   await cp(path.join(project, 'public'), path.join(dir, 'public'), {recursive: true});
   const old = {listings: [{id: 'cached', title: 'Cached Intern', company: 'Acme', location: 'Remote', url: 'https://jobs.test/cached', source: 'SimplifyJobs', firstSeen: '2020-01-01'}], updatedAt: '2020-01-01', newCount: 0, errors: []};
   if (seeded) {
    await mkdir(path.join(dir, 'data'));
    await writeFile(path.join(dir, 'data/listings-cache.json'), JSON.stringify(old));
   }
   await writeFile(path.join(dir, 'mock.mjs'), "globalThis.fetch = async () => { throw Error('Fixture outage'); }; ");
   const port = 32000 + Math.floor(Math.random() * 20000);
   child = spawn(process.execPath, ['--import', './mock.mjs', 'server.js'], {cwd: dir, env: {...process.env, PORT: String(port)}, stdio: 'ignore'});
   const base = `http://127.0.0.1:${port}`;
   let ready = false;
   for (let i = 0; i < 80; i++) {
    try { if ((await fetch(base + '/')).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 75));
   }
   assert.equal(ready, true, 'server should start');
   const response = await fetch(base + '/api/listings');
   const data = await response.json();
   assert.equal(response.status, seeded ? 200 : 502);
   if (seeded) {
    assert.deepEqual(data.listings, old.listings);
    assert.equal(data.updatedAt, old.updatedAt);
    assert.match(data.errors.join('; '), /Refresh failed.*Fixture outage/);
   } else assert.match(data.error, /Could not load listings.*Fixture outage/);
  } finally {
   if (child) child.kill();
   await rm(dir, {recursive: true, force: true});
  }
 }
});
