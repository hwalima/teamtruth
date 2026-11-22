<?php

namespace App\Modules\Hrm\Enums;

enum EmployeeStatus: string
{
    use Concerns\HasOptions;

    case Active = 'active';
    case Inactive = 'inactive';
    case Terminated = 'terminated';
    case OnLeave = 'on_leave';
    case Probation = 'probation';

    public function label(): string
    {
        return match ($this) {
            self::Active => 'Active',
            self::Inactive => 'Inactive',
            self::Terminated => 'Terminated',
            self::OnLeave => 'On Leave',
            self::Probation => 'Probation',
        };
    }

    public function color(): string
    {
        return match ($this) {
            self::Active => 'green',
            self::Inactive => 'gray',
            self::Terminated => 'red',
            self::OnLeave => 'yellow',
            self::Probation => 'blue',
        };
    }
}