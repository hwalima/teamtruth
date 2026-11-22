<?php

namespace App\Modules\DataImport\Services\Odoo;

use App\Modules\DataImport\Services\ImportContext;
use Illuminate\Validation\ValidationException;

/**
 * Odoo contacts (res.partner) become vendors, customers or both.
 *
 * "auto" follows Odoo: a contact with supplier_rank > 0 is a vendor, with
 * customer_rank > 0 a customer. A file without those columns is read as vendors.
 */
class ContactImporter extends OdooImporter
{
    public function __construct(private Partners $partners) {}

    public function model(): string
    {
        return Partners::MODEL;
    }

    public function label(): string
    {
        return 'Contacts (vendors & customers)';
    }

    public function permissions(): array
    {
        return ['erp.purchase.manage'];
    }

    /** Creating customers needs invoicing rights as well. */
    public function permissionsFor(array $options): array
    {
        return in_array($options['create_as'] ?? 'auto', ['auto', 'customer', 'both'], true)
            ? ['erp.purchase.manage', 'erp.invoicing.manage']
            : ['erp.purchase.manage'];
    }

    public function aliases(): array
    {
        return [
            'id' => ['id', 'External ID', 'ID'],
            'name' => ['name', 'Name', 'Display Name', 'display_name', 'complete_name'],
            'parent' => ['parent_id', 'Related Company', 'Company Name'],
            'is_company' => ['is_company', 'Is a Company'],
            'ref' => ['ref', 'Reference', 'Internal Reference'],
            'email' => ['email', 'Email'],
            'phone' => ['phone', 'Phone'],
            'mobile' => ['mobile', 'Mobile'],
            'street' => ['street', 'Street'],
            'street2' => ['street2', 'Street2', 'Street 2'],
            'city' => ['city', 'City'],
            'state' => ['state_id', 'State'],
            'zip' => ['zip', 'Zip'],
            'country' => ['country_id', 'Country'],
            'vat' => ['vat', 'Tax ID', 'VAT', 'TIN'],
            'customer_rank' => ['customer_rank', 'Customer Rank'],
            'supplier_rank' => ['supplier_rank', 'Supplier Rank', 'Vendor Rank'],
            'currency' => ['property_purchase_currency_id', 'Supplier Currency', 'currency_id', 'Currency'],
            'customer_terms' => ['property_payment_term_id', 'Customer Payment Terms'],
            'vendor_terms' => ['property_supplier_payment_term_id', 'Vendor Payment Terms'],
            'credit_limit' => ['credit_limit', 'Credit Limit'],
            'active' => ['active', 'Active'],
        ];
    }

    public function run(ImportContext $context, array $rows, array $columns): void
    {
        $mode = $context->option('create_as', 'auto');

        foreach ($rows as $row) {
            $rowNumber = $row['row_number'];
            $data = $row['data'];
            $name = $this->text($data, $columns, 'name', 255);
            if ($name === null) {
                $context->row($rowNumber, 'skipped', ['No name.']);

                continue;
            }

            if ($this->text($data, $columns, 'parent') !== null && $this->flag($data, $columns, 'is_company') !== true) {
                $context->row($rowNumber, 'skipped', ['A contact person at '.$this->text($data, $columns, 'parent').'; only the company itself is imported.']);

                continue;
            }

            [$asVendor, $asCustomer] = $this->roles($mode, $data, $columns);
            if (! $asVendor && ! $asCustomer) {
                $context->row($rowNumber, 'skipped', ['Neither a vendor nor a customer in Odoo (no purchases or sales).']);

                continue;
            }

            try {
                $this->importContact($context, $rowNumber, $data, $columns, $name, $asVendor, $asCustomer);
            } catch (ValidationException $e) {
                $context->row($rowNumber, 'error', collect($e->errors())->flatten()->all());
            }
        }
    }

    private function roles(string $mode, array $data, array $columns): array
    {
        if ($mode === 'vendor') {
            return [true, false];
        }
        if ($mode === 'customer') {
            return [false, true];
        }
        if ($mode === 'both') {
            return [true, true];
        }

        $hasRanks = isset($columns['customer_rank']) || isset($columns['supplier_rank']);
        if (! $hasRanks) {
            return [true, false];
        }

        return [
            ($this->number($data, $columns, 'supplier_rank') ?? 0) > 0,
            ($this->number($data, $columns, 'customer_rank') ?? 0) > 0,
        ];
    }

    private function importContact(ImportContext $context, int $rowNumber, array $data, array $columns, string $name, bool $asVendor, bool $asCustomer): void
    {
        $odooId = $this->text($data, $columns, 'id');
        $ref = $this->text($data, $columns, 'ref', 40);
        $address = $this->address($data, $columns);
        $phone = $this->text($data, $columns, 'phone', 100) ?? $this->text($data, $columns, 'mobile', 100);
        $currency = $this->currency($this->text($data, $columns, 'currency'));
        $common = [
            'tax_no' => $this->text($data, $columns, 'vat', 100),
            'email' => $this->email($this->text($data, $columns, 'email', 255)),
            'phone' => $phone,
            'is_active' => $this->flag($data, $columns, 'active', true),
        ];

        $records = [];
        $actions = [];
        if ($asVendor) {
            $existed = $context->find(Partners::MODEL.':vendor', $odooId) !== null;
            $records[] = $vendor = $this->partners->vendor($context, $name, $odooId, [
                ...$common,
                'address' => $address,
                'currency_code' => $currency,
                'payment_terms_days' => $this->days($this->text($data, $columns, 'vendor_terms')),
            ], $ref);
            $actions[] = $existed || ! $vendor->wasRecentlyCreated ? 'updated' : 'created';
        }
        if ($asCustomer) {
            $existed = $context->find(Partners::MODEL.':customer', $odooId) !== null;
            $records[] = $customer = $this->partners->customer($context, $name, $odooId, [
                ...$common,
                'billing_address' => $address,
                'shipping_address' => $address,
                'currency_code' => $currency,
                'credit_limit' => $this->number($data, $columns, 'credit_limit'),
                'metadata' => ['odoo' => array_filter($data, fn ($value) => $value !== null)],
            ], $ref);
            $actions[] = $existed || ! $customer->wasRecentlyCreated ? 'updated' : 'created';
        }

        $messages = [];
        if ($common['email'] === null && $this->text($data, $columns, 'email') !== null) {
            $messages[] = 'The email address "'.$this->text($data, $columns, 'email').'" is not valid and was left off.';
        }
        $roles = implode(' and ', array_filter([$asVendor ? 'vendor' : null, $asCustomer ? 'customer' : null]));
        $messages[] = "Imported as {$roles}.";

        $context->row($rowNumber, in_array('created', $actions, true) ? 'created' : 'updated', $messages, $records[0]);
    }

    private function address(array $data, array $columns): ?string
    {
        $cityLine = implode(' ', array_filter([$this->text($data, $columns, 'city'), $this->text($data, $columns, 'zip')]));
        $lines = array_filter([
            $this->text($data, $columns, 'street'),
            $this->text($data, $columns, 'street2'),
            $cityLine ?: null,
            $this->text($data, $columns, 'state'),
            $this->text($data, $columns, 'country'),
        ]);

        return $lines === [] ? null : implode("\n", $lines);
    }

    private function email(?string $email): ?string
    {
        return $email !== null && filter_var($email, FILTER_VALIDATE_EMAIL) ? $email : null;
    }

    private function currency(?string $currency): ?string
    {
        return $currency !== null && preg_match('/^[A-Za-z]{3}$/', $currency) ? strtoupper($currency) : null;
    }

    /** "30 Days", "Immediate Payment", "End of Following Month" → days. */
    private function days(?string $terms): ?int
    {
        if ($terms === null) {
            return null;
        }
        if (preg_match('/(\d+)/', $terms, $match)) {
            return min((int) $match[1], 65535);
        }

        return str_contains(mb_strtolower($terms), 'immediate') ? 0 : null;
    }
}
