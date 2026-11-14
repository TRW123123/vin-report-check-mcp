export type Schema={type?:string|string[];description?:string;examples?:unknown[];properties?:Record<string,Schema>;items?:Schema;required?:string[];additionalProperties?:boolean;enum?:readonly unknown[];maxLength?:number;minLength?:number;minimum?:number;maximum?:number;maxItems?:number;pattern?:string;default?:unknown};
// Same validator as car-listing-check / passbild-regel-check, English messages.
export function validate(value:unknown,s:Schema,path='arguments'):void{
 if(s.type==='object'){
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error(`${path} must be an object.`);
  const v=value as Record<string,unknown>;
  for(const k of s.required??[])if(!(k in v))throw Error(`${path}.${k} is missing (required).`);
  for(const [k,x] of Object.entries(v)){const child=s.properties&&Object.hasOwn(s.properties,k)?s.properties[k]:undefined;if(!child){if(s.additionalProperties===false)throw Error(`${path}: unknown field ${k}.`);}else validate(x,child,`${path}.${k}`);}
 }else if(s.type==='string'){
  if(typeof value!=='string'||!value.trim()||Array.from(value).length>(s.maxLength??Infinity)||Array.from(value.trim()).length<(s.minLength??0)||(s.pattern&&!new RegExp(s.pattern).test(value)))throw Error(`${path} must be a non-empty string${s.minLength?` of at least ${s.minLength}`:''}${s.maxLength?` and at most ${s.maxLength} characters`:''}.`);
 }else if(s.type==='number'||s.type==='integer'){
  if(typeof value!=='number'||!Number.isFinite(value)||value<(s.minimum??-Infinity)||value>(s.maximum??Infinity)||(s.type==='integer'&&!Number.isInteger(value)))throw Error(`${path} must be ${s.type==='integer'?'an integer':'a number'} between ${s.minimum} and ${s.maximum}.`);
 }
 if(s.enum&&!s.enum.includes(value))throw Error(`${path} must be one of: ${s.enum.join(', ')}.`);
}
const vin:Schema={type:'string',description:'Vehicle Identification Number. A full VIN has 17 characters (letters and digits, never I, O or Q). Spaces and dashes are ignored. Partial VINs of 11-16 characters, or with * for unknown positions, are decoded partially (as in the NHTSA vPIC docs).',examples:['3GNDA13D76S000000','5UXWX7C5*BA'],minLength:11,maxLength:40};
export const decodeInput:Schema={type:'object',additionalProperties:false,required:['vin'],properties:{
 vin,
 model_year:{type:'integer',description:'Optional model year. NHTSA recommends sending it; it matters most for partial VINs and pre-1980 vehicles.',examples:[2011],minimum:1950,maximum:2030}
}};
export const linkInput:Schema={type:'object',additionalProperties:false,required:['link'],properties:{
 link:{type:'string',description:'The URL or bare domain a buyer sent you, e.g. "https://example-report.com/check?vin=..." or "example-report.com". The server never opens this link.',examples:['vinner.us','https://www.example.com/report'],minLength:3,maxLength:2000},
 vin:{...vin,description:'Optional VIN of your own vehicle. If given, the basic facts are decoded for free via NHTSA vPIC so you have something neutral to show a buyer.'}
}};
