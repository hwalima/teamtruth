<?php

namespace App\Observers;

use App\Models\Workspace;
use Database\Seeders\TaskStageSeeder;
use Database\Seeders\BugStatusSeeder;

class WorkspaceObserver
{
    public function created(Workspace $workspace): void
    {
        // Auto-create default task stages for new workspace
        TaskStageSeeder::createDefaultStagesForWorkspace($workspace->id);
        
        // Auto-create default bug statuses for new workspace
        BugStatusSeeder::createDefaultStatusesForWorkspace($workspace->id);
    }
}