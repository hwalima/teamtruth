<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\Storage;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // Mark application as installed to bypass CheckInstallation middleware
        $installedFile = storage_path('installed');
        if (!file_exists($installedFile)) {
            file_put_contents($installedFile, now()->toIso8601String());
        }
    }
}
