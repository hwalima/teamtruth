<?php

namespace App\Modules\Hrm\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Hrm\Models\DisciplinaryCase;
use App\Modules\Hrm\Models\DisciplinaryDocument;
use App\Modules\Hrm\Models\Employee;
use App\Modules\Hrm\Models\User;
use App\Modules\Hrm\Services\DisciplinaryService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DisciplinaryCaseController extends Controller
{
    public function __construct(
        private DisciplinaryService $disciplinaryService,
    ) {}

    public function index(Request $request): Response
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        $filters = $request->only(['search', 'employee_id', 'status', 'outcome', 'reported_by', 'incident_date_from', 'incident_date_to']);

        $cases = $this->disciplinaryService->searchCases($filters, 20);

        $employees = Employee::where('company_id', $company->id)
            ->where('employment_status', 'active')
            ->with('user')
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->get(['id', 'employee_number', 'first_name', 'last_name', 'user_id']);

        $reportedByUsers = User::whereHas('companies', fn ($q) => $q->where('company_id', $company->id))
            ->orderBy('name')
            ->get(['id', 'name', 'email']);

        return Inertia::render('Erp/Hrm/Disciplinary/Index', [
            'company' => $company,
            'cases' => $cases,
            'employees' => $employees,
            'reportedByUsers' => $reportedByUsers,
            'filters' => $filters,
            'statusOptions' => \App\Modules\Hrm\Enums\DisciplinaryStatus::options(),
            'outcomeOptions' => \App\Modules\Hrm\Enums\DisciplinaryOutcome::options(),
        ]);
    }

    public function create(): Response
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        $employees = Employee::where('company_id', $company->id)
            ->where('employment_status', 'active')
            ->with('user', 'department', 'position')
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->get(['id', 'employee_number', 'first_name', 'last_name', 'user_id', 'department_id', 'position_id']);

        $reportedByUsers = User::whereHas('companies', fn ($q) => $q->where('company_id', $company->id))
            ->orderBy('name')
            ->get(['id', 'name', 'email']);

        return Inertia::render('Erp/Hrm/Disciplinary/Create', [
            'company' => $company,
            'employees' => $employees,
            'reportedByUsers' => $reportedByUsers,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'employee_id' => 'required|exists:hrm_employees,id',
            'incident_date' => 'required|date',
            'reported_date' => 'nullable|date',
            'reported_by' => 'nullable|exists:users,id',
            'incident_description' => 'required|string',
            'incident_location' => 'nullable|string|max:255',
            'witnesses' => 'nullable|array',
            'evidence_attachments' => 'nullable|array',
        ]);

        $case = $this->disciplinaryService->createCase($request->user(), $validated);

        return redirect()->route('erp.hrm.disciplinary.show', $case)
            ->with('success', 'Disciplinary case created successfully.');
    }

    public function show(DisciplinaryCase $case): Response
    {
        $this->authorize('view', $case);

        $company = app(CompanyContext::class)->requireActiveCompany();

        $case->load([
            'employee.user',
            'employee.department',
            'employee.position',
            'reportedBy',
            'investigator',
            'hearingOfficer',
            'documents.uploadedBy',
        ]);

        return Inertia::render('Erp/Hrm/Disciplinary/Show', [
            'company' => $company,
            'case' => $case,
            'canInvestigate' => $this->allows('investigate', $case),
            'canHear' => $this->allows('hear', $case),
            'canDecide' => $this->allows('decide', $case),
            'canAppeal' => $this->allows('appeal', $case),
            'canDecideAppeal' => $this->allows('decideAppeal', $case),
            'canManageDocuments' => $this->allows('manageDocuments', $case),
        ]);
    }

    public function startInvestigation(Request $request, DisciplinaryCase $case)
    {
        $this->authorize('investigate', $case);

        $validated = $request->validate([
            'investigator_id' => 'nullable|exists:users,id',
            'investigation_notes' => 'nullable|string',
        ]);

        $case = $this->disciplinaryService->startInvestigation($request->user(), $case, $validated);

        return back()->with('success', 'Investigation started.');
    }

    public function completeInvestigation(Request $request, DisciplinaryCase $case)
    {
        $this->authorize('investigate', $case);

        $validated = $request->validate([
            'investigation_findings' => 'required|string',
            'recommended_outcome' => 'nullable|in:' . implode(',', array_column(\App\Modules\Hrm\Enums\DisciplinaryOutcome::cases(), 'value')),
        ]);

        $case = $this->disciplinaryService->completeInvestigation($request->user(), $case, $validated);

        return back()->with('success', 'Investigation completed.');
    }

    public function scheduleHearing(Request $request, DisciplinaryCase $case)
    {
        $this->authorize('hear', $case);

        $validated = $request->validate([
            'hearing_date' => 'required|date|after_or_equal:today',
            'hearing_time' => 'nullable|date_format:H:i',
            'hearing_location' => 'nullable|string|max:255',
            'hearing_officer_id' => 'nullable|exists:users,id',
            'hearing_notes' => 'nullable|string',
        ]);

        $case = $this->disciplinaryService->scheduleHearing($request->user(), $case, $validated);

        return back()->with('success', 'Hearing scheduled successfully.');
    }

    public function completeHearing(Request $request, DisciplinaryCase $case)
    {
        $this->authorize('hear', $case);

        $validated = $request->validate([
            'hearing_outcome' => 'nullable|string',
            'hearing_minutes' => 'nullable|string',
        ]);

        $case = $this->disciplinaryService->completeHearing($request->user(), $case, $validated);

        return back()->with('success', 'Hearing completed.');
    }

    public function recordOutcome(Request $request, DisciplinaryCase $case)
    {
        $this->authorize('decide', $case);

        $validated = $request->validate([
            'outcome' => 'required|in:' . implode(',', array_column(\App\Modules\Hrm\Enums\DisciplinaryOutcome::cases(), 'value')),
            'outcome_date' => 'required|date',
            'outcome_details' => 'nullable|string',
            'expiry_months' => 'nullable|integer|min:1',
        ]);

        $case = $this->disciplinaryService->recordOutcome($request->user(), $case, $validated);

        return back()->with('success', 'Outcome recorded successfully.');
    }

    public function submitAppeal(Request $request, DisciplinaryCase $case)
    {
        $this->authorize('appeal', $case);

        $validated = $request->validate([
            'appeal_details' => 'required|string',
        ]);

        $case = $this->disciplinaryService->submitAppeal($request->user(), $case, $validated);

        return back()->with('success', 'Appeal submitted successfully.');
    }

    public function decideAppeal(Request $request, DisciplinaryCase $case)
    {
        $this->authorize('decideAppeal', $case);

        $validated = $request->validate([
            'appeal_decision' => 'required|in:upheld,overturned,reduced,increased',
            'new_outcome' => 'nullable|in:' . implode(',', array_column(\App\Modules\Hrm\Enums\DisciplinaryOutcome::cases(), 'value')),
            'appeal_outcome_details' => 'nullable|string',
            'expiry_months' => 'nullable|integer|min:1',
        ]);

        $case = $this->disciplinaryService->decideAppeal($request->user(), $case, $validated);

        return back()->with('success', 'Appeal decided successfully.');
    }

    public function close(Request $request, DisciplinaryCase $case)
    {
        $this->authorize('decide', $case);

        $validated = $request->validate([
            'notes' => 'nullable|string|max:500',
        ]);

        $case = $this->disciplinaryService->closeCase($request->user(), $case, $validated['notes'] ?? null);

        return back()->with('success', 'Case closed successfully.');
    }

    public function storeDocument(Request $request, DisciplinaryCase $case)
    {
        $this->authorize('manageDocuments', $case);

        $validated = $request->validate([
            'document_type' => 'required|string|max:50',
            'name' => 'required|string|max:150',
            'file_path' => 'required|string|max:500',
            'file_size' => 'nullable|integer|min:0',
            'mime_type' => 'nullable|string|max:100',
            'description' => 'nullable|string',
            'is_confidential' => 'nullable|boolean',
        ]);

        $document = $this->disciplinaryService->uploadDocument($request->user(), $case, $validated);

        return back()->with('success', 'Document uploaded successfully.');
    }

    public function destroyDocument(Request $request, DisciplinaryCase $case, DisciplinaryDocument $document)
    {
        $this->authorize('manageDocuments', $case);

        $this->disciplinaryService->deleteDocument($request->user(), $document);

        return back()->with('success', 'Document deleted successfully.');
    }
}