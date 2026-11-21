#!/usr/bin/env bash
set -euo pipefail

PHP_BIN="${PHP_BIN:-php}"
# --admin <host>: panel di subdomain (mode S, deploy/hostinger.md § N).
# --admin-dir <nama>: docroot subdomain bersarang public_html/<nama>, wajib tertutup dari domain utama.
usage() { printf 'Pemakaian: bash deploy/smoke-test.sh <domain> [--admin <host-panel>] [--admin-dir <folder>] (tanpa https:// atau path)\n' >&2; exit 1; }
host_re='^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?$'
[[ $# -ge 1 && $1 =~ $host_re ]] || usage
domain=$1
shift
admin_host='' admin_dir=''
while [[ $# -gt 0 ]]; do
    case $1 in
        --admin) [[ $# -ge 2 && $2 =~ $host_re ]] || usage; admin_host=$2; shift 2 ;;
        --admin-dir) [[ $# -ge 2 && $2 =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]] || usage; admin_dir=$2; shift 2 ;;
        *) usage ;;
    esac
done
set -- "$domain"
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
    # Huruf drive tidak boleh didahului huruf: `http://` di halaman 404 statis bukan path `C:\`.
    "$PHP_BIN" -r '$s = str_replace("\\/", "/", file_get_contents($argv[1])); exit(preg_match("~Stack\\s*trace|(?<![a-z])[A-Z]:[\\\\/]|/(?:var|srv|home|usr|opt|app|mnt|tmp|etc|run|data|www|private|Users)/|(?:vendor|bootstrap|storage)[/\\\\]|\\.(?:php|blade\\.php):[0-9]+~i", $s) ? 1 : 0);' "$tmp/body"
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

# Panel subdomain. probe <url> [argumen curl...]: status di $status, header di $tmp/headers; tidak mengikuti redirect.
probe() {
    local url=$1
    shift
    if ! status=$(curl --silent --show-error --path-as-is --proto '=https' --connect-timeout 10 --max-time 30 \
        --dump-header "$tmp/headers" --output "$tmp/body" --write-out '%{http_code}' "$@" "$url"); then
        status=000
        : > "$tmp/headers"
    fi
}
header_value() {
    # Nilai header terakhir bernama $1 (tanpa CR), kosong bila tidak ada.
    { grep -i "^$1:" "$tmp/headers" || true; } | tail -1 | sed -e 's/^[^:]*:[[:space:]]*//' -e 's/[[:space:]]*$//' | tr -d '\r'
}
header_count() { grep -ic "^$1:" "$tmp/headers" || true; }
expect_redirect() {
    local url=$1 target=$2
    probe "$url"
    check "$url: 302 (aktual $status)" test "$status" = 302
    local location
    location=$(header_value Location)
    check "$url: Location $target (aktual ${location:-kosong})" test "$location" = "$target"
}
expect_blocked() {
    probe "$1"
    check "$1: 403/404 (aktual $status)" test "$status" = 403 -o "$status" = 404
}
csp_enforced_ok() {
    # Hanya Report-Only dari admin.htaccess; header penegak platform Hostinger (upgrade-insecure-requests) dibiarkan.
    # Tanpa process substitution "< <(...)": shell SSH Hostinger tidak punya /dev/fd (deploy 21 November 2026).
    local value lines
    lines=$(grep -i '^Content-Security-Policy:' "$tmp/headers" || true)
    [[ -n $lines ]] || return 0
    while IFS= read -r value; do
        value=$(printf '%s' "$value" | sed -e 's/^[^:]*:[[:space:]]*//' -e 's/[[:space:];]*$//' | tr -d '\r')
        [[ $value == upgrade-insecure-requests ]] || return 1
    done <<< "$lines"
}
if [[ -n $admin_host ]]; then
    panel="https://$admin_host"
    expect_redirect "$base/admin/" "$panel/admin/"
    expect_redirect "$base/admin/permohonan/detail/?id=REQ-TEST" "$panel/admin/permohonan/detail/?id=REQ-TEST"
    probe "$panel/"
    check "$panel/: 302 (aktual $status)" test "$status" = 302
    location=$(header_value Location)
    check "$panel/: Location /admin/ (aktual ${location:-kosong})" test "$location" = /admin/ -o "$location" = "$panel/admin/"
    probe "$panel/admin/"
    check "$panel/admin/: HTTP 200 (aktual $status)" test "$status" = 200
    check "$panel/admin/: Content-Type HTML" grep -Eiq '^Content-Type:[[:space:]]*text/html' "$tmp/headers"
    check "$panel/admin/: X-Robots-Tag noindex" grep -Eiq '^X-Robots-Tag:.*noindex' "$tmp/headers"
    csp_count=$(header_count Content-Security-Policy-Report-Only)
    check "$panel/admin/: tepat satu CSP Report-Only (aktual $csp_count)" test "$csp_count" = 1
    check "$panel/admin/: tanpa CSP penegak ganda" csp_enforced_ok
    check "$panel/admin/: Strict-Transport-Security" grep -Eiq '^Strict-Transport-Security:[[:space:]]*max-age=[1-9][0-9]*' "$tmp/headers"
    check "$panel/admin/: X-Content-Type-Options nosniff" grep -Eiq '^X-Content-Type-Options:[[:space:]]*nosniff[[:space:]]*$' "$tmp/headers"
    probe "$panel/api/v1/posts"
    check "$panel/api/v1/posts: 403 tanpa Laravel (aktual $status)" test "$status" = 403
    expect_redirect "$panel/pelayanan/" "$base/pelayanan/"
    expect_blocked "$panel/laravel.php"
    expect_blocked "$panel/.env"
    probe "$base/api/v1/staff/me" -X OPTIONS -H "Origin: $panel" -H 'Access-Control-Request-Method: GET' \
        -H 'Access-Control-Request-Headers: authorization'
    acao=$(header_value Access-Control-Allow-Origin)
    check "CORS preflight origin panel: 204 (aktual $status)" test "$status" = 204
    check "CORS preflight origin panel: Access-Control-Allow-Origin $panel (aktual ${acao:-kosong})" test "$acao" = "$panel"
    probe "$base/api/v1/staff/me" -X OPTIONS -H 'Origin: https://evil.test' -H 'Access-Control-Request-Method: GET'
    acao=$(header_value Access-Control-Allow-Origin)
    check "CORS preflight origin asing: tanpa Access-Control-Allow-Origin (aktual ${acao:-kosong})" test -z "$acao"
fi
if [[ -n $admin_dir ]]; then
    expect_blocked "$base/$admin_dir/"
    expect_blocked "$base/$admin_dir/admin/"
fi
printf '\nRingkasan: %s lulus, %s gagal.\n' "$passed" "$failed"
[[ $failed -eq 0 ]]
