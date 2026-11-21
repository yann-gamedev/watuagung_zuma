<?php

namespace App\Mail;

use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/** 5 PIN salah pada satu tautan persetujuan: tautan dikunci dan kepala desa diberi tahu (tanpa alamat IP). */
class PinLockedMail extends Mailable
{
    public function __construct(public readonly string $requestId) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: "Percobaan PIN gagal — {$this->requestId}");
    }

    public function content(): Content
    {
        return new Content(markdown: 'mail.pin-locked');
    }
}
