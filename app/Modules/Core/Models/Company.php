<?php

namespace App\Modules\Core\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Company extends Model
{
    protected $fillable = [
        'parent_id',
        'code',
        'name',
        'legal_name',
        'registration_no',
        'tax_no',
        'vat_no',
        'address',
        'phone',
        'email',
        'website',
        'default_currency',
        'timezone',
        'fiscal_year_start_month',
        'fiscal_year_start_day',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'fiscal_year_start_month' => 'integer',
            'fiscal_year_start_day' => 'integer',
        ];
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function subsidiaries(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id');
    }

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class)
            ->withPivot(['role', 'erp_role_id', 'is_active'])
            ->withTimestamps();
    }

    public function erpRoles(): HasMany
    {
        return $this->hasMany(CompanyErpRole::class)->orderBy('name');
    }

    public function activeUsers(): BelongsToMany
    {
        return $this->users()->wherePivot('is_active', true);
    }

    public function branding(): HasOne
    {
        return $this->hasOne(CompanyBranding::class);
    }

    public function signatories(): HasMany
    {
        return $this->hasMany(CompanySignatory::class)->orderBy('sort_order');
    }
}
