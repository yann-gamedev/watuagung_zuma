# Persiapan server — dikerjakan manusia di VPS

Untuk Ubuntu 24.04 LTS yang masih kosong. Kerjakan langkah ini sebelum [first-deploy.md](first-deploy.md). Ganti `example.id`, `<DEPLOY_USER>`, `<DB_USER>` dengan nilai asli. Jangan tempel kata sandi ke shell history atau chat.

## 1. Paket

`backend/composer.json` meminta PHP `^8.3`. Ubuntu 24.04 menyediakan PHP 8.3, jadi tidak perlu PPA. Bila memakai PHP 8.4 dari PPA, ganti semua `8.3` di bawah, di `deploy/nginx/watuagung.conf` (socket) dan `PHP_FPM_SERVICE` pada `deploy.sh`.

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx \
  php8.3-fpm php8.3-cli php8.3-pgsql php8.3-mbstring php8.3-xml php8.3-gd php8.3-intl \
  php8.3-bcmath php8.3-zip php8.3-curl \
  composer postgresql-16 certbot python3-certbot-nginx \
  ufw fail2ban unattended-upgrades git rsync curl acl gnupg
sudo timedatectl set-timezone Asia/Jakarta
```

`php8.3-xml` sudah memuat `dom`. Cek ekstensi dan GD (JPEG/WebP wajib untuk foto):

```bash
php -m | grep -Ei '^(pdo_pgsql|mbstring|dom|xml|gd|intl|bcmath|zip|curl)$'
php -r 'var_dump(function_exists("imagejpeg"), function_exists("imagewebp"));'
```

Node 24.x hanya perlu bila frontend dibangun di VPS; bila dibangun di laptop, gunakan `deploy.sh --skip-frontend`.

## 2. User deploy dan SSH

```bash
sudo adduser --disabled-password <DEPLOY_USER>
sudo usermod -aG www-data <DEPLOY_USER>
sudo install -d -m 700 -o <DEPLOY_USER> -g <DEPLOY_USER> /home/<DEPLOY_USER>/.ssh
# Tempel kunci publik (bukan privat) ke /home/<DEPLOY_USER>/.ssh/authorized_keys, mode 600.
```

Uji login dengan kunci dari terminal **kedua** sebelum mematikan password. Lalu buat `/etc/ssh/sshd_config.d/99-watuagung.conf`:

```
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
PubkeyAuthentication yes
```

```bash
sudo sshd -t && sudo systemctl reload ssh
```

Jangan menutup sesi lama sampai login kunci terbukti berhasil; salah konfigurasi bisa mengunci server.

Izin sudo hanya untuk reload FPM (dipakai `deploy.sh`): `sudo visudo -f /etc/sudoers.d/watuagung`, isi:

```
<DEPLOY_USER> ALL=(root) NOPASSWD: /usr/bin/systemctl reload php8.3-fpm
```

## 3. Firewall, fail2ban, pembaruan otomatis

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo systemctl enable --now fail2ban
sudo dpkg-reconfigure -plow unattended-upgrades
```

`fail2ban` di Ubuntu sudah mengaktifkan jail `sshd`; cek dengan `sudo fail2ban-client status sshd`.

## 4. PostgreSQL

Pastikan hanya mendengarkan localhost di `/etc/postgresql/16/main/postgresql.conf`:

```
listen_addresses = 'localhost'
```

```bash
sudo systemctl restart postgresql
sudo -u postgres createuser --pwprompt <DB_USER>
sudo -u postgres createdb --owner=<DB_USER> watuagung
ss -ltnp | grep 5432   # harus 127.0.0.1 / ::1 saja
```

Isi kata sandi yang sama ke `backend/.env` (`DB_USERNAME`, `DB_PASSWORD`) di server. Untuk backup, buat `~/.pgpass` milik user deploy, mode 600, satu baris `localhost:5432:watuagung:<DB_USER>:<KATA_SANDI>` (edit dengan editor, bukan `echo`). Baris cron backup sudah memakai `PGHOST=localhost PGUSER=<DB_USER>`.

## 5. PHP

Buat `/etc/php/8.3/fpm/conf.d/99-watuagung.ini` **dan** salinannya di `/etc/php/8.3/cli/conf.d/`:

```ini
upload_max_filesize = 12M
post_max_size = 12M
memory_limit = 256M
expose_php = Off
```

PDF APBDes ≤ 10 MB; Nginx `client_max_body_size 12m`. `memory_limit` 256M untuk olah foto 6000×6000 (lihat `first-deploy.md`).

```bash
sudo systemctl restart php8.3-fpm
```

## 6. Nginx dan HTTPS

DNS A (dan AAAA bila ada IPv6) `example.id` dan `www.example.id` harus sudah mengarah ke VPS.

1. Ganti placeholder di [nginx/watuagung.conf](nginx/watuagung.conf) (domain, `WEB_ROOT`, `APP_DIR`, socket FPM).
2. Sertifikat dulu, karena blok 443 merujuk file sertifikat yang belum ada. `certbot --nginx` dipakai dengan `certonly` agar certbot tidak menulis ulang konfigurasi kita:

   ```bash
   sudo certbot certonly --nginx -d example.id -d www.example.id
   ```

3. Pasang konfigurasi:

   ```bash
   sudo cp deploy/nginx/watuagung-headers.conf /etc/nginx/snippets/
   sudo cp deploy/nginx/watuagung.conf /etc/nginx/sites-available/
   sudo ln -s /etc/nginx/sites-available/watuagung.conf /etc/nginx/sites-enabled/
   sudo rm /etc/nginx/sites-enabled/default
   sudo nginx -t && sudo systemctl reload nginx
   sudo certbot renew --dry-run
   ```

4. User Nginx (`www-data`) perlu membaca `WEB_ROOT` dan `backend/storage/app/public`. Jangan beri akses baca ke `storage/app/private` atau log.
5. Uji setelah deploy pertama:

   ```bash
   curl -sI https://example.id/ | grep -Ei 'strict-transport|content-security|x-frame'
   curl -s -o /dev/null -w '%{http_code}\n' https://example.id/.env           # 403
   curl -s -o /dev/null -w '%{http_code}\n' https://example.id/storage/x.php  # 403
   curl -s -o /dev/null -w '%{http_code}\n' https://example.id/storage/../.env --path-as-is  # bukan 200
   bash deploy/smoke-test.sh example.id
   ```

   Akses log tidak boleh memuat `?q=`: `sudo tail /var/log/nginx/watuagung.access.log`.

CSP masih `Report-Only`. Setelah seminggu tanpa pelanggaran di console browser, ubah ke enforce di `watuagung-headers.conf` (penjelasan ada di berkas itu).

## 7. Backup

```bash
sudo install -d -m 750 -o <DEPLOY_USER> -g <DEPLOY_USER> /etc/watuagung /var/backups/watuagung
# Buat passphrase panjang acak, tulis ke berkas tanpa menampilkannya:
sudo -u <DEPLOY_USER> sh -c 'umask 077; openssl rand -base64 48 > /etc/watuagung/backup-passphrase'
```

Salin passphrase ke password manager desa (terpisah dari `APP_KEY`), lalu pasang baris backup dari [crontab.txt](crontab.txt) dan jalankan sekali manual: `bash deploy/backup.sh`. Tanpa passphrase, backup tidak bisa dibuka. Uji pemulihan sesuai [restore.md](restore.md) sebelum go-live.
