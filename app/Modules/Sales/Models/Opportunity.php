<?php

namespace App\Modules\Sales\Models;

use App\Modules\Core\Models\Concerns\BelongsToCompany;
use App\Modules\Core\Models\Company;
use App\Modules\Invoicing\Models\Customer;
use App\Modules\Sales\Enums\OpportunityStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Opportunity extends Model
{
    use BelongsToCompany;

    protected $table = 'sal_opportunities';

    protected $fillable = [
        'company_id',
        'lead_id',
        'customer_id',
        'title',
        'expected_value',
        'probability',
        'status',
        'close_date',
        'assigned_to',
    ];

    protected function casts(): array
    {
        return [
            'expected_value' => 'decimal:4',
            'probability' => 'integer',
            'close_date' => 'date',
        ];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function lead(): BelongsTo
    {
        return $this->belongsTo(Lead::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function assignedTo(): BelongsTo
    {
        return $this->belongsTo(\App\Models\User::class, 'assigned_to');
    }

    public function quotations(): HasMany
    {
        return $this->hasMany(Quotation::class);
    }
}
