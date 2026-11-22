<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * The disciplinary workflow needs somewhere to keep the hearing details and
 * the notes recorded at each step (investigation findings, notice, hearing).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('hrm_disciplinary_cases', function (Blueprint $table) {
            $table->dateTime('hearing_at')->nullable()->after('evidence_attachments');
            $table->string('hearing_location')->nullable()->after('hearing_at');
            $table->json('timeline')->nullable()->after('appeal_date');
        });
    }

    public function down(): void
    {
        Schema::table('hrm_disciplinary_cases', function (Blueprint $table) {
            $table->dropColumn(['hearing_at', 'hearing_location', 'timeline']);
        });
    }
};
