<?php

namespace App\Modules\Sales\Enums;

enum QuotationStatus: string
{
    case Draft = 'draft';
    case Submitted = 'submitted';
    case Approved = 'approved';
    case Converted = 'converted';
    case Cancelled = 'cancelled';
}
