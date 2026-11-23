<?php

/*
| Mzitshwa AI. Every provider below speaks the OpenAI chat-completions format,
| so switching is only a matter of MZITSHWA_PROVIDER and that provider's key.
|   nvidia     - free key from https://build.nvidia.com (default)
|   gemini     - free key from https://aistudio.google.com (project without billing)
|   groq       - free key from https://console.groq.com
|   openrouter - free key from https://openrouter.ai (use a ":free" model)
*/

return [
    'provider' => env('MZITSHWA_PROVIDER', 'nvidia'),

    'providers' => [
        'nvidia' => [
            'base_url' => 'https://integrate.api.nvidia.com/v1',
            'api_key' => env('NVIDIA_API_KEY'),
            'model' => env('NVIDIA_MODEL', 'nvidia/nemotron-3-ultra-550b-a55b'),
        ],
        'gemini' => [
            'base_url' => 'https://generativelanguage.googleapis.com/v1beta/openai',
            'api_key' => env('GEMINI_API_KEY'),
            'model' => env('GEMINI_MODEL', 'gemini-2.5-flash'),
        ],
        'groq' => [
            'base_url' => 'https://api.groq.com/openai/v1',
            'api_key' => env('GROQ_API_KEY'),
            'model' => env('GROQ_MODEL', 'llama-3.3-70b-versatile'),
        ],
        'openrouter' => [
            'base_url' => 'https://openrouter.ai/api/v1',
            'api_key' => env('OPENROUTER_API_KEY'),
            'model' => env('OPENROUTER_MODEL', 'meta-llama/llama-3.3-70b-instruct:free'),
        ],
    ],

    // How many rounds of data look-ups the assistant may do for one question.
    'max_tool_rounds' => 6,

    // Largest tool result (characters) handed back to the model.
    'max_tool_result_chars' => 12000,

    'timeout' => 60,
];
