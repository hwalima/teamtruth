<?php

use App\Models\User;
use App\Support\GlobalPermissions;
use Illuminate\Support\Facades\Gate;

test('every signed-in user gets the everyday tool permissions without a role', function () {
    $user = User::factory()->create(['type' => 'user']);

    foreach (['note_view_any', 'note_create', 'google_meeting_view_any', 'google_meeting_join', 'media_view_any', 'media_upload'] as $ability) {
        expect(Gate::forUser($user)->allows($ability))->toBeTrue("{$ability} should be global");
    }
});

test('destructive and creation rights stay with roles', function () {
    $user = User::factory()->create(['type' => 'user']);

    expect(Gate::forUser($user)->allows('media_delete'))->toBeFalse()
        ->and(Gate::forUser($user)->allows('google_meeting_create'))->toBeFalse()
        ->and(GlobalPermissions::grants('contract_view_any'))->toBeFalse();
});

test('the merged permission list keeps role permissions and adds the global ones once', function () {
    $merged = GlobalPermissions::merge(['task_view', 'note_view']);

    expect($merged)->toContain('task_view', 'media_view_any')
        ->and(array_count_values($merged)['note_view'])->toBe(1);
});
