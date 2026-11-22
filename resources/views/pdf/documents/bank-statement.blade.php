@php
    $money = fn (int $cents) => \App\Modules\Banking\Models\Money::format($cents);
    $date = fn (string $value) => \Carbon\CarbonImmutable::parse($value)->format('d/m/Y');
@endphp
<x-report-layout
    :company="$company"
    :report-title="'Bank statement'"
    :report-subtitle="$account->bank->name.' · '.$period"
    :landscape="false"
    :stats="[
        'Opening balance' => $money($statement['opening']),
        'Total credits' => $money($statement['credits']),
        'Total debits' => $money($statement['debits']),
        'Closing balance' => $money($statement['closing']),
    ]"
>
    <style>
        .holder { width: 100%; border-collapse: collapse; margin: 0 0 12px; }
        .holder td { padding: 3px 8px; vertical-align: top; font-size: 8.5px; }
        .holder .label { color: #6b7280; width: 18%; text-transform: uppercase; font-size: 7px; letter-spacing: 0.6px; }
        .holder .value { font-weight: bold; }
        .holder-box { border: 1px solid #e5e7eb; border-radius: 6px; padding: 6px 0; margin-bottom: 12px; }
        tr.brought td, tr.closing td { font-weight: bold; background: #f3f4f6; }
        .neg { color: #b91c1c; }
        .notes { margin-top: 16px; }
        .notes h3 { font-size: 10px; margin: 0 0 4px; }
        .notes p { color: #6b7280; margin: 0 0 6px; }
    </style>

    <div class="holder-box">
        <table class="holder">
            <tr>
                <td class="label">Account name</td>
                <td class="value">{{ $account->account_name }}</td>
                <td class="label">Account no.</td>
                <td class="value">{{ $account->account_number }}</td>
            </tr>
            <tr>
                <td class="label">Account holder</td>
                <td class="value">{{ $account->company->legal_name ?: $account->company->name }}</td>
                <td class="label">Currency</td>
                <td class="value">{{ $account->currency }}</td>
            </tr>
            <tr>
                <td class="label">Bank</td>
                <td class="value">{{ $account->bank->name }}</td>
                <td class="label">Period</td>
                <td class="value">{{ $period }}</td>
            </tr>
        </table>
    </div>

    <table class="data">
        <thead>
            <tr>
                <th style="width: 11%;">Date</th>
                <th style="width: 11%;">Txn type</th>
                <th>Description</th>
                <th style="width: 9%;">Ref no.</th>
                <th class="num" style="width: 12%;">Debit</th>
                <th class="num" style="width: 12%;">Credit</th>
                <th class="num" style="width: 13%;">Balance</th>
            </tr>
        </thead>
        <tbody>
            <tr class="brought">
                <td>{{ $date($statement['from']) }}</td>
                <td></td>
                <td>Balance brought forward</td>
                <td></td>
                <td class="num"></td>
                <td class="num"></td>
                <td class="num {{ $statement['opening'] < 0 ? 'neg' : '' }}">{{ $money($statement['opening']) }}</td>
            </tr>
            @forelse ($statement['lines'] as $line)
                <tr class="{{ $loop->even ? 'zebra' : '' }}">
                    <td>{{ $date($line['date']) }}</td>
                    <td>{{ $line['type'] }}</td>
                    <td>{{ $line['description'] }}</td>
                    <td>{{ $line['reference'] }}</td>
                    <td class="num">{{ $line['debit'] !== 0 ? $money($line['debit']) : '' }}</td>
                    <td class="num">{{ $line['credit'] !== 0 ? $money($line['credit']) : '' }}</td>
                    <td class="num {{ $line['balance'] < 0 ? 'neg' : '' }}">{{ $money($line['balance']) }}</td>
                </tr>
            @empty
                <tr>
                    <td colspan="7" class="empty">No transactions in this period.</td>
                </tr>
            @endforelse
            <tr class="closing">
                <td>{{ $date($statement['to']) }}</td>
                <td></td>
                <td>Totals and closing balance · {{ number_format($statement['count']) }} transaction(s)</td>
                <td></td>
                <td class="num">{{ $money($statement['debits']) }}</td>
                <td class="num">{{ $money($statement['credits']) }}</td>
                <td class="num {{ $statement['closing'] < 0 ? 'neg' : '' }}">{{ $money($statement['closing']) }}</td>
            </tr>
        </tbody>
    </table>

    @if (count($statement['differences']) > 0)
        <div class="notes">
            <h3>Reconciliation note</h3>
            <p>On {{ count($statement['differences']) }} line(s) the source statement printed a balance that does not follow from the amounts. The balances above are worked out from the opening balance, credits and debits; the amounts themselves are unchanged.</p>
            <table class="data">
                <thead>
                    <tr>
                        <th style="width: 11%;">Date</th>
                        <th>Description</th>
                        <th style="width: 18%;">Source</th>
                        <th class="num" style="width: 14%;">Balance on source</th>
                        <th class="num" style="width: 14%;">Correct balance</th>
                        <th class="num" style="width: 12%;">Difference</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($statement['differences'] as $difference)
                        <tr class="{{ $loop->even ? 'zebra' : '' }}">
                            <td>{{ $date($difference['date']) }}</td>
                            <td>{{ $difference['description'] }}</td>
                            <td>{{ $difference['source'] }}</td>
                            <td class="num">{{ $money($difference['stated_balance']) }}</td>
                            <td class="num">{{ $money($difference['balance']) }}</td>
                            <td class="num">{{ $money($difference['difference']) }}</td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </div>
    @endif
</x-report-layout>
