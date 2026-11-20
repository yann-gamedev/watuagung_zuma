<x-mail::message>
# Percobaan PIN gagal

PIN persetujuan salah dimasukkan 5 kali pada tautan persetujuan permohonan **{{ $requestId }}**. Tautan tersebut sudah dikunci dan tidak dapat dipakai lagi.

Permohonan belum diputuskan. Silakan putuskan lewat panel admin.

Bila bukan Anda yang mencoba, kemungkinan email persetujuan Anda dibuka orang lain. Ganti PIN persetujuan di panel (menu Notifikasi email) dan beri tahu administrator desa.

Salam,<br>
{{ config('mail.from.name') }}
</x-mail::message>
