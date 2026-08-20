<?php

namespace App\Services;

use App\Models\User;
use App\Models\Project;
use App\Models\Task;
use App\Models\Bug;
use App\Models\Invoice;
use App\Models\ProjectExpense;
use App\Models\Timesheet;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class GroqService
{
    private string $apiKey;
    private string $baseUrl;
    private string $model;

    public function __construct()
    {
        $this->apiKey  = config('groq.api_key', '');
        $this->baseUrl = config('groq.base_url', 'https://api.groq.com/openai/v1');
        $this->model   = config('groq.model', 'llama-3.3-70b-versatile');
    }

    /**
     * Send a chat request and return the full response as a string.
     */
    public function chat(array $messages, float $temperature = 0.7, int $maxTokens = 2048): string
    {
        $response = Http::withToken($this->apiKey)
            ->timeout(60)
            ->post("{$this->baseUrl}/chat/completions", [
                'model'       => $this->model,
                'messages'    => $messages,
                'max_tokens'  => $maxTokens,
                'temperature' => $temperature,
                'stream'      => false,
            ]);

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
        $rawResponse = Http::withToken($this->apiKey)
            ->timeout(120)
            ->withOptions(['stream' => true])
            ->post("{$this->baseUrl}/chat/completions", [
                'model'       => $this->model,
                'messages'    => $messages,
                'max_tokens'  => $maxTokens,
                'temperature' => $temperature,
                'stream'      => true,
            ]);

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

    /**
     * Build the Mzitshwa system prompt, optionally injecting live workspace data.
     */
    public function buildSystemPrompt(User $user, string $contextType = 'general'): string
    {
        $workspace = $user->currentWorkspace;
        $wsName    = $workspace ? $workspace->name : 'your workspace';

        // Keep base prompt minimal to stay within token-per-minute limits
        $base = "You are Mzitshwa, an AI assistant for Team Truth (workspace: {$wsName}, user: {$user->name}). "
              . "Help with projects, tasks, timesheets, invoices, expenses, and ICT tickets. "
              . "Be concise. Use markdown. Quote numbers when available.";

        // Only inject live workspace data when a specific context tab is selected
        if ($contextType !== 'general') {
            $contextData = $this->fetchContextData($user, $contextType);
            if ($contextData) {
                $base .= "\n\n--- {$contextType} data ---\n" . $contextData;
            }
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
        $tasks    = Task::whereHas('project', fn($q) => $q->where('workspace_id', $workspaceId))->get();
        $bugs     = Bug::whereHas('project', fn($q) => $q->where('workspace_id', $workspaceId))->get();

        $projectStats = $projects->groupBy('status')->map->count();
        $taskStats    = $tasks->groupBy('status')->map->count();

        $overdueTasks = $tasks->filter(fn($t) =>
            $t->due_date && $t->due_date < now() && $t->status !== 'completed'
        )->count();

        return "Projects: {$projects->count()} total | " .
            $projectStats->map(fn($c, $s) => "$s: $c")->implode(', ') . "\n" .
            "Tasks: {$tasks->count()} total | " .
            $taskStats->map(fn($c, $s) => "$s: $c")->implode(', ') . "\n" .
            "Overdue tasks: {$overdueTasks}\n" .
            "Open bugs: " . $bugs->whereNotIn('status', ['resolved', 'closed'])->count();
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
            ->where(fn($q) => $q->where('assigned_to', $user->id)->orWhere('created_by', $user->id))
            ->get();

        $byStatus   = $tasks->groupBy('status')->map->count();
        $byPriority = $tasks->groupBy('priority')->map->count();
        $overdue    = $tasks->filter(fn($t) =>
            $t->due_date && $t->due_date < now() && $t->status !== 'completed'
        );

        $lines = [
            "My Tasks: {$tasks->count()} total",
            "By status: " . $byStatus->map(fn($c, $s) => "$s=$c")->implode(', '),
            "By priority: " . $byPriority->map(fn($c, $p) => "$p=$c")->implode(', '),
            "Overdue: {$overdue->count()}",
        ];

        if ($overdue->count()) {
            $lines[] = "Overdue task titles: " . $overdue->pluck('title')->take(5)->implode(', ');
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
