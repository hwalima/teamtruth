<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Replace the "Bug Assignment" email template with ICT-specific notifications
        DB::table('email_templates')
            ->where('name', 'Bug Assignment')
            ->update(['name' => 'ICT Ticket Assigned']);

        // Add new ICT ticket templates if they don't already exist
        $existing = DB::table('email_templates')->pluck('name')->toArray();

        $templates = [
            ['name' => 'ICT Ticket Submitted'],
            ['name' => 'ICT Ticket Status Updated'],
            ['name' => 'ICT Ticket Comment Added'],
        ];

        foreach ($templates as $template) {
            if (!in_array($template['name'], $existing)) {
                DB::table('email_templates')->insert([
                    'name'       => $template['name'],
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }

    public function down(): void
    {
        DB::table('email_templates')
            ->where('name', 'ICT Ticket Assigned')
            ->update(['name' => 'Bug Assignment']);

        DB::table('email_templates')
            ->whereIn('name', ['ICT Ticket Submitted', 'ICT Ticket Status Updated', 'ICT Ticket Comment Added'])
            ->delete();
    }
};
