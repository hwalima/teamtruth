<?php

use App\Modules\Core\Models\Company;
use App\Modules\Core\Services\ErpRoleService;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('company_erp_roles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->string('name', 80);
            $table->string('slug', 96);
            $table->json('permissions');
            $table->boolean('is_system')->default(false);
            $table->timestamps();

            $table->unique(['company_id', 'slug']);
            $table->index(['company_id', 'is_system']);
        });

        Schema::table('company_user', function (Blueprint $table) {
            $table->foreignId('erp_role_id')->nullable()->after('role')
                ->constrained('company_erp_roles')->nullOnDelete();
        });

        foreach (Company::query()->get() as $company) {
            app(ErpRoleService::class)->createDefaultRoles($company);
            $roles = DB::table('company_erp_roles')
                ->where('company_id', $company->id)
                ->pluck('id', 'slug');
            foreach ($company->users as $user) {
                $legacyRole = in_array($user->pivot->role, ['owner', 'admin', 'finance', 'manager', 'member'], true)
                    ? $user->pivot->role
                    : 'member';
                DB::table('company_user')
                    ->where('company_id', $company->id)
                    ->where('user_id', $user->id)
                    ->update(['erp_role_id' => $roles[$legacyRole]]);
            }
        }
    }

    public function down(): void
    {
        Schema::table('company_user', function (Blueprint $table) {
            $table->dropConstrainedForeignId('erp_role_id');
        });
        Schema::dropIfExists('company_erp_roles');
    }
};
