@php
    $amount = $fundRequest->currency.' '.\App\Modules\Banking\Models\Money::format(\App\Modules\Banking\Models\Money::cents($fundRequest->amount));
    $stamp = fn ($value) => $value ? $value->timezone(config('app.timezone'))->format('j M Y, H:i') : '—';
    $statusLabel = [
        'pending' => 'Awaiting approval',
        'approved' => 'Approved, awaiting transfer',
        'rejected' => 'Rejected',
        'transferred' => 'Approved and transferred',
        'cancelled' => 'Withdrawn',
    ][$fundRequest->status] ?? ucfirst($fundRequest->status);
@endphp
<x-report-layout
    :company="$company"
    :report-title="'Fund request '.$fundRequest->reference"
    :report-subtitle="$statusLabel"
    :landscape="false"
    :stats="[
        'Amount' => $amount,
        'Status' => $statusLabel,
        'Requested' => $stamp($fundRequest->requested_at),
    ]"
>
    <style>
        .box { border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px 10px; margin-bottom: 12px; }
        .grid { width: 100%; border-collapse: collapse; }
        .grid td { padding: 4px 6px; vertical-align: top; font-size: 9px; }
        .label { color: #6b7280; text-transform: uppercase; font-size: 7px; letter-spacing: 0.6px; }
        .value { font-weight: bold; font-size: 10px; }
        .purpose { font-size: 9.5px; line-height: 1.5; margin: 2px 0 0; }
        .signs { width: 100%; border-collapse: separate; border-spacing: 10px 0; margin: 16px -10px 0; }
        .sign { border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px 12px; width: 50%; vertical-align: top; }
        .sign-image { height: 60px; margin: 6px 0; }
        .sign-image img { max-height: 58px; max-width: 200px; }
        .sign-line { border-top: 1px solid #64748b; padding-top: 5px; }
        .sign-name { font-weight: bold; font-size: 10px; }
        .muted { color: #6b7280; }
        .rejected { color: #b91c1c; font-weight: bold; }
        .note { margin-top: 8px; font-size: 9px; }
    </style>

    <div class="box">
        <table class="grid">
            <tr>
                <td style="width: 50%;">
                    <div class="label">Pay from</div>
                    <div class="value">{{ $fundRequest->fromCompany->legal_name ?: $fundRequest->fromCompany->name }}</div>
                    <div class="muted">{{ $fundRequest->fromAccount->bank->name }} · account {{ $fundRequest->fromAccount->account_number }}</div>
                </td>
                <td style="width: 50%;">
                    <div class="label">Pay to</div>
                    <div class="value">{{ $fundRequest->toCompany->name }}</div>
                    <div class="muted">{{ $fundRequest->toAccount->bank->name }} · account {{ $fundRequest->toAccount->account_number }}</div>
                </td>
            </tr>
            <tr>
                <td>
                    <div class="label">Amount</div>
                    <div class="value">{{ $amount }}</div>
                </td>
                <td>
                    <div class="label">Transfer</div>
                    <div class="value">
                        @if ($fundRequest->transfer)
                            Made {{ $fundRequest->transfer->transfer_date->format('j M Y') }}{{ $fundRequest->transferrer ? ' by '.$fundRequest->transferrer->name : '' }}
                        @else
                            Not made yet
                        @endif
                    </div>
                </td>
            </tr>
            <tr>
                <td colspan="2">
                    <div class="label">Purpose</div>
                    <p class="purpose">{!! nl2br(e($fundRequest->purpose)) !!}</p>
                </td>
            </tr>
        </table>
    </div>

    <table class="signs">
        <tr>
            <td class="sign">
                <div class="label">Requested by</div>
                <div class="sign-image">
                    @if ($requesterSignature)
                        <img src="{{ $requesterSignature }}" alt="">
                    @endif
                </div>
                <div class="sign-line">
                    <div class="sign-name">{{ $fundRequest->requester_name }}</div>
                    @if ($fundRequest->requester_title) <div>{{ $fundRequest->requester_title }}</div> @endif
                    <div class="muted">Signed {{ $stamp($fundRequest->requested_at) }}</div>
                </div>
            </td>
            <td class="sign">
                <div class="label">{{ $fundRequest->status === 'rejected' ? 'Rejected by' : 'Approved by' }}</div>
                <div class="sign-image">
                    @if ($approverSignature)
                        <img src="{{ $approverSignature }}" alt="">
                    @elseif ($fundRequest->status === 'rejected')
                        <div class="rejected" style="line-height: 58px;">REJECTED</div>
                    @endif
                </div>
                <div class="sign-line">
                    @if ($fundRequest->decided_at)
                        <div class="sign-name">{{ $fundRequest->approver_name }}</div>
                        @if ($fundRequest->approver_title) <div>{{ $fundRequest->approver_title }}</div> @endif
                        <div class="muted">{{ $fundRequest->status === 'rejected' ? 'Rejected' : 'Signed' }} {{ $stamp($fundRequest->decided_at) }}</div>
                    @else
                        <div class="muted">Awaiting approval by {{ $fundRequest->fromCompany->name }}</div>
                    @endif
                </div>
            </td>
        </tr>
    </table>

    @if ($fundRequest->decision_note)
        <div class="note"><span class="label">Approver's note</span><br>{{ $fundRequest->decision_note }}</div>
    @endif
</x-report-layout>
