<?php

namespace App\Modules\Hrm\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Core\Models\Company;
use App\Modules\Core\Services\CompanyContext;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Support\Facades\Gate;

/**
 * Base for HRM controllers: policy checks ($this->authorize) and the active company.
 */
abstract class HrmController extends Controller
{
    use AuthorizesRequests;

    protected function company(): Company
    {
        return app(CompanyContext::class)->requireActiveCompany();
    }

    protected function allows(string $ability, mixed $arguments = []): bool
    {
        return Gate::allows($ability, $arguments);
    }
}
