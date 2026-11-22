<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

/*
 * Laravel matches routes in registration order. A wildcard such as
 * `invoicing/{invoice}` registered before `invoicing/credit-notes` swallows the
 * fixed URL, tries to load invoice "credit-notes", and returns 404.
 * Every fixed (parameter-free) route must be reachable by its own URL.
 */
test('no fixed route is shadowed by an earlier wildcard route', function () {
    $routes = Route::getRoutes();
    $shadowed = [];

    foreach ($routes->getRoutes() as $route) {
        if (str_contains($route->uri(), '{') || $route->getDomain()) {
            continue;
        }

        foreach (array_diff($route->methods(), ['HEAD']) as $method) {
            $matched = $routes->match(Request::create('/'.ltrim($route->uri(), '/'), $method));

            if ($matched->uri() !== $route->uri()) {
                $shadowed[] = "{$method} /{$route->uri()} is caught by /{$matched->uri()}";
            }
        }
    }

    expect($shadowed)->toBe([]);
});
