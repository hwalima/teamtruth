<?php

namespace App\Modules\Hrm\Providers;

use App\Modules\Hrm\Services\ContractService;
use App\Modules\Hrm\Services\DisciplinaryService;
use App\Modules\Hrm\Services\EmployeeService;
use App\Modules\Hrm\Services\LeaveService;
use App\Modules\Hrm\Services\SelfServiceService;
use Illuminate\Support\ServiceProvider;

class HrmServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // Register services as singletons
        $this->app->singleton(EmployeeService::class);
        $this->app->singleton(LeaveService::class);
        $this->app->singleton(ContractService::class);
        $this->app->singleton(DisciplinaryService::class);
        $this->app->singleton(SelfServiceService::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // HRM permissions belong to the company's ERP role, not the site-wide
        // permission tables, so answer every erp.hrm.* ability from ErpRoleService.
        \Illuminate\Support\Facades\Gate::before(function ($user, string $ability) {
            if (! str_starts_with($ability, 'erp.hrm.')) {
                return null;
            }

            $company = app(\App\Modules\Core\Services\CompanyContext::class)->activeCompany();

            return $company !== null
                && app(\App\Modules\Core\Services\ErpRoleService::class)->allows($company, $user, $ability);
        });

        // Register policies
        $this->registerPolicies();

        // Register model observers
        $this->registerObservers();

        // Register custom validation rules
        $this->registerValidationRules();
    }

    /**
     * Register model policies
     */
    protected function registerPolicies(): void
    {
        $policies = [
            \App\Modules\Hrm\Models\Employee::class => \App\Modules\Hrm\Policies\EmployeePolicy::class,
            \App\Modules\Hrm\Models\LeaveRequest::class => \App\Modules\Hrm\Policies\LeaveRequestPolicy::class,
            \App\Modules\Hrm\Models\LeaveBalance::class => \App\Modules\Hrm\Policies\LeaveBalancePolicy::class,
            \App\Modules\Hrm\Models\Contract::class => \App\Modules\Hrm\Policies\ContractPolicy::class,
            \App\Modules\Hrm\Models\ContractTemplate::class => \App\Modules\Hrm\Policies\ContractTemplatePolicy::class,
            \App\Modules\Hrm\Models\Department::class => \App\Modules\Hrm\Policies\DepartmentPolicy::class,
            \App\Modules\Hrm\Models\Position::class => \App\Modules\Hrm\Policies\PositionPolicy::class,
            \App\Modules\Hrm\Models\Grade::class => \App\Modules\Hrm\Policies\GradePolicy::class,
            \App\Modules\Hrm\Models\CostCenter::class => \App\Modules\Hrm\Policies\CostCenterPolicy::class,
            \App\Modules\Hrm\Models\DisciplinaryCase::class => \App\Modules\Hrm\Policies\DisciplinaryCasePolicy::class,
            \App\Modules\Hrm\Models\SelfServiceRequest::class => \App\Modules\Hrm\Policies\SelfServiceRequestPolicy::class,
        ];

        foreach ($policies as $model => $policy) {
            if (class_exists($policy)) {
                \Illuminate\Support\Facades\Gate::policy($model, $policy);
            }
        }
    }

    /**
     * Register model observers
     */
    protected function registerObservers(): void
    {
        // Observers will be added when created
    }

    /**
     * Register custom validation rules
     */
    protected function registerValidationRules(): void
    {
        // Custom validation rules can be registered here
    }
}