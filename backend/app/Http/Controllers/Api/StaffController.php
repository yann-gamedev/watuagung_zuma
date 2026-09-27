<?php
namespace App\Http\Controllers\Api;
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
        $data = $request->validate(['email'=>['required','email'],'password'=>['required','string']]);
        $user = User::where('email', $data['email'])->first();
        if (! $user || ! in_array($user->role, ['staff', 'admin'], true) || ! Hash::check($data['password'], $user->password)) return response()->json(['message'=>'Kredensial tidak valid.'], 401);
        return response()->json(['token'=>$user->createToken('staff', ['applications:manage'])->plainTextToken,'user'=>['name'=>$user->name,'role'=>$user->role]]);
    }
    public function logout(Request $request): JsonResponse {
        $request->user()->currentAccessToken()->delete();
        return response()->json(['message'=>'Berhasil keluar.']);
    }
    public function index(Request $request): JsonResponse {
        $data = $request->validate(['status'=>['sometimes',Rule::in(['SUBMITTED','VERIFIED','PROCESSING','WAITING_APPROVAL','APPROVED','REJECTED','NEED_REVISION'])]]);
        $query = Application::query()->select(['id','request_id','nama','jenis_surat','status','catatan','created_at']);
        if (isset($data['status'])) $query->where('status', $data['status']);
        return response()->json($query->latest()->paginate(20));
    }
    public function update(Request $request, Application $application): JsonResponse {
        $data = $request->validate(['status'=>['required',Rule::in(['VERIFIED','PROCESSING','WAITING_APPROVAL','APPROVED','REJECTED','NEED_REVISION'])], 'catatan'=>['nullable','string','max:1000']]);
        $allowed = [
            'SUBMITTED'=>['VERIFIED','REJECTED','NEED_REVISION'],
            'VERIFIED'=>['PROCESSING','REJECTED','NEED_REVISION'],
            'PROCESSING'=>['WAITING_APPROVAL','REJECTED','NEED_REVISION'],
            'WAITING_APPROVAL'=>['APPROVED','REJECTED','NEED_REVISION'],
            'NEED_REVISION'=>['VERIFIED','REJECTED'],
        ];
        if (! in_array($data['status'], $allowed[$application->status] ?? [], true)) return response()->json(['message'=>'Transisi status tidak valid.'], 422);
        if (in_array($data['status'], ['REJECTED','NEED_REVISION'], true) && blank($data['catatan'] ?? null)) return response()->json(['message'=>'Catatan wajib diisi.'], 422);
        DB::transaction(function () use ($application, $data, $request) {
            $old = $application->status;
            $application->update(['status'=>$data['status'],'catatan'=>$data['catatan'] ?? null]);
            DB::table('application_events')->insert(['application_id'=>$application->id,'user_id'=>$request->user()->id,'from_status'=>$old,'to_status'=>$data['status'],'note'=>$data['catatan'] ?? null,'created_at'=>now()]);
        });
        return response()->json(['success'=>true,'request_id'=>$application->request_id,'status'=>$application->status,'catatan'=>$application->catatan]);
    }
}
