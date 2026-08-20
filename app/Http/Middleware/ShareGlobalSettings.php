<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Artisan;

class ShareGlobalSettings
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next)
    {
        // Check storage link once per process, not on every request
        static $storageLinkChecked = false;
        if (!$storageLinkChecked) {
            $this->ensureStorageLink();
            $storageLinkChecked = true;
        }

        // Skip during installation — HandleInertiaRequests already shares globalSettings;
        // this middleware only needs to add the saas/demo flags for non-Inertia responses.
        if (!$request->is('install/*') && !$request->is('update/*') && file_exists(storage_path('installed'))) {
            Inertia::share([
                'isSaasMode' => isSaasMode(),
                'isDemoMode' => config('app.is_demo', false),
                'is_demo'    => config('app.is_demo', false),
                'is_saas'    => config('app.is_saas', false),
            ]);
        }

        return $next($request);
    }

     /**

     * Ensure storage symlink exists

     */

    private function ensureStorageLink()

    {

        if (!File::exists(public_path('storage'))) {
            try {
                Artisan::call('storage:link');
            } catch (\Exception $e) {
                // Silently fail if unable to create link

            }

        }

    }
}