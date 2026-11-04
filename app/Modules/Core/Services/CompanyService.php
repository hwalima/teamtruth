<?php

namespace App\Modules\Core\Services;

use App\Models\User;
use App\Modules\Core\Models\Company;
use Illuminate\Support\Facades\DB;
use Throwable;

class CompanyService
{
    public function createForUser(User $user, array $attributes): Company
    {
        $context = app(CompanyContext::class);
        $previousCompany = $context->activeCompany();

        try {
            return DB::transaction(function () use ($user, $attributes, $context): Company {
                $company = Company::create($attributes);
                $company->users()->attach($user->id, [
                    'role' => 'owner',
                    'is_active' => true,
                ]);
                $context->setActiveCompany($company);
                app(AuditLogService::class)->record($company, 'company.created', $company, [
                    'code' => ['new' => $company->code],
                    'name' => ['new' => $company->name],
                ], actor: $user);

                return $company;
            });
        } catch (Throwable $exception) {
            $context->setActiveCompany($previousCompany);
            throw $exception;
        }
    }
}
