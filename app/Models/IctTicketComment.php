<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class IctTicketComment extends Model
{
    protected $fillable = ['ticket_id', 'user_id', 'comment', 'is_internal'];
    protected $casts = ['is_internal' => 'boolean'];

    public function ticket(): BelongsTo
    {
        return $this->belongsTo(IctTicket::class, 'ticket_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
