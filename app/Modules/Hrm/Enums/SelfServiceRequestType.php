<?php

namespace App\Modules\Hrm\Enums;

enum SelfServiceRequestType: string
{
    use Concerns\HasOptions;

    case ProfileUpdate = 'profile_update';
    case DocumentUpload = 'document_upload';
    case LeaveBalanceEnquiry = 'leave_balance_enquiry';
    case PayslipRequest = 'payslip_request';
    case CertificateRequest = 'certificate_request';
    case Other = 'other';

    public function label(): string
    {
        return match ($this) {
            self::ProfileUpdate => 'Profile Update',
            self::DocumentUpload => 'Document Upload',
            self::LeaveBalanceEnquiry => 'Leave Balance Enquiry',
            self::PayslipRequest => 'Payslip Request',
            self::CertificateRequest => 'Certificate Request',
            self::Other => 'Other',
        };
    }
}