<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Who sees what in the media library.
 *
 * The library is shared: everyone sees every file and folder in each
 * workspace they belong to, whoever uploaded it, and whichever ERP company
 * they are working in. Changing or deleting something stays with the person
 * who uploaded it and the workspace owner.
 */
class MediaLibraryScope
{
    /** @return list<int> */
    public static function workspaceIds(User $user): array
    {
        return collect()
            ->merge(DB::table('workspace_members')->where('user_id', $user->id)->where('status', 'active')->pluck('workspace_id'))
            ->merge(DB::table('workspaces')->where('owner_id', $user->id)->pluck('id'))
            ->push($user->current_workspace_id)
            ->filter()
            ->map(fn ($id): int => (int) $id)
            ->unique()
            ->values()
            ->all();
    }

    /** Limit a media item or folder query to what the person can see. */
    public static function visible(Builder $query, User $user): Builder
    {
        if ($user->type === 'superadmin') {
            return $query;
        }

        return $query->where(fn (Builder $inner) => $inner
            ->whereIn('workspace_id', self::workspaceIds($user))
            ->orWhere('user_id', $user->id));
    }

    /** May the person change or delete something uploaded by $uploaderId in $workspaceId? */
    public static function canManage(User $user, ?int $workspaceId, ?int $uploaderId): bool
    {
        if ($user->type === 'superadmin' || ($uploaderId !== null && $uploaderId === (int) $user->id)) {
            return true;
        }

        return $workspaceId !== null && self::ownsWorkspace($user, $workspaceId);
    }

    public static function ownsWorkspace(User $user, int $workspaceId): bool
    {
        return DB::table('workspaces')->where('id', $workspaceId)->where('owner_id', $user->id)->exists()
            || DB::table('workspace_members')->where('workspace_id', $workspaceId)->where('user_id', $user->id)
                ->where('status', 'active')->where('role', 'owner')->exists();
    }
}
