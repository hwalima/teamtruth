<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Replace legacy blue buttons with gold/navy brand buttons in every language variant
        DB::table('email_template_langs')
            ->get()
            ->each(function ($row) {
                $content = $row->content;

                // Replace #007bff background with gold gradient
                $content = preg_replace(
                    '/background-color\s*:\s*#007bff\s*;/i',
                    'background:linear-gradient(135deg,#E3B448 0%,#c99a2e 100%);',
                    $content
                );
                // Replace white button text with navy
                $content = preg_replace(
                    '/color\s*:\s*white\s*;/i',
                    'color:#001a4d;',
                    $content
                );
                // Modernise border-radius
                $content = preg_replace(
                    '/border-radius\s*:\s*5px\s*;/i',
                    'border-radius:8px;',
                    $content
                );

                if ($content !== $row->content) {
                    DB::table('email_template_langs')
                        ->where('id', $row->id)
                        ->update(['content' => $content]);
                }
            });
    }

    public function down(): void {}
};
