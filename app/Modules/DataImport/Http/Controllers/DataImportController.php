<?php

namespace App\Modules\DataImport\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Accounting\Models\AccountingAccount;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\DataImport\Models\DataImport;
use App\Modules\DataImport\Services\DataImportService;
use App\Modules\DataImport\Services\DataImportUndoService;
use App\Modules\Inventory\Models\StockLocation;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class DataImportController extends Controller
{
    public function __construct(private DataImportService $imports) {}

    public function index(Request $request): Response
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        abort_unless($this->imports->canImportAnything($company, $request->user()), 403, 'You do not have permission to import any kind of record.');

        return Inertia::render('Erp/DataImport/Index', [
            'company' => $company->only(['id', 'code', 'name']),
            'models' => $this->imports->models(),
            'locations' => StockLocation::query()
                ->with('warehouse:id,code,name')
                ->where('usage', 'internal')
                ->where('is_active', true)
                ->orderBy('warehouse_id')
                ->orderBy('code')
                ->get(['id', 'warehouse_id', 'code', 'name'])
                ->map(fn (StockLocation $location) => [
                    'id' => $location->id,
                    'label' => trim(($location->warehouse?->name ?? '').' / '.$location->name, ' /'),
                ]),
            'accounts' => AccountingAccount::query()
                ->where('is_active', true)
                ->where('is_group', false)
                ->orderBy('code')
                ->get(['id', 'code', 'name', 'account_type'])
                ->map(fn (AccountingAccount $account) => ['id' => $account->id, 'label' => $account->code.' · '.$account->name, 'type' => $account->account_type]),
            'imports' => DataImport::query()
                ->with(['creator:id,name', 'importer:id,name'])
                ->latest('id')
                ->limit(100)
                ->get()
                ->map(fn (DataImport $import) => $this->listItem($import)),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        $validated = $request->validate([
            'file' => ['required', 'file', 'max:51200', 'mimes:xlsx,xls,csv,txt,ods'],
            'model' => ['nullable', Rule::in(array_keys($this->imports->models()))],
            'import_stock' => ['nullable', 'boolean'],
            'location_id' => ['nullable', 'integer', Rule::exists('stock_locations', 'id')->where('company_id', $company->id)->where('usage', 'internal')],
            'update_existing' => ['nullable', 'boolean'],
            'reference_as_sku' => ['nullable', 'boolean'],
            'create_as' => ['nullable', Rule::in(['auto', 'vendor', 'customer', 'both'])],
            'name_order' => ['nullable', Rule::in(['last_first', 'first_last'])],
            'deduction_account_id' => ['nullable', 'integer', Rule::exists('accounting_accounts', 'id')->where('company_id', $company->id)->where('is_group', 0)],
        ]);

        $options = array_filter([
            'import_stock' => $request->boolean('import_stock', true),
            'location_id' => $validated['location_id'] ?? null,
            'update_existing' => $request->boolean('update_existing', true),
            'reference_as_sku' => $request->boolean('reference_as_sku'),
            'create_as' => $validated['create_as'] ?? 'auto',
            'name_order' => $validated['name_order'] ?? 'last_first',
            'deduction_account_id' => $validated['deduction_account_id'] ?? null,
        ], fn ($value) => $value !== null);

        $import = $this->imports->upload($company, $request->user(), $validated['file'], $validated['model'] ?? null, $options);

        return redirect()->route('erp.data-import.show', $import)->with('success', 'Preview ready. Nothing has been saved yet: check it, then confirm.');
    }

    public function show(Request $request, DataImport $import): Response
    {
        $this->belongs($import);
        $action = $request->string('action')->toString();
        $search = trim($request->string('search')->toString());

        $rows = $import->rows()
            ->when($action !== '', fn ($query) => $query->where('action', $action))
            ->when($action === '' && $request->boolean('messages'), fn ($query) => $query->whereNotNull('messages'))
            ->when($search !== '', fn ($query) => $query->where('data', 'like', '%'.str_replace(['%', '_'], ['\%', '\_'], $search).'%'))
            ->paginate(50)
            ->withQueryString()
            ->through(fn ($row) => [
                'id' => $row->id,
                'row_number' => $row->row_number,
                'action' => $row->action,
                'messages' => $row->messages ?? [],
                'record_id' => $row->record_id,
                'data' => collect($row->data)->filter(fn ($value) => $value !== null)->map(fn ($value) => is_string($value) && strlen($value) > 200 ? mb_substr($value, 0, 200).'…' : $value),
            ]);

        return Inertia::render('Erp/DataImport/Show', [
            'company' => app(CompanyContext::class)->requireActiveCompany()->only(['id', 'code', 'name']),
            'import' => [
                ...$this->listItem($import->load(['creator:id,name', 'importer:id,name'])),
                'options' => $import->options ?? [],
                'columns' => $import->columns ?? [],
                'summary' => $import->summary ?? [],
            ],
            'rows' => $rows,
            'filters' => ['action' => $action, 'search' => $search, 'messages' => $request->boolean('messages')],
        ]);
    }

    public function commit(Request $request, DataImport $import): RedirectResponse
    {
        $this->belongs($import);
        $this->imports->commit($import, $request->user());

        return redirect()->route('erp.data-import.show', $import)->with('success', 'Imported.');
    }

    public function undo(Request $request, DataImport $import): RedirectResponse
    {
        $this->belongs($import);
        $removed = app(DataImportUndoService::class)->undo($import, $request->user());
        $list = collect($removed)->map(fn ($count, $kind) => "{$count} {$kind}")->implode(', ');

        return redirect()->route('erp.data-import.show', $import)->with('success', 'Import undone'.($list ? ": removed {$list}." : '.'));
    }

    public function preview(Request $request, DataImport $import): RedirectResponse
    {
        $this->belongs($import);
        abort_if($import->status === DataImport::IMPORTED, 422, 'This file has already been imported.');
        $this->imports->preview($import, $request->user());

        return redirect()->route('erp.data-import.show', $import)->with('success', 'Preview refreshed.');
    }

    public function download(DataImport $import): StreamedResponse
    {
        $this->belongs($import);

        return Storage::disk('local')->download($import->file_path, $import->file_name);
    }

    private function belongs(DataImport $import): void
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        abort_unless((int) $import->company_id === (int) $company->id, 404);
        $this->imports->authorize($company, request()->user(), $this->imports->importer($import->model), $import->options ?? []);
    }

    private function listItem(DataImport $import): array
    {
        return [
            'id' => $import->id,
            'model' => $import->model,
            'label' => $this->imports->models()[$import->model] ?? $import->model,
            'file_name' => $import->file_name,
            'status' => $import->status,
            'total_rows' => $import->total_rows,
            'actions' => $import->summary['actions'] ?? [],
            'created_by' => $import->creator?->name,
            'imported_by' => $import->importer?->name,
            'created_at' => $import->created_at?->toDateTimeString(),
            'imported_at' => $import->imported_at?->toDateTimeString(),
        ];
    }
}
