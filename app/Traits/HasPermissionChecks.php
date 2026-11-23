<?php

namespace App\Traits;

use App\Models\User;
use App\Support\GlobalPermissions;
use App\Support\WorkspacePermissions;

trait HasPermissionChecks
{
    /**
     * Check if the current user has the specified permission in their current
     * workspace: super admins and the workspace owner have everything, everyone
     * else has what their member role grants (the same list the menus use).
     */
    protected function checkPermission(string $permission): bool
    {
        $user = auth()->user();
        if (! $user) {
            return false;
        }

        if (GlobalPermissions::grants($permission) || $this->hasFullAccess($user)) {
            return true;
        }

        return in_array($permission, $this->grantedPermissions($user), true);
    }

    /**
     * Check permission and abort if not authorized
     */
    protected function authorizePermission(string $permission): void
    {
        if (! $this->checkPermission($permission)) {
            abort(403, 'You do not have permission to perform this action.');
        }
    }

    /**
     * Check multiple permissions (user must have at least one)
     */
    protected function checkAnyPermission(array $permissions): bool
    {
        foreach ($permissions as $permission) {
            if ($this->checkPermission($permission)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check multiple permissions (user must have all)
     */
    protected function checkAllPermissions(array $permissions): bool
    {
        if (! auth()->user()) {
            return false;
        }

        foreach ($permissions as $permission) {
            if (! $this->checkPermission($permission)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Get user permissions for a specific module
     */
    protected function getModulePermissions(string $module): array
    {
        $user = auth()->user();

        if (! $user) {
            return [];
        }

        if ($this->hasFullAccess($user)) {
            return ['*']; // Indicates all permissions
        }

        return $user->permissions()
            ->where('module', $module)
            ->whereIn('name', $this->grantedPermissions($user))
            ->pluck('name')
            ->toArray();
    }

    /**
     * Check if user can perform CRUD operations on a module
     */
    protected function getModuleCrudPermissions(string $module): array
    {
        return [
            'view_any' => $this->checkPermission("{$module}_view_any"),
            'view' => $this->checkPermission("{$module}_view"),
            'create' => $this->checkPermission("{$module}_create"),
            'update' => $this->checkPermission("{$module}_update"),
            'delete' => $this->checkPermission("{$module}_delete"),
        ];
    }

    /** Super admins, and the owner of the workspace the user is working in. */
    private function hasFullAccess(User $user): bool
    {
        if ($user->type === 'superadmin' || $user->type === 'super admin') {
            return true;
        }

        return $user->current_workspace_id
            && $user->currentWorkspace
            && (int) $user->currentWorkspace->owner_id === (int) $user->id;
    }

    /**
     * The permission names the user holds in their current workspace. Without a
     * workspace, the roles assigned to the account itself apply. Worked out once
     * per request.
     *
     * @return list<string>
     */
    private function grantedPermissions(User $user): array
    {
        $key = 'workspace_permissions.'.$user->id.'.'.($user->current_workspace_id ?? 'none');
        $attributes = request()->attributes;
        if (! $attributes->has($key)) {
            $permissions = $user->current_workspace_id
                ? WorkspacePermissions::withGlobal($user)
                : $user->getAllPermissions()->pluck('name')->all();
            $attributes->set($key, array_values(array_unique($permissions)));
        }

        return $attributes->get($key);
    }
}
