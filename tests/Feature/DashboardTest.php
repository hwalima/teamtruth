<?php

use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use App\Models\Plan;
use App\Models\Permission;

test('guests are redirected to the login page', function () {
    $this->get('/dashboard')->assertRedirect('/login');
});

test('authenticated users with workspace and active plan can visit the dashboard', function () {
    // Create required permissions
    Permission::firstOrCreate(['name' => 'dashboard_view', 'guard_name' => 'web', 'module' => 'dashboard']);
    Permission::firstOrCreate(['name' => 'project_view_any', 'guard_name' => 'web', 'module' => 'projects']);

    // Create a plan
    $plan = Plan::create([
        'name' => 'Test Plan',
        'price' => 10,
        'duration' => 'monthly',
        'is_default' => true,
        'is_plan_enable' => true,
    ]);

    // Create company user (type 'company' bypasses permission check in DashboardController)
    $companyUser = User::factory()->create(['type' => 'company', 'plan_id' => $plan->id, 'plan_is_active' => 1]);

    // Create workspace
    $workspace = Workspace::create([
        'name' => 'Test Workspace',
        'slug' => 'test-workspace',
        'owner_id' => $companyUser->id,
    ]);

    $companyUser->update(['current_workspace_id' => $workspace->id]);

    $this->actingAs($companyUser)
        ->get('/dashboard')
        ->assertOk();
});

test('authenticated users without workspace are redirected to login', function () {
    $this->actingAs($user = User::factory()->create());

    $this->get('/dashboard')->assertRedirect('/login');
});