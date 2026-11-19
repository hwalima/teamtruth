<?php

namespace App\Modules\Hrm\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Hrm\Models\PublicHoliday;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class PublicHolidayController extends Controller
{
    public function index(Request $request): Response
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        $query = PublicHoliday::where('company_id', $company->id)
            ->orderBy('date', 'desc');

        if ($request->filled('year')) {
            $query->whereYear('date', $request->year);
        }

        $holidays = $query->paginate(20)->withQueryString();

        // Get available years
        $years = PublicHoliday::where('company_id', $company->id)
            ->selectRaw('YEAR(date) as year')
            ->distinct()
            ->orderBy('year', 'desc')
            ->pluck('year');

        return Inertia::render('Erp/Hrm/Leave/Holidays/Index', [
            'company' => $company,
            'holidays' => $holidays,
            'years' => $years,
            'filters' => $request->only(['year']),
        ]);
    }

    public function store(Request $request)
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        $validated = $request->validate([
            'name' => 'required|string|max:150',
            'date' => 'required|date',
            'is_recurring' => 'nullable|boolean',
            'description' => 'nullable|string',
        ]);

        PublicHoliday::create(array_merge($validated, [
            'company_id' => $company->id,
            'is_recurring' => $validated['is_recurring'] ?? false,
        ]));

        return redirect()->route('erp.hrm.leave.holidays.index')
            ->with('success', 'Public holiday created successfully.');
    }

    public function update(Request $request, PublicHoliday $holiday)
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        if ((int) $holiday->company_id !== (int) $company->id) {
            abort(403);
        }

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:150',
            'date' => 'sometimes|required|date',
            'is_recurring' => 'nullable|boolean',
            'description' => 'nullable|string',
        ]);

        $holiday->update($validated);

        return back()->with('success', 'Public holiday updated successfully.');
    }

    public function destroy(PublicHoliday $holiday)
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        if ((int) $holiday->company_id !== (int) $company->id) {
            abort(403);
        }

        $holiday->delete();

        return redirect()->route('erp.hrm.leave.holidays.index')
            ->with('success', 'Public holiday deleted successfully.');
    }
}