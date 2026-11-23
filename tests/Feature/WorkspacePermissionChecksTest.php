<?php

use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use App\Traits\HasPermissionChecks;

beforeEach(function () {
    foreach (['expense_approval_approve', 'expense_approval_reject', 'project_delete'] as $name) {
        Permission::create(['name' => $name, 'module' => explode('_', $name)[0], 'label' => $name, 'guard_name' => 'web']);
    }
    Role::create(['name' => 'manager', 'label' => 'Manager', 'guard_name' => 'web'])
        ->givePermissionTo('expense_approval_approve');
    Role::create(['name' => 'member', 'label' => 'Member', 'guard_name' => 'web']);

    $this->owner = User::factory()->create(['type' => 'company']);
    $this->workspace = Workspace::create(['name' => 'Ops', 'slug' => 'ops', 'owner_id' => $this->owner->id]);
    $this->owner->update(['current_workspace_id' => $this->workspace->id]);

    $this->checker = new class
    {
        use HasPermissionChecks {
            checkPermission as public;
            checkAnyPermission as public;
            checkAllPermissions as public;
        }
    };
});

/** An invited member (invited users are created with type "company"). */
function workspaceMember(Workspace $workspace, string $role): User
{
    $user = User::factory()->create(['type' => 'company', 'current_workspace_id' => $workspace->id]);
    WorkspaceMember::create(['workspace_id' => $workspace->id, 'user_id' => $user->id, 'role' => $role, 'status' => 'active']);

    return $user;
}

test('an invited member only gets what their workspace role grants', function () {
    $this->actingAs(workspaceMember($this->workspace, 'member'));

    expect($this->checker->checkPermission('expense_approval_approve'))->toBeFalse()
        ->and($this->checker->checkPermission('project_delete'))->toBeFalse()
        ->and($this->checker->checkAnyPermission(['project_delete', 'expense_approval_reject']))->toBeFalse()
        // Everyday tools stay open to everyone.
        ->and($this->checker->checkPermission('note_create'))->toBeTrue();
});

test('a member whose role grants a permission can use it', function () {
    $this->actingAs(workspaceMember($this->workspace, 'manager'));

    expect($this->checker->checkPermission('expense_approval_approve'))->toBeTrue()
        ->and($this->checker->checkPermission('expense_approval_reject'))->toBeFalse()
        ->and($this->checker->checkAllPermissions(['expense_approval_approve', 'note_create']))->toBeTrue();
});

test('the workspace owner and super admins keep full access', function () {
    $this->actingAs($this->owner);
    expect($this->checker->checkPermission('project_delete'))->toBeTrue();

    $this->actingAs(User::factory()->create(['type' => 'superadmin']));
    expect($this->checker->checkPermission('project_delete'))->toBeTrue();
});

test('owning one workspace gives nothing extra in another', function () {
    $other = Workspace::create(['name' => 'Other', 'slug' => 'other', 'owner_id' => User::factory()->create()->id]);
    WorkspaceMember::create(['workspace_id' => $other->id, 'user_id' => $this->owner->id, 'role' => 'member', 'status' => 'active']);
    $this->owner->update(['current_workspace_id' => $other->id]);

    $this->actingAs($this->owner->fresh());
    expect($this->checker->checkPermission('project_delete'))->toBeFalse();
});

test('expense and timesheet screens check permissions that exist', function () {
    $seeded = collect(glob(database_path('seeders/*.php')))->map(fn ($file) => file_get_contents($file))->implode("\n");
    $code = collect(glob(app_path('Http/Controllers/*.php')))->map(fn ($file) => file_get_contents($file))->implode("\n");

    preg_match_all("/(?:check|authorize)Permission\\('((?:expense|timesheet)[a-z_]*)'\\)/", $code, $matches);
    foreach (array_unique($matches[1]) as $permission) {
        expect($seeded)->toContain("'{$permission}'");
    }
});
