<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

class LoginRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'email' => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
        ];
    }

    /**
     * Attempt to authenticate the request's credentials.
     *
     * @throws \Illuminate\Validation\ValidationException
     */
    public function authenticate(): void
    {
        if (! Auth::attempt($this->only('email', 'password'), $this->boolean('remember'))) {
            throw ValidationException::withMessages([
                'email' => __('These credentials do not match our records.'),
            ]);
        }

        // Check if user is allowed to login
        $user = Auth::user();
        if (!$this->canUserLogin($user)) {
            Auth::logout();

            throw ValidationException::withMessages([
                'email' => __('Only company users can log in directly. Please use an invitation link to access the workspace.'),
            ]);
        }

        // Check if user login is enabled
        if (!$user->is_enable_login || $user->status !== 'active') {
            Auth::logout();

            throw ValidationException::withMessages([
                'email' => __('Your account has been disabled. Please contact administrator.'),
            ]);
        }
    }

    /**
     * Check if user can login directly
     */
    private function canUserLogin($user): bool
    {
        // Allow superadmin and company users to login
        if (in_array($user->type, ['superadmin', 'company'])) {
            return true;
        }

        return false;
    }
}
