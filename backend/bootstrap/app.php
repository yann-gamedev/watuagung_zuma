<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Site content validates raw controls before trimming, and preserves optional empty strings.
        $siteInput = fn (Request $request) => $request->is('api/v1/staff/site/*');
        $middleware->trimStrings(except: [$siteInput]);
        $middleware->convertEmptyStringsToNull(except: [$siteInput]);
        $middleware->alias([
            'abilities' => \Laravel\Sanctum\Http\Middleware\CheckAbilities::class,
        ]);
        // Ability ditolak sebelum route model binding: token tanpa ability mendapat 403, bukan 404 yang membocorkan keberadaan data.
        $middleware->prependToPriorityList(
            before: \Illuminate\Routing\Middleware\SubstituteBindings::class,
            prepend: \Laravel\Sanctum\Http\Middleware\CheckAbilities::class,
        );
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
        // Pesan bawaan "Too Many Attempts." berbahasa Inggris dan tanpa waktu tunggu. `retry_after` di body
        // karena header Retry-After tidak terbaca lintas origin tanpa Access-Control-Expose-Headers.
        $exceptions->render(function (\Illuminate\Http\Exceptions\ThrottleRequestsException $e, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }
            $seconds = max(1, (int) ($e->getHeaders()['Retry-After'] ?? 60));
            $wait = $seconds < 60 ? "{$seconds} detik" : ((int) ceil($seconds / 60)).' menit';

            return response()->json([
                'message' => "Terlalu banyak percobaan. Tunggu {$wait}, lalu coba lagi.",
                'retry_after' => $seconds,
            ], 429, $e->getHeaders());
        });
        $exceptions->respond(function (\Symfony\Component\HttpFoundation\Response $response) {
            if (request()->is('api/v1/staff/site/*') || (request()->isMethod('GET') && request()->is('api/v1/staff/*'))) {
                $response->headers->set('Cache-Control', 'private, no-store');
            }

            return $response;
        });
    })->create();
