<?php
use App\Http\Controllers\Api\ApplicationController;
use App\Http\Controllers\Api\StaffController;
use Illuminate\Support\Facades\Route;
Route::post('/v1/applications', [ApplicationController::class, 'store'])->middleware('throttle:5,1');
Route::post('/v1/applications/status', [ApplicationController::class, 'status'])->middleware('throttle:10,1');
Route::post('/v1/staff/login', [StaffController::class, 'login'])->middleware('throttle:5,1');
Route::middleware(['auth:sanctum','abilities:applications:manage'])->prefix('v1/staff')->group(function () {
    Route::post('/logout', [StaffController::class, 'logout']);
    Route::get('/applications', [StaffController::class, 'index']);
    Route::patch('/applications/{application:request_id}/status', [StaffController::class, 'update']);
});
