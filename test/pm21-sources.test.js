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
test('PM2.1 career boards: tech internships are selected and normalized from both providers',async()=>{
 globalThis.fetch=async(url)=>url.includes('greenhouse')?response({jobs:[{title:'Software Engineer Intern',absolute_url:'https://a.test',location:{name:'Remote'}},{title:'Account Executive',absolute_url:'https://b.test'}]}):response([{text:'Security Internship',hostedUrl:'https://c.test',categories:{location:'NY'}},{text:'Sales Manager',hostedUrl:'https://d.test'}]);
 try{const {jobs,errors}=await fetchBoards();assert.deepEqual(errors,[]);assert.ok(jobs.some(j=>j.source.startsWith('Greenhouse:')));assert.ok(jobs.some(j=>j.source.startsWith('Lever:')));assert.ok(jobs.every(j=>/intern/i.test(j.title)));assert.ok(jobs.every(j=>j.datePosted===null))}finally{globalThis.fetch=originalFetch}
});
test('PM2.1 career boards: failed requests are collected without aborting other sources',async()=>{
 globalThis.fetch=async(url)=>{if(url.includes('greenhouse'))throw Error('Network unavailable');return response([{text:'Software Intern',hostedUrl:'https://lever.test',categories:{location:'Remote'}}])};
 try{const {jobs,errors}=await fetchBoards();assert.ok(errors.length>=1);assert.ok(jobs.some(j=>j.source.startsWith('Lever:')))}finally{globalThis.fetch=originalFetch}
});
