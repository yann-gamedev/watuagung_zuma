#!/usr/bin/env bash
set -euo pipefail
# Backup harian terenkripsi: dump database + tar backend/storage/app (private dan public).
# DB_DRIVER=mysql (Hostinger Web Hosting, mysqldump → db.sql) atau pgsql (VPS, pg_dump -Fc → db.dump).
# ENCRYPTOR=gpg (bawaan, AES256) atau openssl (cadangan bila gpg tidak tersedia di hosting:
# AES-256-CBC + PBKDF2, tanpa autentikasi isi; uji dekripsi tetap dijalankan).
# TIDAK menyertakan backend/.env maupun APP_KEY: tanpa APP_KEY, NIK/KK/telepon/alamat dan PDF
# surat di backup tidak bisa dibaca. Simpan APP_KEY dan passphrase backup di password manager
# desa, terpisah dari berkas backup. Pemulihan: deploy/hostinger.md § Pemulihan, deploy/restore.md.
#
# Kredensial database tidak pernah ditulis di skrip atau argumen: MySQL/MariaDB memakai
# ~/.my.cnf bagian [client] (mode 600); PostgreSQL memakai PGHOST/PGUSER/PGPORT dan ~/.pgpass.
umask 0077

APP_DIR="${APP_DIR:-/srv/watuagung}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/watuagung}"
# Berisi passphrase saja (satu baris), mode 600/400, milik user backup, di luar repo dan BACKUP_DIR.
PASSPHRASE_FILE="${PASSPHRASE_FILE:-/etc/watuagung/backup-passphrase}"
DB_NAME="${DB_NAME:-watuagung}"
DB_DRIVER="${DB_DRIVER:-pgsql}"
ENCRYPTOR="${ENCRYPTOR:-gpg}"
KEEP_DAILY="${KEEP_DAILY:-14}"
KEEP_WEEKLY="${KEEP_WEEKLY:-8}"
# Hari backup mingguan, 1=Senin ... 7=Minggu.
WEEKLY_DAY="${WEEKLY_DAY:-7}"

fail() { printf 'GAGAL backup: %s\n' "$1" >&2; exit 1; }

case $DB_DRIVER in
    pgsql) dump_cmd=pg_dump dump_file=db.dump ;;
    mysql) dump_cmd=mysqldump dump_file=db.sql ;;
    *) fail 'DB_DRIVER harus mysql atau pgsql.' ;;
esac
case $ENCRYPTOR in
    gpg) ext=gpg ;;
    openssl) ext=enc ;;
    *) fail 'ENCRYPTOR harus gpg atau openssl.' ;;
esac
for cmd in "$dump_cmd" tar "$ENCRYPTOR" flock stat; do
    command -v "$cmd" >/dev/null || fail "Perintah tidak tersedia: $cmd"
done
[[ -d $APP_DIR/backend/storage/app/private && -d $APP_DIR/backend/storage/app/public ]] || fail 'storage/app/private atau public tidak ditemukan; periksa APP_DIR.'
[[ -s $PASSPHRASE_FILE ]] || fail "Passphrase kosong/tidak ada: $PASSPHRASE_FILE"
[[ $(stat -c %a -- "$PASSPHRASE_FILE") =~ ^[46]00$ ]] || fail 'Passphrase harus mode 600 atau 400.'
[[ $KEEP_DAILY =~ ^[1-9][0-9]*$ && $KEEP_WEEKLY =~ ^[1-9][0-9]*$ ]] || fail 'KEEP_DAILY/KEEP_WEEKLY harus bilangan positif.'

mkdir -p -- "$BACKUP_DIR/daily" "$BACKUP_DIR/weekly"
exec 9>"$BACKUP_DIR/.lock"
flock -n 9 || fail 'Backup lain sedang berjalan.'

stamp=$(TZ=Asia/Jakarta date +%Y%m%d-%H%M%S)
name="watuagung-$stamp.tar.$ext"
tmp=$(mktemp -d "$BACKUP_DIR/.tmp.XXXXXX")
trap 'rm -rf -- "$tmp"' EXIT

encrypt() {
    if [[ $ENCRYPTOR == gpg ]]; then
        gpg --batch --yes --quiet --pinentry-mode loopback --passphrase-file "$PASSPHRASE_FILE" \
            --symmetric --cipher-algo AES256 -o "$1"
    else
        openssl enc -aes-256-cbc -pbkdf2 -iter 600000 -salt -pass "file:$PASSPHRASE_FILE" -out "$1"
    fi
}
decrypt() {
    if [[ $ENCRYPTOR == gpg ]]; then
        gpg --batch --quiet --pinentry-mode loopback --passphrase-file "$PASSPHRASE_FILE" --decrypt "$1"
    else
        openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -pass "file:$PASSPHRASE_FILE" -in "$1"
    fi
}

# Dump dulu, lalu file: file yang diunggah di antara keduanya ikut tersimpan tetapi tidak
# dirujuk database (sisa tak terpakai), bukan sebaliknya.
if [[ $DB_DRIVER == pgsql ]]; then
    pg_dump -Fc --no-owner --no-privileges -f "$tmp/$dump_file" "$DB_NAME"
else
    # --single-transaction: snapshot konsisten InnoDB tanpa mengunci tabel saat situs berjalan.
    # --no-tablespaces: user database hosting tidak punya hak PROCESS.
    mysqldump --single-transaction --quick --no-tablespaces --default-character-set=utf8mb4 \
        --result-file="$tmp/$dump_file" "$DB_NAME"
fi
[[ -s $tmp/$dump_file ]] || fail 'Dump database kosong.'
tar -C "$APP_DIR/backend/storage" -cf "$tmp/storage.tar" app/private app/public
tar -C "$tmp" -cf - "$dump_file" storage.tar | encrypt "$tmp/$name"
# Backup yang tidak bisa dibuka sama saja tidak ada: uji dekripsi sebelum dipakai.
decrypt "$tmp/$name" | tar -tf - > "$tmp/list"
[[ $(sort "$tmp/list" | tr '\n' ' ') == "$dump_file storage.tar " ]] || fail 'Uji dekripsi backup gagal.'

mv -- "$tmp/$name" "$BACKUP_DIR/daily/$name"
if [[ $(TZ=Asia/Jakarta date +%u) == "$WEEKLY_DAY" ]]; then
    ln -f -- "$BACKUP_DIR/daily/$name" "$BACKUP_DIR/weekly/$name"
fi

# Rotasi: nama bertanggal sehingga urutan nama = urutan waktu.
rotate() {
    local dir=$1 keep=$2
    find "$dir" -maxdepth 1 -type f -name 'watuagung-*.tar.*' -printf '%f\n' \
        | sort -r | tail -n +"$((keep + 1))" \
        | while read -r old; do rm -f -- "$dir/$old"; done
}
rotate "$BACKUP_DIR/daily" "$KEEP_DAILY"
rotate "$BACKUP_DIR/weekly" "$KEEP_WEEKLY"

# Salinan ke luar server (wajib sebelum go-live: backup di server yang sama hilang bersamanya).
# Siapkan remote dengan `rclone config` sebagai user backup, lalu buka komentar. `sync`
# mencerminkan rotasi di atas; berkas sudah terenkripsi sebelum keluar server.
# Hostinger Web Hosting: rclone dipasang di ~/bin, atau backup ditarik dari luar (deploy/hostinger.md § H).
# RCLONE_REMOTE="${RCLONE_REMOTE:-watuagung-backup:watuagung}"
# rclone sync "$BACKUP_DIR/daily" "$RCLONE_REMOTE/daily"
# rclone sync "$BACKUP_DIR/weekly" "$RCLONE_REMOTE/weekly"

printf 'Backup selesai: %s\n' "$BACKUP_DIR/daily/$name"
