"use client";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Copy, CircleAlert, Search, House } from "lucide-react";
import { useEffect, useState } from "react";
import { isDemo } from "@/services/pelayanan";
export function Success() {
  const id = useSearchParams().get("id");
  const [message, setMessage] = useState("");
  const [secret, setSecret] = useState("");
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
    if (!id || isDemo) return;
    const value = sessionStorage.getItem(`watuagung-receipt-${id}`) || "";
    queueMicrotask(() => setSecret(value));
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
          <strong>{isDemo ? "Simpan nomor pengajuan ini." : "Simpan nomor dan kode akses ini. Kode akses tidak bisa dipulihkan."}</strong>
          <p>{isDemo
            ? "Status simulasi hanya tersedia di browser yang sama dan tidak berubah otomatis. Menghapus penyimpanan browser akan menghapus riwayat. Simulasi tidak memerlukan kode akses."
            : "Simpan di tempat aman. Kode akses hanya tersedia di tab ini dan tidak dapat dipulihkan saat ini."}</p>
          {!isDemo && !secret && <p>Kode akses tidak tersedia di tab ini. Gunakan kode yang telah Anda simpan atau hubungi kantor desa untuk arahan.</p>}
        </div>
      </div>
      <div className="button-row">
        <Link href={"/pelayanan/status/?id=" + encodeURIComponent(id)} className="btn">
          <Search size={22} aria-hidden="true" /> Cek Status Surat
        </Link>
        <Link className="btn btn-secondary" href="/">
          <House size={22} aria-hidden="true" /> Kembali ke Beranda
        </Link>
      </div>
    </div>
  );
}
