#!/usr/bin/env bash
set -euo pipefail
# Deploy Hostinger Web Hosting (tanpa root/Nginx/sudo). Dijalankan manusia lewat SSH Hostinger.
# Panduan: deploy/hostinger.md. Frontend dibangun di laptop, diunggah sebagai arsip tar.gz.
#
#   bash deploy/hostinger-deploy.sh <tag|branch-origin> [--frontend <out.tar.gz>]
#
# Tanpa --frontend: hanya backend + memasang ulang .htaccess, laravel.php dan symlink storage.
# Dengan --frontend: public_html diselaraskan penuh (rsync --delete) dengan arsip + tiga berkas itu.
#
# Panel di subdomain (opsional, deploy/hostinger.md § N): ADMIN_PUBLIC_HTML (docroot subdomain) dan
# ADMIN_ORIGIN (https://<sub>.<domain>). Keduanya kosong = perilaku lama (mode L); ADMIN_PUBLIC_HTML saja = mode P
# (lindungi docroot subdomain); keduanya = mode S (panel di subdomain). Logika pemasangan: hostinger-sync.sh.
umask 0022

APP_DIR="${APP_DIR:-}"
PUBLIC_HTML="${PUBLIC_HTML:-}"
PHP_BIN="${PHP_BIN:-php}"
COMPOSER_BIN="${COMPOSER_BIN:-composer}"
ADMIN_PUBLIC_HTML="${ADMIN_PUBLIC_HTML:-}"
ADMIN_ORIGIN="${ADMIN_ORIGIN:-}"
# Dimuat sebelum checkout: fungsi pemasangan tetap versi skrip yang dijalankan operator.
# shellcheck source=deploy/hostinger-sync.sh
source "$(dirname -- "${BASH_SOURCE[0]}")/hostinger-sync.sh"

staging='' managed='' maintenance_started=0 deploy_succeeded=0 lock_acquired=0
cleanup() {
    code=$?
    trap - EXIT
    if [[ $maintenance_started == 1 && $deploy_succeeded == 0 ]]; then
        if ! (cd "$APP_DIR/backend" && "$PHP_BIN" artisan down --retry=60); then
            printf 'BAHAYA: gagal mengaktifkan maintenance. Blokir akses HTTP lewat hPanel sebelum pemulihan.\n' >&2
        fi
        printf 'Deploy belum selesai. Tetap hentikan cron/worker; jangan artisan up sebelum penyebab dan migration diperiksa.\n' >&2
    fi
    rm -rf -- ${staging:+"$staging"} ${managed:+"$managed"}
    if [[ $lock_acquired == 1 ]]; then rmdir -- "$APP_DIR/.hostinger-deploy.lock"; fi
    exit "$code"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP
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
[[ ${DEPLOY_BACKUP_CONFIRMED:-} == 1 && ${DEPLOY_WRITERS_PAUSED:-} == 1 ]] \
    || fail 'Buat dan verifikasi backup + APP_KEY, hentikan cron/worker dan tunggu penulis aktif selesai; isi DEPLOY_BACKUP_CONFIRMED=1 DEPLOY_WRITERS_PAUSED=1.'
mkdir -- "$APP_DIR/.hostinger-deploy.lock" 2>/dev/null || fail 'Deploy lain aktif atau lock tertinggal; periksa sebelum menghapus .hostinger-deploy.lock.'
lock_acquired=1

if [[ -n $archive ]]; then
    step='periksa arsip frontend'
    staging=$(mktemp -d "${TMPDIR:-/tmp}/watuagung-web.XXXXXX")
    tar -xzf "$archive" -C "$staging"
    [[ -f $staging/index.html && -f $staging/pelayanan/index.html && -f $staging/404.html ]] \
        || fail 'Arsip harus berisi ISI out/ (index.html di akar arsip), bukan folder out/.'
    # URL localhost (NEXT_PUBLIC_API_URL dev), bukan nama host saja: validator origin (lib/urls.ts) di bundle
    # memuat "127.0.0.1"/"localhost" sebagai pengecualian http lokal dan tidak boleh menggagalkan deploy.
    if grep -rqE '://(127\.0\.0\.1|localhost|\[::1\])([:/"'\''`]|$)' "$staging/_next" 2>/dev/null; then
        fail 'Build frontend memuat API localhost; bangun ulang dengan konfigurasi produksi.'
    fi
    for name in .htaccess laravel.php storage .env; do
        [[ ! -e $staging/$name ]] || fail "Arsip frontend tidak boleh memuat $name."
    done
fi
step='validasi panel subdomain'
hsync_resolve "$staging"
if [[ $admin_mode == S && -z $archive && ! -f $ADMIN_PUBLIC_HTML/admin/index.html ]]; then
    fail 'Docroot subdomain belum berisi panel; deploy pertama mode S wajib dengan --frontend.'
fi
if [[ $admin_mode == S && -n $archive && ! -f $staging/admin/index.html ]]; then
    fail 'Arsip frontend tidak berisi admin/index.html; panel subdomain akan kosong.'
fi
printf 'Mode panel: %s%s\n' "$admin_mode" "${admin_dir:+ (docroot subdomain bersarang: public_html/$admin_dir)}"

step='fetch dan checkout rilis'
git fetch --prune --prune-tags --tags origin
if git show-ref --verify --quiet "refs/tags/$ref"; then
    commit=$(git rev-parse --verify "refs/tags/$ref^{commit}")
else
    commit=$(git rev-parse --verify "refs/remotes/origin/$ref^{commit}")
fi
step='maintenance sebelum pergantian kode'
"$PHP_BIN" "$APP_DIR/backend/artisan" down --retry=60
maintenance_started=1
printf 'Maintenance aktif. Tunggu request HTTP lama selesai sebelum melanjutkan (bawaan 120 detik).\n'
drain_seconds=${DEPLOY_DRAIN_SECONDS:-120}
[[ $drain_seconds =~ ^[0-9]+$ && ${#drain_seconds} -le 5 ]] || fail 'DEPLOY_DRAIN_SECONDS harus bilangan detik 0..99999.'
sleep "$drain_seconds"
step='checkout rilis'
git checkout --detach "$commit"

step='composer install'
cd "$APP_DIR/backend"
"$COMPOSER_BIN" install --no-dev --optimize-autoloader --no-interaction
step='hapus cache konfigurasi lama'
"$PHP_BIN" artisan config:clear
step='validasi konfigurasi produksi'
app_url=$(ADMIN_ORIGIN="$ADMIN_ORIGIN" "$PHP_BIN" -r 'require "vendor/autoload.php"; $app = require "bootstrap/app.php"; $app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap(); $url = config("app.url"); if (config("app.env") !== "production" || config("app.debug") || !config("app.key") || !in_array(config("database.default"), ["mysql", "mariadb"], true) || !preg_match("~^https://[a-zA-Z0-9.-]+$~D", $url)) { fwrite(STDERR, "Periksa APP_ENV, APP_DEBUG, APP_KEY, DB_CONNECTION (mysql/mariadb) dan APP_URL; bootstrap pertama wajib selesai.\n"); exit(1); } $admin = (string) getenv("ADMIN_ORIGIN"); if ($admin !== "" && !in_array($admin, config("cors.allowed_origins"), true)) { fwrite(STDERR, "ADMIN_ORIGIN belum ada di FRONTEND_ORIGINS backend/.env; panel tidak bisa memanggil API.\n"); exit(1); } echo $url;')
hsync_check_origin "$app_url"
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
hsync_render_main "$APP_DIR/deploy/hostinger/.htaccess" "$managed/.htaccess"
if [[ $admin_mode == S ]]; then
    hsync_render_admin "$APP_DIR/deploy/hostinger/admin.htaccess" "$managed/admin.htaccess" "$app_url"
    chmod 644 "$managed/admin.htaccess"
fi
sed "s|__LARAVEL_PUBLIC__|$laravel_public|" "$APP_DIR/deploy/hostinger/laravel.php" > "$managed/laravel.php"
grep -q '__LARAVEL_PUBLIC__' "$managed/laravel.php" && fail 'Placeholder laravel.php tidak terganti.'
chmod 644 "$managed/.htaccess" "$managed/laravel.php"
hsync_install "$staging" "$managed" "$media"
[[ -n $archive ]] || printf 'Frontend tidak diubah: pastikan isi public_html sesuai commit ini.\n'
[[ -f $PUBLIC_HTML/index.html ]] || fail 'public_html belum berisi frontend; jalankan dengan --frontend.'

step='buka layanan untuk smoke test'
"$PHP_BIN" artisan up
step='smoke test'
domain=${app_url#https://}
smoke_args=()
if [[ $admin_mode == S ]]; then smoke_args+=(--admin "${ADMIN_ORIGIN#https://}"); fi
if [[ -n $admin_dir ]]; then smoke_args+=(--admin-dir "$admin_dir"); fi
PHP_BIN="$PHP_BIN" bash "$APP_DIR/deploy/smoke-test.sh" "$domain" "${smoke_args[@]}"
deploy_succeeded=1
printf 'Deploy selesai: %s. Aktifkan kembali cron/worker setelah pemeriksaan pascadeploy.\n' "$commit"
