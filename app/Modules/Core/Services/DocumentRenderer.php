<?php

namespace App\Modules\Core\Services;

use App\Modules\Core\Enums\ApprovalActionType;
use App\Modules\Core\Enums\ApprovalStatus;
use App\Modules\Core\Models\Company;
use Barryvdh\DomPDF\Facade\Pdf as PdfFacade;
use Barryvdh\DomPDF\PDF;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\View;
use InvalidArgumentException;

class DocumentRenderer
{
    public function render(Model $document, string $template, array $data = []): PDF
    {
        $companyId = $document->getAttribute('company_id');
        if (! $companyId) {
            throw new InvalidArgumentException('The document must have a company_id before it can be rendered.');
        }

        $company = Company::query()->findOrFail($companyId);

        return $this->renderForCompany($company, $template, $data, $document);
    }

    public function renderForCompany(
        Company $company,
        string $template,
        array $data = [],
        ?Model $document = null,
    ): PDF {
        $activeCompany = app(CompanyContext::class)->requireActiveCompany();
        if ((int) $activeCompany->getKey() !== (int) $company->getKey()) {
            throw new AuthorizationException('A document can only be rendered with the active company branding.');
        }

        if (! preg_match('/^pdf\.documents\.[a-zA-Z0-9_.-]+$/', $template) || str_contains($template, '..')) {
            throw new InvalidArgumentException('Document templates must be under the pdf.documents namespace.');
        }

        if (! View::exists($template)) {
            throw new InvalidArgumentException("The document template [{$template}] does not exist.");
        }

        $company->loadMissing(['branding', 'signatories']);
        $approvalSignatories = [];
        if ($document && method_exists($document, 'approvalRequests')) {
            $approvalSignatories = $document->approvalRequests()
                ->where('status', ApprovalStatus::Approved->value)
                ->with(['actions' => fn ($query) => $query->where('action', ApprovalActionType::Approve->value)])
                ->get()
                ->flatMap(fn ($approvalRequest) => $approvalRequest->actions->map(
                    function ($action): ?array {
                        $snapshot = $action->signature_snapshot ?? [];
                        if ($action->action !== ApprovalActionType::Approve || empty($snapshot)) {
                            return null;
                        }

                        return [
                            'name' => $snapshot['name'] ?? '',
                            'title' => $snapshot['title'] ?? '',
                            'signature_image_path' => $snapshot['signature_image_path'] ?? null,
                            'signed_at' => $action->acted_at,
                        ];
                    }
                ))
                ->filter()
                ->values()
                ->all();
        }

        $viewData = array_merge($data, [
            'company' => $company,
            'document' => $document,
            'approvalSignatories' => $approvalSignatories,
        ]);

        return PdfFacade::loadView($template, $viewData)->setPaper('a4');
    }
}
