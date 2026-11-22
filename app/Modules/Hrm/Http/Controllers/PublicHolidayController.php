<?php

namespace App\Modules\Hrm\Http\Controllers;

use App\Modules\Hrm\Models\PublicHoliday;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class PublicHolidayController extends HrmController
{
    public function index(Request $request): Response
    {
        $year = $request->integer('year') ?: (int) now()->year;

        $holidays = PublicHoliday::query()
            ->where(fn ($q) => $q->whereYear('date', $year)->orWhere('is_recurring', true))
            ->orderBy('date')
            ->get();

        $years = PublicHoliday::query()->pluck('date')
            ->map(fn ($date) => (int) $date->year)
            ->push($year, (int) now()->year)
            ->unique()->sortDesc()->values();

        return Inertia::render('Erp/Hrm/Leave/Holidays/Index', [
            'company' => $this->company(),
            'holidays' => $holidays,
            'years' => $years,
            'year' => $year,
            'canManage' => $this->allowsErpPermission('erp.hrm.leave.manage'),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        PublicHoliday::query()->create([
            ...$this->validated($request, null),
            'created_by' => $request->user()->id,
            'updated_by' => $request->user()->id,
        ]);

        return back()->with('success', 'Public holiday added.');
    }

    public function update(Request $request, PublicHoliday $holiday): RedirectResponse
    {
        $holiday->update([...$this->validated($request, $holiday), 'updated_by' => $request->user()->id]);

        return back()->with('success', 'Public holiday updated.');
    }

    public function destroy(PublicHoliday $holiday): RedirectResponse
    {
        $holiday->delete();

        return back()->with('success', 'Public holiday deleted.');
    }

    private function validated(Request $request, ?PublicHoliday $holiday): array
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'date' => [
                'required', 'date',
                Rule::unique('hrm_public_holidays', 'date')->where('company_id', $this->company()->id)->ignore($holiday?->id),
            ],
            'is_recurring' => 'boolean',
            'description' => 'nullable|string|max:2000',
        ]);
        $data['is_recurring'] = $request->boolean('is_recurring');

        return $data;
    }
}
