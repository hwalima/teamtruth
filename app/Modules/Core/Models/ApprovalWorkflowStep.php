<?php

namespace App\Modules\Core\Models;

use App\Modules\Core\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ApprovalWorkflowStep extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'workflow_id',
        'step_order',
        'approver_type',
        'approver_id',
        'min_amount',
        'max_amount',
        'condition_json',
        'require_all',
        'sla_hours',
    ];

    protected function casts(): array
    {
        return [
            'min_amount' => 'decimal:4',
            'max_amount' => 'decimal:4',
            'condition_json' => 'array',
            'require_all' => 'boolean',
            'sla_hours' => 'integer',
            'step_order' => 'integer',
        ];
    }

    public function workflow(): BelongsTo
    {
        return $this->belongsTo(ApprovalWorkflow::class, 'workflow_id');
    }
}
