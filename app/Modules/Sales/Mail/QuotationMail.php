<?php

namespace App\Modules\Sales\Mail;

use App\Models\User;
use App\Modules\Core\Models\Company;
use App\Modules\Sales\Models\Quotation;
use Illuminate\Mail\Attachment;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/** The approved quotation, sent to the customer with the PDF attached. */
class QuotationMail extends Mailable
{
    public function __construct(
        public Quotation $quotation,
        public Company $company,
        public User $sender,
        public string $pdf,
        public ?string $note = null,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Quotation '.$this->quotation->document_number.' from '.$this->company->name,
            // Replies go to the salesperson who sent it, not to the system address.
            replyTo: [new Address($this->sender->email, $this->sender->name)],
        );
    }

    public function content(): Content
    {
        return new Content(view: 'emails.quotation');
    }

    public function attachments(): array
    {
        return [
            Attachment::fromData(fn () => $this->pdf, 'quotation-'.str_replace('/', '-', $this->quotation->document_number).'.pdf')
                ->withMime('application/pdf'),
        ];
    }
}
