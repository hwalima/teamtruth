<?php

namespace App\Services;

use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Storage;

class DynamicStorageService
{
    /**
     * Configure dynamic storage disks based on database settings
     */
    public static function configureDynamicDisks(): void
    {
        $config = StorageConfigService::getStorageConfig();

        // Only override S3 config when credentials come from the DB settings (SaaS per-workspace S3).
        // When credentials are in .env (config:cache), do NOT override — let filesystems.php stand.
        if (!empty($config['s3']['key']) && !empty($config['s3']['secret'])) {
            Config::set('filesystems.disks.s3', [
                'driver'                  => 's3',
                'key'                     => $config['s3']['key'],
                'secret'                  => $config['s3']['secret'],
                'region'                  => $config['s3']['region'],
                'bucket'                  => $config['s3']['bucket'],
                'url'                     => $config['s3']['url'] ?? null,
                'endpoint'                => $config['s3']['endpoint'] ?? null,
                'use_path_style_endpoint' => false,
                // Inherit visibility from filesystems.php — never hardcode public-read ACL
                'visibility'              => config('filesystems.disks.s3.visibility', 'private'),
            ]);
        }

        // Configure Wasabi disk if credentials exist
        if (!empty($config['wasabi']['key']) && !empty($config['wasabi']['secret'])) {
            Config::set('filesystems.disks.wasabi', [
                'driver'                  => 's3',
                'key'                     => $config['wasabi']['key'],
                'secret'                  => $config['wasabi']['secret'],
                'region'                  => $config['wasabi']['region'],
                'bucket'                  => $config['wasabi']['bucket'],
                'endpoint'                => 'https://s3.' . $config['wasabi']['region'] . '.wasabisys.com',
                'use_path_style_endpoint' => false,
                'visibility'              => 'private',
            ]);
        }
    }

    /**
     * Get the active storage disk instance
     */
    public static function getActiveDiskInstance()
    {
        $diskName = StorageConfigService::getActiveDisk();
        
        // Ensure disk is configured
        self::configureDynamicDisks();
        
        try {
            return Storage::disk($diskName);
        } catch (\Exception $e) {
            // Fallback to public disk
            return Storage::disk('public');
        }
    }

    /**
     * Test storage connection
     */
    public static function testConnection(string $diskName): bool
    {
        try {
            self::configureDynamicDisks();
            $disk = Storage::disk($diskName);
            
            // Try to write and read a test file
            $testContent = 'test-' . time();
            $testPath = 'test-connection.txt';
            
            $disk->put($testPath, $testContent);
            $retrieved = $disk->get($testPath);
            $disk->delete($testPath);
            
            return $retrieved === $testContent;
        } catch (\Exception $e) {
            return false;
        }
    }
}