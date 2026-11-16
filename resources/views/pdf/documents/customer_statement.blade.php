<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Customer Statement {{ $customer->code }}</title>
    <style>
        @page {
            margin: 20mm 15mm 25mm 15mm;
        }
        body {
            font-family: 'DejaVu Sans', sans-serif;
            font-size: 9pt;
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
            font-size: 8pt;
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
        .document-meta {
            margin-top: 10px;
            font-size: 8pt;
            color: #374151;
        }
        .document-meta div {
            margin: 3px 0;
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
            font-size: 8pt;
            font-weight: bold;
            color: #6b7280;
            text-transform: uppercase;
            margin-bottom: 5px;
        }
        .party-address {
            font-size: 8pt;
            line-height: 1.6;
            white-space: pre-wrap;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            font-size: 8pt;
        }
        th {
            background: #1e3a5f;
            color: white;
            padding: 6px 4px;
            text-align: left;
            font-weight: 600;
        }
        td {
            padding: 4px;
            border-bottom: 1px solid #e5e7eb;
        }
        tr:last-child td {
            border-bottom: none;
        }
        .text-right { text-align: right; }
        .text-center { text-align: center; }

        .totals {
            margin-top: 30px;
            padding-top: 15px;
            border-top: 2px solid #1e3a5f;
        }
        .totals table {
            width: 300px;
            float: right;
        }
        .totals td {
            padding: 4px 8px;
            border: none;
        }
        .totals .balance {
            border-top: 2px solid #1e3a5f;
            font-weight: bold;
            font-size: 10pt;
            color: #1e3a5f;
        }

        .notes {
            clear: both;
            margin-top: 30px;
            padding-top: 15px;
            border-top: 1px solid #e5e7eb;
        }
        .notes h4 {
            font-size: 8pt;
            font-weight: bold;
            color: #6b7280;
            text-transform: uppercase;
            margin-bottom: 5px;
        }
        .notes p {
            font-size: 8pt;
            white-space: pre-wrap;
        }

        .footer {
            margin-top: 40px;
            padding-top: 15px;
            border-top: 1px solid #e5e7eb;
            font-size: 7pt;
            color: #6b7280;
            text-align: center;
        }

        .period-info {
            background: #f9fafb;
            border: 1px solid #e5e7eb;
            border-radius: 4px;
            padding: 10px;
            margin-bottom: 20px;
            font-size: 8pt;
        }
    </style>
</head>
<body>
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
            <div class="document-title">Customer Statement</div>
            <div class="document-meta">
                <div><strong>Customer:</strong> {{ $customer->name }} ({{ $customer->code }})</div>
                <div><strong>Period:</strong> {{ $dateFrom ?? 'Beginning' }} to {{ $dateTo ?? now()->format('Y-m-d') }}</div>
                <div><strong>Currency:</strong> {{ $totals['currency_code'] }}</div>
                <div><strong>Generated:</strong> {{ now()->format('Y-m-d H:i') }}</div>
            </div>
        </div>
    </div>

    <div class="party-details">
        <div class="party">
            <h4>From</h4>
            <div class="party-address">
                <strong>{{ $company->name }}</strong><br>
                {{ $company->code }}<br>
                @if($company->branding && $company->branding->address)
                    {{ $company->branding->address }}
                @endif
            </div>
        </div>
        <div class="party" style="text-align: right;">
            <h4>To</h4>
            <div class="party-address">
                <strong>{{ $customer->name }}</strong><br>
                {{ $customer->code }}<br>
                @if($customer->tax_no)
                    Tax No: {{ $customer->tax_no }}<br>
                @endif
                @if($customer->billing_address)
                    {{ $customer->billing_address }}
                @endif
            </div>
        </div>
    </div>

    <div class="period-info">
        <strong>Statement Period:</strong> {{ $dateFrom ?? 'All transactions' }} to {{ $dateTo ?? now()->format('Y-m-d') }}
    </div>

    <table>
        <thead>
            <tr>
                <th style="width: 12%;">Date</th>
                <th style="width: 10%;">Type</th>
                <th style="width: 18%;">Reference</th>
                <th style="width: 25%;">Description</th>
                <th style="width: 12%;" class="text-right">Debit</th>
                <th style="width: 12%;" class="text-right">Credit</th>
                <th style="width: 12%;" class="text-right">Balance</th>
            </tr>
        </thead>
        <tbody>
            @foreach($statementLines as $line)
            <tr>
                <td>{{ \Carbon\CarbonImmutable::parse($line['date'])->format('Y-m-d') }}</td>
                <td>
                    @if($line['type'] === 'invoice')
                        <span style="color: #1e40af; font-weight: 500;">Invoice</span>
                    @elseif($line['type'] === 'credit_note')
                        <span style="color: #7e22ce; font-weight: 500;">Credit Note</span>
                    @else
                        <span style="color: #166534; font-weight: 500;">Payment</span>
                    @endif
                </td>
                <td>{{ $line['reference'] }}</td>
                <td>{{ $line['description'] }}</td>
                <td class="text-right">{{ $totals['currency_code'] }} {{ number_format($line['debit'], 2) }}</td>
                <td class="text-right">{{ $totals['currency_code'] }} {{ number_format($line['credit'], 2) }}</td>
                <td class="text-right" style="color: {{ $line['balance'] > 0 ? '#991b1b' : '#166534' }}; font-weight: 500;">
                    {{ $totals['currency_code'] }} {{ number_format($line['balance'], 2) }}
                </td>
            </tr>
            @endforeach
        </tbody>
    </table>

    <div class="totals">
        <table>
            <tr>
                <td>Total Invoiced</td>
                <td class="text-right">{{ $totals['currency_code'] }} {{ number_format($totals['total_invoiced'], 2) }}</td>
            </tr>
            <tr>
                <td>Total Credited</td>
                <td class="text-right">{{ $totals['currency_code'] }} {{ number_format($totals['total_credited'], 2) }}</td>
            </tr>
            <tr>
                <td>Total Paid</td>
                <td class="text-right">{{ $totals['currency_code'] }} {{ number_format($totals['total_paid'], 2) }}</td>
            </tr>
            <tr>
                <td class="balance">Outstanding Balance</td>
                <td class="text-right balance" style="color: {{ $totals['balance'] > 0 ? '#991b1b' : '#166534' }};">
                    {{ $totals['currency_code'] }} {{ number_format($totals['balance'], 2) }}
                </td>
            </tr>
        </table>
    </div>

    @if($customer->notes)
    <div class="notes">
        <h4>Notes</h4>
        <p>{{ $customer->notes }}</p>
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