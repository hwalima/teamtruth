<?php

namespace App\Services;

use App\Models\User;
use App\Models\Project;
use App\Models\Task;
use App\Models\Bug;
use App\Models\Invoice;
use App\Models\ProjectExpense;
use App\Models\Timesheet;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class GroqService
{
    private string $apiKey;
    private string $baseUrl;
    private string $model;
    private string $configuredModel;

    public function __construct()
    {
        $this->apiKey  = config('groq.api_key', '');
        $this->baseUrl = config('groq.base_url', 'https://api.groq.com/openai/v1');
        $this->model   = config('groq.model', 'llama-3.3-70b-versatile');
        $this->configuredModel = $this->model;

        $cachedFallback = Cache::get($this->fallbackModelCacheKey());
        if (is_string($cachedFallback) && $cachedFallback !== '') {
            $this->model = $cachedFallback;
        }
    }

    /**
     * Send a chat request and return the full response as a string.
     */
    public function chat(array $messages, float $temperature = 0.7, int $maxTokens = 2048): string
    {
        $response = $this->sendChatRequest([
            'model'       => $this->model,
            'messages'    => $messages,
            'max_tokens'  => $maxTokens,
            'temperature' => $temperature,
            'stream'      => false,
        ], 60);

        if (!$response->successful()) {
            $err = $response->json('error.message', 'Groq API error');
            throw new \RuntimeException($err);
        }

        return $response->json('choices.0.message.content', '');
    }

    /**
     * Stream a chat request — yields text chunks via a generator.
     */
    public function stream(array $messages, float $temperature = 0.7, int $maxTokens = 2048): \Generator
    {
        $rawResponse = $this->sendChatRequest([
            'model'       => $this->model,
            'messages'    => $messages,
            'max_tokens'  => $maxTokens,
            'temperature' => $temperature,
            'stream'      => true,
        ], 120, true);

        if (!$rawResponse->successful()) {
            throw new \RuntimeException($rawResponse->json('error.message', 'Groq API error'));
        }

        $body = $rawResponse->getBody();
        $buffer = '';

        while (!$body->eof()) {
            $buffer .= $body->read(512);
            $lines  = explode("\n", $buffer);
            $buffer = array_pop($lines); // keep incomplete line

            foreach ($lines as $line) {
                $line = trim($line);
                if (!str_starts_with($line, 'data: ')) continue;
                $data = substr($line, 6);
                if ($data === '[DONE]') return;

                $decoded = json_decode($data, true);
                $chunk   = $decoded['choices'][0]['delta']['content'] ?? '';
                if ($chunk !== '') yield $chunk;
            }
        }
    }

    private function sendChatRequest(array $payload, int $timeout, bool $stream = false): Response
    {
        $response = $this->makeChatRequest($payload, $timeout, $stream);
        if (!$this->isUnavailableModelResponse($response)) {
            return $response;
        }

        $fallbackModel = $this->findAvailableFallbackModel();
        if ($fallbackModel === $this->model) {
            return $response;
        }

        Log::warning('Configured Groq model is unavailable; retrying with an available account model.', [
            'configured_model' => $this->configuredModel,
            'fallback_model' => $fallbackModel,
        ]);

        $this->model = $fallbackModel;
        Cache::put($this->fallbackModelCacheKey(), $fallbackModel, now()->addHours(6));
        $payload['model'] = $fallbackModel;

        return $this->makeChatRequest($payload, $timeout, $stream);
    }

    private function makeChatRequest(array $payload, int $timeout, bool $stream): Response
    {
        $request = Http::withToken($this->apiKey)->timeout($timeout);
        if ($stream) {
            $request = $request->withOptions(['stream' => true]);
        }

        return $request->post("{$this->baseUrl}/chat/completions", $payload);
    }

    private function isUnavailableModelResponse(Response $response): bool
    {
        if (!in_array($response->status(), [400, 404, 422], true)) {
            return false;
        }

        $message = strtolower((string) $response->json('error.message', ''));

        return str_contains($message, 'model')
            && (
                str_contains($message, 'does not exist')
                || str_contains($message, 'do not have access')
                || str_contains($message, 'not found')
                || str_contains($message, 'not available')
            );
    }

    private function findAvailableFallbackModel(): string
    {
        if ($this->apiKey === '') {
            throw new \RuntimeException('GROQ_API_KEY is not configured.');
        }

        $cacheKey = 'groq.available_chat_models.' . hash('sha256', $this->apiKey);
        $availableModels = Cache::remember($cacheKey, now()->addHours(6), function (): array {
            $response = Http::withToken($this->apiKey)
                ->timeout(15)
                ->get("{$this->baseUrl}/models");

            if (!$response->successful()) {
                throw new \RuntimeException(
                    'Unable to retrieve available models from Groq: '
                    . $response->json('error.message', 'Groq API error')
                );
            }

            return collect($response->json('data', []))
                ->pluck('id')
                ->filter(fn ($model) => is_string($model) && $model !== '')
                ->values()
                ->all();
        });

        $preferredModels = [
            'openai/gpt-oss-120b',
            'openai/gpt-oss-20b',
            'llama-3.3-70b-versatile',
            'llama-3.1-8b-instant',
            'qwen/qwen3-32b',
            'moonshotai/kimi-k2-instruct',
            'meta-llama/llama-4-scout-17b-16e-instruct',
            'meta-llama/llama-4-maverick-17b-128e-instruct',
        ];

        foreach ($preferredModels as $model) {
            if (in_array($model, $availableModels, true)) {
                return $model;
            }
        }

        throw new \RuntimeException(
            'The configured Groq model is unavailable and no supported chat model was found for this account. '
            . 'Set GROQ_MODEL to an active chat model available from the Groq account.'
        );
    }

    private function fallbackModelCacheKey(): string
    {
        return 'groq.fallback_model.' . hash('sha256', $this->apiKey . '|' . $this->configuredModel);
    }

    /**
     * Build the Mzitshwa system prompt, optionally injecting live workspace data.
     */
    public function buildSystemPrompt(User $user, string $contextType = 'general'): string
    {
        $workspace = $user->currentWorkspace;
        $wsName    = $workspace ? $workspace->name : 'your workspace';

        $base = "You are Mzitshwa, the built-in AI assistant for the Team Truth project management platform. "
              . "You are PART of this system — you have direct access to workspace data below. "
              . "Workspace: {$wsName}. User: {$user->name}. "
              . "Answer questions using the data provided. Never say you don't have access. "
              . "Be concise. Use markdown formatting. Quote specific numbers and task names.";

        $contextData = $this->fetchContextData($user, $contextType);
        if ($contextData) {
            $base .= "\n\n--- LIVE WORKSPACE DATA ({$contextType}) ---\n" . $contextData;
        }

        return $base;
    }

    /**
     * Fetch workspace data as a plain-text summary for the given context type.
     */
    public function fetchContextData(User $user, string $type): string
    {
        try {
            $workspaceId = $user->current_workspace_id;

            return match ($type) {
                'projects'   => $this->projectsContext($workspaceId),
                'tasks'      => $this->tasksContext($user, $workspaceId),
                'bugs'       => $this->bugsContext($workspaceId),
                'finance'    => $this->financeContext($workspaceId),
                'timesheets' => $this->timesheetsContext($user, $workspaceId),
                default      => $this->generalContext($user, $workspaceId),
            };
        } catch (\Exception $e) {
            Log::error('GroqService::fetchContextData error: ' . $e->getMessage());
            return '';
        }
    }

    // ── Private context builders ──────────────────────────────────────────────

    private function generalContext($user, $workspaceId): string
    {
        $projects = Project::where('workspace_id', $workspaceId)->get();
        $tasks    = Task::whereHas('project', fn($q) => $q->where('workspace_id', $workspaceId))
            ->with(['project', 'assignedTo'])
            ->get();
        $bugs     = Bug::whereHas('project', fn($q) => $q->where('workspace_id', $workspaceId))
            ->with('project')
            ->get();

        $projectStats = $projects->groupBy('status')->map->count();
        $taskStats    = $tasks->groupBy('status')->map->count();

        $overdueTasks = $tasks->filter(fn($t) =>
            $t->due_date && $t->due_date < now() && $t->status !== 'completed'
        );

        $lines = [
            "Projects: {$projects->count()} total | " . $projectStats->map(fn($c, $s) => "$s: $c")->implode(', '),
            "Tasks: {$tasks->count()} total | " . $taskStats->map(fn($c, $s) => "$s: $c")->implode(', '),
            "Overdue tasks: {$overdueTasks->count()}",
        ];

        if ($overdueTasks->count()) {
            $lines[] = "Overdue task details:";
            foreach ($overdueTasks->take(15) as $t) {
                $assignee = $t->assignedTo ? $t->assignedTo->name : 'Unassigned';
                $project  = $t->project ? $t->project->title : 'No project';
                $lines[]  = "  - \"{$t->title}\" | Project: {$project} | Assigned: {$assignee} | Due: {$t->due_date} | Priority: {$t->priority}";
            }
        }

        $openBugs = $bugs->whereNotIn('status', ['resolved', 'closed']);
        $lines[] = "Open bugs: {$openBugs->count()}";
        if ($openBugs->count()) {
            foreach ($openBugs->take(10) as $b) {
                $lines[] = "  - \"{$b->title}\" | Project: {$b->project->title} | Severity: {$b->severity} | Status: {$b->status}";
            }
        }

        return implode("\n", $lines);
    }

    private function projectsContext($workspaceId): string
    {
        $projects = Project::where('workspace_id', $workspaceId)
            ->with(['tasks', 'members'])
            ->get();

        $lines = ["Project List:"];
        foreach ($projects as $p) {
            $lines[] = "• [{$p->status}] {$p->title} | Priority: {$p->priority} | " .
                "Tasks: {$p->tasks->count()} | Progress: {$p->progress}%" .
                ($p->deadline ? " | Deadline: {$p->deadline}" : '');
        }

        $byStatus = $projects->groupBy('status')->map->count();
        $lines[]  = "\nSummary by status: " . $byStatus->map(fn($c, $s) => "$s=$c")->implode(', ');

        $overdue = $projects->filter(fn($p) =>
            $p->deadline && $p->deadline < now()->toDateString() &&
            !in_array($p->status, ['completed', 'cancelled'])
        );
        if ($overdue->count()) {
            $lines[] = "Overdue projects: " . $overdue->pluck('title')->implode(', ');
        }

        return implode("\n", $lines);
    }

    private function tasksContext($user, $workspaceId): string
    {
        $tasks = Task::whereHas('project', fn($q) => $q->where('workspace_id', $workspaceId))
            ->with(['project', 'assignedTo'])
            ->get();

        $myTasks = $tasks->filter(fn($t) => $t->assigned_to == $user->id || $t->created_by == $user->id);

        $byStatus   = $tasks->groupBy('status')->map->count();
        $byPriority = $tasks->groupBy('priority')->map->count();
        $overdue    = $tasks->filter(fn($t) =>
            $t->due_date && $t->due_date < now() && $t->status !== 'completed'
        );

        $lines = [
            "All workspace tasks: {$tasks->count()} total",
            "My tasks: {$myTasks->count()}",
            "By status: " . $byStatus->map(fn($c, $s) => "$s=$c")->implode(', '),
            "By priority: " . $byPriority->map(fn($c, $p) => "$p=$c")->implode(', '),
            "Overdue: {$overdue->count()}",
        ];

        if ($overdue->count()) {
            $lines[] = "\nOverdue tasks:";
            foreach ($overdue->take(15) as $t) {
                $assignee = $t->assignedTo ? $t->assignedTo->name : 'Unassigned';
                $lines[]  = "  - \"{$t->title}\" | Project: {$t->project->title} | Assigned: {$assignee} | Due: {$t->due_date} | Priority: {$t->priority}";
            }
        }

        $inProgress = $tasks->where('status', 'in_progress')->take(10);
        if ($inProgress->count()) {
            $lines[] = "\nIn-progress tasks:";
            foreach ($inProgress as $t) {
                $assignee = $t->assignedTo ? $t->assignedTo->name : 'Unassigned';
                $lines[]  = "  - \"{$t->title}\" | Project: {$t->project->title} | Assigned: {$assignee}" . ($t->due_date ? " | Due: {$t->due_date}" : '');
            }
        }

        return implode("\n", $lines);
    }

    private function bugsContext($workspaceId): string
    {
        $bugs = Bug::whereHas('project', fn($q) => $q->where('workspace_id', $workspaceId))
            ->with('project')
            ->get();

        $byStatus   = $bugs->groupBy('status')->map->count();
        $bySeverity = $bugs->groupBy('severity')->map->count();

        return "Bugs: {$bugs->count()} total\n" .
            "By status: " . $byStatus->map(fn($c, $s) => "$s=$c")->implode(', ') . "\n" .
            "By severity: " . $bySeverity->map(fn($c, $s) => "$s=$c")->implode(', ');
    }

    private function financeContext($workspaceId): string
    {
        $invoices = Invoice::where('workspace_id', $workspaceId)->get();
        $expenses = ProjectExpense::whereHas('project', fn($q) => $q->where('workspace_id', $workspaceId))->get();

        $totalInvoiced = $invoices->sum('total_amount');
        $totalPaid     = $invoices->where('status', 'paid')->sum('total_amount');
        $outstanding   = $invoices->whereIn('status', ['sent', 'overdue'])->sum('total_amount');
        $totalExpenses = $expenses->sum('amount');

        return "Invoices: {$invoices->count()} total | " .
            "Total value: {$totalInvoiced} | Paid: {$totalPaid} | Outstanding: {$outstanding}\n" .
            "Expenses: {$expenses->count()} total | Total amount: {$totalExpenses}";
    }

    private function timesheetsContext($user, $workspaceId): string
    {
        $sheets = Timesheet::where('workspace_id', $workspaceId)
            ->where('user_id', $user->id)
            ->get();

        $totalHours    = $sheets->sum('total_hours');
        $billableHours = $sheets->sum('billable_hours');
        $byStatus      = $sheets->groupBy('status')->map->count();

        return "Timesheets: {$sheets->count()} total | " .
            "Total hours: {$totalHours}h | Billable: {$billableHours}h\n" .
            "By status: " . $byStatus->map(fn($c, $s) => "$s=$c")->implode(', ');
    }
}
