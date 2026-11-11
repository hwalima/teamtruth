<?php

use App\Models\User;
use App\Models\Workspace;
use App\Models\Plan;
use App\Models\Permission;

function createTestUserWithWorkspace(): User
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
    $companyUser = User::factory()->create([
        'type' => 'company',
        'plan_id' => $plan->id,
        'plan_is_active' => 1,
        'plan_expire_date' => now()->addMonth(),
    ]);

    // Create workspace
    $workspace = Workspace::create([
        'name' => 'Test Workspace',
        'slug' => 'test-workspace',
        'owner_id' => $companyUser->id,
    ]);

    $companyUser->update(['current_workspace_id' => $workspace->id]);

    return $companyUser;
}

test('profile page is displayed', function () {
    $user = createTestUserWithWorkspace();

    $response = $this
        ->actingAs($user)
        ->get('/profile');

    $response->assertOk();
});

test('profile information can be updated', function () {
    $user = createTestUserWithWorkspace();

    $response = $this
        ->actingAs($user)
        ->patch('/profile', [
            'name' => 'Test User',
            'email' => 'test@example.com',
        ]);

    $response
        ->assertSessionHasNoErrors()
        ->assertRedirect('/profile');

    $user->refresh();

    expect($user->name)->toBe('Test User');
    expect($user->email)->toBe('test@example.com');
    expect($user->email_verified_at)->toBeNull();
});

test('email verification status is unchanged when the email address is unchanged', function () {
    $user = createTestUserWithWorkspace();

    $response = $this
        ->actingAs($user)
        ->patch('/profile', [
            'name' => 'Test User',
            'email' => $user->email,
        ]);

    $response
        ->assertSessionHasNoErrors()
        ->assertRedirect('/profile');

    expect($user->refresh()->email_verified_at)->not->toBeNull();
});

test('user can delete their account', function () {
    $user = createTestUserWithWorkspace();

    $response = $this
        ->actingAs($user)
        ->delete('/profile', [
            'password' => 'password',
        ]);

    $response
        ->assertSessionHasNoErrors()
        ->assertRedirect('/');

    $this->assertGuest();
    expect($user->fresh())->toBeNull();
});

test('correct password must be provided to delete account', function () {
    $user = createTestUserWithWorkspace();

    $response = $this
        ->actingAs($user)
        ->from('/profile')
        ->delete('/profile', [
            'password' => 'wrong-password',
        ]);

    $response
        ->assertSessionHasErrors('password')
        ->assertRedirect('/profile');

    expect($user->fresh())->not->toBeNull();
});