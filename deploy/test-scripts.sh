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
headers='' body='' url=''
for ((i=1; i<=$#; i++)); do
    arg=${!i}
    case $arg in
        --dump-header) i=$((i + 1)); headers=${!i} ;;
        --output) i=$((i + 1)); body=${!i} ;;
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
printf 'HTTP/1.1 %s\r\nContent-Type: application/json\r\n' "$status" > "$headers"
[[ ${FAULT:-} != type ]] || printf 'Content-Type: text/html\r\n' > "$headers"
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

# hostinger-deploy.sh: tolak repo di dalam public_html, arsip frontend salah, dan berhenti saat fetch gagal.
mkdir -p "$tmp/home/public_html" "$tmp/home/repo/backend"
touch "$tmp/home/repo/backend/.env"
for cmd in composer rsync; do
    printf '#!/usr/bin/env bash\nprintf "UNEXPECTED COMMAND\\n" >&2\nexit 99\n' > "$tmp/bin/$cmd"
done
chmod +x "$tmp/bin/composer" "$tmp/bin/rsync"
run_hdeploy() { PATH="$tmp/bin:$PATH" PHP_BIN="$php_path" "$@" > "$tmp/log" 2>&1; }
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
if run_hdeploy env APP_DIR="$tmp/home/repo" PUBLIC_HTML="$tmp/home/public_html" bash "$root/deploy/hostinger-deploy.sh" release; then
    printf 'GAGAL hostinger-deploy mengabaikan fetch gagal\n' >&2; exit 1
else
    code=$?
    [[ $code -eq 42 ]] || { cat "$tmp/log"; exit 1; }
fi
grep -q 'GAGAL \[fetch dan checkout rilis\]' "$tmp/log"
if grep -q 'UNEXPECTED COMMAND' "$tmp/log"; then cat "$tmp/log"; exit 1; fi
[[ -z $(ls -A "$tmp/home/public_html") ]] || { printf 'GAGAL public_html berubah sebelum deploy berhasil\n' >&2; exit 1; }

printf 'LULUS: smoke sukses + 9 kegagalan, validasi domain, deploy berhenti saat fetch gagal, backup pgsql terenkripsi/rotasi/tolak passphrase longgar/pg_dump gagal, backup mysql gpg+openssl/tolak dump gagal-kosong, hostinger-deploy tolak repo di public_html/arsip salah/API localhost/fetch gagal.\n'
