<?php

namespace App\Modules\Core\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class CompanyErpRole extends Model
{
    protected $table = 'company_erp_roles';

    protected $fillable = [
        'company_id',
        'name',
        'slug',
        'permissions',
        'is_system',
    ];

    protected function casts(): array
    {
        return [
            'permissions' => 'array',
            'is_system' => 'boolean',
        ];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function members(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'company_user', 'erp_role_id', 'user_id')
            ->wherePivot('is_active', true)
            ->withPivot(['company_id', 'role', 'is_active']);
    }
}
