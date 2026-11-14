import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {checkVin,computeCheckDigit,regionOf} from '../src/vin';
import {decodeVinFacts,resetUpstreamState,upstreamLimited} from '../src/vpic';
import {checkVinReportLink} from '../src/logic';
import {parseLink,classify,LinkError,DOCUMENTED} from '../src/links';
import {validate} from '../src/schema';
import {decodeInput,linkInput} from '../src/schema';

// Synthetic fixture shaped like a vPIC "flat" answer. Values are placeholders, not real vehicle data.
const fixture=(over:Record<string,string>={})=>({Count:1,Message:'ok',Results:[{Make:'TESTMAKE',Model:'TESTMODEL',ModelYear:'2006',BodyClass:'SUV',EngineCylinders:'6',FuelTypePrimary:'Gasoline',PlantCountry:'UNITED STATES (USA)',ErrorCode:'0',ErrorText:'0 - VIN decoded clean.',SuggestedVIN:'',Note:'',BodyClassID:'5',...over}]});
const okResponse=(body:unknown)=>new Response(JSON.stringify(body),{status:200,headers:{'content-type':'application/json'}});
const withDigit=(vin:string)=>{const d=computeCheckDigit(vin);return vin.slice(0,8)+d+vin.slice(9);};
const VALID='1HGCM82633A004352';

beforeEach(()=>resetUpstreamState());
afterEach(()=>vi.restoreAllMocks());

describe('VIN validation (no network)',()=>{
 it('accepts a valid 17-character VIN with a matching check digit',()=>{const c=checkVin(VALID);expect(c.partial).toBe(false);expect(c.check_digit.valid).toBe(true);expect(c.wmi).toBe('1HG');expect(c.wmi_region).toBe('North America');});
 it('normalizes case, spaces and dashes',()=>{expect(checkVin(' 1hgcm826-33a 004352 ').normalized_vin).toBe(VALID);});
 it('computes X as check digit when the remainder is 10',()=>{const v=withDigit('1M8GDM9AXKP042788');expect(computeCheckDigit('1M8GDM9AXKP042788')).toBe('X');expect(checkVin(v).check_digit.valid).toBe(true);});
 it('flags a wrong check digit on a North American VIN as mandatory',()=>{const bad=VALID.slice(0,8)+(computeCheckDigit(VALID)==='0'?'1':'0')+VALID.slice(9);const c=checkVin(bad);expect(c.check_digit.valid).toBe(false);expect(c.check_digit.mandatory_for_region).toBe(true);expect(c.notes.join(' ')).toContain('mandatory');});
 it('does not call a mismatch outside North America a red flag',()=>{const v='WVWZZZ1JZ3W386752';const c=checkVin(v);expect(c.wmi_region).toBe('Europe');expect(c.check_digit.mandatory_for_region).toBe(false);if(c.check_digit.valid===false)expect(c.notes.join(' ')).toContain('not a red flag');});
 it.each(['I','O','Q'])('rejects the letter %s',l=>{expect(()=>checkVin('1HGCM8263'+l+'A004352')).toThrow(/I, O or Q/);});
 it('rejects too long, too short, empty and invalid characters',()=>{expect(()=>checkVin(VALID+'1')).toThrow(/exactly 17/);expect(()=>checkVin('1HGCM82633')).toThrow(/Too short/);expect(()=>checkVin('  ')).toThrow(/Supply a VIN/);expect(()=>checkVin('1HGCM8263$A004352')).toThrow(/may only contain/);});
 it('treats 11-16 characters and * as partial without a check digit',()=>{for(const v of ['5UXWX7C5*BA','1HGCM82633A00435','1HGCM826*3A004352']){const c=checkVin(v);expect(c.partial).toBe(true);expect(c.check_digit.applicable).toBe(false);expect(c.check_digit.valid).toBeNull();}});
 it('rejects a VIN starting with *',()=>{expect(()=>checkVin('*HGCM82633A004352')).toThrow(/manufacturer code/);});
 it('maps first characters to regions',()=>{expect(regionOf('1')).toBe('North America');expect(regionOf('J')).toBe('Asia');expect(regionOf('S')).toBe('Europe');expect(regionOf('6')).toBe('Oceania');expect(regionOf('9')).toBe('South America');expect(regionOf('A')).toBe('Africa');});
 it('validates the example VINs from the schema without network',()=>{const f=vi.spyOn(globalThis,'fetch');expect(checkVin('3GNDA13D76S000000').partial).toBe(false);expect(checkVin('5UXWX7C5*BA').partial).toBe(true);expect(f).not.toHaveBeenCalled();});
});

describe('input schemas',()=>{
 it('require vin and reject unknown fields and bad model years',()=>{expect(()=>validate({},decodeInput)).toThrow(/vin is missing/);expect(()=>validate({vin:VALID,x:1},decodeInput)).toThrow(/unknown field/);expect(()=>validate({vin:VALID,model_year:1900},decodeInput)).toThrow(/model_year/);expect(()=>validate({vin:VALID,model_year:2011},decodeInput)).not.toThrow();});
 it('limit the link length',()=>{expect(()=>validate({link:'ab'},linkInput)).toThrow();expect(()=>validate({link:'vinner.us'},linkInput)).not.toThrow();});
});

describe('decodeVinFacts with mocked vPIC',()=>{
 it('decodes a full VIN and calls only the vPIC host',async()=>{const f=vi.spyOn(globalThis,'fetch').mockResolvedValue(okResponse(fixture()));const r=await decodeVinFacts({vin:'3GNDA13D76S000000',model_year:2006});expect(r.decode_status).toBe('decoded');expect(r.facts).toMatchObject({make:'TESTMAKE',model:'TESTMODEL',model_year:'2006',body_class:'SUV'});expect(r.source.cached).toBe(false);const url=String(f.mock.calls[0][0]);expect(url).toContain('https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/3GNDA13D76S000000');expect(url).toContain('modelyear=2006');expect(f).toHaveBeenCalledTimes(1);});
 it('decodes a partial VIN and reports partial status',async()=>{vi.spyOn(globalThis,'fetch').mockResolvedValue(okResponse(fixture({ModelYear:'',ErrorText:'7 - Manufacturer is not registered'})));const r=await decodeVinFacts({vin:'5UXWX7C5*BA'});expect(r.decode_status).toBe('partial');expect(r.vin_check.partial).toBe(true);expect(r.vpic_note).toContain('Partial decode');expect(r.vpic_messages).toEqual(['7 - Manufacturer is not registered']);});
 it('reports empty without guessing',async()=>{vi.spyOn(globalThis,'fetch').mockResolvedValue(okResponse(fixture({Make:'',Model:'',ModelYear:''})));const r=await decodeVinFacts({vin:'WVWZZZ1JZ3W386752'});expect(r.decode_status).toBe('empty');expect(r.facts).toEqual({});expect(r.vpic_note).toContain('outside the US');});
 it('serves repeated decodes from cache, and resetUpstreamState clears it',async()=>{const f=vi.spyOn(globalThis,'fetch').mockImplementation(async()=>okResponse(fixture()));await decodeVinFacts({vin:VALID});expect((await decodeVinFacts({vin:VALID})).source.cached).toBe(true);expect(f).toHaveBeenCalledTimes(1);resetUpstreamState();await decodeVinFacts({vin:VALID});expect(f).toHaveBeenCalledTimes(2);});
 it('does not fetch for invalid VINs',async()=>{const f=vi.spyOn(globalThis,'fetch');await expect(decodeVinFacts({vin:'1HGCM8263OA004352'})).rejects.toThrow(/I, O or Q/);expect(f).not.toHaveBeenCalled();});
 it('turns HTTP errors, network errors, bad JSON and bad shapes into readable errors',async()=>{const f=vi.spyOn(globalThis,'fetch');f.mockResolvedValueOnce(new Response('',{status:503}));await expect(decodeVinFacts({vin:VALID})).rejects.toThrow(/HTTP 503/);f.mockRejectedValueOnce(new TypeError('boom'));await expect(decodeVinFacts({vin:VALID})).rejects.toThrow(/could not be reached/);f.mockResolvedValueOnce(new Response('<html>',{status:200}));await expect(decodeVinFacts({vin:VALID})).rejects.toThrow(/not JSON/);f.mockResolvedValueOnce(okResponse({Results:[]}));await expect(decodeVinFacts({vin:VALID})).rejects.toThrow(/unexpected format/);});
 it('refuses oversized responses',async()=>{vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response('x',{status:200,headers:{'content-length':'999999'}}));await expect(decodeVinFacts({vin:VALID})).rejects.toThrow(/larger than/);});
 it('limits upstream calls per minute',()=>{const t=1_000_000;let n=0;for(let i=0;i<60;i++)if(upstreamLimited(t))n++;expect(n).toBe(0);expect(upstreamLimited(t)).toBe(true);expect(upstreamLimited(t+60001)).toBe(false);});
});

describe('link analysis',()=>{
 const m=(l:string)=>classify(parseLink(l)).match;
 it('matches every documented domain, including subdomains and URLs',()=>{for(const d of ['vinner.us','historyofvehicle.com','vinautoreport.com'])expect(DOCUMENTED.some(x=>x.domain===d)).toBe(true);expect(m('vinner.us')).toBe('documented_reports');expect(m('https://www.historyofvehicle.com/check?vin=X')).toBe('documented_reports');expect(m('HTTP://VinAutoReport.com/')).toBe('documented_reports');});
 it('recognizes official free checks',()=>{for(const l of ['https://www.nicb.org/vincheck','nhtsa.gov/recalls','vehiclehistory.gov','vpic.nhtsa.dot.gov'])expect(m(l)).toBe('official_free_check');});
 it('recognizes well-known providers',()=>{expect(m('https://www.carfax.com/')).toBe('well_known_provider');expect(m('autocheck.com')).toBe('well_known_provider');});
 it('flags lookalikes',()=>{const c=classify(parseLink('carfax-reports-now.com'));expect(c.match).toBe('lookalike_of_known_name');expect(c.flags.join(' ')).toContain('carfax');expect(m('nicb-vincheck.net')).toBe('lookalike_of_known_name');});
 it('flags the .vin TLD pattern',()=>{expect(m('some-report.vin')).toBe('documented_tld_pattern');});
 it('says not_in_documented_list for anything else and never calls it safe',async()=>{const r=await checkVinReportLink({link:'unknown-example-site.net'});expect(r.match).toBe('not_in_documented_list');expect(r.assessment).toContain('does not mean it is safe');});
 it('adds red flags for http, IP literals, credentials and punycode',()=>{expect(classify(parseLink('http://reports-site.com')).flags.join(' ')).toContain('plain http');expect(classify(parseLink('https://8.8.8.8/x')).flags.join(' ')).toContain('raw IP');expect(classify(parseLink('https://carfax.com@evil-site.net/')).flags.join(' ')).toContain('credentials');expect(classify(parseLink('https://xn--e1afmkfd.net')).flags.join(' ')).toContain('punycode');});
 it('refuses other schemes, spaces, private hosts and internal names',()=>{for(const l of ['javascript:alert(1)','ftp://x.com/a','see vinner.us','http://127.0.0.1/','http://10.0.0.5/','http://[::1]/','localhost','intranet','http://foo.internal/','file:///etc/passwd'])expect(()=>parseLink(l),l).toThrow(LinkError);});
 it('NEVER fetches the user-supplied link; vPIC is only used for the optional VIN',async()=>{const f=vi.spyOn(globalThis,'fetch').mockImplementation(async()=>okResponse(fixture()));for(const l of ['vinner.us','https://historyofvehicle.com/x','vinautoreport.com','carfax.com','some.vin','https://evil-lookalike-carfax.com/p'])await checkVinReportLink({link:l});expect(f).not.toHaveBeenCalled();await checkVinReportLink({link:'vinner.us',vin:VALID});const hosts=f.mock.calls.map(c=>new URL(String(c[0])).hostname);expect(hosts).toEqual(['vpic.nhtsa.dot.gov']);});
 it('returns a VIN error inside vin_facts instead of failing the link check',async()=>{const r=await checkVinReportLink({link:'vinner.us',vin:'12345678901O'});expect(r.vin_facts).toMatchObject({error:expect.stringContaining('I, O or Q')});});
 it('includes decoded facts when a VIN is given',async()=>{vi.spyOn(globalThis,'fetch').mockResolvedValue(okResponse(fixture()));const r=await checkVinReportLink({link:'vinner.us',vin:'3GNDA13D76S000000'});expect(r.vin_facts).toMatchObject({decode_status:'decoded'});expect(r.documented_entry?.domain).toBe('vinner.us');expect(r.official_free_checks.map(c=>c.name)).toContain('NICB VINCheck');expect(r.disclaimer).toContain('never opens the link');});
});
