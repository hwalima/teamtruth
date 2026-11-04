<?php

namespace App\Modules\Requisitions\Enums;

enum RequisitionStatus: string
{
    case Draft = 'draft';
    case InApproval = 'in_approval';
    case Approved = 'approved';
    case Rejected = 'rejected';
    case Returned = 'returned';
    case Cancelled = 'cancelled';
    case Converted = 'converted';
    case Issued = 'issued';
    case Paid = 'paid';
    case Closed = 'closed';
}
