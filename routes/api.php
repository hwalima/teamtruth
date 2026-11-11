<?php

use App\Http\Controllers\BugController;
use App\Http\Controllers\CalendarController;
use App\Http\Controllers\ChatGptController;
use App\Http\Controllers\CompanyController;
use App\Http\Controllers\CouponController;
use App\Http\Controllers\CurrencyController;
use App\Http\Controllers\ExpenseApprovalController;
use App\Http\Controllers\ExpenseDashboardController;
use App\Http\Controllers\ExpenseManagementController;
use App\Http\Controllers\ExpenseReceiptController;
use App\Http\Controllers\ExpenseWorkflowController;
use App\Http\Controllers\ExportImportController;
use App\Http\Controllers\GoogleCalendarController;
use App\Http\Controllers\GoogleMeetingController;
use App\Http\Controllers\InvoiceController;
use App\Http\Controllers\InvoicePaymentController;
use App\Http\Controllers\MediaController;
use App\Http\Controllers\MediaFolderController;
use App\Http\Controllers\MzitshwaController;
use App\Http\Controllers\NewsletterController;
use App\Http\Controllers\PermissionController;
use App\Http\Controllers\PlanController;
use App\Http\Controllers\PlanOrderController;
use App\Http\Controllers\PlanRequestController;
use App\Http\Controllers\ProjectController;
use App\Http\Controllers\ProjectExpenseController;
use App\Http\Controllers\ProjectInvitationController;
use App\Http\Controllers\ProjectMilestoneController;
use App\Http\Controllers\ProjectNoteController;
use App\Http\Controllers\ProjectAttachmentController;
use App\Http\Controllers\ReferralController;
use App\Http\Controllers\RoleController;
use App\Http\Controllers\Settings\PaymentSettingController;
use App\Http\Controllers\TaskController;
use App\Http\Controllers\TaskDependencyController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\WorkspaceController;
use App\Http\Controllers\WorkspaceInvitationController;
use App\Http\Controllers\ZoomMeetingController;
use App\Modules\Core\Http\Controllers\CompanyController as CoreCompanyController;
use App\Modules\Core\Http\Controllers\CompanyMemberController;
use App\Modules\Core\Http\Controllers\CompanyErpRoleController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider within a group which
| is assigned the "api" middleware group. Enjoy building your API!
|
*/

// API routes for Inertia partial reloads and AJAX requests
// These routes return JSON and should NOT have Inertia middleware

// Mzitshwa AI routes
Route::prefix('api/mzitshwa')->group(function () {
    Route::post('chat', [MzitshwaController::class, 'chat'])->name('mzitshwa.chat');
    Route::post('complete', [MzitshwaController::class, 'complete'])->name('mzitshwa.complete');
    Route::post('analyze', [MzitshwaController::class, 'analyze'])->name('mzitshwa.analyze');
    Route::post('action', [MzitshwaController::class, 'executeAction'])->name('mzitshwa.action');
    Route::post('parse-action', [MzitshwaController::class, 'parseAction'])->name('mzitshwa.parseAction');
    Route::get('insights', [MzitshwaController::class, 'insights'])->name('mzitshwa.insights');
    Route::get('conversations', [MzitshwaController::class, 'conversations'])->name('mzitshwa.conversations');
    Route::get('conversations/{conversation}', [MzitshwaController::class, 'conversationMessages'])->name('mzitshwa.conversation.messages');
    Route::delete('conversations/{conversation}', [MzitshwaController::class, 'deleteConversation'])->name('mzitshwa.conversation.delete');
});

// Workload / capacity view
Route::get('api/workload', [WorkloadController::class, 'index'])->name('workload.index');

// In-app notifications
Route::prefix('api/notifications')->group(function () {
    Route::get('recent', [InAppNotificationController::class, 'recent'])->name('notifications.recent');
    Route::post('{id}/read', [InAppNotificationController::class, 'markAsRead'])->name('notifications.markAsRead');
    Route::post('read-all', [InAppNotificationController::class, 'markAllAsRead'])->name('notifications.markAllAsRead');
    Route::delete('{id}', [InAppNotificationController::class, 'destroy'])->name('notifications.destroy');
    Route::delete('', [InAppNotificationController::class, 'destroyAll'])->name('notifications.destroyAll');
});

// Task dependencies
Route::prefix('api/tasks')->group(function () {
    Route::get('{task}/dependencies', [TaskDependencyController::class, 'index'])->name('tasks.dependencies.index');
    Route::post('{task}/dependencies', [TaskDependencyController::class, 'store'])->name('tasks.dependencies.store');
    Route::delete('{task}/dependencies/{dependsOnId}', [TaskDependencyController::class, 'destroy'])->name('tasks.dependencies.destroy');
});

// Media Library API routes
Route::prefix('api/media')->group(function () {
    Route::get('', [MediaController::class, 'index'])->middleware('permission:media_view_any')->name('api.media.index');
    Route::post('batch', [MediaController::class, 'batchStore'])->middleware('permission:media_upload')->name('api.media.batch');
    Route::get('{id}/download', [MediaController::class, 'download'])->middleware('permission:media_download')->name('api.media.download');
    Route::delete('{id}', [MediaController::class, 'destroy'])->middleware('permission:media_delete')->name('api.media.destroy');
    Route::post('{id}/lock', [MediaController::class, 'toggleLock'])->middleware('permission:media_upload')->name('api.media.toggleLock');
    Route::get('{id}/accesses', [MediaController::class, 'accesses'])->middleware('permission:media_upload')->name('api.media.accesses');
    Route::post('{id}/access', [MediaController::class, 'storeAccess'])->middleware('permission:media_upload')->name('api.media.storeAccess');
    Route::delete('{id}/access', [MediaController::class, 'destroyAccess'])->middleware('permission:media_upload')->name('api.media.destroyAccess');
    Route::put('{id}/move', [MediaController::class, 'moveTo'])->middleware('permission:media_upload')->name('api.media.moveTo');
});

// Media Folders API routes
Route::prefix('api/media/folders')->group(function () {
    Route::get('', [MediaFolderController::class, 'index'])->middleware('permission:media_view_any')->name('api.media.folders.index');
    Route::post('', [MediaFolderController::class, 'store'])->middleware('permission:media_upload')->name('api.media.folders.store');
    Route::put('{id}', [MediaFolderController::class, 'update'])->middleware('permission:media_upload')->name('api.media.folders.update');
    Route::delete('{id}', [MediaFolderController::class, 'destroy'])->middleware('permission:media_upload')->name('api.media.folders.destroy');
    Route::post('{id}/lock', [MediaFolderController::class, 'toggleLock'])->middleware('permission:media_upload')->name('api.media.folders.toggleLock');
    Route::get('{id}/accesses', [MediaFolderController::class, 'accesses'])->middleware('permission:media_upload')->name('api.media.folders.accesses');
    Route::post('{id}/access', [MediaFolderController::class, 'storeAccess'])->middleware('permission:media_upload')->name('api.media.folders.storeAccess');
    Route::delete('{id}/access', [MediaFolderController::class, 'destroyAccess'])->middleware('permission:media_upload')->name('api.media.folders.destroyAccess');
});

// Bug API routes
Route::get('api/bugs/project-data', [BugController::class, 'getProjectData'])->middleware('permission:bug_view_any')->name('api.bugs.project-data');

// Task calendar
Route::get('api/tasks/calendar', [TaskController::class, 'getCalendarTasks'])->middleware('permission:task_view_any')->name('api.tasks.calendar');
Route::get('api/task-calendar/task/{task}', [CalendarController::class, 'getTask'])->middleware('permission:task_view')->name('api.task-calendar.task');

// Project tasks for expense creation
Route::get('api/projects/{project}/tasks', [ProjectExpenseController::class, 'getProjectTasks'])->middleware('permission:expense_view_any')->name('api.projects.tasks');

// Project invoice data
Route::get('api/projects/{project}/invoice-data', [InvoiceController::class, 'getProjectInvoiceData'])->middleware('permission:invoice_view_any')->name('api.projects.invoice-data');

// Payment settings
Route::get('api/payment-settings/enabled', [PaymentSettingController::class, 'getEnabledMethods'])->name('api.payment-settings.enabled');

// Invoice payment methods
Route::get('api/invoices/{invoice}/payment-methods', [InvoicePaymentController::class, 'getPaymentMethods'])->name('api.invoices.payment-methods');

// Zoom meetings calendar
Route::get('api/zoom-meetings/calendar', [ZoomMeetingController::class, 'calendar'])->name('api.zoom-meetings.calendar');

// Google meetings calendar
Route::get('api/google-meetings/calendar', [GoogleMeetingController::class, 'calendar'])->name('api.google-meetings.calendar');

// Project members for meetings
Route::get('api/projects/{project}/members', [ZoomMeetingController::class, 'getProjectMembers'])->name('api.projects.members');

// Google Calendar
Route::prefix('api/google-calendar')->group(function () {
    Route::get('events', [GoogleCalendarController::class, 'getEvents'])->name('api.google-calendar.events');
    Route::post('sync', [GoogleCalendarController::class, 'syncEvents'])->name('api.google-calendar.sync');
});

// Expense workflows
Route::prefix('api/expense-workflows')->group(function () {
    Route::get('my-approvals', [ExpenseWorkflowController::class, 'myApprovals'])->middleware('permission:expense_approval_view_any')->name('api.expense-workflows.my-approvals');
});

// Expense dashboard
Route::prefix('api/expense-dashboard')->group(function () {
    Route::get('overview', [ExpenseDashboardController::class, 'overview'])->middleware('permission:expense_generate_reports')->name('expense-dashboard.overview');
    Route::get('budget-utilization', [ExpenseDashboardController::class, 'budgetUtilization'])->middleware('permission:expense_generate_reports')->name('expense-dashboard.budget-utilization');
    Route::get('trends', [ExpenseDashboardController::class, 'trends'])->middleware('permission:expense_generate_reports')->name('expense-dashboard.trends');
    Route::get('alerts', [ExpenseDashboardController::class, 'alerts'])->middleware('permission:expense_generate_reports')->name('expense-dashboard.alerts');
});

// ChatGPT
Route::post('api/chatgpt/generate', [ChatGptController::class, 'generate'])->name('chatgpt.generate');