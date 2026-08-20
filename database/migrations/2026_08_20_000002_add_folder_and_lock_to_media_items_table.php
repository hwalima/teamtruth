<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('media_items', function (Blueprint $table) {
            $table->foreignId('folder_id')->nullable()->after('user_id')->constrained('media_folders')->nullOnDelete();
            $table->boolean('is_locked')->default(false)->after('folder_id');
        });
    }

    public function down(): void
    {
        Schema::table('media_items', function (Blueprint $table) {
            $table->dropForeign(['folder_id']);
            $table->dropColumn(['folder_id', 'is_locked']);
        });
    }
};
