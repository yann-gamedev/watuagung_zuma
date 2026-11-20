<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Email status untuk pemohon. Isi sengaja minimal (docs/PROMPTS-EMAIL.md § Prinsip keamanan → Email pemohon):
 * nomor pengajuan, jenis surat, status, catatan petugas untuk Perlu perbaikan/Ditolak, tautan cek status TANPA
 * kode akses. Tidak pernah memuat NIK, alamat, kode akses, atau tautan unduh langsung, karena alamat email bisa
 * salah ketik dan sampai ke orang lain.
 *
 * Dikirim langsung dari listener antrean (bukan di-queue lagi) agar isi tidak tersimpan di tabel jobs.
 */
class ApplicantStatusMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly string $requestId,
        public readonly string $letterType,
        public readonly string $statusLabel,
        public readonly string $statusLine,
        public readonly ?string $note,
        public readonly string $statusUrl,
        public readonly string $unsubscribeUrl,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: "Status permohonan {$this->requestId}: {$this->statusLabel}");
    }

    public function content(): Content
    {
        return new Content(markdown: 'mail.applicant-status');
    }
}
