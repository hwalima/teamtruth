<?php

namespace App\Providers;

use App\Models\Bug;
use App\Policies\BugPolicy;
use App\Modules\Sales\Models\Lead;
use App\Modules\Sales\Models\Opportunity;
use App\Modules\Sales\Models\Quotation;
use App\Modules\Sales\Models\SalesOrder;
use App\Modules\Sales\Models\SalesTeam;
use App\Modules\Sales\Policies\LeadPolicy;
use App\Modules\Sales\Policies\OpportunityPolicy;
use App\Modules\Sales\Policies\QuotationPolicy;
use App\Modules\Sales\Policies\SalesOrderPolicy;
use App\Modules\Sales\Policies\SalesTeamPolicy;
use Illuminate\Foundation\Support\Providers\AuthServiceProvider as ServiceProvider;

class AuthServiceProvider extends ServiceProvider
{
    /**
     * The policy mappings for the application.
     *
     * @var array<class-string, class-string>
     */
    protected $policies = [
        Bug::class => BugPolicy::class,
        Lead::class => LeadPolicy::class,
        Opportunity::class => OpportunityPolicy::class,
        Quotation::class => QuotationPolicy::class,
        SalesOrder::class => SalesOrderPolicy::class,
        SalesTeam::class => SalesTeamPolicy::class,
    ];

    /**
     * Register any authentication / authorization services.
     */
    public function boot(): void
    {
        $this->registerPolicies();
    }
}