// VIN syntax checks. Pure functions, no network.
export type Region='North America'|'Oceania'|'South America'|'Africa'|'Asia'|'Europe'|'unknown';
export interface VinCheck{normalized_vin:string;partial:boolean;length:number;allowed_characters:boolean;wmi:string|null;wmi_region:Region;check_digit:{applicable:boolean;expected:string|null;found:string|null;valid:boolean|null;mandatory_for_region:boolean};notes:string[]}
const translit:Record<string,number>={A:1,B:2,C:3,D:4,E:5,F:6,G:7,H:8,J:1,K:2,L:3,M:4,N:5,P:7,R:9,S:2,T:3,U:4,V:5,W:6,X:7,Y:8,Z:9};
const weights=[8,7,6,5,4,3,2,10,0,9,8,7,6,5,4,3,2];
export const CFR_565='https://www.ecfr.gov/current/title-49/subtitle-B/chapter-V/part-565';
/** ISO 3779 / 49 CFR 565 check digit (9th position) for a full 17-character VIN. */
export function computeCheckDigit(vin:string):string{
 let sum=0;
 for(let i=0;i<17;i++){const c=vin[i];const v=/[0-9]/.test(c)?Number(c):translit[c];if(v===undefined)throw Error(`Character ${c} is not allowed in a VIN.`);sum+=v*weights[i];}
 const r=sum%11;return r===10?'X':String(r);
}
/** Approximate world region from the first VIN character (WMI). */
export function regionOf(first:string):Region{
 if(/[1-5]/.test(first))return 'North America';
 if(/[67]/.test(first))return 'Oceania';
 if(/[89]/.test(first))return 'South America';
 if(/[A-H]/.test(first))return 'Africa';
 if(/[J-NPR]/.test(first))return 'Asia';
 if(/[S-Z]/.test(first))return 'Europe';
 return 'unknown';
}
/** Normalizes and checks a VIN. Throws a readable error for anything that cannot be a VIN. */
export function checkVin(input:string):VinCheck{
 const normalized=input.toUpperCase().replace(/[\s-]+/g,'');
 if(!normalized)throw Error('Supply a VIN.');
 if(/[IOQ]/.test(normalized))throw Error('VINs never contain the letters I, O or Q (they are confused with 1 and 0). Check the VIN for a typo.');
 if(!/^[A-HJ-NPR-Z0-9*]+$/.test(normalized))throw Error('A VIN may only contain letters A-Z (without I, O, Q) and digits 0-9; * marks unknown positions in a partial VIN.');
 if(normalized.length>17)throw Error(`A VIN has exactly 17 characters; this one has ${normalized.length}.`);
 if(normalized.length<11)throw Error(`Too short for a decode: a full VIN has 17 characters (partial VINs need at least 11); this one has ${normalized.length}.`);
 if(/^\*/.test(normalized))throw Error('The first characters (manufacturer code) must be known; do not start a VIN with *.');
 const partial=normalized.length<17||normalized.includes('*');
 const region=regionOf(normalized[0]);
 const mandatory=region==='North America';
 const notes:string[]=[];
 let expected:string|null=null,found:string|null=null,valid:boolean|null=null;
 if(!partial){
  expected=computeCheckDigit(normalized);found=normalized[8];valid=expected===found;
  if(!valid&&mandatory)notes.push(`Check digit mismatch: position 9 is ${found}, the calculation gives ${expected}. For vehicles built for North America the check digit is mandatory (49 CFR Part 565), so this usually means a typo, a sample/placeholder VIN, or a VIN that is not genuine. Any decoded facts describe the VIN pattern, not a verified vehicle.`);
  else if(!valid)notes.push(`Check digit mismatch (position 9 is ${found}, calculation gives ${expected}). Outside North America the check digit is not mandatory, so this alone is not a red flag; many European VINs use other characters there.`);
  else notes.push('Check digit (position 9) is valid. This only shows the VIN is well-formed, not that it belongs to the car in front of you.');
 }else notes.push('Partial VIN: only the known characters are decoded and the check digit cannot be verified.');
 if(region!=='North America')notes.push(`First character ${normalized[0]} suggests a manufacturer code from ${region}. NHTSA vPIC covers vehicles certified for the US market; vehicles built for Europe or other markets often decode only partially or not at all, and the 10th character (model year) is not mandatory there, so a decoded model year can be wrong.`);
 return {normalized_vin:normalized,partial,length:normalized.length,allowed_characters:true,wmi:normalized.length>=3&&!normalized.slice(0,3).includes('*')?normalized.slice(0,3):null,wmi_region:region,check_digit:{applicable:!partial,expected,found,valid,mandatory_for_region:mandatory},notes};
}
