import {parseLink,classify,assessmentText,WARNING_PATTERN,OFFICIAL_FREE_CHECKS,CHECKED_ON,type Match,type DocumentedDomain} from './links';
import {decodeVinFacts,type DecodeResult} from './vpic';
export {decodeVinFacts};
export interface LinkResult{link:{input:string;host:string;registrable_domain:string;scheme:string};match:Match;assessment:string;documented_entry:DocumentedDomain|null;link_red_flags:string[];warning_pattern:typeof WARNING_PATTERN;official_free_checks:typeof OFFICIAL_FREE_CHECKS;vin_facts:DecodeResult|{error:string}|null;list_policy:string;checked_on:string;disclaimer:string}
export const LIST_POLICY='The documented list only contains domains named in public, dated reports of this exact pattern, each with its source. Being on the list means "reported in this pattern", not a legal finding. Not being on the list means nothing about safety. Corrections: open an issue at https://github.com/TRW123123/vin-report-check-mcp/issues.';
export async function checkVinReportLink(args:{link:string;vin?:string}):Promise<LinkResult>{
 const p=parseLink(args.link);
 const c=classify(p);
 let vin_facts:LinkResult['vin_facts']=null;
 if(args.vin){try{vin_facts=await decodeVinFacts({vin:args.vin});}catch(e){vin_facts={error:e instanceof Error?e.message:'VIN could not be decoded.'};}}
 return {link:{input:p.input,host:p.host,registrable_domain:p.registrable_domain,scheme:p.scheme},match:c.match,assessment:assessmentText(c.match,p.host,c.known_name),documented_entry:c.entry,link_red_flags:c.flags,warning_pattern:WARNING_PATTERN,official_free_checks:OFFICIAL_FREE_CHECKS,vin_facts,list_policy:LIST_POLICY,checked_on:CHECKED_ON,disclaimer:'This tool never opens the link. It explains a documented pattern and points to official free checks; it is not a verdict about any person or company and not legal advice.'};
}
