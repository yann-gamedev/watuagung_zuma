"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CircleAlert, CircleCheck, CircleX } from "lucide-react";
import { z } from "zod";
import { apiRequest, isDemo } from "@/services/pelayanan";
import { services } from "@/lib/data";
import type { LetterVerification } from "@/types/pelayanan";

const schema = z.object({
  number: z.string().nullable(), jenis_surat: z.enum(["SKU", "DOMISILI", "SKTM", "KTP_KK"]),
  issued_at: z.string(), nama: z.string(), status: z.enum(["valid", "revoked"]),
});

/** Membaca ?kode= di browser (static export); kode tidak dikirim ke tempat lain selain API verifikasi. */
export function LetterVerifier() {
  const code = useSearchParams().get("kode") ?? "";
  const valid = /^[A-Za-z0-9]{32}$/.test(code);
  const [result, setResult] = useState<LetterVerification | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(valid && !isDemo);
  useEffect(() => {
    if (!valid || isDemo) return;
    let cancelled = false;
    apiRequest<unknown>(`/verify/${code}`)
      .then((body) => { if (!cancelled) setResult(schema.parse(body)); })
      .catch(() => { if (!cancelled) setError("Surat tidak ditemukan. Pastikan QR dipindai dari surat asli, atau hubungi kantor desa."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [code, valid]);

  return (
    <div className="center-card status-card">
      {isDemo ? <div className="notice"><strong>Tidak tersedia pada demo.</strong><p>Verifikasi surat hanya berjalan pada layanan resmi desa.</p></div>
        : !valid ? <div className="error-box" role="alert"><CircleAlert size={24} aria-hidden="true" /><span>Kode verifikasi tidak ada atau tidak lengkap. Pindai ulang QR pada surat.</span></div>
        : loading ? <div className="skeleton" role="status" aria-label="Memeriksa surat" />
        : error ? <div className="error-box" role="alert"><CircleAlert size={24} aria-hidden="true" /><span>{error}</span></div>
        : result && <section className="lookup-result" aria-labelledby="verify-heading">
          <div className={"status-exception status-" + (result.status === "valid" ? "APPROVED" : "REJECTED")}>
            <div className="status-exception-heading">
              {result.status === "valid" ? <CircleCheck size={24} aria-hidden="true" /> : <CircleX size={24} aria-hidden="true" />}
              <h2 id="verify-heading">{result.status === "valid" ? "Surat sah tercatat di Desa Watuagung" : "Surat ini sudah dibatalkan"}</h2>
            </div>
          </div>
          <dl className="status-next-step">
            <dt>Nomor surat</dt><dd className="receipt-value">{result.number ?? "Tidak bernomor (permohonan lama)"}</dd>
            <dt>Jenis surat</dt><dd>{services.find((s) => s.code === result.jenis_surat)?.title ?? result.jenis_surat}</dd>
            <dt>Tanggal terbit</dt><dd><time dateTime={result.issued_at}>{new Date(result.issued_at).toLocaleDateString("id-ID", { dateStyle: "long" })}</time></dd>
            <dt>Nama pemohon</dt><dd>{result.nama}</dd>
          </dl>
          <p>Cocokkan data di atas dengan surat yang Anda pegang. QR ini hanya alat cek keaslian, bukan tanda tangan elektronik; surat sah ditandatangani dan distempel Kepala Desa.</p>
          <Link href="/kontak" className="text-link">Lihat Kontak Kantor</Link>
        </section>}
    </div>
  );
}
