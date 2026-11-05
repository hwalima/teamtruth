<?php

namespace App\Modules\Accounting\Models;

use App\Modules\Core\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class FiscalYear extends Model
{
    use BelongsToCompany;

    protected $table = 'accounting_fiscal_years';

    protected $fillable = ['company_id', 'name', 'starts_on', 'ends_on', 'status'];

    protected function casts(): array
    {
        return ['starts_on' => 'date', 'ends_on' => 'date'];
    }

    public function periods(): HasMany
    {
        return $this->hasMany(FiscalPeriod::class, 'fiscal_year_id')->orderBy('starts_on');
    }
}
