<?php
use App\Http\Controllers\Api\ApplicationController;
use App\Http\Controllers\Api\ApprovalController;
use App\Http\Controllers\Api\NotificationSettingsController;
use App\Http\Controllers\Api\AttachmentController;
use App\Http\Controllers\Api\LetterController;
use App\Http\Controllers\Api\BusinessController;
use App\Http\Controllers\Api\PostController;
use App\Http\Controllers\Api\SiteSectionController;
use App\Http\Controllers\Api\StaffController;
use App\Http\Controllers\Api\StaffUserController;
use Illuminate\Support\Facades\Route;
// Setiap throttle wajib bernama (argumen ketiga, atau limiter bernama). Tanpa nama, Laravel memakai kunci
// domain|IP yang sama untuk semua rute, sehingga membuka beranda ikut menghabiskan jatah login.
Route::post('/v1/applications', [ApplicationController::class, 'store'])->middleware('throttle:5,1,application-submit');
Route::post('/v1/applications/status', [ApplicationController::class, 'status'])->middleware('throttle:10,1,application-status');
// Unduh scan surat oleh warga; kunci kode akses bersama cek status + batas per IP.
Route::post('/v1/applications/letter', [ApplicationController::class, 'letter'])->middleware('throttle:10,1,application-letter');
Route::post('/v1/applications/attachments', [ApplicationController::class, 'replaceAttachments'])->middleware('throttle:5,1,application-attachments');
// Berhenti menerima email status; URL bertanda tangan (relatif, tanpa kedaluwarsa) dibuat ApplicantEmail::unsubscribeUrl.
// E3: persetujuan kepala desa lewat tautan email. Token di body (bukan URL); limiter `approval-link` per IP + per tautan.
Route::post('/v1/approvals/preview', [ApprovalController::class, 'preview'])->middleware('throttle:approval-link');
Route::post('/v1/approvals/draft', [ApprovalController::class, 'draft'])->middleware('throttle:approval-link');
Route::post('/v1/approvals/decide', [ApprovalController::class, 'decide'])->middleware('throttle:approval-link');
// Verifikasi email notifikasi akun; URL bertanda tangan 24 jam, tanpa login agar bisa dibuka dari ponsel.
Route::post('/v1/notifications/verify', [NotificationSettingsController::class, 'verify'])->middleware('throttle:10,1,notification-verify')->name('notifications.verify');
Route::post('/v1/applications/unsubscribe', [ApplicationController::class, 'unsubscribe'])->middleware('throttle:10,1,application-unsubscribe')->name('applications.unsubscribe');
// Limiter bernama `staff-login` (AppServiceProvider): 5/menit per username + IP dan 20/menit per IP.
Route::post('/v1/staff/login', [StaffController::class, 'login'])->middleware('throttle:staff-login');
Route::get('/v1/verify/{code}', [LetterController::class, 'verify'])->middleware('throttle:30,1,letter-verify');
Route::get('/v1/posts', [PostController::class, 'index'])->middleware('throttle:60,1,public-posts');
Route::get('/v1/posts/{slug}', [PostController::class, 'show'])->middleware('throttle:60,1,public-posts');
Route::get('/v1/site/{key}', [SiteSectionController::class, 'show'])->middleware('throttle:60,1,public-site');
Route::get('/v1/businesses', [BusinessController::class, 'index'])->middleware('throttle:60,1,public-businesses');
Route::get('/v1/businesses/{slug}', [BusinessController::class, 'show'])->middleware('throttle:60,1,public-businesses');
// Grup per ability: route baru wajib masuk salah satu grup sehingga peran tanpa ability tertolak bawaan.
Route::middleware(['auth:sanctum','abilities:panel'])->prefix('v1/staff')->group(function () {
    Route::post('/logout', [StaffController::class, 'logout']);
    Route::get('/me', [StaffController::class, 'me']);
    Route::post('/me/password', [StaffUserController::class, 'changeOwnPassword']);
    Route::get('/me/notifications', [NotificationSettingsController::class, 'show']);
    Route::put('/me/notifications', [NotificationSettingsController::class, 'updateEmail'])->middleware('throttle:5,1,notification-email');
    Route::put('/me/notifications/pin', [NotificationSettingsController::class, 'updatePin'])->middleware('throttle:5,1,approval-pin');
});
Route::middleware(['auth:sanctum','abilities:applications:manage'])->prefix('v1/staff')->group(function () {
    Route::get('/letter-register', [StaffController::class, 'letterRegister']);
    Route::get('/summary', [StaffController::class, 'summary']);
    Route::get('/applications', [StaffController::class, 'index']);
    Route::get('/applications/{request_id}', [StaffController::class, 'show']);
    Route::patch('/applications/{application:request_id}/status', [StaffController::class, 'update']);
    Route::patch('/applications/{request_id}/isi-keterangan', [StaffController::class, 'updateStatement'])->middleware('throttle:30,1,application-statement');
    Route::post('/applications/{request_id}/lookup-secret', [StaffController::class, 'resetAccessCode'])->middleware('throttle:10,1,access-code-reset');
    Route::get('/applications/{request_id}/letter.pdf', [LetterController::class, 'download'])->middleware('throttle:30,1,letter-download');
    Route::post('/applications/{request_id}/letter.pdf', [LetterController::class, 'upload'])->middleware('throttle:10,1,letter-upload');
    Route::get('/applications/{request_id}/letter-qr.png', [LetterController::class, 'qr']);
    Route::get('/applications/{request_id}/attachments/{id}', [AttachmentController::class, 'show'])->whereNumber('id')->middleware('throttle:60,1,attachment-view');
    Route::get('/users', [StaffUserController::class, 'index']);
    Route::post('/users', [StaffUserController::class, 'store']);
    Route::patch('/users/{id}', [StaffUserController::class, 'update']);
    Route::post('/users/{id}/reset-password', [StaffUserController::class, 'resetPassword']);
});
Route::middleware(['auth:sanctum','abilities:site:manage'])->prefix('v1/staff')->group(function () {
    Route::get('/site/{key}', [SiteSectionController::class, 'staffShow']);
    Route::put('/site/{key}', [SiteSectionController::class, 'update']);
    Route::post('/site/{key}/image', [SiteSectionController::class, 'image'])->middleware('throttle:10,1,site-image');
    Route::post('/site/{key}/document', [SiteSectionController::class, 'document'])->middleware('throttle:10,1,site-document');
});
Route::middleware(['auth:sanctum','abilities:media:manage'])->prefix('v1/staff')->group(function () {
    Route::get('/posts', [PostController::class, 'staffIndex']);
    Route::post('/posts', [PostController::class, 'store']);
    Route::get('/posts/{id}', [PostController::class, 'staffShow'])->whereNumber('id');
    Route::patch('/posts/{id}', [PostController::class, 'update'])->whereNumber('id');
    Route::delete('/posts/{id}', [PostController::class, 'destroy'])->whereNumber('id');
    Route::post('/posts/{id}/cover', [PostController::class, 'uploadCover'])->whereNumber('id')->middleware('throttle:10,1,post-cover');
    Route::delete('/posts/{id}/cover', [PostController::class, 'deleteCover'])->whereNumber('id')->middleware('throttle:10,1,post-cover');
    Route::get('/businesses', [BusinessController::class, 'staffIndex']);
    Route::post('/businesses', [BusinessController::class, 'store']);
    Route::get('/businesses/{id}', [BusinessController::class, 'staffShow'])->whereNumber('id');
    Route::patch('/businesses/{id}', [BusinessController::class, 'update'])->whereNumber('id');
    Route::delete('/businesses/{id}', [BusinessController::class, 'destroy'])->whereNumber('id');
    Route::post('/businesses/{id}/photo', [BusinessController::class, 'uploadPhoto'])->whereNumber('id')->middleware('throttle:10,1,business-photo');
    Route::delete('/businesses/{id}/photo', [BusinessController::class, 'deletePhoto'])->whereNumber('id')->middleware('throttle:10,1,business-photo');
});
