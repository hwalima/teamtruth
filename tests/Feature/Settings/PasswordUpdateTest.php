<?php

use App\Models\User;
use App\Models\Workspace;
use App\Models\Plan;
use App\Models\Permission;
use Illuminate\Support\Facades\Hash;

function createPasswordTestUserWithWorkspace(): User
{
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

    return $companyUser;
}

test('password can be updated', function () {
    $user = createPasswordTestUserWithWorkspace();

    $response = $this
        ->actingAs($user)
        ->from('/profile/password')
        ->put('/profile/password', [
            'current_password' => 'password',
            'password' => 'new-password',
            'password_confirmation' => 'new-password',
        ]);

    $response
        ->assertSessionHasNoErrors()
        ->assertRedirect('/profile/password');

    expect(Hash::check('new-password', $user->refresh()->password))->toBeTrue();
});

test('correct password must be provided to update password', function () {
    $user = createPasswordTestUserWithWorkspace();

    $response = $this
        ->actingAs($user)
        ->from('/profile/password')
        ->put('/profile/password', [
            'current_password' => 'wrong-password',
            'password' => 'new-password',
            'password_confirmation' => 'new-password',
        ]);

    $response
        ->assertSessionHasErrors('current_password')
        ->assertRedirect('/profile/password');
});