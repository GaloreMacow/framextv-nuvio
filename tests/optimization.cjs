const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const manifest=require('../manifest.json');let checks=0;
const check=(name,fn)=>{fn();checks++;console.log('PASS '+name);};
const playlist='#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=4000000,RESOLUTION=1920x800\nhigh.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=2000000,RESOLUTION=1280x534\nlow.m3u8';
const response=(body,status=200)=>({ok:status===200,status,url:'https://cdn.example/master.m3u8',text:()=>Promise.resolve(body),json:()=>Promise.resolve(body)});
function load(code,fetch,timers={}){
 const metrics={subtitlePasses:0,masterParses:0};
 const box={module:{exports:{}},URL,fetch,console:{log(){}},metrics,...timers};
 code=code.replace('function subtitles(value) {','function subtitles(value) { metrics.subtitlePasses++;').replace('function parseMaster(text, base) {','function parseMaster(text, base) { metrics.masterParses++;');
 vm.runInNewContext(code.replace('module.exports = { getStreams: getStreams };','module.exports = {getStreams,normalize,expandQualities,parseMaster,subtitles,fetchWithin};'),box);
 return {...box.module.exports,metrics};
}
const track=(language='en',headers={})=>({url:'https://cdn.example/captions.vtt',language,label:language==='en'?'English':'Hindi',headers});
const source=(extras={})=>({url:'https://cdn.example/master.m3u8',type:'hls',quality:'Auto',server:'Fixture',...extras});
(async()=>{
 for(const scraper of manifest.scrapers){
  const code=fs.readFileSync(path.join(__dirname,'..',scraper.filename),'utf8'),prefix=scraper.id+' — ';
  let fetches=0;const p=load(code,()=>{fetches++;return Promise.resolve(response(playlist));});
  const normalized=p.normalize({sources:[source({audioTracks:[{label:'English'}]}),source({audioTracks:[{label:'Hindi'}]})],subtitles:[track()]});
  const ctx={},groups=await Promise.all(normalized.map(s=>p.expandQualities(s,ctx)));
  check(prefix+'shared playlist fetched and parsed once without losing audio versions',()=>{assert.equal(normalized.length,2);assert.equal(fetches,1);assert.equal(p.metrics.masterParses,1);assert(groups[0][0].title.includes('English'));assert(groups[1][0].title.includes('Hindi'));});
  check(prefix+'labels omit FrameXTV and duplicate quality text',()=>{for(const g of groups)for(const s of g){assert(!/framextv/i.test(s.name+' '+s.title));assert(!s.title.includes('Auto | Auto'));assert(!s.title.includes('API source'));}assert.equal(groups[0][1].title,'Fixture | 1080p | English | 4.0 Mbps');});
  check(prefix+'shared captions normalized once with labels and headers intact',()=>{assert.equal(p.metrics.subtitlePasses,1);assert.equal(normalized[0].subtitles,normalized[1].subtitles);assert.equal(normalized[0].subtitles[0].name,'English');});
  const captions=p.normalize({subtitles:[track()],sources:[source({subtitles:[track('hi')]})]})[0].subtitles;
  check(prefix+'shared and source captions retain separate languages',()=>{assert.deepEqual(Array.from(captions,t=>t.language),['en','hi']);assert.equal(captions[0].name,'English');});
  const versions=p.normalize({sources:[source({headers:{Referer:'https://a.example/'}}),source({headers:{Referer:'https://b.example/'}}),source({subtitles:[track('hi')]}),source({subtitles:[track('en')]}),source({subtitles:[track('en')]})]});
  check(prefix+'dedupe preserves alternate headers and captions',()=>assert.equal(versions.length,4));
  const isolated={};fetches=0;await Promise.all(versions.map(s=>p.expandQualities(s,isolated)));
  check(prefix+'different headers probe separately; caption-only variants reuse a probe',()=>assert.equal(fetches,3));
  fetches=0;await p.expandQualities(normalized[0],{});await p.expandQualities(normalized[0],{});
  check(prefix+'new lookups fetch fresh playlists',()=>assert.equal(fetches,2));
  check(prefix+'case-insensitive embedded players are rejected',()=>assert.equal(p.normalize({sources:[source({type:'IFRAME'}),source({type:'Embed'})]}).length,0));
  check(prefix+'same caption URL with different headers remains available',()=>assert.equal(p.subtitles([track('en',{Referer:'a'}),track('en',{Referer:'b'})]).length,2));
  let splitCalls=0;const media={split(){splitCalls++;throw Error('Unexpected media scan');},toString(){return '#EXTM3U\n#EXTINF:10,\nsegment.ts';},indexOf(){return -1;}};
  check(prefix+'media playlists skip per-segment parsing',()=>{assert.equal(p.parseMaster(media,'https://cdn.example/media.m3u8').variants.length,0);assert.equal(splitCalls,0);});
  const timing={setTimeout:(fn)=>setTimeout(fn,5),clearTimeout};
  const slow=load(code,()=>Promise.resolve({ok:true,json:()=>new Promise(()=>{}),text:()=>new Promise(()=>{})}),timing);
  await assert.rejects(slow.fetchWithin('https://fixture.invalid/',{},10,r=>r.text()),/timeout/);
  check(prefix+'deadline covers stalled response body reads',()=>{});
  const empty=await slow.getStreams('550','movie');
  check(prefix+'stalled API or Miner response returns without hanging',()=>assert.equal(empty.length,0));
  let calls=[];const full=load(code,u=>{calls.push(u);if(u.includes('api.wecollege.net'))return Promise.resolve(response({},503));return Promise.resolve(response({success:true,sources:[source({url:'https://cdn.example/video.mp4',type:'mp4',quality:'1080p'})]}));});
  const output=await full.getStreams('  TMDB:969681  ','movie');
  check(prefix+'full output uses clean source labels and no private metadata',()=>{assert.equal(output.length,1);assert(!/framextv/i.test(output[0].name+' '+output[0].title));assert(!Object.keys(output[0]).some(k=>k.startsWith('_')));assert(calls.some(u=>u.includes('id=969681')));});
 }
 // Representative common-caption workload, not a universal latency claim.
 const code=fs.readFileSync(path.join(__dirname,'../providers/framextv.js'),'utf8');
 const fixture={subtitles:Array.from({length:67},(_,i)=>({url:`https://cdn.example/sub-${i}.vtt`,language:'en',label:'English'})),sources:Array.from({length:20},(_,i)=>source({url:`https://cdn.example/${i}.mp4`,type:'mp4',quality:'1080p'}))};
 const current=load(code,()=>{}),result=current.normalize(fixture);
 check('20-source/67-caption fixture normalizes common captions once',()=>{assert.equal(current.metrics.subtitlePasses,1);assert.equal(result.length,20);assert(result.every(s=>s.subtitles.length===67));});
 if(process.env.BASELINE_SOURCE){const previous=load(fs.readFileSync(process.env.BASELINE_SOURCE,'utf8'),()=>{}),old=previous.normalize(fixture);const projection=streams=>JSON.parse(JSON.stringify(streams.map(s=>({url:s.url,quality:s.quality,headers:s.headers,subtitles:s.subtitles}))));assert.deepEqual(projection(result),projection(old));console.log(`BENCHMARK common-caption passes ${previous.metrics.subtitlePasses} -> ${current.metrics.subtitlePasses}; identical URLs, qualities, headers, captions.`);}
 console.log(`\n${checks} optimization checks passed.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
