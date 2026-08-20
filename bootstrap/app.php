<?php

use App\Http\Middleware\HandleAppearance;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\ShareGlobalSettings;
use App\Http\Middleware\CheckInstallation;
use App\Http\Middleware\DemoModeMiddleware;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->encryptCookies(except: ['appearance']);

        $middleware->web(append: [
            CheckInstallation::class,
            HandleAppearance::class,
            ShareGlobalSettings::class,
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
            DemoModeMiddleware::class,
        ]);

        $middleware->alias([
            'role' => \Spatie\Permission\Middleware\RoleMiddleware::class,
            'permission' => \Spatie\Permission\Middleware\PermissionMiddleware::class,
            'permissions' => \App\Http\Middleware\CheckMultiplePermissions::class,
            'role_or_permission' => \Spatie\Permission\Middleware\RoleOrPermissionMiddleware::class,
            'landing.enabled' => \App\Http\Middleware\CheckLandingPageEnabled::class,
            'verified' => App\Http\Middleware\EnsureEmailIsVerified::class,
            'plan.access' => \App\Http\Middleware\CheckPlanAccess::class,
            'plan.limits' => \App\Http\Middleware\CheckPlanLimits::class,
            'saas.only' => \App\Http\Middleware\SaasOnly::class,
        ]);

        $middleware->validateCsrfTokens(
        except: [
            'install/*',
            'update/*',
            'cashfree/create-session', 
            'cashfree/webhook',
            'ozow/create-payment',
            'payments/easebuzz/success',
            'payments/easebuzz/invoice-success',
            'payments/ozow/invoice-success',
            'payments/aamarpay/success',
            'payments/aamarpay/callback',
            'aamarpay/create-invoice-payment',
            'aamarpay/invoice/success',
            'aamarpay/invoice/success/*',
            'aamarpay/invoice/callback',
            'midtrans/invoice/success/*',
            'midtrans/invoice/callback',
            'yookassa/invoice/success/*',
            'yookassa/invoice/callback',
            'paiement/invoice/success/*',
            'paiement/invoice/callback-link',
            'cinetpay/invoice/success/*',
            'cinetpay/invoice/callback-link',
            'payhere/invoice/success/*',
            'payhere/invoice/callback-link',
            'payments/tap/success',
            'payments/tap/callback',
            'payments/benefit/success',
            'payments/benefit/callback',
            'payments/paytabs/callback',
            'payments/iyzipay/success',
            'payments/iyzipay/callback',
            'iyzipay/invoice/success',
            'iyzipay/invoice/callback',
            'khalti/invoice-payment/*',
            'khalti/invoice/success/*',
            'easebuzz/invoice-payment/*',
            'easebuzz/invoice/success/*',
            'api/media/batch'
            ],
        );

    })
    ->withExceptions(function (Exceptions $exceptions) {
        //
    })->create();
