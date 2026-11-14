# Changelog

## 0.1.0 – 2026-11-14
- First version: tools `decode_vin_facts` and `check_vin_report_link`.
- VIN syntax checks (length, no I/O/Q, check digit, partial VINs with `*`) run locally; decoding uses only the free NHTSA vPIC API (no key, no paid VIN-decoder APIs).
- Link check never opens the user-supplied link; documented domains are listed only with public, dated sources (see `src/links.ts`).
- Streamable-HTTP JSON-RPC worker (CORS, rate limit, body limit, notifications) following the sibling MCPs; Netlify Function adapter for a free preview.
- Vitest tests (logic, worker, Netlify adapter; vPIC always mocked) and a local smoke script (`scripts/smoke.sh`, port 8794).
