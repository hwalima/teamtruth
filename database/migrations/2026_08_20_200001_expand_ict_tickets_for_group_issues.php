<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ict_tickets', function (Blueprint $table) {
            // Rename to group_issues conceptually — add issue_type (broad dept) and
            // change category to string so it's not limited to the old ICT enum values
            $table->string('issue_type', 60)->nullable()->after('title')
                ->comment('Broad department/function: IT, HR, Finance, Facilities, etc.');
            $table->string('category', 100)->default('other')->change();
        });
    }

    public function down(): void
    {
        Schema::table('ict_tickets', function (Blueprint $table) {
            $table->dropColumn('issue_type');
        });
    }
};
