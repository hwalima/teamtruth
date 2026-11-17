<?php

namespace App\Modules\Invoicing\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Invoicing\Models\PaymentTerm;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class PaymentTermController extends Controller
{
    public function index(): Response
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        $paymentTerms = PaymentTerm::query()
            ->where('company_id', $company->id)
            ->orderBy('is_default', 'desc')
            ->orderBy('name')
            ->get();

        return Inertia::render('Erp/Invoicing/PaymentTerms/Index', [
            'company' => $company,
            'paymentTerms' => $paymentTerms,
        ]);
    }

    public function store(Request $request)
    {
        $user = $request->user();
        $company = app(CompanyContext::class)->requireActiveCompany();

        $validated = $request->validate([
            'code' => ['required', 'string', 'max:50', 'unique:inv_payment_terms,code,NULL,id,company_id,' . $company->id],
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'net_days' => ['required', 'integer', 'min:0'],
            'discount_days' => ['nullable', 'integer', 'min:0'],
            'discount_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'is_default' => ['boolean'],
            'is_active' => ['boolean'],
        ]);

        // If setting as default, unset other defaults
        if ($validated['is_default'] ?? false) {
            PaymentTerm::where('company_id', $company->id)
                ->where('is_default', true)
                ->update(['is_default' => false]);
        }

        $validated['company_id'] = $company->id;

        PaymentTerm::query()->create($validated);

        return back()->with('success', 'Payment term created successfully.');
    }

    public function update(Request $request, PaymentTerm $paymentTerm)
    {
        $validated = $request->validate([
            'code' => ['required', 'string', 'max:50', 'unique:inv_payment_terms,code,' . $paymentTerm->id . ',id,company_id,' . $paymentTerm->company_id],
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'net_days' => ['required', 'integer', 'min:0'],
            'discount_days' => ['nullable', 'integer', 'min:0'],
            'discount_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'is_default' => ['boolean'],
            'is_active' => ['boolean'],
        ]);

        // If setting as default, unset other defaults
        if ($validated['is_default'] ?? false) {
            PaymentTerm::where('company_id', $paymentTerm->company_id)
                ->where('id', '!=', $paymentTerm->id)
                ->where('is_default', true)
                ->update(['is_default' => false]);
        }

        $paymentTerm->update($validated);

        return back()->with('success', 'Payment term updated successfully.');
    }

    public function destroy(PaymentTerm $paymentTerm)
    {
        // Check if payment term is in use
        if ($paymentTerm->customers()->exists() || $paymentTerm->recurringInvoices()->exists()) {
            return back()->with('error', 'Cannot delete payment term that is in use.');
        }

        $paymentTerm->delete();

        return back()->with('success', 'Payment term deleted successfully.');
    }
}