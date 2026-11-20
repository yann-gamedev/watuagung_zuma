<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Login petugas: kantor desa berbagi satu IP, jadi batas utama per username + IP agar salah ketik
        // satu petugas tidak mengunci rekannya. Batas per IP yang lebih longgar menahan tebakan banyak username.
        RateLimiter::for('staff-login', function (Request $request) {
            $identifier = $request->input('username') ?? $request->input('email');
            $identifier = is_string($identifier) ? mb_strtolower(trim($identifier)) : '';

            return [
                Limit::perMinute(5)->by('account:'.hash('sha256', $identifier.'|'.$request->ip())),
                Limit::perMinute(20)->by('ip:'.$request->ip()),
            ];
        });

        // E3: tautan persetujuan email publik. Per tautan membatasi tebakan PIN (selain kunci 5 PIN salah);
        // per IP membatasi tebakan token.
        RateLimiter::for('approval-link', function (Request $request) {
            $token = $request->input('token');

            return [
                Limit::perMinute(20)->by('ip:'.$request->ip()),
                Limit::perMinute(10)->by('link:'.hash('sha256', is_string($token) ? $token : '')),
            ];
        });
    }
}
