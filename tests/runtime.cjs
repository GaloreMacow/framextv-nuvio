const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),acorn=require('acorn'),{getQuickJS}=require('quickjs-emscripten');
const manifest=require('../manifest.json');
(async()=>{let checks=0;const engine=await getQuickJS();
 for(const scraper of manifest.scrapers){
  const source=fs.readFileSync(path.join(__dirname,'..',scraper.filename),'utf8');
  acorn.parse(source,{ecmaVersion:5});
  assert(!/\b(?:require\s*\(|eval\s*\(|Buffer\b|document\b|window\b|AbortController\b)/.test(source));
  assert.equal(scraper.version,manifest.version);
  console.log('PASS '+scraper.id+' ES5, standalone runtime and release version');checks++;
  const context=engine.newContext();
  try{
   const code=source.replace('module.exports = { getStreams: getStreams };','module.exports = {getStreams,normalize,parseMaster,resolveUrl};');
   const prelude='var module={exports:{}};var console={log:function(){}};function URL(v){if(!/^https?:/.test(v))throw Error("absolute only");this.href=v;this.protocol=v.split(":")[0]+":";}';
   let r=context.evalCode(prelude+code);if(r.error)throw Error(context.dump(r.error));r.value.dispose();
   r=context.evalCode('JSON.stringify({loaded:typeof module.exports.getStreams, stream:module.exports.normalize({sources:[{url:"https://cdn.example/video.mp4",quality:"1080p",type:"mp4"}]})[0], url:module.exports.resolveUrl("../video.m3u8?sig=a%2Fb","https://cdn.example/path/master.m3u8"), master:module.exports.parseMaster("#EXTM3U\\n#EXT-X-STREAM-INF:BANDWIDTH=1000000,RESOLUTION=1920x800\\nvideo.m3u8","https://cdn.example/master.m3u8")})');
   if(r.error)throw Error(context.dump(r.error));const value=JSON.parse(context.dump(r.value));r.value.dispose();
   assert.equal(value.loaded,'function');assert.equal(value.stream.name,'1080p');assert.equal(value.stream.title,'1080p');assert.equal(value.url,'https://cdn.example/video.m3u8?sig=a%2Fb');assert.equal(value.master.variants[0].quality,'1080p');
   console.log('PASS '+scraper.id+' QuickJS parsing with limited URL and no timers/Node');checks++;
  }finally{context.dispose();}
 }
 console.log(`\n${checks} runtime checks passed.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
