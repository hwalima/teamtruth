<?php

namespace App\Listeners;

use App\Events\WorkspaceInvited;
use App\Models\User;
use App\Services\EmailTemplateService;
use Exception;

class SendWorkspaceInvitationEmail
{
    public function __construct(
        private EmailTemplateService $emailService,
    ) {
    }

    public function handle(WorkspaceInvited $event): void
    {
        $invitation = $event->invitation;
        $workspace = $invitation->workspace;
        $invitedBy = $invitation->invitedBy;

        if (isEmailTemplateEnabled('Workspace Invitation', createdBy())) {
            // Prepare email variables
            $variables = [
                '{workspace_name}' => $workspace->name ?? '-',
                '{invited_by_name}' => $invitedBy->name ?? '-',
                '{invitee_email}' => $invitation->email ?? '-',
                '{user_name}' => $invitation->email ?? '-',
                '{role}' => ucfirst($invitation->role) ?? '-',
                '{invitation_link}' => route('invitations.show', $invitation->token),
                '{company_name}' => config('app.name'),
                '{app_name}' => config('app.name'),
            ];

            try {
                // Send workspace invitation email
                $userLanguage = (auth()->user() && auth()->user()->lang) ? auth()->user()->lang : 'en';
                $this->emailService->sendTemplateEmailWithLanguage(
                    templateName: 'Workspace Invitation',
                    variables: $variables,
                    toEmail: $invitation->email,
                    toName: $invitation->email,
                    language: $userLanguage
                );
            } catch (Exception $e) {
                \Log::error('Workspace invitation email failed', [
                    'invitation_id' => $invitation->id,
                    'email' => $invitation->email,
                    'error' => $e->getMessage()
                ]);
            }
        }
    }
}