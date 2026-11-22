<?php

namespace App\Modules\Hrm\Enums;

enum LeaveLedgerType: string
{
    use Concerns\HasOptions;

    case Accrual = 'accrual';
    case Taken = 'taken';
    case CarryOver = 'carry_over';
    case Adjustment = 'adjustment';
    case Expiry = 'expiry';
    case Payout = 'payout';

    public function label(): string
    {
        return match ($this) {
            self::Accrual => 'Accrual',
            self::Taken => 'Taken',
            self::CarryOver => 'Carry Over',
            self::Adjustment => 'Adjustment',
            self::Expiry => 'Expiry',
            self::Payout => 'Payout',
        };
    }
}