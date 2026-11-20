<x-mail::message>
# Konfirmasi email notifikasi

Halo {{ $name }}, alamat ini dimasukkan sebagai email notifikasi akun Anda di panel pelayanan desa.

<x-mail::button :url="$verifyUrl">
Konfirmasi email
</x-mail::button>

Tautan berlaku 24 jam. Notifikasi (termasuk permintaan persetujuan untuk Kepala Desa) baru dikirim setelah email dikonfirmasi.

Bila Anda tidak mengubah email notifikasi, abaikan email ini dan beri tahu administrator desa.

Salam,<br>
{{ config('mail.from.name') }}
</x-mail::message>
