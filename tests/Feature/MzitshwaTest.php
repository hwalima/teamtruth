<?php

use App\Models\MzitshwaConversation;
use App\Models\Permission;
use App\Models\Project;
use App\Models\Task;
use App\Models\TaskStage;
use App\Models\User;
use App\Models\Workspace;
use App\Modules\Core\Models\Company;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Invoicing\Models\Customer;
use App\Modules\Invoicing\Models\Invoice;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\Http;

const AI_URL = 'https://ai.example.test/v1/chat/completions';

beforeEach(function () {
    config([
        'mzitshwa.provider' => 'nvidia',
        'mzitshwa.providers.nvidia.base_url' => 'https://ai.example.test/v1',
        'mzitshwa.providers.nvidia.api_key' => 'test-key',
        'mzitshwa.providers.nvidia.model' => 'test-model',
    ]);

    $this->user = User::factory()->create(['name' => 'Sam Example', 'email' => 'sam@example.test']);
    $this->company = Company::create(['code' => 'SMP', 'name' => 'Sample Mining', 'default_currency' => 'USD']);
});

function aiText(string $text): array
{
    return ['choices' => [['message' => ['role' => 'assistant', 'content' => $text]]]];
}

function aiCall(string $tool, array $args = []): array
{
    return ['choices' => [['message' => ['role' => 'assistant', 'content' => null, 'tool_calls' => [
        ['id' => 'call_1', 'type' => 'function', 'function' => ['name' => $tool, 'arguments' => json_encode($args)]],
    ]]]]];
}

/** Names of the look-ups offered to the AI in a recorded request. */
function offeredTools(HttpRequest $request): array
{
    return array_map(fn ($t) => $t['function']['name'], $request->data()['tools'] ?? []);
}

test('guests cannot use Mzitshwa', function () {
    $this->postJson(route('mzitshwa.chat'), ['message' => 'Hello'])->assertUnauthorized();
});

test('a missing API key gives a clear message instead of an error page', function () {
    config(['mzitshwa.providers.nvidia.api_key' => null]);

    $this->actingAs($this->user)->postJson(route('mzitshwa.chat'), ['message' => 'Hello'])
        ->assertStatus(503)
        ->assertJsonPath('message', fn ($m) => str_contains($m, 'not set up'));
});

test('provider failures become friendly messages', function () {
    Http::fake([AI_URL => Http::response(['error' => ['message' => 'quota']], 429)]);

    $this->actingAs($this->user)->postJson(route('mzitshwa.chat'), ['message' => 'Hello'])
        ->assertStatus(503)
        ->assertJsonPath('message', fn ($m) => str_contains($m, 'limit'));
});

test('it answers ERP questions from live company data and saves the conversation', function () {
    $this->company->users()->attach($this->user->id, ['role' => 'owner', 'is_active' => true]);
    app(CompanyContext::class)->setActiveCompany($this->company);
    $customer = Customer::create(['code' => 'C-1', 'name' => 'Beta Construction', 'currency_code' => 'USD', 'is_active' => true]);
    Invoice::create([
        'document_number' => 'INV-0007', 'customer_id' => $customer->id, 'status' => 'sent', 'type' => 'invoice',
        'invoice_date' => now()->subDays(40)->toDateString(), 'due_date' => now()->subDays(10)->toDateString(), 'currency_code' => 'USD',
        'subtotal' => 1500, 'tax_amount' => 0, 'total_amount' => 1500, 'paid_amount' => 0, 'balance_due' => 1500,
    ]);

    Http::fake([AI_URL => Http::sequence()
        ->push(aiCall('find_invoices', ['overdue_only' => true]))
        ->push(aiText('Beta Construction owes **USD 1,500.00** on INV-0007.'))
        ->push(aiText('You are welcome.'))]);

    $response = $this->actingAs($this->user)->withSession(['active_erp_company_id' => $this->company->id])
        ->postJson(route('mzitshwa.chat'), ['message' => 'Which invoices are overdue?', 'page' => ['url' => '/erp/dashboard']])
        ->assertOk()
        ->assertJsonPath('message.content', 'Beta Construction owes **USD 1,500.00** on INV-0007.')
        ->assertJsonPath('message.lookups.0', 'Find invoices');

    $recorded = Http::recorded();
    expect(offeredTools($recorded[0][0]))->toContain('find_invoices', 'profit_and_loss', 'bank_balances', 'hr_overview')
        ->and($recorded[0][0]->data()['messages'][0]['content'])->toContain('Sample Mining')
        ->and(json_encode($recorded[1][0]->data()['messages']))->toContain('INV-0007')->toContain('1500');

    $conversation = MzitshwaConversation::sole();
    expect($conversation->user_id)->toBe($this->user->id)
        ->and($conversation->workspace_id)->toBeNull()
        ->and($conversation->messages()->count())->toBe(2);

    // The next question carries the earlier turn as history.
    $this->postJson(route('mzitshwa.chat'), ['message' => 'Thanks', 'conversation_id' => $response->json('conversation_id')])->assertOk();
    expect(Http::recorded()[2][0]->data()['messages'])->toHaveCount(4);
});

test('ERP look-ups follow the user\'s ERP role', function () {
    $this->company->users()->attach($this->user->id, ['role' => 'member', 'is_active' => true]);
    Http::fake([AI_URL => Http::response(aiText('Hello.'))]);

    $this->actingAs($this->user)->withSession(['active_erp_company_id' => $this->company->id])
        ->postJson(route('mzitshwa.chat'), ['message' => 'Show the profit and loss'])->assertOk();

    Http::assertSent(function (HttpRequest $r) {
        $tools = offeredTools($r);

        return ! in_array('profit_and_loss', $tools, true) && ! in_array('find_invoices', $tools, true)
            && ! in_array('hr_overview', $tools, true);
    });
});

test('a user outside a company cannot read its data by pretending it is active', function () {
    Http::fake([AI_URL => Http::response(aiText('Hello.'))]);

    $this->actingAs($this->user)->withSession(['active_erp_company_id' => $this->company->id])
        ->postJson(route('mzitshwa.chat'), ['message' => 'Bank balances?'])->assertOk();

    Http::assertSent(fn (HttpRequest $r) => ! in_array('bank_balances', offeredTools($r), true)
        && str_contains($r->data()['messages'][0]['content'], 'no ERP company'));
});

test('workspace changes are only proposed, then made after the user confirms', function () {
    Permission::firstOrCreate(['name' => 'task_create', 'guard_name' => 'web'], ['module' => 'tasks']);
    Permission::firstOrCreate(['name' => 'task_view_any', 'guard_name' => 'web'], ['module' => 'tasks']);
    $this->user->givePermissionTo(['task_create', 'task_view_any']);
    $workspace = Workspace::create(['name' => 'Ops', 'slug' => 'ops', 'owner_id' => $this->user->id]);
    $this->user->update(['current_workspace_id' => $workspace->id]);
    TaskStage::firstOrCreate(['workspace_id' => $workspace->id, 'name' => 'To Do'], ['color' => '#999999', 'order' => 1]);
    $project = Project::create(['workspace_id' => $workspace->id, 'title' => 'Plant upgrade', 'status' => 'active', 'priority' => 'medium', 'created_by' => $this->user->id]);

    Http::fake([AI_URL => Http::sequence()
        ->push(aiCall('create_task', ['project' => 'plant', 'title' => 'Order conveyor belts', 'priority' => 'high']))
        ->push(aiText('I have prepared the task. Press Confirm to create it.'))]);

    $response = $this->actingAs($this->user)
        ->postJson(route('mzitshwa.chat'), ['message' => 'Add a task to order conveyor belts on the plant upgrade'])
        ->assertOk()
        ->assertJsonPath('message.proposal.action', 'create_task')
        ->assertJsonPath('message.proposal.params.project_id', $project->id);
    expect(Task::count())->toBe(0);

    $this->postJson(route('mzitshwa.action'), [
        'action' => 'create_task',
        'params' => $response->json('message.proposal.params'),
        'conversation_id' => $response->json('conversation_id'),
        'message_id' => $response->json('message.id'),
    ])->assertOk();

    $task = Task::sole();
    expect($task->title)->toBe('Order conveyor belts')->and($task->priority)->toBe('high')->and($task->project_id)->toBe($project->id);

    // Confirmed proposals are not offered again when the conversation is reopened.
    $this->getJson(route('mzitshwa.conversations.show', $response->json('conversation_id')))
        ->assertOk()->assertJsonPath('messages.1.proposal', null)->assertJsonPath('messages.2.role', 'action');
});

test('confirming an action re-checks the role and the workspace', function () {
    $workspace = Workspace::create(['name' => 'Ops', 'slug' => 'ops', 'owner_id' => User::factory()->create()->id]);
    $this->user->update(['current_workspace_id' => $workspace->id]);
    $project = Project::create(['workspace_id' => $workspace->id, 'title' => 'Plant upgrade', 'status' => 'active', 'priority' => 'medium', 'created_by' => $this->user->id]);

    $this->actingAs($this->user)->postJson(route('mzitshwa.action'), [
        'action' => 'create_task', 'params' => ['project_id' => $project->id, 'title' => 'Sneaky'],
    ])->assertStatus(422);

    expect(Task::count())->toBe(0);
});

test('conversations are private to their owner', function () {
    $other = User::factory()->create();
    $conversation = MzitshwaConversation::create(['user_id' => $other->id, 'title' => 'Private']);

    $this->actingAs($this->user)->getJson(route('mzitshwa.conversations.show', $conversation))->assertNotFound();
    $this->deleteJson(route('mzitshwa.conversations.destroy', $conversation))->assertNotFound();
    $this->getJson(route('mzitshwa.conversations'))->assertOk()->assertJsonCount(0, 'conversations');
    expect(MzitshwaConversation::count())->toBe(1);
});
