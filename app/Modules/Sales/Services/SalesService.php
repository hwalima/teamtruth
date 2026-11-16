<?php

namespace App\Modules\Sales\Services;

use App\Modules\Core\Services\CompanyContext;
use App\Modules\Core\Services\SequenceService;
use App\Models\User;
use App\Modules\Core\Services\ApprovalWorkflowService;
use App\Modules\Core\Services\AuditLogService;
use App\Modules\Invoicing\Models\Customer;
use App\Modules\Invoicing\Services\InvoicingService;
use App\Modules\Sales\Models\SalesTeam;
use App\Modules\Sales\Enums\LeadStatus;
use App\Modules\Sales\Enums\OpportunityStatus;
use App\Modules\Sales\Enums\QuotationStatus;
use App\Modules\Sales\Enums\SalesOrderStatus;
use App\Modules\Sales\Events\SalesOrderConfirmed;
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
                'created_by' => $actor->id,
            ]);
            foreach ($data['lines'] as $index => $line) {
                $product = ! empty($line['product_id']) ? \App\Modules\Inventory\Models\InventoryProduct::query()->findOrFail($line['product_id']) : null;
                $this->assertSameCompany($company->id, $product);
                QuotationLine::query()->create([
                    'company_id' => $company->id, 'quotation_id' => $quotation->id,
                    'product_id' => $product?->id, 'description' => $line['description'],
                    'quantity' => $line['quantity'], 'unit_price' => $line['unit_price'],
                    'discount' => $line['discount'] ?? 0, 'tax_rate' => $line['tax_rate'] ?? 0,
                    'notes' => $line['notes'] ?? null, 'sort_order' => $line['sort_order'] ?? $index + 1,
                ]);
            }
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
        return DB::transaction(function () use ($quotation, $actor): Quotation {
            $quotation->update(['status' => 'pending_approval', 'submitted_at' => now()]);
            app(ApprovalWorkflowService::class)->submit($quotation, $actor, (string) $quotation->total, $quotation->currency_code);
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
            $order = SalesOrder::query()->with('lines')->lockForUpdate()->findOrFail($salesOrder->id);
            if ($order->status !== SalesOrderStatus::Approved->value) {
                throw ValidationException::withMessages(['sales_order' => 'Only approved sales orders can be invoiced.']);
            }
            if ($order->invoice_id !== null) {
                return \App\Modules\Invoicing\Models\Invoice::query()->findOrFail($order->invoice_id);
            }
            $invoice = app(InvoicingService::class)->createInvoice($actor, [
                'customer_id' => $order->customer_id,
                'type' => 'invoice',
                'invoice_date' => now()->toDateString(),
                'currency_code' => $order->currency_code,
                'notes' => 'Created from sales order '.$order->document_number,
            ], $order->lines->map(fn (SalesOrderLine $line): array => [
                'product_id' => $line->product_id,
                'name' => $line->description,
                'description' => $line->notes,
                'quantity' => $line->quantity,
                'unit_price' => $line->unit_price,
                'discount_percent' => $line->discount,
                'tax_rate' => $line->tax_rate,
            ])->all());
            $order->update(['invoice_id' => $invoice->id]);
            app(AuditLogService::class)->record($company, 'sales.order.invoiced', $order, changes: ['invoice_id' => ['new' => $invoice->id]], actor: $actor);
            return $invoice;
        });
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
            app(ApprovalWorkflowService::class)->submit($salesOrder, $actor, (string) $salesOrder->total, $salesOrder->currency_code);
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
