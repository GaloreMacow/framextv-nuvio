// Run with: node test-miner.cjs
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const code=fs.readFileSync(__dirname+'/providers/framextv-miner.js','utf8'),fixture={"seed": "fixture-seed", "id": 937020, "encoded": "pGISznYRyhINJb-RXhEzQjSq2qNushPTbgMF-jRhD-i0agLD85Oo-frstoO_2zfhAddcnwSBQ4dMoZe66Ts45jcWk9syyRWBa33bwjLgMVo0C2My5lRgn9tfoelgDvM1Nq-3vXXW1KUSB97bGWFk6b5hWJmafgO29j4KGWeY1LIy2alzsc1gj6iiAAW_XzJom22KD5Ms6g7uycsouOrRiQxl2eSK59reP5IaE4VQ9qqvX25YC_mzpGIIjmguxn0f3ZLB7OASF8SGcUSGsyRfAkKcCZCD1EvCC1Mg5SUXZUtvPGYY6AOE7yfEYEU", "payload": {"sources": [{"url": "https://cdn.example/master.m3u8", "quality": "auto", "type": "hls", "headers": {"X-Source": "fixture"}}], "subtitles": [{"url": "https://cdn.example/sub.srt", "lang": "en", "label": "English"}], "title": "\u0b9c\u0bc6\u0baf\u0bbf\u0bb2\u0bb0\u0bcd"}};
let count=0;function check(name,fn){fn();count++;console.log('PASS '+name);}
function response(body,status=200,url='https://cdn.example/master.m3u8'){return{ok:status>=200&&status<300,status,url,json:()=>Promise.resolve(body),text:()=>Promise.resolve(typeof body==='string'?body:JSON.stringify(body))};}
function load(fetch,timers={}){let box={module:{exports:{}},console:{log(){}},URL,fetch,...timers};const math=Object.create(Math);math.imul=undefined;box.Math=math;box.BigInt=undefined;vm.runInNewContext(code.replace('module.exports = { getStreams: getStreams };','module.exports = {getStreams,decodeSources,normalize,fetchWithin};'),box);return box.module.exports;}
const playlist='#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=4000000,RESOLUTION=1920x800\nhigh.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=2000000,RESOLUTION=1280x534\nlow.m3u8';
(async()=>{
 const p=load(()=>Promise.reject(Error('Unexpected')));
 check('public source protocol decodes without BigInt or Math.imul',()=>assert.deepEqual(JSON.parse(JSON.stringify(p.decodeSources(fixture.encoded,fixture.seed,fixture.id))),fixture.payload));
 check('wrong seed cannot yield a source',()=>assert.throws(()=>p.decodeSources(fixture.encoded,'wrong',fixture.id)));
 check('wrong movie ID cannot yield a source',()=>assert.throws(()=>p.decodeSources(fixture.encoded,fixture.seed,550)));
 check('invalid encoding fails cleanly',()=>assert.throws(()=>p.decodeSources('!!',fixture.seed,fixture.id)));
 let urls=[];function net(url,options){urls.push(url);if(url.includes('/seed?'))return Promise.resolve(response({seed:fixture.seed}));if(url.includes('/sources?')){assert.equal(options.headers.Origin,'https://www.movy.sx');return Promise.resolve(response(url.includes('/atlanta/')?fixture.encoded:'broken'));}if(url.includes('cdn.example/master'))return Promise.resolve(response(playlist));throw Error('Unexpected '+url);}
 const full=load(net),result=await full.getStreams('tmdb:937020','movie');
 check('Miner uses the public client source lookup',()=>{assert(urls.some(u=>u.includes('/atlanta/sources?')&&u.includes('tmdbId=937020')));assert(!urls.some(u=>u.includes('api.framextv.tech')));assert(result.length===3);});
 check('one failed city does not discard successful city results',()=>assert.equal(result.length,3));
 check('HLS Auto and cropped quality tiers are preserved',()=>assert.deepEqual(Array.from(result,s=>s.quality),['Auto','1080p','720p']));
 check('relative playlists and source headers are preserved',()=>{assert.equal(result[1].url,'https://cdn.example/high.m3u8');assert.equal(result[1].headers.Referer,'https://www.movy.sx/');assert.equal(result[1].headers['X-Source'],'fixture');assert.equal(result[1].subtitles[0].language,'en');});
 const cityCalls=[];const secondary=load(u=>{cityCalls.push(u);if(u.includes('/seed?'))return Promise.resolve(response({seed:fixture.seed}));if(u.includes('/sources?'))return Promise.resolve(response(u.includes('/seattle/')?fixture.encoded:'broken'));return Promise.resolve(response(playlist));});
 const secondaryResult=await secondary.getStreams('937020','movie');
 check('current secondary cities are tried after empty primary cities',()=>{assert.equal(secondaryResult.length,3);for(const city of ['miami','boise','atlanta','seattle','phoenix','oakland','vegas','portland','dallas'])assert(cityCalls.some(u=>u.includes('/'+city+'/sources?')));assert(!cityCalls.some(u=>u.includes('api.framextv.tech')));});
 check('successful primary cities avoid unnecessary secondary requests',()=>assert(!urls.some(u=>/\/(?:seattle|phoenix|oakland|vegas|portland|dallas)\/sources/.test(u))));
 const fallback=load(u=>u.includes('api.wecollege.net')?Promise.resolve(response('',429)):Promise.resolve(response({success:true,sources:[{url:'https://cdn.example/movie.mp4',quality:'1080p',type:'mp4'}]})));
 const old=await fallback.getStreams('937020','movie');check('client failure still falls back to the existing FrameXTV API',()=>assert.equal(old.length,1));
 let clock=0, pendingSeed, events=[], lateUrls=[];
 const late=load((u,o)=>{lateUrls.push(u);if(u.includes('/seed?'))return new Promise(resolve=>{pendingSeed=resolve;});if(u.includes('/sources?'))return Promise.resolve(response(u.includes('/atlanta/')?fixture.encoded:'broken'));return Promise.resolve(response('#EXTM3U\n#EXTINF:10,\nsegment.ts'));},{Date:{now:()=>clock},setTimeout:(fn,ms)=>{events.push({fn,at:clock+ms,cancelled:false});return events.length-1;},clearTimeout:id=>{events[id].cancelled=true;}});
 const lateWork=late.getStreams('937020','movie');for(let tick=0;tick<8&&!pendingSeed;tick++)await Promise.resolve();assert(pendingSeed);clock=19000;events.filter(e=>!e.cancelled&&e.at<=clock).forEach(e=>e.fn());pendingSeed(response({seed:fixture.seed}));const lateResult=await lateWork;
 check('a successful 19-second seed is not discarded by the old 12-second deadline',()=>{assert(lateResult.length>0);assert(!lateUrls.some(u=>u.includes('api.framextv.tech')));});
 const empty=load(()=>Promise.resolve(response({success:false,sources:[]},500)));const none=await empty.getStreams('937020','movie');check('both paths failing returns an empty list',()=>assert.equal(none.length,0));
 let badCalls=0;const invalid=load(()=>{badCalls++;throw Error('Unexpected')});assert.equal((await invalid.getStreams('kitsu:12','movie')).length,0);assert.equal((await invalid.getStreams('937020','tv',1,0)).length,0);check('invalid IDs and episodes make no network requests',()=>assert.equal(badCalls,0));
 urls=[];await full.getStreams('937020','series',0,2);check('TV specials preserve season and episode in the client request',()=>assert(urls.some(u=>u.includes('mediaType=tv')&&u.includes('seasonId=0&episodeId=2'))));
 const retained=load((u,o)=>u.includes('cdn.example')?Promise.reject(Error('Probe failed')):net(u,o));const probe=await retained.getStreams('937020','movie');check('failed media probes retain returned sources',()=>assert.equal(probe.length,1));
 const timer=load(()=>new Promise(()=>{}),{setTimeout:(fn)=>setTimeout(fn,2),clearTimeout});await assert.rejects(timer.fetchWithin('https://fixture.invalid/',{},12000),/timeout/);check('optional request timers prevent indefinite waits',()=>{});
 console.log('\n'+count+' checks passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
