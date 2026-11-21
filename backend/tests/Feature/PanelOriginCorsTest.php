<?php

namespace Tests\Feature;

use Tests\TestCase;

/**
 * Panel di subdomain memanggil API domain utama lintas origin (deploy/hostinger.md § N).
 * Origin fiktif; nilai produksi diatur FRONTEND_ORIGINS di backend/.env.
 */
class PanelOriginCorsTest extends TestCase
{
    private const SITE = 'https://desa-fiktif.test';

    private const PANEL = 'https://panel.desa-fiktif.test';

    protected function setUp(): void
    {
        parent::setUp();
        config(['cors.allowed_origins' => [self::SITE, self::PANEL]]);
    }

    private function preflight(string $origin)
    {
        return $this->call('OPTIONS', '/api/v1/staff/me', [], [], [], [
            'HTTP_ORIGIN' => $origin,
            'HTTP_ACCESS_CONTROL_REQUEST_METHOD' => 'GET',
            'HTTP_ACCESS_CONTROL_REQUEST_HEADERS' => 'authorization',
        ]);
    }

    public function test_panel_origin_preflight_is_allowed(): void
    {
        $response = $this->preflight(self::PANEL);

        $response->assertNoContent();
        $response->assertHeader('Access-Control-Allow-Origin', self::PANEL);
        $this->assertStringContainsStringIgnoringCase('authorization', (string) $response->headers->get('Access-Control-Allow-Headers'));
    }

    public function test_panel_origin_on_actual_request_gets_allow_origin(): void
    {
        $this->getJson('/api/v1/staff/me', ['Origin' => self::PANEL])
            ->assertUnauthorized()
            ->assertHeader('Access-Control-Allow-Origin', self::PANEL);
    }

    /** @return array<string, array{string}> */
    public static function foreignOrigins(): array
    {
        return [
            'host asing' => ['https://evil.test'],
            'subdomain asing' => ['https://panel.evil.test'],
            'akhiran domain asing' => ['https://desa-fiktif.test.evil.test'],
            'panel tanpa https' => ['http://panel.desa-fiktif.test'],
        ];
    }

    #[\PHPUnit\Framework\Attributes\DataProvider('foreignOrigins')]
    public function test_foreign_origin_gets_no_allow_origin(string $origin): void
    {
        $this->preflight($origin)->assertHeaderMissing('Access-Control-Allow-Origin');
        $this->getJson('/api/v1/staff/me', ['Origin' => $origin])->assertHeaderMissing('Access-Control-Allow-Origin');
    }
}
