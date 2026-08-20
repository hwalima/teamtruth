<?php

namespace App\Services;

use App\Models\Setting;
use App\Models\Workspace;
use App\Models\User;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Auth;

class MailConfigService
{
    public static function setDynamicConfig($userId = null, $workspaceId = null)
    {
        $user = Auth::user();
        
        if (!$user && !$userId) {
            return;
        }
        
        // Use authenticated user if no userId provided
        if (!$userId && $user) {
            if (isSaasMode()) {
                if ($user->type == 'superadmin') {
                    $userId = $user->id;
                } else if ($user->type == 'company') {
                    // For company users, use super admin's SMTP
                    $superAdmin = User::where('type', 'superadmin')->first();
                    $userId = $superAdmin ? $superAdmin->id : $user->id;
                    $workspaceId = null; // Use super admin settings, not workspace
                } else {
                    // For workspace members, use company owner's settings
                    $userId = $user->created_by;
                    if (!$workspaceId && $user->current_workspace_id) {
                        $workspaceId = $user->current_workspace_id;
                    }
                }
            } else {
                if ($user->type == 'company') {
                    $userId = $user->id;
                } else {
                    $userId = $user->created_by;
                }
            }
        }
        
        $settings = self::getMailSettings($userId, $workspaceId);
        
        // Validate SMTP settings before applying
        if (!self::isValidMailConfig($settings)) {
            $settings['driver'] = 'log';
        }

        Config::set([
            'mail.default' => $settings['driver'],
            'mail.mailers.smtp.host' => $settings['host'],
            'mail.mailers.smtp.port' => $settings['port'],
            'mail.mailers.smtp.encryption' => $settings['encryption'] === 'none' ? null : $settings['encryption'],
            'mail.mailers.smtp.username' => $settings['username'],
            'mail.mailers.smtp.password' => $settings['password'],
            'mail.from.address' => $settings['fromAddress'],
            'mail.from.name' => $settings['fromName'],
        ]);
        
        return $settings;
    }
    
    /**
     * Check if email is properly configured
     */
    public static function isEmailConfigured($userId = null, $workspaceId = null): bool
    {
        $settings = self::getMailSettings($userId, $workspaceId);
        return self::isValidMailConfig($settings);
    }
    
    private static function getMailSettings($userId = null, $workspaceId = null)
    {
        // Get settings for the specified user
        if ($userId) {
            $getSettings = settings($userId, $workspaceId);
        } else {
            $getSettings = settings();
        }
        
        return [
            'driver' => $getSettings['email_driver'] ?? 'smtp',
            'host' => $getSettings['email_host'] ?? 'smtp.example.com',
            'port' => $getSettings['email_port'] ?? '587',
            'username' => $getSettings['email_username'] ?? '',
            'password' => $getSettings['email_password'] ?? '',
            'encryption' => $getSettings['email_encryption'] ?? 'tls',
            'fromAddress' => $getSettings['email_from_address'] ?? 'noreply@example.com',
            'fromName' => $getSettings['email_from_name'] ?? 'WorkDo System'
        ];
    }
    
    private static function isValidMailConfig($settings)
    {
        if ($settings['driver'] !== 'smtp') {
            return true;
        }
        
        $invalidHosts = ['smtp.example.com', 'example.com', 'localhost', '127.0.0.1'];

        if (empty($settings['host']) || in_array($settings['host'], $invalidHosts)) {
            return false;
        }
        
        if (empty($settings['fromAddress']) || strpos($settings['fromAddress'], 'example.com') !== false) {
            return false;
        }
        
        if (empty($settings['username']) || empty($settings['password'])) {
            return false;
        }
        
        return true;
    }
}