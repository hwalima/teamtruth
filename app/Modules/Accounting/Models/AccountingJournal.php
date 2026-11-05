<?php

namespace App\Modules\Accounting\Models;

use App\Modules\Core\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AccountingJournal extends Model
{
    use BelongsToCompany;

    protected $fillable = ['company_id', 'code', 'name', 'journal_type', 'is_active'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    public function entries(): HasMany
    {
        return $this->hasMany(JournalEntry::class, 'journal_id');
    }
}
