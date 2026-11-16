<?php

namespace App\Modules\Sales\Enums;

enum OpportunityStatus: string
{
    case Open = 'open';
    case Won = 'won';
    case Lost = 'lost';
}
