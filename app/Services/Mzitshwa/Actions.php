<?php

namespace App\Services\Mzitshwa;

use App\Models\Bug;
use App\Models\BugStatus;
use App\Models\Project;
use App\Models\Task;
use App\Models\TaskStage;
use App\Models\User;
use App\Models\WorkspaceMember;

/**
 * Workspace changes Mzitshwa can prepare. The AI only proposes; the change is
 * made by execute() after the user presses Confirm, and every check (role,
 * workspace, values) is done again at that point.
 */
class Actions
{
    private const PRIORITIES = ['low', 'medium', 'high', 'critical'];

    private const SEVERITIES = ['minor', 'major', 'critical', 'blocker'];

    public function __construct(private User $user, private array $permissions) {}

    private function available(): array
    {
        if (! $this->user->current_workspace_id) {
            return [];
        }

        return array_filter([
            'create_task' => $this->can('task_create'),
            'update_task' => $this->can('task_update'),
            'assign_task' => $this->can('task_update'),
            'create_bug' => $this->can('bug_create'),
        ]);
    }

    public function names(): array
    {
        return array_keys($this->available());
    }

    public function has(string $name): bool
    {
        return isset($this->available()[$name]);
    }

    public function definitions(): array
    {
        $specs = [
            'create_task' => ['Prepare a new task in a workspace project (the user confirms it).', [
                'project' => ['type' => 'string', 'description' => 'Project title'],
                'title' => ['type' => 'string'],
                'description' => ['type' => 'string'],
                'priority' => ['type' => 'string', 'enum' => self::PRIORITIES],
                'due_date' => ['type' => 'string', 'description' => 'YYYY-MM-DD'],
                'assignee' => ['type' => 'string', 'description' => 'Workspace member name'],
            ], ['project', 'title']],
            'update_task' => ['Prepare a change to a task\'s priority or progress (the user confirms it).', [
                'task' => ['type' => 'string', 'description' => 'Task title'],
                'priority' => ['type' => 'string', 'enum' => self::PRIORITIES],
                'progress' => ['type' => 'integer', 'description' => '0 to 100'],
            ], ['task']],
            'assign_task' => ['Prepare assigning a task to a workspace member (the user confirms it).', [
                'task' => ['type' => 'string', 'description' => 'Task title'],
                'assignee' => ['type' => 'string', 'description' => 'Workspace member name'],
            ], ['task', 'assignee']],
            'create_bug' => ['Prepare a bug report in a workspace project (the user confirms it).', [
                'project' => ['type' => 'string', 'description' => 'Project title'],
                'title' => ['type' => 'string'],
                'description' => ['type' => 'string'],
                'severity' => ['type' => 'string', 'enum' => self::SEVERITIES],
                'priority' => ['type' => 'string', 'enum' => self::PRIORITIES],
            ], ['project', 'title']],
        ];

        return array_map(fn (string $name) => [
            'type' => 'function',
            'function' => [
                'name' => $name,
                'description' => $specs[$name][0],
                'parameters' => ['type' => 'object', 'properties' => $specs[$name][1], 'required' => $specs[$name][2]],
            ],
        ], $this->names());
    }

    /**
     * Turn the AI's request into a concrete, checked proposal.
     *
     * @return array{action: string, params: array, summary: string}|array{error: string}
     */
    public function propose(string $action, array $args): array
    {
        try {
            $params = $this->resolve($action, $args);
        } catch (\InvalidArgumentException $e) {
            return ['error' => $e->getMessage()];
        }

        return ['action' => $action, 'params' => $params, 'summary' => $this->summary($action, $params)];
    }

    /** Make the confirmed change. Returns a message for the user. */
    public function execute(string $action, array $params): string
    {
        if (! $this->has($action)) {
            throw new \InvalidArgumentException(__('You are not allowed to do that in this workspace.'));
        }

        $p = $this->resolve($action, $params, byId: true);

        switch ($action) {
            case 'create_task':
                $stage = TaskStage::forWorkspace($this->user->current_workspace_id)->ordered()->first()
                    ?? throw new \InvalidArgumentException(__('This workspace has no task stages yet.'));
                $task = Task::create([
                    'project_id' => $p['project_id'], 'task_stage_id' => $stage->id, 'title' => $p['title'],
                    'description' => $p['description'], 'priority' => $p['priority'],
                    'start_date' => now()->toDateString(), 'end_date' => $p['due_date'],
                    'assigned_to' => $p['assignee_id'], 'created_by' => $this->user->id, 'progress' => 0,
                ]);

                return __('Task ":title" created.', ['title' => $task->title]);

            case 'update_task':
                $task = Task::findOrFail($p['task_id']);
                $task->fill(array_filter(['priority' => $p['priority'], 'progress' => $p['progress']], fn ($v) => $v !== null))->save();

                return __('Task ":title" updated.', ['title' => $task->title]);

            case 'assign_task':
                $task = Task::findOrFail($p['task_id']);
                $task->update(['assigned_to' => $p['assignee_id']]);

                return __('Task ":title" assigned to :name.', ['title' => $task->title, 'name' => $p['assignee_name']]);

            case 'create_bug':
                $status = BugStatus::forWorkspace($this->user->current_workspace_id)->ordered()->first()
                    ?? throw new \InvalidArgumentException(__('This workspace has no bug statuses yet.'));
                $bug = Bug::create([
                    'project_id' => $p['project_id'], 'bug_status_id' => $status->id, 'title' => $p['title'],
                    'description' => $p['description'], 'severity' => $p['severity'], 'priority' => $p['priority'],
                    'reported_by' => $this->user->id,
                ]);

                return __('Bug ":title" reported.', ['title' => $bug->title]);
        }

        throw new \InvalidArgumentException(__('Unknown action.'));
    }

    // ── Resolving names to records in the user's workspace ──────────────────

    private function resolve(string $action, array $a, bool $byId = false): array
    {
        $out = [];

        if (in_array($action, ['create_task', 'create_bug'], true)) {
            $project = $this->project($byId ? ($a['project_id'] ?? null) : ($a['project'] ?? null), $byId);
            $title = trim((string) ($a['title'] ?? ''));
            if ($title === '' || mb_strlen($title) > 255) {
                throw new \InvalidArgumentException(__('A title (up to 255 characters) is needed.'));
            }
            $out += ['project_id' => $project->id, 'project_title' => $project->title, 'title' => $title,
                'description' => isset($a['description']) ? mb_substr((string) $a['description'], 0, 5000) : null,
                'priority' => in_array($a['priority'] ?? null, self::PRIORITIES, true) ? $a['priority'] : 'medium'];
        }

        if ($action === 'create_task') {
            $due = $a['due_date'] ?? null;
            $out['due_date'] = $due && strtotime($due) ? date('Y-m-d', strtotime($due)) : now()->addWeek()->toDateString();
            $out += $this->assignee($byId ? ($a['assignee_id'] ?? null) : ($a['assignee'] ?? null), $byId, required: false);
        }

        if ($action === 'create_bug') {
            $out['severity'] = in_array($a['severity'] ?? null, self::SEVERITIES, true) ? $a['severity'] : 'major';
        }

        if (in_array($action, ['update_task', 'assign_task'], true)) {
            $task = $this->task($byId ? ($a['task_id'] ?? null) : ($a['task'] ?? null), $byId);
            $out += ['task_id' => $task->id, 'task_title' => $task->title];
        }

        if ($action === 'update_task') {
            $out['priority'] = in_array($a['priority'] ?? null, self::PRIORITIES, true) ? $a['priority'] : null;
            $out['progress'] = isset($a['progress']) && is_numeric($a['progress']) ? max(0, min(100, (int) $a['progress'])) : null;
            if ($out['priority'] === null && $out['progress'] === null) {
                throw new \InvalidArgumentException(__('Say what to change: priority or progress.'));
            }
        }

        if ($action === 'assign_task') {
            $out += $this->assignee($byId ? ($a['assignee_id'] ?? null) : ($a['assignee'] ?? null), $byId, required: true);
        }

        return $out;
    }

    private function project($ref, bool $byId): Project
    {
        $query = Project::where('workspace_id', $this->user->current_workspace_id);
        $project = $byId
            ? $query->find((int) $ref)
            : ($ref ? $this->best($query, 'title', (string) $ref) : null);

        return $project ?? throw new \InvalidArgumentException(__('No project called ":name" in this workspace.', ['name' => (string) $ref]));
    }

    private function task($ref, bool $byId): Task
    {
        $query = Task::whereHas('project', fn ($q) => $q->where('workspace_id', $this->user->current_workspace_id));
        $task = $byId
            ? $query->find((int) $ref)
            : ($ref ? $this->best($query, 'title', (string) $ref) : null);

        return $task ?? throw new \InvalidArgumentException(__('No task called ":name" in this workspace.', ['name' => (string) $ref]));
    }

    private function assignee($ref, bool $byId, bool $required): array
    {
        if (! $ref) {
            if ($required) {
                throw new \InvalidArgumentException(__('Say who the task is for.'));
            }

            return ['assignee_id' => null, 'assignee_name' => null];
        }

        $members = WorkspaceMember::where('workspace_id', $this->user->current_workspace_id)->with('user:id,name')->get()->pluck('user')->filter();
        $owner = $this->user->currentWorkspace?->owner;
        if ($owner) {
            $members->push($owner);
        }

        $match = $byId
            ? $members->firstWhere('id', (int) $ref)
            : ($members->first(fn ($u) => strcasecmp($u->name, (string) $ref) === 0)
                ?? $members->first(fn ($u) => stripos($u->name, (string) $ref) !== false));

        return $match
            ? ['assignee_id' => $match->id, 'assignee_name' => $match->name]
            : throw new \InvalidArgumentException(__('":name" is not a member of this workspace.', ['name' => (string) $ref]));
    }

    /** Exact title first, then a partial match. */
    private function best($query, string $column, string $value)
    {
        return (clone $query)->where($column, $value)->first()
            ?? $query->where($column, 'like', '%' . addcslashes($value, '%_\\') . '%')->orderBy('id', 'desc')->first();
    }

    private function summary(string $action, array $p): string
    {
        return match ($action) {
            'create_task' => __('Create task ":title" in :project (priority :priority, due :due:assignee).', [
                'title' => $p['title'], 'project' => $p['project_title'], 'priority' => $p['priority'], 'due' => $p['due_date'],
                'assignee' => $p['assignee_name'] ? ', for ' . $p['assignee_name'] : '',
            ]),
            'update_task' => __('Update task ":title":changes.', ['title' => $p['task_title'], 'changes' => implode('', array_filter([
                $p['priority'] ? " priority to {$p['priority']}" : null,
                $p['progress'] !== null ? " progress to {$p['progress']}%" : null,
            ]))]),
            'assign_task' => __('Assign task ":title" to :name.', ['title' => $p['task_title'], 'name' => $p['assignee_name']]),
            'create_bug' => __('Report bug ":title" in :project (severity :severity).', ['title' => $p['title'], 'project' => $p['project_title'], 'severity' => $p['severity']]),
            default => $action,
        };
    }

    private function can(string $permission): bool
    {
        return in_array($permission, $this->permissions, true);
    }
}
