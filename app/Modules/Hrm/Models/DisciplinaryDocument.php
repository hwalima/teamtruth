<?php

namespace App\Modules\Hrm\Models;

use App\Modules\Core\Models\Company;
use App\Modules\Core\Models\Concerns\BelongsToCompany;
use App\Modules\Hrm\Enums\DisciplinaryDocumentType;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DisciplinaryDocument extends Model
{
    use BelongsToCompany, HasFactory;

    protected $table = 'hrm_disciplinary_documents';

    protected $fillable = [
        'company_id',
        'disciplinary_case_id',
        'document_type',
        'title',
        'file_path',
        'file_mime',
        'file_size',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'document_type' => DisciplinaryDocumentType::class,
            'file_size' => 'integer',
        ];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function disciplinaryCase(): BelongsTo
    {
        return $this->belongsTo(DisciplinaryCase::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}