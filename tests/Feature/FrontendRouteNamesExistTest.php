<?php

use Illuminate\Support\Facades\Route;

/*
 * Ziggy's route('name') throws in the browser when the name is not a Laravel
 * route, and React then renders a blank white page. The sidebar runs on every
 * page, so one bad name there takes the whole app down.
 */
test('route names used by the sidebar and ERP pages exist', function () {
    $root = dirname(__DIR__, 2).'/resources/js';
    $files = [$root.'/hooks/use-navigation.tsx'];

    $erp = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root.'/pages/Erp', FilesystemIterator::SKIP_DOTS));
    foreach ($erp as $file) {
        if (in_array($file->getExtension(), ['ts', 'tsx'], true)) {
            $files[] = $file->getPathname();
        }
    }

    $missing = [];
    foreach ($files as $path) {
        $source = file_get_contents($path);
        preg_match_all("/route\(\s*['\"]([A-Za-z0-9._-]+)['\"]/", $source, $matches);
        // route().has('x') && (... route('x') ...) is a deliberate guard.
        preg_match_all("/route\(\)\.has\(\s*['\"]([A-Za-z0-9._-]+)['\"]/", $source, $guarded);

        foreach (array_diff(array_unique($matches[1]), $guarded[1]) as $name) {
            if (! Route::has($name)) {
                $missing[] = $name.' in '.substr($path, strlen($root) + 1);
            }
        }
    }

    expect($missing)->toBe([]);
});
