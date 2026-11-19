<?php

namespace App\Modules\Hrm\Enums;

enum DisciplinaryStatus: string
{
    case Open = 'open';
    case UnderInvestigation = 'under_investigation';
    case NoticeIssued = 'notice_issued';
    case HearingScheduled = 'hearing_scheduled';
    case HearingCompleted = 'hearing_completed';
    case OutcomeDecided = 'outcome_decided';
    case Appealed = 'appealed';
    case Closed = 'closed';

    public function label(): string
    {
        return match ($this) {
            self::Open => 'Open',
            self::UnderInvestigation => 'Under Investigation',
            self::NoticeIssued => 'Notice Issued',
            self::HearingScheduled => 'Hearing Scheduled',
            self::HearingCompleted => 'Hearing Completed',
            self::OutcomeDecided => 'Outcome Decided',
            self::Appealed => 'Appealed',
            self::Closed => 'Closed',
        };
    }

    public function color(): string
    {
        return match ($this) {
            self::Open => 'blue',
            self::UnderInvestigation => 'yellow',
            self::NoticeIssued => 'orange',
            self::HearingScheduled => 'purple',
            self::HearingCompleted => 'indigo',
            self::OutcomeDecided => 'green',
            self::Appealed => 'red',
            self::Closed => 'gray',
        };
    }
}