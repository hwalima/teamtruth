<?php

namespace App\Modules\Hrm\Http\Controllers;

use App\Modules\Hrm\Enums\DisciplinaryDocumentType;
use App\Modules\Hrm\Enums\DisciplinaryOutcome;
use App\Modules\Hrm\Enums\DisciplinaryStatus;
use App\Modules\Hrm\Enums\EmployeeStatus;
use App\Modules\Hrm\Models\DisciplinaryCase;
use App\Modules\Hrm\Models\DisciplinaryDocument;
use App\Modules\Hrm\Models\Employee;
use App\Modules\Hrm\Services\DisciplinaryService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class DisciplinaryCaseController extends HrmController
{
    public function __construct(private DisciplinaryService $cases) {}

    public function index(Request $request): Response
    {
        $canSeeAll = $this->allowsErpPermission('erp.hrm.disciplinary.view');
        $filters = $request->only(['search', 'status', 'outcome']);
        $ownEmployeeIds = Employee::query()->where('user_id', $request->user()->id)->pluck('id');

        $cases = DisciplinaryCase::query()
            ->with('employee:id,employee_number,first_name,middle_name,last_name')
            ->when(! $canSeeAll, fn ($q) => $q->whereIn('employee_id', $ownEmployeeIds))
            ->when($filters['search'] ?? null, fn ($q, $search) => $q->where(fn ($w) => $w
                ->where('case_number', 'like', "%{$search}%")
                ->orWhereHas('employee', fn ($e) => $e
                    ->where('first_name', 'like', "%{$search}%")
                    ->orWhere('last_name', 'like', "%{$search}%")
                    ->orWhere('employee_number', 'like', "%{$search}%"))))
            ->when($filters['status'] ?? null, fn ($q, $status) => $q->where('status', $status))
            ->when($filters['outcome'] ?? null, fn ($q, $outcome) => $q->where('outcome', $outcome))
            ->latest('incident_date')->latest('id')
            ->paginate(20)
            ->withQueryString();

        return Inertia::render('Erp/Hrm/Disciplinary/Index', [
            'company' => $this->company(),
            'cases' => $cases,
            'filters' => $filters,
            'statusOptions' => DisciplinaryStatus::options(),
            'outcomeOptions' => DisciplinaryOutcome::options(),
            'canManage' => $this->allowsErpPermission('erp.hrm.disciplinary.manage'),
            'seesAll' => $canSeeAll,
        ]);
    }

    public function create(Request $request): Response
    {
        return Inertia::render('Erp/Hrm/Disciplinary/Create', [
            'company' => $this->company(),
            'employees' => Employee::query()
                ->where('status', '!=', EmployeeStatus::Terminated)
                ->where(fn ($q) => $q->whereNull('user_id')->orWhere('user_id', '!=', $request->user()->id))
                ->orderBy('first_name')->orderBy('last_name')
                ->get(['id', 'employee_number', 'first_name', 'middle_name', 'last_name']),
            'employeeId' => $request->integer('employee_id') ?: null,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validateIncident($request, true);
        $own = Employee::query()->whereKey($data['employee_id'])->value('user_id') === $request->user()->id;
        abort_if($own, 403, 'You cannot open a disciplinary case against yourself.');

        $case = $this->cases->createCase($request->user(), $data);

        return redirect()->route('erp.hrm.disciplinary.show', $case)->with('success', "Case {$case->case_number} opened.");
    }

    public function show(DisciplinaryCase $case): Response
    {
        $this->authorize('view', $case);
        $case->load(['employee:id,employee_number,first_name,middle_name,last_name,user_id,department_id,position_id', 'employee.department:id,name', 'employee.position:id,name', 'reportedBy:id,name', 'documents' => fn ($q) => $q->latest()]);

        $canManage = $this->allows('update', $case);

        return Inertia::render('Erp/Hrm/Disciplinary/Show', [
            'company' => $this->company(),
            'disciplinaryCase' => $case,
            'statusOptions' => DisciplinaryStatus::options(),
            'outcomeOptions' => DisciplinaryOutcome::options(),
            'documentTypeOptions' => DisciplinaryDocumentType::options(),
            'appealDecisionOptions' => ['upheld' => 'Upheld (outcome stands)', 'overturned' => 'Overturned (no action)', 'reduced' => 'Reduced', 'increased' => 'Increased'],
            'warningMonths' => DisciplinaryService::WARNING_MONTHS,
            'appealDeadline' => $this->cases->appealDeadline($case)?->toDateString(),
            'canManage' => $canManage,
            'canAppeal' => $this->allows('appeal', $case),
        ]);
    }

    public function update(Request $request, DisciplinaryCase $case): RedirectResponse
    {
        $this->authorize('update', $case);
        $this->cases->updateCase($request->user(), $case, $this->validateIncident($request, false));

        return back()->with('success', 'Incident details updated.');
    }

    public function startInvestigation(Request $request, DisciplinaryCase $case): RedirectResponse
    {
        $this->authorize('update', $case);
        $data = $request->validate(['notes' => 'nullable|string|max:5000']);
        $this->cases->startInvestigation($request->user(), $case, $data['notes'] ?? null);

        return back()->with('success', 'Investigation started.');
    }

    public function completeInvestigation(Request $request, DisciplinaryCase $case): RedirectResponse
    {
        $this->authorize('update', $case);
        $data = $request->validate(['findings' => 'required|string|max:10000', 'proceed' => 'required|boolean']);
        $this->cases->completeInvestigation($request->user(), $case, $data['findings'], (bool) $data['proceed']);

        return back()->with('success', $data['proceed'] ? 'Notice issued. Schedule the hearing next.' : 'Case closed with no action.');
    }

    public function scheduleHearing(Request $request, DisciplinaryCase $case): RedirectResponse
    {
        $this->authorize('update', $case);
        $data = $request->validate([
            'hearing_at' => 'required|date',
            'hearing_location' => 'nullable|string|max:255',
            'notes' => 'nullable|string|max:5000',
        ]);
        $this->cases->scheduleHearing($request->user(), $case, $data);

        return back()->with('success', 'Hearing scheduled.');
    }

    public function completeHearing(Request $request, DisciplinaryCase $case): RedirectResponse
    {
        $this->authorize('update', $case);
        $data = $request->validate(['notes' => 'required|string|max:10000']);
        $this->cases->completeHearing($request->user(), $case, $data['notes']);

        return back()->with('success', 'Hearing recorded. Record the outcome next.');
    }

    public function recordOutcome(Request $request, DisciplinaryCase $case): RedirectResponse
    {
        $this->authorize('update', $case);
        $data = $request->validate([
            'outcome' => ['required', Rule::enum(DisciplinaryOutcome::class)],
            'outcome_details' => 'required|string|max:10000',
            'outcome_date' => 'nullable|date',
            'expiry_date' => 'nullable|date|after:outcome_date',
        ]);
        $this->cases->recordOutcome($request->user(), $case, $data);

        return back()->with('success', 'Outcome recorded.');
    }

    public function submitAppeal(Request $request, DisciplinaryCase $case): RedirectResponse
    {
        $this->authorize('appeal', $case);
        $data = $request->validate(['appeal_details' => 'required|string|max:10000']);
        $this->cases->submitAppeal($request->user(), $case, $data['appeal_details']);

        return back()->with('success', 'Your appeal has been lodged.');
    }

    public function decideAppeal(Request $request, DisciplinaryCase $case): RedirectResponse
    {
        $this->authorize('update', $case);
        $data = $request->validate([
            'appeal_decision' => 'required|in:upheld,overturned,reduced,increased',
            'new_outcome' => ['required_if:appeal_decision,reduced,increased', 'nullable', Rule::enum(DisciplinaryOutcome::class)],
            'notes' => 'nullable|string|max:5000',
        ]);
        $this->cases->decideAppeal($request->user(), $case, $data);

        return back()->with('success', 'Appeal decided and case closed.');
    }

    public function close(Request $request, DisciplinaryCase $case): RedirectResponse
    {
        $this->authorize('update', $case);
        $data = $request->validate(['notes' => 'nullable|string|max:5000']);
        $this->cases->closeCase($request->user(), $case, $data['notes'] ?? null);

        return back()->with('success', 'Case closed.');
    }

    public function storeDocument(Request $request, DisciplinaryCase $case): RedirectResponse
    {
        $this->authorize('update', $case);
        $data = $request->validate([
            'document_type' => ['required', Rule::enum(DisciplinaryDocumentType::class)],
            'title' => 'nullable|string|max:255',
            'file' => 'required|file|max:10240',
        ]);
        $this->cases->uploadDocument($request->user(), $case, $request->file('file'), $data);

        return back()->with('success', 'Document uploaded.');
    }

    public function downloadDocument(DisciplinaryCase $case, DisciplinaryDocument $document): StreamedResponse
    {
        abort_unless($document->disciplinary_case_id === $case->id, 404);
        $this->authorize('downloadDocument', $case);

        return Storage::disk('local')->download($document->file_path, $document->title.'.'.pathinfo($document->file_path, PATHINFO_EXTENSION));
    }

    public function destroyDocument(Request $request, DisciplinaryCase $case, DisciplinaryDocument $document): RedirectResponse
    {
        abort_unless($document->disciplinary_case_id === $case->id, 404);
        $this->authorize('update', $case);
        $this->cases->deleteDocument($request->user(), $document);

        return back()->with('success', 'Document removed.');
    }

    private function validateIncident(Request $request, bool $creating): array
    {
        return $request->validate([
            'employee_id' => [$creating ? 'required' : 'prohibited', 'integer', Rule::exists('hrm_employees', 'id')->where('company_id', $this->company()->id)->whereNull('deleted_at')],
            'incident_date' => 'required|date|before_or_equal:today',
            'reported_date' => 'nullable|date|after_or_equal:incident_date',
            'incident_description' => 'required|string|max:10000',
            'incident_location' => 'nullable|string|max:255',
            'witnesses' => 'nullable|string|max:2000',
        ]);
    }
}
