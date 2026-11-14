# VIN Report Check (MCP server)

Remote MCP server for private car sellers in the US market. It decodes the basic, verifiable facts behind a VIN and explains the "fake buyer" pattern, where a supposed buyer insists the seller pays for a vehicle history report on a site the buyer names.

**Independent.** Not affiliated with NHTSA, NICB, Carfax, AutoCheck or any marketplace. Not a vehicle history report, not a recall check, no verdicts about people or companies, not legal advice.

- Registry name (prepared): `com.aicarvideo/vin-report-check`
- Website: https://aicarvideo.com
- Developer: AI Car Video (operated by Safak Tepecik)
- GitHub: https://github.com/TRW123123/vin-report-check-mcp
- License: MIT
- Transport: Streamable HTTP, JSON-RPC 2.0 on `POST /mcp`; `GET /health`; protocol versions 2025-03-26, 2025-06-18, 2025-11-25

## What it does

| Tool | Purpose |
|---|---|
| `decode_vin_facts` | Input `vin` (17 characters; partial VINs of 11-16 characters or with `*` are decoded partially), optional `model_year`. Validates length, characters (no I/O/Q) and the check digit locally, then decodes via the free NHTSA vPIC API. Returns decoded facts only, vPIC messages, a list of things to verify yourself, and links to the free NHTSA recall lookup and NICB VINCheck. |
| `check_vin_report_link` | Input `link` (URL or bare domain), optional `vin`. Returns whether the domain matches a documented warning pattern (with public, dated sources), is an official resource, a well-known provider, a lookalike, a `.vin` domain, or is not in the documented list; plus link red flags, what to do, and the official free checks. With a `vin` it also decodes basic facts via vPIC. |

## Principles

- **Free NHTSA vPIC only.** No API keys, no paid VIN-decoder APIs. vPIC is US-focused; vehicles built for other markets often decode partially or not at all, and nothing is guessed.
- **Never opens buyer links.** The link is parsed as text only; no request, no DNS lookup. Non-http(s) schemes and private/internal hosts are refused.
- **Stores nothing.** No IPs, VINs or links are persisted. Only operational metrics (tool, success, duration) are logged. A short in-memory cache and rate limiters per isolate protect the free NHTSA API.
- **Cautious wording.** A domain on the documented list means "reported in this pattern", not a legal finding. Not being on the list means nothing about safety. Corrections: open an issue on GitHub.

## Status

Version 0.1.0. 59 Vitest tests green (vPIC mocked). Secret-scan clean.

- **Public preview (free Netlify Function, same code):** `https://vin-report-check-mcp.netlify.app/mcp` — checked on 14.11.2026 (Europe/Berlin) with curl (health 200, initialize, tools/list, tools/call positive and negative, GET /mcp 405, OPTIONS 204). Adapter: `netlify/functions/mcp.ts`. Manual deploy, not linked to GitHub.
- **Production: still open.** The URL `https://vin-mcp.aicarvideo.com/mcp` in `server.json` is the planned address. It needs Safak's OK and a Cloudflare login. Not deployed, no DNS change, no registry submission yet.

## Run and test locally

```bash
npm ci
npm run typecheck
npm test               # vPIC is always mocked, no network needed
npm run secret-scan
npm run dev            # wrangler dev on http://127.0.0.1:8794, no Cloudflare login
bash scripts/smoke.sh  # second terminal; optional base URL as $1
```

## Production (open)

Needs a valid Cloudflare login and Safak's OK for the subdomain. Then `npx wrangler deploy`, set the custom domain, run `scripts/smoke.sh https://…`, then the registry entry.
