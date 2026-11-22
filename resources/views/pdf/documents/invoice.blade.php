<x-document-layout
    :company="$company"
    :document-title="($document->type === 'proforma' ? 'Proforma invoice ' : 'Invoice ').$document->document_number"
    document-type="invoice"
    :approval-signatories="$approvalSignatories ?? []"
>
    @php
        $color = fn (?string $value, string $fallback) => $value && preg_match('/^#[0-9a-fA-F]{6}$/', $value) ? $value : $fallback;
        $primaryColor = $color($company->branding?->primary_color, '#1e293b');
        $accentColor = $color($company->branding?->accent_color, '#2563eb');
        $currency = $document->currency_code;
        $money = fn ($amount) => $currency.' '.number_format((float) $amount, 2);
        $showDiscount = $document->lines->contains(fn ($line) => (float) $line->discount_percent > 0);
        $showTax = $document->lines->contains(fn ($line) => (float) $line->tax_rate > 0);
        $fiscal = $document->fiscalDocuments()->where('status', 'success')->latest('id')->first();
        $customer = $document->customer;
    @endphp
    @include('pdf.documents.partials.sales-document-styles')

    <table class="sd-heading">
        <tr>
            <td>
                <div class="sd-kicker">{{ $document->type === 'proforma' ? 'Quotation for payment' : 'Tax invoice' }}</div>
                <h1 class="sd-title">{{ $document->type === 'proforma' ? 'PROFORMA INVOICE' : 'INVOICE' }}</h1>
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
                <span class="sd-label">Bill to</span>
                <span class="sd-value">{{ $customer->name }}</span>
                <div class="sd-muted">
                    @if ($customer->billing_address) {!! nl2br(e($customer->billing_address)) !!}<br> @endif
                    @if ($customer->phone) {{ $customer->phone }} @endif
                    @if ($customer->email) @if ($customer->phone) · @endif {{ $customer->email }} @endif
                    @if ($customer->tax_no) <br>TIN: {{ $customer->tax_no }} @endif
                </div>
            </td>
            <td><span class="sd-label">Invoice date</span><span class="sd-value">{{ $document->invoice_date?->format('d M Y') }}</span></td>
            <td><span class="sd-label">Due date</span><span class="sd-value">{{ $document->due_date?->format('d M Y') }}</span></td>
        </tr>
        <tr>
            <td><span class="sd-label">Customer code</span><span class="sd-value">{{ $customer->code }}</span></td>
            <td>
                <span class="sd-label">Currency</span>
                <span class="sd-value">{{ $currency }}</span>
                @if ((float) $document->exchange_rate !== 1.0)
                    <span class="sd-muted"> @ {{ rtrim(rtrim(number_format((float) $document->exchange_rate, 6), '0'), '.') }}</span>
                @endif
            </td>
        </tr>
    </table>

    <table class="sd-lines">
        <thead>
            <tr>
                <th>Description</th>
                <th class="sd-number">Qty</th>
                <th class="sd-number">Unit price</th>
                @if ($showDiscount) <th class="sd-number">Disc.</th> @endif
                @if ($showTax) <th class="sd-number">Tax</th> @endif
                <th class="sd-number">Amount</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($document->lines as $line)
                <tr>
                    <td>
                        <strong>{{ $line->name }}</strong>
                        @if ($line->description) <br><span class="sd-muted">{{ $line->description }}</span> @endif
                    </td>
                    <td class="sd-number">{{ rtrim(rtrim(number_format((float) $line->quantity, 2), '0'), '.') }} {{ $line->unit }}</td>
                    <td class="sd-number">{{ number_format((float) $line->unit_price, 2) }}</td>
                    @if ($showDiscount) <td class="sd-number">{{ (float) $line->discount_percent }}%</td> @endif
                    @if ($showTax) <td class="sd-number">{{ (float) $line->tax_rate }}%</td> @endif
                    <td class="sd-number">{{ number_format((float) $line->line_total, 2) }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>

    <table class="sd-totals">
        <tr><td>Subtotal</td><td class="sd-number">{{ $money($document->subtotal) }}</td></tr>
        @if ((float) $document->discount_amount > 0)
            <tr><td>Discount</td><td class="sd-number">- {{ $money($document->discount_amount) }}</td></tr>
        @endif
        @if ((float) $document->tax_amount > 0)
            <tr><td>Tax</td><td class="sd-number">{{ $money($document->tax_amount) }}</td></tr>
        @endif
        <tr class="sd-grand"><td>Total</td><td class="sd-number">{{ $money($document->total_amount) }}</td></tr>
        @if ((float) $document->paid_amount > 0)
            <tr><td>Paid</td><td class="sd-number">{{ $money($document->paid_amount) }}</td></tr>
            <tr class="sd-owing"><td>Balance due</td><td class="sd-number">{{ $money($document->balance_due) }}</td></tr>
        @endif
    </table>

    @if ($fiscal)
        <div class="sd-fiscal">
            <span class="sd-label">Fiscal details</span>
            <div class="sd-muted">
                Fiscal invoice {{ $fiscal->fiscal_invoice_number }}
                @if ($fiscal->fiscal_receipt_number) · receipt {{ $fiscal->fiscal_receipt_number }} @endif
                @if ($fiscal->fiscal_day_end_number) · day {{ $fiscal->fiscal_day_end_number }} @endif
                @if ($fiscal->fiscalized_at) · {{ $fiscal->fiscalized_at->format('d M Y H:i') }} @endif
                @if ($fiscal->fiscal_signature) <br>Signature: {{ \Illuminate\Support\Str::limit($fiscal->fiscal_signature, 60) }} @endif
            </div>
        </div>
    @endif

    @if ($document->terms)
        <div class="sd-note"><span class="sd-label">Terms and conditions</span><p>{{ $document->terms }}</p></div>
    @endif
    @if ($document->notes)
        <div class="sd-note"><span class="sd-label">Notes</span><p>{{ $document->notes }}</p></div>
    @endif
    @if ($document->footer_notes)
        <div class="sd-note"><p>{{ $document->footer_notes }}</p></div>
    @endif
</x-document-layout>
