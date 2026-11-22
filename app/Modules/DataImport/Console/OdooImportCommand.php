<?php

namespace App\Modules\DataImport\Console;

use App\Models\User;
use App\Modules\Core\Models\Company;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\DataImport\Models\DataImport;
use App\Modules\DataImport\Services\DataImportService;
use Illuminate\Console\Command;
use Illuminate\Validation\ValidationException;

/**
 * php artisan odoo:import "Product (product.template).xlsx" --company=TT --user=admin@example.com
 * Previews by default; add --commit to import. The import also shows under ERP > Data import.
 */
class OdooImportCommand extends Command
{
    protected $signature = 'odoo:import
        {file : The Odoo export (xlsx or csv)}
        {--company= : Company code or ID}
        {--user= : Email or ID of the user the import is recorded under}
        {--model= : product.template or res.partner (detected when left out)}
        {--location= : Stock location ID for opening stock (Main Warehouse when left out)}
        {--no-stock : Do not bring across quantities on hand}
        {--create-as=auto : Contacts: auto, vendor, customer or both}
        {--commit : Import for real instead of only previewing}';

    protected $description = 'Preview or import an Odoo export (products, contacts) into a company';

    public function handle(DataImportService $imports, CompanyContext $context): int
    {
        $file = $this->argument('file');
        if (! is_file($file)) {
            $this->error("File not found: {$file}");

            return self::FAILURE;
        }

        $company = Company::query()->where('code', $this->option('company'))->orWhere('id', $this->option('company'))->first();
        $user = User::query()->where('email', $this->option('user'))->orWhere('id', $this->option('user'))->first();
        if (! $company || ! $user) {
            $this->error('Give an existing --company (code or ID) and --user (email or ID).');

            return self::FAILURE;
        }
        $context->setActiveCompany($company);

        try {
            $import = $imports->fromPath($company, $user, $file, $this->option('model'), array_filter([
                'import_stock' => ! $this->option('no-stock'),
                'location_id' => $this->option('location') ? (int) $this->option('location') : null,
                'create_as' => $this->option('create-as'),
            ], fn ($value) => $value !== null));
            $this->report('Preview', $import);

            if ($this->option('commit')) {
                $import = $imports->commit($import, $user);
                $this->report('Imported', $import);
            } else {
                $this->line('Nothing was saved. Run again with --commit, or confirm import #'.$import->id.' in ERP > Data import.');
            }
        } catch (ValidationException $e) {
            foreach ($e->errors() as $messages) {
                foreach ($messages as $message) {
                    $this->error($message);
                }
            }

            return self::FAILURE;
        }

        return self::SUCCESS;
    }

    private function report(string $title, DataImport $import): void
    {
        $summary = $import->summary ?? [];
        $this->info("{$title}: import #{$import->id}, {$import->model}, {$import->total_rows} rows");
        foreach ($summary['actions'] ?? [] as $action => $count) {
            $this->line("  {$action}: {$count}");
        }
        foreach ($summary['created'] ?? [] as $kind => $names) {
            $this->line('  new '.$kind.': '.count($names));
        }
        foreach ($summary['totals'] ?? [] as $total => $value) {
            $this->line("  {$total}: {$value}");
        }
        foreach ($summary['warnings'] ?? [] as $warning) {
            $this->warn('  '.$warning);
        }
    }
}
