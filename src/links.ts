// Analyses a link a "buyer" sent. The server NEVER opens, fetches or resolves the link: no SSRF surface.
// The parser still refuses non-http(s) schemes and private/internal hosts so they are never echoed as "websites".
import {NHTSA_RECALLS,NICB_VINCHECK,NMVTIS} from './vpic';
export const CHECKED_ON='2026-11-12';
export interface Evidence{title:string;url:string;date:string;kind:string}
export interface DocumentedDomain{domain:string;summary:string;evidence:Evidence[];status_seen_on_check_date:string}
export const SRC={
 bbb:{title:'BBB Scam Alert: Beware of vehicle history report scams',url:'https://www.bbb.org/article/news-releases/17576-avoid-the-latest-scam-with-this-bbb-tip-vehicle-title-scam',date:'undated, read 2026-11-12',kind:'consumer-protection organisation'},
 snopes:{title:'Snopes: Vehicle History Report Scam: If You\'re Selling, Listen Up (quotes the FTC alert "Steering clear of vehicle history report scams", October 2018)',url:'https://www.snopes.com/articles/436483/vehicle-history-report-scam/',date:'read 2026-11-12',kind:'fact-check article quoting the US FTC'},
 mada:{title:'Michigan Auto Dealers Association reprint of the FTC alert "Steering clear of vehicle history report scams"',url:'https://www.michiganada.org/steering-clear-of-vehicle-history-report-scams/',date:'2018-10-25',kind:'reprint of US FTC consumer alert'},
 carsales:{title:'carsales.com.au Help Centre: Vehicle History Report Scam',url:'https://help.carsales.com.au/hc/en-gb/articles/41063080073625-Vehicle-History-Report-Scam',date:'read 2026-11-12',kind:'marketplace warning (Australia)'},
 nine:{title:'Nine.com.au: Vehicle history report scam (quotes Australia\'s National Anti-Scam Centre)',url:'https://www.nine.com.au/australia-news/vehicle-history-report-scam-is-it-legit-exclusive-20260825-p60rc4.html',date:'2026-08-25',kind:'news article quoting a government anti-scam centre'},
 motor1:{title:'Motor1: Facebook Marketplace seller spends $60 on a vehicle history report',url:'https://www.motor1.com/news/763427/facebook-marketplace-car-scam/',date:'read 2026-11-12',kind:'news article'}
} satisfies Record<string,Evidence>;
// Only domains with at least one public, dated report of the exact pattern. Wording: "reported", never "is a criminal".
export const DOCUMENTED:DocumentedDomain[]=[
 {domain:'historyofvehicle.com',summary:'Named in public seller reports as a site a supposed buyer insisted the seller buy a vehicle history report from.',status_seen_on_check_date:'Did not respond to a request from our test environment on 2026-11-12; Trustpilot states the company website has closed.',evidence:[
  {title:'r/Scams: "Selling my car on Facebook marketplace. Got sent these links to provide vehicle History Report https://historyofvehicle.com/ & https://www.vinautoreport.com/"',url:'https://www.reddit.com/r/Scams/comments/1fswaic/is_this_a_scam_selling_my_car_on_facebook/',date:'2024-09-30',kind:'public user report (read via search index)'},
  {title:'Trustpilot reviews of historyofvehicle.com (reviewers describe a buyer demanding a report from this site only)',url:'https://www.trustpilot.com/review/historyofvehicle.com',date:'2024-11 to 2024-12',kind:'public user reviews (read via search index)'}]},
 {domain:'vinautoreport.com',summary:'Named in public seller reports as a site a supposed buyer insisted the seller buy a vehicle history report from.',status_seen_on_check_date:'On 2026-11-12 the address redirected to unrelated third-party pages instead of a report site.',evidence:[
  {title:'r/Scams: "Got sent these links to provide vehicle History Report https://historyofvehicle.com/ & https://www.vinautoreport.com/"',url:'https://www.reddit.com/r/Scams/comments/1fswaic/is_this_a_scam_selling_my_car_on_facebook/',date:'2024-09-30',kind:'public user report (read via search index)'},
  {title:'r/Scams: "Selling used car, pretty sure I ordered a vehicle history from a scam site, what to do?" (seller was asked to order via vinautoreport.com)',url:'https://www.reddit.com/r/Scams/comments/1f7buga/selling_used_car_pretty_sure_i_ordered_a_vehicle/',date:'2024-09-02',kind:'public user report (read via search index)'}]},
 {domain:'vinner.us',summary:'Named in public seller reports as the only report site a supposed buyer would accept.',status_seen_on_check_date:'Online on 2026-11-12; its homepage advertises paid vehicle history reports (from $39.99 as indexed).',evidence:[
  {title:'r/Scams: "Buyer asking for vehicle history report from this specific website, vinner.us, is it a scam?"',url:'https://www.reddit.com/r/Scams/comments/1j8ts7p/buyer_asking_for_vehicle_history_report_from_this/',date:'2025-03-11',kind:'public user report (read via search index)'}]}
];
// Official/free resources. Matching one of these is not a warning.
export const OFFICIAL:{domain:string;name:string}[]=[
 {domain:'nicb.org',name:'National Insurance Crime Bureau (NICB), free VINCheck'},
 {domain:'nhtsa.gov',name:'US National Highway Traffic Safety Administration (NHTSA), free recall lookup'},
 {domain:'vpic.nhtsa.dot.gov',name:'NHTSA vPIC VIN decoder'},
 {domain:'vehiclehistory.gov',name:'NMVTIS (US Department of Justice), official list of approved history report providers'},
 {domain:'vehiclehistory.bja.ojp.gov',name:'NMVTIS (US Department of Justice), official list of approved history report providers'},
 {domain:'ftc.gov',name:'US Federal Trade Commission'}
];
// Widely known commercial providers (named by Motor1 as "well-known services"). A buyer insisting the seller pays is still the pattern.
export const WELL_KNOWN:{domain:string;name:string}[]=[{domain:'carfax.com',name:'Carfax'},{domain:'autocheck.com',name:'AutoCheck'}];
const LOOKALIKE_NAMES=['carfax','autocheck','nicb','nhtsa','nmvtis'];
export const OFFICIAL_FREE_CHECKS=[
 {name:'NICB VINCheck',url:NICB_VINCHECK,cost:'free',what:'Checks a 17-character VIN against theft (not recovered) and insurance salvage/flood records of participating US insurers. Max. five searches per IP address per 24 hours. Not a full history report.'},
 {name:'NHTSA recall lookup',url:NHTSA_RECALLS,cost:'free',what:'Shows unrepaired safety recalls for a VIN (US vehicles, recalls up to 15 years old, not all manufacturers).'},
 {name:'NMVTIS approved providers (vehiclehistory.gov)',url:NMVTIS,cost:'reports are paid, from providers approved by the US Department of Justice',what:'Official list of approved vehicle history report providers. The buyer can pick one and buy the report themselves.'}
];
export const WARNING_PATTERN={
 name:'Fake-buyer vehicle history report link',
 how_it_works:'A supposed buyer contacts a private seller (often on Facebook Marketplace, Craigslist or similar), asks a few normal questions, then says they will only buy after seeing a vehicle history report from one specific website they name. The seller pays (typically about $20-$60) and enters personal and card details. The "buyer" then disappears. Consumer protection sources say such sites can take the money, collect card and personal data, or earn referral fees.',
 red_flags:['The buyer insists on one specific, unfamiliar report website and rejects Carfax/AutoCheck or a report you already have.','The buyer wants you to pay, often promising to refund it with the purchase price.','Pressure to do it right now, before any call or viewing.','The domain is new, oddly spelled, imitates a known brand, or ends in .vin (named in the 2018 US FTC alert).'],
 what_to_do:['Do not buy a report on a site the buyer chose. Reply: "Here is the VIN, feel free to get any report you like."','Use the free official checks below yourself if you want neutral information to share.','If you already paid on such a site: contact your card issuer, watch your statements, and report it (US: reportfraud.ftc.gov; Australia: scamwatch.gov.au; elsewhere: your national consumer or police fraud line).','Report the buyer profile to the marketplace.'],
 sources:[SRC.bbb,SRC.snopes,SRC.mada,SRC.carsales,SRC.nine,SRC.motor1]
};
export class LinkError extends Error{}
const TWO_LEVEL=new Set(['co.uk','org.uk','ac.uk','com.au','net.au','org.au','co.nz','com.br','com.mx','co.za','co.jp','com.tr','com.cn','co.in']);
export function registrableDomain(host:string){const p=host.split('.');if(p.length<=2)return host;const last2=p.slice(-2).join('.');return TWO_LEVEL.has(last2)?p.slice(-3).join('.'):last2;}
function ipv4Private(ip:string){const o=ip.split('.').map(Number);if(o.length!==4||o.some(n=>!Number.isInteger(n)||n<0||n>255))return false;const [a,b]=o;return a===0||a===10||a===127||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&b===168)||(a===100&&b>=64&&b<=127)||(a===198&&(b===18||b===19))||a>=224;}
function ipv6Private(h:string){const ip=h.replace(/^\[|\]$/g,'').toLowerCase();if(ip==='::'||ip==='::1')return true;const mapped=ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);if(mapped)return ipv4Private(mapped[1]);if(/^::ffff:[0-9a-f]{1,4}:[0-9a-f]{1,4}$/.test(ip))return true;return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(ip);}
export interface ParsedLink{input:string;scheme:string;host:string;registrable_domain:string;is_ip_literal:boolean;punycode:boolean;has_credentials:boolean}
/** Parses a URL or bare domain. Only http/https; refuses private, loopback, link-local and internal hosts. Never performs a request or DNS lookup. */
export function parseLink(input:string):ParsedLink{
 const raw=input.trim();
 if(/\s/.test(raw))throw new LinkError('Paste only the link or domain, without other text or spaces.');
 const m=raw.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
 const hasScheme=/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(raw);
 if(m&&!hasScheme&&!/^[^:]+:\d+(\/|$)/.test(raw))throw new LinkError(`Only http and https links can be analysed (got "${m[1].toLowerCase()}:"). Do not open links with other schemes.`);
 let url:URL;try{url=new URL(hasScheme?raw:`https://${raw}`);}catch{throw new LinkError('This does not look like a valid web address or domain.');}
 const scheme=url.protocol.replace(':','');
 if(scheme!=='http'&&scheme!=='https')throw new LinkError(`Only http and https links can be analysed (got "${scheme}:"). Do not open links with other schemes.`);
 const host=url.hostname.toLowerCase().replace(/\.$/,'');
 if(!host)throw new LinkError('The link has no host name.');
 const v4=/^\d+\.\d+\.\d+\.\d+$/.test(host),v6=host.startsWith('[');
 if((v4&&ipv4Private(host))||(v6&&ipv6Private(host)))throw new LinkError('This points to a private, loopback or internal network address, not a public website. Nothing to check.');
 if(!v4&&!v6){
  if(host==='localhost'||/\.(localhost|local|internal|lan|home|corp|intranet|test|invalid|example)$/.test(host)||!host.includes('.'))throw new LinkError('This is not a public internet domain (internal or reserved name). Nothing to check.');
  if(!/^[a-z0-9.-]+$/.test(host)||host.split('.').some(l=>!l||l.length>63||l.startsWith('-')||l.endsWith('-')))throw new LinkError('This does not look like a valid domain name.');
 }
 return {input:raw,scheme,host,registrable_domain:v4||v6?host:registrableDomain(host),is_ip_literal:v4||v6,punycode:host.split('.').some(l=>l.startsWith('xn--')),has_credentials:Boolean(url.username||url.password)};
}
const matches=(host:string,domain:string)=>host===domain||host.endsWith('.'+domain);
export type Match='documented_reports'|'documented_tld_pattern'|'lookalike_of_known_name'|'official_free_check'|'well_known_provider'|'not_in_documented_list';
export function classify(p:ParsedLink){
 const flags:string[]=[];
 if(p.has_credentials)flags.push('The link contains "@" or credentials before the host name, a common trick to disguise the real destination.');
 if(p.is_ip_literal)flags.push('The link uses a raw IP address instead of a domain name; legitimate report providers do not do that.');
 if(p.punycode)flags.push('The domain uses internationalised characters (punycode "xn--"), which can imitate a familiar name.');
 if(p.scheme==='http')flags.push('The link uses plain http (no encryption). Never enter card details on such a page.');
 const official=OFFICIAL.find(o=>matches(p.host,o.domain));
 if(official)return {match:'official_free_check' as Match,entry:null,known_name:official.name,flags};
 const documented=DOCUMENTED.find(d=>matches(p.host,d.domain));
 if(documented)return {match:'documented_reports' as Match,entry:documented,known_name:null,flags};
 const known=WELL_KNOWN.find(o=>matches(p.host,o.domain));
 if(known)return {match:'well_known_provider' as Match,entry:null,known_name:known.name,flags};
 const look=LOOKALIKE_NAMES.find(n=>p.host.includes(n));
 if(look&&!p.is_ip_literal){flags.push(`The domain contains "${look}" but is not the main domain we know for that name (${[...OFFICIAL,...WELL_KNOWN].filter(o=>o.domain.includes(look)||o.name.toLowerCase().includes(look)).map(o=>o.domain).join(', ')}).`);return {match:'lookalike_of_known_name' as Match,entry:null,known_name:null,flags};}
 if(p.host.endsWith('.vin'))return {match:'documented_tld_pattern' as Match,entry:null,known_name:null,flags};
 return {match:'not_in_documented_list' as Match,entry:null,known_name:null,flags};
}
export function assessmentText(match:Match,host:string,knownName:string|null){
 switch(match){
  case 'documented_reports':return `${host} matches a documented warning pattern: it appears in public, dated seller reports as a site a supposed buyer insisted on for a paid vehicle history report. We make no claim about who operates it or their intent; the reports are listed below so you can judge yourself.`;
  case 'documented_tld_pattern':return `${host} ends in .vin. The 2018 US FTC alert on vehicle history report scams named .vin sites in this pattern (.vin was created for wine businesses). That is not proof about this specific site, but treat a buyer who insists on it with great caution.`;
  case 'lookalike_of_known_name':return `${host} contains a well-known name but is not the main domain we know for it. Some organisations run regional domains, but lookalike domains are also a common way to make a report site look trustworthy. Type the official address yourself instead of following the link.`;
  case 'official_free_check':return `${host} belongs to ${knownName}. This is an official resource, not a warning sign. Still type the address yourself instead of clicking links in messages.`;
  case 'well_known_provider':return `${host} belongs to ${knownName}, a widely known paid report provider. The site itself is not the warning sign, but the pattern can be: if a buyer wants a report, they can buy it themselves with your VIN.`;
  default:return `${host} is not in our documented list. That does not mean it is safe: such sites change names often. The warning sign is the behaviour (a buyer insisting you pay for a report on a site they choose), not one domain. Here is how the official free checks work instead.`;
 }
}
