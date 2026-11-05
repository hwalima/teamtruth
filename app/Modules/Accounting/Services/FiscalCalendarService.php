<?php

namespace App\Modules\Accounting\Services;

use App\Models\User;
use App\Modules\Accounting\Models\FiscalPeriod;
use App\Modules\Accounting\Models\FiscalYear;
use App\Modules\Core\Services\AuditLogService;
use App\Modules\Core\Services\CompanyContext;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class FiscalCalendarService
{
    public function createFiscalYear(
        User $actor,
        string $name,
        string $startsOn,
        string $endsOn,
    ): FiscalYear {
        $company = app(CompanyContext::class)->requireActiveCompany();
        $start = CarbonImmutable::parse($startsOn)->startOfDay();
        $end = CarbonImmutable::parse($endsOn)->startOfDay();

        return DB::transaction(function () use ($company, $actor, $name, $start, $end): FiscalYear {
            $overlaps = FiscalYear::query()
                ->whereDate('starts_on', '<=', $end->toDateString())
                ->whereDate('ends_on', '>=', $start->toDateString())
                ->exists();
            if ($overlaps) {
                throw ValidationException::withMessages([
                    'starts_on' => __('Fiscal years cannot overlap.'),
                ]);
            }

            $year = FiscalYear::query()->create([
                'company_id' => $company->id,
                'name' => $name,
                'starts_on' => $start->toDateString(),
                'ends_on' => $end->toDateString(),
                'status' => 'open',
            ]);

            $periodStart = $start;
            $periodNumber = 1;
            while ($periodStart <= $end) {
                $periodEnd = $start->addMonthsNoOverflow($periodNumber)->subDay();
                if ($periodEnd > $end) {
                    $periodEnd = $end;
                }
                FiscalPeriod::query()->create([
                    'company_id' => $company->id,
                    'fiscal_year_id' => $year->id,
                    'name' => sprintf('%s %02d', $name, $periodNumber),
                    'starts_on' => $periodStart->toDateString(),
                    'ends_on' => $periodEnd->toDateString(),
                    'status' => 'open',
                ]);
                $periodStart = $periodEnd->addDay();
                $periodNumber++;
                if ($periodNumber > 25) {
                    throw ValidationException::withMessages([
                        'ends_on' => __('A fiscal year cannot contain more than 24 monthly periods.'),
                    ]);
                }
            }

            app(AuditLogService::class)->record(
                $company,
                'accounting.fiscal_year.created',
                $year,
                changes: ['after' => [
                    'name' => $year->name,
                    'starts_on' => $year->starts_on->toDateString(),
                    'ends_on' => $year->ends_on->toDateString(),
                    'period_count' => $periodNumber - 1,
                ]],
                actor: $actor,
            );

            return $year->load('periods');
        });
    }

    public function lockPeriod(FiscalPeriod $period, User $actor): FiscalPeriod
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        return DB::transaction(function () use ($company, $period, $actor): FiscalPeriod {
            $period = FiscalPeriod::query()->lockForUpdate()->findOrFail($period->id);
            if ($period->status === 'locked') {
                throw ValidationException::withMessages(['period' => __('This accounting period is already locked.')]);
            }

            $period->forceFill([
                'status' => 'locked',
                'locked_by' => $actor->id,
                'locked_at' => now(),
            ])->save();
            app(AuditLogService::class)->record(
                $company,
                'accounting.fiscal_period.locked',
                $period,
                changes: ['after' => ['status' => 'locked']],
                actor: $actor,
            );

            return $period;
        });
    }
}
