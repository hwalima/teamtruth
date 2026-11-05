<?php

namespace App\Modules\Core\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CompanyBranding extends Model
{
    protected $table = 'company_branding';

    protected $fillable = [
        'company_id',
        'logo_path',
        'letterhead_path',
        'logo_dark_path',
        'favicon_path',
        'primary_color',
        'secondary_color',
        'accent_color',
        'letterhead_footer_text',
        'bank_details',
    ];

    protected function casts(): array
    {
        return ['bank_details' => 'array'];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }
}
