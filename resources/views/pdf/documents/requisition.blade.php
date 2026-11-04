<x-document-layout
    :company="$company"
    document-title="Requisition"
    :document-type="$documentType ?? null"
    :approval-signatories="$approvalSignatories ?? []"
>
    <h1 style="font-size: 22px; margin: 0 0 12px;">Requisition {{ $document->document_number }}</h1>
    <p><strong>Type:</strong> {{ \App\Modules\Requisitions\Models\Requisition::TYPES[$document->requisition_type] ?? $document->requisition_type }}</p>
    <p><strong>Status:</strong> {{ str_replace('_', ' ', $document->status->value) }}</p>
    <p><strong>Requester:</strong> {{ $document->requester->name }}</p>
    <p><strong>Department:</strong> {{ $document->department ?: '—' }} &nbsp; <strong>Cost center:</strong> {{ $document->cost_center ?: '—' }}</p>
    <p><strong>Required by:</strong> {{ $document->required_by?->format('Y-m-d') ?: '—' }}</p>
    <p><strong>Justification:</strong><br>{{ $document->justification }}</p>

    <table style="border-collapse: collapse; margin-top: 20px; width: 100%;">
        <thead>
            <tr>
                <th style="border-bottom: 1px solid #999; padding: 6px; text-align: left;">Item</th>
                <th style="border-bottom: 1px solid #999; padding: 6px; text-align: right;">Quantity</th>
                <th style="border-bottom: 1px solid #999; padding: 6px; text-align: right;">Unit price</th>
                <th style="border-bottom: 1px solid #999; padding: 6px; text-align: right;">Estimated total</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($document->lines as $line)
                <tr>
                    <td style="border-bottom: 1px solid #ddd; padding: 6px;">{{ $line->item }}@if($line->description)<br><small>{{ $line->description }}</small>@endif</td>
                    <td style="border-bottom: 1px solid #ddd; padding: 6px; text-align: right;">{{ $line->quantity }} {{ $line->unit }}</td>
                    <td style="border-bottom: 1px solid #ddd; padding: 6px; text-align: right;">{{ $document->currency_code }} {{ $line->estimated_unit_price }}</td>
                    <td style="border-bottom: 1px solid #ddd; padding: 6px; text-align: right;">{{ $document->currency_code }} {{ $line->estimated_total }}</td>
                </tr>
            @endforeach
        </tbody>
        <tfoot>
            <tr>
                <th colspan="3" style="padding: 8px; text-align: right;">Total</th>
                <th style="padding: 8px; text-align: right;">{{ $document->currency_code }} {{ $document->estimated_total }}</th>
            </tr>
        </tfoot>
    </table>
</x-document-layout>
