<?php

namespace Tests\Feature;

use App\Domain\SiteSection as SectionKey;
use App\Domain\SiteSectionRules;
use App\Models\SiteSection;
use App\Models\User;
use Database\Seeders\SiteSectionDefaults;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class SiteSectionsApiTest extends TestCase
{
    use RefreshDatabase;

    private function act(string $role = 'staff', array $abilities = ['applications:manage']): User
    {
        $user = User::factory()->create(['role' => $role, 'rt' => '001', 'rw' => '002']);
        Sanctum::actingAs($user, $abilities);
        return $user;
    }

    private function text(): array
    {
        return ['intro' => 'Pengantar fiktif', 'blocks' => [['title' => 'Judul fiktif', 'text' => "Baris satu\nBaris dua"]]];
    }

    private function profile(): array
    {
        return $this->text() + ['profileDetails' => [
            'themes' => ['Tema fiktif'],
            'stats' => [['value' => '1', 'label' => 'Label fiktif', 'detail' => 'Rincian fiktif']],
            'location' => 'Lokasi fiktif',
            'boundaries' => array_map(fn ($direction) => ['direction' => $direction, 'place' => 'Tempat fiktif'], ['Utara', 'Timur', 'Selatan', 'Barat']),
            'institutions' => [['name' => 'Lembaga fiktif', 'description' => 'Deskripsi fiktif']],
            'source' => 'Sumber fiktif',
        ]];
    }

    private function contact(): array
    {
        return ['address' => 'Alamat kantor fiktif', 'hours' => 'Jam fiktif', 'contactName' => 'Kontak fiktif', 'phone' => '', 'mapsEmbedUrl' => '', 'mapsLinkUrl' => ''];
    }

    private function pdf(): UploadedFile
    {
        return UploadedFile::fake()->createWithContent('apbdes.pdf', "%PDF-1.4\n% fiktif\n");
    }

    private function budget(int $year = 2027): array
    {
        return [
            'year' => $year, 'status' => 'Ditetapkan',
            'revenue' => [['label' => 'Dana Desa fiktif', 'amount' => 1000000], ['label' => 'Pendapatan asli fiktif', 'amount' => 0]],
            'spending' => array_map(fn ($label) => ['label' => $label, 'amount' => 100000], SiteSectionRules::SPENDING_FIELDS),
            'financing' => [['label' => 'SiLPA fiktif', 'amount' => 5000]],
            'source' => 'Sumber fiktif',
        ];
    }

    private function transparency(array $budgets = []): array
    {
        return ['intro' => 'Pengantar fiktif', 'programs' => [['title' => 'Program fiktif', 'text' => "Baris satu\r\nBaris dua"]], 'budgets' => $budgets];
    }

    private function upload(): string
    {
        return $this->post('/api/v1/staff/site/transparency/document', ['file' => $this->pdf()], ['Accept' => 'application/json'])
            ->assertOk()->assertHeader('Cache-Control', 'no-store, private')->json('path');
    }

    private function structure(): array
    {
        return ['blocks' => [['title' => 'Perangkat fiktif', 'text' => "Baris satu\r\nBaris dua\rBaris tiga"]], 'source' => 'Sumber fiktif'];
    }

    private function image(string $format = 'png', int $width = 600, int $height = 400): UploadedFile
    {
        if (! extension_loaded('gd')) $this->markTestSkipped('php-gd diperlukan untuk tes gambar struktur.');
        if ($format !== 'webp') return UploadedFile::fake()->image('bagan.'.$format, $width, $height);
        if (! function_exists('imagewebp') || ! (imagetypes() & IMG_WEBP)) $this->markTestSkipped('GD tanpa WebP.');
        $image = imagecreatetruecolor($width, $height);
        ob_start();
        imagewebp($image);
        $bytes = ob_get_clean();
        imagedestroy($image);
        return UploadedFile::fake()->createWithContent('bagan.webp', $bytes);
    }

    private function uploadImage(?UploadedFile $file = null)
    {
        return $this->post('/api/v1/staff/site/structure/image', ['file' => $file ?? $this->image()], ['Accept' => 'application/json']);
    }

    public static function imageFormats(): array
    {
        return [['jpg'], ['jpeg'], ['png'], ['webp']];
    }

    #[DataProvider('imageFormats')]
    public function test_structure_upload_reencodes_and_keeps_width_2400(string $format): void
    {
        Storage::fake('public', ['url' => 'https://desa.example/media']);
        $this->act('admin');
        $response = $this->uploadImage($this->image($format, 3000, 1500))->assertOk()->assertHeader('Cache-Control', 'no-store, private');
        $path = $response->json('path');
        $this->assertSame(['path', 'url'], array_keys($response->json()));
        $this->assertMatchesRegularExpression(SiteSectionRules::STRUCTURE_IMAGE_PATH, $path);
        $response->assertJsonPath('url', 'https://desa.example/media/'.$path);
        $webp = function_exists('imagewebp') && (imagetypes() & IMG_WEBP);
        $this->assertSame([2400, 1200, $webp ? IMAGETYPE_WEBP : IMAGETYPE_JPEG], array_slice(getimagesizefromstring(Storage::disk('public')->get($path)), 0, 3));
        $this->assertSame([$path], Storage::disk('public')->allFiles());
        $this->assertDatabaseCount('site_sections', 0);
        $this->assertDatabaseCount('audit_logs', 0);
    }

    public function test_structure_upload_rejects_invalid_files(): void
    {
        Storage::fake('public');
        $this->act();
        $this->postJson('/api/v1/staff/site/structure/image')->assertUnprocessable()->assertJsonValidationErrors('file');
        $png = $this->image();
        foreach ([
            UploadedFile::fake()->createWithContent('palsu.jpg', 'not an image'),
            $this->image('gif'), $this->image()->size(5121),
            $this->image('jpg', 599, 400), $this->image('jpg', 600, 399),
            $this->image('jpg', 6001, 400), $this->image('jpg', 600, 6001),
            UploadedFile::fake()->createWithContent('rusak.jpg', "\xff\xd8\xff\xe0".str_repeat("\0", 100)),
            // PNG header/dimensions survive getimagesize; missing IDAT makes GD decoding fail.
            UploadedFile::fake()->createWithContent('decode.png', substr(file_get_contents($png->getRealPath()), 0, 33)),
        ] as $file) {
            $response = $this->uploadImage($file)->assertUnprocessable()->assertJsonValidationErrors('file');
            if ($file->getClientOriginalName() === 'decode.png') $response->assertJsonPath('errors.file.0', 'Foto tidak dapat dibaca. Pilih JPG, PNG, atau WebP yang valid.');
        }
        $this->assertSame([], Storage::disk('public')->allFiles());
    }

    public function test_structure_upload_accepts_input_bounds_without_upscaling(): void
    {
        Storage::fake('public');
        $this->act();
        foreach ([$this->image('png', 6000, 400)->size(5120), $this->image('jpg', 600, 6000)] as $file) $this->uploadImage($file)->assertOk();
        $path = $this->uploadImage()->assertOk()->json('path');
        $this->assertSame([600, 400], array_slice(getimagesizefromstring(Storage::disk('public')->get($path)), 0, 2));
    }

    public function test_structure_round_trip_and_image_lifecycle_leave_other_keys_unchanged(): void
    {
        Storage::fake('public');
        $user = $this->act();
        $this->putJson('/api/v1/staff/site/profile', ['data' => $this->profile()])->assertOk()->assertJsonMissingPath('image_url');
        $before = SiteSection::find('profile')->getRawOriginal();
        $first = $this->uploadImage()->assertOk()->json('path');
        $data = $this->structure() + ['chartImagePath' => $first, 'chartAlt' => 'Bagan fiktif'];
        $padded = $data;
        foreach (['source', 'chartAlt', 'blocks.0.title', 'blocks.0.text'] as $path) data_set($padded, $path, '  '.data_get($data, $path).'  ');
        $this->putJson('/api/v1/staff/site/structure', ['data' => $padded])->assertOk()->assertJsonPath('data', $data)->assertJsonPath('image_url', Storage::disk('public')->url($first));
        $public = $this->getJson('/api/v1/site/structure')->assertOk()->assertHeader('Cache-Control', 'max-age=60, public')->assertJsonPath('data', $data);
        $this->assertSame(['key', 'data', 'updated_at', 'image_url'], array_keys($public->json()));
        $this->getJson('/api/v1/staff/site/structure')->assertOk()->assertJsonPath('image_url', Storage::disk('public')->url($first));
        $this->assertSame($user->id, SiteSection::find('structure')->updated_by);
        $this->putJson('/api/v1/staff/site/structure', ['data' => $data])->assertOk();
        Storage::disk('public')->assertExists($first);
        $second = $this->uploadImage()->assertOk()->json('path');
        $invalid = array_replace($data, ['chartImagePath' => $second, 'source' => '']);
        $this->putJson('/api/v1/staff/site/structure', ['data' => $invalid])->assertUnprocessable();
        Storage::disk('public')->assertExists([$first, $second]);
        $data['chartImagePath'] = $second;
        $this->putJson('/api/v1/staff/site/structure', ['data' => $data])->assertOk();
        Storage::disk('public')->assertMissing($first);
        Storage::disk('public')->assertExists($second);
        $this->putJson('/api/v1/staff/site/structure', ['data' => array_replace($data, ['chartImagePath' => $first])])->assertUnprocessable()->assertJsonValidationErrors('data.chartImagePath');
        $this->assertSame($data, SiteSection::find('structure')->data);
        $this->putJson('/api/v1/staff/site/structure', ['data' => $this->structure()])->assertOk()->assertJsonPath('image_url', null);
        Storage::disk('public')->assertMissing($second);
        $this->getJson('/api/v1/site/structure')->assertOk()->assertJsonPath('image_url', null)->assertJsonMissingPath('data.chartImagePath');
        $this->assertSame($before, SiteSection::find('profile')->getRawOriginal());
    }

    public function test_structure_validation_bounds_unknown_fields_controls_and_paths(): void
    {
        Storage::fake('public');
        $this->act();
        $path = $this->uploadImage()->assertOk()->json('path');
        $ok = $this->structure() + ['chartImagePath' => $path, 'chartAlt' => 'Bagan fiktif'];
        $bad = [
            'chartImagePath' => [null, '', 'site/structure/x.webp', 'site/structure/00000000-0000-0000-0000-000000000000.webp', '../.env', 'https://desa.example/'.$path, '/'.$path, str_replace('structure/', 'structure/../structure/', $path), str_replace('structure', 'posts', $path), str_replace('.webp', '.png', str_replace('.jpg', '.png', $path))],
            'chartAlt' => [null, '', '   ', str_repeat('é', 301), 1, [], "a\nb", "a\rb"],
            'source' => [null, '', '   ', str_repeat('é', 1001), 1, [], "a\nb"],
            'blocks' => [null, [], 'x', ['named' => ['title' => 'x', 'text' => 'y']], array_fill(0, 21, ['title' => 'x', 'text' => 'y'])],
            'blocks.0' => [null, 'x', ['title' => 'x'], ['text' => 'x']],
            'blocks.0.title' => [null, '', '   ', str_repeat('é', 161), 1, [], "a\nb"],
            'blocks.0.text' => [null, '', '   ', str_repeat('é', 10001), 1, []],
        ];
        foreach ($bad as $field => $values) foreach ($values as $value) {
            $data = $ok;
            data_set($data, $field, $value);
            $response = $this->putJson('/api/v1/staff/site/structure', ['data' => $data])->assertUnprocessable();
            if ($field !== 'blocks.0') $response->assertJsonValidationErrors('data.'.$field);
        }
        foreach (['chartAlt', 'source', 'blocks', 'blocks.0.title', 'blocks.0.text'] as $field) {
            $data = $ok;
            data_forget($data, $field);
            $this->putJson('/api/v1/staff/site/structure', ['data' => $data])->assertUnprocessable()->assertJsonValidationErrors('data.'.$field);
        }
        foreach (['chartImagePath', 'chartAlt', 'source', 'blocks.0.title', 'blocks.0.text'] as $field) foreach (["\0", "\t", "\x7f", "\x1b", "\u{0085}"] as $control) {
            $data = $ok;
            data_set($data, $field, $control.data_get($data, $field));
            $this->putJson('/api/v1/staff/site/structure', ['data' => $data])->assertUnprocessable()->assertJsonValidationErrors('data.'.$field);
        }
        foreach (['unknown', 'blocks.0.unknown'] as $field) {
            $data = $ok;
            data_set($data, $field, true);
            $this->putJson('/api/v1/staff/site/structure', ['data' => $data])->assertUnprocessable();
        }
        $this->putJson('/api/v1/staff/site/structure', ['data' => $ok, 'unknown' => true])->assertUnprocessable();
        $this->assertDatabaseCount('site_sections', 0);
        $this->assertDatabaseCount('audit_logs', 0);
        $max = array_replace($ok, ['chartAlt' => str_repeat('é', 300), 'source' => str_repeat('é', 1000), 'blocks' => array_fill(0, 20, ['title' => str_repeat('é', 160), 'text' => str_repeat('é', 10000)])]);
        $this->putJson('/api/v1/staff/site/structure', ['data' => $max])->assertOk()->assertJsonPath('data', $max);
        unset($ok['chartImagePath']);
        $this->putJson('/api/v1/staff/site/structure', ['data' => $ok])->assertOk();
    }

    public function test_structure_alt_can_be_empty_without_image_but_not_null_or_controls(): void
    {
        $this->act();
        foreach (['', '   ', str_repeat('é', 300)] as $alt) {
            $this->putJson('/api/v1/staff/site/structure', ['data' => $this->structure() + ['chartAlt' => $alt]])
                ->assertOk()->assertJsonPath('data.chartAlt', trim($alt))->assertJsonPath('image_url', null);
        }
        foreach ([null, str_repeat('é', 301), "\t", "\n", "\0", "\x7f"] as $alt) {
            $this->putJson('/api/v1/staff/site/structure', ['data' => $this->structure() + ['chartAlt' => $alt]])
                ->assertUnprocessable()->assertJsonValidationErrors('data.chartAlt');
        }
    }

    public function test_structure_audit_failure_keeps_old_and_uploaded_images_and_data(): void
    {
        Storage::fake('public');
        $this->act();
        $first = $this->uploadImage()->assertOk()->json('path');
        $second = $this->uploadImage()->assertOk()->json('path');
        $data = $this->structure() + ['chartImagePath' => $first, 'chartAlt' => 'Bagan fiktif'];
        $this->putJson('/api/v1/staff/site/structure', ['data' => $data])->assertOk();
        DB::statement('DROP TABLE audit_logs');
        foreach ([$this->structure(), array_replace($data, ['chartImagePath' => $second])] as $replacement) {
            $this->putJson('/api/v1/staff/site/structure', ['data' => $replacement])->assertStatus(500);
            Storage::disk('public')->assertExists([$first, $second]);
            $this->assertSame($data, SiteSection::find('structure')->data);
        }
    }

    public function test_structure_waits_for_image_cleanup_before_validating_reference(): void
    {
        Storage::fake('public');
        $this->act();
        $path = $this->uploadImage()->assertOk()->json('path');
        $process = proc_open([PHP_BINARY, '-r', '
            $lock = fopen($argv[1], "c"); flock($lock, LOCK_EX);
            echo "locked\n"; fflush(STDOUT); usleep(500000);
            unlink($argv[2]); flock($lock, LOCK_UN); fclose($lock);
        ', storage_path('framework/cache/site-structure.lock'), Storage::disk('public')->path($path)],
            [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
        $this->assertIsResource($process);
        try {
            $this->assertSame("locked\n", fgets($pipes[1]));
            $this->putJson('/api/v1/staff/site/structure', ['data' => $this->structure() + ['chartImagePath' => $path, 'chartAlt' => 'Bagan fiktif']])
                ->assertUnprocessable()->assertJsonValidationErrors('data.chartImagePath');
            $this->assertNull(SiteSection::find('structure'));
        } finally {
            foreach ($pipes as $pipe) fclose($pipe);
            $this->assertSame(0, proc_close($process));
        }
    }

    public function test_transparency_round_trip_document_urls_and_file_cleanup(): void
    {
        Storage::fake('public');
        $this->act();
        $first = $this->upload();
        $this->assertMatchesRegularExpression(SiteSectionRules::DOCUMENT_PATH, $first);
        Storage::disk('public')->assertExists($first);
        $data = $this->transparency([$this->budget(2026), $this->budget(2027) + ['documentPath' => $first]]);
        $padded = $data;
        $padded['budgets'][0]['source'] = '  Sumber fiktif  ';
        $this->putJson('/api/v1/staff/site/transparency', ['data' => $padded])->assertOk()->assertJsonPath('data', $data)
            ->assertJsonPath('document_urls', [$first => Storage::disk('public')->url($first)]);
        $public = $this->getJson('/api/v1/site/transparency')->assertOk()->assertHeader('Cache-Control', 'max-age=60, public')->assertJsonPath('data', $data);
        $this->assertSame(['key', 'data', 'updated_at', 'document_urls'], array_keys($public->json()));
        $this->putJson('/api/v1/staff/site/profile', ['data' => $this->text()])->assertOk()->assertJsonMissingPath('document_urls');

        // Ganti dokumen: file lama dihapus, yang baru tetap.
        $second = $this->upload();
        $data['budgets'][1]['documentPath'] = $second;
        $this->putJson('/api/v1/staff/site/transparency', ['data' => $data])->assertOk();
        Storage::disk('public')->assertMissing($first);
        Storage::disk('public')->assertExists($second);
        // Hapus tahun: dokumennya ikut dihapus; anggaran kosong tetap sah dan document_urls jadi objek kosong.
        $this->putJson('/api/v1/staff/site/transparency', ['data' => $this->transparency()])->assertOk();
        Storage::disk('public')->assertMissing($second);
        $this->assertStringContainsString('"document_urls":{}', $this->getJson('/api/v1/site/transparency')->getContent());
        // Validasi gagal tidak menghapus apa pun.
        $third = $this->upload();
        $this->putJson('/api/v1/staff/site/transparency', ['data' => $this->transparency([$this->budget() + ['documentPath' => $third]])])->assertOk();
        $this->putJson('/api/v1/staff/site/transparency', ['data' => $this->transparency([$this->budget(1999)])])->assertUnprocessable();
        Storage::disk('public')->assertExists($third);
        $this->assertSame(5, DB::table('audit_logs')->count());
    }

    public function test_transparency_rejects_totals_unknown_fields_and_bad_values(): void
    {
        Storage::fake('public');
        $this->act();
        $ok = $this->transparency([$this->budget()]);
        $this->putJson('/api/v1/staff/site/transparency', ['data' => $ok])->assertOk();
        // Total selalu dihitung frontend dari rincian; klien tidak boleh mengirimnya.
        foreach (['totalRevenue', 'totalSpending', 'surplus', 'total'] as $field) {
            $data = $ok;
            $data['budgets'][0][$field] = 1;
            $this->putJson('/api/v1/staff/site/transparency', ['data' => $data])->assertUnprocessable()->assertJsonValidationErrors('data.budgets.0');
            $this->putJson('/api/v1/staff/site/transparency', ['data' => $ok + [$field => 1]])->assertUnprocessable()->assertJsonValidationErrors('data');
        }
        $data = $ok;
        $data['budgets'][0]['revenue'][0]['total'] = 1;
        $this->putJson('/api/v1/staff/site/transparency', ['data' => $data])->assertUnprocessable()->assertJsonValidationErrors('data.budgets.0.revenue.0');

        $bad = [
            'intro' => ['', str_repeat('x', 2001), "a\nb", null],
            'programs' => [[], null, array_fill(0, 21, ['title' => 'x', 'text' => 'y']), ['named' => ['title' => 'x', 'text' => 'y']]],
            'programs.0.title' => ['', str_repeat('x', 161), "a\nb"],
            'programs.0.text' => ['', str_repeat('x', 10001), "a\tb"],
            'budgets' => [null, 'x', array_fill(0, 6, $this->budget()), ['named' => $this->budget()]],
            'budgets.0.year' => [1999, 2100, '2027', 2027.5, null],
            'budgets.0.status' => ['ditetapkan', 'Final', '', null],
            'budgets.0.revenue' => [[], null, array_fill(0, 21, ['label' => 'x', 'amount' => 1])],
            'budgets.0.revenue.0.label' => ['', str_repeat('x', 161), "a\0"],
            'budgets.0.revenue.0.amount' => [-1, 100000000001, '1000', 1.5, null, true],
            'budgets.0.spending' => [[], array_slice($this->budget()['spending'], 0, 4), [...$this->budget()['spending'], ['label' => 'x', 'amount' => 1]], array_reverse($this->budget()['spending'])],
            'budgets.0.spending.0.label' => ['Bidang lain', '', 'pelaksanaan pembangunan'],
            'budgets.0.spending.4.amount' => [-1, '5'],
            'budgets.0.financing' => [null, 'x', array_fill(0, 11, ['label' => 'x', 'amount' => 1])],
            'budgets.0.financing.0.amount' => [-5, '5'],
            'budgets.0.source' => ['', str_repeat('x', 1001), null],
            'budgets.0.documentPath' => ['', 'site/documents/x.pdf', '../.env', 'site/documents/00000000-0000-0000-0000-000000000000.pdf', 'https://evil.test/a.pdf', null],
        ];
        foreach ($bad as $path => $values) {
            foreach ($values as $value) {
                $data = $ok;
                data_set($data, $path, $value);
                $this->assertSame(422, $this->putJson('/api/v1/staff/site/transparency', ['data' => $data])->status(), $path.' '.json_encode($value));
            }
        }
        $data = $this->transparency([$this->budget(), $this->budget()]);
        $this->putJson('/api/v1/staff/site/transparency', ['data' => $data])->assertUnprocessable()->assertJsonValidationErrors('data.budgets.0.year');
        foreach (['intro', 'programs', 'budgets'] as $field) {
            $data = $ok;
            unset($data[$field]);
            $this->putJson('/api/v1/staff/site/transparency', ['data' => $data])->assertUnprocessable()->assertJsonValidationErrors('data.'.$field);
        }
        // Batas atas sah: 5 tahun, jumlah 100 miliar, pembiayaan boleh tidak ada.
        $max = $this->budget();
        $max['revenue'][0]['amount'] = 100000000000;
        unset($max['financing']);
        $this->putJson('/api/v1/staff/site/transparency', ['data' => $this->transparency(array_map(fn ($year) => ['year' => $year] + $max, range(2025, 2029)))])->assertOk();
    }

    public function test_transparency_waits_for_document_cleanup_before_validating_reference(): void
    {
        Storage::fake('public');
        $this->act();
        $path = $this->upload();
        // Simulasikan PUT lain yang sudah commit dan masih memegang lock saat membersihkan PDF.
        $process = proc_open([PHP_BINARY, '-r', '
            $lock = fopen($argv[1], "c");
            flock($lock, LOCK_EX);
            echo "locked\n"; fflush(STDOUT);
            usleep(500000);
            unlink($argv[2]);
            flock($lock, LOCK_UN); fclose($lock);
        ', storage_path('framework/cache/site-transparency.lock'), Storage::disk('public')->path($path)],
            [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
        $this->assertIsResource($process);
        try {
            $this->assertSame("locked\n", fgets($pipes[1]));
            $this->putJson('/api/v1/staff/site/transparency', ['data' => $this->transparency([$this->budget() + ['documentPath' => $path]])])
                ->assertUnprocessable()->assertJsonValidationErrors('data.budgets.0.documentPath');
            $this->assertNull(SiteSection::find('transparency'));
        } finally {
            foreach ($pipes as $pipe) fclose($pipe);
            $this->assertSame(0, proc_close($process));
        }
    }

    public function test_transparency_audit_failure_keeps_old_document_and_data(): void
    {
        Storage::fake('public');
        $this->act();
        $path = $this->upload();
        $data = $this->transparency([$this->budget() + ['documentPath' => $path]]);
        $this->putJson('/api/v1/staff/site/transparency', ['data' => $data])->assertOk();
        DB::statement('DROP TABLE audit_logs');
        $this->putJson('/api/v1/staff/site/transparency', ['data' => $this->transparency()])->assertStatus(500);
        Storage::disk('public')->assertExists($path);
        $this->assertSame($data, SiteSection::find('transparency')->data);
    }

    public function test_transparency_document_upload_rejects_non_pdf_large_and_other_keys(): void
    {
        Storage::fake('public');
        $this->act('admin');
        $post = fn (string $key, $file) => $this->post('/api/v1/staff/site/'.$key.'/document', ['file' => $file], ['Accept' => 'application/json']);
        $post('transparency', UploadedFile::fake()->createWithContent('palsu.pdf', 'bukan pdf'))->assertUnprocessable()->assertJsonValidationErrors('file');
        $post('transparency', UploadedFile::fake()->image('foto.png'))->assertUnprocessable()->assertJsonValidationErrors('file');
        $post('transparency', UploadedFile::fake()->createWithContent('besar.pdf', '%PDF-'.str_repeat('0', 10240 * 1024)))->assertUnprocessable()->assertJsonValidationErrors('file');
        $post('transparency', UploadedFile::fake()->createWithContent('pas.pdf', '%PDF-'.str_repeat('0', 10240 * 1024 - 5)))->assertOk();
        Storage::disk('public')->deleteDirectory('site');
        $this->postJson('/api/v1/staff/site/transparency/document', [])->assertUnprocessable()->assertJsonValidationErrors('file');
        foreach (['profile', 'statistics'] as $key) $post($key, $this->pdf())->assertUnprocessable()->assertJsonValidationErrors('file');
        $post('unknown', $this->pdf())->assertNotFound();
        $this->assertSame([], Storage::disk('public')->allFiles());
        $path = $post('transparency', $this->pdf())->assertOk()->json('path');
        $this->assertSame([$path], Storage::disk('public')->allFiles());
        $this->assertDatabaseCount('audit_logs', 0);
    }

    public function test_public_missing_and_unknown_keys_are_404_without_audit(): void
    {
        foreach (SectionKey::cases() as $key) $this->getJson('/api/v1/site/'.$key->value)->assertNotFound();
        foreach (['unknown', 'vision', 'visi-misi'] as $key) $this->getJson('/api/v1/site/'.$key)->assertNotFound();
        $this->assertDatabaseCount('audit_logs', 0);
    }

    public function test_staff_endpoints_require_token_even_with_invalid_key(): void
    {
        $this->getJson('/api/v1/staff/site/profile')->assertUnauthorized()->assertHeader('Cache-Control', 'no-store, private');
        $this->putJson('/api/v1/staff/site/profile', ['data' => $this->text()])->assertUnauthorized();
        $this->postJson('/api/v1/staff/site/profile/image')->assertUnauthorized();
        $this->getJson('/api/v1/staff/site/structure')->assertUnauthorized();
        $this->putJson('/api/v1/staff/site/structure', ['data' => $this->structure()])->assertUnauthorized();
        $this->postJson('/api/v1/staff/site/structure/image')->assertUnauthorized()->assertHeader('Cache-Control', 'no-store, private');
        $this->postJson('/api/v1/staff/site/transparency/document')->assertUnauthorized()->assertHeader('Cache-Control', 'no-store, private');
        $this->getJson('/api/v1/staff/site/unknown')->assertUnauthorized();
    }

    public static function roles(): array
    {
        return [['village_head'], ['rt_head'], ['rw_head'], ['resident']];
    }

    #[DataProvider('roles')]
    public function test_wrong_roles_cannot_read_write_or_upload(string $role): void
    {
        config(['letters.neighborhood_approval' => true]);
        $this->act($role);
        Storage::fake('public');
        foreach (['profile', 'transparency', 'structure', 'unknown'] as $key) {
            $this->getJson('/api/v1/staff/site/'.$key)->assertForbidden();
            $this->putJson('/api/v1/staff/site/'.$key, ['data' => $this->text()])->assertForbidden();
            $this->postJson('/api/v1/staff/site/'.$key.'/image')->assertForbidden();
            $this->post('/api/v1/staff/site/'.$key.'/document', ['file' => $this->pdf()], ['Accept' => 'application/json'])->assertForbidden();
        }
        $this->assertSame([], Storage::disk('public')->allFiles());
        $this->assertDatabaseCount('site_sections', 0);
        $this->assertDatabaseCount('audit_logs', 0);
    }

    public function test_inactive_account_and_wrong_ability_are_forbidden(): void
    {
        $this->act()->forceFill(['is_active' => false])->save();
        $this->getJson('/api/v1/staff/site/profile')->assertForbidden();
        $this->putJson('/api/v1/staff/site/profile', [])->assertForbidden();
        $this->postJson('/api/v1/staff/site/profile/image')->assertForbidden();
        $this->putJson('/api/v1/staff/site/structure', ['data' => $this->structure()])->assertForbidden();
        $this->postJson('/api/v1/staff/site/structure/image')->assertForbidden();
        $this->postJson('/api/v1/staff/site/transparency/document')->assertForbidden();
        $this->act('admin', ['other']);
        $this->getJson('/api/v1/staff/site/profile')->assertForbidden();
        $this->putJson('/api/v1/staff/site/profile', [])->assertForbidden();
        $this->postJson('/api/v1/staff/site/profile/image')->assertForbidden();
        $this->putJson('/api/v1/staff/site/structure', ['data' => $this->structure()])->assertForbidden();
        $this->postJson('/api/v1/staff/site/structure/image')->assertForbidden();
        $this->postJson('/api/v1/staff/site/transparency/document')->assertForbidden();
    }

    public function test_staff_admin_whole_object_replacement_and_public_safe_response(): void
    {
        $this->freezeSecond();
        $staff = $this->act();
        $this->getJson('/api/v1/staff/site/profile')->assertNotFound();
        foreach (['profile', 'history', 'contact'] as $key) {
            $data = $key === 'contact' ? $this->contact() : $this->text();
            $data[array_key_first($data)] = '  '.$data[array_key_first($data)].'  ';
            $saved = $this->putJson('/api/v1/staff/site/'.$key, ['data' => $data])->assertOk()
                ->assertHeader('Cache-Control', 'no-store, private')->json('data');
            $this->assertSame(trim($data[array_key_first($data)]), $saved[array_key_first($data)]);
            $response = $this->getJson('/api/v1/site/'.$key)->assertOk()->assertHeader('Cache-Control', 'max-age=60, public');
            $this->assertSame(['key', 'data', 'updated_at'], array_keys($response->json()));
            $this->assertSame($saved, $this->getJson('/api/v1/staff/site/'.$key)->assertOk()->json('data'));
            $this->assertSame($staff->id, SiteSection::find($key)->updated_by);
        }
        $admin = $this->act('admin');
        $replacement = ['intro' => '<script>fiktif</script>', 'blocks' => [['title' => 'Baru', 'text' => 'Teks baru']]];
        $this->putJson('/api/v1/staff/site/profile', ['data' => $replacement])->assertOk()->assertJsonPath('data', $replacement);
        $this->assertSame($admin->id, SiteSection::find('profile')->updated_by);
        $this->assertDatabaseCount('site_sections', 3);
        $this->assertDatabaseCount('audit_logs', 4);
        $audit = (array) DB::table('audit_logs')->latest('id')->first();
        $this->assertSame(['id', 'user_id', 'action', 'subject_type', 'subject_id', 'created_at'], array_keys($audit));
        $this->assertSame('site.updated', $audit['action']);
        $this->assertSame('site_section', $audit['subject_type']);
        $this->assertSame('profile', $audit['subject_id']);
        $this->assertStringNotContainsString('fiktif', json_encode(DB::table('audit_logs')->get()));
    }

    public function test_profile_history_validation_and_no_silent_unknown_fields(): void
    {
        $this->act();
        $cases = [
            [], ['intro' => 'x'], ['intro' => '', 'blocks' => []],
            ['intro' => str_repeat('x', 2001), 'blocks' => $this->text()['blocks']],
            ['intro' => 'x', 'blocks' => array_fill(0, 21, ['title' => 'x', 'text' => 'y'])],
            ['intro' => 'x', 'blocks' => ['named' => ['title' => 'x', 'text' => 'y']]],
            ['intro' => 'x', 'blocks' => [['title' => str_repeat('x', 161), 'text' => 'y']]],
            ['intro' => 'x', 'blocks' => [['title' => 'x', 'text' => str_repeat('x', 10001)]]],
            ['intro' => 'x', 'blocks' => [['title' => 'x', 'text' => 'y', 'nik' => '0000000000000001']]],
            $this->text() + ['updated_by' => 1],
        ];
        foreach (['profile', 'history'] as $key) {
            foreach ($cases as $data) $this->putJson('/api/v1/staff/site/'.$key, ['data' => $data])->assertUnprocessable();
            foreach (["\0abc", "abc\x7f", "abc\t", "abc\x1b", "abc\n"] as $bad) {
                $this->putJson('/api/v1/staff/site/'.$key, ['data' => array_replace($this->text(), ['intro' => $bad])])->assertUnprocessable();
            }
            $data = $this->text();
            $data['blocks'][0]['text'] = "abc\t";
            $this->putJson('/api/v1/staff/site/'.$key, ['data' => $data])->assertUnprocessable();
            $this->putJson('/api/v1/staff/site/'.$key, ['data' => $this->text(), 'extra' => true])->assertUnprocessable();
            $this->putJson('/api/v1/staff/site/'.$key, ['data' => null])->assertUnprocessable();
        }
        $this->assertDatabaseCount('site_sections', 0);
        $this->assertDatabaseCount('audit_logs', 0);
    }

    public function test_profile_details_round_trip_trim_empty_lists_and_legacy_replacement(): void
    {
        $this->act();
        $data = $this->profile();
        $padded = $data;
        foreach (array_keys(self::profileTextLimits()) as $path) data_set($padded, $path, '  '.data_get($data, $path).'  ');
        $this->putJson('/api/v1/staff/site/profile', ['data' => $padded])->assertOk()->assertJsonPath('data', $data);
        $this->getJson('/api/v1/site/profile')->assertOk()->assertJsonPath('data', $data)->assertHeader('Cache-Control', 'max-age=60, public');
        $this->getJson('/api/v1/staff/site/profile')->assertOk()->assertJsonPath('data', $data);
        foreach (['themes', 'stats', 'institutions'] as $field) $data['profileDetails'][$field] = [];
        $this->putJson('/api/v1/staff/site/profile', ['data' => $data])->assertOk()->assertJsonPath('data', $data);
        $data = $this->profile();
        unset($data['profileDetails']['stats'][0]['detail']);
        $this->putJson('/api/v1/staff/site/profile', ['data' => $data])->assertOk()->assertJsonPath('data', $data);
        $this->putJson('/api/v1/staff/site/profile', ['data' => $this->text()])->assertOk()->assertJsonPath('data', $this->text());
        $this->getJson('/api/v1/site/profile')->assertOk()->assertJsonMissingPath('data.profileDetails');
        $this->putJson('/api/v1/staff/site/history', ['data' => $this->profile()])->assertUnprocessable()->assertJsonValidationErrors('data');
    }

    public static function profileTextLimits(): array
    {
        return [
            'profileDetails.themes.0' => 160,
            'profileDetails.stats.0.value' => 160,
            'profileDetails.stats.0.label' => 160,
            'profileDetails.stats.0.detail' => 1000,
            'profileDetails.location' => 1000,
            'profileDetails.boundaries.0.place' => 1000,
            'profileDetails.institutions.0.name' => 160,
            'profileDetails.institutions.0.description' => 2000,
            'profileDetails.source' => 1000,
        ];
    }

    public function test_profile_details_text_max_lengths_types_and_controls_before_trim(): void
    {
        $this->act();
        foreach (self::profileTextLimits() as $path => $max) {
            $data = $this->profile();
            data_set($data, $path, str_repeat('é', $max));
            $this->putJson('/api/v1/staff/site/profile', ['data' => $data])->assertOk();
            foreach ([str_repeat('é', $max + 1), '', '   ', null, 1, true, [], ['x'], "\0text", "text\t", "text\x7f", "text\x1b", "text\n", "\rtext", "text\u{0085}"] as $bad) {
                data_set($data, $path, $bad);
                $this->putJson('/api/v1/staff/site/profile', ['data' => $data])->assertUnprocessable()->assertJsonValidationErrors('data.'.$path);
            }
            unset($data);
            $data = $this->profile();
            data_forget($data, $path);
            $response = $this->putJson('/api/v1/staff/site/profile', ['data' => $data]);
            if (in_array($path, ['profileDetails.stats.0.detail', 'profileDetails.themes.0'], true)) $response->assertOk();
            else $response->assertUnprocessable()->assertJsonValidationErrors('data.'.$path);
        }
        $data = $this->profile();
        $data['blocks'][0]['text'] = "Baris satu\r\nBaris dua\rBaris tiga";
        $this->putJson('/api/v1/staff/site/profile', ['data' => $data])->assertOk()->assertJsonPath('data.blocks.0.text', $data['blocks'][0]['text']);
    }

    public function test_profile_details_counts_shapes_required_fields_and_unknown_fields(): void
    {
        $this->act();
        foreach (['themes' => 6, 'stats' => 6, 'institutions' => 20] as $field => $max) {
            $data = $this->profile();
            $row = $data['profileDetails'][$field][0];
            $data['profileDetails'][$field] = array_fill(0, $max, $row);
            $this->putJson('/api/v1/staff/site/profile', ['data' => $data])->assertOk();
            $data['profileDetails'][$field][] = $row;
            $this->putJson('/api/v1/staff/site/profile', ['data' => $data])->assertUnprocessable()->assertJsonValidationErrors('data.profileDetails.'.$field);
        }
        $paths = ['profileDetails', 'profileDetails.themes', 'profileDetails.stats', 'profileDetails.boundaries', 'profileDetails.institutions'];
        foreach ($paths as $path) {
            foreach ([null, 'text', 1, true, ['named' => 'value']] as $bad) {
                $data = $this->profile();
                data_set($data, $path, $bad);
                $this->putJson('/api/v1/staff/site/profile', ['data' => $data])->assertUnprocessable()->assertJsonValidationErrors('data.'.$path);
            }
            $data = $this->profile();
            data_forget($data, $path);
            $response = $this->putJson('/api/v1/staff/site/profile', ['data' => $data]);
            if ($path === 'profileDetails') $response->assertOk();
            else $response->assertUnprocessable()->assertJsonValidationErrors('data.'.$path);
        }
        foreach (['profileDetails.stats.0', 'profileDetails.boundaries.0', 'profileDetails.institutions.0'] as $path) {
            foreach ([null, 'text', 1, true, [], ['unknown' => 'value']] as $bad) {
                $data = $this->profile();
                data_set($data, $path, $bad);
                $this->putJson('/api/v1/staff/site/profile', ['data' => $data])->assertUnprocessable();
            }
        }
        foreach (['', 'profileDetails', 'profileDetails.stats.0', 'profileDetails.boundaries.0', 'profileDetails.institutions.0'] as $path) {
            $data = $this->profile();
            data_set($data, ($path === '' ? '' : $path.'.').'unknown', 'value');
            $this->putJson('/api/v1/staff/site/profile', ['data' => $data])->assertUnprocessable()->assertJsonValidationErrors($path === '' ? 'data' : 'data.'.$path);
        }
        $this->putJson('/api/v1/staff/site/profile', ['data' => $this->profile(), 'unknown' => 'value'])->assertUnprocessable()->assertJsonValidationErrors('data');
    }

    public function test_profile_boundaries_require_exact_order_and_only_places_can_change(): void
    {
        $this->act();
        foreach (['Utara', 'Timur', 'Selatan', 'Barat'] as $index => $direction) {
            $path = 'profileDetails.boundaries.'.$index.'.direction';
            foreach ([...array_diff(['Utara', 'Timur', 'Selatan', 'Barat'], [$direction]), null, '', strtolower($direction), 'Tidak dikenal', 'Utara,Timur', 1, true, [], "\t$direction", "$direction\n", "$direction\r", "$direction\0", "$direction\x7f"] as $bad) {
                $data = $this->profile();
                data_set($data, $path, $bad);
                $this->putJson('/api/v1/staff/site/profile', ['data' => $data])->assertUnprocessable()->assertJsonValidationErrors('data.'.$path);
            }
            $data = $this->profile();
            data_forget($data, $path);
            $this->putJson('/api/v1/staff/site/profile', ['data' => $data])->assertUnprocessable()->assertJsonValidationErrors('data.'.$path);
            $data = $this->profile();
            $data['profileDetails']['boundaries'][$index]['place'] = str_repeat('x', 1000);
            $this->putJson('/api/v1/staff/site/profile', ['data' => $data])->assertOk();
        }
        $original = $this->profile()['profileDetails']['boundaries'];
        foreach ([[], array_slice($original, 0, 3), [...$original, $original[0]], array_reverse($original), array_fill(0, 4, $original[0]), ['named' => $original[0]]] as $boundaries) {
            $data = $this->profile();
            $data['profileDetails']['boundaries'] = $boundaries;
            $this->putJson('/api/v1/staff/site/profile', ['data' => $data])->assertUnprocessable();
        }
    }

    public function test_contact_validates_all_fields_phone_and_google_maps_urls(): void
    {
        $this->act();
        foreach (array_keys($this->contact()) as $field) {
            $data = $this->contact();
            unset($data[$field]);
            $this->putJson('/api/v1/staff/site/contact', ['data' => $data])->assertUnprocessable();
        }
        $bad = [
            ['address' => str_repeat('x', 1001)], ['hours' => str_repeat('x', 201)], ['contactName' => str_repeat('x', 161)],
            ['phone' => '+620000000000'], ['phone' => "62000\n"], ['phone' => '6200000000000000'],
            ['mapsEmbedUrl' => 'https://www.google.com.evil.test/maps/embed?x=1'],
            ['mapsEmbedUrl' => 'javascript:alert(1)'], ['mapsEmbedUrl' => str_repeat('x', 2049)],
            ['mapsEmbedUrl' => []], ['mapsLinkUrl' => null],
            ['mapsLinkUrl' => 'https://maps.app.goo.gl.evil.test/x'], ['mapsLinkUrl' => '//www.google.com/maps/'],
            ['address' => "\0Alamat"], ['nik' => '0000000000000001'],
        ];
        foreach ($bad as $override) $this->putJson('/api/v1/staff/site/contact', ['data' => array_replace($this->contact(), $override)])->assertUnprocessable();
        foreach (['', '[PLACEHOLDER]', '620000000000'] as $phone) {
            $this->putJson('/api/v1/staff/site/contact', ['data' => array_replace($this->contact(), ['phone' => $phone])])->assertOk();
        }
        $valid = array_replace($this->contact(), ['mapsEmbedUrl' => 'https://www.google.com/maps/embed?pb=fiktif', 'mapsLinkUrl' => 'https://maps.app.goo.gl/fiktif']);
        $this->putJson('/api/v1/staff/site/contact', ['data' => $valid])->assertOk();
        $valid['mapsLinkUrl'] = 'https://www.google.com/maps/?q=fiktif';
        $this->putJson('/api/v1/staff/site/contact', ['data' => $valid])->assertOk();
    }

    public function test_contact_panel_flow_trims_publishes_and_leaves_other_keys_untouched(): void
    {
        $this->act();
        $this->putJson('/api/v1/staff/site/profile', ['data' => $this->profile()])->assertOk();
        $profile = SiteSection::find('profile')->data;
        $data = array_replace($this->contact(), ['phone' => ' 620000000000 ', 'mapsEmbedUrl' => ' https://www.google.com/maps/embed?pb=fiktif ']);
        $this->putJson('/api/v1/staff/site/contact', ['data' => $data])->assertOk()
            ->assertJsonPath('data.phone', '620000000000')->assertJsonPath('data.mapsEmbedUrl', 'https://www.google.com/maps/embed?pb=fiktif');
        $this->getJson('/api/v1/site/contact')->assertOk()->assertJsonPath('data.phone', '620000000000')->assertJsonPath('key', 'contact');
        $this->assertSame($profile, SiteSection::find('profile')->data);
        $this->assertNull(SiteSection::find('history'));
        // Panel memetakan errors.data.<field> ke input; tab di nomor dan HTML iframe ditolak per field.
        $this->putJson('/api/v1/staff/site/contact', ['data' => array_replace($this->contact(), ['phone' => "62\t0"])])
            ->assertUnprocessable()->assertJsonValidationErrors('data.phone');
        $this->putJson('/api/v1/staff/site/contact', ['data' => array_replace($this->contact(), ['mapsEmbedUrl' => '<iframe src="https://www.google.com/maps/embed?pb=x"></iframe>'])])
            ->assertUnprocessable()->assertJsonValidationErrors('data.mapsEmbedUrl');
        $this->putJson('/api/v1/staff/site/contact', ['data' => array_replace($this->contact(), ['phone' => '081234'])])
            ->assertUnprocessable()->assertJsonValidationErrors('data.phone');
        $this->assertSame('620000000000', SiteSection::find('contact')->data['phone']);
    }

    public function test_reserved_keys_reject_every_payload_and_unknown_keys_are_404(): void
    {
        $this->act();
        foreach ([[], ['data' => []], ['data' => (object) []], ['data' => ['x' => 'y']]] as $payload) {
            $this->putJson('/api/v1/staff/site/statistics', $payload)->assertUnprocessable()->assertJsonValidationErrors('data');
        }
        $this->getJson('/api/v1/staff/site/unknown')->assertNotFound();
        $this->putJson('/api/v1/staff/site/unknown', [])->assertNotFound();
        $this->postJson('/api/v1/staff/site/unknown/image')->assertNotFound();
        $this->assertDatabaseCount('site_sections', 0);
    }

    public function test_images_disabled_except_structure_without_storing_originals(): void
    {
        Storage::fake('public');
        $this->act();
        foreach (SectionKey::cases() as $key) {
            $this->assertSame($key === SectionKey::Structure, $key->allowsImages());
            if ($key === SectionKey::Structure) continue;
            $this->post('/api/v1/staff/site/'.$key->value.'/image', ['file' => UploadedFile::fake()->create('fiktif.jpg', 10, 'image/jpeg')], ['Accept' => 'application/json'])
                ->assertUnprocessable()->assertJsonValidationErrors('file')->assertHeader('Cache-Control', 'no-store, private');
        }
        $this->assertSame([], Storage::disk('public')->allFiles());
        $this->assertDatabaseCount('audit_logs', 0);
    }

    public function test_import_is_valid_idempotent_and_preserves_existing_even_empty_data(): void
    {
        foreach (SiteSectionDefaults::data() as $key => $data) $this->assertSame($data, SiteSectionRules::validate(SectionKey::from($key), ['data' => $data]));
        SiteSection::create(['key' => 'profile', 'data' => []]);
        $this->artisan('site:import-defaults')->expectsOutput('Dibuat: 4. Dipertahankan: 1.')->assertSuccessful();
        $this->assertSame([], SiteSection::find('profile')->data);
        $this->artisan('site:import-defaults')->expectsOutput('Dibuat: 0. Dipertahankan: 5.')->assertSuccessful();
        $this->assertDatabaseCount('audit_logs', 4);
        $this->assertDatabaseCount('site_sections', 5);
        foreach (['contact', 'history', 'transparency', 'structure'] as $key) $this->assertSame(SiteSectionDefaults::data()[$key], SiteSection::find($key)->data);
        $this->getJson('/api/v1/site/history')->assertOk();
    }

    public function test_import_structure_public_read_and_repeat_preserves_edits(): void
    {
        $this->artisan('site:import-defaults')->expectsOutput('Dibuat: 5. Dipertahankan: 0.')->assertSuccessful();
        $defaults = SiteSectionDefaults::data()['structure'];
        $this->assertSame(['blocks', 'source'], array_keys($defaults));
        $this->assertSame(['Kepala Desa', 'Sekretariat Desa', 'Pelaksana Teknis', 'Pelaksana Kewilayahan', 'Badan Permusyawaratan Desa'], array_column($defaults['blocks'], 'title'));
        $this->assertSame('Sumber: RKP Desa Watuagung 2027', $defaults['source']);
        $this->getJson('/api/v1/site/structure')->assertOk()->assertJsonPath('data', $defaults)->assertJsonPath('image_url', null);
        $this->act();
        $this->putJson('/api/v1/staff/site/structure', ['data' => $this->structure()])->assertOk();
        $before = SiteSection::find('structure')->getRawOriginal();
        $this->artisan('site:import-defaults')->expectsOutput('Dibuat: 0. Dipertahankan: 5.')->assertSuccessful();
        $this->assertSame($before, SiteSection::find('structure')->getRawOriginal());
        $this->assertDatabaseCount('audit_logs', 6);
    }

    public function test_import_profile_details_public_read_and_repeat_preserves_edited_details(): void
    {
        $this->artisan('site:import-defaults')->expectsOutput('Dibuat: 5. Dipertahankan: 0.')->assertSuccessful();
        $defaults = SiteSectionDefaults::data()['profile'];
        $this->assertSame($defaults, SiteSection::find('profile')->data);
        $this->assertSame(['Utara', 'Timur', 'Selatan', 'Barat'], array_column($defaults['profileDetails']['boundaries'], 'direction'));
        $this->assertCount(10, $defaults['profileDetails']['institutions']);
        $this->assertSame('Sumber: RKP Desa Watuagung 2027', $defaults['profileDetails']['source']);
        $this->assertStringNotContainsString('±11 km', $defaults['blocks'][1]['text']);
        $this->getJson('/api/v1/site/profile')->assertOk()->assertJsonPath('data', $defaults);
        $this->act();
        $edited = $this->profile();
        $this->putJson('/api/v1/staff/site/profile', ['data' => $edited])->assertOk();
        $before = SiteSection::find('profile')->getRawOriginal();
        $this->artisan('site:import-defaults')->expectsOutput('Dibuat: 0. Dipertahankan: 5.')->assertSuccessful();
        $this->assertSame($before, SiteSection::find('profile')->getRawOriginal());
        $this->getJson('/api/v1/site/profile')->assertOk()->assertJsonPath('data', $edited);
        $this->assertDatabaseCount('audit_logs', 6);
    }

    public function test_audit_failure_rolls_back_create_and_replace(): void
    {
        $this->act();
        SiteSection::create(['key' => 'profile', 'data' => $this->text()]);
        DB::statement('DROP TABLE audit_logs');
        $this->putJson('/api/v1/staff/site/history', ['data' => $this->text()])->assertStatus(500);
        $this->putJson('/api/v1/staff/site/profile', ['data' => ['intro' => 'Nanti', 'blocks' => $this->text()['blocks']]])->assertStatus(500);
        $this->assertNull(SiteSection::find('history'));
        $this->assertSame($this->text(), SiteSection::find('profile')->data);
    }

    public function test_updated_by_null_on_delete_and_key_unique(): void
    {
        $user = User::factory()->create();
        SiteSection::create(['key' => 'profile', 'data' => $this->text(), 'updated_by' => $user->id]);
        $user->delete();
        $this->assertNull(SiteSection::find('profile')->updated_by);
        $this->expectException(\Illuminate\Database\QueryException::class);
        SiteSection::create(['key' => 'profile', 'data' => $this->text()]);
    }

    private function videos(?string $profileUrl = 'https://www.youtube.com/watch?v=AbCdEfGh_1-', ?string $tutorialUrl = null): array
    {
        $video = fn (?string $url, string $title) => $url === null ? null : ['url' => $url, 'title' => $title];
        return ['profile' => $video($profileUrl, 'Video profil fiktif'), 'tutorial' => $video($tutorialUrl, 'Tutorial fiktif')];
    }

    public function test_videos_extract_id_store_only_id_and_publish_without_touching_other_keys(): void
    {
        $this->freezeSecond();
        $staff = $this->act();
        $this->putJson('/api/v1/staff/site/contact', ['data' => $this->contact()])->assertOk();
        $contact = SiteSection::find('contact')->data;
        $this->getJson('/api/v1/staff/site/videos')->assertNotFound();
        $this->getJson('/api/v1/site/videos')->assertNotFound();
        $data = $this->videos('  https://youtu.be/AbCdEfGh_1-?si=fiktif  ', 'https://www.youtube.com/shorts/ZyXwVuT_9-8');
        $data['tutorial']['title'] = '  Tutorial fiktif  ';
        $expected = ['profile' => ['youtubeId' => 'AbCdEfGh_1-', 'title' => 'Video profil fiktif'], 'tutorial' => ['youtubeId' => 'ZyXwVuT_9-8', 'title' => 'Tutorial fiktif']];
        $this->putJson('/api/v1/staff/site/videos', ['data' => $data])->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')->assertJsonPath('data', $expected);
        $this->assertSame($expected, SiteSection::find('videos')->data);
        $this->assertSame($staff->id, SiteSection::find('videos')->updated_by);
        $public = $this->getJson('/api/v1/site/videos')->assertOk()->assertHeader('Cache-Control', 'max-age=60, public');
        $this->assertSame(['key', 'data', 'updated_at'], array_keys($public->json()));
        $this->assertSame($expected, $public->json('data'));
        $this->assertStringNotContainsString('youtu.be', $public->getContent());
        $this->assertSame($expected, $this->getJson('/api/v1/staff/site/videos')->assertOk()->json('data'));
        // Hapus video = null; admin juga boleh.
        $this->act('admin');
        $this->putJson('/api/v1/staff/site/videos', ['data' => $this->videos(null, null)])->assertOk()
            ->assertJsonPath('data', ['profile' => null, 'tutorial' => null]);
        $this->assertSame($contact, SiteSection::find('contact')->data);
        $this->assertNull(SiteSection::find('profile'));
        $audit = DB::table('audit_logs')->where('subject_id', 'videos')->get();
        $this->assertCount(2, $audit);
        $this->assertStringNotContainsString('fiktif', json_encode(DB::table('audit_logs')->get()));
    }

    public function test_videos_accept_only_youtube_url_forms(): void
    {
        $this->act();
        $id = 'AbCdEfGh_1-';
        foreach ([
            "https://www.youtube.com/watch?v=$id", "https://youtube.com/watch?v=$id&t=42s", "https://m.youtube.com/watch?feature=share&v=$id",
            "http://www.youtube.com/watch/?v=$id", "HTTPS://WWW.YOUTUBE.COM/watch?v=$id", "https://youtu.be/$id", "https://youtu.be/$id/",
            "https://www.youtube.com/shorts/$id?feature=share", "https://youtube.com/embed/$id?start=10", "https://www.youtube.com/embed/$id#x",
        ] as $url) {
            $this->putJson('/api/v1/staff/site/videos', ['data' => $this->videos($url)])->assertOk()->assertJsonPath('data.profile.youtubeId', $id);
        }
        foreach ([
            $id, "www.youtube.com/watch?v=$id", "ftp://youtu.be/$id", "javascript:alert('$id')", "https://www.youtube-nocookie.com/embed/$id",
            "https://youtube.com.evil.test/watch?v=$id", "https://evil.test/?u=https://youtu.be/$id", "https://user@youtu.be/$id",
            "https://youtu.be:8443/$id", "https://www.youtube.com/watch?v=AbCdEfGh_1", "https://www.youtube.com/watch?v={$id}x",
            "https://www.youtube.com/watch?v[]=$id", "https://www.youtube.com/watch?list=$id", "https://www.youtube.com/channel/$id",
            "https://youtu.be/$id/extra", "https://www.youtube.com/shorts/", "https://youtu.be/AbCdEfGh!1-",
            '<iframe src="https://www.youtube.com/embed/'.$id.'"></iframe>', 'https://www.youtube.com/watch?v='.$id.str_repeat('&x=1', 600), '',
        ] as $url) {
            $this->putJson('/api/v1/staff/site/videos', ['data' => $this->videos($url)])->assertUnprocessable()
                ->assertJsonValidationErrors('data.profile.url')->assertJsonMissingValidationErrors('data.tutorial');
        }
        $this->assertSame('AbCdEfGh_1-', SiteSection::find('videos')->data['profile']['youtubeId']);
    }

    public function test_videos_reject_shape_unknown_fields_lengths_and_controls(): void
    {
        $this->act();
        $valid = $this->videos();
        foreach ([
            [], ['profile' => $valid['profile']], ['tutorial' => null], $valid + ['extra' => null],
            ['profile' => 'https://youtu.be/AbCdEfGh_1-', 'tutorial' => null],
            ['profile' => [], 'tutorial' => null],
            ['profile' => ['url' => 'https://youtu.be/AbCdEfGh_1-'], 'tutorial' => null],
            ['profile' => $valid['profile'] + ['youtubeId' => 'AbCdEfGh_1-'], 'tutorial' => null],
            ['profile' => ['youtubeId' => 'AbCdEfGh_1-', 'title' => 'Judul'], 'tutorial' => null],
            ['profile' => ['url' => 'https://youtu.be/AbCdEfGh_1-', 'title' => ''], 'tutorial' => null],
            ['profile' => ['url' => 'https://youtu.be/AbCdEfGh_1-', 'title' => str_repeat('x', 161)], 'tutorial' => null],
            ['profile' => ['url' => 'https://youtu.be/AbCdEfGh_1-', 'title' => "Judul\nbaru"], 'tutorial' => null],
            ['profile' => ['url' => "https://youtu.be/AbCdEfGh_1-\t", 'title' => 'Judul'], 'tutorial' => null],
            ['profile' => ['url' => 123, 'title' => 'Judul'], 'tutorial' => null],
        ] as $data) {
            $this->putJson('/api/v1/staff/site/videos', ['data' => $data])->assertUnprocessable();
        }
        $this->putJson('/api/v1/staff/site/videos', ['data' => $valid, 'extra' => 1])->assertUnprocessable()->assertJsonValidationErrors('data');
        $this->putJson('/api/v1/staff/site/videos', ['data' => ['profile' => ['url' => 'https://youtu.be/AbCdEfGh_1-', 'title' => str_repeat('x', 160)], 'tutorial' => null]])->assertOk();
        $this->assertDatabaseCount('audit_logs', 1);
    }

    public function test_videos_require_token_and_content_role(): void
    {
        $this->getJson('/api/v1/staff/site/videos')->assertUnauthorized();
        $this->putJson('/api/v1/staff/site/videos', ['data' => $this->videos()])->assertUnauthorized();
        config(['letters.neighborhood_approval' => true]);
        foreach (['village_head', 'rt_head', 'rw_head', 'resident'] as $role) {
            $this->act($role);
            $this->getJson('/api/v1/staff/site/videos')->assertForbidden();
            $this->putJson('/api/v1/staff/site/videos', ['data' => $this->videos()])->assertForbidden();
        }
        $this->act('admin', ['other']);
        $this->putJson('/api/v1/staff/site/videos', ['data' => $this->videos()])->assertForbidden();
        $this->assertDatabaseCount('site_sections', 0);
        $this->assertDatabaseCount('audit_logs', 0);
    }

    public function test_public_throttle_and_put_cors_preflight(): void
    {
        $this->withServerVariables(['REMOTE_ADDR' => '192.0.2.141']);
        for ($i = 0; $i < 60; $i++) $this->getJson('/api/v1/site/profile')->assertNotFound();
        $this->getJson('/api/v1/site/profile')->assertStatus(429);
        $this->options('/api/v1/staff/site/profile', [], ['Origin' => 'http://localhost:3000', 'Access-Control-Request-Method' => 'PUT', 'Access-Control-Request-Headers' => 'authorization,content-type'])
            ->assertNoContent()->assertHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    }
}
