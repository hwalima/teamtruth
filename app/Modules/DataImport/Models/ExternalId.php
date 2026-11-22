<?php

namespace App\Modules\DataImport\Models;

use App\Modules\Core\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphTo;

/** Which local record an outside record (e.g. an Odoo product) became. */
class ExternalId extends Model
{
    use BelongsToCompany;

    protected $fillable = ['company_id', 'source', 'model', 'external_id', 'record_type', 'record_id', 'data_import_id'];

    public function record(): MorphTo
    {
        return $this->morphTo();
    }
}
