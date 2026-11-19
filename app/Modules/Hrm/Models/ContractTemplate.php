<?php

namespace App\Modules\Hrm\Models;

use App\Modules\Core\Models\Company;
use App\Modules\Core\Models\Concerns\BelongsToCompany;
use App\Modules\Hrm\Enums\ContractType;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ContractTemplate extends Model
{
    use BelongsToCompany, HasFactory;

    protected $table = 'hrm_contract_templates';

    protected $fillable = [
        'company_id',
        'name',
        'contract_type',
        'description',
        'template_content',
        'file_path',
        'is_default',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'contract_type' => ContractType::class,
            'template_content' => 'array',
            'is_default' => 'boolean',
        ];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function contracts(): HasMany
    {
        return $this->hasMany(Contract::class, 'template_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    protected static function booted(): void
    {
        static::saving(function (self $template) {
            if ($template->is_default) {
                static::where('company_id', $template->company_id)
                    ->where('contract_type', $template->contract_type)
                    ->where('id', '!=', $template->id)
                    ->update(['is_default' => false]);
            }
        });
    }
}