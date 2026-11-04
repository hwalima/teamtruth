<?php

namespace App\Modules\Core\Enums;

enum ApprovalActionType: string
{
    case Approve = 'approve';
    case Reject = 'reject';
    case Return = 'return';
    case Delegate = 'delegate';
    case Comment = 'comment';
}
