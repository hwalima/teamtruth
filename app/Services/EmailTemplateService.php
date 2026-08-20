<?php

namespace App\Services;

use App\Models\EmailTemplate;
use App\Mail\CommonTemplateMail;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Config;
use Exception;

class EmailTemplateService
{
    public function sendTemplateEmail(string $templateName, array $variables, string $toEmail, $business = null, string $toName = null)
    {
        try {
            // Get email template
            $template = EmailTemplate::where('name', $templateName)->first();
            
            if (!$template) {
                throw new Exception("Email template '{$templateName}' not found");
            }

            // Get user's language or default to 'en'
            $language = 'en'; // default
            
            // Get template content for the language
            $templateLang = $template->emailTemplateLangs()
                ->where('lang', $language)
                ->first();

            // Fallback to English if language not found
            if (!$templateLang) {
                $templateLang = $template->emailTemplateLangs()
                    ->where('lang', 'en')
                    ->first();
            }
            
            if (!$templateLang) {
                throw new Exception("No content found for template '{$templateName}'");
            }

            // Replace variables in subject and content
            $subject = $this->replaceVariables($templateLang->subject, $variables);
            $content = $this->replaceVariables($templateLang->content, $variables);
            $fromName = $this->replaceVariables($template->from, $variables);

            // Configure SMTP settings
            $this->configureBusinessSMTP($business);

            // Send email using styled notification template
            Mail::send('emails.notification', [
                'subject' => $subject,
                'content' => $content
            ], function ($message) use ($subject, $toEmail, $toName, $fromEmail, $finalFromName) {
                $message->to($toEmail, $toName)
                    ->subject($subject)
                    ->from($fromEmail, $finalFromName);
            });
            
            return true;
        } catch (Exception $e) {
            \Log::error('Email sending failed: ' . $e->getMessage());
            throw $e;
        }
    }

    private function replaceVariables(string $content, array $variables): string
    {
        return str_replace(array_keys($variables), array_values($variables), $content);
    }

    public function sendTemplateEmailWithLanguage(string $templateName, array $variables, string $toEmail, string $toName = null, string $language = 'en', $creatorId = null)
    {
        try {
            
            // Get email template
            $template = EmailTemplate::where('name', $templateName)->first();
            
            if (!$template) {
                throw new Exception("Email template '{$templateName}' not found");
            }
            
            // Get template content for the specified language
            $templateLang = $template->emailTemplateLangs()
                ->where('lang', $language)
                ->first();
            
            // Fallback to English if language not found
            if (!$templateLang) {
                $templateLang = $template->emailTemplateLangs()
                    ->where('lang', 'en')
                    ->first();
            }
            
            if (!$templateLang) {
                throw new Exception("No content found for template '{$templateName}'");
            }

            // Replace variables in subject and content
            $subject = $this->replaceVariables($templateLang->subject, $variables);
            $content = $this->replaceVariables($templateLang->content, $variables);
            $fromName = $this->replaceVariables($template->from, $variables);

            // Configure SMTP settings with creator ID
            $this->configureBusinessSMTP(null, $creatorId);

            // Get final email settings
            $fromEmail = getSetting('email_from_address', null, $creatorId) ?: config('mail.from.address');
            $finalFromName = getSetting('email_from_name', null, $creatorId) ? $this->replaceVariables(getSetting('email_from_name', null, $creatorId), $variables) : $fromName;

            // Send email using styled notification template
            Mail::send('emails.notification', [
                'subject' => $subject,
                'content' => $content
            ], function ($message) use ($subject, $toEmail, $toName, $fromEmail, $finalFromName) {
                $message->to($toEmail, $toName)
                    ->subject($subject)
                    ->from($fromEmail, $finalFromName);
            });
                        
            return true;
        } catch (Exception $e) {
            \Log::error('Email sending failed: ' . $e->getMessage());
            throw $e;
        }
    }

    private function configureBusinessSMTP($business = null, $creatorId = null)
    {
        // Get email settings from settings table using creator ID
        $emailDriver = getSetting('email_driver', 'smtp', $creatorId);
        $emailHost = getSetting('email_host', null, $creatorId);
        $emailUsername = getSetting('email_username', null, $creatorId);
        $emailPassword = getSetting('email_password', null, $creatorId);
        $emailPort = getSetting('email_port', 587, $creatorId);
        $emailEncryption = getSetting('email_encryption', 'tls', $creatorId);

        // Check if email settings are configured
        if (!$emailHost || !$emailUsername || !$emailPassword) {
            throw new Exception("Email settings not configured. Please configure email settings in system settings.");
        }

        // Configure mail settings
        Config::set([
            'mail.default' => $emailDriver,
            'mail.mailers.smtp.host' => $emailHost,
            'mail.mailers.smtp.port' => $emailPort,
            'mail.mailers.smtp.username' => $emailUsername,
            'mail.mailers.smtp.password' => $emailPassword,
            'mail.mailers.smtp.encryption' => $emailEncryption,
        ]);
    }
}