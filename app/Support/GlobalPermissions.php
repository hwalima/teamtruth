<?php

namespace App\Support;

/**
 * Permissions every signed-in user has, whatever their role: everyday tools
 * that should be one click away for everybody (Notes, Google Meetings, Media
 * Library). Roles can still add more (deleting media, creating meetings).
 */
final class GlobalPermissions
{
    public const LIST = [
        // Notes
        'note_view_any', 'note_view', 'note_create', 'note_update', 'note_delete',
        // Google Meetings: see and join; creating them stays with the roles that have it
        'google_meeting_view_any', 'google_meeting_view', 'google_meeting_join', 'google_meeting_view_calendar',
        // Media Library: browse, upload and download; deleting and managing stay role-based
        'media_view_any', 'media_view', 'media_upload', 'media_create', 'media_download',
    ];

    public static function grants(string $ability): bool
    {
        return in_array($ability, self::LIST, true);
    }

    /** Add the global permissions to a user's role permissions, without duplicates. */
    public static function merge(array $permissions): array
    {
        return array_values(array_unique([...$permissions, ...self::LIST]));
    }
}
