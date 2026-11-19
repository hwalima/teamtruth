<?php

namespace App\Modules\Hrm\Enums;

enum DisciplinaryDocumentType: string
{
    case IncidentReport = 'incident_report';
    case Notice = 'notice';
    case HearingRecord = 'hearing_record';
    case WitnessStatement = 'witness_statement';
    case Evidence = 'evidence';
    case OutcomeLetter = 'outcome_letter';
    case Appeal = 'appeal';

    public function label(): string
    {
        return match ($this) {
            self::IncidentReport => 'Incident Report',
            self::Notice => 'Notice',
            self::HearingRecord => 'Hearing Record',
            self::WitnessStatement => 'Witness Statement',
            self::Evidence => 'Evidence',
            self::OutcomeLetter => 'Outcome Letter',
            self::Appeal => 'Appeal',
        };
    }
}