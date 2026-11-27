<?php

namespace App\Modules\Sales\Services;

use App\Modules\Core\Services\CompanyContext;
use App\Modules\Core\Services\SequenceService;
use App\Models\User;
use App\Modules\Core\Services\ApprovalWorkflowService;
use App\Modules\Core\Services\AuditLogService;
use App\Modules\Core\Enums\ApprovalStatus;
use App\Modules\Invoicing\Models\Customer;
use App\Modules\Invoicing\Services\InvoicingService;
use App\Modules\Sales\Models\SalesTeam;
use App\Modules\Sales\Enums\LeadStatus;
use App\Modules\Sales\Enums\OpportunityStatus;
use App\Modules\Sales\Enums\QuotationStatus;
use App\Modules\Sales\Enums\SalesOrderStatus;
use App\Modules\Sales\Events\SalesOrderConfirmed;
use App\Modules\Inventory\Models\StockLocation;
use App\Modules\Inventory\Services\InventoryStockService;
use App\Modules\Sales\Models\Delivery;
use App\Modules\Sales\Models\Lead;
use App\Modules\Sales\Models\Opportunity;
use App\Modules\Sales\Models\Quotation;
use App\Modules\Sales\Models\QuotationLine;
use App\Modules\Sales\Models\SalesOrder;
use App\Modules\Sales\Models\SalesOrderLine;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class SalesService
{
    public function __construct(
        protected CompanyContext $companyContext,
        protected SequenceService $sequenceService,
    ) {
    }

    public function createLead(array $data): Lead
    {
        $company = $this->companyContext->requireActiveCompany();

        return DB::transaction(function () use ($company, $data): Lead {
            $assignedTo = $data['assigned_to'] ?? null;
            if ($assignedTo !== null && ! $company->activeUsers()->whereKey($assignedTo)->exists()) {
                throw ValidationException::withMessages(['assigned_to' => 'The assignee must be an active member of the current company.']);
            }
            $lead = Lead::query()->create([
                'company_id' => $company->id,
                'name' => $data['name'],
                'contact_person' => $data['contact_person'] ?? null,
                'email' => $data['email'] ?? null,
                'phone' => $data['phone'] ?? null,
                'source' => $data['source'] ?? null,
                'status' => LeadStatus::New->value,
                'assigned_to' => $assignedTo,
                'metadata' => $data['metadata'] ?? null,
            ]);
            app(AuditLogService::class)->record($company, 'sales.lead.created', $lead);

            return $lead;
        });
    }

    public function convertLeadToOpportunity(Lead $lead, array $data): Opportunity
    {
        $company = $this->companyContext->requireActiveCompany();

        if ($lead->company_id !== $company->id) {
            throw new AuthorizationException('Lead does not belong to the active company.');
        }

        if ($lead->status === LeadStatus::Converted->value) {
            throw ValidationException::withMessages(['lead' => 'This lead has already been converted.']);
        }

        return DB::transaction(function () use ($company, $lead, $data): Opportunity {
            $lead = Lead::query()->lockForUpdate()->findOrFail($lead->id);
            $customer = ! empty($data['customer_id']) ? Customer::query()->findOrFail($data['customer_id']) : null;
            $this->assertSameCompany($company->id, $customer);
            if ($lead->status === LeadStatus::Converted->value) {
                throw ValidationException::withMessages(['lead' => 'This lead has already been converted.']);
            }
            $assignedTo = $data['assigned_to'] ?? $lead->assigned_to;
            if ($assignedTo !== null && ! $company->activeUsers()->whereKey($assignedTo)->exists()) {
                throw ValidationException::withMessages(['assigned_to' => 'The assignee must be an active member of the current company.']);
            }
            $opportunity = Opportunity::query()->create([
                'company_id' => $company->id,
                'lead_id' => $lead->id,
                'customer_id' => $customer?->id,
                'title' => $data['title'],
                'expected_value' => $data['expected_value'] ?? 0,
                'probability' => $data['probability'] ?? 0,
                'status' => OpportunityStatus::Open->value,
                'close_date' => $data['close_date'] ?? null,
                'assigned_to' => $assignedTo,
            ]);

            $lead->update([
                'status' => LeadStatus::Converted->value,
            ]);

            return $opportunity;
        });
    }

    public function createOpportunity(array $data): Opportunity
    {
        $company = $this->companyContext->requireActiveCompany();
        return DB::transaction(function () use ($company, $data): Opportunity {
            $lead = ! empty($data['lead_id']) ? Lead::query()->findOrFail($data['lead_id']) : null;
            $customer = ! empty($data['customer_id']) ? Customer::query()->findOrFail($data['customer_id']) : null;
            $this->assertSameCompany($company->id, $lead, $customer);
            $this->assertActiveMember($company, $data['assigned_to'] ?? null);
            return Opportunity::query()->create([
                'company_id' => $company->id, 'lead_id' => $lead?->id, 'customer_id' => $customer?->id,
                'title' => $data['title'], 'expected_value' => $data['expected_value'] ?? 0,
                'probability' => $data['probability'] ?? 0, 'status' => OpportunityStatus::Open->value,
                'close_date' => $data['close_date'] ?? null, 'assigned_to' => $data['assigned_to'] ?? auth()->id(),
            ]);
        });
    }

    public function createQuotation(array $data, User $actor): Quotation
    {
        $company = $this->companyContext->requireActiveCompany();

        return DB::transaction(function () use ($company, $data, $actor): Quotation {
            $customer = Customer::query()->findOrFail($data['customer_id']);
            $opportunity = ! empty($data['opportunity_id']) ? Opportunity::query()->findOrFail($data['opportunity_id']) : null;
            $this->assertSameCompany($company->id, $customer, $opportunity);
            $quotation = Quotation::query()->create([
                'company_id' => $company->id,
                'customer_id' => $customer->id,
                'opportunity_id' => $opportunity?->id,
                'document_number' => $this->sequenceService->next($company, 'sales_quotation'),
                'status' => QuotationStatus::Draft->value,
                'currency_code' => strtoupper($data['currency_code']),
                'valid_until' => $data['valid_until'] ?? null,
                'notes' => $data['notes'] ?? null,
                'terms' => $data['terms'] ?? null,
                'created_by' => $actor->id,
            ]);
            $this->writeQuotationLines($company->id, $quotation, $data['lines']);
            $this->recalculateQuotation($quotation);
            app(AuditLogService::class)->record($company, 'sales.quotation.created', $quotation, actor: $actor);
            return $quotation->fresh(['lines', 'customer']);
        });
    }

    public function submitQuotation(Quotation $quotation, User $actor): Quotation
    {
        $company = $this->companyContext->requireActiveCompany();
        if ((int) $quotation->company_id !== (int) $company->id) {
            throw new AuthorizationException('Quotation does not belong to the active company.');
        }
        if ($quotation->status !== QuotationStatus::Draft->value) {
            throw ValidationException::withMessages(['quotation' => 'Only draft quotations can be submitted.']);
        }
        return DB::transaction(function () use ($company, $quotation, $actor): Quotation {
            $quotation->update(['status' => 'pending_approval', 'submitted_at' => now()]);
            try {
                app(ApprovalWorkflowService::class)->submit($quotation, $actor, (string) $quotation->total, $quotation->currency_code);
            } catch (\LogicException $exception) {
                // No approval workflow for quotations, or no approver: say so instead of a server error.
                throw ValidationException::withMessages(['approval' => __($exception->getMessage())]);
            }
            app(AuditLogService::class)->record($company, 'sales.quotation.submitted', $quotation, actor: $actor);

            return $quotation->fresh();
        });
    }

    public function createTeam(array $data): SalesTeam
    {
        $company = $this->companyContext->requireActiveCompany();
        return DB::transaction(function () use ($company, $data): SalesTeam {
            $team = SalesTeam::query()->create([
                'company_id' => $company->id, 'name' => $data['name'],
                'manager_id' => $data['manager_id'] ?? null,
            ]);
            $memberIds = array_unique(array_map('intval', $data['member_ids'] ?? []));
            $validIds = $company->activeUsers()->whereIn('users.id', $memberIds)->pluck('users.id')->map(fn ($id) => (int) $id)->all();
            if (count($validIds) !== count($memberIds)) {
                throw ValidationException::withMessages(['member_ids' => 'All sales team members must be active members of the current company.']);
            }
            foreach ($validIds as $userId) {
                $team->members()->attach($userId, ['company_id' => $company->id]);
            }
            return $team->load('members');
        });
    }

    /** Change a draft quotation: its header and the whole set of lines. */
    public function updateQuotation(Quotation $quotation, array $data, User $actor): Quotation
    {
        $company = $this->requireOwnQuotation($quotation);

        return DB::transaction(function () use ($company, $quotation, $data, $actor): Quotation {
            $quotation = Quotation::query()->lockForUpdate()->findOrFail($quotation->id);
            if ($quotation->status !== QuotationStatus::Draft->value) {
                throw ValidationException::withMessages(['quotation' => 'Only draft quotations can be edited. Duplicate it to make a new version.']);
            }
            $customer = Customer::query()->findOrFail($data['customer_id']);
            $opportunity = ! empty($data['opportunity_id']) ? Opportunity::query()->findOrFail($data['opportunity_id']) : null;
            $this->assertSameCompany($company->id, $customer, $opportunity);
            $before = $quotation->only(['customer_id', 'currency_code', 'valid_until', 'total']);

            $quotation->update([
                'customer_id' => $customer->id,
                'opportunity_id' => $opportunity?->id,
                'currency_code' => strtoupper($data['currency_code']),
                'valid_until' => $data['valid_until'] ?? null,
                'notes' => $data['notes'] ?? null,
                'terms' => $data['terms'] ?? null,
            ]);
            $quotation->lines()->delete();
            $this->writeQuotationLines($company->id, $quotation, $data['lines']);
            $quotation = $this->recalculateQuotation($quotation->fresh());
            app(AuditLogService::class)->record($company, 'sales.quotation.updated', $quotation, changes: [
                'before' => $before,
                'after' => $quotation->only(['customer_id', 'currency_code', 'valid_until', 'total']),
            ], actor: $actor);

            return $quotation->fresh(['lines', 'customer']);
        });
    }

    /** Stop a quotation: drafts, ones waiting for approval (the approval is withdrawn) and approved ones. */
    public function cancelQuotation(Quotation $quotation, User $actor): Quotation
    {
        $company = $this->requireOwnQuotation($quotation);

        return DB::transaction(function () use ($company, $quotation, $actor): Quotation {
            $quotation = Quotation::query()->lockForUpdate()->findOrFail($quotation->id);
            if (! in_array($quotation->status, [QuotationStatus::Draft->value, 'pending_approval', QuotationStatus::Approved->value], true)) {
                throw ValidationException::withMessages(['quotation' => 'This quotation can no longer be cancelled.']);
            }
            // Withdraw an open approval first; the record cannot change while one is pending.
            $quotation->approvalRequests()->where('status', ApprovalStatus::Pending->value)
                ->update(['status' => ApprovalStatus::Cancelled->value, 'completed_at' => now()]);
            $before = $quotation->status;
            $quotation->update(['status' => QuotationStatus::Cancelled->value]);
            app(AuditLogService::class)->record($company, 'sales.quotation.cancelled', $quotation, changes: [
                'status' => ['old' => $before, 'new' => QuotationStatus::Cancelled->value],
            ], actor: $actor);

            return $quotation->fresh();
        });
    }

    /** Delete a quotation that never went anywhere: a draft or cancelled one with no sales order and no approval history. */
    public function deleteQuotation(Quotation $quotation, User $actor): void
    {
        $company = $this->requireOwnQuotation($quotation);

        DB::transaction(function () use ($company, $quotation, $actor): void {
            $quotation = Quotation::query()->lockForUpdate()->findOrFail($quotation->id);
            if (! in_array($quotation->status, [QuotationStatus::Draft->value, QuotationStatus::Cancelled->value], true)
                || $quotation->salesOrders()->exists()
                || $quotation->approvalRequests()->exists()) {
                throw ValidationException::withMessages(['quotation' => 'This quotation has approval or order history, so it is kept. Cancel it instead.']);
            }
            app(AuditLogService::class)->record($company, 'sales.quotation.deleted', $quotation, changes: [
                'before' => $quotation->only(['document_number', 'customer_id', 'status', 'total']),
            ], actor: $actor);
            $quotation->lines()->delete();
            $quotation->delete();
        });
    }

    /** A new draft with the same customer, lines, notes and terms. */
    public function duplicateQuotation(Quotation $quotation, User $actor): Quotation
    {
        $this->requireOwnQuotation($quotation);
        $quotation->loadMissing('lines');

        return $this->createQuotation([
            'customer_id' => $quotation->customer_id,
            'opportunity_id' => $quotation->opportunity_id,
            'currency_code' => $quotation->currency_code,
            'valid_until' => now()->addDays(30)->toDateString(),
            'notes' => $quotation->notes,
            'terms' => $quotation->terms,
            'lines' => $quotation->lines->map(fn (QuotationLine $line): array => $line->only([
                'product_id', 'description', 'quantity', 'unit_price', 'discount', 'tax_rate', 'notes', 'sort_order',
            ]))->all(),
        ], $actor);
    }

    private function writeQuotationLines(int $companyId, Quotation $quotation, array $lines): void
    {
        foreach (array_values($lines) as $index => $line) {
            $product = ! empty($line['product_id']) ? \App\Modules\Inventory\Models\InventoryProduct::query()->findOrFail($line['product_id']) : null;
            $this->assertSameCompany($companyId, $product);
            QuotationLine::query()->create([
                'company_id' => $companyId, 'quotation_id' => $quotation->id,
                'product_id' => $product?->id, 'description' => $line['description'],
                'quantity' => $line['quantity'], 'unit_price' => $line['unit_price'],
                'discount' => $line['discount'] ?? 0, 'tax_rate' => $line['tax_rate'] ?? 0,
                'notes' => $line['notes'] ?? null, 'sort_order' => $line['sort_order'] ?? $index + 1,
            ]);
        }
    }

    /** Edit a lead's details. Converted leads are history and stay as they were. */
    public function updateLead(Lead $lead, array $data): Lead
    {
        $company = $this->requireOwn($lead);
        if ($lead->status === LeadStatus::Converted->value) {
            throw ValidationException::withMessages(['lead' => 'This lead is already an opportunity, so it can no longer be changed.']);
        }
        $this->assertActiveMember($company, $data['assigned_to'] ?? null);

        $before = $lead->only(['name', 'contact_person', 'email', 'phone', 'source', 'assigned_to']);
        $lead->update([
            'name' => $data['name'],
            'contact_person' => $data['contact_person'] ?? null,
            'email' => $data['email'] ?? null,
            'phone' => $data['phone'] ?? null,
            'source' => $data['source'] ?? null,
            'assigned_to' => $data['assigned_to'] ?? null,
        ]);
        app(AuditLogService::class)->record($company, 'sales.lead.updated', $lead, changes: ['before' => $before, 'after' => $lead->only(array_keys($before))]);

        return $lead;
    }

    /** Move a lead between new, qualified and lost. Conversion has its own step. */
    public function setLeadStatus(Lead $lead, string $status): Lead
    {
        $company = $this->requireOwn($lead);
        if (! in_array($status, [LeadStatus::New->value, LeadStatus::Qualified->value, LeadStatus::Lost->value], true)) {
            throw ValidationException::withMessages(['status' => 'Choose new, qualified or lost.']);
        }
        if ($lead->status === LeadStatus::Converted->value) {
            throw ValidationException::withMessages(['lead' => 'This lead is already an opportunity.']);
        }
        $before = $lead->status;
        $lead->update(['status' => $status]);
        app(AuditLogService::class)->record($company, 'sales.lead.status_changed', $lead, changes: ['before' => ['status' => $before], 'after' => ['status' => $status]]);

        return $lead;
    }

    /** Leads that never became an opportunity can be removed. */
    public function deleteLead(Lead $lead): void
    {
        $company = $this->requireOwn($lead);
        if ($lead->status === LeadStatus::Converted->value || $lead->opportunities()->exists()) {
            throw ValidationException::withMessages(['lead' => 'This lead became an opportunity, so it is kept.']);
        }
        app(AuditLogService::class)->record($company, 'sales.lead.deleted', $lead, changes: ['before' => $lead->only(['name', 'status'])]);
        $lead->delete();
    }

    /** Edit an open opportunity. Won and lost ones are reopened first. */
    public function updateOpportunity(Opportunity $opportunity, array $data): Opportunity
    {
        $company = $this->requireOwn($opportunity);
        if ($opportunity->status !== OpportunityStatus::Open->value) {
            throw ValidationException::withMessages(['opportunity' => 'Reopen this opportunity before changing it.']);
        }
        $customer = ! empty($data['customer_id']) ? Customer::query()->findOrFail($data['customer_id']) : null;
        $this->assertSameCompany($company->id, $customer);
        $this->assertActiveMember($company, $data['assigned_to'] ?? null);

        $fields = ['customer_id', 'title', 'expected_value', 'probability', 'close_date', 'assigned_to'];
        $before = $opportunity->only($fields);
        $opportunity->update([
            'customer_id' => $customer?->id,
            'title' => $data['title'],
            'expected_value' => $data['expected_value'] ?? 0,
            'probability' => $data['probability'] ?? 0,
            'close_date' => $data['close_date'] ?? null,
            'assigned_to' => $data['assigned_to'] ?? null,
        ]);
        app(AuditLogService::class)->record($company, 'sales.opportunity.updated', $opportunity, changes: ['before' => $before, 'after' => $opportunity->only($fields)]);

        return $opportunity;
    }

    /** Mark an opportunity won or lost, or reopen it. Won sets the chance to 100, lost to 0. */
    public function setOpportunityStatus(Opportunity $opportunity, string $status): Opportunity
    {
        $company = $this->requireOwn($opportunity);
        if (OpportunityStatus::tryFrom($status) === null) {
            throw ValidationException::withMessages(['status' => 'Choose open, won or lost.']);
        }
        $before = $opportunity->only(['status', 'probability']);
        $opportunity->update([
            'status' => $status,
            'probability' => match ($status) {
                OpportunityStatus::Won->value => 100,
                OpportunityStatus::Lost->value => 0,
                default => $opportunity->probability,
            },
        ]);
        app(AuditLogService::class)->record($company, 'sales.opportunity.status_changed', $opportunity, changes: ['before' => $before, 'after' => $opportunity->only(['status', 'probability'])]);

        return $opportunity;
    }

    /** Opportunities without quotations can be removed. */
    public function deleteOpportunity(Opportunity $opportunity): void
    {
        $company = $this->requireOwn($opportunity);
        if ($opportunity->quotations()->exists()) {
            throw ValidationException::withMessages(['opportunity' => 'This opportunity has quotations, so it is kept. Mark it lost instead.']);
        }
        app(AuditLogService::class)->record($company, 'sales.opportunity.deleted', $opportunity, changes: ['before' => $opportunity->only(['title', 'status', 'expected_value'])]);
        $opportunity->delete();
    }

    private function requireOwn(Lead|Opportunity $record): \App\Modules\Core\Models\Company
    {
        $company = $this->companyContext->requireActiveCompany();
        if ((int) $record->company_id !== (int) $company->id) {
            throw new AuthorizationException('This sales record does not belong to the active company.');
        }

        return $company;
    }

    private function assertActiveMember(\App\Modules\Core\Models\Company $company, mixed $userId): void
    {
        if ($userId !== null && $userId !== '' && ! $company->activeUsers()->whereKey($userId)->exists()) {
            throw ValidationException::withMessages(['assigned_to' => 'The assignee must be an active member of the current company.']);
        }
    }

    private function requireOwnQuotation(Quotation $quotation): \App\Modules\Core\Models\Company
    {
        $company = $this->companyContext->requireActiveCompany();
        if ((int) $quotation->company_id !== (int) $company->id) {
            throw new AuthorizationException('Quotation does not belong to the active company.');
        }

        return $company;
    }

    private function assertSameCompany(int $companyId, ...$models): void
    {
        foreach ($models as $model) {
            if ($model && (int) $model->company_id !== $companyId) {
                throw new AuthorizationException('Related sales records must belong to the active company.');
            }
        }
    }

    public function recalculateQuotation(Quotation $quotation): Quotation
    {
        $subtotal = '0.0000';
        $discountTotal = '0.0000';
        $taxTotal = '0.0000';
        $total = '0.0000';

        foreach ($quotation->lines as $line) {
            $lineTotal = bcmul((string) $line->quantity, (string) $line->unit_price, 4);
            $lineDiscount = bcmul($lineTotal, bcdiv((string) $line->discount, '100', 4), 4);
            $lineNet = bcsub($lineTotal, $lineDiscount, 4);
            $lineTax = bcmul($lineNet, bcdiv((string) $line->tax_rate, '100', 4), 4);
            $lineFinalTotal = bcadd($lineNet, $lineTax, 4);

            $subtotal = bcadd($subtotal, $lineNet, 4);
            $discountTotal = bcadd($discountTotal, $lineDiscount, 4);
            $taxTotal = bcadd($taxTotal, $lineTax, 4);
            $total = bcadd($total, $lineFinalTotal, 4);

            $line->update(['total' => $lineFinalTotal]);
        }

        $quotation->update([
            'subtotal' => $subtotal,
            'discount_total' => $discountTotal,
            'tax_total' => $taxTotal,
            'total' => $total,
        ]);

        return $quotation->fresh(['lines']);
    }

    public function convertQuotationToSalesOrder(Quotation $quotation): SalesOrder
    {
        $company = $this->companyContext->requireActiveCompany();

        if ($quotation->company_id !== $company->id) {
            throw new AuthorizationException('Quotation does not belong to the active company.');
        }

        if ($quotation->status !== QuotationStatus::Approved->value) {
            throw ValidationException::withMessages(['quotation' => 'Only approved quotations can be converted to sales orders.']);
        }

        return DB::transaction(function () use ($company, $quotation): SalesOrder {
            $salesOrder = SalesOrder::query()->create([
                'company_id' => $company->id,
                'customer_id' => $quotation->customer_id,
                'quotation_id' => $quotation->id,
                'document_number' => $this->sequenceService->next($company, 'sales_order'),
                'status' => SalesOrderStatus::Draft->value,
                'currency_code' => $quotation->currency_code,
                'subtotal' => $quotation->subtotal,
                'discount_total' => $quotation->discount_total,
                'tax_total' => $quotation->tax_total,
                'total' => $quotation->total,
                'expected_delivery_date' => now()->addDays(7),
                'created_by' => auth()->id(),
            ]);

            foreach ($quotation->lines as $quoteLine) {
                SalesOrderLine::query()->create([
                    'company_id' => $company->id,
                    'sales_order_id' => $salesOrder->id,
                    'product_id' => $quoteLine->product_id,
                    'description' => $quoteLine->description,
                    'quantity' => $quoteLine->quantity,
                    'delivered_quantity' => 0,
                    'invoiced_quantity' => 0,
                    'unit_price' => $quoteLine->unit_price,
                    'discount' => $quoteLine->discount,
                    'tax_rate' => $quoteLine->tax_rate,
                    'total' => $quoteLine->total,
                    'notes' => $quoteLine->notes,
                    'sort_order' => $quoteLine->sort_order,
                ]);
            }

            $quotation->update(['status' => QuotationStatus::Converted->value]);

            return $salesOrder->fresh(['lines']);
        });
    }

    public function createInvoiceFromSalesOrder(SalesOrder $salesOrder, User $actor): \App\Modules\Invoicing\Models\Invoice
    {
        $company = $this->companyContext->requireActiveCompany();
        if ((int) $salesOrder->company_id !== (int) $company->id) {
            throw new AuthorizationException('Sales order does not belong to the active company.');
        }
        return DB::transaction(function () use ($company, $salesOrder, $actor): \App\Modules\Invoicing\Models\Invoice {
            $order = SalesOrder::query()->lockForUpdate()->findOrFail($salesOrder->id);
            $order->load('lines.product');
            if (! in_array($order->status, self::OPEN_ORDER_STATUSES, true)) {
                throw ValidationException::withMessages(['sales_order' => 'Only approved sales orders can be invoiced.']);
            }
            // Bill what has gone out (goods) or was ordered (services), less what earlier invoices already covered.
            $toInvoice = $order->lines
                ->map(fn (SalesOrderLine $line): array => [$line, self::invoiceableQuantity($line)])
                ->filter(fn (array $pair): bool => bccomp($pair[1], '0', 4) > 0)
                ->values();
            if ($toInvoice->isEmpty()) {
                throw ValidationException::withMessages(['sales_order' => 'There is nothing to invoice yet. Deliver the goods first; anything already delivered has been invoiced.']);
            }
            $invoice = app(InvoicingService::class)->createInvoice($actor, [
                'customer_id' => $order->customer_id,
                'type' => 'invoice',
                'invoice_date' => now()->toDateString(),
                'currency_code' => $order->currency_code,
                'notes' => trim('Sales order '.$order->document_number.($order->customer_reference ? ' · your reference '.$order->customer_reference : '')),
            ], $toInvoice->map(fn (array $pair): array => [
                'product_id' => $pair[0]->product_id,
                'name' => $pair[0]->description,
                'description' => $pair[0]->notes,
                'quantity' => $pair[1],
                'unit_price' => $pair[0]->unit_price,
                'discount_percent' => $pair[0]->discount,
                'tax_rate' => $pair[0]->tax_rate,
                'metadata' => ['sales_order_line_id' => $pair[0]->id],
            ])->all());
            foreach ($toInvoice as [$line, $quantity]) {
                $line->update(['invoiced_quantity' => bcadd((string) $line->invoiced_quantity, $quantity, 4)]);
            }
            $order->invoices()->attach($invoice->id, ['company_id' => $company->id]);
            if ($order->invoice_id === null) {
                $order->update(['invoice_id' => $invoice->id]);
            }
            app(AuditLogService::class)->record($company, 'sales.order.invoiced', $order, changes: [
                'invoice_id' => ['new' => $invoice->id],
                'lines' => $toInvoice->map(fn (array $pair): array => ['line_id' => $pair[0]->id, 'quantity' => $pair[1]])->all(),
            ], actor: $actor);

            return $invoice;
        });
    }

    /** Order statuses that can still be delivered and invoiced. */
    public const OPEN_ORDER_STATUSES = ['approved', 'partially_delivered', 'delivered'];

    /** How much of a line can go on the next invoice. */
    public static function invoiceableQuantity(SalesOrderLine $line): string
    {
        $ceiling = $line->needsDelivery() ? (string) $line->delivered_quantity : (string) $line->quantity;
        $left = bcsub($ceiling, (string) $line->invoiced_quantity, 4);

        return bccomp($left, '0', 4) > 0 ? $left : '0.0000';
    }

    /**
     * Send goods to the customer: one delivery, any number of order lines, each from a store location.
     * Stock leaves that location for the customer location, and the order becomes partly or fully delivered.
     *
     * @param  array<int, array{sales_order_line_id: int, quantity: string|float|int, location_id?: int|null, lot_code?: string|null}>  $lines
     */
    public function deliverSalesOrder(SalesOrder $salesOrder, User $actor, array $lines, ?string $notes = null): Delivery
    {
        $company = $this->companyContext->requireActiveCompany();
        if ((int) $salesOrder->company_id !== (int) $company->id) {
            throw new AuthorizationException('Sales order does not belong to the active company.');
        }

        return DB::transaction(function () use ($company, $salesOrder, $actor, $lines, $notes): Delivery {
            $order = SalesOrder::query()->lockForUpdate()->findOrFail($salesOrder->id);
            if (! in_array($order->status, ['approved', 'partially_delivered'], true)) {
                throw ValidationException::withMessages(['sales_order' => 'Only approved sales orders that still have goods to send can be delivered.']);
            }
            $orderLines = $order->lines()->with('product')->lockForUpdate()->get()->keyBy('id');
            $wanted = collect($lines)->filter(fn (array $line): bool => bccomp((string) ($line['quantity'] ?? '0'), '0', 4) > 0)->values();
            if ($wanted->isEmpty()) {
                throw ValidationException::withMessages(['lines' => 'Enter a quantity to deliver on at least one line.']);
            }

            $delivery = Delivery::query()->create([
                'company_id' => $company->id,
                'sales_order_id' => $order->id,
                'kind' => Delivery::KIND_DELIVERY,
                'document_number' => $this->sequenceService->next($company, 'sales_delivery'),
                'delivered_by' => $actor->id,
                'delivered_at' => now(),
                'notes' => $notes,
            ]);

            foreach ($wanted as $index => $input) {
                /** @var SalesOrderLine|null $line */
                $line = $orderLines->get((int) $input['sales_order_line_id']);
                if (! $line) {
                    throw ValidationException::withMessages(["lines.{$index}.sales_order_line_id" => 'This line is not on the sales order.']);
                }
                if (! $line->needsDelivery()) {
                    throw ValidationException::withMessages(["lines.{$index}.quantity" => "\"{$line->description}\" is a service and is invoiced without a delivery."]);
                }
                $quantity = bcadd((string) $input['quantity'], '0', 4);
                $remaining = bcsub((string) $line->quantity, (string) $line->delivered_quantity, 4);
                if (bccomp($quantity, $remaining, 4) > 0) {
                    throw ValidationException::withMessages(["lines.{$index}.quantity" => "Only {$this->trimZeros($remaining)} of \"{$line->description}\" is left to deliver."]);
                }
                $source = StockLocation::query()->where('usage', 'internal')->find($input['location_id'] ?? null);
                if (! $source) {
                    throw ValidationException::withMessages(["lines.{$index}.location_id" => 'Choose the store location the goods leave from.']);
                }
                $lotCode = blank($input['lot_code'] ?? null) ? null : trim((string) $input['lot_code']);

                $move = app(InventoryStockService::class)->postMovement($company, $actor, [
                    'operation' => 'issue',
                    'product_id' => $line->product_id,
                    'from_location_id' => $source->id,
                    'to_location_id' => $this->customerLocation($source)->id,
                    'quantity' => $quantity,
                    'lot_code' => $lotCode,
                    'reference' => $order->document_number.' / '.$delivery->document_number,
                ]);
                $delivery->lines()->create([
                    'company_id' => $company->id,
                    'sales_order_line_id' => $line->id,
                    'stock_move_id' => $move->id,
                    'from_location_id' => $source->id,
                    'quantity' => $quantity,
                    'lot_code' => $lotCode,
                ]);
                $line->delivered_quantity = bcadd((string) $line->delivered_quantity, $quantity, 4);
                $line->save();
            }

            $allDelivered = $orderLines->filter(fn (SalesOrderLine $line): bool => $line->needsDelivery())
                ->every(fn (SalesOrderLine $line): bool => bccomp((string) $line->delivered_quantity, (string) $line->quantity, 4) >= 0);
            $before = $order->status;
            $order->update(['status' => $allDelivered ? SalesOrderStatus::Delivered->value : SalesOrderStatus::PartiallyDelivered->value]);
            app(AuditLogService::class)->record($company, 'sales.order.delivered', $delivery, changes: [
                'sales_order_id' => $order->id,
                'status' => ['old' => $before, 'new' => $order->status],
                'lines' => $delivery->lines()->get(['sales_order_line_id', 'quantity', 'from_location_id'])->toArray(),
            ], actor: $actor);

            return $delivery->load('lines');
        });
    }

    /**
     * Take goods back from the customer: they leave the customer location for a store location,
     * the order line counts them as no longer delivered, and the order goes back to part delivered.
     * Anything already invoiced stays invoiced; the result says so, so a credit note can be raised.
     *
     * @param  array<int, array{sales_order_line_id: int, quantity: string|float|int, location_id?: int|null, lot_code?: string|null}>  $lines
     * @return array{return: Delivery, invoiced_quantity_returned: bool}
     */
    public function returnFromCustomer(SalesOrder $salesOrder, User $actor, array $lines, string $reason): array
    {
        $company = $this->companyContext->requireActiveCompany();
        if ((int) $salesOrder->company_id !== (int) $company->id) {
            throw new AuthorizationException('Sales order does not belong to the active company.');
        }

        return DB::transaction(function () use ($company, $salesOrder, $actor, $lines, $reason): array {
            $order = SalesOrder::query()->lockForUpdate()->findOrFail($salesOrder->id);
            if (! in_array($order->status, ['partially_delivered', 'delivered'], true)) {
                throw ValidationException::withMessages(['sales_order' => 'Only orders with goods delivered can take a return.']);
            }
            $orderLines = $order->lines()->with('product')->lockForUpdate()->get()->keyBy('id');
            $wanted = collect($lines)->filter(fn (array $line): bool => bccomp((string) ($line['quantity'] ?? '0'), '0', 4) > 0)->values();
            if ($wanted->isEmpty()) {
                throw ValidationException::withMessages(['lines' => 'Enter a quantity coming back on at least one line.']);
            }

            $return = Delivery::query()->create([
                'company_id' => $company->id,
                'sales_order_id' => $order->id,
                'kind' => Delivery::KIND_RETURN,
                'document_number' => $this->sequenceService->next($company, 'sales_return'),
                'delivered_by' => $actor->id,
                'delivered_at' => now(),
                'notes' => $reason,
            ]);
            $alreadyInvoiced = false;

            foreach ($wanted as $index => $input) {
                /** @var SalesOrderLine|null $line */
                $line = $orderLines->get((int) $input['sales_order_line_id']);
                if (! $line || ! $line->needsDelivery()) {
                    throw ValidationException::withMessages(["lines.{$index}.sales_order_line_id" => 'Only goods delivered on this order can come back.']);
                }
                $quantity = bcadd((string) $input['quantity'], '0', 4);
                if (bccomp($quantity, (string) $line->delivered_quantity, 4) > 0) {
                    throw ValidationException::withMessages(["lines.{$index}.quantity" => "Only {$this->trimZeros((string) $line->delivered_quantity)} of \"{$line->description}\" has been delivered."]);
                }
                $store = StockLocation::query()->where('usage', 'internal')->find($input['location_id'] ?? null);
                if (! $store) {
                    throw ValidationException::withMessages(["lines.{$index}.location_id" => 'Choose the store location the goods come back to.']);
                }
                $lotCode = blank($input['lot_code'] ?? null) ? null : trim((string) $input['lot_code']);

                $move = app(InventoryStockService::class)->postMovement($company, $actor, [
                    'operation' => 'customer_return',
                    'product_id' => $line->product_id,
                    'from_location_id' => $this->customerLocation($store)->id,
                    'to_location_id' => $store->id,
                    'quantity' => $quantity,
                    'lot_code' => $lotCode,
                    'reference' => $order->document_number.' / '.$return->document_number,
                ]);
                $return->lines()->create([
                    'company_id' => $company->id,
                    'sales_order_line_id' => $line->id,
                    'stock_move_id' => $move->id,
                    'from_location_id' => $store->id,
                    'quantity' => $quantity,
                    'lot_code' => $lotCode,
                ]);
                $line->delivered_quantity = bcsub((string) $line->delivered_quantity, $quantity, 4);
                $line->save();
                $alreadyInvoiced = $alreadyInvoiced || bccomp((string) $line->invoiced_quantity, (string) $line->delivered_quantity, 4) > 0;
            }

            $goods = $orderLines->filter(fn (SalesOrderLine $line): bool => $line->needsDelivery());
            $nothingOut = $goods->every(fn (SalesOrderLine $line): bool => bccomp((string) $line->delivered_quantity, '0', 4) <= 0);
            $before = $order->status;
            $order->update(['status' => $nothingOut ? SalesOrderStatus::Approved->value : SalesOrderStatus::PartiallyDelivered->value]);
            app(AuditLogService::class)->record($company, 'sales.order.returned', $return, changes: [
                'sales_order_id' => $order->id,
                'reason' => $reason,
                'status' => ['old' => $before, 'new' => $order->status],
                'lines' => $return->lines()->get(['sales_order_line_id', 'quantity', 'from_location_id'])->toArray(),
            ], actor: $actor);

            return ['return' => $return->load('lines'), 'invoiced_quantity_returned' => $alreadyInvoiced];
        });
    }

    /** Stop an order that has not gone anywhere yet: nothing delivered and nothing invoiced. */
    public function cancelSalesOrder(SalesOrder $salesOrder, User $actor): SalesOrder
    {
        $company = $this->companyContext->requireActiveCompany();
        if ((int) $salesOrder->company_id !== (int) $company->id) {
            throw new AuthorizationException('Sales order does not belong to the active company.');
        }

        return DB::transaction(function () use ($company, $salesOrder, $actor): SalesOrder {
            $order = SalesOrder::query()->lockForUpdate()->findOrFail($salesOrder->id);
            if (! in_array($order->status, ['draft', 'pending_approval', 'approved'], true) || ! self::untouched($order)) {
                throw ValidationException::withMessages(['sales_order' => 'Only orders with nothing delivered or invoiced can be cancelled.']);
            }
            $order->approvalRequests()->where('status', ApprovalStatus::Pending->value)
                ->update(['status' => ApprovalStatus::Cancelled->value, 'completed_at' => now()]);
            $before = $order->status;
            $order->update(['status' => SalesOrderStatus::Cancelled->value]);
            app(AuditLogService::class)->record($company, 'sales.order.cancelled', $order, changes: [
                'status' => ['old' => $before, 'new' => SalesOrderStatus::Cancelled->value],
            ], actor: $actor);

            return $order->fresh();
        });
    }

    /** Remove a draft or cancelled order with no approval, delivery or invoice history. */
    public function deleteSalesOrder(SalesOrder $salesOrder, User $actor): void
    {
        $company = $this->companyContext->requireActiveCompany();
        if ((int) $salesOrder->company_id !== (int) $company->id) {
            throw new AuthorizationException('Sales order does not belong to the active company.');
        }

        DB::transaction(function () use ($company, $salesOrder, $actor): void {
            $order = SalesOrder::query()->lockForUpdate()->findOrFail($salesOrder->id);
            if (! self::deletable($order)) {
                throw ValidationException::withMessages(['sales_order' => 'This order has approval, delivery or invoice history, so it is kept. Cancel it instead.']);
            }
            app(AuditLogService::class)->record($company, 'sales.order.deleted', $order, changes: [
                'before' => $order->only(['document_number', 'customer_id', 'quotation_id', 'status', 'total']),
            ], actor: $actor);
            $order->lines()->delete();
            $order->delete();
        });
    }

    public static function untouched(SalesOrder $order): bool
    {
        return ! $order->deliveries()->exists()
            && ! $order->invoices()->exists()
            && $order->invoice_id === null;
    }

    public static function deletable(SalesOrder $order): bool
    {
        return in_array($order->status, ['draft', 'cancelled'], true)
            && self::untouched($order)
            && ! $order->approvalRequests()->exists();
    }

    /** Where delivered goods go: the company's customer location, made in the source warehouse the first time. */
    private function customerLocation(StockLocation $source): StockLocation
    {
        return StockLocation::query()->where('usage', 'customer')->where('is_active', true)
            ->orderByRaw('CASE WHEN warehouse_id = ? THEN 0 ELSE 1 END', [$source->warehouse_id])
            ->orderBy('id')
            ->first()
            ?? StockLocation::query()->firstOrCreate(
                ['warehouse_id' => $source->warehouse_id, 'code' => 'CUSTOMERS'],
                ['company_id' => $source->company_id, 'name' => 'Customers', 'usage' => 'customer', 'is_active' => true],
            );
    }

    private function trimZeros(string $value): string
    {
        return str_contains($value, '.') ? rtrim(rtrim($value, '0'), '.') : $value;
    }

    public function submitSalesOrder(SalesOrder $salesOrder, User $actor): SalesOrder
    {
        $company = $this->companyContext->requireActiveCompany();
        if ((int) $salesOrder->company_id !== (int) $company->id) {
            throw new AuthorizationException('Sales order does not belong to the active company.');
        }
        if ($salesOrder->status !== SalesOrderStatus::Draft->value) {
            throw ValidationException::withMessages(['sales_order' => 'Only draft sales orders can be submitted.']);
        }
        return DB::transaction(function () use ($salesOrder, $actor): SalesOrder {
            $salesOrder->update(['status' => 'pending_approval', 'submitted_at' => now()]);
            try {
                app(ApprovalWorkflowService::class)->submit($salesOrder, $actor, (string) $salesOrder->total, $salesOrder->currency_code);
            } catch (\LogicException $exception) {
                throw ValidationException::withMessages(['approval' => __($exception->getMessage())]);
            }
            return $salesOrder->fresh();
        });
    }

    public function confirmSalesOrder(SalesOrder $salesOrder): SalesOrder
    {
        $company = $this->companyContext->requireActiveCompany();

        if ($salesOrder->company_id !== $company->id) {
            throw new AuthorizationException('Sales order does not belong to the active company.');
        }

        if ($salesOrder->status !== SalesOrderStatus::Approved->value) {
            throw ValidationException::withMessages(['sales_order' => 'Only approved sales orders can be confirmed.']);
        }

        return DB::transaction(function () use ($salesOrder): SalesOrder {
            // In a real implementation, this would check stock availability and reserve items.
            // For now, we just fire the event to create a project and notify inventory.
            event(new SalesOrderConfirmed($salesOrder));

            return $salesOrder->fresh(['lines']);
        });
    }
}
