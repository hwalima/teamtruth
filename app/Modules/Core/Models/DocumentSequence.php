<?php

namespace App\Modules\Core\Models;

use App\Modules\Core\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;

class DocumentSequence extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'document_type',
        'fiscal_year',
        'prefix',
        'last_number',
    ];

    protected function casts(): array
    {
        return [
            'fiscal_year' => 'integer',
            'last_number' => 'integer',
        ];
    }
}
