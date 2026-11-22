<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>{{ $reportTitle ?: $company->name }}</title>
    <style>
        @page { size: A4 {{ $landscape ? 'landscape' : 'portrait' }}; margin: 26px 30px 52px 30px; }
        * { box-sizing: border-box; }
        body { margin: 0; color: #1f2937; font-family: DejaVu Sans, Arial, sans-serif; font-size: 8.5px; line-height: 1.35; }

        .band { width: 100%; border-collapse: collapse; background: {{ $primaryColor }}; color: {{ $onPrimary }}; border-radius: 10px; }
        .band td { vertical-align: middle; padding: 16px 18px; }
        .band .logo-cell { width: 102px; padding-right: 0; }
        .logo-box { background: #ffffff; border-radius: 8px; padding: 6px; text-align: center; width: 84px; height: 64px; }
        .logo-box img { max-width: 72px; max-height: 52px; }
        .logo-initial { font-size: 28px; font-weight: bold; color: {{ $primaryColor }}; line-height: 52px; }
        .company-name { font-size: 15px; font-weight: bold; letter-spacing: 0.2px; }
        .company-details { font-size: 8px; margin-top: 3px; line-height: 1.5; }
        .title-cell { text-align: right; width: 38%; }
        .report-kicker { font-size: 7.5px; letter-spacing: 1.6px; text-transform: uppercase; }
        .report-title { font-size: 19px; font-weight: bold; margin-top: 2px; }
        .report-meta { font-size: 8px; margin-top: 4px; }
        .accent-rule { height: 4px; background: {{ $accentColor }}; border-radius: 2px; margin: 6px 0 14px; }

        .stats { width: 100%; border-collapse: separate; border-spacing: 8px 0; margin: 0 0 14px; }
        .stat { background: {{ $primaryTint }}; border-left: 4px solid {{ $accentColor }}; border-radius: 6px; padding: 9px 12px; }
        .stat-value { font-size: 15px; font-weight: bold; color: {{ $primaryColor }}; }
        .stat-label { font-size: 7.5px; color: {{ $secondaryColor }}; text-transform: uppercase; letter-spacing: 0.8px; margin-top: 1px; }

        table.data { width: 100%; border-collapse: collapse; }
        table.data thead { display: table-header-group; }
        table.data th { background: {{ $primaryColor }}; color: {{ $onPrimary }}; font-size: 7.5px; text-transform: uppercase; letter-spacing: 0.6px; text-align: left; padding: 7px 8px; font-weight: bold; }
        table.data td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
        table.data tr.zebra td { background: {{ $primaryTint }}; }
        table.data tr { page-break-inside: avoid; }
        .num, table.data th.num { text-align: right; white-space: nowrap; }
        .empty { text-align: center; color: {{ $secondaryColor }}; padding: 24px 8px; }

        .footer { position: fixed; bottom: -36px; left: 0; right: 0; height: 24px; border-top: 1.5px solid {{ $accentColor }}; padding-top: 6px; font-size: 7.5px; color: {{ $secondaryColor }}; }
        .footer table { width: 100%; border-collapse: collapse; }
        .footer .page:after { content: "Page " counter(page) " of " counter(pages); }
    </style>
</head>
<body>
    <div class="footer">
        <table>
            <tr>
                <td>
                    <strong style="color: {{ $primaryColor }};">{{ $company->legal_name ?: $company->name }}</strong>
                    @if ($company->branding?->letterhead_footer_text) &nbsp;·&nbsp; {{ $company->branding->letterhead_footer_text }} @endif
                </td>
                <td style="text-align: center;">{{ $reportTitle }} · generated {{ $generatedAt }}</td>
                <td style="text-align: right;"><span class="page"></span></td>
            </tr>
        </table>
    </div>

    <table class="band">
            <tr>
                <td class="logo-cell">
                    <div class="logo-box">
                        @if ($logoDataUri)
                            <img src="{{ $logoDataUri }}" alt="{{ $company->name }}">
                        @else
                            <div class="logo-initial">{{ mb_strtoupper(mb_substr($company->name, 0, 1)) }}</div>
                        @endif
                    </div>
                </td>
                <td>
                    <div class="company-name">{{ $company->legal_name ?: $company->name }}</div>
                    <div class="company-details">
                        @if ($company->address) {{ $company->address }}<br> @endif
                        {{ collect([$company->phone, $company->email, $company->website ? preg_replace('#^https?://#', '', $company->website) : null])->filter()->implode('  ·  ') }}
                        @if ($company->registration_no || $company->tax_no)
                            <br>{{ collect([$company->registration_no ? 'Reg. '.$company->registration_no : null, $company->tax_no ? 'TIN '.$company->tax_no : null])->filter()->implode('  ·  ') }}
                        @endif
                    </div>
                </td>
                <td class="title-cell">
                    <div class="report-kicker">Report</div>
                    <div class="report-title">{{ $reportTitle }}</div>
                    <div class="report-meta">
                        @if ($reportSubtitle) {{ $reportSubtitle }}<br> @endif
                        Generated {{ $generatedAt }}
                    </div>
                </td>
            </tr>
        </table>
        <div class="accent-rule"></div>

    @if (count($stats) > 0)
        <table class="stats">
            <tr>
                @foreach ($stats as $label => $value)
                    <td class="stat">
                        <div class="stat-value">{{ $value }}</div>
                        <div class="stat-label">{{ $label }}</div>
                    </td>
                @endforeach
            </tr>
        </table>
    @endif

    {{ $slot }}
</body>
</html>
