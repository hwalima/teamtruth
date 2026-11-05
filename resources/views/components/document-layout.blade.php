<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>{{ $documentTitle ?: $company->name }}</title>
    <style>
        @if ($hasLetterhead)
            @page { margin: 145px 48px 60px 58px; }
        @endif
        * { box-sizing: border-box; }
        body { margin: 0; color: #1f2937; font-family: DejaVu Sans, Arial, sans-serif; font-size: 10px; }
        .document {
            @if ($hasLetterhead)
                border: 0; padding: 0;
            @else
                border-left: 8px solid {{ $accentColor }}; border-top: 7px solid {{ $accentColor }}; padding: 24px 28px;
            @endif
        }
        @if ($hasLetterhead)
            .document-header { display: none; }
        @endif
        .document-header { border-bottom: 1px solid #d1d5db; padding-bottom: 14px; }
        .document-brand { width: 100%; border-collapse: collapse; }
        .document-logo-cell { width: 112px; padding-right: 18px; vertical-align: middle; }
        .document-logo { max-width: 94px; max-height: 76px; }
        .document-company-name { color: {{ $primaryColor }}; font-size: 17px; font-weight: bold; }
        .document-company-details { color: {{ $secondaryColor }}; line-height: 1.5; margin-top: 4px; }
        .document-company-website { color: {{ $primaryColor }}; font-weight: bold; text-align: right; vertical-align: middle; }
        .document-content { padding: {{ $hasLetterhead ? '12px' : '18px' }} 0; }
        .document-footer { border-top: 2px solid {{ $accentColor }}; color: {{ $secondaryColor }}; font-size: 9px; padding-top: 10px; }
        .document-signatories { width: 100%; border-collapse: collapse; margin-top: 28px; }
        .document-signatories td { padding: 24px 12px 0 0; vertical-align: bottom; width: 50%; }
        .document-signature-line { border-top: 1px solid #64748b; padding-top: 5px; }
        .document-signature { max-height: 42px; max-width: 130px; }
    </style>
</head>
<body>
    <div class="document">
        <header class="document-header">
            <table class="document-brand">
                <tr>
                    <td class="document-logo-cell">
                        @if ($logoDataUri)
                            <img class="document-logo" src="{{ $logoDataUri }}" alt="{{ $company->name }}">
                        @endif
                    </td>
                    <td style="vertical-align: middle;">
                        <div class="document-company-name">{{ $company->legal_name ?: $company->name }}</div>
                        <div class="document-company-details">
                            @if ($company->address) {{ $company->address }}<br> @endif
                            @if ($company->phone) {{ $company->phone }} @endif
                            @if ($company->email) · {{ $company->email }} @endif
                            @if ($company->registration_no) <br>Registration: {{ $company->registration_no }} @endif
                            @if ($company->tax_no) · TIN: {{ $company->tax_no }} @endif
                        </div>
                    </td>
                    <td class="document-company-website">
                        @if ($company->website)
                            {{ preg_replace('#^https?://#', '', $company->website) }}
                        @endif
                    </td>
                </tr>
            </table>
        </header>

        <main class="document-content">
            {{ $slot }}
        </main>

        @if ($signatories->isNotEmpty())
            <table class="document-signatories">
                <tr>
                    @foreach ($signatories as $signatory)
                        <td>
                            @if ($signatory->signature_data_uri)
                                <div><img class="document-signature" src="{{ $signatory->signature_data_uri }}" alt=""></div>
                            @endif
                            <div class="document-signature-line">
                                <strong>{{ $signatory->name }}</strong><br>
                                {{ $signatory->title }}
                                @if ($signatory->signed_at ?? null)
                                    <br><small>Approved {{ $signatory->signed_at->format('Y-m-d H:i') }}</small>
                                @endif
                            </div>
                        </td>
                        @if ($loop->iteration % 2 === 0 && !$loop->last)
                            </tr><tr>
                        @endif
                    @endforeach
                </tr>
            </table>
        @endif

        @if ($company->branding?->letterhead_footer_text)
            <footer class="document-footer">{{ $company->branding->letterhead_footer_text }}</footer>
        @endif
    </div>
</body>
</html>
