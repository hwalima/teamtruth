<?php

use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use App\Models\Plan;

test('workspace members can add shared calendar events', function () {
    // Create a plan
    $plan = Plan::create([
        'name' => 'Test Plan',
        'price' => 10,
        'duration' => 'monthly',
        'is_default' => true,
        'is_plan_enable' => true,
    ]);

    // Create owner user with active plan
    $owner = User::factory()->create(['type' => 'company', 'plan_id' => $plan->id, 'plan_is_active' => 1]);
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
