<?php

namespace App\Modules\Requisitions\Services;

use App\Modules\Core\Models\Company;
use App\Modules\Requisitions\Models\Requisition;
use App\Modules\Requisitions\Models\RequisitionLine;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

class RequisitionReportService
{
    /**
     * Report: Requisitions pending by approver.
     * Returns a collection grouped by approver with counts and totals.
     */
    public function pendingByApprover(Company $company, ?string $from = null, ?string $to = null): Collection
    {
        $query = Requisition::query()
            ->where('company_id', $company->id)
            ->whereIn('status', ['in_approval', 'returned'])
            ->with(['requester:id,name', 'approvalRequests' => fn ($q) => $q->whereIn('status', ['pending', 'returned'])->with('actions.actor:id,name')]);

        if ($from) {
            $query->whereDate('created_at', '>=', $from);
        }
        if ($to) {
            $query->whereDate('created_at', '<=', $to);
        }

        $requisitions = $query->get();

        $byApprover = $requisitions->groupBy(function (Requisition $req) {
            $approval = $req->approvalRequests()->whereIn('status', ['pending', 'returned'])->latest()->first();
            $currentAction = $approval?->actions()->whereNull('acted_at')->first();
            return $currentAction?->actor?->name ?? 'No Approver Assigned';
        });

        return $byApprover->map(function ($reqs, $approver) {
            return [
                'approver' => $approver,
                'count' => $reqs->count(),
                'total_estimated' => $reqs->sum('estimated_total'),
                'requisitions' => $reqs->map(fn (Requisition $r) => [
                    'id' => $r->id,
                    'document_number' => $r->document_number,
                    'type' => $r->requisition_type,
                    'type_label' => Requisition::TYPES[$r->requisition_type] ?? $r->requisition_type,
                    'requester' => $r->requester->name ?? 'N/A',
                    'department' => $r->department,
                    'estimated_total' => $r->estimated_total,
                    'currency_code' => $r->currency_code,
                    'submitted_at' => $r->submitted_at?->format('Y-m-d'),
                    'days_pending' => $r->submitted_at ? $r->submitted_at->diffInDays(now()) : 0,
                    'current_step' => $r->approvalRequests()->whereIn('status', ['pending', 'returned'])->latest()->first()?->currentStep?->name ?? 'N/A',
                ])->values(),
            ];
        })->values();
    }

    /**
     * Report: Ageing analysis of requisitions.
     * Shows how long requisitions have been in each status.
     */
    public function ageing(Company $company, ?string $from = null, ?string $to = null): array
    {
        $query = Requisition::query()
            ->where('company_id', $company->id)
            ->with(['requester:id,name']);

        if ($from) {
            $query->whereDate('created_at', '>=', $from);
        }
        if ($to) {
            $query->whereDate('created_at', '<=', $to);
        }

        $requisitions = $query->get();

        $buckets = [
            '0-3 days' => 0,
            '4-7 days' => 0,
            '8-14 days' => 0,
            '15-30 days' => 0,
            '31-60 days' => 0,
            '60+ days' => 0,
        ];

        $details = [];

        foreach ($requisitions as $req) {
            $submittedAt = $req->submitted_at ?? $req->created_at;
            $days = $submittedAt->diffInDays(now());

            $bucket = match (true) {
                $days <= 3 => '0-3 days',
                $days <= 7 => '4-7 days',
                $days <= 14 => '8-14 days',
                $days <= 30 => '15-30 days',
                $days <= 60 => '31-60 days',
                default => '60+ days',
            };

            $buckets[$bucket]++;

            $details[] = [
                'id' => $req->id,
                'document_number' => $req->document_number,
                'type' => $req->requisition_type,
                'type_label' => Requisition::TYPES[$req->requisition_type] ?? $req->requisition_type,
                'status' => $req->status->value,
                'requester' => $req->requester->name ?? 'N/A',
                'department' => $req->department,
                'estimated_total' => $req->estimated_total,
                'currency_code' => $req->currency_code,
                'submitted_at' => $submittedAt->format('Y-m-d'),
                'days_pending' => $days,
                'ageing_bucket' => $bucket,
            ];
        }

        return [
            'summary' => $buckets,
            'details' => $details,
        ];
    }

    /**
     * Report: Spend by department.
     * Aggregates requisition totals by department and status.
     */
    public function spendByDepartment(Company $company, ?string $from = null, ?string $to = null): Collection
    {
        $query = Requisition::query()
            ->where('company_id', $company->id)
            ->whereNotNull('department')
            ->with(['requester:id,name']);

        if ($from) {
            $query->whereDate('created_at', '>=', $from);
        }
        if ($to) {
            $query->whereDate('created_at', '<=', $to);
        }

        $requisitions = $query->get();

        return $requisitions->groupBy('department')->map(function ($reqs, $dept) {
            $byStatus = $reqs->groupBy('status')->map(function ($statusReqs) {
                return [
                    'count' => $statusReqs->count(),
                    'total' => $statusReqs->sum('estimated_total'),
                ];
            });

            return [
                'department' => $dept,
                'total_count' => $reqs->count(),
                'total_estimated' => $reqs->sum('estimated_total'),
                'by_status' => $byStatus,
                'requisitions' => $reqs->map(fn (Requisition $r) => [
                    'id' => $r->id,
                    'document_number' => $r->document_number,
                    'type' => $r->requisition_type,
                    'type_label' => Requisition::TYPES[$r->requisition_type] ?? $r->requisition_type,
                    'status' => $r->status->value,
                    'requester' => $r->requester->name ?? 'N/A',
                    'estimated_total' => $r->estimated_total,
                    'currency_code' => $r->currency_code,
                    'submitted_at' => $r->submitted_at?->format('Y-m-d'),
                ])->values(),
            ];
        })->values();
    }

    /**
     * Report: Turnaround time (submission to approval/rejection).
     * Calculates average, min, max days for completed requisitions.
     */
    public function turnaroundTime(Company $company, ?string $from = null, ?string $to = null): array
    {
        $query = Requisition::query()
            ->where('company_id', $company->id)
            ->whereIn('status', ['approved', 'rejected', 'cancelled'])
            ->whereNotNull('submitted_at')
            ->with(['requester:id,name', 'approvalRequests' => fn ($q) => $q->whereIn('status', ['approved', 'rejected', 'cancelled'])->latest()]);

        if ($from) {
            $query->whereDate('submitted_at', '>=', $from);
        }
        if ($to) {
            $query->whereDate('submitted_at', '<=', $to);
        }

        $requisitions = $query->get();

        $turnarounds = [];
        $details = [];

        foreach ($requisitions as $req) {
            $approval = $req->approvalRequests()->whereIn('status', ['approved', 'rejected', 'cancelled'])->latest()->first();
            $completedAt = $approval?->completed_at ?? $req->updated_at;

            if (! $approval || ! $req->submitted_at) {
                continue;
            }

            $days = $req->submitted_at->diffInDays($completedAt);

            $turnarounds[] = $days;

            $details[] = [
                'id' => $req->id,
                'document_number' => $req->document_number,
                'type' => $req->requisition_type,
                'type_label' => Requisition::TYPES[$req->requisition_type] ?? $req->requisition_type,
                'status' => $req->status->value,
                'requester' => $req->requester->name ?? 'N/A',
                'department' => $req->department,
                'estimated_total' => $req->estimated_total,
                'currency_code' => $req->currency_code,
                'submitted_at' => $req->submitted_at->format('Y-m-d'),
                'completed_at' => $completedAt->format('Y-m-d'),
                'turnaround_days' => $days,
            ];
        }

        $count = count($turnarounds);
        $avg = $count > 0 ? array_sum($turnarounds) / $count : 0;
        $min = $count > 0 ? min($turnarounds) : 0;
        $max = $count > 0 ? max($turnarounds) : 0;

        return [
            'summary' => [
                'count' => $count,
                'average_days' => round($avg, 1),
                'min_days' => $min,
                'max_days' => $max,
            ],
            'details' => $details,
        ];
    }
}