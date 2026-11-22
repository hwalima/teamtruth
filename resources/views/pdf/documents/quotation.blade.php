<x-document-layout
    :company="$company"
    :document-title="'Quotation '.$document->document_number"
    document-type="quotation"
    :approval-signatories="$approvalSignatories ?? []"
>
    @php
        $color = fn (?string $value, string $fallback) => $value && preg_match('/^#[0-9a-fA-F]{6}$/', $value) ? $value : $fallback;
        $primaryColor = $color($company->branding?->primary_color, '#1e293b');
        $accentColor = $color($company->branding?->accent_color, '#2563eb');
        $currency = $document->currency_code;
        $money = fn ($amount) => $currency.' '.number_format((float) $amount, 2);
        $quantity = fn ($value) => rtrim(rtrim(number_format((float) $value, 4), '0'), '.');
        $percent = fn ($value) => rtrim(rtrim(number_format((float) $value, 2), '0'), '.').'%';
        $customer = $document->customer;
        $approved = in_array($document->status, ['approved', 'converted'], true);
        $hasDiscount = $document->lines->contains(fn ($line) => (float) $line->discount > 0);
        $hasTax = $document->lines->contains(fn ($line) => (float) $line->tax_rate > 0);
        // The stored subtotal is after discount; show the amount before discount too when there is one.
        $beforeDiscount = (float) $document->subtotal + (float) $document->discount_total;
    @endphp
    @include('pdf.documents.partials.sales-document-styles')

    <table class="sd-heading">
        <tr>
            <td>
                <div class="sd-kicker">{{ $approved ? 'Price offer' : 'Draft, not yet approved' }}</div>
                <h1 class="sd-title">QUOTATION</h1>
            </td>
            <td style="width: 42%;">
                <div class="sd-reference">
                    <strong>{{ $document->document_number }}</strong>
                    <span class="sd-status">{{ str_replace('_', ' ', $document->status) }}</span>
                </div>
            </td>
        </tr>
    </table>

    <table class="sd-details">
        <tr>
            <td rowspan="2" style="width: 46%;">
                <span class="sd-label">Prepared for</span>
                <span class="sd-value">{{ $customer->name }}</span>
                <div class="sd-muted">
                    @if ($customer->billing_address) {!! nl2br(e($customer->billing_address)) !!}<br> @endif
                    @if ($customer->phone) {{ $customer->phone }} @endif
                    @if ($customer->email) @if ($customer->phone) · @endif {{ $customer->email }} @endif
                    @if ($customer->tax_no) <br>TIN: {{ $customer->tax_no }} @endif
                </div>
            </td>
            <td>
                <span class="sd-label">Date</span>
                <span class="sd-value">{{ ($document->approved_at ?? $document->created_at)?->format('d M Y') }}</span>
            </td>
            <td>
                <span class="sd-label">Valid until</span>
                <span class="sd-value">{{ $document->valid_until?->format('d M Y') ?? 'Ask us to confirm' }}</span>
            </td>
        </tr>
        <tr>
            <td>
                <span class="sd-label">Customer code</span>
                <span class="sd-value">{{ $customer->code }}</span>
                @if ($document->opportunity)
                    <span class="sd-muted"><br>{{ $document->opportunity->title }}</span>
                @endif
            </td>
            <td>
                <span class="sd-label">Prepared by</span>
                <span class="sd-value">{{ $document->creator?->name ?? '—' }}</span>
                <span class="sd-muted"><br>Currency {{ $currency }}</span>
            </td>
        </tr>
    </table>

    <table class="sd-lines">
        <thead>
            <tr>
                <th style="width: 4%;">#</th>
                <th style="width: {{ $hasDiscount && $hasTax ? 38 : 46 }}%;">Item</th>
                <th class="sd-number" style="text-align: right;">Qty</th>
                <th class="sd-number" style="text-align: right;">Unit price</th>
                @if ($hasDiscount)<th class="sd-number" style="text-align: right;">Disc.</th>@endif
                @if ($hasTax)<th class="sd-number" style="text-align: right;">Tax</th>@endif
                <th class="sd-number" style="text-align: right;">Amount</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($document->lines as $line)
                <tr>
                    <td>{{ $loop->iteration }}</td>
                    <td>
                        <strong>{{ $line->description }}</strong>
                        @if ($line->product && $line->product->name !== $line->description)
                            <br><span class="sd-muted">{{ $line->product->name }}</span>
                        @endif
                        @if ($line->product?->sku) <br><span class="sd-muted">{{ $line->product->sku }}</span> @endif
                        @if ($line->notes) <br><span class="sd-muted">{{ $line->notes }}</span> @endif
                    </td>
                    <td class="sd-number">{{ $quantity($line->quantity) }} {{ $line->product?->unit?->abbreviation }}</td>
                    <td class="sd-number">{{ number_format((float) $line->unit_price, 2) }}</td>
                    @if ($hasDiscount)<td class="sd-number">{{ (float) $line->discount > 0 ? $percent($line->discount) : '' }}</td>@endif
                    @if ($hasTax)<td class="sd-number">{{ (float) $line->tax_rate > 0 ? $percent($line->tax_rate) : '' }}</td>@endif
                    <td class="sd-number">{{ number_format((float) $line->total, 2) }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>

    <table class="sd-totals">
        @if ((float) $document->discount_total > 0)
            <tr><td>Before discount</td><td class="sd-number">{{ $money($beforeDiscount) }}</td></tr>
            <tr><td>Discount</td><td class="sd-number">- {{ $money($document->discount_total) }}</td></tr>
        @endif
        <tr><td>Subtotal</td><td class="sd-number">{{ $money($document->subtotal) }}</td></tr>
        @if ((float) $document->tax_total > 0)
            <tr><td>Tax</td><td class="sd-number">{{ $money($document->tax_total) }}</td></tr>
        @endif
        <tr class="sd-grand"><td>Total</td><td class="sd-number">{{ $money($document->total) }}</td></tr>
    </table>

    @if ($document->notes)
        <div class="sd-note">
            <span class="sd-label">Notes</span>
            <p>{!! nl2br(e($document->notes)) !!}</p>
        </div>
    @endif
    <div class="sd-note">
        <span class="sd-label">Terms</span>
        <p>
            @if ($document->terms)
                {!! nl2br(e($document->terms)) !!}
            @else
                Prices are in {{ $currency }}@if ($document->valid_until) and hold until {{ $document->valid_until->format('d M Y') }}@endif. Quote {{ $document->document_number }} when you place your order.
            @endif
        </p>
    </div>
</x-document-layout>
