<?php
use App\Http\Controllers\Api\ApplicationController;
use App\Http\Controllers\Api\LetterController;
use App\Http\Controllers\Api\StaffController;
use App\Http\Controllers\Api\StaffUserController;
use Illuminate\Support\Facades\Route;
Route::post('/v1/applications', [ApplicationController::class, 'store'])->middleware('throttle:5,1');
Route::post('/v1/applications/status', [ApplicationController::class, 'status'])->middleware('throttle:10,1');
Route::post('/v1/staff/login', [StaffController::class, 'login'])->middleware('throttle:5,1');
Route::get('/v1/verify/{code}', [LetterController::class, 'verify'])->middleware('throttle:30,1');
Route::middleware(['auth:sanctum','abilities:applications:manage'])->prefix('v1/staff')->group(function () {
    Route::post('/logout', [StaffController::class, 'logout']);
    Route::get('/me', [StaffController::class, 'me']);
    Route::get('/letter-register', [StaffController::class, 'letterRegister']);
    Route::get('/summary', [StaffController::class, 'summary']);
    Route::get('/applications', [StaffController::class, 'index']);
    Route::get('/applications/{request_id}', [StaffController::class, 'show']);
    Route::patch('/applications/{application:request_id}/status', [StaffController::class, 'update']);
    Route::post('/applications/{request_id}/lookup-secret', [StaffController::class, 'resetAccessCode'])->middleware('throttle:10,1');
    Route::get('/applications/{request_id}/letter.pdf', [LetterController::class, 'download'])->middleware('throttle:30,1');
    Route::post('/applications/{request_id}/letter.pdf', [LetterController::class, 'upload'])->middleware('throttle:10,1');
    Route::get('/applications/{request_id}/letter-qr.png', [LetterController::class, 'qr']);
    Route::post('/me/password', [StaffUserController::class, 'changeOwnPassword']);
    Route::get('/users', [StaffUserController::class, 'index']);
    Route::post('/users', [StaffUserController::class, 'store']);
    Route::patch('/users/{id}', [StaffUserController::class, 'update']);
    Route::post('/users/{id}/reset-password', [StaffUserController::class, 'resetPassword']);
});
