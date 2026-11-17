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
            $status = $this->getStatusCode($e);
            $message = $this->getErrorMessage($e, $status);

            if ($request->hasHeader('X-Inertia')) {
                $response = Inertia::render('Error', [
                    'status' => $status,
                    'message' => $message,
                ])->toResponse($request)->setStatusCode($status);

                $response->headers->set('Cache-Control', 'private, no-store, no-cache, must-revalidate, max-age=0');
                $response->headers->set('Pragma', 'no-cache');
                $response->headers->set('Expires', '0');
                $response->headers->set('X-LiteSpeed-Cache-Control', 'no-cache');

                return $response;
            }

            if ($request->expectsJson()) {
                return response()->json([
                    'message' => $message,
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