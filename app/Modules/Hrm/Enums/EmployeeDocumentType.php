<?php

namespace App\Modules\Hrm\Enums;

enum EmployeeDocumentType: string
{
    case Contract = 'contract';
    case IdCopy = 'id_copy';
    case Certificate = 'certificate';
    case Medical = 'medical';
    case Visa = 'visa';
    case WorkPermit = 'work_permit';
    case Other = 'other';

    public function label(): string
    {
        return match ($this) {
            self::Contract => 'Contract',
            self::IdCopy => 'ID Copy',
            self::Certificate => 'Certificate',
            self::Medical => 'Medical',
            self::Visa => 'Visa',
            self::WorkPermit => 'Work Permit',
            self::Other => 'Other',
        };
    }
}