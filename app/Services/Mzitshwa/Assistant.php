<?php

namespace App\Services\Mzitshwa;

use App\Models\User;
use App\Support\WorkspacePermissions;

/**
 * Runs one Mzitshwa turn: gives the AI the user's question plus the look-ups
 * they are allowed, runs any look-ups it asks for, and returns its answer.
 * Changes are never made here; workspace actions come back as a proposal the
 * user confirms in the panel.
 */
class Assistant
{
    public const MAX_HISTORY = 20;

    public function __construct(private AiClient $ai, private ErpScope $erp) {}

    /**
     * @param  array<int, array{role: string, content: string}>  $history  the conversation so far, ending with the user's question
     * @param  array{url?: string, title?: string}  $page  where the user is in the app
     * @return array{content: string, lookups: array<int, string>, proposal: ?array}
     */
    public function reply(User $user, array $history, array $page = [], ?int $erpCompanyId = null): array
    {
        $this->erp->resolve($user, $erpCompanyId);
        $permissions = WorkspacePermissions::withGlobal($user);
        $tools = new Tools($user, $permissions, $this->erp);
        $actions = new Actions($user, $permissions);

        $definitions = [...$tools->definitions(), ...$actions->definitions()];
        $messages = [
            ['role' => 'system', 'content' => $this->systemPrompt($user, $page, $tools, $actions)],
            ...array_map(fn ($m) => ['role' => $m['role'], 'content' => (string) $m['content']], array_slice($history, -self::MAX_HISTORY)),
        ];

        $lookups = [];
        $proposal = null;
        $maxRounds = (int) config('mzitshwa.max_tool_rounds', 6);
        $limit = (int) config('mzitshwa.max_tool_result_chars', 12000);

        for ($round = 0; $round <= $maxRounds; $round++) {
            // On the last round, ask for an answer with what has been gathered.
            $reply = $this->ai->chat($messages, $round < $maxRounds ? $definitions : []);

            if ($reply['tool_calls'] === []) {
                return [
                    'content' => trim((string) $reply['content']) ?: __("I couldn't put an answer together. Please rephrase the question."),
                    'lookups' => array_values(array_unique($lookups)),
                    'proposal' => $proposal,
                ];
            }

            $messages[] = ['role' => 'assistant', 'content' => $reply['content'] ?? '', 'tool_calls' => $reply['tool_calls']];

            foreach ($reply['tool_calls'] as $call) {
                $name = (string) ($call['function']['name'] ?? '');
                $args = json_decode((string) ($call['function']['arguments'] ?? '{}'), true);
                $args = is_array($args) ? $args : [];

                if ($actions->has($name)) {
                    $proposed = $actions->propose($name, $args);
                    if (isset($proposed['error'])) {
                        $result = ['error' => $proposed['error']];
                    } else {
                        $proposal = $proposed;
                        $result = ['status' => 'Shown to the user for confirmation. Nothing has been changed yet; tell them to press Confirm.'];
                    }
                } else {
                    $result = $tools->run($name, $args);
                    $lookups[] = $this->label($name);
                }

                $json = json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PARTIAL_OUTPUT_ON_ERROR);
                if (mb_strlen($json) > $limit) {
                    $json = mb_substr($json, 0, $limit) . '... [cut short: ask for a narrower search]';
                }

                $messages[] = ['role' => 'tool', 'tool_call_id' => (string) ($call['id'] ?? $name), 'content' => $json];
            }
        }

        return ['content' => __('That needed too many look-ups. Please ask something narrower.'), 'lookups' => $lookups, 'proposal' => $proposal];
    }

    private function systemPrompt(User $user, array $page, Tools $tools, Actions $actions): string
    {
        $company = $this->erp->company();
        $others = array_diff($this->erp->companyNames(), [$company?->name]);
        $erpLine = match (true) {
            $company !== null => "Active ERP company: {$company->name} (base currency {$company->default_currency})."
                . ($others ? ' The user also belongs to: ' . implode(', ', $others) . '. Data from those needs switching company in the ERP.' : ''),
            $others !== [] => 'The user belongs to ERP companies (' . implode(', ', $others) . ') but none is open: ask them to open one in the ERP to see its data.',
            default => 'The user has no ERP company.',
        };
        $workspace = $user->currentWorkspace?->name ?? 'none';
        $where = trim(($page['title'] ?? '') . ' ' . ($page['url'] ?? ''));
        $lookups = implode(', ', $tools->names()) ?: 'none';
        $canAct = implode(', ', $actions->names()) ?: 'none';

        return <<<PROMPT
        You are Mzitshwa, the assistant built into this business system. It has a project workspace (projects, tasks, bugs, timesheets, notes, meetings) and an ERP (accounting, invoicing, banking, inventory, purchasing, requisitions, sales, HR, approvals).

        Today is {$this->today()}. User: {$user->name}. Workspace: {$workspace}. {$erpLine}
        The user is on: {$where}.

        Rules:
        - For any fact, figure or record, call a look-up first. Never invent names, numbers or documents. If a look-up returns nothing, say so.
        - Look-ups available to this user: {$lookups}. These follow the user's role. If they ask about something no look-up covers, say they don't have access to it (or it isn't covered yet) instead of guessing.
        - You can read ERP data but you cannot create, post, approve, pay or change anything in the ERP. Tell the user which ERP page to use instead.
        - Workspace changes you may prepare: {$canAct}. Prepare them only when asked; the user confirms them in the panel.
        - Answer in the user's language. Be brief and direct; lead with the answer. Use markdown: short bullet lists, and tables for more than three rows. Show money with its currency code and thousands separators.
        - Explain how to do things in the system when asked (where to click), using the module names above.
        PROMPT;
    }

    private function today(): string
    {
        return now()->format('l j F Y');
    }

    private function label(string $tool): string
    {
        return ucfirst(str_replace('_', ' ', $tool));
    }
}
