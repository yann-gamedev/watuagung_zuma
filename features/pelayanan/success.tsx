"use client";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Copy, CircleAlert, Search, House } from "lucide-react";
import { useEffect, useState } from "react";
import { isDemo } from "@/services/pelayanan";
import { services } from "@/lib/data";
import { HubungiPetugas } from "@/components/hubungi-petugas";
export function Success() {
  const id = useSearchParams().get("id");
  const [message, setMessage] = useState("");
  const [secret, setSecret] = useState("");
  const [letterType, setLetterType] = useState("");
  const [email, setEmail] = useState("");
  const [copied, setCopied] = useState({ number: false, secret: false });
  async function copyReceipt(value: string, field: "number" | "secret") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied((previous) => ({ ...previous, [field]: true }));
      setMessage(field === "number" ? "Nomor pengajuan tersalin." : "Kode akses tersalin.");
    } catch {
      setCopied((previous) => ({ ...previous, [field]: false }));
      setMessage("Tidak dapat menyalin otomatis. Pilih dan salin teks secara manual.");
    }
  }
  useEffect(() => {
    if (!id) return;
    try {
      const type = sessionStorage.getItem(`watuagung-receipt-type-${id}`) || "";
      const value = isDemo ? "" : sessionStorage.getItem(`watuagung-receipt-${id}`) || "";
      const maskedEmail = isDemo ? "" : sessionStorage.getItem(`watuagung-receipt-email-${id}`) || "";
      queueMicrotask(() => { setLetterType(type); setSecret(value); setEmail(maskedEmail); });
    } catch { /* Peringatan kode akses tetap ditampilkan bila storage tidak tersedia. */ }
  }, [id]);
  if (!id || !/^REQ-\d{4}-[A-Z0-9]{6,36}$/.test(id))
    return (
      <div className="center-card receipt-card">
        <h1>Nomor pengajuan belum tersedia</h1>
        <p className="my-5">
          Silakan ajukan layanan atau gunakan nomor yang telah Anda simpan.
        </p>
        <Link href="/pelayanan" className="btn">
          Pilih layanan
        </Link>
        <HubungiPetugas />
      </div>
    );
  return (
    <div className="center-card receipt-card">
      <span className="success-icon">
        <CheckCircle2 size={26} aria-hidden="true" />
      </span>
      <h1>Pengajuan berhasil dikirim</h1>
      <p className="receipt-intro">
        {isDemo
          ? "Pengajuan simulasi Anda telah diterima. Ini bukan pengajuan resmi ke kantor desa."
          : "Terima kasih. Pengajuan Anda akan diverifikasi oleh petugas desa."}
      </p>
      {isDemo ? <p>Email pemberitahuan tidak dikirim dalam mode simulasi.</p> : email && <div className="notice [overflow-wrap:anywhere]" role="status"><p>Kabar status akan dikirim ke {email}.</p><p>Jika email belum terlihat, cek folder spam.</p></div>}
      {letterType && <p>Jenis surat: <strong>{services.find((service) => service.code === letterType)?.title || letterType}</strong></p>}
      <div className="receipt-item">
        <div>
          <p id="receipt-number-label">Nomor pengajuan</p>
          <p className="receipt-value" aria-labelledby="receipt-number-label">{id}</p>
        </div>
        <button
          id="copy-receipt"
          type="button"
          className="btn btn-secondary"
          aria-label={copied.number ? "Nomor pengajuan tersalin" : "Salin nomor pengajuan"}
          onClick={() => void copyReceipt(id, "number")}
        >
          {copied.number ? <CheckCircle2 size={22} aria-hidden="true" /> : <Copy size={22} aria-hidden="true" />}
          {copied.number ? "Tersalin" : "Salin"}
        </button>
      </div>
      {!isDemo && secret && (
        <div className="receipt-item">
          <div>
            <p id="receipt-secret-label">Kode akses rahasia</p>
            <p className="receipt-value" aria-labelledby="receipt-secret-label">{secret}</p>
          </div>
          <button
            id="copy-secret"
            type="button"
            className="btn btn-secondary"
            aria-label={copied.secret ? "Kode akses tersalin" : "Salin kode akses"}
            onClick={() => void copyReceipt(secret, "secret")}
          >
            {copied.secret ? <CheckCircle2 size={22} aria-hidden="true" /> : <Copy size={22} aria-hidden="true" />}
            {copied.secret ? "Tersalin" : "Salin"}
          </button>
        </div>
      )}
      <p role="status" className="copy-feedback">{message}</p>
      <div className="receipt-warning">
        <CircleAlert size={24} aria-hidden="true" />
        <div>
          <strong>{isDemo ? "Simpan nomor pengajuan ini." : "Simpan nomor dan kode akses ini."}</strong>
          <p>{isDemo
            ? "Status simulasi hanya tersedia di browser yang sama dan tidak berubah otomatis. Menghapus penyimpanan browser akan menghapus riwayat. Simulasi tidak memerlukan kode akses."
            : "Simpan di tempat aman; kode hanya tampil di tab ini. Nomor pengajuan dan kode akses diperlukan untuk cek status dan unduh surat. Surat berlaku 7 hari sejak disetujui Kepala Desa. Jangan bagikan kode akses, termasuk melalui WhatsApp. Jika hilang, hubungi petugas untuk arahan."}</p>
          {!isDemo && !secret && <p>Kode akses tidak tersedia di tab ini. Gunakan kode yang telah Anda simpan atau hubungi kantor desa untuk arahan.</p>}
        </div>
      </div>
      {!isDemo && <p className="receipt-intro">Setelah Kepala Desa menyetujui, surat langsung bisa diunduh dan dicetak sendiri melalui Cek Status Surat. Surat berlaku 7 hari.</p>}
      <div className="button-row">
        <Link href={"/pelayanan/status/?id=" + encodeURIComponent(id)} className="btn">
          <Search size={22} aria-hidden="true" /> Cek Status Surat
        </Link>
        <Link className="btn btn-secondary" href="/">
          <House size={22} aria-hidden="true" /> Kembali ke Beranda
        </Link>
      </div>
      <HubungiPetugas requestId={id} />
    </div>
  );
}
