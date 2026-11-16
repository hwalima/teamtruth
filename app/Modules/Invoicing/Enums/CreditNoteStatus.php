<?php

namespace App\Modules\Invoicing\Enums;

enum CreditNoteStatus: string
{
    case Draft = 'draft';
    case Issued = 'issued';
    case Applied = 'applied';
    case Cancelled = 'cancelled';

    public function label(): string
    {
        return match ($this) {
            self::Draft => 'Draft',
            self::Issued => 'Issued',
            self::Applied => 'Applied',
            self::Cancelled => 'Cancelled',
        };
    }

    public function color(): string
    {
        return match ($this) {
            self::Draft => 'gray',
            self::Issued => 'blue',
            self::Applied => 'green',
            self::Cancelled => 'gray',
        };
    }

    public static function editable(): array
    {
        return [self::Draft];
    }

    public static function cancellable(): array
    {
        return [self::Draft, self::Issued];
    }
}