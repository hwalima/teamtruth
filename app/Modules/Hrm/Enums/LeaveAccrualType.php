<?php

namespace App\Modules\Hrm\Enums;

enum LeaveAccrualType: string
{
    use Concerns\HasOptions;

    case Fixed = 'fixed';
    case Monthly = 'monthly';
    case Yearly = 'yearly';
    case HoursBased = 'hours_based';

    public function label(): string
    {
        return match ($this) {
            self::Fixed => 'Fixed',
            self::Monthly => 'Monthly',
            self::Yearly => 'Yearly',
            self::HoursBased => 'Hours Based',
        };
    }
}