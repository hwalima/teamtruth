<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Plan;
use App\Models\Setting;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use App\Services\NotificationTemplateService;
use App\Exports\CompanyExport;
use App\Imports\CompanyImport;
use Maatwebsite\Excel\Facades\Excel;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;

class CompanyController extends Controller
{
    public function index(Request $request)
    {
        try {
            $query = User::query()
                ->where('type', 'company')
                ->whereHas('workspaces', function ($query) {
                    $query->where('role', 'owner');
                })
                ->with('plan');
                
            // Apply search filter
            if ($request->has('search') && !empty($request->search)) {
                $query->where(function($q) use ($request) {
                    $q->where('name', 'like', "%{$request->search}%")
                      ->orWhere('email', 'like', "%{$request->search}%");
                });
            }
            
            // Apply status filter
            if ($request->has('status') && $request->status !== 'all') {
                $query->where('status', $request->status);
            }
            
            // Apply date filters
            if ($request->has('start_date') && !empty($request->start_date)) {
                $query->whereDate('created_at', '>=', $request->start_date);
            }
            
            if ($request->has('end_date') && !empty($request->end_date)) {
                $query->whereDate('created_at', '<=', $request->end_date);
            }

            if (config('app.is_demo')) {
                $query->orderByRaw("CASE WHEN email = 'company@example.com' THEN 0 ELSE 1 END ASC");
            }
            
            // Apply sorting
            $sortField = $request->get('sort_field');
            $sortDirection = $request->get('sort_direction', 'desc');
            
            // Only apply sorting if sort_field is explicitly provided
            if ($sortField) {
                // Validate sort field to prevent SQL injection
                $allowedSortFields = ['name', 'email', 'status', 'created_at'];
                if (!in_array($sortField, $allowedSortFields)) {
                    $sortField = 'created_at';
                }
                
                // Validate sort direction
                if (!in_array(strtolower($sortDirection), ['asc', 'desc'])) {
                    $sortDirection = 'desc';
                }
                
                $query->orderBy($sortField, $sortDirection);
            } else {
                // Default sorting when no sort is specified
                $query->orderBy('created_at', 'desc');
                // Don't set sortField and sortDirection in response when using default
                $sortField = null;
                $sortDirection = null;
            }
            
            // Get paginated results
            $perPage = $request->input('per_page', 10);
            $companies = $query->paginate($perPage)->withQueryString();
            
            // Transform data for frontend
            $companies->getCollection()->transform(function ($company) {
                return [
                    'id' => $company->id,
                    'avatar' => check_file($company->avatar) ? get_file($company->avatar) : get_file('avatars/avatar.png'),
                    'name' => $company->name,
                    'email' => $company->email,
                    'status' => $company->status,
                    'created_at' => $company->created_at,
                    'plan_name' => $company->plan ? $company->plan->name : __('No Plan'),
                    'plan_expiry_date' => $company->plan_expire_date,
                ];
            });
            
            // Get plans for dropdown
            $plans = Plan::all(['id', 'name']);
            
            return Inertia::render('companies/index', [
                'companies' => $companies,
                'plans' => $plans,
                'filters' => [
                    'search' => $request->input('search'),
                    'status' => $request->input('status'),
                    'start_date' => $request->input('start_date'),
                    'end_date' => $request->input('end_date'),
                    'sort_field' => $sortField,
                    'sort_direction' => $sortDirection,
                    'per_page' => $request->input('per_page')
                ]
            ]);
            
        } catch (\Exception $e) {
            // Log the error for debugging
            \Log::error('Company index error: ' . $e->getMessage());
            
            // Redirect to clean companies page without parameters
            return redirect()->route('companies.index')->with('error', __('An error occurred while loading companies. Please try again.'));
        }
    }
    
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => 'nullable|string|min:8',
            'status' => 'required|in:active,inactive',
        ]);
        
        $company = new User();
        $company->name = $validated['name'];
        $company->email = $validated['email'];
        
        // Only set password if provided
        if (isset($validated['password'])) {
            $company->password = Hash::make($validated['password']);
        }
        
        $company->type = 'company';
        $company->status = $validated['status'];
        $company->is_enable_login = $validated['status'] === 'active' ? 1 : 0;
        $company->created_by = auth()->id() ?? 1;
        
        // Set company language from superadmin's defaultLanguage system setting
        $superAdmin = User::where('type', 'superadmin')->first();
        if ($superAdmin) {
            $defaultLang = Setting::where('user_id', $superAdmin->id)
                ->where('workspace_id', null)
                ->where('key', 'defaultLanguage')
                ->value('value');
            if ($defaultLang) {
                $company->lang = $defaultLang;
            }
        }
        
        // Assign default plan
        $defaultPlan = Plan::where('is_default', true)->first();
        if ($defaultPlan) {
            $company->plan_id = $defaultPlan->id;
            
            // Set plan expiry date based on plan duration
            if ($defaultPlan->duration === 'yearly') {
                $company->plan_expire_date = now()->addYear();
            } else {
                $company->plan_expire_date = now()->addMonth();
            }
            
            // Set plan is active
            $company->plan_is_active = 1;
        }
        
        $company->save();
        
        // Assign role and settings to the user (includes workspace creation)
        defaultRoleAndSetting($company);
        
        // Trigger email notification
        if (!config('app.is_demo', true)) {
            event(new \App\Events\UserCreated($company, $validated['password'] ?? ''));
        }
        
        // Check for email errors
        if (session()->has('email_error')) {
            return redirect()->back()->with('warning', __('Company created successfully, but welcome email failed: ') . session('email_error'));
        }
        
        return redirect()->back()->with('success', __('Company created successfully'));
    }
    
    public function update(Request $request, User $company)
    {
        // Ensure this is a company type user
        if ($company->type !== 'company') {
            return redirect()->back()->with('error', __('Invalid company record'));
        }
        
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users,email,' . $company->id,
            'status' => 'required|in:active,inactive',
        ]);
        
        $company->name = $validated['name'];
        $company->email = $validated['email'];
        $company->status = $validated['status'];
        $company->is_enable_login = $validated['status'] === 'active' ? 1 : 0;
        
        $company->save();
        
        return redirect()->back()->with('success', __('Company updated successfully'));
    }
    
    public function destroy(User $company)
    {
        // Ensure this is a company type user
        if ($company->type !== 'company') {
            return redirect()->back()->with('error', __('Invalid company record'));
        }
        
        $company->delete();
        
        return redirect()->back()->with('success', __('Company deleted successfully'));
    }
    
    public function resetPassword(Request $request, User $company)
    {
        // Ensure this is a company type user
        if ($company->type !== 'company') {
            return redirect()->back()->with('error', __('Invalid company record'));
        }
        
        $validated = $request->validate([
            'password' => ['required', 'string', 'min:8'],
        ]);
        
        $company->password = Hash::make($validated['password']);
        $company->save();
        
        return redirect()->back()->with('success', __('Password reset successfully'));
    }
    
    public function toggleStatus(User $company)
    {
        // Ensure this is a company type user
        if ($company->type !== 'company') {
            return redirect()->back()->with('error', __('Invalid company record'));
        }
        
        $newStatus = $company->status === 'active' ? 'inactive' : 'active';
        $company->status = $newStatus;
        $company->is_enable_login = $newStatus === 'active' ? 1 : 0;
        $company->save();
        
        return redirect()->back()->with('success', __('Company status updated successfully'));
    }
    
    /**
     * Get available plans for upgrade
     */
    public function getPlans(User $company)
    {
        // Ensure this is a company type user
        if ($company->type !== 'company') {
            return response()->json(['error' => __('Invalid company record')], 400);
        }
        
        $plans = Plan::where('is_plan_enable', 'on')->get();

        // Determine the company's current billing cycle from their latest approved plan order
        $latestPlanOrder = $company->planOrders()
            ->where('status', 'approved')
            ->where('plan_id', $company->plan_id)
            ->latest('processed_at')
            ->first();

        $currentBillingCycle = $latestPlanOrder ? $latestPlanOrder->billing_cycle : null;

        $formattedPlans = [];

        foreach ($plans as $plan) {
            // Format features
            $features = [];
            if ($plan->enable_custdomain === 'on') $features[] = __('Custom Domain');
            if ($plan->enable_custsubdomain === 'on') $features[] = __('Subdomain');
            if ($plan->enable_chatgpt === 'on') $features[] = __('AI Integration');

            $base = [
                'id'            => $plan->id,
                'name'          => $plan->name,
                'description'   => $plan->description,
                'features'      => $features,
                'business'      => $plan->business,
                'max_users'     => $plan->max_users,
                'storage_limit' => $plan->storage_limit . ' ' . __('GB'),
                'is_default'    => $plan->is_default,
            ];

            // Monthly plan
            $formattedPlans[] = array_merge($base, [
                'price'      => $plan->price,
                'duration'   => 'Monthly',
                'is_current' => $company->plan_id === $plan->id && ($currentBillingCycle === 'monthly' || $currentBillingCycle === null),
            ]);

            // Yearly plan
            $yearlyPrice = $plan->yearly_price ?? ($plan->price * 12 * 0.8);
            $formattedPlans[] = array_merge($base, [
                'price'      => $yearlyPrice,
                'duration'   => 'Yearly',
                'is_current' => $company->plan_id === $plan->id && $currentBillingCycle === 'yearly',
            ]);
        }

        return response()->json([
            'plans' => $formattedPlans,
            'company' => [
                'id'             => $company->id,
                'name'           => $company->name,
                'current_plan_id' => $company->plan_id,
            ]
        ]);
    }
    
    /**
     * Upgrade company plan
     */
    public function upgradePlan(Request $request, User $company)
    {
        // Ensure this is a company type user
        if ($company->type !== 'company') {
            return back()->with('error', __('Invalid company record'));
        }
        
        $validated = $request->validate([
            'plan_id' => 'required|exists:plans,id',
            'duration' => 'nullable|string|in:monthly,yearly',
        ]);
        
        $plan = Plan::find($validated['plan_id']);
        if (!$plan) {
            return back()->with('error', __('Plan not found'));
        }
        
        // Update company plan
        $company->plan_id = $plan->id;
        
        // Set plan expiry date based on requested duration or plan default
        $duration = $validated['duration'] ?? $plan->duration;
        if ($duration === 'yearly') {
            $company->plan_expire_date = now()->addYear();
        } else {
            $company->plan_expire_date = now()->addMonth();
        }
        
        // Set plan is active
        $company->plan_is_active = 1;
        
        $company->save();

        // Record a plan order so billing cycle is trackable
        \App\Models\PlanOrder::create([
            'user_id'       => $company->id,
            'plan_id'       => $plan->id,
            'billing_cycle' => $duration,
            'order_number'  => 'PO-' . strtoupper(\Illuminate\Support\Str::random(8)),
            'original_price'=> $duration === 'yearly' ? ($plan->yearly_price ?? $plan->price * 12 * 0.8) : $plan->price,
            'final_price'   => $duration === 'yearly' ? ($plan->yearly_price ?? $plan->price * 12 * 0.8) : $plan->price,
            'payment_method'=> 'manual',
            'status'        => 'approved',
            'ordered_at'    => now(),
            'processed_at'  => now(),
            'processed_by'  => auth()->id(),
        ]);
        
        return back()->with('success', __('Plan upgraded successfully'));
    }
    
    public function export(Request $request)
    {
        return Excel::download(new CompanyExport($request), 'companies_' . date('Y-m-d_His') . '.xlsx');
    }
    
    public function import(Request $request)
    {
        $request->validate([
            'file' => 'required|mimes:xlsx,xls,csv|max:2048'
        ]);
        
        $import = new CompanyImport();
        Excel::import($import, $request->file('file'));
        
        $imported = $import->getImportedCount();
        $skipped = $import->getSkippedCount();
        $errors = $import->getErrors();
        
        if (!empty($errors)) {
            return back()->with('warning', __('Imported: :imported, Skipped: :skipped. Errors: :errors', [
                'imported' => $imported,
                'skipped' => $skipped,
                'errors' => implode(', ', array_slice($errors, 0, 3))
            ]));
        }
        
        return back()->with('success', __('Imported :imported companies successfully. Skipped :skipped duplicates.', [
            'imported' => $imported,
            'skipped' => $skipped
        ]));
    }
    
    public function downloadSample()
    {
        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="company_import_sample.csv"',
        ];
        
        $callback = function() {
            $file = fopen('php://output', 'w');
            fputcsv($file, ['name', 'email', 'status']);
            fputcsv($file, ['Acme Corporation', 'acme@example.com', 'active']);
            fputcsv($file, ['Tech Solutions', 'tech@example.com', 'active']);
            fclose($file);
        };
        
        return response()->stream($callback, 200, $headers);
    }

}