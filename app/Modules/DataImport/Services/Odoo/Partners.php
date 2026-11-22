<?php

namespace App\Modules\DataImport\Services\Odoo;

use App\Models\Currency;
use App\Modules\DataImport\Services\ImportContext;
use App\Modules\Invoicing\Models\Customer;
use App\Modules\Purchase\Models\PurchaseVendor;
use Illuminate\Database\Eloquent\Model;

/**
 * Finds or creates the vendor / customer an Odoo partner (res.partner) became.
 * A product file names vendors only by name; a contacts file brings their ID
 * and details. Both are remembered, so either file can come first.
 */
class Partners
{
    public const MODEL = 'res.partner';

    private array $codes = [];

    /** @param  array<string, mixed>  $details  vendor columns to set */
    public function vendor(ImportContext $context, string $name, ?string $odooId = null, array $details = [], ?string $code = null): PurchaseVendor
    {
        /** @var PurchaseVendor $vendor */
        $vendor = $this->find($context, PurchaseVendor::class, $name, $odooId)
            ?? PurchaseVendor::query()->whereRaw('lower(name) = ?', [OdooSheet::key($name)])->first();

        if (! $vendor) {
            $vendor = PurchaseVendor::query()->create([
                'code' => $this->code($context, PurchaseVendor::class, $code, 'V-', 4),
                'name' => mb_substr($name, 0, 255),
                'is_active' => true,
                'payment_terms_days' => 0,
                ...array_filter($details, fn ($value) => $value !== null),
            ]);
            $context->created('vendors', $vendor->name, $vendor);
        } elseif ($details !== []) {
            $vendor->fill(array_filter($details, fn ($value) => $value !== null))->save();
        }

        $this->remember($context, $vendor, $name, $odooId);

        return $vendor;
    }

    /** @param  array<string, mixed>  $details  customer columns to set */
    public function customer(ImportContext $context, string $name, ?string $odooId = null, array $details = [], ?string $code = null): Customer
    {
        /** @var Customer $customer */
        $customer = $this->find($context, Customer::class, $name, $odooId)
            ?? Customer::query()->whereRaw('lower(name) = ?', [OdooSheet::key($name)])->first();

        if (isset($details['currency_code']) && ! Currency::query()->where('code', $details['currency_code'])->exists()) {
            $context->warn("Currency {$details['currency_code']} is not set up, so customers using it were given the company currency.");
            unset($details['currency_code']);
        }

        if (! $customer) {
            $customer = Customer::query()->create([
                'code' => $this->code($context, Customer::class, $code, 'C-', 4),
                'name' => mb_substr($name, 0, 255),
                'currency_code' => $this->companyCurrency($context),
                'is_active' => true,
                'created_by' => $context->user->id,
                ...array_filter($details, fn ($value) => $value !== null),
            ]);
            $context->created('customers', $customer->name, $customer);
        } elseif ($details !== []) {
            $customer->fill([...array_filter($details, fn ($value) => $value !== null), 'updated_by' => $context->user->id])->save();
        }

        $this->remember($context, $customer, $name, $odooId);

        return $customer;
    }

    /** Odoo IDs and names are remembered per kind of record ("res.partner:vendor"). */
    private function find(ImportContext $context, string $class, string $name, ?string $odooId): ?Model
    {
        $model = $this->model($class);
        $record = $context->find($model, $odooId) ?? $context->find($model, 'name:'.OdooSheet::key($name));

        return $record instanceof $class ? $record : null;
    }

    private function remember(ImportContext $context, Model $record, string $name, ?string $odooId): void
    {
        $model = $this->model($record::class);
        $context->remember($model, $odooId, $record);
        $context->remember($model, 'name:'.OdooSheet::key($name), $record);
    }

    private function model(string $class): string
    {
        return self::MODEL.':'.($class === Customer::class ? 'customer' : 'vendor');
    }

    /** The Odoo reference when it is free, otherwise the next V-0001 / C-0001. */
    private function code(ImportContext $context, string $class, ?string $preferred, string $prefix, int $padding): string
    {
        $max = $class === Customer::class ? 50 : 40;
        $taken = fn (string $code) => $class::query()->withoutGlobalScopes()->where('company_id', $context->company->id)->where('code', $code)->exists();

        if ($preferred !== null && mb_strlen($preferred) <= $max && ! $taken($preferred)) {
            return $preferred;
        }

        $counter = $this->codes[$class] ??= (int) $class::query()->withoutGlobalScopes()->where('company_id', $context->company->id)->count();
        do {
            $code = $prefix.str_pad((string) ++$counter, $padding, '0', STR_PAD_LEFT);
        } while ($taken($code));
        $this->codes[$class] = $counter;

        return $code;
    }

    private function companyCurrency(ImportContext $context): string
    {
        $code = strtoupper((string) ($context->company->default_currency ?: 'USD'));

        return Currency::query()->where('code', $code)->exists()
            ? $code
            : (Currency::query()->where('is_default', true)->value('code') ?? Currency::query()->value('code') ?? 'USD');
    }
}
