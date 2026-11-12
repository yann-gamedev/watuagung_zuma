<?php

// Penghubung public_html → Laravel untuk Hostinger Web Hosting (LiteSpeed).
// .htaccess menulis ulang /api/* ke berkas ini; akses langsung ke /laravel.php ditolak.
// hostinger-deploy.sh mengganti placeholder dengan path absolut backend/public di luar public_html.
// Jangan menyalin berkas lain dari backend/ ke public_html.

$laravelPublic = '__LARAVEL_PUBLIC__';

if (! is_file($laravelPublic.'/index.php')) {
    http_response_code(503);
    header('Content-Type: application/json');
    echo '{"message":"Layanan belum siap."}';
    exit;
}

chdir($laravelPublic);
require $laravelPublic.'/index.php';
