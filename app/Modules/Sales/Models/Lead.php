<?php

namespace App\Modules\Sales\Models;

use App\Modules\Core\Models\Concerns\BelongsToCompany;
use App\Modules\Core\Models\Company;
use App\Modules\Sales\Enums\LeadStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Lead extends Model
{
    use BelongsToCompany, SoftDeletes;

    protected $table = 'sal_leads';

    protected $fillable = [
        'company_id',
        'name',
        'contact_person',
        'email',
        'phone',
        'source',
        'status',
        'assigned_to',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'metadata' => 'array',
        ];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function assignedTo(): BelongsTo
    {
        return $this->belongsTo(\App\Models\User::class, 'assigned_to');
    }

    public function opportunities(): HasMany
    {
        return $this->hasMany(Opportunity::class);
    }
}
