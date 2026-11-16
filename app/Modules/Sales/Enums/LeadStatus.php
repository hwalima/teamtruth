<?php

namespace App\Modules\Sales\Enums;

enum LeadStatus: string
{
    case New = 'new';
    case Qualified = 'qualified';
    case Lost = 'lost';
    case Converted = 'converted';
}
