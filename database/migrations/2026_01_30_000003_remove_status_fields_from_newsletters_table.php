<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('newsletters')) {
            Schema::table('newsletters', function (Blueprint $table) {
                // Drop index that depends on status column first (SQLite requirement)
                if (Schema::hasColumn('newsletters', 'status')) {
                    try {
                        $table->dropIndex('newsletters_status_created_at_index');
                    } catch (\Throwable) {
                        // Index might not exist or have different name
                    }
                }
                if (Schema::hasColumn('newsletters', 'subscribed_at')) {
                    $table->dropColumn('subscribed_at');
                }
                if (Schema::hasColumn('newsletters', 'unsubscribed_at')) {
                    $table->dropColumn('unsubscribed_at');
                }
                if (Schema::hasColumn('newsletters', 'status')) {
                    $table->dropColumn('status');
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('newsletters')) {
            Schema::table('newsletters', function (Blueprint $table) {
                if (!Schema::hasColumn('newsletters', 'subscribed_at')) {
                    $table->timestamp('subscribed_at')->nullable();
                }
                if (!Schema::hasColumn('newsletters', 'unsubscribed_at')) {
                    $table->timestamp('unsubscribed_at')->nullable();
                }
                if (!Schema::hasColumn('newsletters', 'status')) {
                    $table->enum('status', ['subscribed', 'unsubscribed'])->default('subscribed');
                }
            });
        }
    }
};
