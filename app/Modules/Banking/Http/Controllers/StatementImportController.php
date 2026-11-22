<?php

namespace App\Modules\Banking\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Banking\Models\StatementImport;
use App\Modules\Banking\Services\BankingAccess;
use App\Modules\Banking\Services\StatementImportService;
use App\Modules\Core\Services\CompanyContext;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class StatementImportController extends Controller
{
    public function __construct(
        private StatementImportService $imports,
        private CompanyContext $context,
    ) {}

    public function index(): Response
    {
        return Inertia::render('Erp/Banking/Imports/Index', [
            'imports' => StatementImport::query()
                ->with(['creator:id,name', 'importer:id,name'])
                ->where('company_id', $this->context->requireActiveCompany()->id)
                ->latest('id')
                ->limit(50)
                ->get()
                ->map(fn (StatementImport $import) => [
                    'id' => $import->id,
                    'filename' => $import->filename,
                    'status' => $import->status,
                    'sheets' => count($import->summary['sheets'] ?? []),
                    'lines' => collect($import->summary['sheets'] ?? [])->sum('line_count'),
                    'created_at' => $import->created_at?->toIso8601String(),
                    'imported_at' => $import->imported_at?->toIso8601String(),
                    'by' => $import->importer?->name ?? $import->creator?->name,
                ]),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate(['file' => ['required', 'file', 'max:20480', 'mimes:xlsx,xls,ods']]);
        $import = $this->imports->upload($this->context->requireActiveCompany(), $request->user(), $data['file']);

        return redirect()->route('erp.banking.imports.show', $import)->with('success', 'Preview ready. Nothing is saved until you confirm.');
    }

    public function show(Request $request, StatementImport $import, BankingAccess $access): Response
    {
        $this->belongs($import);
        $user = $request->user();

        return Inertia::render('Erp/Banking/Imports/Show', [
            'import' => [
                'id' => $import->id,
                'filename' => $import->filename,
                'status' => $import->status,
                'imported_at' => $import->imported_at?->toIso8601String(),
                'sheets' => $import->summary['sheets'] ?? [],
                'result' => $import->result,
            ],
            'plan' => $import->status === StatementImport::PREVIEW ? $this->imports->plan($import, $user) : [],
            'companies' => $access->companies($user, 'erp.banking.manage')->map->only(['id', 'code', 'name'])->values(),
        ]);
    }

    public function commit(Request $request, StatementImport $import): RedirectResponse
    {
        $this->belongs($import);
        $data = $request->validate([
            'choices' => ['required', 'array'],
            'choices.*.include' => ['required', 'boolean'],
            'choices.*.company' => ['required', 'string', 'max:20'],
        ]);
        $import = $this->imports->commit($import, $request->user(), $data['choices']);
        $result = $import->result;

        return redirect()->route('erp.banking.imports.show', $import)->with('success', sprintf(
            'Imported %d line(s) into %d account(s)%s.',
            collect($result['sheets'])->sum('lines'),
            count($result['sheets']),
            $result['companies_created'] ? ', and created '.count($result['companies_created']).' company(ies)' : '',
        ));
    }

    public function undo(Request $request, StatementImport $import): RedirectResponse
    {
        $this->belongs($import);
        try {
            $this->imports->undo($import, $request->user());
        } catch (ValidationException $exception) {
            return back()->with('error', collect($exception->errors())->flatten()->first());
        }

        return back()->with('success', 'Import undone: its lines and the accounts it opened were removed. Companies it created were kept.');
    }

    private function belongs(StatementImport $import): void
    {
        abort_unless((int) $import->company_id === (int) $this->context->requireActiveCompany()->id, 404);
    }
}
