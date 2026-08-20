<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class IctTicketAttachment extends Model
{
    protected $fillable = ['ticket_id', 'file_name', 'file_path', 'file_size', 'mime_type', 'uploaded_by'];

    public function ticket(): BelongsTo
    {
        return $this->belongsTo(IctTicket::class, 'ticket_id');
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}
