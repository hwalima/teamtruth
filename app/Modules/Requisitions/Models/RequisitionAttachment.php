<?php

namespace App\Modules\Requisitions\Models;

use App\Models\User;
use App\Modules\Core\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RequisitionAttachment extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'requisition_id',
        'uploaded_by',
        'original_name',
        'path',
        'mime_type',
        'size',
    ];

    public function requisition(): BelongsTo
    {
        return $this->belongsTo(Requisition::class);
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}
