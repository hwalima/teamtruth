<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Quotation {{ $quotation->document_number }}</title>
</head>
<body style="margin: 0; padding: 24px; background: #f8fafc; font-family: Arial, sans-serif; color: #1f2937; font-size: 14px; line-height: 1.5;">
    <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px;">
        <p>Dear {{ $quotation->customer->name }},</p>
        @if ($note)
            <p style="white-space: pre-wrap;">{{ $note }}</p>
        @else
            <p>Thank you for your enquiry. Please find attached our quotation <strong>{{ $quotation->document_number }}</strong>.</p>
        @endif
        <table style="border-collapse: collapse; margin: 16px 0;">
            <tr><td style="padding: 4px 16px 4px 0; color: #64748b;">Quotation</td><td style="padding: 4px 0;"><strong>{{ $quotation->document_number }}</strong></td></tr>
            <tr><td style="padding: 4px 16px 4px 0; color: #64748b;">Total</td><td style="padding: 4px 0;">{{ $quotation->currency_code }} {{ number_format((float) $quotation->total, 2) }}</td></tr>
            @if ($quotation->valid_until)
                <tr><td style="padding: 4px 16px 4px 0; color: #64748b;">Valid until</td><td style="padding: 4px 0;">{{ $quotation->valid_until->format('d M Y') }}</td></tr>
            @endif
        </table>
        <p>Reply to this email to accept the quotation or if you have any questions.</p>
        <p style="margin-bottom: 0;">Regards,<br>{{ $sender->name }}<br>{{ $company->legal_name ?: $company->name }}</p>
    </div>
</body>
</html>
