<?php

namespace App\Http\Controllers;

use App\Models\MzitshwaConversation;
use App\Models\MzitshwaMessage;
use App\Models\Task;
use App\Models\Project;
use App\Models\TimesheetEntry;
use App\Models\Bug;
use App\Services\GroqService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\StreamedResponse;

class MzitshwaController extends Controller
{
    public function __construct(private GroqService $groq) {}

    public function chat(Request $request): StreamedResponse|JsonResponse
    {
        $request->validate([
            'messages'           => 'required|array|min:1',
            'messages.*.role'    => 'required|in:user,assistant',
            'messages.*.content' => 'required|string|max:4000',
            'context'            => 'nullable|string|in:general,projects,tasks,bugs,finance,timesheets',
            'stream'             => 'nullable|boolean',
            'conversation_id'    => 'nullable|integer',
        ]);

        $user        = auth()->user();
        $contextType = $request->input('context', 'general');
        $doStream    = $request->boolean('stream', true);

        $systemPrompt = $this->groq->buildSystemPrompt($user, $contextType);

        $messages = array_merge(
            [['role' => 'system', 'content' => $systemPrompt]],
            $request->input('messages')
        );

        if ($doStream) {
            return $this->streamResponse($messages, $user, $request);
        }

        try {
            $content = $this->groq->chat($messages);

            $conversationId = $this->persistMessages(
                $user,
                $request->input('conversation_id'),
                $contextType,
                $request->input('messages'),
                $content
            );

            return response()->json([
                'success' => true,
                'content' => $content,
                'conversation_id' => $conversationId,
            ]);
        } catch (\Exception $e) {
            Log::error('Mzitshwa chat error: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    public function complete(Request $request): JsonResponse
    {
        $request->validate([
            'prompt'     => 'required|string|max:2000',
            'field_type' => 'nullable|string|max:100',
            'context'    => 'nullable|string|max:2000',
            'tone'       => 'nullable|in:professional,friendly,concise,detailed',
        ]);

        $user      = auth()->user();
        $fieldType = $request->input('field_type', 'text');
        $tone      = $request->input('tone', 'professional');
        $ctx       = $request->input('context', '');

        $systemMsg = "You are Mzitshwa, a writing assistant for Team Truth project management. "
            . "Generate {$fieldType} content that is {$tone}. "
            . "Return ONLY the generated content — no preamble, no explanation, no quotes. "
            . ($ctx ? "Additional context: {$ctx}" : '');

        try {
            $content = $this->groq->chat([
                ['role' => 'system', 'content' => $systemMsg],
                ['role' => 'user',   'content' => $request->input('prompt')],
            ], 0.75, 800);

            return response()->json(['success' => true, 'content' => $content]);
        } catch (\Exception $e) {
            Log::error('Mzitshwa complete error: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    public function analyze(Request $request): JsonResponse
    {
        $request->validate([
            'type'     => 'required|in:projects,tasks,bugs,finance,timesheets,overview',
            'question' => 'nullable|string|max:500',
        ]);

        $user = auth()->user();
        $type = $request->input('type');
        $q    = $request->input('question', "Provide a detailed analysis and key insights.");
        $data = $this->groq->fetchContextData($user, $type === 'overview' ? 'general' : $type);

        $prompt = "Based on this workspace data:\n\n{$data}\n\n{$q}";
        $system = "You are Mzitshwa, a data analyst for Team Truth. "
            . "Analyse the provided workspace data and deliver concise, actionable insights. "
            . "Use bullet points, numbers, and markdown formatting. Be specific.";

        try {
            $content = $this->groq->chat([
                ['role' => 'system', 'content' => $system],
                ['role' => 'user',   'content' => $prompt],
            ], 0.5, 1500);

            return response()->json(['success' => true, 'content' => $content, 'type' => $type]);
        } catch (\Exception $e) {
            Log::error('Mzitshwa analyze error: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Execute an action command (create task, update status, log time, assign).
     */
    public function executeAction(Request $request): JsonResponse
    {
        $request->validate([
            'action'  => 'required|string|in:create_task,update_task,assign_task,log_time,create_bug',
            'params'  => 'required|array',
        ]);

        $user   = auth()->user();
        $action = $request->input('action');
        $params = $request->input('params');

        try {
            $result = match ($action) {
                'create_task'  => $this->actionCreateTask($user, $params),
                'update_task'  => $this->actionUpdateTask($user, $params),
                'assign_task'  => $this->actionAssignTask($user, $params),
                'log_time'     => $this->actionLogTime($user, $params),
                'create_bug'   => $this->actionCreateBug($user, $params),
            };

            return response()->json(['success' => true, ...$result]);
        } catch (\Exception $e) {
            Log::error('Mzitshwa action error: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => $e->getMessage()], 422);
        }
    }

    /**
     * Parse a natural language command into a structured action using AI.
     */
    public function parseAction(Request $request): JsonResponse
    {
        $request->validate([
            'command' => 'required|string|max:500',
        ]);

        $user = auth()->user();
        $workspace = $user->currentWorkspace;
        $workspaceId = $workspace->id;

        $projects = Project::where('workspace_id', $workspaceId)
            ->select('id', 'title')
            ->get()
            ->map(fn($p) => "id:{$p->id} \"{$p->title}\"")
            ->implode(', ');

        $members = $workspace->members()
            ->with('user:id,name')
            ->get()
            ->pluck('user')
            ->filter()
            ->map(fn($u) => "id:{$u->id} \"{$u->name}\"")
            ->implode(', ');

        $system = <<<PROMPT
You are Mzitshwa's action parser. Extract a structured action from the user's command.

Available projects: {$projects}
Available team members: {$members}

Respond ONLY with valid JSON in this exact format (no markdown, no explanation):
{
  "action": "create_task|update_task|assign_task|log_time|create_bug|none",
  "params": { ... },
  "confirmation": "Human-readable description of what will be done"
}

Action schemas:
- create_task: {"project_id": int, "title": string, "description": string|null, "priority": "low|medium|high|critical", "start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD"}
- update_task: {"task_id": int|null, "task_title": string|null, "status": string|null, "priority": string|null, "progress": int|null}
- assign_task: {"task_id": int|null, "task_title": string|null, "user_id": int}
- log_time: {"task_id": int|null, "task_title": string|null, "hours": float, "description": string|null}
- create_bug: {"project_id": int, "title": string, "description": string|null, "severity": "low|medium|high|critical"}
- none: {} (when the command is not an action)

If you can't determine task_id but have the title, set task_title. Use today's date for start_date if not specified.
PROMPT;

        try {
            $response = $this->groq->chat([
                ['role' => 'system', 'content' => $system],
                ['role' => 'user', 'content' => $request->input('command')],
            ], 0.1, 500);

            $cleaned = trim($response);
            if (str_starts_with($cleaned, '```')) {
                $cleaned = preg_replace('/^```(?:json)?\s*/', '', $cleaned);
                $cleaned = preg_replace('/\s*```$/', '', $cleaned);
            }

            $parsed = json_decode($cleaned, true);
            if (!$parsed || !isset($parsed['action'])) {
                return response()->json(['success' => true, 'action' => 'none', 'params' => [], 'confirmation' => null]);
            }

            return response()->json(['success' => true, ...$parsed]);
        } catch (\Exception $e) {
            Log::error('Mzitshwa parseAction error: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Get proactive insights for the current workspace.
     */
    public function insights(Request $request): JsonResponse
    {
        $user = auth()->user();
        $workspaceId = $user->current_workspace_id;

        $insights = [];

        // Overdue tasks
        $overdueTasks = Task::whereHas('project', fn($q) => $q->where('workspace_id', $workspaceId))
            ->where(function ($q) {
                $q->whereNotNull('end_date')
                  ->whereDate('end_date', '<', now())
                  ->where('progress', '<', 100);
            })
            ->with('project:id,title', 'assignedUser:id,name')
            ->limit(10)
            ->get();

        if ($overdueTasks->count() > 0) {
            $insights[] = [
                'type' => 'overdue_tasks',
                'severity' => 'high',
                'title' => $overdueTasks->count() . ' overdue ' . ($overdueTasks->count() === 1 ? 'task' : 'tasks'),
                'description' => 'Tasks past their due date that need attention.',
                'items' => $overdueTasks->map(fn($t) => [
                    'id' => $t->id,
                    'title' => $t->title,
                    'project' => $t->project?->title,
                    'assigned_to' => $t->assignedUser?->name,
                    'due_date' => $t->end_date,
                    'days_overdue' => now()->diffInDays($t->end_date),
                ])->toArray(),
            ];
        }

        // Tasks with no assignee
        $unassigned = Task::whereHas('project', fn($q) => $q->where('workspace_id', $workspaceId))
            ->whereNull('assigned_to')
            ->where('progress', '<', 100)
            ->count();

        if ($unassigned > 0) {
            $insights[] = [
                'type' => 'unassigned_tasks',
                'severity' => 'medium',
                'title' => $unassigned . ' unassigned ' . ($unassigned === 1 ? 'task' : 'tasks'),
                'description' => 'Tasks without an owner may fall through the cracks.',
            ];
        }

        // Stalled tasks (no progress update in 7+ days)
        $stalledTasks = Task::whereHas('project', fn($q) => $q->where('workspace_id', $workspaceId))
            ->where('progress', '>', 0)
            ->where('progress', '<', 100)
            ->where('updated_at', '<', now()->subDays(7))
            ->count();

        if ($stalledTasks > 0) {
            $insights[] = [
                'type' => 'stalled_tasks',
                'severity' => 'medium',
                'title' => $stalledTasks . ' stalled ' . ($stalledTasks === 1 ? 'task' : 'tasks'),
                'description' => 'In-progress tasks with no updates for 7+ days.',
            ];
        }

        // Open critical/high bugs
        $criticalBugs = Bug::whereHas('project', fn($q) => $q->where('workspace_id', $workspaceId))
            ->whereNotIn('status', ['resolved', 'closed'])
            ->whereIn('severity', ['critical', 'high'])
            ->count();

        if ($criticalBugs > 0) {
            $insights[] = [
                'type' => 'critical_bugs',
                'severity' => 'high',
                'title' => $criticalBugs . ' critical/high ' . ($criticalBugs === 1 ? 'bug' : 'bugs'),
                'description' => 'Unresolved bugs that need immediate attention.',
            ];
        }

        // Projects nearing deadline
        $nearingDeadline = Project::where('workspace_id', $workspaceId)
            ->whereNotIn('status', ['completed', 'cancelled'])
            ->whereNotNull('deadline')
            ->whereDate('deadline', '<=', now()->addDays(7))
            ->whereDate('deadline', '>=', now())
            ->get();

        if ($nearingDeadline->count() > 0) {
            $insights[] = [
                'type' => 'deadline_approaching',
                'severity' => 'high',
                'title' => $nearingDeadline->count() . ' ' . ($nearingDeadline->count() === 1 ? 'project' : 'projects') . ' due this week',
                'description' => 'Projects with deadlines in the next 7 days.',
                'items' => $nearingDeadline->map(fn($p) => [
                    'id' => $p->id,
                    'title' => $p->title,
                    'deadline' => $p->deadline,
                    'progress' => $p->progress ?? 0,
                ])->toArray(),
            ];
        }

        // Workspace health score
        $totalTasks = Task::whereHas('project', fn($q) => $q->where('workspace_id', $workspaceId))->count();
        $completedTasks = Task::whereHas('project', fn($q) => $q->where('workspace_id', $workspaceId))->where('progress', 100)->count();
        $healthScore = $totalTasks > 0 ? round(($completedTasks / $totalTasks) * 100) : 100;

        // Deductions for issues
        $deductions = min(50, ($overdueTasks->count() * 5) + ($criticalBugs * 8) + ($stalledTasks * 3));
        $healthScore = max(0, $healthScore - $deductions);

        return response()->json([
            'success' => true,
            'insights' => $insights,
            'health_score' => $healthScore,
            'summary' => [
                'total_tasks' => $totalTasks,
                'completed_tasks' => $completedTasks,
                'overdue_count' => $overdueTasks->count(),
                'unassigned_count' => $unassigned,
            ],
        ]);
    }

    /**
     * List conversations for the current user.
     */
    public function conversations(Request $request): JsonResponse
    {
        $user = auth()->user();

        $conversations = MzitshwaConversation::where('user_id', $user->id)
            ->where('workspace_id', $user->current_workspace_id)
            ->orderByDesc('pinned')
            ->orderByDesc('updated_at')
            ->limit(30)
            ->get()
            ->map(fn($c) => [
                'id' => $c->id,
                'title' => $c->title,
                'context' => $c->context,
                'pinned' => $c->pinned,
                'updated_at' => $c->updated_at->diffForHumans(),
                'message_count' => $c->messages()->count(),
            ]);

        return response()->json(['success' => true, 'conversations' => $conversations]);
    }

    /**
     * Load messages for a specific conversation.
     */
    public function conversationMessages(Request $request, MzitshwaConversation $conversation): JsonResponse
    {
        $user = auth()->user();
        if ($conversation->user_id !== $user->id) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $messages = $conversation->messages()
            ->orderBy('created_at')
            ->get()
            ->map(fn($m) => [
                'id' => (string)$m->id,
                'role' => $m->role,
                'content' => $m->content,
                'metadata' => $m->metadata,
                'created_at' => $m->created_at->toISOString(),
            ]);

        return response()->json([
            'success' => true,
            'conversation' => [
                'id' => $conversation->id,
                'title' => $conversation->title,
                'context' => $conversation->context,
                'pinned' => $conversation->pinned,
            ],
            'messages' => $messages,
        ]);
    }

    /**
     * Delete a conversation.
     */
    public function deleteConversation(MzitshwaConversation $conversation): JsonResponse
    {
        $user = auth()->user();
        if ($conversation->user_id !== $user->id) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $conversation->delete();
        return response()->json(['success' => true]);
    }

    // ── Action executors ─────────────────────────────────────────────────────────

    private function actionCreateTask($user, array $params): array
    {
        $project = Project::where('workspace_id', $user->current_workspace_id)
            ->findOrFail($params['project_id']);

        $milestone = $project->milestones()->first();
        if (!$milestone) {
            throw new \RuntimeException('Project has no milestones. Create one first.');
        }

        $task = Task::create([
            'project_id'   => $project->id,
            'milestone_id' => $milestone->id,
            'title'        => $params['title'],
            'description'  => $params['description'] ?? null,
            'priority'     => $params['priority'] ?? 'medium',
            'start_date'   => $params['start_date'] ?? now()->toDateString(),
            'end_date'     => $params['end_date'] ?? now()->addDays(7)->toDateString(),
            'created_by'   => $user->id,
            'status'       => 'pending',
            'progress'     => 0,
        ]);

        return [
            'message' => "Task \"{$task->title}\" created in {$project->title}.",
            'task_id' => $task->id,
        ];
    }

    private function actionUpdateTask($user, array $params): array
    {
        $task = $this->resolveTask($user, $params);

        $updates = [];
        if (isset($params['priority'])) { $task->priority = $params['priority']; $updates[] = "priority → {$params['priority']}"; }
        if (isset($params['progress'])) { $task->progress = $params['progress']; $updates[] = "progress → {$params['progress']}%"; }
        if (isset($params['status']))   { $task->status = $params['status']; $updates[] = "status → {$params['status']}"; }
        $task->save();

        return ['message' => "Updated \"{$task->title}\": " . implode(', ', $updates)];
    }

    private function actionAssignTask($user, array $params): array
    {
        $task = $this->resolveTask($user, $params);
        $task->assigned_to = $params['user_id'];
        $task->save();

        $assignee = \App\Models\User::find($params['user_id']);
        return ['message' => "Assigned \"{$task->title}\" to {$assignee->name}."];
    }

    private function actionLogTime($user, array $params): array
    {
        $task = $this->resolveTask($user, $params);

        TimesheetEntry::create([
            'task_id'     => $task->id,
            'user_id'     => $user->id,
            'hours'       => $params['hours'],
            'description' => $params['description'] ?? 'Logged via Mzitshwa AI',
            'date'        => now()->toDateString(),
        ]);

        return ['message' => "Logged {$params['hours']}h on \"{$task->title}\"."];
    }

    private function actionCreateBug($user, array $params): array
    {
        $project = Project::where('workspace_id', $user->current_workspace_id)
            ->findOrFail($params['project_id']);

        $bug = Bug::create([
            'project_id'  => $project->id,
            'title'       => $params['title'],
            'description' => $params['description'] ?? null,
            'severity'    => $params['severity'] ?? 'medium',
            'status'      => 'open',
            'reported_by' => $user->id,
        ]);

        return ['message' => "Bug \"{$bug->title}\" reported in {$project->title}.", 'bug_id' => $bug->id];
    }

    private function resolveTask($user, array $params): Task
    {
        if (!empty($params['task_id'])) {
            return Task::whereHas('project', fn($q) => $q->where('workspace_id', $user->current_workspace_id))
                ->findOrFail($params['task_id']);
        }

        if (!empty($params['task_title'])) {
            $task = Task::whereHas('project', fn($q) => $q->where('workspace_id', $user->current_workspace_id))
                ->where('title', 'like', '%' . $params['task_title'] . '%')
                ->first();
            if ($task) return $task;
        }

        throw new \RuntimeException('Could not find the specified task.');
    }

    // ── Persistence ──────────────────────────────────────────────────────────────

    private function persistMessages($user, $conversationId, $context, $userMessages, $aiResponse): int
    {
        $lastUserMsg = end($userMessages);

        if ($conversationId) {
            $conversation = MzitshwaConversation::where('user_id', $user->id)->find($conversationId);
        }

        if (empty($conversation)) {
            $title = mb_strlen($lastUserMsg['content']) > 60
                ? mb_substr($lastUserMsg['content'], 0, 57) . '...'
                : $lastUserMsg['content'];

            $conversation = MzitshwaConversation::create([
                'user_id'      => $user->id,
                'workspace_id' => $user->current_workspace_id,
                'title'        => $title,
                'context'      => $context,
            ]);
        } else {
            $conversation->touch();
        }

        MzitshwaMessage::create([
            'conversation_id' => $conversation->id,
            'role'            => 'user',
            'content'         => $lastUserMsg['content'],
            'created_at'      => now(),
        ]);

        MzitshwaMessage::create([
            'conversation_id' => $conversation->id,
            'role'            => 'assistant',
            'content'         => $aiResponse,
            'created_at'      => now(),
        ]);

        return $conversation->id;
    }

    // ── Streaming ────────────────────────────────────────────────────────────────

    private function streamResponse(array $messages, $user, Request $request): StreamedResponse
    {
        return response()->stream(function () use ($messages, $user, $request) {
            while (ob_get_level()) ob_end_flush();
            if (function_exists('apache_setenv')) apache_setenv('no-gzip', '1');
            ini_set('zlib.output_compression', '0');
            ini_set('implicit_flush', '1');

            $full = '';
            try {
                foreach ($this->groq->stream($messages) as $chunk) {
                    $full .= $chunk;
                    echo 'data: ' . json_encode(['content' => $chunk]) . "\n\n";
                    flush();
                }

                $contextType = $request->input('context', 'general');
                $conversationId = $this->persistMessages(
                    $user,
                    $request->input('conversation_id'),
                    $contextType,
                    $request->input('messages'),
                    $full
                );

                echo 'data: ' . json_encode(['done' => true, 'conversation_id' => $conversationId]) . "\n\n";
                flush();
            } catch (\Exception $e) {
                echo 'data: ' . json_encode(['error' => $e->getMessage()]) . "\n\n";
                flush();
            }

            echo "data: [DONE]\n\n";
            flush();
        }, 200, [
            'Content-Type'      => 'text/event-stream',
            'Cache-Control'     => 'no-cache, no-store',
            'X-Accel-Buffering' => 'no',
            'Connection'        => 'keep-alive',
        ]);
    }
}
