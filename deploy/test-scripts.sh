#!/usr/bin/env bash
set -euo pipefail

# Pemeriksaan lokal dengan stub, tidak menyentuh server/database.
root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
PHP_BIN="${PHP_BIN:-php}"
php_path=$(command -v "$PHP_BIN")
tmp=$(mktemp -d)
trap 'rm -rf -- "$tmp"' EXIT
mkdir -p "$tmp/bin" "$tmp/repo/backend"
touch "$tmp/repo/backend/.env"
cat > "$tmp/bin/curl" <<'STUB'
#!/usr/bin/env bash
set -euo pipefail
headers='' body='' url='' method=GET origin=''
for ((i=1; i<=$#; i++)); do
    arg=${!i}
    case $arg in
        --dump-header) i=$((i + 1)); headers=${!i} ;;
        --output) i=$((i + 1)); body=${!i} ;;
        -X) i=$((i + 1)); method=${!i} ;;
        -H) i=$((i + 1)); [[ ${!i} != Origin:* ]] || origin=${!i#Origin: } ;;
        https://*) url=$arg ;;
    esac
done
[[ " $* " == *' --path-as-is '* ]] || exit 2
[[ ${FAULT:-} != network ]] || exit 7
status=200
payload='{}'
case $url in
    */api/v1/verify/xxx) status=404 ;;
    */api/v1/staff/login) status=422 ;;
    */.env) status=403 ;;
esac
if [[ $url == */api/v1/verify/xxx ]]; then
    case ${FAULT:-} in
        json) payload='<html>error</html>' ;;
        trace) payload='{"message":"Stack trace"}' ;;
        unix) payload='{"file":"\/srv\/watuagung\/backend\/public\/index.php"}' ;;
        windows) payload='{"file":"C:\\inetpub\\app\\index.php"}' ;;
    esac
fi
[[ ${FAULT:-} != exposed-env || $url != */.env ]] || status=200
# Panel subdomain (smoke-test.sh --admin): domain desa.example.test, panel panel.desa.example.test, folder "panel".
D=https://desa.example.test P=https://panel.desa.example.test
extra=() ctype=application/json
case $url in
    "$D/admin/") status=302; extra+=("Location: $P/admin/") ;;
    "$D/admin/permohonan/detail/?id=REQ-TEST")
        status=302
        if [[ ${FAULT:-} == query ]]; then extra+=("Location: $P/admin/permohonan/detail/"); else extra+=("Location: $P/admin/permohonan/detail/?id=REQ-TEST"); fi ;;
    "$P/") status=302; extra+=("Location: $P/admin/") ;;
    "$P/admin/")
        ctype=text/html
        extra+=("Content-Security-Policy: upgrade-insecure-requests")
        [[ ${FAULT:-} == robots ]] || extra+=('X-Robots-Tag: noindex, nofollow')
        extra+=("Content-Security-Policy-Report-Only: default-src 'self'; connect-src 'self' $D")
        [[ ${FAULT:-} != csp-double ]] || extra+=("Content-Security-Policy-Report-Only: default-src 'self'")
        [[ ${FAULT:-} != csp-enforced ]] || extra+=("Content-Security-Policy: default-src 'self'") ;;
    "$P/api/v1/posts") [[ ${FAULT:-} == panel-api ]] || status=403 ;;
    "$P/pelayanan/") status=302; extra+=("Location: $D/pelayanan/") ;;
    "$P/laravel.php"|"$P/.env") [[ ${FAULT:-} == panel-php ]] || status=404 ;;
    "$D/panel/"|"$D/panel/admin/") [[ ${FAULT:-} == nested-open ]] || status=403 ;;
    "$D/api/v1/staff/me")
        [[ $method == OPTIONS ]] || exit 3
        status=204
        if [[ $origin == "$P" && ${FAULT:-} != cors ]]; then extra+=("Access-Control-Allow-Origin: $P"); fi
        if [[ $origin == https://evil.test && ${FAULT:-} == cors-evil ]]; then extra+=('Access-Control-Allow-Origin: https://evil.test'); fi ;;
esac
printf 'HTTP/1.1 %s\r\nContent-Type: %s\r\n' "$status" "$ctype" > "$headers"
[[ ${FAULT:-} != type ]] || printf 'Content-Type: text/html\r\n' > "$headers"
for h in "${extra[@]}"; do printf '%s\r\n' "$h" >> "$headers"; done
[[ ${FAULT:-} == hsts ]] || printf 'Strict-Transport-Security: max-age=31536000\r\n' >> "$headers"
[[ ${FAULT:-} == nosniff ]] || printf 'X-Content-Type-Options: nosniff\r\n' >> "$headers"
printf '\r\n' >> "$headers"
printf '%s' "$payload" > "$body"
printf '%s' "$status"
STUB
chmod +x "$tmp/bin/curl"
PATH="$tmp/bin:$PATH" PHP_BIN="$php_path" bash "$root/deploy/smoke-test.sh" desa.example.test > "$tmp/log" 2>&1 || { cat "$tmp/log"; exit 1; }
for fault in network json trace unix windows exposed-env type hsts nosniff; do
    if PATH="$tmp/bin:$PATH" PHP_BIN="$php_path" FAULT="$fault" bash "$root/deploy/smoke-test.sh" desa.example.test > "$tmp/log" 2>&1; then
        printf 'GAGAL smoke test menerima fault: %s\n' "$fault" >&2
        exit 1
    fi
done
if PHP_BIN="$php_path" bash "$root/deploy/smoke-test.sh" 'https://bad/path' > "$tmp/log" 2>&1; then
    printf 'GAGAL domain tidak valid diterima\n' >&2
    exit 1
fi
# Skrip yang berjalan di server Hostinger tidak boleh memakai process substitution: shell SSH-nya tanpa /dev/fd.
for script in smoke-test.sh hostinger-deploy.sh hostinger-sync.sh backup.sh; do
    if grep -nE '<[[:space:]]*<\(|>\(' "$root/deploy/$script" | grep -v '^[0-9]*:[[:space:]]*#'; then
        printf 'GAGAL %s memakai process substitution (butuh /dev/fd)\n' "$script" >&2; exit 1
    fi
done
# --admin/--admin-dir (mode S): lulus dengan header benar, gagal untuk tiap fault panel/CORS.
smoke_admin() { PATH="$tmp/bin:$PATH" PHP_BIN="$php_path" "$@" bash "$root/deploy/smoke-test.sh" desa.example.test --admin panel.desa.example.test --admin-dir panel > "$tmp/log" 2>&1; }
smoke_admin env || { cat "$tmp/log"; exit 1; }
grep -q 'tepat satu CSP Report-Only' "$tmp/log" && grep -q 'CORS preflight origin asing' "$tmp/log" && grep -q '/panel/admin/: 403/404' "$tmp/log"
for fault in query robots csp-double csp-enforced panel-api panel-php nested-open cors cors-evil; do
    if smoke_admin env FAULT="$fault"; then printf 'GAGAL smoke --admin menerima fault: %s\n' "$fault" >&2; exit 1; fi
done
for args in '--admin' '--admin https://panel.x' '--admin-dir a/b' '--lain x'; do
    # shellcheck disable=SC2086
    if PHP_BIN="$php_path" bash "$root/deploy/smoke-test.sh" desa.example.test $args > "$tmp/log" 2>&1; then
        printf 'GAGAL smoke menerima argumen salah: %s\n' "$args" >&2; exit 1
    fi
done

# Fetch gagal harus menghentikan deploy sebelum Composer/migration/reload.
cat > "$tmp/bin/git" <<'STUB'
#!/usr/bin/env bash
set -euo pipefail
case $1 in
    rev-parse) pwd ;;
    diff) exit 0 ;;
    fetch) exit 42 ;;
    *) printf 'git tidak diharapkan\n' >&2; exit 1 ;;
esac
STUB
for cmd in composer systemctl sudo; do
    printf '#!/usr/bin/env bash\nprintf "UNEXPECTED COMMAND\\n" >&2\nexit 99\n' > "$tmp/bin/$cmd"
done
chmod +x "$tmp/bin/"*
if PATH="$tmp/bin:$PATH" APP_DIR="$tmp/repo" WEB_ROOT="$tmp/web" PHP_BIN="$php_path" \
    bash "$root/deploy/deploy.sh" release --skip-frontend > "$tmp/log" 2>&1; then
    printf 'GAGAL deploy mengabaikan fetch gagal\n' >&2
    exit 1
else
    code=$?
    [[ $code -eq 42 ]] || { cat "$tmp/log"; exit 1; }
fi
grep -q 'GAGAL \[fetch dan checkout rilis\]' "$tmp/log"
if grep -q 'UNEXPECTED COMMAND' "$tmp/log"; then
    cat "$tmp/log"
    exit 1
fi

# backup.sh: gpg/tar asli, pg_dump dan flock stub. Isi terenkripsi, bisa dibuka, rotasi, tanpa .env.
mkdir -p "$tmp/app/backend/storage/app/private/letters" "$tmp/app/backend/storage/app/public/posts"
printf 'pdf-fiktif' > "$tmp/app/backend/storage/app/private/letters/1-generated.pdf"
printf 'foto' > "$tmp/app/backend/storage/app/public/posts/a.webp"
printf 'APP_KEY=base64:rahasia\n' > "$tmp/app/backend/.env"
printf '#!/usr/bin/env bash\nwhile [[ $1 != -f ]]; do shift; done; printf "dump-fiktif" > "$2"\n' > "$tmp/bin/pg_dump"
printf '#!/usr/bin/env bash\nexit 0\n' > "$tmp/bin/flock"
# Stub stat: mode file Windows/Git Bash tidak bisa 600; uji logika pemeriksaan mode saja.
printf '#!/usr/bin/env bash\nprintf "%%s\\n" "${STUB_MODE:-600}"\n' > "$tmp/bin/stat"
chmod +x "$tmp/bin/pg_dump" "$tmp/bin/flock" "$tmp/bin/stat"
printf 'passphrase-uji\n' > "$tmp/pass"
run_backup() { PATH="$tmp/bin:$PATH" APP_DIR="$tmp/app" BACKUP_DIR="$tmp/bk" PASSPHRASE_FILE="$tmp/pass" "$@" bash "$root/deploy/backup.sh" > "$tmp/log" 2>&1; }
run_backup env || { cat "$tmp/log"; exit 1; }
file=$(ls "$tmp/bk/daily"/watuagung-*.tar.gpg)
if tar -tf "$file" > /dev/null 2>&1; then printf 'GAGAL backup tidak terenkripsi\n' >&2; exit 1; fi
mkdir "$tmp/out"
gpg --batch --quiet --pinentry-mode loopback --passphrase-file "$tmp/pass" --decrypt "$file" | tar -C "$tmp/out" -xf -
[[ $(cat "$tmp/out/db.dump") == dump-fiktif ]]
tar -tf "$tmp/out/storage.tar" | grep -qx 'app/private/letters/1-generated.pdf'
tar -tf "$tmp/out/storage.tar" | grep -qx 'app/public/posts/a.webp'
if grep -rq 'rahasia' "$tmp/out"; then printf 'GAGAL backup memuat .env\n' >&2; exit 1; fi
for i in 01 02 03 04 05 06 07 08 09 10 11 12 13 14 15; do : > "$tmp/bk/daily/watuagung-200001$i-000000.tar.gpg"; done
for i in 01 02 03 04 05 06 07 08 09; do : > "$tmp/bk/weekly/watuagung-200001$i-000000.tar.gpg"; done
run_backup env || { cat "$tmp/log"; exit 1; }
[[ $(ls "$tmp/bk/daily" | wc -l) -eq 14 && $(ls "$tmp/bk/weekly" | wc -l) -eq 8 ]] || { printf 'GAGAL rotasi 14/8\n' >&2; exit 1; }
ls "$tmp/bk/daily" | grep -qv '^watuagung-2000' || { printf 'GAGAL rotasi menghapus backup terbaru\n' >&2; exit 1; }
if run_backup env STUB_MODE=644; then printf 'GAGAL backup menerima passphrase mode 644\n' >&2; exit 1; fi
printf '#!/usr/bin/env bash\nexit 3\n' > "$tmp/bin/pg_dump"
if run_backup env; then printf 'GAGAL backup mengabaikan pg_dump gagal\n' >&2; exit 1; fi

# backup.sh Hostinger: mysqldump stub, gpg dan openssl asli.
printf '#!/usr/bin/env bash\nfor a; do [[ $a == --result-file=* ]] && printf "%%s" "-- dump-mysql-fiktif" > "${a#--result-file=}"; done\n[[ " $* " == *" --single-transaction "* && " $* " == *" --no-tablespaces "* ]]\n' > "$tmp/bin/mysqldump"
chmod +x "$tmp/bin/mysqldump"
# OpenSSL mingw (Git Bash Windows) tidak menerjemahkan path MSYS di argumen file:.
pass_native=$(cygpath -m "$tmp/pass" 2>/dev/null || printf '%s' "$tmp/pass")
for enc in gpg openssl; do
    rm -rf "$tmp/bk" "$tmp/out"
    run_backup env DB_DRIVER=mysql ENCRYPTOR="$enc" PASSPHRASE_FILE="$pass_native" || { cat "$tmp/log"; exit 1; }
    ext=gpg; [[ $enc == openssl ]] && ext=enc
    file=$(ls "$tmp/bk/daily"/watuagung-*.tar."$ext")
    if tar -tf "$file" > /dev/null 2>&1; then printf 'GAGAL backup %s tidak terenkripsi\n' "$enc" >&2; exit 1; fi
    mkdir "$tmp/out"
    if [[ $enc == gpg ]]; then
        gpg --batch --quiet --pinentry-mode loopback --passphrase-file "$tmp/pass" --decrypt "$file"
    else
        openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -pass "file:$pass_native" -in "$file"
    fi | tar -C "$tmp/out" -xf -
    [[ $(cat "$tmp/out/db.sql") == '-- dump-mysql-fiktif' ]] || { printf 'GAGAL isi dump mysql (%s)\n' "$enc" >&2; exit 1; }
    tar -tf "$tmp/out/storage.tar" | grep -qx 'app/private/letters/1-generated.pdf'
    if grep -rq 'rahasia' "$tmp/out"; then printf 'GAGAL backup memuat .env\n' >&2; exit 1; fi
done
if run_backup env DB_DRIVER=oracle; then printf 'GAGAL DB_DRIVER tidak dikenal diterima\n' >&2; exit 1; fi
printf '#!/usr/bin/env bash\nexit 2\n' > "$tmp/bin/mysqldump"
if run_backup env DB_DRIVER=mysql; then printf 'GAGAL backup mengabaikan mysqldump gagal\n' >&2; exit 1; fi
printf '#!/usr/bin/env bash\nexit 0\n' > "$tmp/bin/mysqldump"
if run_backup env DB_DRIVER=mysql; then printf 'GAGAL backup menerima dump kosong\n' >&2; exit 1; fi

# hostinger-sync.sh: pemasangan public_html dan panel subdomain, mode L/P/S, docroot bersarang dan sejajar.
# rsync asli bila tersedia; selain itu (mis. Git Bash Windows) emulator -a/--delete/--exclude=/<nama>/ di bawah.
mkdir -p "$tmp/sync-bin"
if command -v rsync >/dev/null; then
    rsync_kind=asli
else
    rsync_kind=emulator
    cat > "$tmp/sync-bin/rsync" <<'STUB'
#!/usr/bin/env bash
# Emulator terbatas: hanya exclude berjangkar tingkat atas "/<nama>/", seperti yang dipakai hostinger-sync.sh.
set -euo pipefail
delete=0 excludes=() paths=()
for a; do
    case $a in
        -a|--) ;;
        --delete) delete=1 ;;
        --exclude=*) excludes+=("${a#--exclude=}") ;;
        -*) printf 'opsi rsync tidak didukung emulator: %s\n' "$a" >&2; exit 2 ;;
        *) paths+=("$a") ;;
    esac
done
src=${paths[0]%/} dst=${paths[1]%/}
excluded() { local top=${1%%/*} e; for e in "${excludes[@]}"; do [[ $e == "/$top/" ]] && return 0; done; return 1; }
mkdir -p "$dst"
if [[ $delete == 1 ]]; then
    while IFS= read -r p; do
        p=${p#./}
        if excluded "$p"; then continue; fi
        [[ -e $src/$p || -L $src/$p ]] || rm -rf -- "${dst:?}/$p"
    done < <(cd "$dst" && find . -mindepth 1 -depth -print)
fi
while IFS= read -r p; do
    p=${p#./}
    if excluded "$p"; then continue; fi
    cp -a -- "$src/$p" "$dst/"
done < <(cd "$src" && find . -mindepth 1 -maxdepth 1 -print)
STUB
    chmod +x "$tmp/sync-bin/rsync"
fi
sync_path="$tmp/sync-bin:$PATH"
fx="$tmp/sync-fixture"
mkdir -p "$fx/pelayanan" "$fx/berita" "$fx/admin/permohonan/detail" "$fx/_next/static"
for f in index.html 404.html favicon.svg pelayanan/index.html berita/index.html admin/index.html admin/permohonan/detail/index.html _next/static/app.js; do
    printf '%s\n' "$f" > "$fx/$f"
done
template_main="$root/deploy/hostinger/.htaccess"
template_admin="$root/deploy/hostinger/admin.htaccess"
# Tanpa blok admin-subdomain dan baris kosong sesudahnya = .htaccess sebelum fitur ini (perilaku lama).
awk '/# BEGIN admin-subdomain/ { skip = 1 } skip && /# END admin-subdomain/ { skip = 0; drop = 1; next } skip { next }
    drop && /^[[:space:]]*\r?$/ { drop = 0; next } { drop = 0; print }' "$template_main" > "$tmp/htaccess-legacy"
# Tidak ada dua baris kosong berurutan (sisa blok yang dihapus).
if ! awk 'prev && /^[[:space:]]*\r?$/ { bad = 1 } { prev = ($0 ~ /^[[:space:]]*\r?$/) } END { exit bad }' "$tmp/htaccess-legacy"; then
    printf 'GAGAL sisa baris kosong ganda di .htaccess mode L\n' >&2; exit 1
fi
grep -q 'RewriteRule ^api/ laravel.php' "$tmp/htaccess-legacy"
if grep -q 'admin-subdomain\|__ADMIN' "$tmp/htaccess-legacy"; then printf 'GAGAL blok admin-subdomain tidak berpenanda\n' >&2; exit 1; fi
# Salinan mentah template (skrip lama di server) tidak boleh mengaktifkan aturan apa pun.
if grep -Eq '^[[:space:]]*RewriteRule[^#]*__' "$template_main"; then printf 'GAGAL template utama punya aturan aktif berplaceholder\n' >&2; exit 1; fi

# sync_case <nama> <mode L|P|S> <layout nested|sibling|none> → hasil di $tmp/sync/<nama>
sync_case() {
    local name=$1 mode=$2 layout=$3 base="$tmp/sync/$1"
    rm -rf -- "$base"
    mkdir -p "$base/public_html/admin" "$base/public_html/.well-known" "$base/repo/backend/storage/app/public" "$base/managed"
    printf 'lama\n' > "$base/public_html/admin/lama.html"
    printf 'basi\n' > "$base/public_html/basi.html"
    printf 'acme\n' > "$base/public_html/.well-known/acme"
    printf '<?php // laravel.php fiktif\n' > "$base/managed/laravel.php"
    cp -a -- "$fx" "$base/staging"
    local admin_root=''
    case $layout in
        nested) admin_root="$base/public_html/panel" ;;
        sibling) admin_root="$base/panel_html" ;;
    esac
    if [[ -n $admin_root ]]; then
        mkdir -p "$admin_root/.well-known"
        printf 'bawaan hPanel\n' > "$admin_root/default.php"
        printf 'acme-panel\n' > "$admin_root/.well-known/acme"
    fi
    local origin=''
    [[ $mode != S ]] || origin=https://panel.desa-fiktif.test
    (
        set -euo pipefail
        fail() { printf 'GAGAL-SYNC: %s\n' "$1" >&2; exit 1; }
        PATH=$sync_path
        PUBLIC_HTML=$(realpath -e "$base/public_html") APP_DIR=$(realpath -e "$base/repo")
        ADMIN_PUBLIC_HTML=$admin_root ADMIN_ORIGIN=$origin
        # shellcheck source=deploy/hostinger-sync.sh
        source "$root/deploy/hostinger-sync.sh"
        hsync_resolve "$base/staging"
        [[ $admin_mode == "$mode" ]] || fail "mode $admin_mode, diharapkan $mode"
        hsync_check_origin https://desa-fiktif.test
        hsync_render_main "$template_main" "$base/managed/.htaccess"
        if [[ $admin_mode == S ]]; then hsync_render_admin "$template_admin" "$base/managed/admin.htaccess" https://desa-fiktif.test; fi
        hsync_install "$base/staging" "$base/managed" "$base/repo/backend/storage/app/public"
    ) > "$tmp/log" 2>&1 || { cat "$tmp/log"; printf 'GAGAL sync %s\n' "$name" >&2; exit 1; }
}
sync_fail() {
    local label=$1 expect=$2
    shift 2
    if ( set -euo pipefail; fail() { printf 'GAGAL-SYNC: %s\n' "$1" >&2; exit 1; }; PATH=$sync_path
        # shellcheck source=deploy/hostinger-sync.sh
        source "$root/deploy/hostinger-sync.sh"; "$@" ) > "$tmp/log" 2>&1; then
        printf 'GAGAL validasi panel menerima: %s\n' "$label" >&2; exit 1
    fi
    grep -q "$expect" "$tmp/log" || { cat "$tmp/log"; printf 'GAGAL pesan validasi %s\n' "$label" >&2; exit 1; }
}
no_placeholder() { if grep -q '__[A-Z][A-Z_]*__' "$1"; then printf 'GAGAL placeholder tersisa di %s\n' "$1" >&2; exit 1; fi; }
assert_main_common() {
    local p="$tmp/sync/$1/public_html"
    [[ -f $p/index.html && -f $p/pelayanan/index.html && -f $p/laravel.php && -e $p/storage && -f $p/.well-known/acme ]] \
        || { printf 'GAGAL isi public_html %s\n' "$1" >&2; exit 1; }
    [[ ! -e $p/basi.html ]] || { printf 'GAGAL rsync --delete utama %s\n' "$1" >&2; exit 1; }
    no_placeholder "$p/.htaccess"
}

# L: identik dengan perilaku lama (.htaccess tanpa blok, rsync --delete --exclude=/.well-known/ saja).
sync_case L L none
assert_main_common L
diff -u "$tmp/htaccess-legacy" "$tmp/sync/L/public_html/.htaccess"
legacy="$tmp/sync/legacy"
rm -rf -- "$legacy"
mkdir -p "$legacy/public_html/admin" "$legacy/public_html/.well-known"
printf 'lama\n' > "$legacy/public_html/admin/lama.html"
printf 'basi\n' > "$legacy/public_html/basi.html"
printf 'acme\n' > "$legacy/public_html/.well-known/acme"
cp -a -- "$fx" "$legacy/staging"
cp -- "$tmp/htaccess-legacy" "$legacy/staging/.htaccess"
printf '<?php // laravel.php fiktif\n' > "$legacy/staging/laravel.php"
mkdir -p "$legacy/media"
ln -s -- "$legacy/media" "$legacy/staging/storage"
PATH=$sync_path rsync -a --delete --exclude=/.well-known/ -- "$legacy/staging/" "$legacy/public_html/"
diff -r "$legacy/public_html" "$tmp/sync/L/public_html" > "$tmp/log" || { cat "$tmp/log"; printf 'GAGAL mode L berbeda dari perilaku lama\n' >&2; exit 1; }

# P bersarang: folder subdomain utuh setelah --delete, admin/ utama tetap, folder diblok dari host utama, tanpa redirect.
sync_case Pn P nested
assert_main_common Pn
p="$tmp/sync/Pn/public_html"
[[ -f $p/panel/default.php && -f $p/panel/.well-known/acme && ! -e $p/panel/.htaccess && -f $p/admin/index.html ]] \
    || { printf 'GAGAL mode P bersarang\n' >&2; exit 1; }
grep -qF 'RewriteRule ^panel(/|$) - [F]' "$p/.htaccess" || { grep -n panel "$p/.htaccess"; printf 'GAGAL blok 404/403 folder panel\n' >&2; exit 1; }
if grep -q 'R=302' "$p/.htaccess"; then printf 'GAGAL mode P memuat redirect\n' >&2; exit 1; fi
# P sejajar: tidak ada aturan admin aktif, folder sejajar tidak disentuh.
sync_case Ps P sibling
assert_main_common Ps
[[ -f $tmp/sync/Ps/panel_html/default.php && ! -e $tmp/sync/Ps/panel_html/index.html && -f $tmp/sync/Ps/public_html/admin/index.html ]] \
    || { printf 'GAGAL mode P sejajar\n' >&2; exit 1; }
if grep -Eq '^[[:space:]]*RewriteRule .*(panel|R=302)' "$tmp/sync/Ps/public_html/.htaccess"; then printf 'GAGAL mode P sejajar memuat aturan panel\n' >&2; exit 1; fi

# S: admin/ utama hilang; subdomain berisi admin/ + _next/ + admin.htaccess, tanpa laravel.php/storage.
for layout in nested sibling; do
    case_name=S$layout
    sync_case "$case_name" S "$layout"
    assert_main_common "$case_name"
    p="$tmp/sync/$case_name/public_html"
    if [[ $layout == nested ]]; then a="$p/panel"; else a="$tmp/sync/$case_name/panel_html"; fi
    [[ ! -e $p/admin ]] || { printf 'GAGAL mode S %s: admin/ utama masih ada\n' "$layout" >&2; exit 1; }
    [[ -f $a/admin/index.html && -f $a/admin/permohonan/detail/index.html && -f $a/_next/static/app.js && -f $a/.htaccess ]] \
        || { printf 'GAGAL isi subdomain %s\n' "$layout" >&2; exit 1; }
    [[ ! -e $a/laravel.php && ! -e $a/storage && ! -e $a/default.php && -f $a/.well-known/acme ]] \
        || { printf 'GAGAL subdomain %s: laravel.php/storage/sisa bawaan\n' "$layout" >&2; exit 1; }
    no_placeholder "$a/.htaccess"
    grep -qF 'RewriteCond %{HTTP_HOST} !^panel\.desa-fiktif\.test$ [NC]' "$a/.htaccess"
    grep -qF 'RewriteRule ^ https://desa-fiktif.test%{REQUEST_URI} [R=302,L]' "$a/.htaccess"
    grep -qF "connect-src 'self' https://desa-fiktif.test;" "$a/.htaccess"
    grep -qF 'RewriteRule ^admin(/.*)?$ https://panel.desa-fiktif.test/admin$1 [R=302,L]' "$p/.htaccess"
    if [[ $layout == nested ]]; then
        grep -qF 'RewriteRule ^panel(/|$) - [F]' "$p/.htaccess"
    elif grep -q 'RewriteRule ^panel' "$p/.htaccess"; then
        printf 'GAGAL mode S sejajar memblok folder yang tidak ada\n' >&2; exit 1
    fi
    # Blok redirect sebelum /api/.
    [[ $(grep -n 'RewriteRule ^admin' "$p/.htaccess" | cut -d: -f1) -lt $(grep -n 'RewriteRule ^api/' "$p/.htaccess" | cut -d: -f1) ]]
done
for mode in L Pn Ps Snested Ssibling; do
    cp -- "$tmp/sync/$mode/public_html/.htaccess" "$tmp/htaccess-$mode"
done

# Validasi path dan origin.
mkdir -p "$tmp/v/public_html/a/panel" "$tmp/v/public_html/panel" "$tmp/v/repo/x" "$tmp/v/stage/extra-page" "$tmp/v/outer/repo2"
for reserved in admin _next berita Admin; do mkdir -p "$tmp/v/public_html/$reserved"; done
vpub=$(realpath -e "$tmp/v/public_html") vrepo=$(realpath -e "$tmp/v/repo")
mkdir -p "$tmp/v/public_html/extra-page"
vcheck() { sync_fail "$1" "$2" env_run "${@:3}"; }
env_run() { PUBLIC_HTML=$1 APP_DIR=$2 ADMIN_PUBLIC_HTML=$3 ADMIN_ORIGIN=$4; shift 4; hsync_resolve "$@"; }
vcheck 'origin tanpa docroot' 'ADMIN_ORIGIN terisi tanpa ADMIN_PUBLIC_HTML' "$vpub" "$vrepo" '' https://panel.desa-fiktif.test
vcheck 'docroot = public_html' 'tidak boleh sama dengan PUBLIC_HTML' "$vpub" "$vrepo" "$vpub" ''
vcheck 'docroot tidak ada' 'tidak ditemukan' "$vpub" "$vrepo" "$tmp/v/tidak-ada" ''
vcheck 'dua tingkat' 'anak langsung' "$vpub" "$vrepo" "$vpub/a/panel" ''
for reserved in admin berita Admin; do
    vcheck "bentrok $reserved" 'bentrok dengan isi situs utama' "$vpub" "$vrepo" "$vpub/$reserved" ''
done
vcheck 'nama _next' 'tidak didukung' "$vpub" "$vrepo" "$vpub/_next" ''
vcheck 'bentrok isi arsip' 'bentrok dengan isi arsip frontend' "$vpub" "$vrepo" "$vpub/extra-page" '' "$tmp/v/stage"
vcheck 'di dalam repo' 'APP_DIR' "$vpub" "$vrepo" "$vrepo/x" ''
vcheck 'berisi repo' 'APP_DIR' "$vpub" "$(realpath -e "$tmp/v/outer/repo2")" "$(realpath -e "$tmp/v/outer")" ''
vcheck 'berisi public_html' 'berisi PUBLIC_HTML' "$vpub" "$vrepo" "$(realpath -e "$tmp/v")" ''
for bad in http://panel.desa-fiktif.test https://panel.desa-fiktif.test/ https://panel.desa-fiktif.test/admin https://Panel.desa-fiktif.test 'https://panel.desa-fiktif.test:8443'; do
    vcheck "origin $bad" 'ADMIN_ORIGIN harus https' "$vpub" "$vrepo" "$vpub/panel" "$bad"
done
origin_check() { PUBLIC_HTML=$1 APP_DIR=$2 ADMIN_PUBLIC_HTML=$3 ADMIN_ORIGIN=$4; hsync_resolve; hsync_check_origin "$5"; }
for bad in https://panel.evil.test https://a.panel.desa-fiktif.test https://desa-fiktif.test.evil.test; do
    sync_fail "origin asing $bad" 'subdomain langsung' origin_check "$vpub" "$vrepo" "$vpub/panel" "$bad" https://desa-fiktif.test
done
# Symlink di public_html ke docroot sejajar akan terhapus --delete (hanya bila ln -s membuat symlink sungguhan).
mkdir -p "$tmp/v/sejajar"
if ln -s "$tmp/v/sejajar" "$tmp/v/public_html/tautan" 2>/dev/null && [[ -L $tmp/v/public_html/tautan ]]; then
    vcheck 'symlink ke docroot' 'menunjuk ADMIN_PUBLIC_HTML' "$vpub" "$vrepo" "$(realpath -e "$tmp/v/sejajar")" ''
    symlink_note='diuji'
else
    rm -rf -- "$tmp/v/public_html/tautan"
    symlink_note='dilewati (ln -s bukan symlink di sistem ini)'
fi
printf 'LULUS sinkronisasi panel L/P/S bersarang+sejajar (rsync %s; uji symlink %s).\n' "$rsync_kind" "$symlink_note"

# hostinger-deploy.sh: tolak repo di dalam public_html, arsip frontend salah, dan berhenti saat fetch gagal.
mkdir -p "$tmp/home/public_html" "$tmp/home/repo/backend"
touch "$tmp/home/repo/backend/.env"
for cmd in composer rsync; do
    printf '#!/usr/bin/env bash\nprintf "UNEXPECTED COMMAND\\n" >&2\nexit 99\n' > "$tmp/bin/$cmd"
done
chmod +x "$tmp/bin/composer" "$tmp/bin/rsync"
run_hdeploy() { PATH="$tmp/bin:$PATH" PHP_BIN="$php_path" DEPLOY_BACKUP_CONFIRMED=1 DEPLOY_WRITERS_PAUSED=1 "$@" > "$tmp/log" 2>&1; }
if run_hdeploy env APP_DIR="$tmp/home/public_html" PUBLIC_HTML="$tmp/home/public_html" bash "$root/deploy/hostinger-deploy.sh" release; then
    printf 'GAGAL hostinger-deploy menerima repo di public_html\n' >&2; exit 1
fi
grep -q 'di luar public_html' "$tmp/log" || { cat "$tmp/log"; exit 1; }
mkdir -p "$tmp/web-bad/out" && printf x > "$tmp/web-bad/out/index.html"
tar -C "$tmp/web-bad" -czf "$tmp/bad.tar.gz" out
if run_hdeploy env APP_DIR="$tmp/home/repo" PUBLIC_HTML="$tmp/home/public_html" bash "$root/deploy/hostinger-deploy.sh" release --frontend "$tmp/bad.tar.gz"; then
    printf 'GAGAL hostinger-deploy menerima arsip berisi folder out/\n' >&2; exit 1
fi
grep -q 'ISI out/' "$tmp/log" || { cat "$tmp/log"; exit 1; }
mkdir -p "$tmp/web-local/pelayanan" "$tmp/web-local/_next/static"
printf x | tee "$tmp/web-local/index.html" "$tmp/web-local/404.html" "$tmp/web-local/pelayanan/index.html" > /dev/null
printf 'fetch("http://127.0.0.1:8000/api/v1")' > "$tmp/web-local/_next/static/a.js"
tar -C "$tmp/web-local" -czf "$tmp/local.tar.gz" .
if run_hdeploy env APP_DIR="$tmp/home/repo" PUBLIC_HTML="$tmp/home/public_html" bash "$root/deploy/hostinger-deploy.sh" release --frontend "$tmp/local.tar.gz"; then
    printf 'GAGAL hostinger-deploy menerima build API localhost\n' >&2; exit 1
fi
grep -q 'API localhost' "$tmp/log" || { cat "$tmp/log"; exit 1; }
# Bentuk URL localhost lain juga ditolak sebelum maintenance.
for api in 'http://localhost:8000/api/v1' 'https://127.0.0.1/api/v1' 'http://localhost/api/v1' 'http://[::1]:8000/api/v1'; do
    printf 'const api="%s";' "$api" > "$tmp/web-local/_next/static/a.js"
    tar -C "$tmp/web-local" -czf "$tmp/local.tar.gz" .
    if run_hdeploy env APP_DIR="$tmp/home/repo" PUBLIC_HTML="$tmp/home/public_html" bash "$root/deploy/hostinger-deploy.sh" release --frontend "$tmp/local.tar.gz"; then
        printf 'GAGAL hostinger-deploy menerima build API %s\n' "$api" >&2; exit 1
    fi
    grep -q 'API localhost' "$tmp/log" || { cat "$tmp/log"; exit 1; }
done
if run_hdeploy env APP_DIR="$tmp/home/repo" PUBLIC_HTML="$tmp/home/public_html" bash "$root/deploy/hostinger-deploy.sh" release; then
    printf 'GAGAL hostinger-deploy mengabaikan fetch gagal\n' >&2; exit 1
else
    code=$?
    [[ $code -eq 42 ]] || { cat "$tmp/log"; exit 1; }
fi
grep -q 'GAGAL \[fetch dan checkout rilis\]' "$tmp/log"
if grep -q 'UNEXPECTED COMMAND' "$tmp/log"; then cat "$tmp/log"; exit 1; fi
[[ -z $(ls -A "$tmp/home/public_html") ]] || { printf 'GAGAL public_html berubah sebelum deploy berhasil\n' >&2; exit 1; }

# Hostinger: bukti urutan maintenance/migration, lock, dan fail-closed tanpa server/database nyata.
mkdir -p "$tmp/home/repo/deploy/hostinger" "$tmp/home/repo/backend/storage/app/public" "$tmp/home/repo/backend/storage/framework"
cp "$root/deploy/hostinger/.htaccess" "$root/deploy/hostinger/laravel.php" "$tmp/home/repo/deploy/hostinger/"
printf x > "$tmp/home/public_html/index.html"
touch "$tmp/home/repo/backend/artisan"
cat > "$tmp/home/repo/deploy/smoke-test.sh" <<'STUB'
#!/usr/bin/env bash
printf 'smoke\n' >> "$EVENTS"
[[ ${DEPLOY_FAULT:-} != smoke ]]
STUB
cat > "$tmp/bin/git" <<'STUB'
#!/usr/bin/env bash
set -euo pipefail
case $1 in
    rev-parse) [[ $* == *--show-toplevel* ]] && pwd || printf 'commit-uji\n' ;;
    diff|fetch|show-ref) exit 0 ;;
    checkout)
        [[ -f backend/storage/framework/down ]] || exit 90
        printf 'checkout\n' >> "$EVENTS"
        [[ ${DEPLOY_FAULT:-} != checkout ]] ;;
    *) exit 91 ;;
esac
STUB
cat > "$tmp/bin/php-deploy" <<'STUB'
#!/usr/bin/env bash
set -euo pipefail
if [[ $1 == -r ]]; then
    printf 'validate\n' >> "$EVENTS"
    [[ ${DEPLOY_FAULT:-} != config ]] || exit 45
    printf 'https://desa.example.test'
    exit 0
fi
case $2 in
    down)
        printf 'down\n' >> "$EVENTS"
        [[ ${DEPLOY_FAULT:-} != down ]] || exit 46
        touch "$APP_DIR/backend/storage/framework/down" ;;
    up)
        printf 'up\n' >> "$EVENTS"
        rm -f "$APP_DIR/backend/storage/framework/down"
        [[ ${DEPLOY_FAULT:-} != up ]] || exit 47 ;;
    migrate)
        [[ -f "$APP_DIR/backend/storage/framework/down" ]] || exit 90
        printf 'migrate\n' >> "$EVENTS"
        [[ ${DEPLOY_FAULT:-} != migrate ]] || exit 48 ;;
    *)
        printf '%s\n' "$2" >> "$EVENTS"
        [[ ${DEPLOY_FAULT:-} != cache || $2 != route:cache ]] || exit 49 ;;
esac
STUB
cat > "$tmp/bin/composer" <<'STUB'
#!/usr/bin/env bash
printf 'composer\n' >> "$EVENTS"
[[ -f "$APP_DIR/backend/storage/framework/down" && ${DEPLOY_FAULT:-} != composer ]]
STUB
cat > "$tmp/bin/sleep" <<'STUB'
#!/usr/bin/env bash
printf 'drain %s\n' "$1" >> "$EVENTS"
STUB
cat > "$tmp/bin/rsync" <<'STUB'
#!/usr/bin/env bash
printf 'rsync\n' >> "$EVENTS"
[[ ${DEPLOY_FAULT:-} != files ]]
STUB
chmod +x "$tmp/bin/"*
run_safe_deploy() {
    : > "$tmp/events"
    run_hdeploy env APP_DIR="$tmp/home/repo" PUBLIC_HTML="$tmp/home/public_html" EVENTS="$tmp/events" \
        PHP_BIN="$tmp/bin/php-deploy" "$@" bash "$root/deploy/hostinger-deploy.sh" release
}
if run_safe_deploy DEPLOY_BACKUP_CONFIRMED=0; then printf 'GAGAL backup tidak dikonfirmasi diterima\n' >&2; exit 1; fi
[[ ! -s $tmp/events ]]
if run_safe_deploy DEPLOY_WRITERS_PAUSED=0; then printf 'GAGAL penulis aktif diterima\n' >&2; exit 1; fi
[[ ! -s $tmp/events ]]
mkdir "$tmp/home/repo/.hostinger-deploy.lock"
if run_safe_deploy; then printf 'GAGAL deploy bersamaan diterima\n' >&2; exit 1; fi
[[ ! -s $tmp/events && -d $tmp/home/repo/.hostinger-deploy.lock ]]
rmdir "$tmp/home/repo/.hostinger-deploy.lock"
run_safe_deploy || { cat "$tmp/log"; exit 1; }
printf '%s\n' down 'drain 120' checkout composer config:clear validate migrate config:cache route:cache view:cache up smoke > "$tmp/expected"
diff -u "$tmp/expected" "$tmp/events"
[[ ! -e $tmp/home/repo/backend/storage/framework/down && ! -e $tmp/home/repo/.hostinger-deploy.lock ]]
for fault in down checkout composer config migrate cache files up smoke; do
    rm -f "$tmp/home/repo/backend/storage/framework/down"
    if [[ $fault == files ]]; then
        rm -rf -- "$tmp/home/public_html/storage"
        mkdir "$tmp/home/public_html/storage"
    fi
    if run_safe_deploy DEPLOY_FAULT="$fault"; then printf 'GAGAL deploy menerima fault %s\n' "$fault" >&2; exit 1; fi
    [[ ! -e $tmp/home/repo/.hostinger-deploy.lock ]]
    if [[ $fault == down ]]; then
        [[ $(cat "$tmp/events") == down ]]
    else
        [[ -f $tmp/home/repo/backend/storage/framework/down && $(tail -1 "$tmp/events") == down ]]
    fi
    if [[ $fault != up && $fault != smoke ]]; then
        if grep -qx up "$tmp/events"; then printf 'GAGAL layanan dibuka setelah fault %s\n' "$fault" >&2; exit 1; fi
    fi
    if [[ $fault == migrate ]] && grep -qx config:cache "$tmp/events"; then printf 'GAGAL deploy lanjut setelah migration gagal\n' >&2; exit 1; fi
    if [[ $fault == files ]]; then rmdir "$tmp/home/public_html/storage"; fi
done
# Frontend rsync gagal juga harus menutup layanan; arsip valid tanpa API localhost.
mkdir -p "$tmp/web-valid/pelayanan" "$tmp/web-valid/_next/static"
printf x | tee "$tmp/web-valid/index.html" "$tmp/web-valid/404.html" "$tmp/web-valid/pelayanan/index.html" > /dev/null
# Validator origin hasil build (lib/urls.ts) memuat nama host lokal tanpa skema; itu bukan API localhost.
printf 's=r?.hostname==="localhost"||r?.hostname==="127.0.0.1";fetch("https://desa.example.test/api/v1")' > "$tmp/web-valid/_next/static/valid.js"
tar -C "$tmp/web-valid" -czf "$tmp/valid.tar.gz" .
: > "$tmp/events"
if run_hdeploy env APP_DIR="$tmp/home/repo" PUBLIC_HTML="$tmp/home/public_html" EVENTS="$tmp/events" \
    PHP_BIN="$tmp/bin/php-deploy" DEPLOY_FAULT=files bash "$root/deploy/hostinger-deploy.sh" release --frontend "$tmp/valid.tar.gz"; then
    printf 'GAGAL deploy mengabaikan rsync gagal\n' >&2; exit 1
fi
grep -qx rsync "$tmp/events"
[[ -f $tmp/home/repo/backend/storage/framework/down && $(tail -1 "$tmp/events") == down && ! -e $tmp/home/repo/.hostinger-deploy.lock ]]
if grep -qx up "$tmp/events"; then printf 'GAGAL layanan dibuka setelah rsync gagal\n' >&2; exit 1; fi
: > "$tmp/events"
run_hdeploy env APP_DIR="$tmp/home/repo" PUBLIC_HTML="$tmp/home/public_html" EVENTS="$tmp/events" \
    PHP_BIN="$tmp/bin/php-deploy" bash "$root/deploy/hostinger-deploy.sh" release --frontend "$tmp/valid.tar.gz" || { cat "$tmp/log"; exit 1; }
printf '%s\n' down 'drain 120' checkout composer config:clear validate migrate config:cache route:cache view:cache rsync up smoke > "$tmp/expected"
diff -u "$tmp/expected" "$tmp/events"
[[ ! -e $tmp/home/repo/backend/storage/framework/down && ! -e $tmp/home/repo/.hostinger-deploy.lock ]]

# Panel subdomain lewat skrip penuh: validasi gagal sebelum maintenance; mode S = dua rsync dalam urutan yang sama.
cp "$root/deploy/hostinger/admin.htaccess" "$tmp/home/repo/deploy/hostinger/"
mkdir -p "$tmp/home/public_html/panel"
run_admin_deploy() {
    : > "$tmp/events"
    run_hdeploy env APP_DIR="$tmp/home/repo" PUBLIC_HTML="$tmp/home/public_html" EVENTS="$tmp/events" \
        PHP_BIN="$tmp/bin/php-deploy" "$@"
}
expect_admin_reject() {
    local label=$1 expect=$2
    shift 2
    if run_admin_deploy "$@"; then printf 'GAGAL deploy menerima %s\n' "$label" >&2; exit 1; fi
    grep -q "$expect" "$tmp/log" || { cat "$tmp/log"; exit 1; }
    [[ ! -s $tmp/events && ! -e $tmp/home/repo/.hostinger-deploy.lock ]] || { printf 'GAGAL %s tidak berhenti sebelum maintenance\n' "$label" >&2; exit 1; }
}
expect_admin_reject 'ADMIN_ORIGIN tanpa docroot' 'ADMIN_ORIGIN terisi tanpa ADMIN_PUBLIC_HTML' \
    ADMIN_ORIGIN=https://panel.desa.example.test bash "$root/deploy/hostinger-deploy.sh" release --frontend "$tmp/valid.tar.gz"
expect_admin_reject 'arsip tanpa panel' 'tidak berisi admin/index.html' \
    ADMIN_PUBLIC_HTML="$tmp/home/public_html/panel" ADMIN_ORIGIN=https://panel.desa.example.test \
    bash "$root/deploy/hostinger-deploy.sh" release --frontend "$tmp/valid.tar.gz"
expect_admin_reject 'mode S tanpa frontend dan panel kosong' 'wajib dengan --frontend' \
    ADMIN_PUBLIC_HTML="$tmp/home/public_html/panel" ADMIN_ORIGIN=https://panel.desa.example.test \
    bash "$root/deploy/hostinger-deploy.sh" release
mkdir -p "$tmp/web-valid/admin"
printf x > "$tmp/web-valid/admin/index.html"
tar -C "$tmp/web-valid" -czf "$tmp/valid-admin.tar.gz" .
# Host panel bukan subdomain APP_URL: gagal setelah validasi konfigurasi, layanan tetap tertutup.
if run_admin_deploy ADMIN_PUBLIC_HTML="$tmp/home/public_html/panel" ADMIN_ORIGIN=https://panel.lain.test \
    bash "$root/deploy/hostinger-deploy.sh" release --frontend "$tmp/valid-admin.tar.gz"; then
    printf 'GAGAL deploy menerima ADMIN_ORIGIN di luar domain\n' >&2; exit 1
fi
grep -q 'subdomain langsung' "$tmp/log" || { cat "$tmp/log"; exit 1; }
if grep -qx up "$tmp/events"; then printf 'GAGAL layanan dibuka dengan ADMIN_ORIGIN salah\n' >&2; exit 1; fi
rm -f "$tmp/home/repo/backend/storage/framework/down"
run_admin_deploy ADMIN_PUBLIC_HTML="$tmp/home/public_html/panel" ADMIN_ORIGIN=https://panel.desa.example.test \
    bash "$root/deploy/hostinger-deploy.sh" release --frontend "$tmp/valid-admin.tar.gz" || { cat "$tmp/log"; exit 1; }
printf '%s\n' down 'drain 120' checkout composer config:clear validate migrate config:cache route:cache view:cache rsync rsync up smoke > "$tmp/expected"
diff -u "$tmp/expected" "$tmp/events"
grep -q 'Mode panel: S (docroot subdomain bersarang: public_html/panel)' "$tmp/log" || { cat "$tmp/log"; exit 1; }
[[ ! -e $tmp/home/repo/backend/storage/framework/down && ! -e $tmp/home/repo/.hostinger-deploy.lock ]]
printf 'LULUS: smoke + backup pgsql/mysql + validasi Hostinger; konfirmasi backup/penulis, lock deploy, maintenance sebelum checkout, drain request, migrate sebelum up, 9 fault fail-closed; panel subdomain: smoke --admin 9 fault, validasi sebelum maintenance, mode S dua rsync.\n'
