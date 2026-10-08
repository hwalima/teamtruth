<?php

use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;

test('workspace members can add shared calendar events', function () {
    $owner = User::factory()->create();
    $member = User::factory()->create();
    $workspace = Workspace::create([
        'name' => 'Calendar test workspace',
        'slug' => 'calendar-test-workspace',
        'owner_id' => $owner->id,
    ]);

    WorkspaceMember::create([
        'workspace_id' => $workspace->id,
        'user_id' => $member->id,
        'role' => 'member',
        'status' => 'active',
    ]);

    $member->update(['current_workspace_id' => $workspace->id]);

    $this->actingAs($member)
        ->post(route('task-calendar.events.store'), [
            'title' => 'Team planning',
            'description' => 'Review the upcoming sprint.',
            'start_at' => '2026-10-08T09:00',
            'end_at' => '2026-10-08T10:00',
        ])
        ->assertRedirect(route('task-calendar.index'));

    $this->assertDatabaseHas('calendar_events', [
        'workspace_id' => $workspace->id,
        'user_id' => $member->id,
        'title' => 'Team planning',
        'description' => 'Review the upcoming sprint.',
    ]);
});
