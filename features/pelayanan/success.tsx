"use client";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { isDemo } from "@/services/pelayanan";
export function Success() {
  const id = useSearchParams().get("id");
  const [message, setMessage] = useState("");
  const [secret, setSecret] = useState("");
  useEffect(() => {
    if (!id || isDemo) return;
    const value = sessionStorage.getItem(`watuagung-receipt-${id}`) || "";
    queueMicrotask(() => setSecret(value));
  }, [id]);
  if (!id || !/^REQ-\d{4}-[A-Z0-9]{6,36}$/.test(id))
    return (
      <div className="center-card">
        <h2>Nomor pengajuan belum tersedia</h2>
        <p className="my-5">
          Silakan ajukan layanan atau gunakan nomor yang telah Anda simpan.
        </p>
        <Link href="/pelayanan" className="btn">
          Pilih layanan
        </Link>
      </div>
    );
  return (
    <div className="center-card success-card">
      <span className="success-icon">
        <CheckCircle2 size={34} />
      </span>
      <h2>Permohonan berhasil dikirim.</h2>
      <p>
        {isDemo
          ? "Pengajuan simulasi Anda telah diterima."
          : "Terima kasih. Permohonan Anda akan diverifikasi oleh petugas desa."}
      </p>
      <div className="receipt">
        <small className="block text-xs font-normal mb-2">
          Nomor Pengajuan
        </small>
        {id}
      </div>
      {!isDemo && secret && <div className="receipt"><small className="block text-xs font-normal mb-2">Kode akses rahasia</small>{secret}</div>}
      <p className="mb-6">{isDemo ? "Simpan nomor ini untuk mengecek status pelayanan." : "Simpan nomor dan kode akses ini di tempat aman. Kode akses hanya tersedia di tab ini dan tidak dapat dipulihkan saat ini."}</p>
      <div className="button-row">
        <Link
          href={"/pelayanan/status/?id=" + encodeURIComponent(id)}
          className="btn"
        >
          Cek status permohonan
        </Link>
        <button
          id="copy-receipt"
          className="btn btn-secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(secret ? `Nomor: ${id}\nKode akses: ${secret}` : id);
              setMessage(secret ? "Nomor dan kode akses disalin." : "Nomor pengajuan disalin.");
            } catch {
              setMessage("Salin nomor dan kode akses secara manual.");
            }
          }}
        >
          <Copy size={16} /> Salin {secret ? "nomor dan kode" : "nomor"}
        </button>
      </div>
      <p role="status" className="text-sm">
        {message}
      </p>
      <Link className="text-link mt-6" href="/">
        Kembali ke beranda
      </Link>
    </div>
  );
}
