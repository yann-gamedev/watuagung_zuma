#!/usr/bin/env bash
set -euo pipefail
# Deploy Hostinger Web Hosting (tanpa root/Nginx/sudo). Dijalankan manusia lewat SSH Hostinger.
# Panduan: deploy/hostinger.md. Frontend dibangun di laptop, diunggah sebagai arsip tar.gz.
#
#   bash deploy/hostinger-deploy.sh <tag|branch-origin> [--frontend <out.tar.gz>]
#
# Tanpa --frontend: hanya backend + memasang ulang .htaccess, laravel.php dan symlink storage.
# Dengan --frontend: public_html diselaraskan penuh (rsync --delete) dengan arsip + tiga berkas itu.
umask 0022

APP_DIR="${APP_DIR:-}"
PUBLIC_HTML="${PUBLIC_HTML:-}"
PHP_BIN="${PHP_BIN:-php}"
COMPOSER_BIN="${COMPOSER_BIN:-composer}"

staging='' managed=''
trap 'rm -rf -- ${staging:+"$staging"} ${managed:+"$managed"}' EXIT
step='validasi awal'
trap 'code=$?; printf "GAGAL [%s], baris %s (exit %s). Deploy berhenti; periksa sebelum mengulang.\n" "$step" "$LINENO" "$code" >&2; exit "$code"' ERR
fail() { printf 'GAGAL [%s]: %s\n' "$step" "$1" >&2; exit 1; }

usage='Pemakaian: bash deploy/hostinger-deploy.sh <tag|branch-origin> [--frontend <out.tar.gz>]'
[[ $# -eq 1 || $# -eq 3 ]] || fail "$usage"
ref=$1
archive=''
if [[ $# -eq 3 ]]; then
    [[ $2 == --frontend ]] || fail "$usage"
    archive=$3
    [[ -f $archive ]] || fail "Arsip frontend tidak ditemukan: $archive"
fi
[[ -n $ref && $ref != -* ]] || fail 'Tag/branch tidak valid.'
[[ -n $APP_DIR && -n $PUBLIC_HTML ]] || fail 'Isi APP_DIR (repo, di luar public_html) dan PUBLIC_HTML.'
for cmd in git "$COMPOSER_BIN" "$PHP_BIN" realpath curl tar rsync; do
    command -v "$cmd" >/dev/null || fail "Perintah tidak tersedia: $cmd"
done
APP_DIR=$(realpath -e -- "$APP_DIR")
PUBLIC_HTML=$(realpath -e -- "$PUBLIC_HTML")
[[ $(basename -- "$PUBLIC_HTML") == public_html ]] || fail 'PUBLIC_HTML harus folder public_html domain.'
[[ $APP_DIR != "$PUBLIC_HTML" && $APP_DIR != "$PUBLIC_HTML/"* && $PUBLIC_HTML != "$APP_DIR/"* ]] \
    || fail 'Repo harus di luar public_html (dan sebaliknya).'
cd "$APP_DIR"
[[ $(git rev-parse --show-toplevel) == "$APP_DIR" ]] || fail 'APP_DIR bukan root repo.'
git diff --quiet && git diff --cached --quiet || fail 'Ada perubahan tracked lokal; jangan ditimpa.'
[[ -f backend/.env ]] || fail 'Siapkan backend/.env dan bootstrap pertama sesuai deploy/hostinger.md.'

if [[ -n $archive ]]; then
    step='periksa arsip frontend'
    staging=$(mktemp -d "${TMPDIR:-/tmp}/watuagung-web.XXXXXX")
    tar -xzf "$archive" -C "$staging"
    [[ -f $staging/index.html && -f $staging/pelayanan/index.html && -f $staging/404.html ]] \
        || fail 'Arsip harus berisi ISI out/ (index.html di akar arsip), bukan folder out/.'
    if grep -rqE '127\.0\.0\.1|localhost:8000' "$staging/_next" 2>/dev/null; then
        fail 'Build frontend memuat API localhost; bangun ulang dengan konfigurasi produksi.'
    fi
    for name in .htaccess laravel.php storage .env; do
        [[ ! -e $staging/$name ]] || fail "Arsip frontend tidak boleh memuat $name."
    done
fi

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
"$COMPOSER_BIN" install --no-dev --optimize-autoloader --no-interaction
step='hapus cache konfigurasi lama'
"$PHP_BIN" artisan config:clear
step='validasi konfigurasi produksi'
app_url=$("$PHP_BIN" -r 'require "vendor/autoload.php"; $app = require "bootstrap/app.php"; $app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap(); $url = config("app.url"); if (config("app.env") !== "production" || config("app.debug") || !config("app.key") || !in_array(config("database.default"), ["mysql", "mariadb"], true) || !preg_match("~^https://[a-zA-Z0-9.-]+$~D", $url)) { fwrite(STDERR, "Periksa APP_ENV, APP_DEBUG, APP_KEY, DB_CONNECTION (mysql/mariadb) dan APP_URL; bootstrap pertama wajib selesai.\n"); exit(1); } echo $url;')
step='migrate'
"$PHP_BIN" artisan migrate --force
step='cache Laravel'
"$PHP_BIN" artisan config:cache
"$PHP_BIN" artisan route:cache
"$PHP_BIN" artisan view:cache

step='berkas public_html'
laravel_public="$APP_DIR/backend/public"
media="$APP_DIR/backend/storage/app/public"
[[ -d $media ]] || fail 'backend/storage/app/public tidak ada.'
[[ $laravel_public != *"'"* ]] || fail 'Path APP_DIR tidak boleh memuat tanda kutip.'
managed=$(mktemp -d "${TMPDIR:-/tmp}/watuagung-managed.XXXXXX")
cp -- "$APP_DIR/deploy/hostinger/.htaccess" "$managed/.htaccess"
sed "s|__LARAVEL_PUBLIC__|$laravel_public|" "$APP_DIR/deploy/hostinger/laravel.php" > "$managed/laravel.php"
grep -q '__LARAVEL_PUBLIC__' "$managed/laravel.php" && fail 'Placeholder laravel.php tidak terganti.'
chmod 644 "$managed/.htaccess" "$managed/laravel.php"
if [[ -n $archive ]]; then
    cp -a -- "$managed/.htaccess" "$managed/laravel.php" "$staging/"
    ln -s -- "$media" "$staging/storage"
    # .well-known dipakai validasi SSL hPanel; jangan dihapus.
    rsync -a --delete --exclude=/.well-known/ -- "$staging/" "$PUBLIC_HTML/"
else
    cp -- "$managed/.htaccess" "$managed/laravel.php" "$PUBLIC_HTML/"
    if [[ -L $PUBLIC_HTML/storage ]]; then
        [[ $PUBLIC_HTML/storage -ef $media ]] || fail 'public_html/storage menunjuk target lain; periksa manual.'
    else
        [[ ! -e $PUBLIC_HTML/storage ]] || fail 'public_html/storage ada tetapi bukan symlink; periksa manual.'
        ln -s -- "$media" "$PUBLIC_HTML/storage"
    fi
    printf 'Frontend tidak diubah: pastikan isi public_html sesuai commit ini.\n'
fi
[[ -f $PUBLIC_HTML/index.html ]] || fail 'public_html belum berisi frontend; jalankan dengan --frontend.'

step='smoke test'
domain=${app_url#https://}
PHP_BIN="$PHP_BIN" bash "$APP_DIR/deploy/smoke-test.sh" "$domain"
printf 'Deploy selesai: %s\n' "$commit"
