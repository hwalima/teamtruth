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

        // Ensure session cookie headers are explicitly set for all responses
        // This prevents LiteSpeed from stripping Set-Cookie
        if ($request->hasSession()) {
            $session = $request->session();
            if ($session->isStarted() && !$session->getId() === null) {
                // Force cookie to be sent with every response on auth routes
                $response->headers->set('Set-Cookie', $response->headers->get('Set-Cookie', '') .
                    '; HttpOnly; Secure; SameSite=Lax');
            }
        }

        return $response;
    }
}
