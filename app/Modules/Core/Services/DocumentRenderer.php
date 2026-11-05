<?php

namespace App\Modules\Core\Services;

use App\Modules\Core\Enums\ApprovalActionType;
use App\Modules\Core\Enums\ApprovalStatus;
use App\Modules\Core\Models\Company;
use Barryvdh\DomPDF\Facade\Pdf as PdfFacade;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\View;
use InvalidArgumentException;
use RuntimeException;
use setasign\Fpdi\Fpdi;
use setasign\Fpdi\PdfParser\StreamReader;

class DocumentRenderer
{
    public function render(Model $document, string $template, array $data = []): string
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
    ): string {
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

        $pdfContents = PdfFacade::loadView($template, $viewData)->setPaper('a4')->output();
        $letterheadPath = $company->branding?->letterhead_path;
        if (! $letterheadPath) {
            return $pdfContents;
        }

        $disk = Storage::disk('public');
        if (! $disk->exists($letterheadPath)) {
            throw new RuntimeException("The company letterhead file [{$letterheadPath}] does not exist.");
        }

        return $this->applyLetterhead($pdfContents, $disk->get($letterheadPath));
    }

    private function applyLetterhead(string $documentPdf, string $letterheadPdf): string
    {
        $pdf = new Fpdi('P', 'pt');
        $pdf->SetAutoPageBreak(false);

        $pdf->setSourceFile(StreamReader::createByString($letterheadPdf));
        $letterheadTemplate = $pdf->importPage(1);

        $pageCount = $pdf->setSourceFile(StreamReader::createByString($documentPdf));

        for ($pageNumber = 1; $pageNumber <= $pageCount; $pageNumber++) {
            $documentTemplate = $pdf->importPage($pageNumber);
            $pageSize = $pdf->getTemplateSize($documentTemplate);
            $pdf->AddPage($pageSize['orientation'], [$pageSize['width'], $pageSize['height']]);
            $pdf->useTemplate($letterheadTemplate, 0, 0, $pageSize['width'], $pageSize['height']);
            $pdf->useTemplate($documentTemplate, 0, 0, $pageSize['width'], $pageSize['height']);
        }

        return $pdf->Output('S');
    }
}
