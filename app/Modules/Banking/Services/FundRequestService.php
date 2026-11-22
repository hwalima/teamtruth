<?php

namespace App\Modules\Banking\Services;

use App\Models\User;
use App\Modules\Banking\Models\BankAccount;
use App\Modules\Banking\Models\FundRequest;
use App\Modules\Banking\Models\Money;
use App\Modules\Banking\Notifications\FundRequestNotification;
use App\Modules\Core\Models\Company;
use App\Modules\Core\Models\CompanySignatory;
use App\Modules\Core\Services\AuditLogService;
use App\Modules\Core\Services\ErpRoleService;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * Money between companies moves in three steps: the finance manager requests
 * it, a manager of the paying company approves it (their name, title,
 * signature and the time are fixed on the request), and only then can the
 * transfer be made.
 */
class FundRequestService
{
    public function __construct(
        private BankingAccess $access,
        private BankingService $banking,
        private ErpRoleService $roles,
        private AuditLogService $audit,
    ) {}

    /** @param array{from_account_id:int|string, to_account_id:int|string, amount:mixed, purpose:string, signature?:?string} $data */
    public function request(User $user, array $data): FundRequest
    {
        $from = BankAccount::query()->with('company')->findOrFail($data['from_account_id']);
        $to = BankAccount::query()->with('company')->findOrFail($data['to_account_id']);
        $this->access->authorize($user, $from, 'erp.banking.manage');
        $this->access->authorize($user, $to, 'erp.banking.manage');
        if ($from->is($to)) {
            throw ValidationException::withMessages(['to_account_id' => 'Choose a different account to receive the funds.']);
        }
        if ((int) $from->company_id === (int) $to->company_id) {
            throw ValidationException::withMessages(['to_account_id' => 'Both accounts belong to '.$from->company->name.'. Move money within one company with a transfer instead.']);
        }
        if ($from->status !== 'active' || $to->status !== 'active') {
            throw ValidationException::withMessages(['from_account_id' => 'Both accounts must be active.']);
        }
        if ($from->currency !== $to->currency) {
            throw ValidationException::withMessages(['to_account_id' => "The accounts use different currencies ({$from->currency} and {$to->currency})."]);
        }
        $amount = Money::cents($data['amount']);
        if ($amount <= 0) {
            throw ValidationException::withMessages(['amount' => 'Enter an amount above zero.']);
        }
        $approvers = $this->approvers($from->company, $user);
        if ($approvers->isEmpty()) {
            throw ValidationException::withMessages(['from_account_id' => 'Nobody at '.$from->company->name.' can approve this yet. Add their manager to '.$from->company->name.' with the Manager role first.']);
        }

        $request = DB::transaction(function () use ($user, $data, $from, $to, $amount): FundRequest {
            $request = FundRequest::query()->create([
                'from_account_id' => $from->id,
                'to_account_id' => $to->id,
                'from_company_id' => $from->company_id,
                'to_company_id' => $to->company_id,
                'amount' => Money::decimal($amount),
                'currency' => $from->currency,
                'purpose' => trim($data['purpose']),
                'status' => FundRequest::PENDING,
                'requested_by' => $user->id,
                'requested_at' => now(),
                'requester_name' => $user->name,
                'requester_title' => $this->title($user, $from->company),
            ]);
            $request->forceFill([
                'reference' => 'FR-'.str_pad((string) $request->id, 5, '0', STR_PAD_LEFT),
                'requester_signature_path' => $this->storeSignature($request, $user, 'requester', $data['signature'] ?? null),
            ])->save();
            $this->audit->record($from->company, 'banking.fund_request.created', $request, [
                'amount' => ['new' => Money::decimal($amount)],
                'to_company' => ['new' => $to->company->name],
            ], actor: $user);

            return $request;
        });

        $this->notify($approvers, new FundRequestNotification($request, 'submitted', $user->name));

        return $request;
    }

    public function approve(User $user, FundRequest $request, ?string $signature, ?string $note): FundRequest
    {
        $this->assertCanDecide($user, $request);

        DB::transaction(function () use ($user, $request, $signature, $note): void {
            $request->forceFill([
                'status' => FundRequest::APPROVED,
                'decided_by' => $user->id,
                'decided_at' => now(),
                'approver_name' => $user->name,
                'approver_title' => $this->title($user, $request->fromCompany),
                'approver_signature_path' => $this->storeSignature($request, $user, 'approver', $signature),
                'decision_note' => filled($note) ? trim($note) : null,
            ])->save();
            $this->audit->record($request->fromCompany, 'banking.fund_request.approved', $request, ['status' => ['old' => 'pending', 'new' => 'approved']], actor: $user);
        });

        $this->notify($this->requesterOf($request), new FundRequestNotification($request, 'approved', $user->name));

        return $request->refresh();
    }

    public function reject(User $user, FundRequest $request, string $note): FundRequest
    {
        $this->assertCanDecide($user, $request);

        DB::transaction(function () use ($user, $request, $note): void {
            $request->forceFill([
                'status' => FundRequest::REJECTED,
                'decided_by' => $user->id,
                'decided_at' => now(),
                'approver_name' => $user->name,
                'approver_title' => $this->title($user, $request->fromCompany),
                'decision_note' => trim($note),
            ])->save();
            $this->audit->record($request->fromCompany, 'banking.fund_request.rejected', $request, ['status' => ['old' => 'pending', 'new' => 'rejected']], actor: $user);
        });

        $this->notify($this->requesterOf($request), new FundRequestNotification($request, 'rejected', $user->name));

        return $request->refresh();
    }

    public function cancel(User $user, FundRequest $request): FundRequest
    {
        if (! $this->canCancel($user, $request)) {
            abort(403, 'Only the person who asked for these funds can withdraw the request.');
        }
        $wasPending = $request->status === FundRequest::PENDING;
        $request->forceFill(['status' => FundRequest::CANCELLED, 'cancelled_at' => now()])->save();
        $this->audit->record($request->fromCompany, 'banking.fund_request.cancelled', $request, ['status' => ['new' => 'cancelled']], actor: $user);
        if ($wasPending) {
            $this->notify($this->approvers($request->fromCompany, $user), new FundRequestNotification($request, 'cancelled', $user->name));
        }

        return $request;
    }

    /** Makes the approved transfer: a debit on the paying statement and a credit on the receiving one. */
    public function execute(User $user, FundRequest $request, string $date, ?string $reference): FundRequest
    {
        if ($request->status !== FundRequest::APPROVED) {
            throw ValidationException::withMessages(['request' => 'Only an approved request can be transferred.']);
        }

        DB::transaction(function () use ($user, $request, $date, $reference): void {
            $transfer = $this->banking->transfer($user, [
                'from_account_id' => $request->from_account_id,
                'to_account_id' => $request->to_account_id,
                'transfer_date' => $date,
                'amount' => $request->amount,
                'description' => $request->reference.' · '.str($request->purpose)->limit(120, '…'),
                'reference' => $reference ?: $request->reference,
            ], approved: true);
            $request->forceFill([
                'status' => FundRequest::TRANSFERRED,
                'transfer_id' => $transfer->id,
                'transferred_by' => $user->id,
                'transferred_at' => now(),
            ])->save();
            $this->audit->record($request->fromCompany, 'banking.fund_request.transferred', $request, ['transfer_id' => ['new' => $transfer->id]], actor: $user);
        });

        $decider = $request->decided_by ? User::query()->whereKey($request->decided_by)->get() : collect();
        $this->notify($decider, new FundRequestNotification($request, 'transferred', $user->name));

        return $request->refresh();
    }

    /** People at the paying company who can approve, never the person asking. @return Collection<int, User> */
    public function approvers(Company $company, ?User $except = null): Collection
    {
        return $company->activeUsers()->get()
            ->reject(fn (User $u) => $except && $u->is($except))
            ->filter(fn (User $u) => $this->roles->allows($company, $u, 'erp.banking.approve'))
            ->values();
    }

    public function canDecide(User $user, FundRequest $request): bool
    {
        return $request->status === FundRequest::PENDING
            && (int) $request->requested_by !== (int) $user->id
            && $request->fromCompany->activeUsers()->whereKey($user->id)->exists()
            && $this->roles->allows($request->fromCompany, $user, 'erp.banking.approve');
    }

    public function canCancel(User $user, FundRequest $request): bool
    {
        return in_array($request->status, [FundRequest::PENDING, FundRequest::APPROVED], true)
            && (int) $request->requested_by === (int) $user->id;
    }

    public function canExecute(User $user, FundRequest $request): bool
    {
        return $request->status === FundRequest::APPROVED
            && $this->access->can($user, $request->fromAccount, 'erp.banking.manage')
            && $this->access->can($user, $request->toAccount, 'erp.banking.manage');
    }

    public function canView(User $user, FundRequest $request): bool
    {
        $ids = $this->access->companyIds($user);

        return (int) $request->requested_by === (int) $user->id
            || in_array((int) $request->from_company_id, $ids, true)
            || in_array((int) $request->to_company_id, $ids, true);
    }

    /** The user's own saved signature, from any company where they are a signatory. */
    public function savedSignaturePath(User $user, ?Company $prefer = null): ?string
    {
        return CompanySignatory::query()
            ->where('user_id', $user->id)
            ->where('is_active', true)
            ->whereNotNull('signature_image_path')
            ->orderByRaw('company_id = ? desc', [$prefer?->id ?? 0])
            ->get()
            ->first(fn (CompanySignatory $s) => Storage::disk('public')->exists($s->signature_image_path))
            ?->signature_image_path;
    }

    private function assertCanDecide(User $user, FundRequest $request): void
    {
        $request->loadMissing('fromCompany');
        if ($request->status !== FundRequest::PENDING) {
            throw ValidationException::withMessages(['request' => 'This request has already been '.$request->status.'.']);
        }
        if ((int) $request->requested_by === (int) $user->id) {
            abort(403, 'You cannot approve your own fund request.');
        }
        if (! $this->canDecide($user, $request)) {
            abort(403, 'Only a manager of '.$request->fromCompany->name.' can approve this request.');
        }
    }

    private function title(User $user, Company $company): ?string
    {
        $signatory = CompanySignatory::query()->where('company_id', $company->id)->where('user_id', $user->id)->where('is_active', true)->first();
        if ($signatory?->title) {
            return $signatory->title;
        }
        $membership = $company->users()->whereKey($user->id)->first();
        $roleId = $membership?->pivot?->erp_role_id;

        return $roleId ? $company->erpRoles()->whereKey($roleId)->value('name') : ($membership ? ucfirst((string) $membership->pivot->role) : null);
    }

    /**
     * The signature drawn just now, or else the person's saved signature. Either
     * way a copy is kept with the request, so it never changes afterwards.
     */
    private function storeSignature(FundRequest $request, User $user, string $role, ?string $drawn): string
    {
        $disk = Storage::disk('public');
        $path = "erp/banking/fund-requests/{$request->id}/{$role}-".now()->format('YmdHis').'.png';

        if (filled($drawn)) {
            if (! preg_match('#^data:image/png;base64,([A-Za-z0-9+/=]+)$#', (string) $drawn, $match)) {
                throw ValidationException::withMessages(['signature' => 'The signature could not be read. Please sign again.']);
            }
            $binary = base64_decode($match[1], true);
            $info = $binary ? @getimagesizefromstring($binary) : false;
            if (! $info || $info[2] !== IMAGETYPE_PNG || strlen($binary) > 1_000_000) {
                throw ValidationException::withMessages(['signature' => 'The signature could not be read. Please sign again.']);
            }
            $disk->put($path, $binary);

            return $path;
        }

        $saved = $this->savedSignaturePath($user, $request->fromCompany);
        if (! $saved) {
            throw ValidationException::withMessages(['signature' => 'Sign in the box before you continue.']);
        }
        $extension = pathinfo($saved, PATHINFO_EXTENSION) ?: 'png';
        $path = substr($path, 0, -3).$extension;
        $disk->put($path, $disk->get($saved));

        return $path;
    }

    /** @return Collection<int, User> */
    private function requesterOf(FundRequest $request): Collection
    {
        return $request->requested_by ? User::query()->whereKey($request->requested_by)->get() : collect();
    }

    /** A mail server problem must never undo an approval, so each send stands alone. */
    private function notify(Collection $users, FundRequestNotification $notification): void
    {
        foreach ($users as $user) {
            try {
                $user->notify($notification);
            } catch (Throwable $exception) {
                report($exception);
            }
        }
    }
}
