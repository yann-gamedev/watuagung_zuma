<?php

namespace App\Http\Controllers\Api;

use App\Domain\ApplicationStatus;
use App\Domain\AreaCode;
use App\Domain\LetterType;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\PersonalAccessToken;

/** Manajemen akun petugas. Hanya admin; aturan wilayah dan admin aktif dijaga di sini. */
class StaffUserController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if ($denied = $this->requireAdmin($request)) return $denied;

        // ponytail: tanpa pagination; tambah bila akun desa melebihi beberapa ratus.
        $users = User::query()->orderBy('name')->orderBy('id')->get();

        return response()->json([
            'data' => $users->map(fn (User $user) => $this->present($user))->values(),
            'warnings' => $this->warnings(),
        ])->header('Cache-Control', 'private, no-store');
    }

    public function store(Request $request): JsonResponse
    {
        if ($denied = $this->requireAdmin($request)) return $denied;

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'username' => ['required', 'string', 'max:64', 'regex:/\A[a-z0-9][a-z0-9_-]*\z/', 'unique:users,username'],
            'role' => ['required', Rule::in(ApplicationStatus::PANEL_ROLES)],
            'password' => ['required', 'string', 'min:10', 'max:255'],
            'rt' => ['nullable', 'string', 'regex:/\A[0-9]{1,3}\z/'],
            'rw' => ['nullable', 'string', 'regex:/\A[0-9]{1,3}\z/'],
        ]);
        $territory = $this->territory($data);

        $user = DB::transaction(function () use ($request, $data, $territory) {
            $this->assertTerritoryFree($data['role'], $territory['rt'], $territory['rw']);
            $user = User::create([
                'name' => $data['name'],
                'username' => $data['username'],
                'email' => null,
                'password' => $data['password'],
                'role' => $data['role'],
                'rt' => $territory['rt'],
                'rw' => $territory['rw'],
                'is_active' => true,
                'must_change_password' => true,
            ]);
            $this->audit($request->user(), 'user.created', $user->id);

            return $user;
        });

        return response()->json($this->present($user), 201)->header('Cache-Control', 'private, no-store');
    }

    public function update(Request $request, string $id): JsonResponse
    {
        if ($denied = $this->requireAdmin($request)) return $denied;

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'role' => ['required', Rule::in(ApplicationStatus::PANEL_ROLES)],
            'is_active' => ['required', 'boolean'],
            'rt' => ['nullable', 'string', 'regex:/\A[0-9]{1,3}\z/'],
            'rw' => ['nullable', 'string', 'regex:/\A[0-9]{1,3}\z/'],
        ]);
        $territory = $this->territory($data);
        $active = filter_var($data['is_active'], FILTER_VALIDATE_BOOLEAN);

        $result = DB::transaction(function () use ($request, $id, $data, $territory, $active) {
            $actor = $request->user();
            $target = User::whereKey($id)->lockForUpdate()->firstOrFail();
            $willRemainAdmin = $data['role'] === 'admin' && $active;

            if ($target->is($actor) && ! $willRemainAdmin) {
                return $this->unprocessable('Anda tidak dapat menonaktifkan atau menurunkan peran akun sendiri.', 'role');
            }
            if ($target->role === 'admin' && $target->is_active && ! $willRemainAdmin) {
                $otherAdmins = User::where('role', 'admin')->where('is_active', true)->whereKeyNot($target->id)->count();
                if ($otherAdmins === 0) {
                    return $this->unprocessable('Sistem harus memiliki minimal satu admin aktif.', 'role');
                }
            }

            $this->assertTerritoryFree($data['role'], $territory['rt'], $territory['rw'], $target->id);
            $target->forceFill([
                'name' => $data['name'],
                'role' => $data['role'],
                'rt' => $territory['rt'],
                'rw' => $territory['rw'],
                'is_active' => $active,
            ])->save();
            if (! $active) $target->tokens()->delete();
            $this->audit($actor, 'user.updated', $target->id);

            return $target;
        });

        if ($result instanceof JsonResponse) return $result;

        return response()->json($this->present($result))->header('Cache-Control', 'private, no-store');
    }

    public function resetPassword(Request $request, string $id): JsonResponse
    {
        if ($denied = $this->requireAdmin($request)) return $denied;

        $data = $request->validate(['password' => ['required', 'string', 'min:10', 'max:255']]);

        DB::transaction(function () use ($request, $id, $data) {
            $target = User::whereKey($id)->lockForUpdate()->firstOrFail();
            $target->forceFill([
                'password' => $data['password'],
                'must_change_password' => true,
            ])->save();
            $target->tokens()->delete();
            $this->audit($request->user(), 'user.password_reset', $target->id);
        });

        return response()->json(['success' => true])->header('Cache-Control', 'private, no-store');
    }

    /** Ganti kata sandi sendiri; token lain dicabut, token yang sedang dipakai tetap berlaku. */
    public function changeOwnPassword(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user->canAccessPanel()) return $this->forbidden();

        $data = $request->validate([
            'old_password' => ['required', 'string'],
            'password' => ['required', 'string', 'min:10', 'max:255'],
        ]);
        if (! Hash::check($data['old_password'], $user->password)) {
            throw ValidationException::withMessages(['old_password' => 'Kata sandi lama tidak cocok.']);
        }

        DB::transaction(function () use ($request, $user, $data) {
            $user->forceFill([
                'password' => $data['password'],
                'must_change_password' => false,
            ])->save();
            $current = $request->user()->currentAccessToken();
            $query = $user->tokens();
            if ($current instanceof PersonalAccessToken) $query->whereKeyNot($current->getKey());
            $query->delete();
        });

        return response()->json(['success' => true])->header('Cache-Control', 'private, no-store');
    }

    private function requireAdmin(Request $request): ?JsonResponse
    {
        $user = $request->user();

        return $user->canAccessPanel() && $user->role === 'admin' ? null : $this->forbidden();
    }

    /** @return array{rt: ?string, rw: ?string} */
    private function territory(array $data): array
    {
        $role = $data['role'];
        $rt = $role === 'rt_head' ? AreaCode::normalize($data['rt'] ?? null) : null;
        $rw = in_array($role, ['rt_head', 'rw_head'], true) ? AreaCode::normalize($data['rw'] ?? null) : null;

        if ($role === 'rt_head' && (! $rt || ! $rw)) {
            throw ValidationException::withMessages(['rt' => 'Ketua RT memerlukan RT dan RW.']);
        }
        if ($role === 'rw_head' && ! $rw) {
            throw ValidationException::withMessages(['rw' => 'Ketua RW memerlukan RW.']);
        }

        return ['rt' => $rt, 'rw' => $rw];
    }

    /** Satu wilayah hanya boleh punya satu ketua aktif; pergantian harus menonaktifkan yang lama. */
    private function assertTerritoryFree(string $role, ?string $rt, ?string $rw, ?int $ignoreId = null): void
    {
        if (! in_array($role, ['rt_head', 'rw_head'], true)) return;

        $query = User::where('role', $role)->where('is_active', true)->where('rw', $rw);
        if ($role === 'rt_head') $query->where('rt', $rt);
        if ($ignoreId) $query->whereKeyNot($ignoreId);
        if (! $query->exists()) return;

        $field = $role === 'rt_head' ? 'rt' : 'rw';
        throw ValidationException::withMessages([
            $field => $role === 'rt_head'
                ? 'RT ini sudah memiliki Ketua RT aktif. Nonaktifkan akun lama terlebih dahulu.'
                : 'RW ini sudah memiliki Ketua RW aktif. Nonaktifkan akun lama terlebih dahulu.',
        ]);
    }

    private function present(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'username' => $user->username,
            'role' => $user->role,
            'rt' => $user->rt,
            'rw' => $user->rw,
            'is_active' => $user->is_active,
            'must_change_password' => $user->must_change_password,
            'last_login_at' => $user->last_login_at?->toISOString(),
        ];
    }

    /** Permohonan yang tertahan karena wilayahnya belum punya ketua aktif. */
    private function warnings(): array
    {
        $warnings = [];
        $pendingRt = DB::table('applications')
            ->where('status', 'SUBMITTED')
            ->whereIn('jenis_surat', LetterType::neighborhoodValues())
            ->selectRaw('rt, rw, count(*) as pending')->groupBy('rt', 'rw')->get();
        $activeRt = DB::table('users')->where('role', 'rt_head')->where('is_active', true)->get(['rt', 'rw'])
            ->mapWithKeys(fn ($user) => [$user->rt.'|'.$user->rw => true]);
        foreach ($pendingRt as $row) {
            if (! isset($activeRt[$row->rt.'|'.$row->rw])) {
                $warnings[] = ['role' => 'rt_head', 'rt' => $row->rt, 'rw' => $row->rw, 'pending' => (int) $row->pending];
            }
        }

        $pendingRw = DB::table('applications')
            ->where('status', 'RT_APPROVED')
            ->selectRaw('rw, count(*) as pending')->groupBy('rw')->get();
        $activeRw = DB::table('users')->where('role', 'rw_head')->where('is_active', true)->pluck('rw')->flip();
        foreach ($pendingRw as $row) {
            if (! isset($activeRw[$row->rw])) {
                $warnings[] = ['role' => 'rw_head', 'rt' => null, 'rw' => $row->rw, 'pending' => (int) $row->pending];
            }
        }

        return $warnings;
    }

    private function audit(User $actor, string $action, int $subjectId): void
    {
        DB::table('audit_logs')->insert([
            'user_id' => $actor->id,
            'action' => $action,
            'subject_type' => 'user',
            'subject_id' => $subjectId,
            'created_at' => now(),
        ]);
    }

    private function unprocessable(string $message, string $field): JsonResponse
    {
        return response()->json(['message' => $message, 'errors' => [$field => [$message]]], 422);
    }

    private function forbidden(): JsonResponse
    {
        return response()->json(['message' => 'Akses ditolak.'], 403)->header('Cache-Control', 'private, no-store');
    }
}
