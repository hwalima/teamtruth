<?php

namespace App\Modules\Sales\Models;

use App\Modules\Core\Models\Concerns\BelongsToCompany;
use App\Modules\Core\Models\Company;
use App\Modules\Sales\Models\SalesTeam;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SalesTeamMember extends Model
{
    use BelongsToCompany;

    protected $table = 'sal_sales_team_member';

    protected $fillable = [
        'company_id',
        'team_id',
        'user_id',
        'role',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function team(): BelongsTo
    {
        return $this->belongsTo(SalesTeam::class, 'team_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
