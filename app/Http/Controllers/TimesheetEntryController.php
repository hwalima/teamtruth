<?php

namespace App\Http\Controllers;

use App\Models\TimesheetEntry;
use App\Models\Timesheet;
use App\Models\Project;
use App\Models\Task;

use Illuminate\Http\Request;

class TimesheetEntryController extends Controller
{
    public function index(Request $request)
    {
        $user = auth()->user();
        
        $query = TimesheetEntry::with(['timesheet', 'project', 'task', 'user'])
            ->whereHas('timesheet', function($q) use ($user) {
                $q->where('workspace_id', $user->current_workspace_id);
            });

        if (!$user->can('manage-any-timesheets')) {
            $query->where('user_id', $user->id);
        }

        if ($request->project_id) {
            $query->forProject($request->project_id);
        }

        if ($request->date) {
            $query->forDate($request->date);
        }

        $entries = $query->latest()->paginate(50);

        return response()->json(['entries' => $entries]);
    }

    public function store(Request $request)
    {
        try {
            $validated = $request->validate([
                'timesheet_id' => 'required|exists:timesheets,id',
                'project_id' => 'required|exists:projects,id',
                'task_id' => 'nullable|exists:tasks,id',
                'date' => 'required|date',
                'start_time' => 'nullable',
                'end_time' => 'nullable',
                'hours' => 'required|numeric|min:0.1|max:24',
                'description' => 'nullable|string',
                'is_billable' => 'boolean'
            ]);

            $entry = TimesheetEntry::create([
                ...$validated,
                'user_id' => auth()->id(),
                'hourly_rate' => 0,
                'is_billable' => $validated['is_billable'] ?? true
            ]);

            $entry->load('timesheet');
            if ($entry->timesheet) {
                $entry->timesheet->calculateTotals();
            }

            return redirect()->back()->with('success', __('Time entry created successfully.'));
        } catch (\Illuminate\Validation\ValidationException $e) {
            return redirect()->back()->withErrors($e->errors())->withInput();
        } catch (\Exception $e) {
            return redirect()->back()->with('error', __('Failed to create time entry. Please try again.'));
        }
    }

    public function update(Request $request, TimesheetEntry $timesheetEntry)
    {
        try {
            // Check if user can update this entry
            $user = auth()->user();
            // if ($timesheetEntry->user_id !== $user->id && !$user->can('manage-any-timesheets')) {
            //     return redirect()->back()->with('error', __('You are not authorized to update this time entry.'));
            // }

            $validated = $request->validate([
                'project_id' => 'required|exists:projects,id',
                'task_id' => 'nullable|exists:tasks,id',
                'date' => 'required|date',
                'start_time' => 'nullable',
                'end_time' => 'nullable',
                'hours' => 'required|numeric|min:0.1|max:24',
                'description' => 'nullable|string',
                'is_billable' => 'boolean'
            ]);

            $timesheetEntry->update($validated);
            $timesheetEntry->load('timesheet');
            if ($timesheetEntry->timesheet) {
                $timesheetEntry->timesheet->calculateTotals();
            }

            return redirect()->back()->with('success', __('Time entry updated successfully.'));
        } catch (\Illuminate\Validation\ValidationException $e) {
            return redirect()->back()->withErrors($e->errors())->withInput();
        } catch (\Exception $e) {
            return redirect()->back()->with('error', __('Failed to update time entry. Please try again.'));
        }
    }

    public function destroy(TimesheetEntry $timesheetEntry)
    {
        try {
            // Check if user can delete this entry
            $user = auth()->user();
            // if ($timesheetEntry->user_id !== $user->id && !$user->can('manage-any-timesheets')) {
            //     return redirect()->back()->with('error', __('You are not authorized to delete this time entry.'));
            // }

            $timesheet = $timesheetEntry->timesheet;
            $timesheetEntry->delete();
            if ($timesheet) {
                $timesheet->calculateTotals();
            }

            return redirect()->back()->with('success', __('Time entry deleted successfully.'));
        } catch (\Exception $e) {
            return redirect()->back()->with('error', __('Failed to delete time entry. Please try again.'));
        }
    }

    public function bulkUpdate(Request $request)
    {
        try {
            $validated = $request->validate([
                'entry_ids' => 'required|array',
                'entry_ids.*' => 'exists:timesheet_entries,id',
                'is_billable' => 'boolean'
            ]);

            $user = auth()->user();
            $entries = TimesheetEntry::whereIn('id', $validated['entry_ids'])->get();
            
            if ($entries->isEmpty()) {
                return redirect()->back()->with('error', __('No entries found to update.'));
            }

            // Check authorization for bulk update
            if (!$user->can('manage-any-timesheets')) {
                $unauthorizedEntries = $entries->where('user_id', '!=', $user->id);
                if ($unauthorizedEntries->count() > 0) {
                    return redirect()->back()->with('error', __('You are not authorized to update some of the selected entries.'));
                }
            }

            $updatedCount = TimesheetEntry::whereIn('id', $validated['entry_ids'])
                ->update(['is_billable' => $validated['is_billable']]);

            $billableStatus = $validated['is_billable'] ? 'billable' : 'non-billable';
            return redirect()->back()->with('success', __(':count time entries marked as :status.', ['count' => $updatedCount, 'status' => $billableStatus]));
        } catch (\Illuminate\Validation\ValidationException $e) {
            return redirect()->back()->withErrors($e->errors());
        } catch (\Exception $e) {
            return redirect()->back()->with('error', __('Failed to update entries. Please try again.'));
        }
    }

    public function bulkDelete(Request $request)
    {
        try {
            $validated = $request->validate([
                'entry_ids' => 'required|array',
                'entry_ids.*' => 'exists:timesheet_entries,id'
            ]);

            $user = auth()->user();
            $entries = TimesheetEntry::whereIn('id', $validated['entry_ids'])->get();
            
            if ($entries->isEmpty()) {
                return redirect()->back()->with('error', __('No entries found to delete.'));
            }

            // Check authorization for each entry
            if (!$user->can('manage-any-timesheets')) {
                $unauthorizedEntries = $entries->where('user_id', '!=', $user->id);
                if ($unauthorizedEntries->count() > 0) {
                    return redirect()->back()->with('error', __('You are not authorized to delete some of the selected entries.'));
                }
            }

            $timesheets = $entries->pluck('timesheet')->unique();
            $deletedCount = $entries->count();

            TimesheetEntry::whereIn('id', $validated['entry_ids'])->delete();

            // Recalculate totals for affected timesheets
            foreach ($timesheets as $timesheet) {
                if ($timesheet) {
                    $timesheet->calculateTotals();
                }
            }

            return redirect()->back()->with('success', __(':count time entries deleted successfully.', ['count' => $deletedCount]));
        } catch (\Illuminate\Validation\ValidationException $e) {
            return redirect()->back()->withErrors($e->errors());
        } catch (\Exception $e) {
            return redirect()->back()->with('error', __('Failed to delete entries. Please try again.'));
        }
    }
}