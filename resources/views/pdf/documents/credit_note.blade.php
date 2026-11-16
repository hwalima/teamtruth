<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Credit Note {{ $document->document_number }}</title>
    <style>
        @page {
            margin: 20mm 15mm 25mm 15mm;
        }
        body {
            font-family: 'DejaVu Sans', sans-serif;
            font-size: 10pt;
            line-height: 1.4;
            color: #1f2937;
        }
        .header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 2px solid #1e3a5f;
        }
        .company-info {
            flex: 1;
        }
        .company-name {
            font-size: 18pt;
            font-weight: bold;
            color: #1e3a5f;
        }
        .company-details {
            font-size: 9pt;
            color: #6b7280;
            margin-top: 5px;
        }
        .document-info {
            text-align: right;
        }
        .document-title {
            font-size: 16pt;
            font-weight: bold;
            color: #1e3a5f;
            text-transform: uppercase;
        }
        .document-number {
            font-size: 12pt;
            margin-top: 5px;
        }
        .document-meta {
            margin-top: 10px;
            font-size: 9pt;
            color: #374151;
        }
        .document-meta div {
            margin: 3px 0;
        }
        .status-badge {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 8pt;
            font-weight: bold;
            text-transform: uppercase;
        }
        .status-draft { background: #fef3c7; color: #92400e; }
        .status-issued { background: #dbeafe; color: #1e40af; }
        .status-applied { background: #dcfce7; color: #166534; }
        .status-cancelled { background: #f3f4f6; color: #374151; }

        .section {
            margin-bottom: 20px;
        }
        .section-title {
            font-size: 10pt;
            font-weight: bold;
            color: #1e3a5f;
            border-bottom: 1px solid #e5e7eb;
            padding-bottom: 5px;
            margin-bottom: 10px;
        }
        .party-details {
            display: flex;
            justify-content: space-between;
            margin-bottom: 20px;
        }
        .party {
            flex: 1;
        }
        .party h4 {
            font-size: 9pt;
            font-weight: bold;
            color: #6b7280;
            text-transform: uppercase;
            margin-bottom: 5px;
        }
        .party-address {
            font-size: 9pt;
            line-height: 1.6;
            white-space: pre-wrap;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            font-size: 9pt;
        }
        th {
            background: #1e3a5f;
            color: white;
            padding: 8px 6px;
            text-align: left;
            font-weight: 600;
        }
        td {
            padding: 6px;
            border-bottom: 1px solid #e5e7eb;
        }
        tr:last-child td {
            border-bottom: none;
        }
        .text-right { text-align: right; }
        .text-center { text-align: center; }

        .totals {
            float: right;
            width: 300px;
        }
        .totals table {
            width: 100%;
        }
        .totals td {
            padding: 5px 10px;
            border: none;
        }
        .totals .subtotal { border-top: 1px solid #e5e7eb; }
        .totals .tax { border-top: 1px solid #e5e7eb; }
        .totals .total {
            border-top: 2px solid #1e3a5f;
            font-weight: bold;
            font-size: 11pt;
            color: #1e3a5f;
        }

        .notes {
            clear: both;
            margin-top: 30px;
            padding-top: 15px;
            border-top: 1px solid #e5e7eb;
        }
        .notes h4 {
            font-size: 9pt;
            font-weight: bold;
            color: #6b7280;
            text-transform: uppercase;
            margin-bottom: 5px;
        }
        .notes p {
            font-size: 9pt;
            white-space: pre-wrap;
        }

        .footer {
            margin-top: 40px;
            padding-top: 15px;
            border-top: 1px solid #e5e7eb;
            font-size: 8pt;
            color: #6b7280;
            text-align: center;
        }

        .signatories {
            margin-top: 30px;
        }
        .signatory {
            margin-bottom: 15px;
        }
        .signatory-line {
            border-top: 1px solid #9ca3af;
            width: 200px;
            margin-bottom: 3px;
        }
        .signatory-name {
            font-weight: bold;
            font-size: 9pt;
        }
        .signatory-title {
            font-size: 8pt;
            color: #6b7280;
        }

        .original-invoice {
            background: #f9fafb;
            border: 1px solid #e5e7eb;
            border-radius: 4px;
            padding: 10px;
            margin-bottom: 20px;
        }
        .original-invoice h4 {
            font-size: 9pt;
            font-weight: bold;
            color: #6b7280;
            margin-bottom: 5px;
        }
        .reason-box {
            background: #fef3c7;
            border: 1px solid #fcd34d;
            border-radius: 4px;
            padding: 10px;
            margin-bottom: 20px;
        }
        .reason-box h4 {
            font-size: 9pt;
            font-weight: bold;
            color: #92400e;
            margin-bottom: 5px;
        }

        .watermark {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 72pt;
            color: rgba(0,0,0,0.05);
            pointer-events: none;
            z-index: -1;
        }
    </style>
</head>
<body>
    <div class="watermark">{{ strtoupper($document->status) }}</div>

    <div class="header">
        <div class="company-info">
            <div class="company-name">{{ $company->name }}</div>
            <div class="company-details">
                {{ $company->code }}<br>
                @if($company->branding && $company->branding->address)
                    {{ $company->branding->address }}<br>
                @endif
                @if($company->branding && $company->branding->phone)
                    Tel: {{ $company->branding->phone }}<br>
                @endif
                @if($company->branding && $company->branding->email)
                    Email: {{ $company->branding->email }}<br>
                @endif
                @if($company->branding && $company->branding->tax_number)
                    Tax No: {{ $company->branding->tax_number }}
                @endif
            </div>
        </div>
        <div class="document-info">
            <div class="document-title">Credit Note</div>
            <div class="document-number">{{ $document->document_number }}</div>
            <span class="status-badge status-{{ $document->status }}">{{ ucfirst(str_replace('_', ' ', $document->status)) }}</span>
            <div class="document-meta">
                <div><strong>Date:</strong> {{ $document->credit_note_date }}</div>
                <div><strong>Currency:</strong> {{ $document->currency_code }} @ {{ $document->exchange_rate }}</div>
            </div>
        </div>
    </div>

    @if($document->original_invoice)
    <div class="original-invoice">
        <h4>Reference: Original Invoice {{ $document->original_invoice->document_number }}</h4>
        <div style="font-size: 9pt;">
            Date: {{ $document->original_invoice->invoice_date }} · Total: {{ $document->original_invoice->currency_code }} {{ number_format($document->original_invoice->total_amount, 2) }} · Balance: {{ $document->original_invoice->currency_code }} {{ number_format($document->original_invoice->balance_due, 2) }}
        </div>
    </div>
    @endif

    @if($document->reason)
    <div class="reason-box">
        <h4>Reason for Credit</h4>
        <p>{{ $document->reason }}</p>
    </div>
    @endif

    <div class="party-details">
        <div class="party">
            <h4>From (Seller)</h4>
            <div class="party-address">
                <strong>{{ $company->name }}</strong><br>
                {{ $company->code }}<br>
                @if($company->branding && $company->branding->address)
                    {{ $company->branding->address }}
                @endif
            </div>
        </div>
        <div class="party" style="text-align: right;">
            <h4>To (Customer)</h4>
            <div class="party-address">
                <strong>{{ $document->customer->name }}</strong><br>
                {{ $document->customer->code }}<br>
                @if($document->customer->tax_no)
                    Tax No: {{ $document->customer->tax_no }}<br>
                @endif
                @if($document->customer->billing_address)
                    {{ $document->customer->billing_address }}
                @endif
            </div>
        </div>
    </div>

    <div class="section">
        <table>
            <thead>
                <tr>
                    <th style="width: 40%;">Description</th>
                    <th style="width: 10%;" class="text-center">Qty</th>
                    <th style="width: 10%;" class="text-center">Unit</th>
                    <th style="width: 15%;" class="text-right">Unit Price</th>
                    <th style="width: 10%;" class="text-center">Disc %</th>
                    <th style="width: 15%;" class="text-right">Total</th>
                </tr>
            </thead>
            <tbody>
                @foreach($document->lines as $line)
                <tr>
                    <td>
                        <strong>{{ $line->name }}</strong>
                        @if($line->description)
                            <br><small style="color: #6b7280;">{{ $line->description }}</small>
                        @endif
                    </td>
                    <td class="text-center">{{ number_format($line->quantity, 2) }}</td>
                    <td class="text-center">{{ $line->unit }}</td>
                    <td class="text-right">{{ $document->currency_code }} {{ number_format($line->unit_price, 2) }}</td>
                    <td class="text-center">{{ $line->discount_percent }}%</td>
                    <td class="text-right">{{ $document->currency_code }} {{ number_format($line->line_total, 2) }}</td>
                </tr>
                @endforeach
            </tbody>
        </table>
    </div>

    <div class="totals">
        <table>
            <tr>
                <td>Subtotal</td>
                <td class="text-right subtotal">{{ $document->currency_code }} {{ number_format($document->subtotal, 2) }}</td>
            </tr>
            <tr>
                <td>Tax</td>
                <td class="text-right tax">{{ $document->currency_code }} {{ number_format($document->tax_amount, 2) }}</td>
            </tr>
            <tr>
                <td>Total Credit</td>
                <td class="text-right total">{{ $document->currency_code }} {{ number_format($document->total_amount, 2) }}</td>
            </tr>
            @if($document->applied_amount > 0)
            <tr>
                <td>Applied</td>
                <td class="text-right" style="color: #166534;">{{ $document->currency_code }} {{ number_format($document->applied_amount, 2) }}</td>
            </tr>
            <tr>
                <td>Available Balance</td>
                <td class="text-right total">{{ $document->currency_code }} {{ number_format($document->balance_due, 2) }}</td>
            </tr>
            @endif
        </table>
    </div>

    @if($document->notes)
    <div class="notes">
        <h4>Notes</h4>
        <p>{{ $document->notes }}</p>
    </div>
    @endif

    @if($approvalSignatories->isNotEmpty())
    <div class="signatories">
        <h4 class="section-title">Approved By</h4>
        @foreach($approvalSignatories as $signatory)
        <div class="signatory">
            @if($signatory['signature_image_path'])
                <img src="{{ asset('storage/' . $signatory['signature_image_path']) }}" alt="Signature" style="max-height: 40px;"><br>
            @else
                <div class="signatory-line"></div>
            @endif
            <div class="signatory-name">{{ $signatory['name'] }}</div>
            <div class="signatory-title">{{ $signatory['title'] }} @if($signatory['signed_at']) · {{ $signatory['signed_at']->format('Y-m-d H:i') }}@endif</div>
        </div>
        @endforeach
    </div>
    @endif

    <div class="footer">
        <p>{{ $company->name }} · Generated on {{ now()->format('Y-m-d H:i') }} · Page 1 of 1</p>
        @if($company->branding && $company->branding->website)
            <p>{{ $company->branding->website }}</p>
        @endif
    </div>
</body>
</html>