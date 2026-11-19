<?php

namespace App\Modules\Hrm\Enums;

enum ContractType: string
{
    case Permanent = 'permanent';
    case FixedTerm = 'fixed_term';
    case Probation = 'probation';
    case Casual = 'casual';
    case Apprenticeship = 'apprenticeship';

    public function label(): string
    {
        return match ($this) {
            self::Permanent => 'Permanent',
            self::FixedTerm => 'Fixed Term',
            self::Probation => 'Probation',
            self::Casual => 'Casual',
            self::Apprenticeship => 'Apprenticeship',
        };
    }
}