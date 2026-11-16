<?php

namespace App\Modules\Invoicing\Enums;

enum InvoiceStatus: string
{
    case Draft = 'draft';
    case Sent = 'sent';
    case Paid = 'paid';
    case Overdue = 'overdue';
    case Cancelled = 'cancelled';
    case Proforma = 'proforma';
    case PartialPaid = 'partial_paid';

    public function label(): string
    {
        return match ($this) {
            self::Draft => 'Draft',
            self::Sent => 'Sent',
            self::Paid => 'Paid',
            self::Overdue => 'Overdue',
            self::Cancelled => 'Cancelled',
            self::Proforma => 'Proforma',
            self::PartialPaid => 'Partially Paid',
        };
    }

    public function color(): string
    {
        return match ($this) {
            self::Draft => 'gray',
            self::Sent => 'yellow',
            self::Paid => 'green',
            self::Overdue => 'red',
            self::Cancelled => 'gray',
            self::Proforma => 'blue',
            self::PartialPaid => 'orange',
        };
    }

    public static function editable(): array
    {
        return [self::Draft, self::Proforma];
    }

    public static function postable(): array
    {
        return [self::Sent];
    }

    public static function cancellable(): array
    {
        return [self::Draft, self::Sent];
    }
}