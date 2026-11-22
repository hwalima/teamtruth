{{-- Styles shared by the invoice and credit note PDFs, in the company's colours. Tables only: the PDF engine does not lay out flexbox. --}}
<style>
    .sd-heading { border-collapse: collapse; margin-bottom: 16px; width: 100%; }
    .sd-heading td { vertical-align: top; }
    .sd-kicker { color: {{ $accentColor }}; font-size: 9px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; }
    .sd-title { color: {{ $primaryColor }}; font-size: 22px; font-weight: bold; margin: 4px 0 0; }
    .sd-reference { background: #f8fafc; border-left: 3px solid {{ $accentColor }}; padding: 8px 10px; text-align: right; }
    .sd-reference strong { color: {{ $primaryColor }}; font-size: 12px; }
    .sd-status { color: #64748b; display: block; font-size: 9px; margin-top: 4px; text-transform: uppercase; }
    .sd-details { border-collapse: collapse; margin-bottom: 14px; width: 100%; }
    .sd-details td { border: 1px solid #e2e8f0; padding: 8px 10px; vertical-align: top; }
    .sd-label { color: #64748b; display: block; font-size: 8px; font-weight: bold; letter-spacing: .5px; margin-bottom: 4px; text-transform: uppercase; }
    .sd-value { color: #111827; font-size: 10px; font-weight: bold; }
    .sd-muted { color: #64748b; font-size: 9px; line-height: 1.5; }
    .sd-lines { border-collapse: collapse; width: 100%; }
    .sd-lines thead { background: {{ $primaryColor }}; color: #fff; }
    .sd-lines th { border-bottom: 3px solid {{ $accentColor }}; font-size: 8px; letter-spacing: .3px; padding: 9px 7px; text-align: left; text-transform: uppercase; }
    .sd-lines td { border-bottom: 1px solid #e2e8f0; padding: 8px 7px; vertical-align: top; }
    .sd-lines tbody tr:nth-child(even) { background: #f8fafc; }
    .sd-number { text-align: right; white-space: nowrap; }
    .sd-totals { border-collapse: collapse; margin: 12px 0 0 auto; width: 46%; }
    .sd-totals td { padding: 5px 7px; }
    .sd-totals .sd-grand td { border-top: 2px solid {{ $accentColor }}; color: {{ $primaryColor }}; font-size: 12px; font-weight: bold; padding-top: 9px; }
    .sd-totals .sd-owing td { color: {{ $primaryColor }}; font-weight: bold; }
    .sd-note { border-left: 3px solid {{ $accentColor }}; margin: 18px 0 0; padding: 6px 10px; }
    .sd-note p { line-height: 1.5; margin: 4px 0 0; white-space: pre-wrap; }
    .sd-fiscal { background: #f8fafc; border: 1px solid #e2e8f0; margin-top: 18px; padding: 8px 10px; }
</style>
