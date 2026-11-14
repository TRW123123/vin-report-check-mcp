import {afterEach,describe,expect,it,vi} from 'vitest';
import handler,{config} from '../netlify/functions/mcp';
afterEach(()=>vi.restoreAllMocks());
const post=(body:unknown,headers:Record<string,string>={})=>handler(new Request('https://preview.netlify.app/mcp',{method:'POST',headers:{'content-type':'application/json','x-nf-client-connection-ip':'198.51.100.9',...headers},body:JSON.stringify(body)}));
describe('Netlify adapter',()=>{
 it('forwards POST /mcp to the worker',async()=>{const r=await post({jsonrpc:'2.0',id:1,method:'tools/list'});expect(r.status).toBe(200);expect((await r.json()).result.tools).toHaveLength(2);});
 it('forwards tools/call without network for link checks',async()=>{const f=vi.spyOn(globalThis,'fetch');const r=await post({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'check_vin_report_link',arguments:{link:'vinner.us'}}});expect((await r.json()).result.structuredContent.match).toBe('documented_reports');expect(f).not.toHaveBeenCalled();});
 it('maps x-nf-client-connection-ip to the rate limiter (121st request is 429)',async()=>{const ip='198.51.100.77';for(let i=0;i<120;i++)expect((await post({jsonrpc:'2.0',id:1,method:'ping'},{'x-nf-client-connection-ip':ip})).status).toBe(200);expect((await post({jsonrpc:'2.0',id:1,method:'ping'},{'x-nf-client-connection-ip':ip})).status).toBe(429);});
 it('serves /health and / and exposes the expected paths',async()=>{expect((await handler(new Request('https://preview.netlify.app/health'))).status).toBe(200);expect((await handler(new Request('https://preview.netlify.app/'))).status).toBe(200);expect((await handler(new Request('https://preview.netlify.app/mcp',{method:'OPTIONS'}))).status).toBe(204);expect(config.path).toEqual(['/','/mcp','/health']);});
});
