#!/usr/bin/env bash
# Local MCP smoke: health, initialize, tools/list, tools/call positive and negative.
# Needs no outbound network: decode_vin_facts is only called with an invalid VIN (rejected before any vPIC request).
# Usage: bash scripts/smoke.sh [base-url]   (default http://127.0.0.1:8794)
set -euo pipefail
base="${1:-http://127.0.0.1:8794}"
call() {
  curl --fail-with-body --silent --show-error --max-time 10 "$base/mcp" -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' --data "$1"
  echo
}
curl --fail --silent --show-error --max-time 10 "$base/health"; echo
call '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"smoke","version":"1"}}}'
call '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
call '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"check_vin_report_link","arguments":{"link":"https://vinner.us/report"}}}'
call '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"check_vin_report_link","arguments":{"link":"nicb.org"}}}'
echo '# negative (expect isError=true):'
call '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"decode_vin_facts","arguments":{"vin":"1HGCM8263OA004352"}}}'
call '{"jsonrpc":"2.0","id":6,"method":"tools/call","params":{"name":"check_vin_report_link","arguments":{"link":"javascript:alert(1)"}}}'
