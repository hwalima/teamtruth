<?php

use App\Services\GroqService;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

uses(Tests\TestCase::class);

test('retries with a chat model available to the configured Groq account', function () {
    config([
        'groq.api_key' => 'test-groq-key',
        'groq.base_url' => 'https://api.groq.com/openai/v1',
        'groq.model' => 'unavailable-model',
    ]);
    Cache::flush();

    Http::fake([
        '*/chat/completions' => Http::sequence()
            ->push([
                'error' => [
                    'message' => 'The model `unavailable-model` does not exist or you do not have access to it.',
                ],
            ], 400)
            ->push([
                'choices' => [
                    ['message' => ['content' => 'Fallback response']],
                ],
            ]),
        '*/models' => Http::response([
            'data' => [
                ['id' => 'llama-3.1-8b-instant'],
            ],
        ]),
    ]);

    $response = app(GroqService::class)->chat([
        ['role' => 'user', 'content' => 'Hello'],
    ]);

    expect($response)->toBe('Fallback response');

    Http::assertSent(fn (Request $request) =>
        str_ends_with($request->url(), '/chat/completions')
        && $request['model'] === 'llama-3.1-8b-instant'
    );
});
