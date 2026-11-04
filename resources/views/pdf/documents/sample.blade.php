<x-document-layout
    :company="$company"
    document-title="ERP branded document sample"
    :document-type="$documentType ?? null"
    :approval-signatories="$approvalSignatories ?? []"
>
    @php
        $samplePrimaryColor = $company->branding?->primary_color;
        if (!$samplePrimaryColor || !preg_match('/^#[0-9a-fA-F]{6}$/', $samplePrimaryColor)) {
            $samplePrimaryColor = '#1e293b';
        }
    @endphp
    <h1 style="color: {{ $samplePrimaryColor }}; font-size: 22px; margin: 0 0 12px;">Branded document preview</h1>
    <p>This sample confirms that this document uses the branding for <strong>{{ $company->name }}</strong>.</p>
    @if (!empty($sampleText))
        <p>{{ $sampleText }}</p>
    @endif
</x-document-layout>
