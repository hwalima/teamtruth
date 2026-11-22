<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class PreventWebResponseCaching
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $response->headers->set('Cache-Control', 'private, no-store, no-cache, must-revalidate, max-age=0');
        $response->headers->set('Pragma', 'no-cache');
        $response->headers->set('Expires', '0');
        $response->headers->set('X-LiteSpeed-Cache-Control', 'no-cache');

        // Do not touch Set-Cookie here. Rewriting it with headers->set() collapses
        // every cookie header (session + XSRF-TOKEN) into one, which breaks CSRF/session.

        return $response;
    }
}
