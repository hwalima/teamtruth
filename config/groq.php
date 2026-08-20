<?php

return [
    'api_key'    => env('GROQ_API_KEY'),
    'base_url'   => 'https://api.groq.com/openai/v1',
    'model'      => env('GROQ_MODEL', 'llama-3.3-70b-versatile'),
    'max_tokens' => 2048,
    'temperature' => 0.7,
];
