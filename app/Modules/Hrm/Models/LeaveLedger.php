<?php

namespace App\Modules\Hrm\Models;

use App\Modules\Core\Models\Company;
use App\Modules\Core\Models\Concerns\BelongsToCompany;
use App\Modules\Hrm\Enums\LeaveLedgerType;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LeaveLedger extends Model
{
    use BelongsToCompany, HasFactory;

    protected $table = 'hrm_leave_ledger';

    protected $fillable = [
        'company_id',
        'employee_id',
        'leave_type_id',
        'leave_request_id',
        'transaction_type',
        'days',
        'balance_after',
        'reference',
        'description',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'transaction_type' => LeaveLedgerType::class,
            'days' => 'decimal:2',
            'balance_after' => 'decimal:2',
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

    public function leaveType(): BelongsTo
    {
        return $this->belongsTo(LeaveType::class);
    }

    public function leaveRequest(): BelongsTo
    {
        return $this->belongsTo(LeaveRequest::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}