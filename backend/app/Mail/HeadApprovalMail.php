<?php

namespace App\Mail;

use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/**
 * Permintaan persetujuan untuk kepala desa. Semua tombol hanya membuka halaman konfirmasi (pemindai tautan
 * Gmail/Outlook/antivirus membuka setiap tautan); keputusan baru terjadi setelah PIN dimasukkan. Tanpa NIK/alamat.
 */
class HeadApprovalMail extends Mailable
{
    public function __construct(
        public readonly string $requestId,
        public readonly string $letterType,
        public readonly string $applicantName,
        public readonly string $submittedAt,
        public readonly ?string $verifierName,
        public readonly ?string $letterNumber,
        public readonly string $reviewUrl,
        public readonly string $approveUrl,
        public readonly string $rejectUrl,
        public readonly string $expiresAt,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: "Perlu persetujuan: {$this->letterType} — {$this->requestId}");
    }

    public function content(): Content
    {
        return new Content(markdown: 'mail.head-approval');
    }
}
