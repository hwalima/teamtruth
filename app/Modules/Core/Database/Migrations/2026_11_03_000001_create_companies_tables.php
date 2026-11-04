<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('companies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('parent_id')->nullable()->constrained('companies')->nullOnDelete();
            $table->string('code', 32)->unique();
            $table->string('name');
            $table->string('legal_name')->nullable();
            $table->string('registration_no')->nullable();
            $table->string('tax_no')->nullable();
            $table->string('vat_no')->nullable();
            $table->text('address')->nullable();
            $table->string('phone')->nullable();
            $table->string('email')->nullable();
            $table->string('website')->nullable();
            $table->string('default_currency', 3)->default('USD');
            $table->string('timezone', 64)->default('Africa/Harare');
            $table->unsignedTinyInteger('fiscal_year_start_month')->default(1);
            $table->unsignedTinyInteger('fiscal_year_start_day')->default(1);
            $table->string('status', 20)->default('active');
            $table->timestamps();

            $table->index(['parent_id', 'status']);
        });

        Schema::create('company_user', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->restrictOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('role', 32)->default('member');
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['company_id', 'user_id']);
            $table->index(['user_id', 'is_active']);
        });

        Schema::create('company_branding', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('logo_path')->nullable();
            $table->string('logo_dark_path')->nullable();
            $table->string('favicon_path')->nullable();
            $table->string('primary_color', 7)->nullable();
            $table->string('secondary_color', 7)->nullable();
            $table->string('accent_color', 7)->nullable();
            $table->text('letterhead_footer_text')->nullable();
            $table->json('bank_details')->nullable();
            $table->timestamps();
        });

        Schema::create('company_signatories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name');
            $table->string('title');
            $table->string('signature_image_path')->nullable();
            $table->string('stamp_image_path')->nullable();
            $table->string('applies_to_document_type')->nullable();
            $table->string('approval_level')->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['company_id', 'is_active', 'sort_order']);
            $table->index(['company_id', 'user_id', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('company_signatories');
        Schema::dropIfExists('company_branding');
        Schema::dropIfExists('company_user');
        Schema::dropIfExists('companies');
    }
};
