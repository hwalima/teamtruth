<x-document-layout
    :company="$company"
    document-title="Requisition"
    :document-type="$documentType ?? null"
    :approval-signatories="$approvalSignatories ?? []"
>
    @php
        $primaryColor = $company->branding?->primary_color ?: '#1e293b';
        $accentColor = $company->branding?->accent_color ?: '#2563eb';
        $requisitionType = \App\Modules\Requisitions\Models\Requisition::TYPES[$document->requisition_type] ?? $document->requisition_type;
    @endphp
    <style>
        .requisition-heading { border-collapse: collapse; margin-bottom: 16px; width: 100%; }
        .requisition-heading td { vertical-align: top; }
        .requisition-kicker { color: {{ $accentColor }}; font-size: 9px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; }
        .requisition-title { color: {{ $primaryColor }}; font-size: 22px; font-weight: bold; margin: 4px 0 0; }
        .requisition-reference { background: #f8fafc; border-left: 3px solid {{ $accentColor }}; padding: 8px 10px; text-align: right; }
        .requisition-reference strong { color: {{ $primaryColor }}; font-size: 11px; }
        .requisition-reference span { color: #64748b; display: block; font-size: 9px; margin-top: 4px; text-transform: uppercase; }
        .requisition-details { border-collapse: collapse; margin-bottom: 14px; width: 100%; }
        .requisition-details td { border: 1px solid #e2e8f0; padding: 8px 10px; vertical-align: top; width: 50%; }
        .requisition-label { color: #64748b; display: block; font-size: 8px; font-weight: bold; letter-spacing: .5px; margin-bottom: 4px; text-transform: uppercase; }
        .requisition-value { color: #111827; font-size: 10px; font-weight: bold; }
        .requisition-justification { border-left: 3px solid {{ $accentColor }}; margin: 0 0 18px; padding: 8px 10px; }
        .requisition-justification p { line-height: 1.5; margin: 4px 0 0; }
        .requisition-section-title { color: {{ $primaryColor }}; font-size: 12px; margin: 18px 0 8px; }
        .requisition-lines { border-collapse: collapse; width: 100%; }
        .requisition-lines thead { background: {{ $primaryColor }}; color: #fff; }
        .requisition-lines th { border-bottom: 3px solid {{ $accentColor }}; font-size: 8px; letter-spacing: .3px; padding: 9px 7px; text-align: left; text-transform: uppercase; }
        .requisition-lines td { border-bottom: 1px solid #e2e8f0; padding: 8px 7px; vertical-align: top; }
        .requisition-lines tbody tr:nth-child(even) { background: #f8fafc; }
        .requisition-lines .number { text-align: right; white-space: nowrap; }
        .requisition-total { border-collapse: collapse; margin-top: 10px; width: 100%; }
        .requisition-total td { border-top: 2px solid {{ $accentColor }}; color: {{ $primaryColor }}; font-size: 12px; font-weight: bold; padding: 10px 7px; }
        .requisition-total .amount { font-size: 15px; text-align: right; }
    </style>

    <table class="requisition-heading">
        <tr>
            <td>
                <div class="requisition-kicker">Request for goods or services</div>
                <h1 class="requisition-title">REQUISITION</h1>
            </td>
            <td style="width: 42%;">
                <div class="requisition-reference">
                    <strong>{{ $document->document_number }}</strong>
                    <span>{{ str_replace('_', ' ', $document->status->value) }}</span>
                </div>
            </td>
        </tr>
    </table>

    <table class="requisition-details">
        <tr>
            <td><span class="requisition-label">Requester</span><span class="requisition-value">{{ $document->requester->name }}</span></td>
            <td><span class="requisition-label">Request type</span><span class="requisition-value">{{ $requisitionType }}</span></td>
        </tr>
        <tr>
            <td><span class="requisition-label">Department</span><span class="requisition-value">{{ $document->department ?: '—' }}</span></td>
            <td><span class="requisition-label">Cost center</span><span class="requisition-value">{{ $document->cost_center ?: '—' }}</span></td>
        </tr>
        <tr>
            <td><span class="requisition-label">Required by</span><span class="requisition-value">{{ $document->required_by?->format('d F Y') ?: 'Not specified' }}</span></td>
            <td><span class="requisition-label">Priority</span><span class="requisition-value">{{ ucfirst($document->priority) }}</span></td>
        </tr>
    </table>

    <div class="requisition-justification">
        <span class="requisition-label">Business justification</span>
        <p>{{ $document->justification }}</p>
    </div>

    <h2 class="requisition-section-title">Requested items</h2>
    <table class="requisition-lines">
        <thead>
            <tr>
                <th>Item / description</th>
                <th class="number">Quantity</th>
                <th class="number">Unit price</th>
                <th class="number">Estimated total</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($document->lines as $line)
                <tr>
                    <td>
                        <strong>{{ $line->item }}</strong>
                        @if($line->description)<br><small style="color: #64748b;">{{ $line->description }}</small>@endif
                        @if($line->gl_account || $line->budget_line)
                            <br><small style="color: #64748b;">{{ $line->gl_account ? 'GL '.$line->gl_account : '' }}{{ $line->gl_account && $line->budget_line ? ' · ' : '' }}{{ $line->budget_line ? 'Budget '.$line->budget_line : '' }}</small>
                        @endif
                    </td>
                    <td class="number">{{ $line->quantity }} {{ $line->unit }}</td>
                    <td class="number">{{ $document->currency_code }} {{ $line->estimated_unit_price }}</td>
                    <td class="number">{{ $document->currency_code }} {{ $line->estimated_total }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>
    <table class="requisition-total">
        <tr>
            <td style="text-align: right;">ESTIMATED TOTAL</td>
            <td class="amount" style="width: 35%;">{{ $document->currency_code }} {{ $document->estimated_total }}</td>
        </tr>
    </table>
</x-document-layout>
