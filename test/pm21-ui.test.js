import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const code=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
function context(){const c={Date,Set,Number,JSON,localStorage:{getItem:()=>null,setItem:()=>{}},document:{body:{classList:{add(){},contains(){return false},toggle(){return true}}},getElementById(){return {value:'',addEventListener(){},classList:{toggle(){}},replaceChildren(){},append(){},set textContent(v){},get textContent(){return ''}}}},fetch:async()=>({ok:true,json:async()=>({listings:[],newCount:0,updatedAt:new Date().toISOString()})})};vm.createContext(c);vm.runInContext(code.replace(/\bload\(\);\s*$/, ''),c);return c}
test('PM2.1 sorting: newest posting first, unknown dates last',()=>{const c=context();const data=[{company:'Unknown',datePosted:null},{company:'Old',datePosted:'2026-08-20'},{company:'New',datePosted:'2026-10-20'}];data.sort((a,b)=>vm.runInContext('newestFirst',c)(a,b));assert.deepEqual(data.map(x=>x.company),['New','Old','Unknown'])});
test('PM2.1 favorites: stable favorite identifier uses company, title and URL',()=>{const c=context();assert.equal(vm.runInContext('idFor',c)({company:'Acme',title:'SWE Intern',url:'https://example.com'}),'Acme|SWE Intern|https://example.com')});
test('PM2.1 date sorting: invalid posting dates are treated as unknown',()=>{const c=context();assert.equal(vm.runInContext('postedTime',c)({datePosted:'not-a-date'}),-Infinity)});
