import {decodeVinFacts,checkVinReportLink} from './logic';
import {validate} from './schema';
import {tools} from './tools';
import {UpstreamError} from './vpic';
import {LinkError} from './links';
import {version} from '../package.json';
export interface Env {ANALYTICS?:{writeDataPoint(point:{blobs:string[];doubles:number[]}):void}}
export const serverInfo={name:'vin-report-check',title:'VIN Report Check',version,websiteUrl:'https://aicarvideo.com',_meta:{developer:'AI Car Video (Safak Tepecik)'}};
const versions=['2025-03-26','2025-06-18','2025-11-25'];
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST, GET, OPTIONS','Access-Control-Allow-Headers':'content-type, accept, mcp-protocol-version, mcp-session-id','Access-Control-Max-Age':'86400'};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'content-type':'application/json','cache-control':'no-store'}});
const error=(id:unknown,code:number,message:string,status=200)=>json({jsonrpc:'2.0',id,error:{code,message}},status);
// No IPs are logged or stored. Best-effort limiter per isolate, not a global security boundary.
const buckets=new Map<string,{start:number;count:number}>();
export function limited(ip:string|null){if(!ip)return false;const now=Date.now();for(const [k,v] of buckets)if(now-v.start>=60000)buckets.delete(k);let b=buckets.get(ip);if(!b){if(buckets.size>=2048)return true;b={start:now,count:0};buckets.set(ip,b);}return ++b.count>120;}
async function readBody(req:Request){const reader=req.body?.getReader();if(!reader)throw Error('Supply a JSON-RPC body.');const decoder=new TextDecoder('utf-8',{fatal:true});let body='',size=0,timedOut=false;const timer=setTimeout(()=>{timedOut=true;void reader.cancel().catch(()=>{});},5000);try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>100000){await reader.cancel();throw Error('Request exceeds 100,000 bytes.');}body+=decoder.decode(value,{stream:true});}if(timedOut)throw Error('Request body timed out after five seconds.');body+=decoder.decode();return body;}finally{clearTimeout(timer);reader.releaseLock();}}
const summary=(v:Awaited<ReturnType<typeof decodeVinFacts>>)=>{const f=v.facts;const core=[f.model_year,f.make,f.model,f.trim].filter(Boolean).join(' ');return `VIN ${v.vin_check.normalized_vin}: ${v.decode_status==='empty'?'no make/model from NHTSA vPIC.':`${core||'partial data'}${f.body_class?`, ${f.body_class}`:''}${f.engine_cylinders?`, ${f.engine_cylinders} cyl`:''}${f.displacement_l?` ${f.displacement_l} L`:''}${f.fuel_type_primary?`, ${f.fuel_type_primary}`:''}${f.plant_country?`, built in ${f.plant_country}`:''}.`} ${v.vpic_note??''} ${v.vin_check.notes.join(' ')} Please verify yourself: equipment, history, recalls (${v.links.nhtsa_recalls}), theft/salvage (${v.links.nicb_vincheck}). Source: NHTSA vPIC.`.replace(/\s+/g,' ').trim();};
export default {async fetch(req:Request,env:Env={}):Promise<Response>{
 const path=new URL(req.url).pathname;
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(path==='/health'&&req.method==='GET')return json({status:'ok'});
 if(path==='/'&&req.method==='GET')return new Response('VIN Report Check (MCP server)\nDecodes basic VIN facts via the free NHTSA vPIC API and explains the fake-buyer vehicle history report link pattern, with official free checks (NICB VINCheck, NHTSA recalls).\nWebsite: https://aicarvideo.com\nPOST JSON-RPC to /mcp. Links you check are never opened; nothing is stored.\n',{headers:{...cors,'content-type':'text/plain; charset=utf-8'}});
 if(path!=='/mcp')return json({error:'Route not found. Use GET /health or POST /mcp.'},404);
 if(req.method!=='POST')return new Response(JSON.stringify({error:'Use POST /mcp with JSON-RPC; GET streaming is not offered.'}),{status:405,headers:{...cors,'content-type':'application/json',Allow:'POST, OPTIONS'}});
 if(limited(req.headers.get('cf-connecting-ip')))return json({error:'Too many requests. Please try again in a minute.'},429);
 if(!req.headers.get('content-type')?.toLowerCase().includes('application/json'))return error(null,-32600,'Use Content-Type: application/json.',415);
 const pv=req.headers.get('mcp-protocol-version');if(pv&&!versions.includes(pv))return error(null,-32600,'Unsupported mcp-protocol-version; use 2025-03-26, 2025-06-18 or 2025-11-25.',400);
 let rpc:Record<string,unknown>;
 try{const parsed:unknown=JSON.parse(await readBody(req));if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))return error(null,-32600,'Supply one JSON-RPC object; batches are not supported.',400);rpc=parsed as Record<string,unknown>;}catch{return error(null,-32700,'Could not read JSON. Supply valid JSON within 100,000 bytes and five seconds.',400);}
 const id=rpc.id??null;
 if(rpc.jsonrpc!=='2.0'||typeof rpc.method!=='string'||(rpc.id!==undefined&&rpc.id!==null&&typeof rpc.id!=='string'&&typeof rpc.id!=='number')||(rpc.params!==undefined&&(!rpc.params||typeof rpc.params!=='object'||Array.isArray(rpc.params))))return error(null,-32600,'Invalid JSON-RPC envelope or params.',400);
 const params=(rpc.params??{}) as Record<string,unknown>;
 // Notifications never get a JSON-RPC response.
 if(!('id' in rpc))return new Response(null,{status:202,headers:cors});
 const reply=(result:unknown)=>json({jsonrpc:'2.0',id,result});
 switch(rpc.method){
 case 'initialize':return reply({protocolVersion:typeof params.protocolVersion==='string'&&versions.includes(params.protocolVersion)?params.protocolVersion:'2025-06-18',capabilities:{tools:{listChanged:false}},serverInfo});
 case 'ping':return reply({});
 case 'tools/list':return reply({tools});
 case 'tools/call':{
  const start=performance.now();let ok=false;const definition=tools.find(t=>t.name===params.name);
  try{
   if(!definition)throw Error('Unknown tool. Call tools/list to see the available tools.');
   const args=params.arguments??{};validate(args,definition.inputSchema);
   if(definition.name==='decode_vin_facts'){const r=await decodeVinFacts(args as {vin:string;model_year?:number});ok=true;return reply({structuredContent:r,content:[{type:'text',text:summary(r)}]});}
   const r=await checkVinReportLink(args as {link:string;vin?:string});ok=true;
   const vinText=r.vin_facts?('error' in r.vin_facts?` VIN: ${r.vin_facts.error}`:` ${summary(r.vin_facts)}`):'';
   return reply({structuredContent:r,content:[{type:'text',text:`${r.assessment}${r.link_red_flags.length?` Link red flags: ${r.link_red_flags.join(' ')}`:''} Free official checks: ${r.official_free_checks.map(c=>`${c.name} ${c.url}`).join('; ')}. Safe reply to the buyer: "Here is the VIN, feel free to get any report you like."${vinText}`}]});
  }catch(e){const msg=e instanceof UpstreamError||e instanceof LinkError||e instanceof Error?e.message:'Input could not be processed. Check the tool name and arguments.';return reply({isError:true,content:[{type:'text',text:msg}]});}
  finally{const ms=Math.round((performance.now()-start)*1000)/1000;const tool=definition?.name??'unknown';console.log(JSON.stringify({evt:'tool_call',tool,ok,ms}));try{if(env.ANALYTICS)env.ANALYTICS.writeDataPoint({blobs:[tool,String(ok)],doubles:[ms]});}catch{/* Monitoring must never fail a tool call. */}}
 }
 default:return error(id,-32601,'Unknown method. Supported: initialize, ping, tools/list, tools/call and notifications/initialized.');
 }
}};
