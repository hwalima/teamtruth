<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Plan;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use App\Models\Permission;
use Illuminate\Foundation\Testing\RefreshDatabase;

class PlanAccessTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // Create a default plan for testing
        $this->defaultPlan = Plan::create([
            'name' => 'Default Plan',
            'price' => 10.00,
            'yearly_price' => 100.00,
            'duration' => 'monthly',
            'description' => 'Default test plan',
            'max_users_per_workspace' => 5,
            'max_clients_per_workspace' => 10,
            'max_managers_per_workspace' => 2,
            'max_projects_per_workspace' => 10,
            'workspace_limit' => 3,
            'enable_chatgpt' => false,
            'storage_limit' => 1,
            'is_trial' => false,
            'trial_day' => 14,
            'is_plan_enable' => true,
            'is_default' => true,
        ]);
    }

    public function test_superadmin_has_full_access()
    {
        $superadmin = User::factory()->create(['type' => 'superadmin']);

        $response = $this->actingAs($superadmin)->get('/dashboard');

        $response->assertStatus(200);
    }

    public function test_company_user_without_plan_redirected_to_login()
    {
        $company = User::factory()->create(['type' => 'company', 'plan_id' => null]);

        // User has no workspace, so they get logged out and redirected to login
        $response = $this->actingAs($company)->get('/dashboard');

        $response->assertRedirect('/login');
    }

    public function test_company_user_with_expired_plan_redirected_to_login()
    {
        $plan = Plan::create([
            'name' => 'Expired Plan',
            'price' => 10.00,
            'yearly_price' => 100.00,
            'duration' => 'monthly',
            'description' => 'Test plan',
            'max_users_per_workspace' => 5,
            'max_clients_per_workspace' => 10,
            'max_managers_per_workspace' => 2,
            'max_projects_per_workspace' => 10,
            'workspace_limit' => 3,
            'enable_chatgpt' => false,
            'storage_limit' => 1,
            'is_trial' => false,
            'trial_day' => 14,
            'is_plan_enable' => true,
            'is_default' => false,
        ]);
        $company = User::factory()->create([
            'type' => 'company',
            'plan_id' => $plan->id,
            'plan_expire_date' => now()->subDay(),
            'is_trial' => 0,
            'plan_is_active' => 0,
        ]);

        // User has no workspace, so they get logged out and redirected to login
        $response = $this->actingAs($company)->get('/dashboard');

        $response->assertRedirect('/login');
    }

    public function test_company_user_with_expired_trial_redirected_to_login()
    {
        $plan = Plan::create([
            'name' => 'Expired Trial Plan',
            'price' => 10.00,
            'yearly_price' => 100.00,
            'duration' => 'monthly',
            'description' => 'Test plan',
            'max_users_per_workspace' => 5,
            'max_clients_per_workspace' => 10,
            'max_managers_per_workspace' => 2,
            'max_projects_per_workspace' => 10,
            'workspace_limit' => 3,
            'enable_chatgpt' => false,
            'storage_limit' => 1,
            'is_trial' => false,
            'trial_day' => 14,
            'is_plan_enable' => true,
            'is_default' => false,
        ]);
        $company = User::factory()->create([
            'type' => 'company',
            'plan_id' => $plan->id,
            'is_trial' => 1,
            'trial_expire_date' => now()->subDay(),
            'plan_is_active' => 0,
        ]);

        // User has no workspace, so they get logged out and redirected to login
        $response = $this->actingAs($company)->get('/dashboard');

        $response->assertRedirect('/login');
    }

    public function test_company_user_with_active_trial_has_access()
    {
        $plan = Plan::create([
            'name' => 'Active Trial Plan',
            'price' => 10.00,
            'yearly_price' => 100.00,
            'duration' => 'monthly',
            'description' => 'Test plan',
            'max_users_per_workspace' => 5,
            'max_clients_per_workspace' => 10,
            'max_managers_per_workspace' => 2,
            'max_projects_per_workspace' => 10,
            'workspace_limit' => 3,
            'enable_chatgpt' => false,
            'storage_limit' => 1,
            'is_trial' => false,
            'trial_day' => 14,
            'is_plan_enable' => true,
            'is_default' => false,
        ]);
        $company = User::factory()->create([
            'type' => 'company',
            'plan_id' => $plan->id,
            'is_trial' => 1,
            'trial_expire_date' => now()->addDays(5),
            'plan_is_active' => 1,
        ]);

        // Create workspace for the company user
        $workspace = Workspace::create([
            'name' => 'Test Workspace',
            'slug' => 'test-workspace',
            'owner_id' => $company->id,
        ]);

        $company->update(['current_workspace_id' => $workspace->id]);

        $response = $this->actingAs($company)->get('/dashboard');

        $response->assertStatus(200);
    }

    public function test_non_company_user_without_workspace_redirected_to_login()
    {
        $user = User::factory()->create(['type' => 'user']);

        // User has no workspace, so they get logged out and redirected to login
        $response = $this->actingAs($user)->get('/dashboard');

        $response->assertRedirect('/login');
    }

    public function test_plans_page_accessible_without_plan()
    {
        Permission::firstOrCreate(['name' => 'plan_view_any', 'guard_name' => 'web', 'module' => 'plans']);
        $company = User::factory()->create(['type' => 'company', 'plan_id' => null]);

        // Plans page is in SaaS-only group, accessible without active plan but requires plan_view_any permission
        $company->givePermissionTo('plan_view_any');

        $response = $this->actingAs($company)->get('/plans');

        $response->assertStatus(200);
    }

    public function test_dashboard_requires_workspace_with_active_plan()
    {
        $company = User::factory()->create(['type' => 'company', 'plan_id' => null]);

        // No workspace = redirect to login
        $response = $this->actingAs($company)->get('/dashboard');

        $response->assertRedirect('/login');
    }

    public function test_media_library_requires_workspace_with_active_plan()
    {
        $company = User::factory()->create(['type' => 'company', 'plan_id' => null]);

        // No workspace = redirect to login
        $response = $this->actingAs($company)->get('/media-library');

        $response->assertRedirect('/login');
    }
}