<?php
namespace App\Http\Controllers\Api;
use App\Domain\AccessCode;
use App\Domain\ApplicationStatus;
use App\Domain\LetterType;
use App\Domain\LetterNumber;
use App\Http\Controllers\Controller;
use App\Models\Application;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
class StaffController extends Controller {
    public function login(Request $request): JsonResponse {
        $data = $request->validate([
            'username'=>['required_without:email','prohibits:email','string','max:64','regex:/\A[a-z0-9][a-z0-9_-]*\z/'],
            'email'=>['required_without:username','prohibits:username','email','max:255'],
            'password'=>['required','string'],
        ]);
        // Existing clients may still authenticate by email, but never both identifiers.
        $user = isset($data['username'])
            ? User::where('username', $data['username'])->first()
            : User::where('email', $data['email'])->first();
        // Akun nonaktif memakai pesan yang sama dengan kredensial salah.
        if (! $user || ! Hash::check($data['password'], $user->password) || ! $user->canAccessPanel()) return response()->json(['message'=>'Kredensial tidak valid.'], 401);
        $user->forceFill(['last_login_at'=>now()])->save();
        return response()->json(['token'=>$user->createToken('staff', ['applications:manage'])->plainTextToken,'must_change_password'=>(bool) $user->must_change_password,'user'=>['name'=>$user->name,'role'=>$user->role,'rt'=>$user->rt,'rw'=>$user->rw]]);
    }
    public function logout(Request $request): JsonResponse {
        $request->user()->currentAccessToken()->delete();
        return response()->json(['message'=>'Berhasil keluar.']);
    }
    public function me(Request $request): JsonResponse {
        $user = $request->user();
        // Role can change after a token is issued; re-check on every call.
        if (! $user->canAccessPanel()) return $this->forbidden();
        return response()->json(['name'=>$user->name,'username'=>$user->username,'role'=>$user->role,'rt'=>$user->rt,'rw'=>$user->rw,'must_change_password'=>(bool) $user->must_change_password]);
    }
    public function index(Request $request): JsonResponse {
        $user = $request->user();
        if (! $user->canAccessPanel()) return $this->forbidden();
        $data = $request->validate([
            'status'=>['sometimes','prohibits:statuses',Rule::in(ApplicationStatus::values())],
            'statuses'=>['sometimes','prohibits:status','array','min:1','max:'.count(ApplicationStatus::cases())],
            'statuses.*'=>['string','distinct',Rule::in(ApplicationStatus::values())],
            'page'=>['sometimes','integer','min:1'],
            'q'=>['sometimes','nullable','string','max:100'],
            'jenis_surat'=>['sometimes',Rule::enum(LetterType::class)],
            'sort'=>['sometimes',Rule::in(['terbaru','terlama'])],
        ]);
        $query = Application::query()->forUser($user)->select(['id','request_id','nama','jenis_surat','status','created_at','rt','rw']);
        if (isset($data['status'])) $query->where('status', $data['status']);
        if (isset($data['statuses'])) $query->whereIn('status', $data['statuses']);
        if (isset($data['jenis_surat'])) $query->where('jenis_surat', $data['jenis_surat']);
        if (filled($data['q'] ?? null)) {
            // Escape LIKE wildcards: search is a literal substring, never raw SQL.
            // LOWER() on both sides keeps search case-insensitive on SQLite and PostgreSQL alike.
            $search = '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], mb_strtolower($data['q'])).'%';
            $query->where(fn ($searchQuery) => $searchQuery
                ->whereRaw("LOWER(request_id) LIKE ? ESCAPE '!'", [$search])
                ->orWhereRaw("LOWER(nama) LIKE ? ESCAPE '!'", [$search]));
        }
        $direction = ($data['sort'] ?? 'terbaru') === 'terlama' ? 'asc' : 'desc';
        // Explicit fields only: encrypted columns and freeform notes are never selected.
        $page = $query->orderBy('created_at', $direction)->orderBy('id', $direction)->paginate(20)->through(fn (Application $application) => [
            'request_id'=>$application->request_id,
            'nama'=>$application->nama,
            'jenis_surat'=>$application->jenis_surat,
            'status'=>$application->status,
            'created_at'=>$application->created_at,
            'allowed_transitions'=>$application->allowedTransitions($user),
        ]);
        return response()->json($page)->header('Cache-Control', 'private, no-store');
    }
    public function letterRegister(Request $request): JsonResponse {
        $user = $request->user();
        if (! $user->canAccessPanel() || ! in_array($user->role, ['staff', 'admin', 'village_head'], true)) return $this->forbidden();
        $data = $request->validate([
            'year'=>['sometimes','integer','between:1000,9999'],
            'jenis_surat'=>['sometimes',Rule::enum(LetterType::class)],
            'page'=>['sometimes','integer','min:1'],
        ]);
        $query = DB::table('letter_numbers as letters')->join('applications', 'applications.id', '=', 'letters.application_id')
            ->where('letters.year', $data['year'] ?? now()->year);
        if (isset($data['jenis_surat'])) $query->where('applications.jenis_surat', $data['jenis_surat']);
        $page = $query->select(['letters.number','letters.issued_at','applications.jenis_surat','applications.nama','letters.status'])
            ->orderByDesc('letters.sequence')->paginate(20)->through(fn ($letter) => [
                'number'=>$letter->number, 'issued_at'=>Carbon::parse($letter->issued_at)->toISOString(),
                'jenis_surat'=>$letter->jenis_surat, 'nama'=>$letter->nama, 'status'=>$letter->status,
            ]);
        return response()->json($page)->header('Cache-Control', 'private, no-store');
    }
    public function show(Request $request, string $request_id): JsonResponse {
        $user = $request->user();
        if (! $user->canAccessPanel()) return $this->forbidden();
        // No implicit model binding: authorize and validate before loading private data.
        Validator::make(['request_id'=>$request_id], [
            'request_id'=>['required','string','max:64','regex:/\AREQ-[0-9]{4}-[A-Z0-9]+\z/'],
        ])->validate();
        $application = Application::query()->forUser($user)->select([
            'id','request_id','jenis_surat','nama','nik','no_kk','tempat_lahir','tanggal_lahir',
            'jenis_kelamin','alamat','rt','rw','telepon','nama_usaha','jenis_usaha','alamat_usaha',
            'keperluan','status','catatan','created_at','updated_at',
        ])->where('request_id', $request_id)->firstOrFail();
        $history = DB::table('application_events as events')
            ->leftJoin('users', 'users.id', '=', 'events.user_id')
            ->where('events.application_id', $application->id)
            ->orderBy('events.created_at')->orderBy('events.id')
            ->get(['events.action','events.from_status','events.to_status','events.note','users.name as staff_name','events.created_at'])
            ->map(fn ($event) => [
                'action'=>$event->action,
                'from_status'=>$event->from_status,
                'to_status'=>$event->to_status,
                'note'=>$event->note,
                'staff_name'=>$event->staff_name,
                'created_at'=>Carbon::parse($event->created_at)->toISOString(),
            ]);
        $detail = [
            'request_id'=>$application->request_id,
            'jenis_surat'=>$application->jenis_surat,
            'nama'=>$application->nama,
            // NIK/KK utuh untuk semua peran panel: dibutuhkan untuk verifikasi (keputusan pengguna 20 Okt 2026).
            'nik'=>$application->nik,
            'no_kk'=>$application->no_kk,
            'alamat'=>$application->alamat,
            'rt'=>$application->rt,
            'rw'=>$application->rw,
            'nama_usaha'=>$application->nama_usaha,
            'jenis_usaha'=>$application->jenis_usaha,
            'alamat_usaha'=>$application->alamat_usaha,
            'keperluan'=>$application->keperluan,
            'status'=>$application->status,
            'catatan'=>$application->catatan,
            'created_at'=>$application->created_at,
            'updated_at'=>$application->updated_at,
            'allowed_transitions'=>$application->allowedTransitions($user),
            'can_reset_access_code'=>$user->canResetAccessCode() && $application->status !== 'COMPLETED',
            'history'=>$history,
        ];
        if (! $user->isNeighborhoodHead()) {
            $detail += [
                'telepon'=>$application->telepon,
                'tempat_lahir'=>$application->tempat_lahir,
                'tanggal_lahir'=>$application->tanggal_lahir->format('Y-m-d'),
                'jenis_kelamin'=>$application->jenis_kelamin,
                'letter_numbers'=>DB::table('letter_numbers')->where('application_id', $application->id)->orderBy('id')
                    ->get(['number','status','void_reason','issued_at'])->map(fn ($letter) => [
                        'number'=>$letter->number, 'status'=>$letter->status, 'void_reason'=>$letter->void_reason,
                        'issued_at'=>Carbon::parse($letter->issued_at)->toISOString(),
                    ]),
            ];
        }
        // Fail closed: do not return private data if recording the access fails.
        DB::table('audit_logs')->insert([
            'user_id'=>$user->id, 'action'=>'application.viewed', 'subject_type'=>'application',
            'subject_id'=>$application->id, 'created_at'=>now(),
        ]);
        return response()->json($detail)->header('Cache-Control', 'private, no-store');
    }
    public function update(Request $request, Application $application): JsonResponse {
        $user = $request->user();
        if (! $user->canAccessPanel()) return $this->forbidden();
        if (! $application->isInTerritory($user)) return $this->forbidden();
        $data = $request->validate(['status'=>['required',Rule::in(ApplicationStatus::values())], 'catatan'=>['nullable','string','max:1000']]);
        $note = blank($data['catatan'] ?? null) ? null : trim($data['catatan']);
        $issuedAt = now();
        $result = DB::transaction(function () use ($application, $data, $note, $user, $issuedAt) {
            LetterNumber::acquireWriteLock($issuedAt->year);
            // Re-read under lock so a stale client cannot move an already-changed status.
            $fresh = Application::whereKey($application->getKey())->lockForUpdate()->firstOrFail();
            if (! $fresh->isInTerritory($user)) return $this->forbidden();
            $from = $fresh->status;
            $type = LetterType::from($fresh->jenis_surat);
            if (! ApplicationStatus::isTransition($from, $data['status'], $type)) return response()->json(['message'=>'Transisi status tidak valid.'], 422);
            if (! ApplicationStatus::canTransition($from, $data['status'], $user->role, $type)) return response()->json(['message'=>'Peran Anda tidak berwenang melakukan perubahan status ini.'], 403);
            if (ApplicationStatus::requiresNote($data['status']) && $note === null) return response()->json(['message'=>'Catatan wajib diisi.','errors'=>['catatan'=>['Catatan wajib diisi.']]], 422);
            if ($from === 'PROCESSING' && $data['status'] === 'WAITING_APPROVAL') LetterNumber::issue($fresh, $user, $issuedAt);
            if ($from === 'WAITING_APPROVAL' && in_array($data['status'], ['REJECTED', 'NEED_REVISION'], true)) LetterNumber::void($fresh, $note);
            $fresh->update(['status'=>$data['status'],'catatan'=>$note]);
            DB::table('application_events')->insert(['application_id'=>$fresh->id,'user_id'=>$user->id,'from_status'=>$from,'to_status'=>$data['status'],'note'=>$note,'created_at'=>now()]);
            return $fresh;
        }, 3);
        if ($result instanceof JsonResponse) return $result;
        return response()->json([
            'success'=>true,'request_id'=>$result->request_id,'status'=>$result->status,'catatan'=>$result->catatan,
            'allowed_transitions'=>$result->allowedTransitions($user),
        ]);
    }
    /** Kode lama langsung tidak berlaku; kode baru hanya ada di respons ini, tidak pernah di log. */
    public function resetAccessCode(Request $request, string $request_id): JsonResponse {
        $user = $request->user();
        if (! $user->canResetAccessCode()) return $this->forbidden();
        Validator::make(['request_id'=>$request_id], [
            'request_id'=>['required','string','max:64','regex:/\AREQ-[0-9]{4}-[A-Z0-9]+\z/'],
        ])->validate();
        $result = DB::transaction(function () use ($user, $request_id) {
            // Di luar wilayah = 404, sama seperti detail.
            $application = Application::query()->forUser($user)->where('request_id', $request_id)->lockForUpdate()->firstOrFail();
            if ($application->status === 'COMPLETED') {
                return response()->json(['message'=>'Permohonan sudah selesai; kode akses tidak dapat dibuat ulang.'], 422);
            }
            $code = AccessCode::generate();
            $application->update(['lookup_secret_hash'=>AccessCode::hash($code)]);
            DB::table('application_events')->insert([
                'application_id'=>$application->id, 'user_id'=>$user->id, 'action'=>'ACCESS_CODE_RESET',
                'from_status'=>$application->status, 'to_status'=>$application->status, 'created_at'=>now(),
            ]);
            DB::table('audit_logs')->insert([
                'user_id'=>$user->id, 'action'=>'application.access_code_reset', 'subject_type'=>'application',
                'subject_id'=>$application->id, 'created_at'=>now(),
            ]);
            return $code;
        });
        if ($result instanceof JsonResponse) return $result;
        RateLimiter::clear('lookup:'.$request_id);
        return response()->json(['success'=>true,'request_id'=>$request_id,'lookup_secret'=>$result])->header('Cache-Control', 'private, no-store');
    }
    private function forbidden(): JsonResponse {
        return response()->json(['message'=>'Akses ditolak.'], 403)->header('Cache-Control', 'private, no-store');
    }
}
