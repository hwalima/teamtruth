<?php

namespace App\Services\Mzitshwa;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Talks to whichever free provider is configured, using the OpenAI-compatible
 * chat-completions API (Gemini, Groq and OpenRouter all accept it).
 */
class AiClient
{
    public function provider(): string
    {
        return (string) config('mzitshwa.provider', 'gemini');
    }

    public function isConfigured(): bool
    {
        return filled($this->setting('api_key'));
    }

    /**
     * One chat turn. Returns the assistant message: ['content' => ?string, 'tool_calls' => array].
     *
     * @throws AiException with a message that is safe to show to the user
     */
    public function chat(array $messages, array $tools = [], float $temperature = 0.3): array
    {
        if (! $this->isConfigured()) {
            throw new AiException(__('Mzitshwa is not set up yet: add an API key for :provider to the .env file.', ['provider' => $this->provider()]));
        }

        $payload = [
            'model' => $this->setting('model'),
            'messages' => $messages,
            'temperature' => $temperature,
        ];
        if ($tools !== []) {
            $payload['tools'] = $tools;
            $payload['tool_choice'] = 'auto';
        }

        try {
            $response = Http::withToken((string) $this->setting('api_key'))
                ->acceptJson()
                ->timeout((int) config('mzitshwa.timeout', 60))
                ->post(rtrim((string) $this->setting('base_url'), '/') . '/chat/completions', $payload);
        } catch (\Throwable $e) {
            Log::warning('Mzitshwa provider unreachable', ['provider' => $this->provider(), 'error' => $e->getMessage()]);
            throw new AiException(__('Mzitshwa could not reach the AI service. Please try again in a moment.'));
        }

        if (! $response->successful()) {
            $detail = $response->json('0.error.message') ?? $response->json('error.message') ?? $response->body();
            Log::warning('Mzitshwa provider error', ['provider' => $this->provider(), 'status' => $response->status(), 'error' => mb_substr((string) $detail, 0, 300)]);

            throw new AiException(match (true) {
                $response->status() === 401, $response->status() === 403 => __('The AI service rejected the API key. Check the key in the .env file.'),
                $response->status() === 402 => __('The AI key has no free quota left (its project has billing with no credit). Use a free key from a project without billing.'),
                $response->status() === 404, $response->status() === 410 => __('The configured AI model is no longer available. Choose another model in the .env file.'),
                $response->status() === 429 => __('The free AI limit has been reached for now. Please wait a minute and try again.'),
                default => __('The AI service returned an error. Please try again.'),
            });
        }

        $message = $response->json('choices.0.message') ?? [];

        $content = $message['content'] ?? null;
        if (is_string($content)) {
            // Some reasoning models put their thinking inline; never show it.
            $content = trim((string) preg_replace('/<think>.*?<\/think>/s', '', $content));
        }

        return [
            'content' => $content,
            'tool_calls' => $message['tool_calls'] ?? [],
        ];
    }

    private function setting(string $key): mixed
    {
        return config("mzitshwa.providers.{$this->provider()}.{$key}");
    }
}
