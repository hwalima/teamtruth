@php
    $money = fn ($amount) => \App\Modules\Banking\Models\Money::format(\App\Modules\Banking\Models\Money::cents($amount));
    $stamp = fn ($value) => $value ? $value->timezone(config('app.timezone'))->format('d/m/Y H:i') : '';
    $totals = $rows->whereIn('status', ['approved', 'transferred'])->groupBy('currency')
        ->map(fn ($group, $currency) => $currency.' '.\App\Modules\Banking\Models\Money::format($group->sum(fn ($r) => \App\Modules\Banking\Models\Money::cents($r->amount))))
        ->implode(' · ');
@endphp
<x-report-layout
    :company="$company"
    :report-title="'Fund transfer register'"
    :report-subtitle="$filterText"
    :landscape="true"
    :stats="[
        'Requests' => $rows->count(),
        'Approved' => $rows->whereIn('status', ['approved', 'transferred'])->count(),
        'Transferred' => $rows->where('status', 'transferred')->count(),
        'Approved value' => $totals ?: '0.00',
    ]"
>
    <style>
        .sig { max-height: 26px; max-width: 90px; display: block; margin-bottom: 2px; }
        .who { font-weight: bold; }
        .small { font-size: 7px; color: #6b7280; }
        .status { font-weight: bold; text-transform: uppercase; font-size: 7px; letter-spacing: 0.5px; }
        .status-rejected, .status-cancelled { color: #b91c1c; }
        .status-transferred { color: #047857; }
        .status-approved { color: #1d4ed8; }
        .status-pending { color: #b45309; }
    </style>

    <table class="data">
        <thead>
            <tr>
                <th style="width: 7%;">Ref.</th>
                <th style="width: 15%;">From → to</th>
                <th>Purpose</th>
                <th class="num" style="width: 10%;">Amount</th>
                <th style="width: 8%;">Status</th>
                <th style="width: 15%;">Requested by</th>
                <th style="width: 15%;">Approved by</th>
                <th style="width: 8%;">Transferred</th>
            </tr>
        </thead>
        <tbody>
            @forelse ($rows as $row)
                <tr class="{{ $loop->even ? 'zebra' : '' }}">
                    <td>{{ $row->reference }}</td>
                    <td>
                        <span class="who">{{ $row->fromCompany->name }}</span><br>
                        <span class="small">→</span> {{ $row->toCompany->name }}<br>
                        <span class="small">{{ $row->fromAccount->account_number }} → {{ $row->toAccount->account_number }}</span>
                    </td>
                    <td>{{ \Illuminate\Support\Str::limit($row->purpose, 140) }}</td>
                    <td class="num">{{ $row->currency }} {{ $money($row->amount) }}</td>
                    <td><span class="status status-{{ $row->status }}">{{ $row->status }}</span></td>
                    <td>
                        @if ($row->requester_signature_uri) <img class="sig" src="{{ $row->requester_signature_uri }}" alt=""> @endif
                        <span class="who">{{ $row->requester_name }}</span>
                        @if ($row->requester_title) <br><span class="small">{{ $row->requester_title }}</span> @endif
                        <br><span class="small">{{ $stamp($row->requested_at) }}</span>
                    </td>
                    <td>
                        @if ($row->decided_at)
                            @if ($row->approver_signature_uri) <img class="sig" src="{{ $row->approver_signature_uri }}" alt=""> @endif
                            <span class="who">{{ $row->approver_name }}</span>
                            @if ($row->approver_title) <br><span class="small">{{ $row->approver_title }}</span> @endif
                            <br><span class="small">{{ $row->status === 'rejected' ? 'Rejected' : 'Signed' }} {{ $stamp($row->decided_at) }}</span>
                        @else
                            <span class="small">Not yet decided</span>
                        @endif
                    </td>
                    <td>{{ $row->transfer?->transfer_date?->format('d/m/Y') }}</td>
                </tr>
            @empty
                <tr><td colspan="8" class="empty">No fund requests match these filters.</td></tr>
            @endforelse
        </tbody>
    </table>
</x-report-layout>
