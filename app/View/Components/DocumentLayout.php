<?php

namespace App\View\Components;

use App\Modules\Core\Models\Company;
use Illuminate\Contracts\View\View;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\Storage;
use Illuminate\View\Component;

class DocumentLayout extends Component
{
    public ?string $logoDataUri;

    public string $primaryColor;

    public string $secondaryColor;

    public string $accentColor;

    public Collection $signatories;

    public function __construct(
        public Company $company,
        public string $documentTitle = '',
        public ?string $documentType = null,
        public array $approvalSignatories = [],
    ) {
        $this->company->loadMissing(['branding', 'signatories']);

        $branding = $this->company->branding;
        $this->primaryColor = $this->safeColor($branding?->primary_color, '#1e293b');
        $this->secondaryColor = $this->safeColor($branding?->secondary_color, '#475569');
        $this->accentColor = $this->safeColor($branding?->accent_color, '#2563eb');
        $this->logoDataUri = $this->imageDataUri($branding?->logo_path);
        $this->signatories = $this->company->signatories
            ->where('is_active', true)
            ->filter(fn ($signatory): bool => $signatory->applies_to_document_type === null
                || $signatory->applies_to_document_type === $this->documentType)
            ->map(function ($signatory): object {
                $signatory->signature_data_uri = $this->imageDataUri($signatory->signature_image_path);

                return $signatory;
            })
            ->concat(collect($this->approvalSignatories)->map(function (array $signatory): object {
                return (object) [
                    'name' => $signatory['name'] ?? '',
                    'title' => $signatory['title'] ?? '',
                    'signature_data_uri' => $this->imageDataUri($signatory['signature_image_path'] ?? null),
                    'signed_at' => $signatory['signed_at'] ?? null,
                ];
            }));
    }

    public function render(): View
    {
        return view('components.document-layout');
    }

    private function safeColor(?string $color, string $fallback): string
    {
        return $color && preg_match('/^#[0-9a-fA-F]{6}$/', $color) ? $color : $fallback;
    }

    private function imageDataUri(?string $path): ?string
    {
        if (! $path || ! Storage::disk('public')->exists($path)) {
            return null;
        }

        $mimeType = Storage::disk('public')->mimeType($path);
        if (! in_array($mimeType, ['image/png', 'image/jpeg', 'image/gif'], true)) {
            return null;
        }

        return 'data:'.$mimeType.';base64,'.base64_encode(Storage::disk('public')->get($path));
    }
}
