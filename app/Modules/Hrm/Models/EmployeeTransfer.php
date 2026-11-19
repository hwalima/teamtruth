<?php

namespace App\Modules\Hrm\Models;

use App\Modules\Core\Models\Company;
use App\Modules\Core\Models\Concerns\BelongsToCompany;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmployeeTransfer extends Model
{
    use BelongsToCompany, HasFactory;

    protected $table = 'hrm_employee_transfers';

    protected $fillable = [
        'company_id',
        'employee_id',
        'from_subsidiary_id',
        'to_subsidiary_id',
        'transfer_date',
        'reason',
        'approved_by',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'transfer_date' => 'date',
        ];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function fromSubsidiary(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'from_subsidiary_id');
    }

    public function toSubsidiary(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'to_subsidiary_id');
    }

    public function approvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}