// Client for the free, keyless NHTSA vPIC "Decode VIN (flat format)" endpoint.
// Docs: https://vpic.nhtsa.dot.gov/api/  Endpoint: /api/vehicles/DecodeVinValues/{vin}?format=json[&modelyear=YYYY]
import {checkVin,type VinCheck} from './vin';
export const VPIC_BASE='https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/';
export const VPIC_DOCS='https://vpic.nhtsa.dot.gov/api/';
export const VPIC_DECODER='https://vpic.nhtsa.dot.gov/decoder/';
export const NHTSA_RECALLS='https://www.nhtsa.gov/recalls';
export const NICB_VINCHECK='https://www.nicb.org/vincheck';
export const NMVTIS='https://vehiclehistory.bja.ojp.gov/nmvtis_vehiclehistory';
export const TIMEOUT_MS=8000;
export const MAX_BYTES=256_000;
export const UPSTREAM_PER_MINUTE=60;
const CACHE_TTL_MS=3_600_000,CACHE_MAX=500;
// Friendly names for the decoded fields we surface as "facts". Everything else non-empty goes to additional_decoded.
export const FACT_FIELDS:Record<string,string>={Make:'make',Manufacturer:'manufacturer',Model:'model',ModelYear:'model_year',Trim:'trim',Trim2:'trim2',Series:'series',Series2:'series2',BodyClass:'body_class',VehicleType:'vehicle_type',Doors:'doors',Seats:'seats',SeatRows:'seat_rows',DriveType:'drive_type',EngineConfiguration:'engine_configuration',EngineCylinders:'engine_cylinders',DisplacementL:'displacement_l',EngineHP:'engine_hp',EngineModel:'engine_model',FuelTypePrimary:'fuel_type_primary',FuelTypeSecondary:'fuel_type_secondary',ElectrificationLevel:'electrification_level',BatteryKWh:'battery_kwh',TransmissionStyle:'transmission_style',TransmissionSpeeds:'transmission_speeds',GVWR:'gvwr',PlantCountry:'plant_country',PlantState:'plant_state',PlantCity:'plant_city',PlantCompanyName:'plant_company_name'};
const SKIP=new Set(['VIN','VehicleDescriptor','ErrorCode','ErrorText','AdditionalErrorText','SuggestedVIN','PossibleValues','Note']);
const EMPTY=new Set(['','not applicable','null','0.0']);
export interface DecodeResult{input_vin:string;vin_check:VinCheck;decode_status:'decoded'|'partial'|'empty';facts:Record<string,string>;additional_decoded:Record<string,string>;vpic_messages:string[];vpic_note:string|null;suggested_vin:string|null;please_verify_yourself:string[];links:{nhtsa_recalls:string;nicb_vincheck:string;nmvtis_approved_providers:string;vpic_decoder:string};source:{name:string;endpoint:string;docs:string;retrieved_at:string;cached:boolean};scope:string;disclaimer:string}
export const PLEASE_VERIFY=[
 'Equipment and options (for example sunroof vs panoramic roof, packages, driver assistance, infotainment): a VIN decode does not prove what is fitted. Check the car, the window sticker or the manufacturer build sheet.',
 'Trim and engine where they are missing or ambiguous above: do not fill gaps with what the trim "usually" has.',
 'Mileage, accidents, title brands (salvage, flood), number of owners and service history: not part of a VIN decode.',
 'Open safety recalls: free VIN lookup at NHTSA (US vehicles).',
 'Theft and insurance salvage/flood records: free NICB VINCheck (US-insured vehicles, max. five searches per IP per 24 hours).',
 'Colour, condition, modifications and that the VIN on the car matches the title/registration.'
];
export const SCOPE='NHTSA vPIC decodes VINs from manufacturer submissions for vehicles sold in the United States. Vehicles built for Europe or other markets often decode partially or not at all. Missing values mean NHTSA has no data, not that a feature is absent.';
export const DISCLAIMER='Basic decoded facts only. Not a vehicle history report, not a recall check and not proof of identity or ownership.';
export class UpstreamError extends Error{}
// Best-effort, per-isolate limiter for calls to NHTSA (protects the free public API, not a global guarantee).
let windowStart=0,windowCount=0;
export function upstreamLimited(now=Date.now()){if(now-windowStart>=60000){windowStart=now;windowCount=0;}return ++windowCount>UPSTREAM_PER_MINUTE;}
export function resetUpstreamState(){windowStart=0;windowCount=0;cache.clear();}
const cache=new Map<string,{at:number;results:Record<string,unknown>}>();
async function readLimited(res:Response):Promise<string>{
 const len=Number(res.headers.get('content-length')??'0');if(len>MAX_BYTES)throw new UpstreamError(`NHTSA vPIC response is larger than ${MAX_BYTES} bytes; refused.`);
 const reader=res.body?.getReader();if(!reader)return '';
 const dec=new TextDecoder();let out='',size=0;
 while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_BYTES){await reader.cancel().catch(()=>{});throw new UpstreamError(`NHTSA vPIC response is larger than ${MAX_BYTES} bytes; refused.`);}out+=dec.decode(value,{stream:true});}
 return out+dec.decode();
}
export async function fetchVpic(vin:string,modelYear?:number):Promise<{results:Record<string,unknown>;cached:boolean}>{
 const key=`${vin}|${modelYear??''}`;const hit=cache.get(key);
 if(hit&&Date.now()-hit.at<CACHE_TTL_MS)return {results:hit.results,cached:true};
 if(upstreamLimited())throw new UpstreamError('Too many VIN decodes on this server right now (protecting the free NHTSA API). Please try again in a minute, or use the NHTSA decoder directly: '+VPIC_DECODER);
 const url=`${VPIC_BASE}${encodeURIComponent(vin)}?format=json${modelYear?`&modelyear=${modelYear}`:''}`;
 const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),TIMEOUT_MS);
 let text:string;
 try{
  const res=await fetch(url,{signal:ctrl.signal,headers:{accept:'application/json','user-agent':'vin-report-check-mcp/0.1 (+https://aicarvideo.com)'},redirect:'manual'});
  if(!res.ok)throw new UpstreamError(`NHTSA vPIC answered with HTTP ${res.status}. Try again later or use ${VPIC_DECODER}`);
  text=await readLimited(res);
 }catch(e){if(e instanceof UpstreamError)throw e;if(ctrl.signal.aborted)throw new UpstreamError(`NHTSA vPIC did not answer within ${TIMEOUT_MS/1000} seconds. Try again later or use ${VPIC_DECODER}`);throw new UpstreamError(`NHTSA vPIC could not be reached. Try again later or use ${VPIC_DECODER}`);}
 finally{clearTimeout(timer);}
 let data:unknown;try{data=JSON.parse(text);}catch{throw new UpstreamError('NHTSA vPIC returned something that is not JSON. Try again later.');}
 const results=(data as {Results?:unknown})?.Results;
 if(!Array.isArray(results)||!results[0]||typeof results[0]!=='object')throw new UpstreamError('NHTSA vPIC returned an unexpected format (no Results). Try again later.');
 const r=results[0] as Record<string,unknown>;
 if(cache.size>=CACHE_MAX){const first=cache.keys().next().value;if(first!==undefined)cache.delete(first);}
 cache.set(key,{at:Date.now(),results:r});
 return {results:r,cached:false};
}
const clean=(v:unknown)=>{if(typeof v!=='string'&&typeof v!=='number')return null;const s=String(v).trim().replace(/\s+/g,' ');return EMPTY.has(s.toLowerCase())?null:s.slice(0,200);};
export function interpret(r:Record<string,unknown>){
 const facts:Record<string,string>={},additional:Record<string,string>={};
 for(const [k,name] of Object.entries(FACT_FIELDS)){const v=clean(r[k]);if(v)facts[name]=v;}
 for(const [k,v] of Object.entries(r)){if(k in FACT_FIELDS||SKIP.has(k)||/I[dD]$/.test(k))continue;const c=clean(v);if(c&&Object.keys(additional).length<60)additional[k]=c;}
 const errText=clean(r.ErrorText);const messages=errText?errText.split(/;\s*/).filter(Boolean):[];
 const core=['make','model','model_year'].filter(k=>facts[k]).length;
 const status:DecodeResult['decode_status']=!facts.make&&!facts.model?'empty':core===3?'decoded':'partial';
 return {facts,additional,messages,status,suggested:clean(r.SuggestedVIN)};
}
export async function decodeVinFacts(args:{vin:string;model_year?:number}):Promise<DecodeResult>{
 const check=checkVin(args.vin);
 const {results,cached}=await fetchVpic(check.normalized_vin,args.model_year);
 const {facts,additional,messages,status,suggested}=interpret(results);
 const out:DecodeResult={input_vin:args.vin,vin_check:check,decode_status:status,facts:status==='empty'?{}:facts,additional_decoded:status==='empty'?{}:additional,vpic_messages:messages,vpic_note:null,suggested_vin:suggested,please_verify_yourself:PLEASE_VERIFY,links:{nhtsa_recalls:NHTSA_RECALLS,nicb_vincheck:NICB_VINCHECK,nmvtis_approved_providers:NMVTIS,vpic_decoder:VPIC_DECODER},source:{name:'NHTSA Product Information Catalog and Vehicle Listing (vPIC), Decode VIN (flat format)',endpoint:VPIC_BASE+'{vin}?format=json',docs:VPIC_DOCS,retrieved_at:new Date().toISOString(),cached},scope:SCOPE,disclaimer:DISCLAIMER};
 if(status==='empty')out.vpic_note=check.wmi_region==='North America'?'NHTSA vPIC returned no make or model for this VIN. Check the VIN for typos; we do not guess specifications.':'NHTSA vPIC returned no make or model. This is common for vehicles built for markets outside the US (vPIC is US-focused). We do not guess specifications; use the manufacturer, the registration document or a national registry instead.';
 else if(status==='partial')out.vpic_note='Partial decode: some core facts (make, model, model year) are missing. Treat everything not listed as unknown and verify it yourself.';
 return out;
}
