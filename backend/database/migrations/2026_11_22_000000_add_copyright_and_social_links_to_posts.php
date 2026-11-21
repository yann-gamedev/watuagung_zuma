<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            // Opsional per berita: "© {tahun terbit} KIM Desa Watuagung" di akhir isi.
            $table->boolean('show_copyright')->default(false);
            // Tautan unggahan berita yang sama di media sosial; domain dibatasi App\Domain\SocialPlatform.
            $table->string('instagram_url', 500)->nullable();
            $table->string('tiktok_url', 500)->nullable();
            $table->string('youtube_url', 500)->nullable();
            $table->string('facebook_url', 500)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            $table->dropColumn(['show_copyright', 'instagram_url', 'tiktok_url', 'youtube_url', 'facebook_url']);
        });
    }
};
