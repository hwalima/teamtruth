<?php

namespace App\View\Components;

use App\Modules\Core\Models\Company;
use Illuminate\Contracts\View\View;

/**
 * A branded, landscape report page: a colour band with the company's logo and
 * details, the report title, optional figures, and a numbered footer.
 */
class ReportLayout extends DocumentLayout
{
    public string $primaryTint;

    public string $accentTint;

    public string $generatedAt;

    /** Text colour that reads well on the primary colour. */
    public string $onPrimary;

    public function __construct(
        Company $company,
        public string $reportTitle = '',
        public ?string $reportSubtitle = null,
        public array $stats = [],
        public bool $landscape = true,
    ) {
        parent::__construct($company, $reportTitle, 'report');

        $this->primaryTint = $this->tint($this->primaryColor, 0.07);
        $this->accentTint = $this->tint($this->accentColor, 0.12);
        $this->generatedAt = now()->format('j M Y, H:i');
        [$r, $g, $b] = array_map('hexdec', str_split(ltrim($this->primaryColor, '#'), 2));
        $this->onPrimary = (0.299 * $r + 0.587 * $g + 0.114 * $b) > 170 ? '#0f172a' : '#ffffff';
    }

    public function render(): View
    {
        return view('components.report-layout');
    }

    /** The colour mixed with white, e.g. 0.07 is a very light wash. */
    private function tint(string $hex, float $amount): string
    {
        [$r, $g, $b] = array_map('hexdec', str_split(ltrim($hex, '#'), 2));
        $mix = fn (int $channel): int => (int) round(255 - (255 - $channel) * $amount);

        return sprintf('#%02x%02x%02x', $mix($r), $mix($g), $mix($b));
    }
}
