<?php
return [
    'paths' => ['api/*'],
    // DELETE: hapus berita/sampul dan UMKM/foto dari panel lintas-origin (lokal :3000 → :8000).
    'allowed_methods' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    'allowed_origins' => array_values(array_filter(array_map('trim', explode(',', env('FRONTEND_ORIGINS', 'http://localhost:3000,http://127.0.0.1:3000'))))),
    'allowed_origins_patterns' => [],
    'allowed_headers' => ['Accept', 'Content-Type', 'Authorization'],
    'exposed_headers' => [],
    'max_age' => 600,
    'supports_credentials' => false,
];
