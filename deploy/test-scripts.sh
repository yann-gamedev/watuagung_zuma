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
printf 'LULUS: smoke sukses + 9 kegagalan, validasi domain, deploy berhenti saat fetch gagal, backup terenkripsi/rotasi/tolak passphrase longgar/pg_dump gagal.\n'
