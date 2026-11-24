<?php

use App\Models\User;
use Illuminate\Session\Middleware\StartSession;
use Illuminate\Support\Facades\Route;

test('the app\'s JSON endpoints run with the login session', function () {
    expect(Route::getRoutes()->getByName('api.media.index')->gatherMiddleware())->toContain('api');
    $resolved = app(\Illuminate\Contracts\Http\Kernel::class)->getMiddlewareGroups()['api'];

    expect($resolved)->toContain(StartSession::class);
});

test('a signed-in person reaches the media library data through the session', function () {
    $user = User::factory()->create(['type' => 'company']);

    $this->post('/login', ['email' => $user->email, 'password' => 'password']);
    $this->getJson(route('api.media.index'))->assertOk();
});

test('guests are still turned away', function () {
    $this->getJson(route('api.media.index'))->assertForbidden();
});
