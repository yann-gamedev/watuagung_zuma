# shellcheck shell=bash
# Pemasangan public_html Hostinger dan panel di subdomain. Di-source oleh hostinger-deploy.sh SEBELUM checkout
# (fungsi tetap versi yang ditinjau operator) dan diuji tanpa jaringan oleh deploy/test-scripts.sh.
# Pemanggil menyediakan fungsi fail() dan variabel: PUBLIC_HTML, APP_DIR (realpath), ADMIN_PUBLIC_HTML, ADMIN_ORIGIN.
#
# Mode (deploy/hostinger.md § N):
#   L  ADMIN_PUBLIC_HTML dan ADMIN_ORIGIN kosong: perilaku lama, satu docroot, blok admin-subdomain dihapus.
#   P  ADMIN_PUBLIC_HTML saja: docroot subdomain tidak disentuh, dilindungi dari rsync --delete utama,
#      dan (bila bersarang) diblok dari host utama. /admin/ utama tetap disajikan.
#   S  keduanya: panel disajikan dari subdomain; /admin di domain utama dialihkan 302 dan foldernya dihapus.

# Nama tingkat atas arsip out/ dan berkas yang dipasang skrip. Docroot subdomain bersarang tidak boleh memakai
# nama ini; isi arsip yang sebenarnya juga diperiksa (hsync_resolve dengan staging).
HSYNC_RESERVED=(
    .htaccess .well-known 404 404.html _next _not-found admin agenda api backend berhenti-email berita brand bumdes
    index.html kebijakan-privasi kontak laravel.php pelayanan pengumuman persetujuan potensi profil sejarah statistik
    storage struktur-pemerintahan transparansi umkm verifikasi verifikasi-email visi-misi
)

# Hasil: admin_mode (L/P/S), admin_dir (nama folder bila bersarang di public_html, selain itu kosong).
hsync_resolve() {
    local staging_dir=${1:-} name entry
    admin_mode=L
    admin_dir=''
    if [[ -z ${ADMIN_PUBLIC_HTML:-} ]]; then
        [[ -z ${ADMIN_ORIGIN:-} ]] || fail 'ADMIN_ORIGIN terisi tanpa ADMIN_PUBLIC_HTML; isi docroot subdomain juga (deploy/hostinger.md § N).'
        return 0
    fi
    ADMIN_PUBLIC_HTML=$(realpath -e -- "$ADMIN_PUBLIC_HTML") || fail 'ADMIN_PUBLIC_HTML tidak ditemukan.'
    [[ -d $ADMIN_PUBLIC_HTML ]] || fail 'ADMIN_PUBLIC_HTML harus folder.'
    [[ $ADMIN_PUBLIC_HTML != "$PUBLIC_HTML" ]] || fail 'ADMIN_PUBLIC_HTML tidak boleh sama dengan PUBLIC_HTML.'
    [[ $PUBLIC_HTML != "$ADMIN_PUBLIC_HTML/"* ]] || fail 'ADMIN_PUBLIC_HTML tidak boleh berisi PUBLIC_HTML.'
    [[ $ADMIN_PUBLIC_HTML != "$APP_DIR" && $ADMIN_PUBLIC_HTML != "$APP_DIR/"* && $APP_DIR != "$ADMIN_PUBLIC_HTML/"* ]] \
        || fail 'ADMIN_PUBLIC_HTML tidak boleh di dalam atau berisi APP_DIR (repo).'
    if [[ $ADMIN_PUBLIC_HTML == "$PUBLIC_HTML/"* ]]; then
        admin_dir=${ADMIN_PUBLIC_HTML#"$PUBLIC_HTML/"}
        [[ $admin_dir != */* ]] || fail "ADMIN_PUBLIC_HTML di dalam public_html harus anak langsung (satu level), bukan $admin_dir."
        [[ $admin_dir =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]] || fail "Nama folder subdomain tidak didukung: $admin_dir."
        for name in "${HSYNC_RESERVED[@]}"; do
            [[ ${admin_dir,,} != "${name,,}" ]] \
                || fail "Folder subdomain public_html/$admin_dir bentrok dengan isi situs utama ($name); pakai nama lain atau folder sejajar."
        done
        if [[ -n $staging_dir ]]; then
            for entry in "$staging_dir"/* "$staging_dir"/.[!.]*; do
                [[ -e $entry || -L $entry ]] || continue
                name=$(basename -- "$entry")
                [[ ${admin_dir,,} != "${name,,}" ]] || fail "Folder subdomain public_html/$admin_dir bentrok dengan isi arsip frontend ($name)."
            done
        fi
    else
        # Symlink di public_html yang menunjuk docroot subdomain akan dihapus rsync --delete tanpa terlihat bersarang.
        for entry in "$PUBLIC_HTML"/* "$PUBLIC_HTML"/.[!.]*; do
            [[ -e $entry ]] || continue
            [[ ! $entry -ef $ADMIN_PUBLIC_HTML ]] || fail "public_html/$(basename -- "$entry") menunjuk ADMIN_PUBLIC_HTML; pakai folder sungguhan, bukan symlink."
        done
    fi
    admin_mode=P
    [[ -n ${ADMIN_ORIGIN:-} ]] || return 0
    [[ $ADMIN_ORIGIN =~ ^https://[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$ ]] \
        || fail 'ADMIN_ORIGIN harus https://<sub>.<domain> huruf kecil, tanpa port, path, atau garis miring akhir.'
    admin_mode=S
}

# ADMIN_ORIGIN wajib subdomain langsung dari host APP_URL. $1 = APP_URL (https://host).
hsync_check_origin() {
    [[ $admin_mode == S ]] || return 0
    local app_host=${1#https://} admin_host=${ADMIN_ORIGIN#https://} label
    app_host=${app_host,,}
    label=${admin_host%".$app_host"}
    [[ $admin_host == *".$app_host" && -n $label && $label != *.* ]] \
        || fail "ADMIN_ORIGIN ($ADMIN_ORIGIN) harus subdomain langsung dari APP_URL ($app_host)."
}

hsync_regex_escape() {
    printf '%s' "$1" | sed 's/\./\\./g'
}

# .htaccess utama. Baris "#@nested " aktif bila docroot subdomain bersarang (mode P/S), "#@redirect " pada mode S.
# Mode L menghapus seluruh blok admin-subdomain. $1 template, $2 hasil.
hsync_render_main() {
    local line in_block=0 after_block=0 dir_re='' re_nested='^([[:space:]]*)#@nested (.*)$' re_redirect='^([[:space:]]*)#@redirect (.*)$'
    [[ -z $admin_dir ]] || dir_re=$(hsync_regex_escape "$admin_dir")
    while IFS= read -r line || [[ -n $line ]]; do
        # Mode L: baris kosong pemisah setelah blok juga dibuang, sehingga hasilnya sama byte-per-byte dengan
        # .htaccess sebelum blok ini ada.
        if [[ $after_block == 1 ]]; then
            after_block=0
            if [[ $line =~ ^[[:space:]]*$ ]]; then continue; fi
        fi
        if [[ $line == *'# BEGIN admin-subdomain'* ]]; then
            in_block=1
            if [[ $admin_mode == L ]]; then continue; fi
        elif [[ $line == *'# END admin-subdomain'* ]]; then
            in_block=0
            if [[ $admin_mode == L ]]; then after_block=1; continue; fi
        elif [[ $in_block == 1 ]]; then
            if [[ $admin_mode == L ]]; then continue; fi
            if [[ $line =~ $re_nested ]]; then
                if [[ -z $admin_dir ]]; then continue; fi
                line=${BASH_REMATCH[1]}${BASH_REMATCH[2]}
            elif [[ $line =~ $re_redirect ]]; then
                if [[ $admin_mode != S ]]; then continue; fi
                line=${BASH_REMATCH[1]}${BASH_REMATCH[2]}
            fi
        fi
        line=${line//__ADMIN_DIR_RE__/"$dir_re"}
        line=${line//__ADMIN_ORIGIN__/"${ADMIN_ORIGIN:-}"}
        printf '%s\n' "$line"
    done < "$1" > "$2"
    [[ $in_block == 0 ]] || fail 'Blok admin-subdomain di .htaccess utama tidak ditutup.'
    if grep -q '__[A-Z][A-Z_]*__' "$2"; then fail 'Placeholder .htaccess utama tidak terganti.'; fi
}

# .htaccess docroot subdomain (mode S). $1 template, $2 hasil, $3 APP_URL (asal situs warga).
hsync_render_admin() {
    local line site=${3,,} host_re
    host_re=$(hsync_regex_escape "${ADMIN_ORIGIN#https://}")
    while IFS= read -r line || [[ -n $line ]]; do
        line=${line//__SITE_ORIGIN__/"$site"}
        line=${line//__ADMIN_HOST_RE__/"$host_re"}
        printf '%s\n' "$line"
    done < "$1" > "$2"
    if grep -q '__[A-Z][A-Z_]*__' "$2"; then fail 'Placeholder admin.htaccess tidak terganti.'; fi
}

hsync_assert_admin_clean() {
    [[ ! -e $ADMIN_PUBLIC_HTML/laravel.php && ! -e $ADMIN_PUBLIC_HTML/storage && ! -L $ADMIN_PUBLIC_HTML/storage ]] \
        || fail 'Docroot subdomain tidak boleh berisi laravel.php atau storage.'
}

# Pasang public_html (dan docroot subdomain pada mode S).
#   $1 staging (isi out/ terekstrak) atau kosong bila tanpa --frontend
#   $2 folder berisi .htaccess, laravel.php, dan (mode S) admin.htaccess hasil render
#   $3 target symlink storage (backend/storage/app/public)
hsync_install() {
    local staging_dir=$1 managed_dir=$2 media_dir=$3 admin_root
    local main_excludes=(--exclude=/.well-known/)
    [[ -z $admin_dir ]] || main_excludes+=("--exclude=/$admin_dir/")
    if [[ -n $staging_dir ]]; then
        if [[ $admin_mode == S ]]; then
            # Subdomain lebih dulu: redirect /admin utama baru aktif setelah panel tersedia di subdomain.
            admin_root="$managed_dir/admin-root"
            mkdir -- "$admin_root"
            cp -a -- "$staging_dir/." "$admin_root/"
            cp -- "$managed_dir/admin.htaccess" "$admin_root/.htaccess"
            rsync -a --delete --exclude=/.well-known/ -- "$admin_root/" "$ADMIN_PUBLIC_HTML/"
            hsync_assert_admin_clean
            main_excludes+=(--exclude=/admin/)
        fi
        cp -a -- "$managed_dir/.htaccess" "$managed_dir/laravel.php" "$staging_dir/"
        ln -s -- "$media_dir" "$staging_dir/storage"
        # .well-known dipakai validasi SSL hPanel; folder subdomain bersarang dilindungi dari --delete.
        rsync -a --delete "${main_excludes[@]}" -- "$staging_dir/" "$PUBLIC_HTML/"
        # Exclude rsync melindungi admin/ lama dari --delete; mode S menghapusnya eksplisit (D7).
        if [[ $admin_mode == S ]]; then rm -rf -- "${PUBLIC_HTML:?}/admin"; fi
    else
        cp -- "$managed_dir/.htaccess" "$managed_dir/laravel.php" "$PUBLIC_HTML/"
        if [[ -L $PUBLIC_HTML/storage ]]; then
            [[ $PUBLIC_HTML/storage -ef $media_dir ]] || fail 'public_html/storage menunjuk target lain; periksa manual.'
        else
            [[ ! -e $PUBLIC_HTML/storage ]] || fail 'public_html/storage ada tetapi bukan symlink; periksa manual.'
            ln -s -- "$media_dir" "$PUBLIC_HTML/storage"
        fi
        if [[ $admin_mode == S ]]; then
            [[ -f $ADMIN_PUBLIC_HTML/admin/index.html ]] || fail 'Docroot subdomain belum berisi panel; jalankan dengan --frontend.'
            cp -- "$managed_dir/admin.htaccess" "$ADMIN_PUBLIC_HTML/.htaccess"
            hsync_assert_admin_clean
        fi
    fi
}
