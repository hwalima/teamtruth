<?php

namespace App\Http\Controllers;

use App\Models\MzitshwaConversation;
use App\Models\MzitshwaMessage;
use App\Services\Mzitshwa\Actions;
use App\Services\Mzitshwa\AiClient;
use App\Services\Mzitshwa\AiException;
use App\Services\Mzitshwa\Assistant;
use App\Support\WorkspacePermissions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class MzitshwaController extends Controller
{
    /** Ask Mzitshwa something; the reply and the question are saved to the conversation. */
    public function chat(Request $request, Assistant $assistant): JsonResponse
    {
        $data = $request->validate([
            'message' => 'required|string|max:4000',
            'conversation_id' => 'nullable|integer',
            'page.url' => 'nullable|string|max:500',
            'page.title' => 'nullable|string|max:200',
        ]);
        $user = $request->user();

        $conversation = isset($data['conversation_id'])
            ? MzitshwaConversation::where('user_id', $user->id)->find($data['conversation_id'])
            : null;

        $history = $conversation
            ? $conversation->messages()->whereIn('role', ['user', 'assistant'])->orderBy('id')->get(['role', 'content'])->toArray()
            : [];
        $history[] = ['role' => 'user', 'content' => $data['message']];

        try {
            $reply = $assistant->reply(
                $user,
                $history,
                $data['page'] ?? [],
                $request->session()->get('active_erp_company_id') ? (int) $request->session()->get('active_erp_company_id') : null,
            );
        } catch (AiException $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 503);
        } catch (\Throwable $e) {
            Log::error('Mzitshwa chat failed', ['error' => $e->getMessage()]);

            return response()->json(['success' => false, 'message' => __('Mzitshwa ran into a problem. Please try again.')], 500);
        }

        $conversation ??= MzitshwaConversation::create([
            'user_id' => $user->id,
            'workspace_id' => $user->current_workspace_id,
            'title' => mb_strimwidth($data['message'], 0, 60, '...'),
            'context' => str_contains((string) ($data['page']['url'] ?? ''), '/erp') ? 'erp' : 'general',
        ]);
        $conversation->touch();

        MzitshwaMessage::create(['conversation_id' => $conversation->id, 'role' => 'user', 'content' => $data['message'], 'created_at' => now()]);
        $saved = MzitshwaMessage::create([
            'conversation_id' => $conversation->id,
            'role' => 'assistant',
            'content' => $reply['content'],
            'metadata' => array_filter(['lookups' => $reply['lookups'], 'proposal' => $reply['proposal']]),
            'created_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'conversation_id' => $conversation->id,
            'message' => $this->present($saved),
        ]);
    }

    /** Carry out a change the user confirmed in the panel. */
    public function action(Request $request): JsonResponse
    {
        $data = $request->validate([
            'action' => 'required|string|in:create_task,update_task,assign_task,create_bug',
            'params' => 'required|array',
            'conversation_id' => 'nullable|integer',
            'message_id' => 'nullable|integer',
        ]);
        $user = $request->user();

        try {
            $result = (new Actions($user, WorkspacePermissions::withGlobal($user)))->execute($data['action'], $data['params']);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 422);
        }

        $conversation = isset($data['conversation_id'])
            ? MzitshwaConversation::where('user_id', $user->id)->find($data['conversation_id'])
            : null;
        if ($conversation) {
            MzitshwaMessage::create(['conversation_id' => $conversation->id, 'role' => 'action', 'content' => $result, 'created_at' => now()]);
            // The proposal has been used: stop showing its Confirm button.
            if (isset($data['message_id'])) {
                $proposalMessage = $conversation->messages()->find($data['message_id']);
                if ($proposalMessage) {
                    $proposalMessage->update(['metadata' => [...($proposalMessage->metadata ?? []), 'proposal_done' => true]]);
                }
            }
        }

        return response()->json(['success' => true, 'message' => $result]);
    }

    /** Whether Mzitshwa is ready, for the panel's empty state. */
    public function status(AiClient $ai): JsonResponse
    {
        return response()->json(['configured' => $ai->isConfigured(), 'provider' => $ai->provider()]);
    }

    public function conversations(Request $request): JsonResponse
    {
        $conversations = MzitshwaConversation::where('user_id', $request->user()->id)
            ->orderByDesc('pinned')->orderByDesc('updated_at')->limit(50)->get()
            ->map(fn ($c) => [
                'id' => $c->id,
                'title' => $c->title,
                'context' => $c->context,
                'updated_at' => $c->updated_at->diffForHumans(),
            ]);

        return response()->json(['conversations' => $conversations]);
    }

    public function show(Request $request, MzitshwaConversation $conversation): JsonResponse
    {
        abort_unless($conversation->user_id === $request->user()->id, 404);

        return response()->json([
            'conversation' => ['id' => $conversation->id, 'title' => $conversation->title],
            'messages' => $conversation->messages()->orderBy('id')->get()->map(fn ($m) => $this->present($m)),
        ]);
    }

    public function destroy(Request $request, MzitshwaConversation $conversation): JsonResponse
    {
        abort_unless($conversation->user_id === $request->user()->id, 404);
        $conversation->delete();

        return response()->json(['success' => true]);
    }

    private function present(MzitshwaMessage $m): array
    {
        $meta = $m->metadata ?? [];

        return [
            'id' => $m->id,
            'role' => $m->role,
            'content' => $m->content,
            'lookups' => $meta['lookups'] ?? [],
            'proposal' => empty($meta['proposal_done']) ? ($meta['proposal'] ?? null) : null,
            'created_at' => $m->created_at?->toISOString(),
        ];
    }
}
