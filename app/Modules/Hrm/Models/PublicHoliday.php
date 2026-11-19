<?php

namespace App\Modules\Hrm\Models;

use App\Modules\Core\Models\Company;
use App\Modules\Core\Models\Concerns\BelongsToCompany;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PublicHoliday extends Model
{
    use BelongsToCompany, HasFactory;

    protected $table = 'hrm_public_holidays';

    protected $fillable = [
        'company_id',
        'name',
        'date',
        'is_recurring',
        'description',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'date' => 'date',
            'is_recurring' => 'boolean',
        ];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public static function isHoliday(int $companyId, string $date): bool
    {
        return self::query()
            ->where('company_id', $companyId)
            ->where('date', $date)
            ->exists();
    }
}