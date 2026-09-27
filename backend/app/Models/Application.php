<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Application extends Model
{
    protected $guarded = ['id'];
    protected $hidden = ['id', 'lookup_secret_hash', 'nik', 'no_kk', 'telepon', 'alamat', 'alamat_usaha'];
    protected function casts(): array {
        return ['nik' => 'encrypted', 'no_kk' => 'encrypted', 'telepon' => 'encrypted', 'alamat' => 'encrypted', 'alamat_usaha' => 'encrypted', 'tanggal_lahir' => 'date:Y-m-d'];
    }
}
