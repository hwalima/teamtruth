@php
    $amounts = fn (array $values) => collect($values)
        ->filter(fn ($amount) => (float) $amount != 0)
        ->map(fn ($amount, $currency) => $currency.' '.number_format((float) $amount, 2))
        ->implode("\n");
@endphp
<x-report-layout
    :company="$company"
    :report-title="'Vendor list'"
    :report-subtitle="$filterText"
    :landscape="true"
    :stats="[
        'Vendors' => $vendors->count(),
        'Active' => $vendors->where('is_active', true)->count(),
        'With an email' => $vendors->whereNotNull('email')->count(),
        'Owed' => $amounts($owedTotals) ?: '0.00',
    ]"
>
    <style>
        .name { font-weight: bold; }
        .small { font-size: 7px; color: #6b7280; }
        .inactive { color: #9ca3af; }
        .owed { white-space: pre-line; font-weight: bold; }
    </style>

    <table class="data">
        <thead>
            <tr>
                <th style="width: 7%;">Code</th>
                <th style="width: 22%;">Vendor</th>
                <th style="width: 11%;">Tax number</th>
                <th style="width: 20%;">Email</th>
                <th style="width: 12%;">Phone</th>
                <th>Address</th>
                <th style="width: 6%;">Terms</th>
                <th class="num" style="width: 5%;">Orders</th>
                <th class="num" style="width: 10%;">Owed</th>
            </tr>
        </thead>
        <tbody>
            @forelse ($vendors as $vendor)
                <tr class="{{ $loop->even ? 'zebra' : '' }} {{ $vendor->is_active ? '' : 'inactive' }}">
                    <td>{{ $vendor->code }}</td>
                    <td>
                        <span class="name">{{ $vendor->name }}</span>
                        @unless ($vendor->is_active) <br><span class="small">Inactive</span> @endunless
                    </td>
                    <td>{{ $vendor->tax_no }}</td>
                    <td>{{ $vendor->email }}</td>
                    <td>{{ $vendor->phone }}</td>
                    <td class="small">{{ \Illuminate\Support\Str::limit(str_replace("\n", ', ', (string) $vendor->address), 90) }}</td>
                    <td>{{ $vendor->payment_terms_days }} days{{ $vendor->currency_code ? ' · '.$vendor->currency_code : '' }}</td>
                    <td class="num">{{ $vendor->orders_count }}</td>
                    <td class="num owed">{{ $amounts($owed[$vendor->id] ?? []) }}</td>
                </tr>
            @empty
                <tr><td colspan="9" class="empty">No vendors match these filters.</td></tr>
            @endforelse
        </tbody>
    </table>
</x-report-layout>
