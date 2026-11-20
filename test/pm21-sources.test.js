// AI-generated/expanded tests. Prompt and scope: docs/ai/PM2.2-ai-usage.md and
// docs/ai/PM2.3-ai-usage.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchInternships} from '../src/sources/simplify.js';
import {fetchBoards} from '../src/sources/boards.js';
const originalFetch=globalThis.fetch;
const response=(value,status=200)=>({ok:status===200,status,json:async()=>value});
test('PM2.1 GitHub: visible active postings are normalized with posting dates',async()=>{
 globalThis.fetch=async()=>response([{title:'Software Engineer Intern',company_name:'Acme',locations:['Remote'],url:'https://example.com/1',date_posted:1790000000,terms:['Summer 2027'],active:true,is_visible:true},{title:'Hidden',company_name:'X',locations:['NY'],active:false}]);
 try {const jobs=await fetchInternships();assert.equal(jobs.length,1);assert.equal(jobs[0].company,'Acme');assert.ok(jobs[0].datePosted instanceof Date)}finally{globalThis.fetch=originalFetch}
});
test('PM2.1 GitHub: HTTP failure is reported',async()=>{
 globalThis.fetch=async()=>response([],503);
 try{await assert.rejects(fetchInternships(),/503/)}finally{globalThis.fetch=originalFetch}
});
// Purpose: verify every normalization fallback and the is_visible/active
// distinction, which the original happy-path test did not exercise.
test('PM2.1 GitHub: defaults fill missing optional fields and hidden postings are excluded',async()=>{
 globalThis.fetch=async()=>response([
  {title:'Visible Intern',company_name:'Acme',locations:['Remote'],url:'https://example.com/visible',date_posted:1790000000,terms:['Summer 2027'],active:true,is_visible:true},
  {title:'Hidden but active',company_name:'Acme',locations:['Remote'],active:true,is_visible:false},
  {company_name:'Default Co',locations:[],active:true},
  {title:'No Company',locations:['NY'],company_url:'https://company.example',active:true},
 ]);
 try{
  const jobs=await fetchInternships();
  assert.equal(jobs.length,3);
  assert.deepEqual(jobs.map(job=>job.title),['Visible Intern','Untitled role','No Company']);
  const defaults=jobs[1];
  assert.equal(defaults.location,'Unspecified');
  assert.equal(defaults.url,'');
  assert.equal(defaults.datePosted,null);
  assert.equal(defaults.terms,'Unspecified');
  assert.equal(jobs[2].company,'Unknown company');
  assert.equal(jobs[2].url,'https://company.example');
  assert.equal(jobs[0].tags,'visible intern acme');
 }finally{globalThis.fetch=originalFetch}
});
// Purpose: an empty provider response is a valid edge case and must not throw.
test('PM2.1 GitHub: an empty dataset returns no listings',async()=>{
 globalThis.fetch=async()=>response([]);
 try{assert.deepEqual(await fetchInternships(),[])}finally{globalThis.fetch=originalFetch}
});
// Purpose: a malformed provider payload is rejected rather than silently
// producing unusable listing objects.
test('PM2.1 GitHub: a non-array payload is rejected',async()=>{
 globalThis.fetch=async()=>response({not:'an array'});
 try{await assert.rejects(fetchInternships(),TypeError)}finally{globalThis.fetch=originalFetch}
});
test('PM2.1 career boards: tech internships are selected and normalized from both providers',async()=>{
 globalThis.fetch=async(url)=>url.includes('greenhouse')?response({jobs:[{title:'Software Engineer Intern',absolute_url:'https://a.test',location:{name:'Remote'}},{title:'Account Executive',absolute_url:'https://b.test'}]}):response([{text:'Security Internship',hostedUrl:'https://c.test',categories:{location:'NY'}},{text:'Sales Manager',hostedUrl:'https://d.test'}]);
 try{const {jobs,errors}=await fetchBoards();assert.deepEqual(errors,[]);assert.ok(jobs.some(j=>j.source.startsWith('Greenhouse:')));assert.ok(jobs.some(j=>j.source.startsWith('Lever:')));assert.ok(jobs.every(j=>/intern/i.test(j.title)));assert.ok(jobs.every(j=>j.datePosted===null))}finally{globalThis.fetch=originalFetch}
});
test('PM2.1 career boards: failed requests are collected without aborting other sources',async()=>{
 globalThis.fetch=async(url)=>{if(url.includes('greenhouse'))throw Error('Network unavailable');return response([{text:'Software Intern',hostedUrl:'https://lever.test',categories:{location:'Remote'}}])};
 try{const {jobs,errors}=await fetchBoards();assert.ok(errors.length>=1);assert.ok(jobs.some(j=>j.source.startsWith('Lever:')))}finally{globalThis.fetch=originalFetch}
});
