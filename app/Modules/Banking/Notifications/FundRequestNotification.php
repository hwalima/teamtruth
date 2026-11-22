<?php

namespace App\Modules\Banking\Notifications;

use App\Modules\Banking\Models\FundRequest;
use App\Modules\Banking\Models\Money;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Tells the right people what happened to a fund request: approvers when one
 * is submitted or withdrawn, the requester when it is approved or rejected,
 * and the approver when the money has been moved.
 */
class FundRequestNotification extends Notification
{
    use Queueable;

    /** @param 'submitted'|'approved'|'rejected'|'cancelled'|'transferred' $event */
    public function __construct(
        public FundRequest $request,
        public string $event,
        public string $actorName,
    ) {}

    public function via(object $notifiable): array
    {
        // Saved in the app first, so a mail server problem never loses the notice.
        return filled($notifiable->email ?? null) ? ['database', 'mail'] : ['database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $request = $this->request->loadMissing(['fromCompany:id,name', 'toCompany:id,name', 'fromAccount:id,account_number', 'toAccount:id,account_number']);
        $mail = (new MailMessage)
            ->subject($this->title().' · '.$request->reference.' · '.$this->amount())
            ->greeting('Hello '.$notifiable->name.',')
            ->line($this->content())
            ->line('Amount: '.$this->amount())
            ->line('From: '.$request->fromCompany->name.' ('.$request->fromAccount->account_number.')')
            ->line('To: '.$request->toCompany->name.' ('.$request->toAccount->account_number.')')
            ->line('Purpose: '.$request->purpose);
        if (filled($request->decision_note) && in_array($this->event, ['approved', 'rejected'], true)) {
            $mail->line('Note from '.$this->actorName.': '.$request->decision_note);
        }

        return $mail->action($this->event === 'submitted' ? 'Review the request' : 'Open the request', $this->link(absolute: true))
            ->salutation('Regards,'.PHP_EOL.config('app.name'));
    }

    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'fund_request_'.$this->event,
            'title' => $this->title(),
            'content' => $this->content(),
            'link' => $this->link(absolute: false),
            'sender_name' => $this->actorName,
            'fund_request_id' => $this->request->id,
            'reference' => $this->request->reference,
        ];
    }

    private function title(): string
    {
        return match ($this->event) {
            'submitted' => 'Fund request awaiting your approval',
            'approved' => 'Fund request approved',
            'rejected' => 'Fund request rejected',
            'cancelled' => 'Fund request withdrawn',
            'transferred' => 'Approved funds transferred',
        };
    }

    private function content(): string
    {
        $request = $this->request->loadMissing(['fromCompany:id,name', 'toCompany:id,name']);
        $what = $this->amount().' from '.$request->fromCompany->name.' to '.$request->toCompany->name;

        return match ($this->event) {
            'submitted' => "{$this->actorName} asks you to approve {$what} ({$request->reference}).",
            'approved' => "{$this->actorName} approved {$what} ({$request->reference}). You can now make the transfer.",
            'rejected' => "{$this->actorName} rejected {$what} ({$request->reference}).",
            'cancelled' => "{$this->actorName} withdrew the request for {$what} ({$request->reference}). Nothing needs your approval.",
            'transferred' => "{$this->actorName} transferred {$what} ({$request->reference}), which you approved.",
        };
    }

    private function amount(): string
    {
        return $this->request->currency.' '.Money::format(Money::cents($this->request->amount));
    }

    private function link(bool $absolute): string
    {
        return route('erp.banking.fund-requests.show', $this->request, absolute: $absolute);
    }
}
