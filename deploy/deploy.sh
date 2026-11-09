#!/usr/bin/env bash
set -euo pipefail
# Direktori runtime memakai grup bersama deploy/PHP-FPM (lihat first-deploy.md).
umask 0002

APP_DIR="${APP_DIR:-/srv/watuagung}"
WEB_ROOT="${WEB_ROOT:-/var/www/watuagung}"
PHP_FPM_SERVICE="${PHP_FPM_SERVICE:-php8.3-fpm}"
PHP_BIN="${PHP_BIN:-php}"

step='validasi awal'
trap 'code=$?; printf "GAGAL [%s], baris %s (exit %s). Deploy berhenti; periksa sebelum mengulang.\n" "$step" "$LINENO" "$code" >&2; exit "$code"' ERR
fail() { printf 'GAGAL [%s]: %s\n' "$step" "$1" >&2; exit 1; }

[[ $# -ge 1 && $# -le 2 ]] || fail 'Pemakaian: bash deploy/deploy.sh <tag|branch-origin> [--skip-frontend]'
ref=$1
skip_frontend=false
if [[ $# -eq 2 ]]; then
    [[ $2 == --skip-frontend ]] || fail 'Opsi tidak dikenal.'
    skip_frontend=true
fi
[[ -n $ref && $ref != -* ]] || fail 'Tag/branch tidak valid.'
for cmd in git composer "$PHP_BIN" realpath systemctl sudo curl; do
    command -v "$cmd" >/dev/null || fail "Perintah tidak tersedia: $cmd"
done
if [[ $skip_frontend == false ]]; then
    for cmd in npm rsync; do
        command -v "$cmd" >/dev/null || fail "Perintah tidak tersedia: $cmd"
    done
fi
APP_DIR=$(realpath -e -- "$APP_DIR")
WEB_ROOT=$(realpath -m -- "$WEB_ROOT")
[[ $WEB_ROOT != / && $WEB_ROOT != "$APP_DIR" && $WEB_ROOT != "$APP_DIR/"* && $APP_DIR != "$WEB_ROOT/"* ]] || fail 'WEB_ROOT harus direktori khusus, terpisah dari repo dan bukan induknya.'
cd "$APP_DIR"
[[ $(git rev-parse --show-toplevel) == "$APP_DIR" ]] || fail 'APP_DIR bukan root repo.'
git diff --quiet && git diff --cached --quiet || fail 'Ada perubahan tracked lokal; jangan ditimpa.'
[[ -f backend/.env ]] || fail 'Siapkan backend/.env dan bootstrap pertama sesuai deploy/first-deploy.md.'

step='fetch dan checkout rilis'
git fetch --prune --prune-tags --tags origin
if git show-ref --verify --quiet "refs/tags/$ref"; then
    commit=$(git rev-parse --verify "refs/tags/$ref^{commit}")
else
    commit=$(git rev-parse --verify "refs/remotes/origin/$ref^{commit}")
fi
git checkout --detach "$commit"

step='composer install'
cd "$APP_DIR/backend"
# Composer memakai PHP dari PATH; samakan dengan PHP_BIN sebelum menjalankan.
composer install --no-dev --optimize-autoloader --no-interaction
step='hapus cache konfigurasi lama'
"$PHP_BIN" artisan config:clear
step='validasi konfigurasi produksi'
app_url=$("$PHP_BIN" -r 'require "vendor/autoload.php"; $app = require "bootstrap/app.php"; $app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap(); $url = config("app.url"); if (config("app.env") !== "production" || config("app.debug") || !config("app.key") || config("database.default") !== "pgsql" || !preg_match("~^https://[a-zA-Z0-9.-]+$~D", $url)) { fwrite(STDERR, "Periksa APP_ENV, APP_DEBUG, APP_KEY, DB_CONNECTION dan APP_URL; bootstrap pertama wajib selesai.\n"); exit(1); } echo $url;')
step='migrate'
"$PHP_BIN" artisan migrate --force
step='storage:link'
if [[ -L public/storage && public/storage -ef storage/app/public ]]; then
    printf 'storage:link sudah benar; dilewati.\n'
else
    [[ ! -e public/storage && ! -L public/storage ]] || fail 'public/storage ada tetapi bukan symlink yang benar; periksa manual.'
    "$PHP_BIN" artisan storage:link
    [[ public/storage -ef storage/app/public ]] || fail 'storage:link tidak menghasilkan target yang benar.'
fi
step='cache Laravel'
"$PHP_BIN" artisan config:cache
"$PHP_BIN" artisan route:cache
"$PHP_BIN" artisan view:cache

step='frontend'
cd "$APP_DIR"
if [[ $skip_frontend == false ]]; then
    [[ -f .env.production ]] || fail 'Siapkan .env.production; jangan gunakan build:demo.'
    npm ci
    NEXT_PUBLIC_API_URL="$app_url/api/v1" NEXT_PUBLIC_DEMO_MODE=false NEXT_PUBLIC_SHOW_SAMPLE_CONTENT=false npm run build
    [[ -f out/index.html && -f out/pelayanan/index.html ]] || fail 'Static export out/ tidak lengkap.'
    mkdir -p -- "$WEB_ROOT"
    rsync -a --delete -- out/ "$WEB_ROOT/"
else
    printf 'Frontend dilewati: unggah hasil build produksi ke WEB_ROOT secara manual.\n'
fi

step='reload PHP-FPM'
sudo -n systemctl reload "$PHP_FPM_SERVICE"
step='smoke test'
cd "$APP_DIR/backend"
domain=$("$PHP_BIN" -r 'require "vendor/autoload.php"; $app = require "bootstrap/app.php"; $app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap(); $url = config("app.url"); if (parse_url($url, PHP_URL_SCHEME) !== "https") { exit(1); } echo parse_url($url, PHP_URL_HOST);')
PHP_BIN="$PHP_BIN" bash "$APP_DIR/deploy/smoke-test.sh" "$domain"
printf 'Deploy selesai: %s\n' "$commit"
