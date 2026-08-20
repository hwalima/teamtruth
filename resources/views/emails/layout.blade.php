<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>@yield('title', config('app.name'))</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <style>
    body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
    table,td{mso-table-lspace:0pt;mso-table-rspace:0pt;}
    img{border:0;height:auto;line-height:100%;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;}
    table{border-collapse:collapse!important;}
    body{height:100%!important;margin:0!important;padding:0!important;width:100%!important;background-color:#eef2f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;}

    .email-card{max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 32px rgba(0,26,77,.10);}

    /* Header */
    .email-header{background:linear-gradient(135deg,#001a4d 0%,#002d80 70%,#001435 100%);padding:32px 40px 0;text-align:center;}
    .header-logo img{max-height:56px;width:auto;display:inline-block;}
    .header-logo-text{color:#fff;font-size:22px;font-weight:700;letter-spacing:1px;margin:8px 0 0;}

    /* Body */
    .email-body{padding:36px 40px 28px;color:#1f2937;}
    .email-body h2{color:#001a4d;font-size:22px;font-weight:700;margin:0 0 16px;line-height:1.3;}
    .email-body p{color:#374151;font-size:15px;line-height:1.7;margin:0 0 14px;}
    .email-body strong{color:#001a4d;}
    .email-body a[href]{color:#001a4d;}

    /* Rewrite any seeded inline buttons to gold */
    .email-body p a[style]{
      background:linear-gradient(135deg,#E3B448 0%,#c99a2e 100%)!important;
      color:#001a4d!important;
      padding:13px 30px!important;
      border-radius:8px!important;
      font-weight:700!important;
      display:inline-block!important;
      text-decoration:none!important;
      font-size:14px!important;
      box-shadow:0 4px 14px rgba(227,180,72,.35)!important;
      letter-spacing:.3px!important;
    }

    /* Footer */
    .email-footer{background:#001a4d;padding:28px 40px;text-align:center;}
    .footer-tagline{color:#E3B448;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0 0 10px;}
    .footer-text{color:rgba(255,255,255,.45);font-size:12px;margin:0;line-height:1.6;}
    .footer-brand{color:rgba(255,255,255,.75);font-size:13px;font-weight:600;margin:0 0 6px;}

    @media screen and (max-width:600px){
      .email-card{border-radius:0!important;}
      .email-body,.email-header,.email-footer{padding-left:24px!important;padding-right:24px!important;}
      .email-body h2{font-size:19px!important;}
    }

    @yield('styles')
  </style>
</head>
<body>

<table width="100%" border="0" cellspacing="0" cellpadding="0" style="background:#eef2f7;padding:32px 0;">
  <tr>
    <td align="center" valign="top">

      <table class="email-card" width="600" border="0" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;">

        <!-- ── Header ── -->
        <tr>
          <td class="email-header" style="background:linear-gradient(135deg,#001a4d 0%,#002d80 70%,#001435 100%);padding:32px 40px 0;text-align:center;">
            <div class="header-logo">
              @php $logoUrl = getSidebarLogo(); @endphp
              @if($logoUrl)
                <img src="{{ $logoUrl }}" alt="{{ config('app.name') }}" style="max-height:52px;width:auto;display:inline-block;" />
              @else
                <div class="header-logo-text" style="color:#fff;font-size:22px;font-weight:700;letter-spacing:1px;">{{ config('app.name') }}</div>
              @endif
            </div>
            <!-- Wave -->
            <div style="line-height:0;font-size:0;margin-top:20px;">
              <svg viewBox="0 0 600 36" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" style="width:100%;height:36px;display:block;">
                <path d="M0,18 C100,36 200,0 300,18 C400,36 500,0 600,18 L600,36 L0,36 Z" fill="#ffffff"/>
              </svg>
            </div>
          </td>
        </tr>

        <!-- ── Gold accent line ── -->
        <tr>
          <td style="background:#ffffff;padding:0 40px;">
            <div style="height:3px;background:linear-gradient(90deg,#E3B448,#f0c96a,#E3B448);border-radius:3px;"></div>
          </td>
        </tr>

        <!-- ── Body ── -->
        <tr>
          <td class="email-body" style="padding:36px 40px 28px;background:#ffffff;">
            @if(isset($content))
              {!! $content !!}
            @else
              @yield('content')
            @endif
          </td>
        </tr>

        <!-- ── Footer ── -->
        <tr>
          <td class="email-footer" style="background:#001a4d;padding:28px 40px;text-align:center;">
            <p class="footer-tagline" style="color:#E3B448;font-size:11px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;margin:0 0 10px;">
              &mdash;&nbsp; Together we can do more &nbsp;&mdash;
            </p>
            <p class="footer-brand" style="color:rgba(255,255,255,.75);font-size:13px;font-weight:600;margin:0 0 8px;">{{ config('app.name') }}</p>
            <p class="footer-text" style="color:rgba(255,255,255,.4);font-size:11px;margin:0;line-height:1.6;">
              @yield('footer', 'This is an automated email from ' . config('app.name') . '.')
            </p>
          </td>
        </tr>

        <!-- ── Gold bottom bar ── -->
        <tr>
          <td style="background:#E3B448;height:4px;font-size:0;line-height:0;">&nbsp;</td>
        </tr>

      </table>

    </td>
  </tr>
</table>

</body>
</html>
