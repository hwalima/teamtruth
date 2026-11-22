<?php

namespace App\Modules\Hrm\Http\Controllers;

use App\Modules\Hrm\Enums\ContractType;
use App\Modules\Hrm\Models\ContractTemplate;
use App\Modules\Hrm\Services\ContractService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class ContractTemplateController extends HrmController
{
    public function index(Request $request): Response
    {
        $search = (string) $request->input('search', '');

        $templates = ContractTemplate::query()
            ->withCount('contracts')
            ->when($search !== '', fn ($q) => $q->where('name', 'like', "%{$search}%"))
            ->orderBy('contract_type')->orderBy('name')
            ->paginate(50)
            ->withQueryString();

        $templates->getCollection()->transform(function (ContractTemplate $template) {
            $template->setAttribute('body', $template->template_content['body'] ?? '');

            return $template;
        });

        return Inertia::render('Erp/Hrm/Contracts/Templates/Index', [
            'company' => $this->company(),
            'templates' => $templates,
            'filters' => ['search' => $search],
            'typeOptions' => ContractType::options(),
            'mergeFields' => ContractService::MERGE_FIELDS,
            'canManage' => $this->allowsErpPermission('erp.hrm.contract.manage'),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        ContractTemplate::query()->create([
            ...$this->validated($request),
            'created_by' => $request->user()->id,
            'updated_by' => $request->user()->id,
        ]);

        return back()->with('success', 'Contract template created.');
    }

    public function update(Request $request, ContractTemplate $template): RedirectResponse
    {
        $template->update([...$this->validated($request), 'updated_by' => $request->user()->id]);

        return back()->with('success', 'Contract template updated.');
    }

    public function destroy(ContractTemplate $template): RedirectResponse
    {
        if ($template->contracts()->exists()) {
            throw ValidationException::withMessages(['record' => 'Contracts were created from this template, so it cannot be deleted.']);
        }

        $template->delete();

        return back()->with('success', 'Contract template deleted.');
    }

    private function validated(Request $request): array
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'contract_type' => ['required', Rule::enum(ContractType::class)],
            'description' => 'nullable|string|max:2000',
            'body' => 'nullable|string|max:100000',
            'is_default' => 'boolean',
        ]);

        return [
            'name' => $data['name'],
            'contract_type' => $data['contract_type'],
            'description' => $data['description'] ?? null,
            'template_content' => ['body' => $data['body'] ?? ''],
            'is_default' => $request->boolean('is_default'),
        ];
    }
}
