<?php
namespace App\Http\Controllers\Api;
use App\Domain\Letter;
use App\Http\Controllers\Controller;
use App\Models\Application;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Symfony\Component\HttpFoundation\Response;
class LetterController extends Controller {
    private const READERS = ['staff', 'admin', 'village_head'];
    private const OFFICE = ['staff', 'admin'];

    /** Draf (PROCESSING/WAITING_APPROVAL) atau surat final (sejak APPROVED). Setiap unduhan diaudit. */
    public function download(Request $request, string $request_id): Response {
        $user = $request->user();
        if (! $this->allowed($user, self::READERS)) return $this->forbidden();
        $application = $this->application($request_id);
        $letter = Letter::find($application);
        if (in_array($application->status, Letter::DRAFT_STATUSES, true)) {
            [$pdf, $action, $name] = [Letter::render($application, null), 'letter.draft_viewed', 'draf-'];
        } elseif ($letter && in_array($application->status, Letter::FINAL_STATUSES, true)) {
            [$pdf, $action, $name] = [Letter::contents(Letter::generate($application)), 'letter.downloaded', 'surat-'];
        } else {
            return $this->unavailable();
        }
        $this->audit($user, $action, $application);
        return response($pdf, 200, [
            'Content-Type'=>'application/pdf',
            'Content-Disposition'=>'inline; filename="'.$name.$application->request_id.'.pdf"',
            'Cache-Control'=>'private, no-store',
        ]);
    }

    /** Surat buatan manual (dipindai setelah ditandatangani basah) menggantikan PDF otomatis; kode QR tetap. */
    public function upload(Request $request, string $request_id): JsonResponse {
        $user = $request->user();
        if (! $this->allowed($user, self::OFFICE)) return $this->forbidden();
        // Cek tanda tangan berkas sendiri: nama dan Content-Type dari klien bisa dipalsukan.
        $request->validate(['file'=>['required','file','max:5120',function (string $attribute, $file, \Closure $fail) {
            if (! str_starts_with((string) file_get_contents($file->getRealPath(), false, null, 0, 5), '%PDF-')) $fail('Berkas harus PDF.');
        }]]);
        $application = $this->application($request_id);
        $letter = Letter::find($application);
        if (! $letter || ! in_array($application->status, Letter::UPLOAD_STATUSES, true)) {
            return response()->json(['message'=>'Surat hanya dapat diunggah setelah disetujui Kepala Desa dan sebelum diambil.'], 422);
        }
        $pdf = $request->file('file')->get();
        DB::transaction(function () use ($letter, $pdf, $user, $application) {
            Letter::store($letter, $pdf, 'uploaded', $user);
            $this->audit($user, 'letter.uploaded', $application);
        });
        return response()->json(['success'=>true,'letter'=>self::summary(Letter::find($application))]);
    }

    /** Gambar QR untuk ditempel pada surat yang disusun manual. */
    public function qr(Request $request, string $request_id): Response {
        $user = $request->user();
        if (! $this->allowed($user, self::OFFICE)) return $this->forbidden();
        $application = $this->application($request_id);
        $letter = Letter::find($application);
        if (! $letter || ! in_array($application->status, Letter::FINAL_STATUSES, true)) return $this->unavailable();
        return response(Letter::qr($letter->verification_code), 200, [
            'Content-Type'=>'image/png',
            'Content-Disposition'=>'attachment; filename="qr-'.$application->request_id.'.png"',
            'Cache-Control'=>'private, no-store',
        ]);
    }

    /** Publik: hanya metadata surat; tanpa NIK, alamat, isi surat, atau nomor pengajuan. */
    public function verify(string $code): JsonResponse {
        $letter = preg_match('/\A[A-Za-z0-9]{32}\z/', $code)
            ? DB::table('letters')->join('applications', 'applications.id', '=', 'letters.application_id')
                ->where('letters.verification_code', $code)
                ->first(['letters.application_id', 'letters.approved_at', 'applications.jenis_surat', 'applications.nama'])
            : null;
        if (! $letter) return response()->json(['message'=>'Kode verifikasi tidak ditemukan.'], 404)->header('Cache-Control', 'no-store');
        $number = DB::table('letter_numbers')->where('application_id', $letter->application_id)->orderByDesc('id')->first(['number', 'status']);
        return response()->json([
            'number'=>$number?->number,
            'jenis_surat'=>$letter->jenis_surat,
            'issued_at'=>Carbon::parse($letter->approved_at)->toISOString(),
            'nama'=>Letter::maskName($letter->nama),
            // Permohonan lama tanpa nomor tetap sah; nomor terakhir yang dibatalkan berarti surat dibatalkan.
            'status'=>$number?->status === 'void' ? 'revoked' : 'valid',
        ])->header('Cache-Control', 'no-store');
    }

    public static function summary(?object $letter): ?array {
        return $letter ? [
            'approved_at'=>Carbon::parse($letter->approved_at)->toISOString(),
            'source'=>$letter->source,
            'sha256'=>$letter->sha256,
            'file_updated_at'=>$letter->file_updated_at ? Carbon::parse($letter->file_updated_at)->toISOString() : null,
        ] : null;
    }

    private function allowed(User $user, array $roles): bool {
        return $user->canAccessPanel() && in_array($user->role, $roles, true);
    }

    private function application(string $request_id): Application {
        Validator::make(['request_id'=>$request_id], [
            'request_id'=>['required','string','max:64','regex:/\AREQ-[0-9]{4}-[A-Z0-9]+\z/'],
        ])->validate();
        return Application::where('request_id', $request_id)->firstOrFail();
    }

    private function audit(User $user, string $action, Application $application): void {
        DB::table('audit_logs')->insert([
            'user_id'=>$user->id, 'action'=>$action, 'subject_type'=>'application',
            'subject_id'=>$application->id, 'created_at'=>now(),
        ]);
    }

    private function unavailable(): JsonResponse {
        return response()->json(['message'=>'Surat belum tersedia untuk status ini.'], 404)->header('Cache-Control', 'private, no-store');
    }

    private function forbidden(): JsonResponse {
        return response()->json(['message'=>'Akses ditolak.'], 403)->header('Cache-Control', 'private, no-store');
    }
}
