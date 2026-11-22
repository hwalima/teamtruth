<?php

namespace App\Modules\Hrm\Enums;

enum PayFrequency: string
{
    use Concerns\HasOptions;

    case Weekly = 'weekly';
    case Biweekly = 'biweekly';
    case Monthly = 'monthly';

    public function label(): string
    {
        return match ($this) {
            self::Weekly => 'Weekly',
            self::Biweekly => 'Biweekly',
            self::Monthly => 'Monthly',
        };
    }
}