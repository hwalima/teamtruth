<?php

namespace App\Exports;

use App\Models\Project;
use Maatwebsite\Excel\Concerns\FromQuery;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\Exportable;
use Illuminate\Http\Request;

class ProjectExport implements FromQuery, WithHeadings, WithMapping
{
    use Exportable;

    protected $request;

    public function __construct(Request $request = null)
    {
        $this->request = $request;
    }

    public function query()
    {
        $currentUser = auth()->user();
        $workspace = $currentUser->currentWorkspace;

        if (!$workspace) {
            return Project::whereRaw('1 = 0'); // Return empty query
        }

        $userWorkspaceRole = $workspace->getMemberRole($currentUser);
        
        // Check if user is workspace owner (override role if needed)
        if ($currentUser->id === $workspace->owner_id) {
            $userWorkspaceRole = 'owner';
        }

        $query = Project::with(['workspace', 'creator', 'clients', 'members.user'])
            ->where('workspace_id', $workspace->id);

        // Access control based on workspace role - same logic as ProjectController
        if ($userWorkspaceRole === 'owner') {
            // Owner: Full access to all projects
        } else {
            // Non-owners: Only assigned projects
            $query->where(function ($q) use ($currentUser, $userWorkspaceRole) {
                $q->whereHas('members', function ($memberQuery) use ($currentUser) {
                    $memberQuery->where('user_id', $currentUser->id);
                })
                    ->orWhereHas('clients', function ($clientQuery) use ($currentUser) {
                        $clientQuery->where('user_id', $currentUser->id);
                    });

                // Client/Member: Only self-created projects
                if (in_array($userWorkspaceRole, ['client', 'member'])) {
                    $q->orWhere('created_by', $currentUser->id);
                }
            });
        }

        // Apply filters if request is provided
        if ($this->request) {
            if ($this->request->has('search') && !empty($this->request->search)) {
                $query->where(function($q) {
                    $q->where('title', 'like', "%{$this->request->search}%")
                      ->orWhere('description', 'like', "%{$this->request->search}%");
                });
            }
            
            if ($this->request->has('status') && $this->request->status !== 'all') {
                $query->where('status', $this->request->status);
            }
            
            if ($this->request->has('priority') && $this->request->priority !== 'all') {
                $query->where('priority', $this->request->priority);
            }
            
            if ($this->request->has('start_date') && !empty($this->request->start_date)) {
                $query->whereDate('created_at', '>=', $this->request->start_date);
            }
            
            if ($this->request->has('end_date') && !empty($this->request->end_date)) {
                $query->whereDate('created_at', '<=', $this->request->end_date);
            }
        }

        return $query;
    }

    public function headings(): array
    {
        return [
            'Title',
            'Description',
            'Status',
            'Priority',
            'Start Date',
            'Deadline',
            'Estimated Hours',
            'Is Public',
            'Created At',
            'Updated At',
        ];
    }

    public function map($project): array
    {
        return [
            $project->title,
            $project->description,
            $project->status,
            $project->priority,
            $project->start_date ? $project->start_date->format('Y-m-d') : '',
            $project->deadline ? $project->deadline->format('Y-m-d') : '',
            $project->estimated_hours,
            $project->is_public ? 'Yes' : 'No',
            $project->created_at->format('Y-m-d H:i:s'),
            $project->updated_at->format('Y-m-d H:i:s'),
        ];
    }
}