<?php

namespace App\Exceptions;

use Illuminate\Foundation\Exceptions\Handler as ExceptionHandler;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

class Handler extends ExceptionHandler
{
    /**
     * A list of exception types with their corresponding custom log levels.
     *
     * @var array<class-string<\Throwable>, \Psr\Log\LogLevel::*>
     */
    protected $levels = [];

    /**
     * A list of the exception types that are not reported.
     *
     * @var array<int, class-string<\Throwable>>
     */
    protected $dontReport = [];

    /**
     * A list of the inputs that are never flashed to the session on validation exceptions.
     *
     * @var array<int, string>
     */
    protected $dontFlash = [
        'current_password',
        'password',
        'password_confirmation',
    ];

    /**
     * Register the exception handling callbacks for the application.
     */
    public function register(): void
    {
        $this->renderable(function (Throwable $e, Request $request) {
            // Handle Inertia requests specially
            if ($request->hasHeader('X-Inertia') || $request->expectsJson()) {
                $status = $this->getStatusCode($e);

                // For 403/401/404/500 errors, return Inertia response with error page
                if (in_array($status, [401, 403, 404, 419, 422, 500, 503])) {
                    return Inertia::render('Error', [
                        'status' => $status,
                        'message' => $this->getErrorMessage($e, $status),
                    ])->toResponse($request)->setStatusCode($status);
                }

                // For other errors, return JSON
                return response()->json([
                    'message' => $this->getErrorMessage($e, $status),
                    'status' => $status,
                ], $status);
            }
        });
    }

    /**
     * Get the status code for the exception.
     */
    protected function getStatusCode(Throwable $e): int
    {
        if ($e instanceof HttpExceptionInterface) {
            return $e->getStatusCode();
        }

        return 500;
    }

    /**
     * Get the error message for the exception.
     */
    protected function getErrorMessage(Throwable $e, int $status): string
    {
        if (app()->hasDebugModeEnabled()) {
            return $e->getMessage();
        }

        return match ($status) {
            401 => 'Unauthenticated.',
            403 => 'You do not have permission to access this resource.',
            404 => 'The requested resource was not found.',
            419 => 'Page expired. Please refresh and try again.',
            422 => 'The given data was invalid.',
            500 => 'An unexpected error occurred. Please try again later.',
            503 => 'Service unavailable. Please try again later.',
            default => 'An error occurred.',
        };
    }
}