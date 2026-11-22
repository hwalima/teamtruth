<?php

namespace App\Modules\DataImport\Models;

use App\Models\User;
use App\Modules\Core\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** One uploaded file from another system, with its preview and result. */
class DataImport extends Model
{
    use BelongsToCompany;

    public const PREVIEWED = 'previewed';

    public const IMPORTED = 'imported';

    public const FAILED = 'failed';

    protected $fillable = [
        'company_id', 'source', 'model', 'file_name', 'file_path', 'status', 'options',
        'summary', 'columns', 'total_rows', 'created_by', 'imported_by', 'imported_at',
    ];

    protected function casts(): array
    {
        return [
            'options' => 'array',
            'summary' => 'array',
            'columns' => 'array',
            'total_rows' => 'integer',
            'imported_at' => 'datetime',
        ];
    }

    public function rows(): HasMany
    {
        return $this->hasMany(DataImportRow::class)->orderBy('row_number');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function importer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'imported_by');
    }
}
