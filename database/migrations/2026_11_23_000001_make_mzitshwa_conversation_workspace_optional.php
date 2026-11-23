<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** ERP-only users have no workspace, but can still talk to Mzitshwa. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('mzitshwa_conversations', function (Blueprint $table) {
            $table->foreignId('workspace_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        // Left nullable: rows without a workspace may exist by now.
    }
};
