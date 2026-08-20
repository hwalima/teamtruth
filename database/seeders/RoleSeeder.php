<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;

class RoleSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        if (isSaasMode()) {
            // Create super admin role (SaaS platform admin)
            $superAdminRole = Role::updateOrCreate(
                ['name' => 'superadmin', 'guard_name' => 'web'],
                [
                    'label' => 'Super Admin',
                    'description' => 'Super Admin has full access to all SaaS platform features',
                ]
            );
            // Super Admin gets permissions for specific modules
            $superAdminModulePermissions = Permission::whereIn('module', [
                'dashboards',
                'company',
                'plan',
                'coupon',
                'currency',
                'landing_page',
                'custom_page',
                'newsletter',
                'contact',
                'language',
                'media',
                'email_template',
                'settings_cookie',
                'referral'
            ])->get();

            // Get settings permissions excluding slack and telegram
            $settingsPermissions = Permission::where('module', 'settings')
                ->whereNotIn('name', ['settings_slack', 'settings_telegram', 'settings_email_notification', 'settings_webhook', 'settings_tax', 'settings_invoice', 'settings_google_calendar', 'settings_google_meet'])
                ->get();

            $superAdminNamePermissions = Permission::whereIn('name', [
                'user_view_logs',
            ])->get();

            $superAdminPermissions = $superAdminModulePermissions
                ->merge($settingsPermissions)
                ->merge($superAdminNamePermissions);
            $superAdminRole->syncPermissions($superAdminPermissions);


            // Company role gets full access to specific modules (excluding role/permission management)
            $companyModulePermissions = Permission::whereIn('module', [
                'dashboards',
                'workspace',
                'projects',
                'tasks',
                'bugs',
                'timesheet',
                'budget',
                'expense',
                'expense_approval',
                'invoice',
                'media',
                'report',
                'notification_template',
                'webhook',
                'zoom_meeting',
                'google_meeting',
                'tax',
                'notes',
                'contract_types',
                'contracts',
                'contract_notes',
                'contract_comments',
                'contract_attachments',
                'contracts_signature',
                'task_calendar',
                'project_report',
                'project_permissions',
                'todos',

            ])->get();

            $companyLimitedPermissions = Permission::whereIn('name', [
                'plan_view_any',
                'plan_request',
                'plan_trial',
                'plan_subscribe',
                'plan_view_my_requests',
                'plan_view_my_orders',
                'settings_view',
                'settings_update',
                'settings_brand',
                'settings_currency',
                'settings_email',
                'settings_email_notification',
                'settings_payment',
                'settings_slack',
                'settings_telegram',
                'settings_zoom',
                'settings_tax',
                'settings_invoice',
                'settings_google_calendar',
                'settings_google_meet',
                'user_view_logs',
                'settings_webhook',
                'language_view',
                'language_update',
                'language_manage',
                'referral_view_any',
                'referral_view',
                'referral_create',
                'referral_manage',
                'referral_payout',
                'calendar_view',
                'calendar_view_local',
                'calendar_view_google',
                'calendar_sync_google',
            ])->get();

            $companyPermissions = $companyModulePermissions->merge($companyLimitedPermissions);
        } else {
            $companyPermissions = Permission::whereIn('module', [
                'dashboards',
                'workspace',
                'currency',
                'projects',
                'tasks',
                'bugs',
                'timesheet',
                'budget',
                'expense',
                'expense_approval',
                'invoice',
                'media',
                'user',
                'language',
                'landing_page',
                'custom_page',
                'newsletter',
                'contact',
                'settings',
                'report',
                'email_template',
                'notification_template',
                'user_view_logs',
                'webhook',
                'zoom_meeting',
                'tax',
                'notes',
                'contract_types',
                'contracts',
                'contract_notes',
                'contract_comments',
                'contract_attachments',
                'contracts_signature',
                'calendar',
                'task_calendar',
                'project_report',
                'settings_google_meet',
                'google_meeting',
                'project_permissions',
                'todos',
            ])->get();
        }


        // Create company role (SaaS tenant/customer)
        $companyRole = Role::updateOrCreate(
            ['name' => 'company', 'guard_name' => 'web'],
            [
                'label' => 'Company',
                'description' => 'Company has access to manage their business workspace',
            ]
        );
        $companyRole->syncPermissions($companyPermissions);

        $ownerRole = Role::updateOrCreate(
            ['name' => 'owner', 'guard_name' => 'web'],
            ['label' => 'Owner', 'description' => 'Owner with read-only access']
        );
        $ownerRole->syncPermissions($companyPermissions);

        // Create manager role (company child)
        $managerRole = Role::updateOrCreate(
            ['name' => 'manager', 'guard_name' => 'web'],
            ['label' => 'Manager', 'description' => 'Manager with full workspace management']
        );

        $managerPermissions = Permission::whereIn('module', ['dashboards', 'tasks', 'bugs', 'timesheet', 'budget', 'expense', 'expense_approval', 'invoice', 'media', 'report', 'notes', 'calendar', 'task_calendar', 'project_report'])
            ->orWhereIn('name', [
                'workspace_switch',
                'workspace_leave',
                'user_view_logs',
                'zoom_meeting_view_any',
                'zoom_meeting_view',
                'zoom_meeting_join',
                'google_meeting_view_any',
                'google_meeting_view',
                'google_meeting_join',
                'project_view_any',
                'project_view',
                'project_create',
                'project_update',
                'project_delete',
                'project_assign_members',
                'project_assign_clients',
                'project_assign',
                'project_manage_budget',
                'project_manage_milestones',
                'project_manage_attachments',
                'project_generate_reports',
                'project_track_progress',
                'project_manage_notes',
                'project_view_activity',
                'project_view_gantt',
                'project_permission_update',
                'todo_view_any',
                'todo_view',
                'todo_status_update',
                'todo_update',
                'todo_attachment_download',
            ])
            ->get();
        $managerRole->syncPermissions($managerPermissions);

        // Create member role (company child)
        $memberRole = Role::updateOrCreate(
            ['name' => 'member', 'guard_name' => 'web'],
            ['label' => 'Member', 'description' => 'Member with limited workspace access']
        );

        $memberPermissions = Permission::whereIn('name', [
            'dashboard_view',
            // 'workspace_view_any',
            // 'workspace_view',
            'workspace_switch',
            'workspace_leave',
            'project_view_any',
            'project_view',
            'task_view_any',
            'task_create',
            'task_update',
            'task_view',
            'task_add_comments',
            'task_change_status',
            'task_manage_stages',
            'task_delete',
            'task_add_attachments',
            'task_manage_checklists',
            'bug_view_any',
            'bug_create',
            'bug_update',
            'bug_delete',
            'bug_view',
            'bug_add_comments',
            'bug_change_status',
            'bug_manage_statuses',
            'bug_add_attachments',
            'timesheet_view_any',
            'timesheet_view',
            'timesheet_create',
            'timesheet_update',
            'timesheet_delete',
            'timesheet_assign',
            'timesheet_submit',
            'timesheet_use_timer',
            'timesheet_bulk_operations',
            'expense_view_any',
            'expense_create',
            'expense_view',
            'expense_update',
            'expense_delete',
            'zoom_meeting_view_any',
            'zoom_meeting_view',
            'zoom_meeting_join',
            'google_meeting_view_any',
            'google_meeting_view',
            'google_meeting_join',
            'user_view_logs',
            'note_view_any',
            'note_view',
            'note_create',
            'note_update',
            'note_delete',
            'calendar_view',
            'calendar_view_local',
            'calendar_view_google',
            'calendar_sync_google',
            'task_calendar_view',
            'task_calendar_view_tasks',
            'task_calendar_view_meetings',
            'project_report_view_any',
            'project_report_view',
            'todo_view_any',
            'todo_view',
            'todo_status_update',
            'todo_update',
            'todo_attachment_download',
            'media_view_any',
            'media_upload',
            'media_download',
            'media_delete',
        ])->get();
        $memberRole->syncPermissions($memberPermissions);

        // Create client role (company child)
        $clientRole = Role::updateOrCreate(
            ['name' => 'client', 'guard_name' => 'web'],
            ['label' => 'Client', 'description' => 'Client with read-only access']
        );

        $clientPermissions = Permission::whereIn('name', [
            'dashboard_view',
            // 'workspace_view_any',
            // 'workspace_view',
            'workspace_switch',
            'workspace_leave',
            'project_view_any',
            'project_view',
            'task_view_any',
            'task_view',
            'task_change_status',
            'task_manage_stages',
            'timesheet_view_any',
            'timesheet_view',
            'invoice_view_any',
            'invoice_view',
            'budget_view_any',
            'budget_view',
            'budget_create',
            'budget_update',
            'budget_delete',
            'zoom_meeting_view_any',
            'zoom_meeting_view',
            'zoom_meeting_join',
            'google_meeting_view_any',
            'google_meeting_view',
            'google_meeting_join',
            'user_view_logs',
            'note_view_any',
            'note_view',
            'note_create',
            'note_update',
            'note_delete',
            'contract_view_any',
            'contract_view',
            'contract_preview',
            'contract_change_status',
            'contract_signature',
            'contract_comment_create',
            'contract_type_view_any',
            'contract_type_view',
            'calendar_view',
            'calendar_view_local',
            'calendar_view_google',
            'task_calendar_view',
            'task_calendar_view_tasks',
            'task_calendar_view_meetings',
            'project_report_view_any',
            'project_report_view',
            'todo_view_any',
            'todo_view',
            'todo_status_update',
            'todo_update',
            'todo_attachment_download',
            'media_view_any',
            'media_upload',
            'media_download',
            'media_delete',
        ])->get();

        $clientRole->syncPermissions($clientPermissions);
    }
}