<x-document-layout
    :company="$company"
    :document-title="$documentTitle"
    :document-type="$reportTitle"
    :approval-signatories="$approvalSignatories ?? []"
>
    <h1 style="color: #1e293b; font-size: 20px; margin: 0 0 6px;">{{ $reportTitle }}</h1>
    <p style="color: #64748b; margin: 0 0 16px;">{{ $reportPeriod }}</p>
    <table style="border-collapse: collapse; width: 100%; font-size: 8px;">
        <thead>
            <tr style="background: #f1f5f9;">
                @foreach ($columns as $column)
                    <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: left;">{{ $column }}</th>
                @endforeach
            </tr>
        </thead>
        <tbody>
            @forelse ($rows as $row)
                <tr>
                    @foreach ($row as $cell)
                        <td style="border: 1px solid #cbd5e1; padding: 5px;">{{ $cell }}</td>
                    @endforeach
                </tr>
            @empty
                <tr>
                    <td colspan="{{ count($columns) }}" style="border: 1px solid #cbd5e1; padding: 8px;">No report activity for this period.</td>
                </tr>
            @endforelse
        </tbody>
    </table>
</x-document-layout>