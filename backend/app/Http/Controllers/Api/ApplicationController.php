<?php
namespace App\Http\Controllers\Api;
use App\Http\Controllers\Controller;
use App\Models\Application;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
class ApplicationController extends Controller {
    public function store(Request $request): JsonResponse {
        $data = $request->validate([
            'jenis_surat'=>['required',Rule::in(['SKU','DOMISILI','SKTM','KTP_KK'])],
            'nama'=>['required','string','min:2','max:200'],
            'nik'=>['required','regex:/^[0-9]{16}$/'], 'no_kk'=>['required','regex:/^[0-9]{16}$/'],
            'tempat_lahir'=>['required','string','min:2','max:200'],
            'tanggal_lahir'=>['required','date_format:Y-m-d','after_or_equal:1900-01-01','before_or_equal:today'],
            'jenis_kelamin'=>['required',Rule::in(['Laki-laki','Perempuan'])],
            'alamat'=>['required','string','min:2','max:200'],
            'rt'=>['required','regex:/^[0-9]{1,3}$/'], 'rw'=>['required','regex:/^[0-9]{1,3}$/'],
            'telepon'=>['required','regex:/^(?:\+62|0)[0-9]{8,13}$/'],
            'nama_usaha'=>['required_if:jenis_surat,SKU','nullable','string','min:2','max:200'],
            'jenis_usaha'=>['required_if:jenis_surat,SKU','nullable','string','min:2','max:200'],
            'alamat_usaha'=>['required_if:jenis_surat,SKU','nullable','string','min:2','max:200'],
            'keperluan'=>['required','string','min:2','max:200'],
        ]);
        $secret = Str::random(48);
        $application = DB::transaction(function () use ($data, $secret) {
            $application = Application::create($data + [
                'request_id'=>'REQ-'.now()->year.'-'.Str::upper((string) Str::ulid()),
                'lookup_secret_hash'=>hash('sha256', $secret), 'status'=>'SUBMITTED',
            ]);
            DB::table('application_events')->insert(['application_id'=>$application->id,'to_status'=>'SUBMITTED','created_at'=>now()]);
            return $application;
        });
        return response()->json(['success'=>true,'request_id'=>$application->request_id,'status'=>$application->status,'lookup_secret'=>$secret], 201);
    }
    public function status(Request $request): JsonResponse {
        $data = $request->validate(['request_id'=>['required','string','max:64'],'lookup_secret'=>['required','string','max:128']]);
        $application = Application::where('request_id', $data['request_id'])->first();
        if (! $application || ! hash_equals($application->lookup_secret_hash, hash('sha256', $data['lookup_secret']))) {
            return response()->json(['success'=>false,'message'=>'Permohonan tidak ditemukan atau kode akses tidak valid.'], 404);
        }
        return response()->json(['success'=>true,'request_id'=>$application->request_id,'status'=>$application->status,'catatan'=>$application->catatan]);
    }
}
