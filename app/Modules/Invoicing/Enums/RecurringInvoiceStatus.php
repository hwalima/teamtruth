<?php

namespace App\Modules\Invoicing\Enums;

enum RecurringInvoiceStatus: string
{
    case Active = 'active';
    case Paused = 'paused';
    case Completed = 'completed';
    case Cancelled = 'cancelled';

    public function label(): string
    {
        return match ($this) {
            self::Active => 'Active',
            self::Paused => 'Paused',
            self::Completed => 'Completed',
            self::Cancelled => 'Cancelled',
        };
    }

    public function color(): string
    {
        return match ($this) {
            self::Active => 'green',
            self::Paused => 'yellow',
            self::Completed => 'blue',
            self::Cancelled => 'gray',
        };
    }
}