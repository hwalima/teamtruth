<?php

/*
 * A UTF-8 BOM at the start of a PHP file is printed as output the moment the
 * file is loaded. PHP then considers headers "already sent", so Laravel cannot
 * send Set-Cookie (session + XSRF-TOKEN) and every form POST fails with 419.
 */
test('no PHP file loaded at boot starts with a UTF-8 BOM', function () {
    $root = dirname(__DIR__, 2);
    $offenders = [];

    foreach (['app', 'bootstrap', 'config', 'routes', 'database', 'lang', 'public'] as $dir) {
        $path = $root.DIRECTORY_SEPARATOR.$dir;
        if (! is_dir($path)) {
            continue;
        }

        $files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($path, FilesystemIterator::SKIP_DOTS));
        foreach ($files as $file) {
            if ($file->getExtension() !== 'php' || str_contains($file->getPathname(), DIRECTORY_SEPARATOR.'cache'.DIRECTORY_SEPARATOR)) {
                continue;
            }
            $handle = fopen($file->getPathname(), 'rb');
            $head = fread($handle, 3);
            fclose($handle);
            if ($head === "\xEF\xBB\xBF") {
                $offenders[] = substr($file->getPathname(), strlen($root) + 1);
            }
        }
    }

    expect($offenders)->toBe([]);
});
