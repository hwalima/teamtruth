@php
    $money = fn ($amount) => (str_starts_with((string) $amount, '-') ? '(' : '').number_format(abs((float) $amount), 2).(str_starts_with((string) $amount, '-') ? ')' : '');
    $sections = [
        ['Assets', $data['assets'], $data['totalAssets'], 'Total assets'],
        ['Liabilities', $data['liabilities'], $data['totalLiabilities'], 'Total liabilities'],
        ['Equity', $data['equity'], $data['totalEquity'], 'Total equity'],
    ];
@endphp
<x-report-layout
    :company="$company"
    :report-title="$reportTitle"
    :report-subtitle="$asOfText.' · amounts in '.$currency"
    :stats="[
        'Assets' => $money($data['totalAssets']),
        'Liabilities' => $money($data['totalLiabilities']),
        'Equity' => $money($data['totalEquity']),
    ]"
>
    <style>
        .section td { font-weight: bold; font-size: 9.5px; padding-top: 12px; border-bottom: 2px solid #d1d5db; }
        .subtotal td { font-weight: bold; border-top: 1px solid #9ca3af; }
        .grand td { font-weight: bold; font-size: 10px; border-top: 2px solid #111827; border-bottom: 3px double #111827; }
        .code { color: #6b7280; width: 14%; }
        .warn { margin-top: 12px; padding: 8px 10px; border-radius: 6px; background: #fef3c7; color: #92400e; }
    </style>

    <table class="data">
        <thead>
            <tr><th>Code</th><th>Account</th><th class="num">Amount</th></tr>
        </thead>
        <tbody>
            @foreach ($sections as [$title, $lines, $total, $totalLabel])
                <tr class="section"><td colspan="3">{{ $title }}</td></tr>
                @forelse ($lines as $line)
                    <tr class="{{ $loop->even ? 'zebra' : '' }}">
                        <td class="code">{{ $line['code'] }}</td>
                        <td>{{ $line['name'] }}</td>
                        <td class="num">{{ $money($line['amount']) }}</td>
                    </tr>
                @empty
                    <tr><td></td><td class="code">Nothing recorded</td><td></td></tr>
                @endforelse
                <tr class="subtotal"><td></td><td>{{ $totalLabel }}</td><td class="num">{{ $money($total) }}</td></tr>
            @endforeach
            <tr class="grand"><td></td><td>Total liabilities and equity</td><td class="num">{{ $money($data['totalLiabilitiesAndEquity']) }}</td></tr>
        </tbody>
    </table>

    @if ((float) $data['difference'] != 0)
        <div class="warn">Assets and liabilities plus equity differ by {{ $money($data['difference']) }}. Check for entries posted to accounts without a type, or opening balances not yet entered.</div>
    @endif
</x-report-layout>
