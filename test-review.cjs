const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const manifest=JSON.parse(fs.readFileSync(__dirname+'/manifest.json','utf8'));let checks=0;
function check(label,fn){fn();checks++;console.log('PASS '+label);}
function response(body,status=200,url='https://cdn.example/path/master.json?token=x'){return {ok:status>=200&&status<300,status,url,text:()=>Promise.resolve(body),json:()=>Promise.resolve(typeof body==='string'?JSON.parse(body):body)};}
function LegacyURL(value){if(!/^https?:\/\//i.test(value))throw Error('Only absolute URLs supported');const parsed=new URL(value);this.href=value;this.protocol=parsed.protocol;this.hostname=parsed.hostname;}
const subs=[{url:'https://cdn.example/sub.vtt',language:'en',headers:{Referer:'https://source.example/'}}];
const payload={success:true,sources:[{url:'https://cdn.example/path/master.json?token=x',type:'hls',quality:'1080p',server:'Fixture',audioTracks:[{label:'English'}],subtitles:subs,headers:{Referer:'https://source.example/'}}]};
const externalSubs='#EXTM3U\n#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="cc",URI="captions.m3u8"\n#EXT-X-STREAM-INF:BANDWIDTH=4000000,RESOLUTION=1920x800,SUBTITLES="cc"\nvideo.m3u8';
const audio='#EXTM3U\n#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",URI="audio.m3u8"\n#EXT-X-STREAM-INF:BANDWIDTH=4000000,RESOLUTION=1920x800,AUDIO="audio"\nvideo.m3u8';
(async()=>{for(const scraper of manifest.scrapers){const code=fs.readFileSync(path.join(__dirname,scraper.filename),'utf8');
 function load(fetch,timers={}){const box={module:{exports:{}},URL:LegacyURL,fetch,console:{log(){}},...timers};vm.runInNewContext(code.replace('module.exports = { getStreams: getStreams };','module.exports = {getStreams,normalize,expandQualities,resolveUrl,copyStream,fetchWithin};'),box);return box.module.exports;}
 const prefix=scraper.name+' — ',p=load(()=>Promise.reject(Error('Unexpected'))),s=p.normalize(payload)[0];
 check(prefix+'parent paths normalize with limited URL bindings',()=>assert.equal(p.resolveUrl('../720.m3u8?token=a%2Fb','https://cdn.example/path/master.json?old=1'),'https://cdn.example/720.m3u8?token=a%2Fb'));
 check(prefix+'query-only paths keep filename and signed values',()=>assert.equal(p.resolveUrl('?token=a%2Fb','https://cdn.example/path/master.json?old=1'),'https://cdn.example/path/master.json?token=a%2Fb'));
 check(prefix+'non-HTTP protocols are rejected',()=>assert.equal(p.resolveUrl('javascript:alert(1)','https://cdn.example/'),''));
 const caption=await load(()=>Promise.resolve(response(externalSubs))).expandQualities(s);
 check(prefix+'external subtitle groups keep playable Auto master',()=>{assert.equal(caption.length,1);assert.equal(caption[0].quality,'Auto');assert.equal(caption[0].type,'hls');assert.equal(caption[0].subtitles[0].headers.Referer,'https://source.example/');});
 const sound=await load(()=>Promise.resolve(response(audio))).expandQualities(s);
 check(prefix+'external audio is preserved',()=>{assert.equal(sound.length,1);assert(sound[0].title.includes('English'));assert(sound[0].url.includes('master.json'));});
 const json=await load(()=>Promise.resolve(response('{"error":"expired"}'))).expandQualities(s);
 check(prefix+'JSON errors are not treated as media',()=>assert.equal(json.length,0));
 const html=await load(()=>Promise.resolve(response('<!DOCTYPE html><html>Error</html>'))).expandQualities(s);
 check(prefix+'HTML errors are not treated as media',()=>assert.equal(html.length,0));
 for(const status of [404,410]){const gone=await load(()=>Promise.resolve(response('',status))).expandQualities(s);check(prefix+'HTTP '+status+' sources are omitted',()=>assert.equal(gone.length,0));}
 const region=await load(()=>Promise.resolve(response('',403))).expandQualities(s);
 check(prefix+'region-dependent probe failures retain API source',()=>assert.equal(region.length,1));
 let calls=[];const full=load(u=>{calls.push(u);if(u.includes('api.wecollege.net'))return Promise.resolve(response({},503));return Promise.resolve(response({success:true,sources:[{url:'https://cdn.example/video.mp4',quality:'1080p',type:'mp4'}]}));});
 const movie=await full.getStreams('TMDB/969681','movie');check(prefix+'Spider-Man movie ID reaches the correct provider',()=>{assert(movie.length===1);assert(calls.some(u=>u.includes('id=969681')&&u.includes('provider=')));});
 const bad=await full.getStreams('969681','tv',1,0);check(prefix+'invalid episodes cannot substitute episode one',()=>assert.equal(bad.length,0));
 const timer=load(()=>new Promise(()=>{}),{setTimeout:(fn)=>setTimeout(fn,2),clearTimeout});await assert.rejects(timer.fetchWithin('https://fixture.invalid/',{},10),/timeout/);check(prefix+'optional request deadlines prevent indefinite waits',()=>{});
 }
 console.log('\n'+checks+' checks passed across seven providers.');
})().catch(e=>{console.error(e);process.exitCode=1;});
