<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Uploaded PDF letterheads are retired: every PDF header is now built from the
 * company's logo, colours and details. Previously uploaded files stay on disk.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('company_branding', 'letterhead_path')) {
            Schema::table('company_branding', function (Blueprint $table): void {
                $table->dropColumn('letterhead_path');
            });
        }
    }

    public function down(): void
    {
        if (! Schema::hasColumn('company_branding', 'letterhead_path')) {
            Schema::table('company_branding', function (Blueprint $table): void {
                $table->string('letterhead_path')->nullable()->after('logo_path');
            });
        }
    }
};
