// Opt-in live network check. Does not download full episodes or publish signed URLs.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{execFile}=require('node:child_process');
const manifest=require('../manifest.json');
let requests=[];
function fetchCurl(url,options={},provider){return new Promise((resolve,reject)=>{
 const args=['-sS','-L','--max-time','26','-w','\n%{http_code}\n%{url_effective}',url];
 for(const [key,value]of Object.entries(options.headers||{}))args.push('-H',key+': '+value);
 execFile('curl',args,{maxBuffer:8e6},(error,output)=>{
  const record={provider,host:new URL(url).hostname,path:new URL(url).pathname};
  if(error){requests.push({...record,error:error.code===28?'timeout':'network'});return reject(Error('Network request failed'));}
  const lines=output.split('\n'),final=lines.pop(),status=Number(lines.pop()),body=lines.join('\n');
  const detail={...record,status,bytes:body.length};
  if(new URL(url).pathname==='/api/stream'){try{const data=JSON.parse(body);detail.success=data.success;detail.sourceCount=Array.isArray(data.sources)?data.sources.length:0;detail.code=data.code;detail.reason=String(data.error||'').replace(/https?:\/\/\S+/g,'[URL]');detail.alternates=data.alternates;}catch{detail.invalidJSON=true;}}
  requests.push(detail);
  resolve({ok:status>=200&&status<300,status,url:final,text:()=>Promise.resolve(body),json:()=>Promise.resolve().then(()=>JSON.parse(body))});
 });
});}
(async()=>{
 const id=process.env.LIVE_ID||'969681',type=process.env.LIVE_TYPE||'movie';
 const results=await Promise.all(manifest.scrapers.filter(s=>!process.env.LIVE_PROVIDER||s.id===process.env.LIVE_PROVIDER).map(async scraper=>{
  const start=Date.now(),logs=[],box={module:{exports:{}},URL,setTimeout,clearTimeout,console:{log:x=>logs.push(String(x))},fetch:(u,o)=>fetchCurl(u,o,scraper.id)};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..',scraper.filename),'utf8'),box);
  const streams=await box.module.exports.getStreams(id,type,Number(process.env.LIVE_SEASON||1),Number(process.env.LIVE_EPISODE||1));
  if(streams.some(s=>s.name!==s.quality||s.title!==s.quality||!/^(Auto|Unknown|4K|[1-9]\d{2,3}p)$/.test(s.quality)))throw Error('Result label must contain only resolution');
  if(process.env.LIVE_OUTPUT_DIR){fs.mkdirSync(process.env.LIVE_OUTPUT_DIR,{recursive:true});fs.writeFileSync(path.join(process.env.LIVE_OUTPUT_DIR,scraper.id+'.json'),JSON.stringify(streams));}
  return {provider:scraper.id,seconds:Math.round((Date.now()-start)/1000),count:streams.length,streams:streams.map(s=>({name:s.name,title:s.title,quality:s.quality,host:new URL(s.url).hostname,subtitles:s.subtitles.length})),logs};
 }));
 console.log(JSON.stringify({tmdbId:id,type,results,requests},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
