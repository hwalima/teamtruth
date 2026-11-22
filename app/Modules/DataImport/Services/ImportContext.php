<?php

namespace App\Modules\DataImport\Services;

use App\Models\User;
use App\Modules\Core\Models\Company;
use App\Modules\DataImport\Models\DataImport;
use App\Modules\DataImport\Models\ExternalId;
use Illuminate\Database\Eloquent\Model;

/**
 * State shared by an importer during one run: the options, what happened to
 * each row, and what was created along the way. A preview runs exactly like
 * an import but inside a transaction that is rolled back.
 */
class ImportContext
{
    /** @var array<int, array{action: string, messages: list<string>, record_type: ?string, record_id: ?int}> */
    public array $rows = [];

    /** @var array<string, list<string>> e.g. created.categories => [names] */
    public array $created = [];

    /** @var list<string> */
    public array $warnings = [];

    /** @var array<string, int|float|string> */
    public array $totals = [];

    public function __construct(
        public readonly Company $company,
        public readonly User $user,
        public readonly DataImport $import,
        public readonly bool $commit,
        public readonly array $options = [],
    ) {}

    public function option(string $key, mixed $default = null): mixed
    {
        return $this->options[$key] ?? $default;
    }

    public function row(int $rowNumber, string $action, array $messages = [], ?Model $record = null): void
    {
        $existing = $this->rows[$rowNumber]['messages'] ?? [];
        $this->rows[$rowNumber] = [
            'action' => $action,
            'messages' => array_values(array_unique([...$existing, ...$messages])),
            'record_type' => $record ? $record->getMorphClass() : ($this->rows[$rowNumber]['record_type'] ?? null),
            'record_id' => $record ? (int) $record->getKey() : ($this->rows[$rowNumber]['record_id'] ?? null),
        ];
    }

    public function message(int $rowNumber, string $message): void
    {
        $this->rows[$rowNumber]['messages'][] = $message;
        $this->rows[$rowNumber]['action'] ??= 'skipped';
    }

    public function created(string $kind, string $label): void
    {
        $this->created[$kind][] = $label;
    }

    public function warn(string $message): void
    {
        $this->warnings[] = $message;
    }

    public function add(string $total, int|float $amount = 1): void
    {
        $this->totals[$total] = ($this->totals[$total] ?? 0) + $amount;
    }

    /** The local record an outside record became, if it was imported before. */
    public function find(string $model, ?string $externalId): ?Model
    {
        if (blank($externalId)) {
            return null;
        }

        $link = ExternalId::query()
            ->where('source', $this->import->source)
            ->where('model', $model)
            ->where('external_id', $externalId)
            ->first();

        return $link?->record;
    }

    public function remember(string $model, ?string $externalId, Model $record): void
    {
        if (blank($externalId)) {
            return;
        }

        ExternalId::query()->updateOrCreate(
            ['source' => $this->import->source, 'model' => $model, 'external_id' => $externalId],
            ['record_type' => $record->getMorphClass(), 'record_id' => $record->getKey(), 'data_import_id' => $this->import->id],
        );
    }

    public function summary(): array
    {
        $actions = [];
        foreach ($this->rows as $row) {
            $actions[$row['action']] = ($actions[$row['action']] ?? 0) + 1;
        }

        return [
            'actions' => $actions,
            'created' => array_map(fn ($names) => array_values(array_unique($names)), $this->created),
            'totals' => $this->totals,
            'warnings' => array_values(array_unique($this->warnings)),
        ];
    }
}
