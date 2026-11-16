<?php

namespace App\Modules\Invoicing\Enums;

enum InvoiceType: string
{
    case Invoice = 'invoice';
    case Proforma = 'proforma';

    public function label(): string
    {
        return match ($this) {
            self::Invoice => 'Invoice',
            self::Proforma => 'Proforma',
        };
    }
}