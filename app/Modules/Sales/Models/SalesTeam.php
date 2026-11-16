<?php

namespace App\Modules\Sales\Models;

use App\Modules\Core\Models\Concerns\BelongsToCompany;
use App\Modules\Core\Models\Company;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class SalesTeam extends Model
{
    use BelongsToCompany;

    protected $table = 'sal_sales_teams';

    protected $fillable = [
        'company_id',
        'name',
        'manager_id',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function manager(): BelongsTo
    {
        return $this->belongsTo(\App\Models\User::class, 'manager_id');
    }

    public function members(): BelongsToMany
    {
        return $this->belongsToMany(\App\Models\User::class, 'sal_sales_team_member', 'team_id', 'user_id')
            ->withPivot('role')
            ->withTimestamps();
    }
}
