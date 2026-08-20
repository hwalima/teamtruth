<?php

namespace App\Http\Middleware;

use Illuminate\Foundation\Inspiring;
use Illuminate\Http\Request;
use Inertia\Middleware;
use Tighten\Ziggy\Ziggy;
use App\Models\Currency;
use Illuminate\Support\Facades\DB;
use App\Models\PlanOrder;
use Spatie\Permission\Models\Role;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        [$message, $author] = str(Inspiring::quotes()->random())->explode('-');

        // Initialize storage settings with defaults
        $storageSettings = [
            'allowed_file_types' => 'jpg,png,webp,gif',
            'max_file_size' => 2048,
        ];

        // Skip database queries during installation
        if ($request->is('install/*') || $request->is('update/*') || !file_exists(storage_path('installed'))) {
            // Get available languages even during installation
            $languagesFile = resource_path('lang/language.json');
            $availableLanguages = [];
            if (file_exists($languagesFile)) {
                $availableLanguages = json_decode(file_get_contents($languagesFile), true) ?? [];
            }

            $globalSettings = [
                'currencySymbol' => '$',
                'currencyNname' => 'US Dollar',
                'base_url' => config('app.url'),
                'is_demo' => config('app.is_demo', false),
                'availableLanguages' => $availableLanguages,
            ];
        } else {
            $user = $request->user();
            $isDemo = config('app.is_demo');
            $isSaas = isSaasMode();

            // In demo mode, override current_workspace_id from cookie
            if ($isDemo && $user) {
                $cookieKey = isSaasMode() ? 'saas_current_workspace_id' : 'nonsaas_current_workspace_id';
                $cookieWorkspaceId = $request->cookie($cookieKey);
                if ($cookieWorkspaceId) {
                    $workspace = \App\Models\Workspace::find($cookieWorkspaceId);
                    if ($workspace && $user->canAccessWorkspace($workspace)) {
                        $user->current_workspace_id = (int) $cookieWorkspaceId;
                    }
                }
            }
            if ($isDemo) {
                // DEMO MODE: Use base settings with cookie overrides
                $settings = settings();
                $settings = $this->applyCookieOverrides($request, $settings);
            } else {
                // NORMAL MODE: Use database with cookie overrides for user preferences
                if ($isSaas) {
                    // SaaS Mode
                    if ($user && $user->type === 'superadmin') {
                        // Superadmin: use own settings (workspace_id = null)
                        $settings = settings($user->id, null);
                    } elseif ($user && $user->current_workspace_id) {
                        // Company/member inside workspace: use workspace owner settings
                        $workspace = $user->currentWorkspace;
                        if ($workspace && $workspace->owner_id) {
                            $settings = settings($workspace->owner_id, $user->current_workspace_id);
                        } else {
                            $settings = settings($user->id, $user->current_workspace_id);
                        }
                    } else {
                        // Login/register pages: use superadmin settings
                        $settings = settings();
                    }
                    // Apply user preference cookies for sidebar and layout (SaaS)
                    $settings = $this->applyUserPreferenceCookies($request, $settings);
                } else {
                    // Non-SaaS Mode - fetch workspace-specific settings
                    if ($user && $user->current_workspace_id) {
                        $workspace = $user->currentWorkspace;
                        if ($workspace && $workspace->owner_id) {
                            $settings = settings($workspace->owner_id, $workspace->id);
                        } else {
                            $settings = settings($user->id, $user->current_workspace_id);
                        }
                    } else {
                        $settings = settings();
                    }
                }
            }

            // Get currency symbol with error handling
            $currencyCode = $settings['defaultCurrency'] ?? 'USD';
            $currencySettings = [
                'currencySymbol' => '$',
                'currencyNname' => 'US Dollar'
            ];

            try {
                $currency = Currency::where('code', $currencyCode)->first();
                if ($currency) {
                    $currencySettings = [
                        'currencySymbol' => $currency->symbol,
                        'currencyNname' => $currency->name
                    ];
                }
            } catch (\Exception $e) {
                // Log the error but continue with default currency
                \Log::warning('Failed to fetch currency: ' . $e->getMessage());
            }

            // Get available languages
            $languagesFile = resource_path('lang/language.json');
            $availableLanguages = [];
            if (file_exists($languagesFile)) {
                $availableLanguages = json_decode(file_get_contents($languagesFile), true) ?? [];
            }

            // Merge currency settings with other settings
            $globalSettings = array_merge($settings, $currencySettings);
            // Override theme mode with user-specific setting
            $globalSettings['themeMode'] = getSetting('themeMode',$settings['themeMode'] ?? 'light',auth()?->id());
            //$globalSettings['layoutDirection'] = getSetting('layoutDirection', $settings['layoutDirection'] ?? 'left', auth()?->id());
            if (auth()->user() && $this->getUserWorkspaceRole($request) === 'owner') {
            if (isSaasMode()) {
            $lastPlanOrder = PlanOrder::where('user_id', auth()->id())->whereNotNull('processed_at')->orderByDesc('processed_at')->first();
                if($lastPlanOrder){
                    $globalSettings['planExirationDate'] = $lastPlanOrder->billing_cycle == 'monthly' 
                        ? ($lastPlanOrder?->processed_at?->addMonth() ?? null) 
                        : ($lastPlanOrder?->processed_at?->addYear() ?? null);

                }
                }
            }

            // Load cookie settings globally
            try {
                if ($isSaas) {
                    // SaaS: Load from superadmin settings
                    $superadmin = \App\Models\User::where('type', 'superadmin')->first();
                    if ($superadmin) {
                        $cookieSettings = \App\Models\Setting::where('user_id', $superadmin->id)
                            ->whereNull('workspace_id')
                            ->whereIn('key', ['enableLogging', 'strictlyNecessaryCookies', 'cookieTitle', 'strictlyCookieTitle', 'cookieDescription', 'strictlyCookieDescription', 'contactUsDescription', 'contactUsUrl'])
                            ->pluck('value', 'key')
                            ->toArray();
                        $globalSettings = array_merge($globalSettings, $cookieSettings);
                    }
                } else {
                    // Non-SaaS: Load from company owner settings
                    $companyOwner = \App\Models\User::where('type', 'company')
                        ->where(function ($q) {
                            $q->whereNull('created_by')->orWhere('created_by', 0);
                        })
                        ->first();
                    if ($companyOwner) {
                        $cookieSettings = \App\Models\Setting::where('user_id', $companyOwner->id)
                            ->whereNull('workspace_id')
                            ->whereIn('key', ['enableLogging', 'strictlyNecessaryCookies', 'cookieTitle', 'strictlyCookieTitle', 'cookieDescription', 'strictlyCookieDescription', 'contactUsDescription', 'contactUsUrl'])
                            ->pluck('value', 'key')
                            ->toArray();
                        $globalSettings = array_merge($globalSettings, $cookieSettings);
                    }
                }
            } catch (\Exception $e) {
                \Log::warning('Failed to load cookie settings: ' . $e->getMessage());
            }

            $globalSettings['base_url'] = config('app.url');
            $globalSettings['is_saas'] = isSaasMode();
            $globalSettings['is_demo'] = config('app.is_demo', false);
            $globalSettings['availableLanguages'] = $availableLanguages;

            // Handle layout direction properly
            if (config('app.is_demo')) {
                $currentLang = $request->cookie('app_language', $globalSettings['defaultLanguage'] ?? 'en');
                $layoutDirection = $request->cookie('layoutDirection');

                if ($layoutDirection === 'right' || in_array($currentLang, ['ar', 'he'])) {
                    $globalSettings['layoutDirection'] = 'right';
                } else {
                    $globalSettings['layoutDirection'] = 'left';
                }
            } else {
                if ($user) {
                    // For non-owner workspace members, check their own layoutDirection setting
                    $userLayoutDirection = \App\Models\Setting::where('user_id', $user->id)
                        ->where('workspace_id', $user->current_workspace_id)
                        ->where('key', 'layoutDirection')
                        ->value('value');
                    $globalSettings['layoutDirection'] = $userLayoutDirection ?? $globalSettings['layoutDirection'] ?? 'left';
                } else {
                    $globalSettings['layoutDirection'] = $globalSettings['layoutDirection'] ?? 'left';
                }
            }

            // Add meeting test settings for sidebar
            if ($user && $user->current_workspace_id) {
                $workspaceId = $user->current_workspace_id;
                $workspace = $user->currentWorkspace;
                $ownerId = $workspace->owner_id ?? $user->id;

                $globalSettings['is_zoom_meeting_test'] = getSetting('is_zoom_meeting_test', '0', $ownerId, $workspaceId);
                $globalSettings['is_google_meeting_test'] = getSetting('is_google_meeting_test', '0', $ownerId, $workspaceId);
            }

            // Get storage settings based on SaaS mode
            if ($isSaas) {
                // SaaS Mode: Get from superadmin settings
                $superadmin = \App\Models\User::where('type', 'superadmin')->first();
                if ($superadmin) {
                    $storageSettings = [
                        'allowed_file_types' => getSetting('storage_file_types', 'jpg,png,webp,gif', $superadmin->id, null),
                        'max_file_size' => getSetting('storage_max_file_size', 2048, $superadmin->id, null),
                    ];
                }
            } else {
                // Non-SaaS Mode: Get from current workspace settings
                if ($user && $user->current_workspace_id) {
                    $workspace = $user->currentWorkspace;
                    if ($workspace && $workspace->owner_id) {
                        $storageSettings = [
                            'allowed_file_types' => getSetting('storage_file_types', 'jpg,png,webp,gif', $workspace->owner_id, $workspace->id),
                            'max_file_size' => getSetting('storage_max_file_size', 2048, $workspace->owner_id, $workspace->id),
                        ];
                    }
                }
            }

        }
        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'base_url' => config('app.url'),
            'quote' => ['message' => trim($message), 'author' => trim($author)],
            'csrf_token' => csrf_token(),
            'auth' => [
                'user' => $request->user() ? array_merge(
                    $request->user()->loadMissing(['currentWorkspace', 'ownedWorkspaces', 'workspaces', 'plan'])->toArray(),
                    ['workspace_role' => $this->getUserWorkspaceRole($request)],
                    [
                        'avatar' => check_file($request->user()->avatar) ? get_file($request->user()->avatar) : get_file('avatars/avatar.png'),
                    ]
                ) : null,
                'roles' => fn() => $this->getUserRoles($request),
                'permissions' => fn() => $this->getUserPermissions($request),
            ],
            'workspaceSettings' => fn() => $this->getWorkspaceSettings($request),
            'isImpersonating' => session('impersonated_by') ? true : false,
            'ziggy' => fn(): array => [
                ...(new Ziggy)->toArray(),
                'location' => $request->url(),
            ],
            'flash' => [
                'success' => $request->session()->pull('success'),
                'error' => $request->session()->pull('error'),
                'status' => $request->session()->pull('status'),
                'statusType' => $request->session()->pull('statusType'),
            ],
            'globalSettings' => $globalSettings,
            'storageSettings' => $storageSettings,
            'userLanguage' => config('app.is_demo')
                ? $request->cookie('app_language', $request->user()?->lang ?? $globalSettings['defaultLanguage'] ?? 'en')
                : ($request->user()?->lang ?? $globalSettings['defaultLanguage'] ?? 'en'),
            'is_demo' => config('app.is_demo', false),
            'isDemoMode' => config('app.is_demo', false),
            'isSaasMode' => isSaasMode(),
            'is_saas' => isSaasMode()

        ];
    }

    /**
     * Get user workspace role
     */
    private function getUserWorkspaceRole(Request $request): ?string
    {
        $user = $request->user();
        if (!$user || !$user->current_workspace_id) {
            return null;
        }

        $workspaceMember = \App\Models\WorkspaceMember::where('user_id', $user->id)
            ->where('workspace_id', $user->current_workspace_id)
            ->first();

        return $workspaceMember?->role;
    }

    /**
     * Get workspace-specific settings for the current user
     */
    private function getWorkspaceSettings(Request $request): array
    {
        $user = $request->user();

        if (!$user || !$user->current_workspace_id) {
            return [];
        }

        // Check session first for immediate access after workspace switch
        $sessionSettings = session('workspace_settings');
        $sessionPaymentSettings = session('workspace_payment_settings');

        if ($sessionSettings) {
            $settings = $sessionSettings;
            $settings['payment_settings'] = $sessionPaymentSettings ?? [];
            return $settings;
        }

        // Fallback to database query
        $workspace = $user->currentWorkspace;
        if (!$workspace) {
            return [];
        }

        $paymentSettings = \App\Models\PaymentSetting::getUserSettings($user->id, $workspace->id);

        return [
            'timesheet_enabled' => $workspace->timesheet_enabled,
            'timesheet_approval_required' => $workspace->timesheet_approval_required,
            'timesheet_auto_submit' => $workspace->timesheet_auto_submit,
            'timesheet_reminder_days' => $workspace->timesheet_reminder_days,
            'default_work_start' => $workspace->default_work_start?->format('H:i'),
            'default_work_end' => $workspace->default_work_end?->format('H:i'),
            'settings' => $workspace->settings ?? [],
            'payment_settings' => $paymentSettings
        ];
    }

    /**
     * Get user roles based on SaaS mode
     */
    private function getUserRoles(Request $request): array
    {
        $user = $request->user();
        if (!$user) {
            return [];
        }

        if (isSaasMode()) {
            return $user->roles->pluck('name')->toArray();
        }

        // Non-SaaS mode: get workspace role
        if ($user->current_workspace_id) {
            $workspaceMember = \App\Models\WorkspaceMember::where('user_id', $user->id)
                ->where('workspace_id', $user->current_workspace_id)
                ->first();

            return $workspaceMember ? [$workspaceMember->role] : [];
        }

        return [];
    }

    /**
     * Get user permissions based on SaaS mode
     */
    private function getUserPermissions(Request $request): array
    {
        $user = $request->user();
        if (!$user) {
            return [];
        }

        // If user is superadmin, give all permissions
        if ($user->type === 'superadmin') {
            return $user->getAllPermissions()->pluck('name')->toArray();
        }

        if ($user->current_workspace_id) {
            $workspace = $user->currentWorkspace;
            if ($workspace && $workspace->owner_id == $user->id) {
                return $user->getAllPermissions()->pluck('name')->toArray();
            } else {
                $workspaceMember = \App\Models\WorkspaceMember::where('user_id', $user->id)
                    ->where('workspace_id', $user->current_workspace_id)
                    ->first();
                if ($workspaceMember) {
                    $role = Role::findByName($workspaceMember->role);
                    return $role->permissions->pluck('name')->values()->toArray();
                }
            }
        }
        return [];
    }

    /**
     * Get brand settings from cookies (demo mode)
     */
    private function getCookieSettings(Request $request): array
    {
        $settings = settings(); // Start with default settings
        $cookieOverrides = [];

        // Theme settings cookie
        $themeCookie = $request->cookie('themeSettings');
        if ($themeCookie) {
            try {
                $themeData = json_decode($themeCookie, true);
                if ($themeData) {
                    if (isset($themeData['themeColor']))
                        $cookieOverrides['themeColor'] = $themeData['themeColor'];
                    if (isset($themeData['customColor']))
                        $cookieOverrides['customColor'] = $themeData['customColor'];
                    if (isset($themeData['appearance']))
                        $cookieOverrides['themeMode'] = $themeData['appearance'];
                }
            } catch (\Exception $e) {
            }
        }

        // Sidebar settings cookie
        $sidebarCookie = $request->cookie('sidebarSettings');
        if ($sidebarCookie) {
            try {
                $sidebarData = json_decode($sidebarCookie, true);
                if ($sidebarData) {
                    if (isset($sidebarData['variant']))
                        $cookieOverrides['sidebarVariant'] = $sidebarData['variant'];
                    if (isset($sidebarData['style']))
                        $cookieOverrides['sidebarStyle'] = $sidebarData['style'];
                }
            } catch (\Exception $e) {
            }
        }

        // Layout position cookie
        $layoutCookie = $request->cookie('layoutPosition');
        if ($layoutCookie) {
            $cookieOverrides['layoutDirection'] = $layoutCookie;
        }

        // Brand settings cookie (complete brand settings)
        $brandCookie = $request->cookie('brandSettings');
        if ($brandCookie) {
            try {
                $brandData = json_decode($brandCookie, true);
                if ($brandData) {
                    $cookieOverrides = array_merge($cookieOverrides, $brandData);
                }
            } catch (\Exception $e) {
            }
        }

        return array_merge($settings, $cookieOverrides);
    }

    /**
     * Apply user preference cookies for sidebar and layout (normal mode)
     */
    private function applyUserPreferenceCookies(Request $request, array $settings): array
    {
        $cookieOverrides = [];

        // Sidebar settings cookie
        $sidebarCookie = $request->cookie('sidebarSettings');
        if ($sidebarCookie) {
            try {
                $sidebarData = json_decode($sidebarCookie, true);
                if ($sidebarData) {
                    if (isset($sidebarData['variant']))
                        $cookieOverrides['sidebarVariant'] = $sidebarData['variant'];
                    if (isset($sidebarData['style']))
                        $cookieOverrides['sidebarStyle'] = $sidebarData['style'];
                }
            } catch (\Exception $e) {
            }
        }

        // Layout position cookie
        $layoutCookie = $request->cookie('layoutPosition');
        if ($layoutCookie) {
            $cookieOverrides['layoutDirection'] = $layoutCookie;
        }

        return array_merge($settings, $cookieOverrides);
    }

    /**
     * Apply cookie overrides to base settings (demo mode)
     */
    private function applyCookieOverrides(Request $request, array $settings): array
    {
        $cookieOverrides = [];

        // Theme settings cookie
        $themeCookie = $request->cookie('themeSettings');
        if ($themeCookie) {
            try {
                $themeData = json_decode($themeCookie, true);
                if ($themeData) {
                    if (isset($themeData['themeColor']))
                        $cookieOverrides['themeColor'] = $themeData['themeColor'];
                    if (isset($themeData['customColor']))
                        $cookieOverrides['customColor'] = $themeData['customColor'];
                    if (isset($themeData['appearance']))
                        $cookieOverrides['themeMode'] = $themeData['appearance'];
                }
            } catch (\Exception $e) {
            }
        }

        // Sidebar settings cookie
        $sidebarCookie = $request->cookie('sidebarSettings');
        if ($sidebarCookie) {
            try {
                $sidebarData = json_decode($sidebarCookie, true);
                if ($sidebarData) {
                    if (isset($sidebarData['variant']))
                        $cookieOverrides['sidebarVariant'] = $sidebarData['variant'];
                    if (isset($sidebarData['style']))
                        $cookieOverrides['sidebarStyle'] = $sidebarData['style'];
                }
            } catch (\Exception $e) {
            }
        }

        // Layout position cookie
        $layoutCookie = $request->cookie('layoutPosition');
        if ($layoutCookie) {
            $cookieOverrides['layoutDirection'] = $layoutCookie;
        }

        // Language cookie (demo mode)
        $languageCookie = $request->cookie('app_language');
        if ($languageCookie) {
            $cookieOverrides['defaultLanguage'] = $languageCookie;
            // Auto-set layout direction based on language
            $cookieOverrides['layoutDirection'] = in_array($languageCookie, ['ar', 'he']) ? 'right' : 'left';
        }

        // Brand settings cookie (complete brand settings)
        $brandCookie = $request->cookie('brandSettings');
        if ($brandCookie) {
            try {
                $brandData = json_decode($brandCookie, true);
                if ($brandData) {
                    $cookieOverrides = array_merge($cookieOverrides, $brandData);
                }
            } catch (\Exception $e) {
            }
        }

        return array_merge($settings, $cookieOverrides);
    }


}
