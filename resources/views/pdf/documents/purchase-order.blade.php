<x-document-layout
    :company="$company"
    :document-title="'Purchase order '.$document->document_number"
    document-type="purchase_order"
    :approval-signatories="$approvalSignatories ?? []"
>
    @php
        $color = fn (?string $value, string $fallback) => $value && preg_match('/^#[0-9a-fA-F]{6}$/', $value) ? $value : $fallback;
        $primaryColor = $color($company->branding?->primary_color, '#1e293b');
        $accentColor = $color($company->branding?->accent_color, '#2563eb');
        $currency = $document->currency_code;
        $money = fn ($amount) => $currency.' '.number_format((float) $amount, 2);
        $quantity = fn ($value) => rtrim(rtrim(number_format((float) $value, 4), '0'), '.');
        $vendor = $document->vendor;
        $approved = in_array($document->status, ['approved', 'partially_received', 'received'], true);
    @endphp
    @include('pdf.documents.partials.sales-document-styles')

    <table class="sd-heading">
        <tr>
            <td>
                <div class="sd-kicker">{{ $approved ? 'Order to supply' : 'Not yet approved' }}</div>
                <h1 class="sd-title">PURCHASE ORDER</h1>
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
                <span class="sd-label">Vendor</span>
                <span class="sd-value">{{ $vendor->name }}</span>
                <div class="sd-muted">
                    @if ($vendor->address) {!! nl2br(e($vendor->address)) !!}<br> @endif
                    @if ($vendor->phone) {{ $vendor->phone }} @endif
                    @if ($vendor->email) @if ($vendor->phone) · @endif {{ $vendor->email }} @endif
                    @if ($vendor->tax_no) <br>TIN: {{ $vendor->tax_no }} @endif
                </div>
            </td>
            <td>
                <span class="sd-label">Order date</span>
                <span class="sd-value">{{ ($document->approved_at ?? $document->created_at)?->format('d M Y') }}</span>
            </td>
            <td>
                <span class="sd-label">Deliver by</span>
                <span class="sd-value">{{ $document->expected_delivery_date?->format('d M Y') ?? 'As agreed' }}</span>
            </td>
        </tr>
        <tr>
            <td>
                <span class="sd-label">Vendor code</span>
                <span class="sd-value">{{ $vendor->code }}</span>
                @if ($document->quotation?->vendor_reference)
                    <span class="sd-muted"><br>Your quote {{ $document->quotation->vendor_reference }}</span>
                @endif
            </td>
            <td>
                <span class="sd-label">Payment terms</span>
                <span class="sd-value">{{ $vendor->payment_terms_days ? $vendor->payment_terms_days.' days' : 'On delivery' }}</span>
                <span class="sd-muted"><br>Currency {{ $currency }}</span>
            </td>
        </tr>
    </table>

    <table class="sd-lines">
        <thead>
            <tr>
                <th style="width: 4%;">#</th>
                <th style="width: 48%;">Item</th>
                <th class="sd-number" style="text-align: right;">Qty</th>
                <th class="sd-number" style="text-align: right;">Unit price</th>
                <th class="sd-number" style="text-align: right;">Amount</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($document->lines as $line)
                <tr>
                    <td>{{ $loop->iteration }}</td>
                    <td>
                        <strong>{{ $line->product->name }}</strong>
                        <br><span class="sd-muted">{{ $line->product->sku }}</span>
                    </td>
                    <td class="sd-number">{{ $quantity($line->quantity) }} {{ $line->product->unit?->abbreviation }}</td>
                    <td class="sd-number">{{ number_format((float) $line->unit_price, 2) }}</td>
                    <td class="sd-number">{{ number_format((float) $line->line_total, 2) }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>

    <table class="sd-totals">
        <tr class="sd-grand"><td>Order total</td><td class="sd-number">{{ $money($document->total) }}</td></tr>
    </table>

    <div class="sd-note">
        <span class="sd-label">Delivery</span>
        <p>Deliver to {{ $company->legal_name ?: $company->name }}@if ($company->address), {{ $company->address }}@endif. Quote {{ $document->document_number }} on your delivery note and invoice.</p>
    </div>
    @if ($document->sourceRequisition)
        <div class="sd-note">
            <span class="sd-label">Internal reference</span>
            <p>Requisition {{ $document->sourceRequisition->document_number }}</p>
        </div>
    @endif
</x-document-layout>
