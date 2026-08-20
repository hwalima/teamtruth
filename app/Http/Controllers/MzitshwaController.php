<?php

namespace App\Http\Controllers;

use App\Services\GroqService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\StreamedResponse;

class MzitshwaController extends Controller
{
    public function __construct(private GroqService $groq) {}

    /**
     * Multi-turn conversational chat with streaming SSE response.
     */
    public function chat(Request $request): StreamedResponse|JsonResponse
    {
        $request->validate([
            'messages'     => 'required|array|min:1',
            'messages.*.role'    => 'required|in:user,assistant',
            'messages.*.content' => 'required|string|max:4000',
            'context'      => 'nullable|string|in:general,projects,tasks,bugs,finance,timesheets',
            'stream'       => 'nullable|boolean',
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
            return $this->streamResponse($messages);
        }

        try {
            $content = $this->groq->chat($messages);
            return response()->json(['success' => true, 'content' => $content]);
        } catch (\Exception $e) {
            Log::error('Mzitshwa chat error: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Complete / generate content for a specific field (inline helper).
     */
    public function complete(Request $request): JsonResponse
    {
        $request->validate([
            'prompt'       => 'required|string|max:2000',
            'field_type'   => 'nullable|string|max:100',
            'context'      => 'nullable|string|max:2000',
            'tone'         => 'nullable|in:professional,friendly,concise,detailed',
        ]);

        $user = auth()->user();

        $fieldType = $request->input('field_type', 'text');
        $tone      = $request->input('tone', 'professional');
        $ctx       = $request->input('context', '');

        $systemMsg = "You are Mzitshwa, a writing assistant for Team Truth project management. " .
            "Generate {$fieldType} content that is {$tone}. " .
            "Return ONLY the generated content — no preamble, no explanation, no quotes. " .
            ($ctx ? "Additional context: {$ctx}" : '');

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

    /**
     * Dedicated analytics endpoint — returns a structured analysis report.
     */
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

        $system = "You are Mzitshwa, a data analyst for Team Truth. " .
            "Analyse the provided workspace data and deliver concise, actionable insights. " .
            "Use bullet points, numbers, and markdown formatting. Be specific.";

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

    // ── Private helpers ───────────────────────────────────────────────────────

    private function streamResponse(array $messages): StreamedResponse
    {
        return response()->stream(function () use ($messages) {
            // Disable output buffering layers
            while (ob_get_level()) ob_end_flush();
            if (function_exists('apache_setenv')) apache_setenv('no-gzip', '1');
            ini_set('zlib.output_compression', '0');
            ini_set('implicit_flush', '1');

            try {
                foreach ($this->groq->stream($messages) as $chunk) {
                    echo 'data: ' . json_encode(['content' => $chunk]) . "\n\n";
                    flush();
                }
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
