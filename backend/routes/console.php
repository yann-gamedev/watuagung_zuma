<?php

use App\Domain\ApplicationStatus;
use App\Models\User;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Membuat akun panel lokal; kata sandi diminta tersembunyi dan tidak pernah disimpan di repositori.
Artisan::command('staff:create {username} {--role=staff} {--name=} {--email=} {--rt=} {--rw=}', function (string $username) {
    $role = $this->option('role');
    $data = ['username' => $username, 'role' => $role, 'name' => $this->option('name') ?: $username, 'email' => $this->option('email') ?: "$username@example.test"];
    $data += ['rt' => $this->option('rt'), 'rw' => $this->option('rw')];
    $validator = Validator::make($data, [
        'rt' => ['required_if:role,rt_head', 'nullable', 'string', 'regex:/\A[0-9]{1,3}\z/'],
        'rw' => ['required_if:role,rt_head,rw_head', 'nullable', 'string', 'regex:/\A[0-9]{1,3}\z/'],
        'username' => ['required', 'max:64', 'regex:/\A[a-z0-9][a-z0-9_-]*\z/', 'unique:users,username'],
        'role' => ['required', Rule::in(ApplicationStatus::PANEL_ROLES)],
        'name' => ['required', 'string', 'max:255'],
        'email' => ['required', 'email', 'max:255', 'unique:users,email'],
    ]);
    if ($validator->fails()) {
        foreach ($validator->errors()->all() as $message) $this->error($message);
        return 1;
    }
    $password = (string) $this->secret('Kata sandi (minimal 12 karakter)');
    if (mb_strlen($password) < 12 || $password !== (string) $this->secret('Ulangi kata sandi')) {
        $this->error('Kata sandi kurang dari 12 karakter atau tidak sama.');
        return 1;
    }
    User::create($data + ['password' => $password]);
    $this->info("Akun $username ($role) dibuat.");
    return 0;
})->purpose('Buat akun panel petugas (staff, village_head, admin, rt_head, rw_head)');

// Hapus token petugas yang sudah kedaluwarsa lebih dari 24 jam.
Schedule::command('sanctum:prune-expired --hours=24')->daily();
