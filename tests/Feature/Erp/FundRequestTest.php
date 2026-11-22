<?php

use App\Models\User;
use App\Modules\Banking\Models\Bank;
use App\Modules\Banking\Models\BankAccount;
use App\Modules\Banking\Models\BankTransfer;
use App\Modules\Banking\Models\FundRequest;
use App\Modules\Banking\Notifications\FundRequestNotification;
use App\Modules\Core\Models\Company;
use App\Modules\Core\Models\CompanySignatory;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Core\Services\ErpRoleService;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;

const SAMPLE_SIGNATURE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

function joinCompany(Company $company, User $user, string $role): void
{
    app(ErpRoleService::class)->createDefaultRoles($company);
    $company->users()->attach($user->id, [
        'role' => $role,
        'erp_role_id' => $company->erpRoles()->where('slug', $role)->value('id'),
        'is_active' => true,
    ]);
}

function bankAccount(Company $company, string $number, string $opening): BankAccount
{
    return BankAccount::query()->create([
        'bank_id' => Bank::query()->firstOrCreate(['name' => 'Sample Bank'])->id,
        'company_id' => $company->id,
        'account_number' => $number,
        'account_name' => $company->name,
        'currency' => 'USD',
        'opening_balance' => $opening,
        'opening_date' => '2026-10-01',
        'status' => 'active',
    ]);
}

beforeEach(function () {
    Storage::fake('public');
    Notification::fake();

    $this->payer = Company::create(['code' => 'SAC', 'name' => 'Sample Academy']);
    $this->receiver = Company::create(['code' => 'SWL', 'name' => 'Sample Wellness']);
    $this->finance = User::factory()->create(['name' => 'Fiona Finance', 'email' => 'finance@example.test']);
    $this->manager = User::factory()->create(['name' => 'Mark Manager', 'email' => 'manager@example.test']);
    joinCompany($this->payer, $this->finance, 'finance');
    joinCompany($this->receiver, $this->finance, 'finance');
    joinCompany($this->payer, $this->manager, 'manager');

    $this->from = bankAccount($this->payer, '300301', '5000.00');
    $this->to = bankAccount($this->receiver, '300302', '0.00');

    $this->actingAs($this->finance)->withSession(['active_erp_company_id' => $this->payer->id]);
    app(CompanyContext::class)->setActiveCompany($this->payer);
});

function requestFunds(array $overrides = []): FundRequest
{
    test()->post(route('erp.banking.fund-requests.store'), [
        'from_account_id' => test()->from->id,
        'to_account_id' => test()->to->id,
        'amount' => '1000.00',
        'purpose' => 'Start-up float',
        'signature' => SAMPLE_SIGNATURE,
        ...$overrides,
    ])->assertSessionHasNoErrors();

    return FundRequest::query()->latest('id')->firstOrFail();
}

test('a fund request is approved and signed by the paying company manager before the money moves', function () {
    // Money cannot go straight to another company.
    $this->post(route('erp.banking.transfers.store'), [
        'from_account_id' => $this->from->id, 'to_account_id' => $this->to->id, 'transfer_date' => '2026-11-20', 'amount' => '1000',
    ])->assertSessionHasErrors('to_account_id');

    $request = requestFunds();
    expect($request->reference)->toBe('FR-'.str_pad((string) $request->id, 5, '0', STR_PAD_LEFT))
        ->and($request->status)->toBe(FundRequest::PENDING)
        ->and($request->requester_name)->toBe('Fiona Finance')
        ->and($request->requester_title)->toBe('Finance');
    Storage::disk('public')->assertExists($request->requester_signature_path);
    Notification::assertSentTo($this->manager, FundRequestNotification::class, function ($n, $channels) {
        return $n->event === 'submitted' && in_array('mail', $channels, true) && in_array('database', $channels, true);
    });
    Notification::assertNotSentTo($this->finance, FundRequestNotification::class);

    // Nobody can transfer it or approve their own request yet.
    $this->post(route('erp.banking.fund-requests.transfer', $request), ['transfer_date' => '2026-11-20'])->assertForbidden();
    $this->post(route('erp.banking.fund-requests.approve', $request), ['signature' => SAMPLE_SIGNATURE])->assertForbidden();

    // The manager sees it waiting and approves with a signature.
    $this->actingAs($this->manager)->withSession(['active_erp_company_id' => $this->payer->id]);
    $page = $this->get(route('erp.banking.fund-requests.index', ['view' => 'awaiting']))->assertOk()->viewData('page')['props'];
    expect($page['awaitingCount'])->toBe(1)
        ->and($page['requests']['data'][0]['can_decide'])->toBeTrue();
    $this->post(route('erp.banking.fund-requests.approve', $request), ['signature' => SAMPLE_SIGNATURE, 'note' => 'Go ahead'])->assertSessionHasNoErrors();

    $request->refresh();
    expect($request->status)->toBe(FundRequest::APPROVED)
        ->and($request->approver_name)->toBe('Mark Manager')
        ->and($request->approver_title)->toBe('Manager')
        ->and($request->decided_at)->not->toBeNull()
        ->and($request->decision_note)->toBe('Go ahead');
    Storage::disk('public')->assertExists($request->approver_signature_path);
    Notification::assertSentTo($this->finance, FundRequestNotification::class, fn ($n) => $n->event === 'approved');

    // Now the finance manager makes the transfer.
    $this->actingAs($this->finance);
    $this->post(route('erp.banking.fund-requests.transfer', $request), ['transfer_date' => '2026-11-21'])->assertSessionHasNoErrors();
    $request->refresh();
    expect($request->status)->toBe(FundRequest::TRANSFERRED)
        ->and($request->transfer_id)->not->toBeNull()
        ->and($this->from->balanceCents())->toBe(400000)
        ->and($this->to->balanceCents())->toBe(100000)
        ->and($this->to->transactions()->value('description'))->toContain($request->reference);
    Notification::assertSentTo($this->manager, FundRequestNotification::class, fn ($n) => $n->event === 'transferred');

    // Removing the transfer puts the request back to approved.
    $this->delete(route('erp.banking.transfers.destroy', BankTransfer::query()->sole()))->assertSessionHasNoErrors();
    expect($request->refresh()->status)->toBe(FundRequest::APPROVED)
        ->and($this->from->balanceCents())->toBe(500000);
});

test('a request needs someone at the paying company who can approve, and a signature', function () {
    $this->payer->users()->updateExistingPivot($this->manager->id, ['is_active' => false]);
    $this->post(route('erp.banking.fund-requests.store'), [
        'from_account_id' => $this->from->id, 'to_account_id' => $this->to->id, 'amount' => '10', 'purpose' => 'Test', 'signature' => SAMPLE_SIGNATURE,
    ])->assertSessionHasErrors('from_account_id');

    $this->payer->users()->updateExistingPivot($this->manager->id, ['is_active' => true]);
    $this->post(route('erp.banking.fund-requests.store'), [
        'from_account_id' => $this->from->id, 'to_account_id' => $this->to->id, 'amount' => '10', 'purpose' => 'Test',
    ])->assertSessionHasErrors('signature');

    // A saved signature is used, and copied so it never changes later.
    Storage::disk('public')->put('signatures/fiona.png', base64_decode(substr(SAMPLE_SIGNATURE, 22)));
    CompanySignatory::query()->create([
        'company_id' => $this->payer->id, 'user_id' => $this->finance->id, 'name' => 'Fiona Finance', 'title' => 'Group Finance Manager',
        'signature_image_path' => 'signatures/fiona.png', 'is_active' => true,
    ]);
    $request = requestFunds(['signature' => null]);
    expect($request->requester_title)->toBe('Group Finance Manager')
        ->and($request->requester_signature_path)->not->toBe('signatures/fiona.png');
    Storage::disk('public')->assertExists($request->requester_signature_path);
});

test('a rejected request carries the reason and can never be transferred', function () {
    $request = requestFunds();
    $this->actingAs($this->manager);
    $this->post(route('erp.banking.fund-requests.reject', $request), [])->assertSessionHasErrors('note');
    $this->post(route('erp.banking.fund-requests.reject', $request), ['note' => 'Not budgeted'])->assertSessionHasNoErrors();
    expect($request->refresh()->status)->toBe(FundRequest::REJECTED);
    Notification::assertSentTo($this->finance, FundRequestNotification::class, fn ($n) => $n->event === 'rejected');

    $this->actingAs($this->finance);
    $this->post(route('erp.banking.fund-requests.transfer', $request), ['transfer_date' => '2026-11-21'])->assertForbidden();
    expect(BankTransfer::query()->count())->toBe(0);
});

test('the register filters requests and prints both signatures; outsiders see nothing', function () {
    $approved = requestFunds(['purpose' => 'Approved float']);
    requestFunds(['purpose' => 'Still waiting', 'amount' => '25']);
    $this->actingAs($this->manager);
    $this->post(route('erp.banking.fund-requests.approve', $approved), ['signature' => SAMPLE_SIGNATURE]);

    $this->actingAs($this->finance);
    $page = $this->get(route('erp.banking.fund-requests.index', ['status' => 'approved']))->assertOk()->viewData('page')['props'];
    expect($page['requests']['data'])->toHaveCount(1)
        ->and($page['requests']['data'][0]['approver']['name'])->toBe('Mark Manager')
        ->and($page['requests']['data'][0]['approver']['signature_url'])->not->toBeNull();

    $pdf = $this->get(route('erp.banking.fund-requests.register', ['to_company' => $this->receiver->id]))->assertOk();
    expect(substr($pdf->getContent(), 0, 4))->toBe('%PDF');
    $single = $this->get(route('erp.banking.fund-requests.pdf', $approved))->assertOk();
    expect(substr($single->getContent(), 0, 4))->toBe('%PDF')
        ->and(app(CompanyContext::class)->activeCompany()->id)->toBe($this->payer->id);

    $outsider = User::factory()->create();
    $this->actingAs($outsider)->withSession(['active_erp_company_id' => $this->payer->id]);
    joinCompany($this->payer, $outsider, 'member');
    $this->get(route('erp.banking.fund-requests.show', $approved))->assertForbidden();
    expect($this->get(route('erp.banking.fund-requests.index'))->viewData('page')['props']['requests']['data'])->toBeEmpty();
});

test('the banking dashboard sums balances and flows per company and month', function () {
    $request = requestFunds();
    $this->actingAs($this->manager);
    $this->post(route('erp.banking.fund-requests.approve', $request), ['signature' => SAMPLE_SIGNATURE]);
    $this->actingAs($this->finance);
    $this->post(route('erp.banking.fund-requests.transfer', $request), ['transfer_date' => '2026-11-05']);

    $props = $this->get(route('erp.banking.dashboard'))->assertOk()->viewData('page')['props'];
    $november = collect($props['series'])->where('month', '2026-11');
    expect(collect($props['accounts'])->sum('balance'))->toBe(500000)
        ->and($november->firstWhere('company_id', $this->payer->id)['closing'])->toBe(400000)
        ->and($november->firstWhere('company_id', $this->payer->id)['transfers_out'])->toBe(100000)
        ->and($november->firstWhere('company_id', $this->receiver->id)['closing'])->toBe(100000)
        ->and($props['flows'][0]['amount'])->toBe(100000)
        ->and($props['requests']['by_status'][0]['status'])->toBe('transferred');
});
