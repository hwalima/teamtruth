<?php

namespace App\Modules\Banking\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Modules\Banking\Models\FundRequest;
use App\Modules\Banking\Models\Money;
use App\Modules\Banking\Services\BankingAccess;
use App\Modules\Banking\Services\FundRequestService;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Core\Services\DocumentRenderer;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Fund requests between companies and the register of every request with
 * who asked, who approved, their signatures and when.
 */
class FundRequestController extends Controller
{
    public function __construct(
        private BankingAccess $access,
        private FundRequestService $requests,
    ) {}

    public function index(Request $request): Response
    {
        $user = $request->user();
        $filters = $this->filters($request);
        $query = $this->filtered($user, $filters);
        $summary = (clone $query)->reorder()->selectRaw('status, currency, count(*) as n, sum(amount) as total')->groupBy('status', 'currency')->get();

        $page = $query->with(['fromAccount:id,account_number', 'toAccount:id,account_number', 'fromCompany:id,code,name', 'toCompany:id,code,name'])
            ->latest('requested_at')->latest('id')
            ->paginate(25)->withQueryString()
            ->through(fn (FundRequest $fr) => $this->row($user, $fr));

        return Inertia::render('Erp/Banking/FundRequests/Index', [
            'requests' => $page,
            'filters' => $filters,
            'summary' => $summary->map(fn ($s) => ['status' => $s->status, 'currency' => $s->currency, 'count' => (int) $s->n, 'total' => Money::cents($s->total)])->values(),
            'awaitingCount' => $this->awaitingQuery($user)->count(),
            'companies' => $this->access->companies($user)->map->only(['id', 'code', 'name'])->values(),
            'statuses' => FundRequest::STATUSES,
        ]);
    }

    public function show(Request $request, FundRequest $fundRequest): Response
    {
        $user = $request->user();
        abort_unless($this->requests->canView($user, $fundRequest), 403);
        $fundRequest->load(['fromAccount.bank:id,name', 'toAccount.bank:id,name', 'fromCompany:id,code,name', 'toCompany:id,code,name', 'transfer', 'transferrer:id,name']);
        $saved = $this->requests->savedSignaturePath($user, $fundRequest->fromCompany);

        return Inertia::render('Erp/Banking/FundRequests/Show', [
            'request' => [
                ...$this->row($user, $fundRequest),
                'from_bank' => $fundRequest->fromAccount->bank->name,
                'to_bank' => $fundRequest->toAccount->bank->name,
                'from_balance' => $fundRequest->fromAccount->balanceCents(),
                'decision_note' => $fundRequest->decision_note,
                'cancelled_at' => $fundRequest->cancelled_at?->toIso8601String(),
                'transferred_by' => $fundRequest->transferrer?->name,
                'transfer_date' => $fundRequest->transfer?->transfer_date?->toDateString(),
                'transfer_reference' => $fundRequest->transfer?->reference,
                'can_cancel' => $this->requests->canCancel($user, $fundRequest),
                'can_execute' => $this->requests->canExecute($user, $fundRequest),
            ],
            'approvers' => $fundRequest->status === FundRequest::PENDING
                ? $this->requests->approvers($fundRequest->fromCompany, $fundRequest->requester)->pluck('name')
                : [],
            'savedSignatureUrl' => $saved ? Storage::disk('public')->url($saved) : null,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'from_account_id' => ['required', 'integer', 'exists:banking_accounts,id'],
            'to_account_id' => ['required', 'integer', 'exists:banking_accounts,id', 'different:from_account_id'],
            'amount' => ['required', 'numeric', 'gt:0', 'max:9999999999999'],
            'purpose' => ['required', 'string', 'max:2000'],
            'signature' => ['nullable', 'string', 'max:1500000'],
        ]);
        $fundRequest = $this->requests->request($request->user(), $data);

        return redirect()->route('erp.banking.fund-requests.show', $fundRequest)
            ->with('success', 'Request '.$fundRequest->reference.' sent to '.$fundRequest->fromCompany->name.' for approval.');
    }

    public function approve(Request $request, FundRequest $fundRequest): RedirectResponse
    {
        $data = $request->validate([
            'signature' => ['nullable', 'string', 'max:1500000'],
            'note' => ['nullable', 'string', 'max:2000'],
        ]);
        $this->requests->approve($request->user(), $fundRequest, $data['signature'] ?? null, $data['note'] ?? null);

        return back()->with('success', 'Approved and signed. '.$fundRequest->requester_name.' has been told the transfer can go ahead.');
    }

    public function reject(Request $request, FundRequest $fundRequest): RedirectResponse
    {
        $data = $request->validate(['note' => ['required', 'string', 'max:2000']]);
        $this->requests->reject($request->user(), $fundRequest, $data['note']);

        return back()->with('success', 'Request rejected. '.$fundRequest->requester_name.' has been told.');
    }

    public function cancel(Request $request, FundRequest $fundRequest): RedirectResponse
    {
        $this->requests->cancel($request->user(), $fundRequest);

        return back()->with('success', 'Request withdrawn.');
    }

    public function execute(Request $request, FundRequest $fundRequest): RedirectResponse
    {
        abort_unless($this->requests->canExecute($request->user(), $fundRequest->loadMissing(['fromAccount', 'toAccount'])), 403, 'You cannot transfer this request.');
        $data = $request->validate([
            'transfer_date' => ['required', 'date'],
            'reference' => ['nullable', 'string', 'max:64'],
        ]);
        $this->requests->execute($request->user(), $fundRequest, $data['transfer_date'], $data['reference'] ?? null);

        return back()->with('success', 'Transferred '.$fundRequest->currency.' '.Money::format(Money::cents($fundRequest->amount)).' to '.$fundRequest->toCompany->name.'.');
    }

    /** One request as a signed requisition, on the paying company's branding. */
    public function pdf(Request $request, FundRequest $fundRequest, DocumentRenderer $renderer): HttpResponse
    {
        abort_unless($this->requests->canView($request->user(), $fundRequest), 403);
        $fundRequest->load(['fromAccount.bank:id,name', 'toAccount.bank:id,name', 'fromCompany', 'toCompany:id,name', 'transfer', 'transferrer:id,name']);

        $context = app(CompanyContext::class);
        $previous = $context->activeCompany();
        try {
            $context->setActiveCompany($fundRequest->fromCompany);
            $pdf = $renderer->renderForCompany($fundRequest->fromCompany, 'pdf.documents.fund-request', [
                'fundRequest' => $fundRequest,
                'requesterSignature' => $this->dataUri($fundRequest->requester_signature_path),
                'approverSignature' => $fundRequest->status !== FundRequest::REJECTED ? $this->dataUri($fundRequest->approver_signature_path) : null,
            ]);
        } finally {
            $context->setActiveCompany($previous);
        }

        return $this->download($pdf, Str::slug('fund-request-'.$fundRequest->reference).'.pdf');
    }

    /** The filtered register with both signatures on every line, for the CEO. */
    public function registerPdf(Request $request, DocumentRenderer $renderer): HttpResponse
    {
        $user = $request->user();
        $filters = $this->filters($request);
        $rows = $this->filtered($user, $filters)
            ->with(['fromAccount:id,account_number', 'toAccount:id,account_number', 'fromCompany:id,name', 'toCompany:id,name', 'transfer:id,transfer_date'])
            ->oldest('requested_at')->oldest('id')
            ->limit(1000)
            ->get()
            ->each(function (FundRequest $fr): void {
                $fr->setAttribute('requester_signature_uri', $this->dataUri($fr->requester_signature_path));
                $fr->setAttribute('approver_signature_uri', $fr->status !== FundRequest::REJECTED ? $this->dataUri($fr->approver_signature_path) : null);
            });
        $company = app(CompanyContext::class)->requireActiveCompany();
        $pdf = $renderer->renderForCompany($company, 'pdf.documents.fund-request-register', [
            'rows' => $rows,
            'filterText' => $this->filterText($filters),
        ]);

        return $this->download($pdf, 'fund-transfer-register-'.now()->format('Y-m-d').'.pdf');
    }

    /** @return array<string, string> */
    private function filters(Request $request): array
    {
        return array_filter($request->validate([
            'view' => ['nullable', Rule::in(['awaiting', 'mine', 'all'])],
            'status' => ['nullable', Rule::in(FundRequest::STATUSES)],
            'from_company' => ['nullable', 'integer'],
            'to_company' => ['nullable', 'integer'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'q' => ['nullable', 'string', 'max:100'],
        ]), fn ($v) => $v !== null && $v !== '');
    }

    private function filtered(User $user, array $filters): Builder
    {
        $viewIds = $this->access->companyIds($user);
        $query = FundRequest::query()->where(fn (Builder $q) => $q->where('requested_by', $user->id)
            ->orWhereIn('from_company_id', $viewIds)
            ->orWhereIn('to_company_id', $viewIds));

        match ($filters['view'] ?? 'all') {
            'awaiting' => $query->whereIn('id', $this->awaitingQuery($user)->select('id')),
            'mine' => $query->where('requested_by', $user->id),
            default => null,
        };

        return $query
            ->when($filters['status'] ?? null, fn ($q, $v) => $q->where('status', $v))
            ->when($filters['from_company'] ?? null, fn ($q, $v) => $q->where('from_company_id', $v))
            ->when($filters['to_company'] ?? null, fn ($q, $v) => $q->where('to_company_id', $v))
            ->when($filters['from'] ?? null, fn ($q, $v) => $q->where('requested_at', '>=', $v.' 00:00:00'))
            ->when($filters['to'] ?? null, fn ($q, $v) => $q->where('requested_at', '<=', $v.' 23:59:59'))
            ->when($filters['q'] ?? null, fn ($q, $v) => $q->where(fn ($w) => $w->where('reference', 'like', "%{$v}%")
                ->orWhere('purpose', 'like', "%{$v}%")
                ->orWhere('requester_name', 'like', "%{$v}%")
                ->orWhere('approver_name', 'like', "%{$v}%")));
    }

    /** Pending requests out of companies where this user approves, that they did not raise. */
    private function awaitingQuery(User $user): Builder
    {
        return FundRequest::query()
            ->where('status', FundRequest::PENDING)
            ->whereIn('from_company_id', $this->access->companyIds($user, 'erp.banking.approve'))
            ->where('requested_by', '!=', $user->id);
    }

    private function row(User $user, FundRequest $fr): array
    {
        $disk = Storage::disk('public');

        return [
            'id' => $fr->id,
            'reference' => $fr->reference,
            'amount' => Money::cents($fr->amount),
            'currency' => $fr->currency,
            'purpose' => $fr->purpose,
            'status' => $fr->status,
            'from' => ['company' => $fr->fromCompany->name, 'company_id' => $fr->from_company_id, 'account' => $fr->fromAccount->account_number, 'account_id' => $fr->from_account_id],
            'to' => ['company' => $fr->toCompany->name, 'company_id' => $fr->to_company_id, 'account' => $fr->toAccount->account_number, 'account_id' => $fr->to_account_id],
            'requester' => [
                'name' => $fr->requester_name,
                'title' => $fr->requester_title,
                'at' => $fr->requested_at?->toIso8601String(),
                'signature_url' => $fr->requester_signature_path ? $disk->url($fr->requester_signature_path) : null,
            ],
            'approver' => $fr->decided_at ? [
                'name' => $fr->approver_name,
                'title' => $fr->approver_title,
                'at' => $fr->decided_at->toIso8601String(),
                'signature_url' => $fr->approver_signature_path ? $disk->url($fr->approver_signature_path) : null,
            ] : null,
            'transferred_at' => $fr->transferred_at?->toIso8601String(),
            'can_decide' => $this->requests->canDecide($user, $fr),
        ];
    }

    private function dataUri(?string $path): ?string
    {
        $disk = Storage::disk('public');
        if (! $path || ! $disk->exists($path)) {
            return null;
        }
        $mime = $disk->mimeType($path);

        return in_array($mime, ['image/png', 'image/jpeg', 'image/gif'], true) ? 'data:'.$mime.';base64,'.base64_encode($disk->get($path)) : null;
    }

    private function filterText(array $filters): string
    {
        $names = $this->access->companies(request()->user())->pluck('name', 'id');
        $parts = array_filter([
            isset($filters['status']) ? ucfirst($filters['status']) : null,
            isset($filters['from_company']) ? 'From '.($names[$filters['from_company']] ?? '—') : null,
            isset($filters['to_company']) ? 'To '.($names[$filters['to_company']] ?? '—') : null,
            isset($filters['from']) || isset($filters['to']) ? 'Requested '.($filters['from'] ?? 'start').' to '.($filters['to'] ?? 'today') : null,
            isset($filters['q']) ? '“'.$filters['q'].'”' : null,
        ]);

        return $parts === [] ? 'All fund requests' : implode(' · ', $parts);
    }

    private function download(string $pdf, string $filename): HttpResponse
    {
        return response($pdf, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
        ]);
    }
}
