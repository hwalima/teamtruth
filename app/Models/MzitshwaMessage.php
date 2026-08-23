<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MzitshwaMessage extends Model
{
    public $timestamps = false;

    protected $fillable = ['conversation_id', 'role', 'content', 'metadata', 'created_at'];

    protected $casts = [
        'metadata' => 'array',
        'created_at' => 'datetime',
    ];

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(MzitshwaConversation::class, 'conversation_id');
    }
}
