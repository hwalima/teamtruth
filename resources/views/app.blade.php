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
</body>
</html>