@php
    $isReturn = $document->isReturn();
    $order = $document->salesOrder;
    $customer = $order->customer;
@endphp
<x-document-layout
    :company="$company"
    :document-title="($isReturn ? 'Return note ' : 'Delivery note ').$document->document_number"
    :document-type="$isReturn ? 'sales_return' : 'sales_delivery'"
    :approval-signatories="$approvalSignatories ?? []"
>
    @php
        $color = fn (?string $value, string $fallback) => $value && preg_match('/^#[0-9a-fA-F]{6}$/', $value) ? $value : $fallback;
        $primaryColor = $color($company->branding?->primary_color, '#1e293b');
        $accentColor = $color($company->branding?->accent_color, '#2563eb');
        $quantity = fn ($value) => rtrim(rtrim(number_format((float) $value, 4), '0'), '.');
        $address = $customer?->shipping_address ?: $customer?->billing_address;
    @endphp
    @include('pdf.documents.partials.sales-document-styles')

    <table class="sd-heading">
        <tr>
            <td>
                <div class="sd-kicker">{{ $isReturn ? 'Goods received back from the customer' : 'Goods delivered to the customer' }}</div>
                <h1 class="sd-title">{{ $isReturn ? 'RETURN NOTE' : 'DELIVERY NOTE' }}</h1>
            </td>
            <td style="width: 42%;">
                <div class="sd-reference">
                    <strong>{{ $document->document_number }}</strong>
                    <span class="sd-status">Order {{ $order->document_number }}</span>
                </div>
            </td>
        </tr>
    </table>

    <table class="sd-details">
        <tr>
            <td rowspan="2" style="width: 46%;">
                <span class="sd-label">{{ $isReturn ? 'Returned by' : 'Deliver to' }}</span>
                <span class="sd-value">{{ $customer?->name }}</span>
                <div class="sd-muted">
                    @if ($address) {!! nl2br(e($address)) !!}<br> @endif
                    @if ($customer?->phone) {{ $customer->phone }} @endif
                    @if ($customer?->email) @if ($customer?->phone) · @endif {{ $customer->email }} @endif
                </div>
            </td>
            <td>
                <span class="sd-label">{{ $isReturn ? 'Received on' : 'Delivered on' }}</span>
                <span class="sd-value">{{ $document->delivered_at?->format('d M Y') }}</span>
            </td>
            <td>
                <span class="sd-label">{{ $isReturn ? 'Received by' : 'Dispatched by' }}</span>
                <span class="sd-value">{{ $document->deliveredBy?->name ?? '—' }}</span>
            </td>
        </tr>
        <tr>
            <td>
                <span class="sd-label">Customer code</span>
                <span class="sd-value">{{ $customer?->code }}</span>
            </td>
            <td>
                <span class="sd-label">Your reference</span>
                <span class="sd-value">{{ $order->customer_reference ?: '—' }}</span>
            </td>
        </tr>
    </table>

    <table class="sd-lines">
        <thead>
            <tr>
                <th style="width: 4%;">#</th>
                <th style="width: 50%;">Item</th>
                <th class="sd-number" style="text-align: right;">Quantity</th>
                <th>{{ $isReturn ? 'Back to' : 'From' }}</th>
                <th>Lot / serial</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($document->lines as $line)
                @php $product = $line->orderLine?->product; @endphp
                <tr>
                    <td>{{ $loop->iteration }}</td>
                    <td>
                        <strong>{{ $line->orderLine?->description ?? $product?->name }}</strong>
                        @if ($product?->sku) <br><span class="sd-muted">{{ $product->sku }}</span> @endif
                    </td>
                    <td class="sd-number">{{ $quantity($line->quantity) }} {{ $product?->unit?->abbreviation }}</td>
                    <td>{{ $line->location?->name ?? '—' }}</td>
                    <td>{{ $line->lot_code ?: '—' }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>

    @if ($document->notes)
        <div class="sd-note">
            <span class="sd-label">{{ $isReturn ? 'Reason for return' : 'Notes' }}</span>
            <p>{!! nl2br(e($document->notes)) !!}</p>
        </div>
    @endif

    <table class="sd-details" style="margin-top: 28px;">
        <tr>
            <td style="width: 50%; padding-top: 34px;">
                <span class="sd-label">{{ $isReturn ? 'Handed back by (customer)' : 'Received in good order by' }}</span>
                <div class="sd-muted"><br>Name: ______________________________</div>
                <div class="sd-muted"><br>Signature: __________________________</div>
                <div class="sd-muted"><br>Date: ______________________________</div>
            </td>
            <td style="padding-top: 34px;">
                <span class="sd-label">{{ $isReturn ? 'Received for' : 'Delivered for' }} {{ $company->legal_name ?: $company->name }}</span>
                <div class="sd-muted"><br>Name: ______________________________</div>
                <div class="sd-muted"><br>Signature: __________________________</div>
                <div class="sd-muted"><br>Date: ______________________________</div>
            </td>
        </tr>
    </table>
</x-document-layout>
