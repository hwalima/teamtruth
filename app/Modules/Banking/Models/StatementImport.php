<?php

namespace App\Modules\Banking\Models;

use App\Models\User;
use App\Modules\Core\Models\Company;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** An uploaded statement workbook: previewed first, then imported, and undoable. */
class StatementImport extends Model
{
    public const PREVIEW = 'preview';

    public const IMPORTED = 'imported';

    public const UNDONE = 'undone';

    protected $table = 'banking_statement_imports';

    protected $fillable = [
        'company_id', 'filename', 'file_path', 'file_hash', 'status', 'summary', 'result',
        'created_by', 'imported_by', 'imported_at',
    ];

    protected function casts(): array
    {
        return [
            'summary' => 'array',
            'result' => 'array',
            'imported_at' => 'datetime',
        ];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(BankTransaction::class, 'import_id');
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
