@php
    $money = fn ($amount) => (float) $amount == 0 ? '' : ((float) $amount < 0 ? '(' : '').number_format(abs((float) $amount), 2).((float) $amount < 0 ? ')' : '');
    $bucketKeys = array_keys($data['buckets']);
    $stats = [$partnerLabel.'s' => collect($data['partners'])->pluck('partnerId')->unique()->count()];
    foreach ($data['totals'] as $total) {
        $stats['Owed '.$total['currency']] = number_format((float) $total['total'], 2);
        $stats['Over 90 days '.$total['currency']] = number_format((float) $total['over_90'], 2);
    }
@endphp
<x-report-layout
    :company="$company"
    :report-title="$reportTitle"
    :report-subtitle="$asOfText"
    :landscape="true"
    :stats="array_slice($stats, 0, 5, true)"
>
    <style>
        .partner { font-weight: bold; }
        .docs { font-size: 7px; color: #6b7280; }
        .total td { font-weight: bold; border-top: 2px solid #111827; }
        .late { color: #b91c1c; }
    </style>

    <table class="data">
        <thead>
            <tr>
                <th>{{ $partnerLabel }}</th>
                <th>Currency</th>
                @foreach ($data['buckets'] as $label)
                    <th class="num">{{ $label }}</th>
                @endforeach
                <th class="num">Unused credits</th>
                <th class="num">Total</th>
            </tr>
        </thead>
        <tbody>
            @forelse ($data['partners'] as $partner)
                <tr class="{{ $loop->even ? 'zebra' : '' }}">
                    <td>
                        <span class="partner">{{ $partner['partner'] }}</span>
                        @if (count($partner['documents']))
                            <br><span class="docs">{{ count($partner['documents']) }} open · oldest {{ $partner['documents'][0]['daysOverdue'] }} days overdue</span>
                        @endif
                    </td>
                    <td>{{ $partner['currency'] }}</td>
                    @foreach ($bucketKeys as $key)
                        <td class="num {{ $key !== 'current' && (float) $partner[$key] > 0 ? 'late' : '' }}">{{ $money($partner[$key]) }}</td>
                    @endforeach
                    <td class="num">{{ $money($partner['credits']) }}</td>
                    <td class="num partner">{{ $money($partner['total']) }}</td>
                </tr>
            @empty
                <tr><td colspan="{{ count($bucketKeys) + 4 }}" class="empty">Nothing was outstanding on this date.</td></tr>
            @endforelse
            @foreach ($data['totals'] as $total)
                <tr class="total">
                    <td>Total · {{ $total['partners'] }} {{ strtolower($partnerLabel) }}{{ $total['partners'] === 1 ? '' : 's' }}</td>
                    <td>{{ $total['currency'] }}</td>
                    @foreach ($bucketKeys as $key)
                        <td class="num">{{ $money($total[$key]) }}</td>
                    @endforeach
                    <td class="num">{{ $money($total['credits']) }}</td>
                    <td class="num">{{ $money($total['total']) }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>
</x-report-layout>
