<?php

namespace App\Support;

use App\Models\Role;
use App\Models\User;
use App\Models\WorkspaceMember;

/**
 * The permission names a user holds in their current workspace: everything for
 * super admins and workspace owners, otherwise their member role's permissions.
 */
final class WorkspacePermissions
{
    public static function for(?User $user): array
    {
        if (! $user) {
            return [];
        }

        if ($user->type === 'superadmin') {
            return $user->getAllPermissions()->pluck('name')->toArray();
        }

        if ($user->current_workspace_id) {
            $workspace = $user->currentWorkspace;
            if ($workspace && $workspace->owner_id == $user->id) {
                return $user->getAllPermissions()->pluck('name')->toArray();
            }

            $member = WorkspaceMember::where('user_id', $user->id)
                ->where('workspace_id', $user->current_workspace_id)
                ->first();
            if ($member) {
                $role = Role::where('name', $member->role)->first();

                return $role ? $role->permissions->pluck('name')->values()->toArray() : [];
            }
        }

        return [];
    }

    /** Workspace permissions plus the ones every signed-in user has. */
    public static function withGlobal(?User $user): array
    {
        return $user ? GlobalPermissions::merge(self::for($user)) : [];
    }
}
