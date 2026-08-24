<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TaskActivity extends Model
{
    protected $fillable = [
        'task_id', 'user_id', 'type', 'field', 'old_value', 'new_value', 'description'
    ];

    public function task(): BelongsTo
    {
        return $this->belongsTo(Task::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public static function log(Task $task, string $type, ?string $field = null, ?string $oldValue = null, ?string $newValue = null, ?string $description = null): self
    {
        return static::create([
            'task_id' => $task->id,
            'user_id' => auth()->id(),
            'type' => $type,
            'field' => $field,
            'old_value' => $oldValue,
            'new_value' => $newValue,
            'description' => $description,
        ]);
    }
}
