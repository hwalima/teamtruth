<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Rename email templates to reflect group-wide issue reporting
        DB::table('email_templates')->where('name', 'ICT Ticket Assigned')
            ->update(['name' => 'Group Issue Assigned']);
        DB::table('email_templates')->where('name', 'ICT Ticket Submitted')
            ->update(['name' => 'Group Issue Submitted']);
        DB::table('email_templates')->where('name', 'ICT Ticket Status Updated')
            ->update(['name' => 'Group Issue Status Updated']);
        DB::table('email_templates')->where('name', 'ICT Ticket Comment Added')
            ->update(['name' => 'Group Issue Comment Added']);
    }

    public function down(): void
    {
        DB::table('email_templates')->where('name', 'Group Issue Assigned')
            ->update(['name' => 'ICT Ticket Assigned']);
        DB::table('email_templates')->where('name', 'Group Issue Submitted')
            ->update(['name' => 'ICT Ticket Submitted']);
        DB::table('email_templates')->where('name', 'Group Issue Status Updated')
            ->update(['name' => 'ICT Ticket Status Updated']);
        DB::table('email_templates')->where('name', 'Group Issue Comment Added')
            ->update(['name' => 'ICT Ticket Comment Added']);
    }
};
