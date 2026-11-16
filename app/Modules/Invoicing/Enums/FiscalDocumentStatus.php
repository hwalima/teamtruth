<?php

namespace App\Modules\Invoicing\Enums;

enum FiscalDocumentStatus: string
{
    case Pending = 'pending';
    case Success = 'success';
    case Failed = 'failed';
    case Void = 'void';

    public function label(): string
    {
        return match ($this) {
            self::Pending => 'Pending',
            self::Success => 'Success',
            self::Failed => 'Failed',
            self::Void => 'Void',
        };
    }

    public function color(): string
    {
        return match ($this) {
            self::Pending => 'yellow',
            self::Success => 'green',
            self::Failed => 'red',
            self::Void => 'gray',
        };
    }
}