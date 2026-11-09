#!/usr/bin/env bash
set -euo pipefail

PHP_BIN="${PHP_BIN:-php}"
[[ $# -eq 1 && $1 =~ ^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?$ ]] || { printf 'Pemakaian: bash deploy/smoke-test.sh <domain> (tanpa https:// atau path)\n' >&2; exit 1; }
for cmd in curl "$PHP_BIN" mktemp; do
    command -v "$cmd" >/dev/null || { printf 'Perintah tidak tersedia: %s\n' "$cmd" >&2; exit 1; }
done
base="https://$1"
tmp=$(mktemp -d)
trap 'rm -rf -- "$tmp"' EXIT
passed=0
failed=0
check() {
    local label=$1
    shift
    if "$@"; then
        printf 'LULUS %s\n' "$label"
        passed=$((passed + 1))
    else
        printf 'GAGAL %s\n' "$label" >&2
        failed=$((failed + 1))
    fi
}
json_valid() {
    "$PHP_BIN" -r 'json_decode(file_get_contents($argv[1])); exit(json_last_error() === JSON_ERROR_NONE ? 0 : 1);' "$tmp/body"
}
no_leak() {
    # Normalisasi slash JSON sebelum mencari path Unix/Windows dan stack trace.
    "$PHP_BIN" -r '$s = str_replace("\\/", "/", file_get_contents($argv[1])); exit(preg_match("~Stack\\s*trace|[A-Z]:[\\\\/]|/(?:var|srv|home|usr|opt|app|mnt|tmp|etc|run|data|www|private|Users)/|(?:vendor|bootstrap|storage)[/\\\\]|\\.(?:php|blade\\.php):[0-9]+~i", $s) ? 1 : 0);' "$tmp/body"
}
request() {
    local path=$1 expected=$2 json=$3
    shift 3
    local status
    if ! status=$(curl --silent --show-error --path-as-is --proto '=https' --connect-timeout 10 --max-time 30 \
        --dump-header "$tmp/headers" --output "$tmp/body" --write-out '%{http_code}' \
        -H 'Accept: application/json' "$@" "$base$path"); then
        check "$path: koneksi HTTPS" false
        return 0
    fi
    if [[ $expected == not200 ]]; then
        check "$path: bukan 200 (aktual $status)" test "$status" != 200
    else
        check "$path: HTTP $expected (aktual $status)" test "$status" = "$expected"
    fi
    if [[ $json == true ]]; then
        check "$path: Content-Type JSON" grep -Eiq '^Content-Type:[[:space:]]*application/json([;[:space:]]|$)' "$tmp/headers"
        check "$path: JSON valid" json_valid
    fi
    check "$path: Strict-Transport-Security" grep -Eiq '^Strict-Transport-Security:[[:space:]]*max-age=[1-9][0-9]*' "$tmp/headers"
    check "$path: X-Content-Type-Options nosniff" grep -Eiq '^X-Content-Type-Options:[[:space:]]*nosniff[[:space:]]*$' "$tmp/headers"
    if [[ $path == /api/* && $status -ge 400 ]]; then
        check "$path: tanpa stack trace/path server" no_leak
    fi
}

request / 200 false
request /pelayanan/ 200 false
request /api/v1/posts 200 true
request /api/v1/verify/xxx 404 true
request /api/v1/staff/login 422 true -H 'Content-Type: application/json' --data '{}'
request /.env not200 false
request /backend/.env not200 false
request /api/../.env not200 false
printf '\nRingkasan: %s lulus, %s gagal.\n' "$passed" "$failed"
[[ $failed -eq 0 ]]
