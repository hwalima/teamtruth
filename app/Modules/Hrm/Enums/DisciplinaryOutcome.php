<?php

namespace App\Modules\Hrm\Enums;

enum DisciplinaryOutcome: string
{
    use Concerns\HasOptions;

    case VerbalWarning = 'verbal_warning';
    case WrittenWarning = 'written_warning';
    case FinalWarning = 'final_warning';
    case Suspension = 'suspension';
    case Dismissal = 'dismissal';
    case Demotion = 'demotion';
    case NoAction = 'no_action';

    public function label(): string
    {
        return match ($this) {
            self::VerbalWarning => 'Verbal Warning',
            self::WrittenWarning => 'Written Warning',
            self::FinalWarning => 'Final Warning',
            self::Suspension => 'Suspension',
            self::Dismissal => 'Dismissal',
            self::Demotion => 'Demotion',
            self::NoAction => 'No Action',
        };
    }

    public function severity(): int
    {
        return match ($this) {
            self::NoAction => 0,
            self::VerbalWarning => 1,
            self::WrittenWarning => 2,
            self::FinalWarning => 3,
            self::Suspension => 4,
            self::Demotion => 5,
            self::Dismissal => 6,
        };
    }

    public function hasExpiry(): bool
    {
        return in_array($this, [self::VerbalWarning, self::WrittenWarning, self::FinalWarning]);
    }
}