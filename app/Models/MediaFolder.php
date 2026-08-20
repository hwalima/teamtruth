<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MediaFolder extends Model
{
    protected $fillable = ['name', 'color', 'parent_id', 'workspace_id', 'user_id', 'is_locked'];

    protected $casts = ['is_locked' => 'boolean'];

    public function children(): HasMany
    {
        return $this->hasMany(MediaFolder::class, 'parent_id');
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(MediaFolder::class, 'parent_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(MediaItem::class, 'folder_id');
    }

    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function accesses(): HasMany
    {
        return $this->hasMany(MediaAccess::class, 'resource_id')
            ->where('resource_type', 'folder');
    }
}
