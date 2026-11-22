<?php

namespace App\Modules\Purchase\Mail;

use App\Models\User;
use App\Modules\Core\Models\Company;
use App\Modules\Purchase\Models\PurchaseOrder;
use Illuminate\Mail\Attachment;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/** The approved purchase order, sent to the vendor with the PDF attached. */
class PurchaseOrderMail extends Mailable
{
    public function __construct(
        public PurchaseOrder $order,
        public Company $company,
        public User $sender,
        public string $pdf,
        public ?string $note = null,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Purchase order '.$this->order->document_number.' from '.$this->company->name,
            // Replies go to the buyer who sent it, not to the system address.
            replyTo: [new Address($this->sender->email, $this->sender->name)],
        );
    }

    public function content(): Content
    {
        return new Content(view: 'emails.purchase-order');
    }

    public function attachments(): array
    {
        return [
            Attachment::fromData(fn () => $this->pdf, 'purchase-order-'.str_replace('/', '-', $this->order->document_number).'.pdf')
                ->withMime('application/pdf'),
        ];
    }
}
