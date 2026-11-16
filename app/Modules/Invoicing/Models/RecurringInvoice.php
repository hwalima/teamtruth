<?php

namespace App\Modules\Invoicing\Models;

use App\Models\Currency;
use App\Modules\Core\Models\Concerns\BelongsToCompany;
use App\Modules\Core\Models\Company;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class RecurringInvoice extends Model
{
    use BelongsToCompany, SoftDeletes;

    protected $table = 'inv_recurring_invoices';

    protected $fillable = [
        'company_id',
        'name',
        'customer_id',
        'payment_term_id',
        'currency_code',
        'frequency',
        'interval',
        'start_date',
        'end_date',
        'next_run_date',
        'max_occurrences',
        'occurrences_count',
        'status',
        'template_data',
        'notes',
        'terms',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'end_date' => 'date',
            'next_run_date' => 'date',
            'max_occurrences' => 'integer',
            'occurrences_count' => 'integer',
            'interval' => 'integer',
            'template_data' => 'array',
        ];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function paymentTerm(): BelongsTo
    {
        return $this->belongsTo(PaymentTerm::class);
    }

    public function getCurrency(): ?Currency
    {
        return Currency::where('code', $this->currency_code)->first();
    }

    public function isDue(): bool
    {
        if ($this->status !== 'active') {
            return false;
        }

        $today = \Carbon\CarbonImmutable::today();
        $nextRun = \Carbon\CarbonImmutable::parse($this->next_run_date);

        if ($nextRun->gt($today)) {
            return false;
        }

        if ($this->end_date && $nextRun->gt($this->end_date)) {
            return false;
        }

        if ($this->max_occurrences && $this->occurrences_count >= $this->max_occurrences) {
            return false;
        }

        return true;
    }

    public function calculateNextRunDate(): void
    {
        $current = \Carbon\CarbonImmutable::parse($this->next_run_date);
        $next = $current->copy();

        switch ($this->frequency) {
            case 'daily':
                $next = $next->addDays($this->interval);
                break;
            case 'weekly':
                $next = $next->addWeeks($this->interval);
                break;
            case 'monthly':
                $next = $next->addMonths($this->interval);
                break;
            case 'quarterly':
                $next = $next->addMonths(3 * $this->interval);
                break;
            case 'yearly':
                $next = $next->addYears($this->interval);
                break;
        }

        $this->next_run_date = $next->toDateString();
    }

    public function incrementOccurrence(): void
    {
        $this->occurrences_count++;

        if ($this->max_occurrences && $this->occurrences_count >= $this->max_occurrences) {
            $this->status = 'completed';
        } elseif ($this->end_date && \Carbon\CarbonImmutable::parse($this->next_run_date)->gt($this->end_date)) {
            $this->status = 'completed';
        } else {
            $this->calculateNextRunDate();
        }

        $this->save();
    }

    public function getTemplateInvoice(): array
    {
        return array_merge([
            'currency_code' => $this->currency_code,
            'notes' => $this->notes,
            'terms' => $this->terms,
        ], $this->template_data ?? []);
    }
}