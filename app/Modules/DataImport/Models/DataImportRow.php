<?php

namespace App\Modules\DataImport\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A row of an imported file, kept exactly as it was, with what the import did with it. */
class DataImportRow extends Model
{
    protected $fillable = ['data_import_id', 'row_number', 'data', 'action', 'messages', 'record_type', 'record_id'];

    protected function casts(): array
    {
        return ['data' => 'array', 'messages' => 'array', 'row_number' => 'integer'];
    }

    public function dataImport(): BelongsTo
    {
        return $this->belongsTo(DataImport::class);
    }
}
