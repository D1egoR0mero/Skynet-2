const $=id=>document.getElementById(id);
let listings=[],visible=[],page=0,mode='all';const size=12;
// Sort by the original posting date, newest first. Unknown dates go last.
function postedTime(x){const t=Date.parse(x.datePosted||'');return Number.isFinite(t)?t:-Infinity}
function newestFirst(a,b){return postedTime(b)-postedTime(a)||((Date.parse(b.firstSeen||'')||0)-(Date.parse(a.firstSeen||'')||0))||a.company.localeCompare(b.company)}
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};
let saved=new Set(read('skynet-saved',[]));
if(read('skynet-dark',false))document.body.classList.add('dark');
function idFor(x){return `${x.company}|${x.title}|${x.url}`}
function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n}
function render(){
 const q=$('search').value.trim().toLowerCase(),loc=$('location').value.trim().toLowerCase(),type=$('type').value,days=Number($('date').value);
 visible=listings.filter(x=>{
  const searchable=`${x.title} ${x.company} ${x.tags||''} ${x.terms||''}`.toLowerCase();
  if(mode==='saved'&&!saved.has(idFor(x)))return false;
  if(q&&!searchable.includes(q))return false;
  if(loc&&!x.location.toLowerCase().includes(loc))return false;
  if(type){const t=`${x.title} ${x.terms||''}`.toLowerCase();if(type==='intern'&&!t.includes('intern'))return false;if(type==='co-op'&&!/co-op|coop|co op/.test(t))return false;if(type==='full-time'&&!/full.time|new grad|graduate|entry.level/.test(t))return false;}
  if(days&&(!x.datePosted||Date.now()-new Date(x.datePosted).getTime()>days*86400000))return false;
  return true;
 }).sort(newestFirst);
 const pages=Math.max(1,Math.ceil(visible.length/size));page=Math.min(page,pages-1);
 $('total').textContent=listings.length.toLocaleString();$('matches').textContent=visible.length.toLocaleString();$('saved-stat').textContent=saved.size;$('saved-count').textContent=saved.size;
 $('section-title').textContent=mode==='saved'?'Saved opportunities':'Explore opportunities';
 $('status').textContent=`${visible.length.toLocaleString()} opportunities found`;
 $('page').textContent=`Page ${page+1} of ${pages}`;$('prev').disabled=page===0;$('next').disabled=page>=pages-1;
 const container=$('cards');container.replaceChildren();
 if(!visible.length){container.append(el('div','empty',listings.length?'No matching opportunities. Try clearing your filters.':'No listings available. Check the data connection and refresh.'));return}
 for(const x of visible.slice(page*size,(page+1)*size)){
  const card=el('article','job'),top=el('div','job-top'),logo=el('div','company-logo',(x.company||'?').slice(0,2).toUpperCase()),save=el('button','save'+(saved.has(idFor(x))?' is-saved':''),saved.has(idFor(x))?'♥':'♡');
  save.setAttribute('aria-label',`Save ${x.title}`);save.onclick=()=>{const id=idFor(x);saved.has(id)?saved.delete(id):saved.add(id);localStorage.setItem('skynet-saved',JSON.stringify([...saved]));render()};top.append(logo,save);
  card.append(top,el('h3','',x.title),el('p','company',x.company));const tags=el('div','tags');for(const text of [x.location,x.terms].filter(Boolean)){tags.append(el('span','tag',text))}card.append(tags);
  const bottom=el('div','job-bottom');bottom.append(el('small','',x.datePosted?`Posted ${new Date(x.datePosted).toLocaleDateString()}`:'Posting date unavailable'));
  if(x.url&&/^https?:\/\//i.test(x.url)){const a=el('a','apply','View opportunity ↗');a.href=x.url;a.target='_blank';a.rel='noopener noreferrer';bottom.append(a)}card.append(bottom);container.append(card)
 }
}
for(const id of ['search','location','type','date'])$(id).addEventListener('input',()=>{page=0;render()});
$('reset').onclick=()=>{for(const id of ['search','location','type','date'])$(id).value='';page=0;render()};
$('prev').onclick=()=>{if(page>0){page--;render()}};$('next').onclick=()=>{if((page+1)*size<visible.length){page++;render()}};
$('nav-all').onclick=()=>switchMode('all');$('nav-saved').onclick=()=>switchMode('saved');
function switchMode(m){mode=m;page=0;$('nav-all').classList.toggle('active',m==='all');$('nav-saved').classList.toggle('active',m==='saved');render()}
$('theme').onclick=()=>{const dark=document.body.classList.toggle('dark');localStorage.setItem('skynet-dark',JSON.stringify(dark));$('theme').textContent=dark?'☀  Light mode':'☾  Dark mode'};
if(document.body.classList.contains('dark'))$('theme').textContent='☀  Light mode';
async function load(force=false){ $('status').textContent='Loading live listings…';try{const res=await fetch(force?'/api/refresh':'/api/listings',force?{method:'POST'}:undefined);const data=await res.json();if(!res.ok)throw Error(data.error||'Unable to load');listings=data.listings;page=0;render();$('status').textContent=`${visible.length.toLocaleString()} matches · ${data.newCount} newly discovered at last sync · Updated ${new Date(data.updatedAt).toLocaleString()}${data.errors?.length?' · Some sources unavailable':''}`}catch(err){$('status').textContent=err.message;$('cards').replaceChildren(el('div','empty',err.message))}}
$('refresh').onclick=()=>load(true);load();
