<?php

namespace App\Providers;

use App\Models\User;
use App\Models\Plan;
use App\Models\Workspace;
use App\Observers\UserObserver;
use App\Observers\PlanObserver;
use App\Observers\WorkspaceObserver;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(\App\Services\WebhookService::class);
        $this->app->scoped(\App\Modules\Core\Services\CompanyContext::class);
        $this->app->bind(\App\Modules\Invoicing\Services\FiscalDeviceInterface::class, \App\Modules\Invoicing\Services\NullFiscalDevice::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->loadMigrationsFrom(app_path('Modules/Core/Database/Migrations'));
        $this->loadMigrationsFrom(app_path('Modules/Inventory/Database/Migrations'));
        $this->loadMigrationsFrom(app_path('Modules/Requisitions/Database/Migrations'));
        $this->loadMigrationsFrom(app_path('Modules/Purchase/Database/Migrations'));
        $this->loadMigrationsFrom(app_path('Modules/Accounting/Database/Migrations'));
        $this->loadMigrationsFrom(app_path('Modules/Invoicing/Database/Migrations'));
        $this->loadMigrationsFrom(app_path('Modules/Sales/Database/Migrations'));
        $this->loadMigrationsFrom(app_path('Modules/Hrm/Database/Migrations'));
        $this->loadMigrationsFrom(app_path('Modules/DataImport/Database/Migrations'));
        $this->loadMigrationsFrom(app_path('Modules/Banking/Database/Migrations'));
        if ($this->app->runningInConsole()) {
            $this->commands([\App\Modules\DataImport\Console\OdooImportCommand::class]);
        }

        // Register the UserObserver
        User::observe(UserObserver::class);

        // Register the PlanObserver
        Plan::observe(PlanObserver::class);

        // Register the WorkspaceObserver
        Workspace::observe(WorkspaceObserver::class);


        // Configure dynamic storage disks
        try {
            \App\Services\DynamicStorageService::configureDynamicDisks();
        } catch (\Exception $e) {
            // Silently fail during migrations or when database is not ready
        }

        // Override Spatie media-library max_file_size dynamically from DB settings
        // This runs after auth is resolved (on actual HTTP requests)
        $this->app['events']->listen('Illuminate\Auth\Events\Authenticated', function () {
            try {
                $config = \App\Services\StorageConfigService::getStorageConfig();
                $maxBytes = ($config['max_file_size_mb'] ?? 2) * 1024 * 1024;
                config(['media-library.max_file_size' => $maxBytes]);
            } catch (\Exception $e) {
                // Silently fail
            }
        });

        // Configure rate limiters for login and password reset
        // Uses email+IP for login, IP for password reset - works correctly behind proxies
        RateLimiter::for('login', function (Request $request) {
            return Limit::perMinute(5)
                ->by($request->input('email') . '|' . $request->ip());
        });

        RateLimiter::for('password-reset', function (Request $request) {
            return Limit::perMinute(3)
                ->by($request->ip());
        });
    }
}
