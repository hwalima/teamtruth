<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" @class(['dark' => ($appearance ?? 'system') == 'dark'])>

<head>
    <base href="{{ \Illuminate\Support\Facades\Request::getBasePath() }}">
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">

    {{-- Inline script to detect system dark mode preference and apply it immediately --}}
    <script>
        (function() {
            const appearance = '{{ $appearance ?? 'system' }}';

            if (appearance === 'system') {
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

                if (prefersDark) {
                    document.documentElement.classList.add('dark');
                }
            }
        })();

        // Define asset helper function
        window.asset = function(path) {
            return "{{ asset('') }}" + path;
        };
        // Define storage helper function
        window.storage = function(path) {
            return "{{ asset('storage') }}/" + path;
        };
    </script>

    {{-- Inline style to set the HTML background color based on our theme in app.css --}}
    <style>
        html {
            background-color: oklch(1 0 0);
        }

        html.dark {
            background-color: oklch(0.145 0 0);
        }
    </style>

    <title inertia>{{ config('app.name', 'Laravel') }}</title>
{{-- SEO Meta Tags --}}
    @php
        $seoSettings = settings();
    @endphp
    <!-- Debug: {{ json_encode($seoSettings) }} -->
    @if(!empty($seoSettings['metaKeywords']))
        <meta name="keywords" content="{{ $seoSettings['metaKeywords'] }}">
    @endif
    @if(!empty($seoSettings['metaDescription']))
        <meta name="description" content="{{ $seoSettings['metaDescription'] }}">
    @endif
    @if(!empty($seoSettings['metaImage']))
        <meta property="og:image"
            content="{{ str_starts_with($seoSettings['metaImage'], 'http') ? $seoSettings['metaImage'] : url($seoSettings['metaImage']) }}">
    @endif
    <meta property="og:title" content="{{ config('app.name', 'Laravel') }}">
    <meta property="og:type" content="website">
    <meta name="twitter:card" content="summary_large_image">    

    <link rel="icon" type="image/png" href="{{ asset('images/logos/favicon.png') }}">
    <link rel="manifest" href="/manifest.json">
    <meta name="theme-color" content="#E3B448">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="Team Truth">
    <link rel="apple-touch-icon" href="{{ asset('images/icons/icon-192x192.png') }}">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <script src="{{ asset('js/jquery.min.js') }}"></script>
    <script src="{{ asset('js/frappe-gantt.js') }}"></script>
    <link rel="stylesheet" href="{{ asset('css/frappe-gantt.css') }}">
    @routes
    @if (app()->environment('local') && file_exists(public_path('hot')))
        @viteReactRefresh
    @endif
    @vite(['resources/js/app.tsx'])
    <script>
        window.baseUrl = '{{ url('/') }}';
    </script>
    @inertiaHead
</head>
<body class="font-sans antialiased">
    @inertia
    <script>
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js').catch(() => {});
            });
        }

        // Capture install prompt for mobile
        let deferredPrompt;
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            // Show install banner after a short delay
            setTimeout(() => {
                const banner = document.getElementById('pwa-install-banner');
                if (banner) banner.style.display = 'flex';
            }, 3000);
        });

        window.addEventListener('appinstalled', () => {
            const banner = document.getElementById('pwa-install-banner');
            if (banner) banner.style.display = 'none';
            deferredPrompt = null;
        });

        function installPWA() {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                deferredPrompt.userChoice.then(() => {
                    deferredPrompt = null;
                    const banner = document.getElementById('pwa-install-banner');
                    if (banner) banner.style.display = 'none';
                });
            }
        }

        function dismissInstall() {
            const banner = document.getElementById('pwa-install-banner');
            if (banner) banner.style.display = 'none';
        }
    </script>

    <div id="pwa-install-banner" style="display:none;position:fixed;bottom:0;left:0;right:0;z-index:99999;background:#001a4d;color:#fff;padding:12px 16px;align-items:center;justify-content:space-between;gap:12px;box-shadow:0 -2px 10px rgba(0,0,0,0.2);">
        <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">
            <img src="/images/icons/icon-72x72.png" alt="Team Truth" style="width:40px;height:40px;border-radius:8px;">
            <div style="min-width:0;">
                <div style="font-weight:600;font-size:14px;">Install Team Truth</div>
                <div style="font-size:12px;opacity:0.8;">Add to your home screen</div>
            </div>
        </div>
        <div style="display:flex;gap:8px;flex-shrink:0;">
            <button onclick="dismissInstall()" style="padding:6px 12px;border:1px solid rgba(255,255,255,0.3);border-radius:6px;background:transparent;color:#fff;font-size:13px;cursor:pointer;">Later</button>
            <button onclick="installPWA()" style="padding:6px 12px;border:none;border-radius:6px;background:#E3B448;color:#001a4d;font-weight:600;font-size:13px;cursor:pointer;">Install</button>
        </div>
    </div>
</body>
</html>