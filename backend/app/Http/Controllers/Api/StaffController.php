<?php
namespace App\Http\Controllers\Api;
use App\Domain\ApplicationStatus;
use App\Http\Controllers\Controller;
use App\Models\Application;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
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
        if (! $user || ! ApplicationStatus::isPanelRole($user->role) || ! Hash::check($data['password'], $user->password)) return response()->json(['message'=>'Kredensial tidak valid.'], 401);
        return response()->json(['token'=>$user->createToken('staff', ['applications:manage'])->plainTextToken,'user'=>['name'=>$user->name,'role'=>$user->role]]);
    }
    public function logout(Request $request): JsonResponse {
        $request->user()->currentAccessToken()->delete();
        return response()->json(['message'=>'Berhasil keluar.']);
    }
    public function me(Request $request): JsonResponse {
        $user = $request->user();
        // Role can change after a token is issued; re-check on every call.
        if (! ApplicationStatus::isPanelRole($user->role)) return $this->forbidden();
        return response()->json(['name'=>$user->name,'username'=>$user->username,'role'=>$user->role]);
    }
    public function index(Request $request): JsonResponse {
        $role = $request->user()->role;
        if (! ApplicationStatus::isPanelRole($role)) return $this->forbidden();
        $data = $request->validate([
            'status'=>['sometimes','prohibits:statuses',Rule::in(ApplicationStatus::values())],
            'statuses'=>['sometimes','prohibits:status','array','min:1','max:'.count(ApplicationStatus::cases())],
            'statuses.*'=>['string','distinct',Rule::in(ApplicationStatus::values())],
            'page'=>['sometimes','integer','min:1'],
        ]);
        $query = Application::query()->select(['id','request_id','nama','jenis_surat','status','catatan','created_at']);
        if (isset($data['status'])) $query->where('status', $data['status']);
        if (isset($data['statuses'])) $query->whereIn('status', $data['statuses']);
        // Explicit fields only: sensitive encrypted columns are never selected or serialized.
        $page = $query->latest()->latest('id')->paginate(20)->through(fn (Application $application) => [
            'request_id'=>$application->request_id,
            'nama'=>$application->nama,
            'jenis_surat'=>$application->jenis_surat,
            'status'=>$application->status,
            'catatan'=>$application->catatan,
            'created_at'=>$application->created_at,
            'allowed_transitions'=>ApplicationStatus::allowedFor($application->status, $role),
        ]);
        return response()->json($page);
    }
    public function update(Request $request, Application $application): JsonResponse {
        $user = $request->user();
        if (! ApplicationStatus::isPanelRole($user->role)) return $this->forbidden();
        $data = $request->validate(['status'=>['required',Rule::in(ApplicationStatus::values())], 'catatan'=>['nullable','string','max:1000']]);
        $note = blank($data['catatan'] ?? null) ? null : trim($data['catatan']);
        $result = DB::transaction(function () use ($application, $data, $note, $user) {
            // Re-read under lock so a stale client cannot move an already-changed status.
            $fresh = Application::whereKey($application->getKey())->lockForUpdate()->firstOrFail();
            $from = $fresh->status;
            if (! ApplicationStatus::isTransition($from, $data['status'])) return response()->json(['message'=>'Transisi status tidak valid.'], 422);
            if (! ApplicationStatus::canTransition($from, $data['status'], $user->role)) return response()->json(['message'=>'Peran Anda tidak berwenang melakukan perubahan status ini.'], 403);
            if (ApplicationStatus::requiresNote($data['status']) && $note === null) return response()->json(['message'=>'Catatan wajib diisi.','errors'=>['catatan'=>['Catatan wajib diisi.']]], 422);
            $fresh->update(['status'=>$data['status'],'catatan'=>$note]);
            DB::table('application_events')->insert(['application_id'=>$fresh->id,'user_id'=>$user->id,'from_status'=>$from,'to_status'=>$data['status'],'note'=>$note,'created_at'=>now()]);
            return $fresh;
        });
        if ($result instanceof JsonResponse) return $result;
        return response()->json([
            'success'=>true,'request_id'=>$result->request_id,'status'=>$result->status,'catatan'=>$result->catatan,
            'allowed_transitions'=>ApplicationStatus::allowedFor($result->status, $user->role),
        ]);
    }
    private function forbidden(): JsonResponse {
        return response()->json(['message'=>'Akses ditolak.'], 403);
    }
}
