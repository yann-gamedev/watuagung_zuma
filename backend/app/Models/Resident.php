<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Resident extends Model
{
    protected $fillable = ['dummy_reference', 'nik', 'nama', 'tempat_lahir', 'tanggal_lahir', 'is_dummy'];

    // Identity must not leak through automatic JSON serialization.
    protected $hidden = ['nik', 'nama', 'tempat_lahir', 'tanggal_lahir', 'dummy_reference'];

    protected function casts(): array
    {
        return [
            'nik' => 'encrypted',
            'nama' => 'encrypted',
            'tempat_lahir' => 'encrypted',
            'tanggal_lahir' => 'encrypted',
            'is_dummy' => 'boolean',
        ];
    }
}
