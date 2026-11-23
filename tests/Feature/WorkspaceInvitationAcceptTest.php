<?php

use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceInvitation;
use App\Models\WorkspaceMember;

beforeEach(function () {
    $this->owner = User::factory()->create();
    $this->workspace = Workspace::create(['name' => 'Ops', 'slug' => 'ops', 'owner_id' => $this->owner->id]);
});

function invite(Workspace $workspace, string $email, string $role = 'manager'): WorkspaceInvitation
{
    return WorkspaceInvitation::create([
        'workspace_id' => $workspace->id, 'email' => $email, 'role' => $role, 'invited_by' => $workspace->owner_id,
    ]);
}

test('a new person accepts, joins and is signed in', function () {
    $invitation = invite($this->workspace, 'new.person@example.test');

    $this->post(route('invitations.accept', $invitation->token), ['password' => 'secret-pass-1', 'password_confirmation' => 'secret-pass-1'])
        ->assertRedirect(route('dashboard', ['workspace' => $this->workspace->id]));

    $user = User::where('email', 'new.person@example.test')->sole();
    expect($invitation->fresh()->accepted_at)->not->toBeNull()
        ->and(WorkspaceMember::where('workspace_id', $this->workspace->id)->where('user_id', $user->id)->value('status'))->toBe('active');
    $this->assertAuthenticatedAs($user);
});

test('an existing user accepts and joins', function () {
    $user = User::factory()->create(['email' => 'finance@example.test']);
    $invitation = invite($this->workspace, 'Finance@Example.test');

    $this->post(route('invitations.accept', $invitation->token))->assertRedirect();

    expect($invitation->fresh()->accepted_at)->not->toBeNull()
        ->and($this->workspace->members()->where('user_id', $user->id)->exists())->toBeTrue();
});

test('accepting when already a member still clears the invitation', function () {
    $user = User::factory()->create(['email' => 'finance@example.test']);
    WorkspaceMember::create(['workspace_id' => $this->workspace->id, 'user_id' => $user->id, 'role' => 'member', 'status' => 'inactive']);
    $invitation = invite($this->workspace, 'finance@example.test', 'manager');

    $this->post(route('invitations.accept', $invitation->token))->assertRedirect();

    $member = WorkspaceMember::where('workspace_id', $this->workspace->id)->where('user_id', $user->id)->sole();
    expect($invitation->fresh()->accepted_at)->not->toBeNull()
        ->and($member->status)->toBe('active')
        ->and($member->role)->toBe('manager');
});

test('invitations for people who are already active members stop showing as pending', function () {
    $member = User::factory()->create(['email' => 'finance@example.test']);
    WorkspaceMember::create(['workspace_id' => $this->workspace->id, 'user_id' => $member->id, 'role' => 'manager', 'status' => 'active']);
    $joined = invite($this->workspace, 'FINANCE@example.test');
    $stillOpen = invite($this->workspace, 'someone.else@example.test');

    app(\App\Services\WorkspaceService::class)->settleAcceptedInvitations($this->workspace);

    expect($joined->fresh()->accepted_at)->not->toBeNull()
        ->and($stillOpen->fresh()->accepted_at)->toBeNull()
        ->and($this->workspace->pendingInvitations()->pluck('email')->all())->toBe(['someone.else@example.test']);
});

test('accept errors are shown on the invitation page', function () {
    $invitation = invite($this->workspace, 'new.person@example.test');

    $this->from(route('invitations.show', $invitation->token))
        ->post(route('invitations.accept', $invitation->token), ['password' => 'short'])
        ->assertSessionHasErrors('password');
});
